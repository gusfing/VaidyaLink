# Document Processing Lambda - Setup and Configuration

## Overview

The Document Processing Lambda is the core component of VaidyaLink's medical document digitization pipeline. It processes uploaded medical document images through OCR extraction, clinical data structuring, and intelligent routing.

**Runtime:** Python 3.11
**Memory:** 2048 MB (configurable)
**Timeout:** 300 seconds (5 minutes)
**Architecture:** Serverless, event-driven

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    S3 Event Trigger                          │
│              (Document Upload Notification)                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Document Processing Lambda                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. Extract Text (PaddleOCR)                          │  │
│  │  2. Structure Data (Amazon Bedrock)                   │  │
│  │  3. Calculate Confidence Scores                       │  │
│  │  4. Route to HITL if needed                           │  │
│  │  5. Save Extracted Data to S3                         │  │
│  │  6. Trigger FHIR Transformation                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │   HITL Queue     │    │ FHIR Transformer │
    │  (Low Conf.)     │    │     Lambda       │
    └──────────────────┘    └──────────────────┘
```

## Infrastructure Components

### 1. Lambda Function

**Configuration:**

- **Function Name:** `vaidyalink-document-processing-{environment}`
- **Runtime:** Python 3.11
- **Handler:** `index.handler`
- **Memory:** 2048 MB (optimized for OCR processing)
- **Timeout:** 300 seconds (handles multi-page documents)
- **VPC:** Deployed in private subnets with NAT Gateway
- **Tracing:** AWS X-Ray enabled for distributed tracing
- **Log Retention:** 30 days in CloudWatch Logs

### 2. IAM Permissions

The Lambda function has the following permissions:

**DynamoDB:**

- `dynamodb:GetItem` - Read job metadata
- `dynamodb:PutItem` - Create new records
- `dynamodb:UpdateItem` - Update job status
- `dynamodb:BatchGetItem` - Batch read operations

**S3:**

- `s3:GetObject` - Read uploaded documents
- `s3:PutObject` - Save extracted data
- `s3:GetObjectVersion` - Access versioned objects

**Amazon Bedrock:**

- `bedrock:InvokeModel` - Call Claude 3.5 Sonnet for structuring

**SQS:**

- `sqs:SendMessage` - Route to HITL queue

**Lambda:**

- `lambda:InvokeFunction` - Trigger FHIR transformer

**KMS:**

- `kms:Decrypt` - Decrypt S3 objects and DynamoDB data
- `kms:GenerateDataKey` - Encrypt new S3 objects

### 3. Environment Variables

| Variable                      | Description                            | Example                                     |
| ----------------------------- | -------------------------------------- | ------------------------------------------- |
| `ENVIRONMENT`                 | Deployment environment                 | `prod`, `staging`, `dev`                    |
| `SCANJOBS_TABLE`              | DynamoDB table for scan jobs           | `vaidyalink-scanjobs-prod`                  |
| `PATIENTS_TABLE`              | DynamoDB table for patients            | `vaidyalink-patients-prod`                  |
| `VOICEJOBS_TABLE`             | DynamoDB table for voice jobs          | `vaidyalink-voicejobs-prod`                 |
| `DOCUMENTS_BUCKET`            | S3 bucket for documents                | `vaidyalink-documents-prod-123456789`       |
| `BEDROCK_MODEL_ID`            | Bedrock model identifier               | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| `CONFIDENCE_THRESHOLD`        | Minimum confidence for auto-processing | `0.80`                                      |
| `HITL_QUEUE_URL`              | SQS queue URL for HITL                 | `https://sqs.ap-south-1.amazonaws.com/...`  |
| `FHIR_TRANSFORMER_LAMBDA_ARN` | ARN of FHIR transformer                | `arn:aws:lambda:...`                        |
| `OCR_LANGUAGES`               | Comma-separated language codes         | `en,hi,ta,te`                               |
| `USE_GPU`                     | Enable GPU acceleration for OCR        | `false`                                     |

### 4. VPC Configuration

**Subnets:**

- Deployed in private subnets with egress (NAT Gateway)
- Multi-AZ deployment for high availability

**Security Group:**

- Outbound: HTTPS (443) to VPC endpoints
- Outbound: HTTPS (443) to internet (for external APIs)
- No inbound rules (Lambda doesn't accept incoming connections)

**VPC Endpoints:**

- S3 Gateway Endpoint (no cost)
- DynamoDB Gateway Endpoint (no cost)
- KMS Interface Endpoint
- CloudWatch Logs Interface Endpoint
- STS Interface Endpoint

### 5. CloudWatch Logging

**Log Group:** `/aws/lambda/vaidyalink-document-processing-{environment}`

**Log Retention:** 30 days

**Log Format:**

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "Processing document for job job-456",
  "jobId": "job-456",
  "requestId": "abc-123-def-456"
}
```

### 6. X-Ray Tracing

**Enabled:** Yes

**Trace Segments:**

- Lambda invocation
- DynamoDB operations
- S3 operations
- Bedrock API calls
- SQS operations

**Sampling Rate:** 100% (can be adjusted for cost optimization)

## Event Sources

### 1. S3 Event Notification

Triggered when a document is uploaded to S3:

```json
{
  "Records": [
    {
      "eventSource": "aws:s3",
      "eventName": "ObjectCreated:Put",
      "s3": {
        "bucket": {
          "name": "vaidyalink-documents-prod-123456789"
        },
        "object": {
          "key": "raw/patient-123/job-456/original.jpg"
        }
      }
    }
  ]
}
```

### 2. Direct Invocation

Can be invoked directly with a job ID:

```json
{
  "jobId": "job-456"
}
```

## Processing Flow

### 1. Event Reception

- Lambda receives S3 event or direct invocation
- Extracts job ID and document location
- Updates job status to `processing`

### 2. OCR Extraction (Task 8.2 - ✅ Implemented)

- Downloads image from S3
- Preprocesses image (resize, denoise, enhance)
- Runs PaddleOCR for text extraction
- Handles multi-language documents
- Extracts text with bounding boxes and confidence scores

**See**: [OCR_INTEGRATION.md](./OCR_INTEGRATION.md) and [OCR_QUICK_START.md](./OCR_QUICK_START.md)

### 3. Clinical Data Structuring (Task 8.4 - To Be Implemented)

- Sends extracted text to Amazon Bedrock
- Uses Claude 3.5 Sonnet for structuring
- Extracts: patient name, date, medications, dosages, diagnoses

### 4. Confidence Scoring (Task 8.5 - To Be Implemented)

- Calculates field-level confidence scores
- Computes overall confidence score
- Identifies low-confidence fields

### 5. HITL Routing Decision

- If overall confidence < threshold (0.80):
  - Routes to HITL queue for human verification
  - Updates job status to `hitl_required`
- If confidence >= threshold:
  - Proceeds to save extracted data

### 6. Data Persistence

- Saves extracted data to S3: `processed/{jobId}/extracted.json`
- Updates DynamoDB with extraction results
- Stores confidence scores

### 7. FHIR Transformation Trigger

- Invokes FHIR Transformer Lambda asynchronously
- Passes job ID for downstream processing

### 8. Status Update

- Updates job status to `completed` or `failed`
- Records processing timestamps
- Logs metrics for monitoring

## Error Handling

### Retry Strategy

- **Automatic Retries:** 2 attempts (Lambda default)
- **Exponential Backoff:** Yes
- **Dead Letter Queue:** Configured for failed invocations

### Error Types

**1. Transient Errors (Retryable):**

- Network timeouts
- Service throttling
- Temporary service unavailability

**2. Permanent Errors (Non-Retryable):**

- Invalid image format
- Missing job metadata
- Insufficient permissions

**3. Error Logging:**

```python
logger.error(
    f"Error processing document: {str(e)}",
    exc_info=True,
    extra={
        'jobId': job_id,
        'errorType': type(e).__name__,
        'requestId': context.aws_request_id
    }
)
```

## Monitoring and Metrics

### CloudWatch Metrics

**Standard Lambda Metrics:**

- Invocations
- Duration
- Errors
- Throttles
- Concurrent Executions

**Custom Metrics (To Be Implemented):**

- OCR accuracy rate
- Average confidence score
- HITL routing rate
- Processing latency by document type

### CloudWatch Alarms

**Error Rate Alarm:**

- Threshold: > 5% over 5 minutes
- Action: SNS notification

**Duration Alarm:**

- Threshold: > 240 seconds (80% of timeout)
- Action: SNS notification

**Throttle Alarm:**

- Threshold: > 0 throttles
- Action: SNS notification

## Cost Optimization

### Lambda Pricing

- **Compute:** $0.0000166667 per GB-second
- **Requests:** $0.20 per 1M requests
- **Estimated Cost per Scan:** ₹0.15 - ₹0.25

### Optimization Strategies

**1. Memory Configuration:**

- Current: 2048 MB
- Rationale: OCR processing is memory-intensive
- Optimization: Monitor actual usage, adjust if needed

**2. VPC Endpoints:**

- Use Gateway Endpoints (S3, DynamoDB) - no cost
- Minimize Interface Endpoints - $0.01/hour each

**3. Bedrock Usage:**

- Use on-demand pricing (no reserved capacity)
- Optimize prompt length
- Cache common responses

**4. S3 Operations:**

- Use S3 Intelligent-Tiering for storage
- Minimize GET requests through caching

## Testing

### Unit Tests

Run unit tests:

```bash
cd backend/document-processing
pytest src/__tests__/test_handler.py -v --cov=src
```

### Integration Tests

Test with LocalStack:

```bash
# Start LocalStack
docker-compose up -d localstack

# Run integration tests
pytest tests/integration/ -v
```

### Load Testing

Simulate concurrent document processing:

```bash
# Using artillery
artillery run load-test.yml
```

## Deployment

### Using CDK

```bash
# Install dependencies
cd infrastructure
npm install

# Deploy to staging
cdk deploy VaidyaLinkStack-staging

# Deploy to production
cdk deploy VaidyaLinkStack-prod
```

### Manual Deployment

```bash
# Package Lambda
cd backend/document-processing
pip install -r requirements.txt -t package/
cp -r src/* package/
cd package && zip -r ../lambda.zip . && cd ..

# Upload to S3
aws s3 cp lambda.zip s3://deployment-bucket/lambda.zip

# Update Lambda function
aws lambda update-function-code \
  --function-name vaidyalink-document-processing-prod \
  --s3-bucket deployment-bucket \
  --s3-key lambda.zip
```

## Troubleshooting

### Common Issues

**1. Lambda Timeout**

- **Symptom:** Function times out after 300 seconds
- **Solution:** Optimize OCR processing, increase timeout, or split into smaller jobs

**2. Memory Exceeded**

- **Symptom:** Function runs out of memory
- **Solution:** Increase memory allocation, optimize image processing

**3. VPC Connectivity Issues**

- **Symptom:** Cannot reach external APIs
- **Solution:** Check NAT Gateway, security groups, route tables

**4. Permission Denied**

- **Symptom:** Access denied errors for S3/DynamoDB
- **Solution:** Review IAM policies, check KMS key permissions

### Debug Mode

Enable debug logging:

```bash
aws lambda update-function-configuration \
  --function-name vaidyalink-document-processing-prod \
  --environment Variables={LOG_LEVEL=DEBUG}
```

### X-Ray Traces

View traces in AWS Console:

1. Navigate to X-Ray service
2. Select "Traces"
3. Filter by function name
4. Analyze service map and trace details

## Security Considerations

### Data Encryption

**At Rest:**

- S3: KMS encryption with customer-managed keys
- DynamoDB: KMS encryption with customer-managed keys
- CloudWatch Logs: KMS encryption

**In Transit:**

- TLS 1.3 for all API calls
- VPC endpoints for AWS service communication

### Access Control

**Principle of Least Privilege:**

- Lambda role has only required permissions
- No wildcard permissions
- Resource-level permissions where possible

**Network Isolation:**

- Lambda in private subnets
- No direct internet access (via NAT Gateway)
- Security groups restrict traffic

### Audit Logging

**CloudTrail:**

- All API calls logged
- 7-year retention for compliance
- Encrypted with KMS

**Application Logs:**

- All processing events logged
- PII data masked in logs
- Structured logging for analysis

## Next Steps

### Task 8.2: Integrate PaddleOCR ✅ Completed

- ✅ Installed PaddleOCR dependencies
- ✅ Created OCR module with multilingual support
- ✅ Implemented text extraction with bounding boxes
- ✅ Added confidence scoring
- ✅ Integrated into Lambda handler
- ✅ Created comprehensive tests
- ✅ Documented usage and configuration

### Task 8.3: Image Preprocessing

- Add image enhancement pipeline
- Handle various image formats
- Optimize for OCR accuracy

### Task 8.4: Bedrock Integration

- Implement clinical data structuring
- Create prompt templates
- Add response parsing

### Task 8.5: Confidence Scoring

- Implement scoring algorithm
- Add field-level confidence
- Tune threshold values

## References

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [PaddleOCR Documentation](https://github.com/PaddlePaddle/PaddleOCR)
- [VaidyaLink Requirements](../../.kiro/specs/vaidyalink/requirements.md)
- [VaidyaLink Design](../../.kiro/specs/vaidyalink/design.md)
