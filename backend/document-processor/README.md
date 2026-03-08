# Document Processor Lambda

Lambda function for processing medical document images uploaded to S3 as part of the AWS Real Data Integration spec.

## Overview

This Lambda function is triggered by S3 event notifications when documents are uploaded to the documents bucket. It:

1. Parses S3 event to extract bucket and key
2. Extracts jobId from S3 key pattern: `uploads/{userId}/{jobId}-{filename}`
3. Updates job status to 'processing' in DynamoDB
4. Downloads document from S3
5. Extracts text using PaddleOCR with retry logic (1 retry)
6. Updates job status to 'extracting' after OCR completes
7. Extracts structured medical entities using Amazon Bedrock (Claude 3.5 Sonnet)
8. Updates job status to 'transforming' after entity extraction completes

## Configuration

### Runtime

- Python 3.11
- Memory: 3008 MB
- Timeout: 300 seconds (5 minutes)

### Environment Variables

| Variable           | Description                            | Required                                                |
| ------------------ | -------------------------------------- | ------------------------------------------------------- |
| `JOBS_TABLE`       | DynamoDB table name for job tracking   | Yes                                                     |
| `BEDROCK_MODEL_ID` | Bedrock model ID for entity extraction | No (default: anthropic.claude-3-5-sonnet-20241022-v2:0) |
| `LOG_LEVEL`        | Logging level (INFO, DEBUG, ERROR)     | No (default: INFO)                                      |

### IAM Permissions

The Lambda execution role requires:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:UpdateItem", "dynamodb:GetItem"],
      "Resource": "arn:aws:dynamodb:*:*:table/document-scan-jobs-*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::document-scan-documents-*/*"
    },
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### Dependencies

The Lambda requires the following Python packages:

- `boto3>=1.28.0` - AWS SDK
- `paddlepaddle==2.5.1` - PaddlePaddle deep learning framework
- `paddleocr==2.7.0.3` - PaddleOCR for text extraction
- `Pillow>=10.0.0` - Image processing
- `numpy>=1.24.0` - Numerical operations

These dependencies should be packaged in a Lambda layer due to their size.

## S3 Event Trigger

The Lambda is triggered by S3 event notifications with the following configuration:

- Event type: `s3:ObjectCreated:*`
- Prefix filter: `uploads/`
- Bucket: `document-scan-documents-{env}`

## S3 Key Pattern

Documents must be uploaded with the following key pattern:

```
uploads/{userId}/{jobId}-{filename}
```

Example:

```
uploads/user123/abc-123-def/prescription.jpg
```

Where:

- `userId`: User identifier
- `jobId`: Unique job identifier (UUID format recommended)
- `filename`: Original filename

## Job Status Updates

The Lambda updates the DynamoDB job record with:

**Processing Status:**

```json
{
  "jobId": "abc-123-def",
  "status": "processing",
  "message": "Processing document with OCR...",
  "processingStartedAt": "2024-03-07T10:30:00.000Z",
  "s3Bucket": "document-scan-documents-dev",
  "s3Key": "uploads/user123/abc-123-def/prescription.jpg",
  "updatedAt": "2024-03-07T10:30:00.000Z"
}
```

**Extracting Status (after OCR completes):**

```json
{
  "jobId": "abc-123-def",
  "status": "extracting",
  "message": "Extracting medical entities...",
  "ocrCompletedAt": "2024-03-07T10:30:15.000Z",
  "ocrTextLength": 1234,
  "updatedAt": "2024-03-07T10:30:15.000Z"
}
```

**Transforming Status (after entity extraction completes):**

```json
{
  "jobId": "abc-123-def",
  "status": "transforming",
  "message": "Transforming to FHIR format...",
  "entityExtractionCompletedAt": "2024-03-07T10:30:25.000Z",
  "entitiesCount": 15,
  "medicationsCount": 3,
  "conditionsCount": 2,
  "labResultsCount": 5,
  "updatedAt": "2024-03-07T10:30:25.000Z"
}
```

**Failed Status (if processing fails):**

```json
{
  "jobId": "abc-123-def",
  "status": "failed",
  "message": "Entity extraction failed: [error details]",
  "failedAt": "2024-03-07T10:30:20.000Z",
  "error": "[error details]",
  "updatedAt": "2024-03-07T10:30:20.000Z"
}
```

## Error Handling

The Lambda handles the following error scenarios:

1. **Invalid S3 key format**: Logs error and raises ValueError
2. **DynamoDB update failure**: Logs error and raises ClientError
3. **Missing event fields**: Logs error and raises ValueError
4. **S3 download failure**: Retries once with exponential backoff (2 seconds), then fails
5. **OCR extraction failure**: Retries once with exponential backoff (2 seconds), then fails
6. **PaddleOCR not available**: Fails immediately with descriptive error
7. **Bedrock throttling**: Retries up to 3 times with exponential backoff (1s, 2s, 4s)
8. **Bedrock API errors**: Retries up to 3 times for transient errors, fails immediately for non-retryable errors
9. **Invalid Bedrock response**: Logs error and raises ValueError

All errors are logged to CloudWatch Logs with full context. When processing fails after all retries, the job status is updated to 'failed' with error details.

## Entity Extraction

The Lambda uses Amazon Bedrock (Claude 3.5 Sonnet) to extract structured medical entities from OCR text:

### Extracted Data Structure

```json
{
  "entities": [
    {
      "text": "Metformin 500mg",
      "type": "MEDICATION",
      "confidence": 0.95
    },
    {
      "text": "Type 2 Diabetes",
      "type": "CONDITION",
      "confidence": 0.92
    }
  ],
  "medications": [
    {
      "name": "Metformin",
      "dosage": "500mg",
      "frequency": "twice daily",
      "confidence": 0.95
    }
  ],
  "conditions": ["Type 2 Diabetes", "Hypertension"],
  "labResults": [
    {
      "testName": "HbA1c",
      "value": "7.2",
      "unit": "%",
      "confidence": 0.88
    }
  ]
}
```

### Confidence Scores

- **High confidence (0.8-1.0)**: Clear, unambiguous medical terms with complete information
- **Medium confidence (0.5-0.79)**: Recognizable terms but with some ambiguity or incomplete information
- **Low confidence (0.0-0.49)**: Unclear or potentially incorrect information

### Retry Logic

Bedrock calls implement exponential backoff for throttling:

- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 seconds delay
- Attempt 4: 4 seconds delay

Throttling errors (`ThrottlingException`, `TooManyRequestsException`, `ServiceUnavailableException`) trigger retries. Other errors fail immediately.

## Testing

### Property-Based Tests

Property-based tests validate universal correctness properties using the Hypothesis library. These tests generate hundreds of random test cases to ensure the system behaves correctly across all inputs.

**Implemented Properties:**

- **Property 5: Entity Confidence Scores** - All extracted entities must have confidence scores between 0 and 1 (inclusive)
- **Property 6: Medication Structure Completeness** - All medications must contain name, dosage, and frequency fields
- **Property 7: Lab Result Structure Completeness** - All lab results must contain testName, value, and unit fields

**Run property tests:**

```bash
# Install dependencies
pip install -r requirements.txt

# Run all property tests
pytest src/__properties__/ -v

# Or use the convenience script
./run-property-tests.sh  # Linux/Mac
./run-property-tests.ps1  # Windows PowerShell

# Run with more examples (default is 100)
pytest src/__properties__/ -v --hypothesis-max-examples=500
```

See [Property Tests README](src/__properties__/README.md) for detailed documentation.

### Local Testing

```bash
# Install dependencies
pip install -r requirements.txt

# Run all tests
pytest src/ -v

# Run only property tests
pytest src/__properties__/ -v

# Run only unit tests
pytest src/__tests__/ -v
```

### Manual Invocation

```bash
aws lambda invoke \
  --function-name document-processor-dev \
  --payload file://test-event.json \
  response.json
```

Example test event (`test-event.json`):

```json
{
  "Records": [
    {
      "eventSource": "aws:s3",
      "s3": {
        "bucket": {
          "name": "document-scan-documents-dev"
        },
        "object": {
          "key": "uploads/user123/abc-123-def/prescription.jpg"
        }
      }
    }
  ]
}
```

## Deployment

The Lambda is deployed as part of the document-scan-demo infrastructure stack.

```bash
# Deploy via CDK
cd infrastructure
npm run deploy:document-scan-demo
```

## Monitoring

### CloudWatch Metrics

- Invocations
- Errors
- Duration
- Throttles

### CloudWatch Logs

Log group: `/aws/lambda/document-processor-{env}`

Log format:

```
[INFO] Processing S3 object: s3://bucket/key
[INFO] Extracted jobId: abc-123-def
[INFO] Updated job abc-123-def status to 'processing'
```

## Future Enhancements

Task 4.4 implements property tests for entity extraction (completed). Future tasks will add:

- Task 4.5: FHIR transformation
- Task 4.6: Property tests for FHIR transformation
- Task 4.7: Store results and update job status to complete
- Task 4.8: Error handling and failure status updates
- Task 4.9: Property tests for error handling
- Task 4.10: CloudWatch logging and metrics

## Related Documentation

- [AWS Real Data Integration Spec](.kiro/specs/aws-real-data-integration/)
- [API Handler](../api-handler/README.md)
- [Infrastructure Setup](../../infrastructure/docs/DOCUMENT_SCAN_DEMO_INFRASTRUCTURE.md)
