# HITL Routing Quick Start

## What is HITL?

Human-in-the-Loop (HITL) routing automatically identifies low-confidence document extractions and sends them to human verifiers for review. This ensures data quality while maintaining high throughput.

## How It Works

1. **Document Processing**: OCR extracts text and AI structures the data
2. **Confidence Check**: System calculates confidence scores
3. **Automatic Routing**:
   - High confidence (≥80%) → Auto-processed
   - Low confidence (<80%) → Sent to human verifier
4. **Verification**: Human reviews and corrects data
5. **Completion**: Corrected data continues to FHIR transformation

## Quick Setup

### 1. Deploy Infrastructure

The HITL queue is automatically created when you deploy the infrastructure:

```bash
cd infrastructure
npm run deploy
```

This creates:

- SQS queue for HITL messages
- Dead letter queue for failed messages
- SNS topic for notifications

### 2. Configure Environment Variables

Document Processing Lambda:

```bash
CONFIDENCE_THRESHOLD=0.80
HITL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/vaidyalink-hitl-dev
```

HITL Handler Lambda:

```bash
SCANJOBS_TABLE=vaidyalink-scanjobs-dev
DOCUMENTS_BUCKET=vaidyalink-documents-dev
FHIR_TRANSFORMER_LAMBDA_ARN=arn:aws:lambda:us-east-1:123456789012:function:fhir-transformer
```

### 3. Test HITL Routing

Upload a low-quality document to trigger HITL routing:

```bash
# Upload a blurry or handwritten document
aws s3 cp test-document.jpg s3://vaidyalink-documents-dev/raw/patient-123/job-456/original.jpg
```

Check the HITL queue:

```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/vaidyalink-hitl-dev \
  --attribute-names ApproximateNumberOfMessages
```

### 4. Process Verification

Submit corrected data via API:

```bash
curl -X POST https://api.vaidyalink.com/api/v1/hitl/job-456/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "correctedData": {
      "patient_name": "John Doe",
      "medications": [
        {"name": "Aspirin", "dosage": "100mg"}
      ]
    },
    "verifiedBy": "verifier@example.com",
    "notes": "Corrected patient name"
  }'
```

## Confidence Threshold

Default: **0.80 (80%)**

Adjust based on your accuracy requirements:

- **Higher threshold (0.85-0.90)**: More documents go to HITL, higher accuracy
- **Lower threshold (0.70-0.75)**: Fewer documents go to HITL, faster processing

## Monitoring

### Check Queue Depth

```bash
aws sqs get-queue-attributes \
  --queue-url YOUR_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages
```

### View CloudWatch Metrics

```bash
aws cloudwatch get-metric-statistics \
  --namespace VaidyaLink \
  --metric-name HITLRoutingRate \
  --start-time 2024-01-15T00:00:00Z \
  --end-time 2024-01-15T23:59:59Z \
  --period 3600 \
  --statistics Average
```

## Common Scenarios

### Scenario 1: High Routing Rate

**Problem**: Too many documents going to HITL (>20%)

**Solution**: Lower confidence threshold or improve image quality

```bash
# Lower threshold to 0.75
export CONFIDENCE_THRESHOLD=0.75
```

### Scenario 2: Queue Backlog

**Problem**: HITL queue has many pending messages

**Solution**: Add more verifiers or increase processing capacity

```bash
# Check queue depth
aws sqs get-queue-attributes \
  --queue-url YOUR_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages
```

### Scenario 3: Critical Field Failures

**Problem**: Specific fields consistently fail confidence check

**Solution**: Review field validation logic or adjust field weights

## Testing

### Test Low Confidence Document

```python
# Create a test document with low confidence
import boto3

s3 = boto3.client('s3')

# Upload a blurry image
with open('blurry-prescription.jpg', 'rb') as f:
    s3.put_object(
        Bucket='vaidyalink-documents-dev',
        Key='raw/test-patient/test-job/original.jpg',
        Body=f
    )

# Check if message appears in HITL queue
sqs = boto3.client('sqs')
messages = sqs.receive_message(
    QueueUrl='YOUR_QUEUE_URL',
    MaxNumberOfMessages=1
)

print(messages)
```

### Test Verification Flow

```javascript
// Submit verification
const response = await fetch('/api/v1/hitl/test-job/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    correctedData: {
      patient_name: 'Test Patient',
      medications: [],
    },
    verifiedBy: 'test@example.com',
  }),
});

console.log(await response.json());
```

## Troubleshooting

### Messages Not Appearing in Queue

**Check**:

1. Lambda has permission to send to SQS
2. HITL_QUEUE_URL is correctly configured
3. Confidence scores are actually below threshold

```bash
# Check Lambda logs
aws logs tail /aws/lambda/document-processing --follow
```

### Verification Not Completing

**Check**:

1. HITL handler has permission to update DynamoDB
2. FHIR transformer Lambda ARN is correct
3. S3 bucket permissions are correct

```bash
# Check HITL handler logs
aws logs tail /aws/lambda/hitl-handler --follow
```

### High Error Rate

**Check**:

1. Dead letter queue for failed messages
2. CloudWatch logs for error details
3. IAM permissions for all services

```bash
# Check DLQ
aws sqs receive-message \
  --queue-url YOUR_DLQ_URL \
  --max-number-of-messages 10
```

## Next Steps

1. **Set Up Verification UI**: Build interface for human verifiers
2. **Configure Alerts**: Set up CloudWatch alarms for queue depth
3. **Monitor Metrics**: Track routing rate and verification time
4. **Optimize Threshold**: Adjust based on accuracy vs. throughput needs

## Resources

- [Full HITL Documentation](./HITL_ROUTING.md)
- [Confidence Scoring Guide](./CONFIDENCE_SCORING.md)
- [API Documentation](../../docs/API.md)
- [Monitoring Guide](../../docs/MONITORING.md)
