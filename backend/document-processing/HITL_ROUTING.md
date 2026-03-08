# HITL (Human-in-the-Loop) Routing

## Overview

The HITL routing system automatically identifies low-confidence document extractions and routes them to human verifiers for review and correction. This ensures data quality while maintaining high throughput for high-confidence extractions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Document Processing Flow                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  OCR Extraction  │
                    │   (PaddleOCR)    │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │    Bedrock       │
                    │   Structuring    │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Confidence     │
                    │   Calculation    │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Confidence >=   │
                    │   Threshold?     │
                    └──────────────────┘
                         │         │
                    Yes  │         │  No
                         │         │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────┐
              │    Auto      │  │  Route to    │
              │  Processing  │  │  HITL Queue  │
              └──────────────┘  └──────────────┘
                         │              │
                         ▼              ▼
              ┌──────────────┐  ┌──────────────┐
              │    FHIR      │  │    Human     │
              │Transformation│  │ Verification │
              └──────────────┘  └──────────────┘
                                        │
                                        ▼
                              ┌──────────────┐
                              │  Corrected   │
                              │     Data     │
                              └──────────────┘
                                        │
                                        ▼
                              ┌──────────────┐
                              │    FHIR      │
                              │Transformation│
                              └──────────────┘
```

## Confidence Threshold

The default confidence threshold is **0.80 (80%)**.

Documents with overall confidence below this threshold are automatically routed to the HITL queue.

### Configuration

Set the threshold via environment variable:

```bash
CONFIDENCE_THRESHOLD=0.80
```

## Confidence Calculation

The system calculates multi-dimensional confidence scores:

### 1. Overall Confidence

Weighted combination of:

- **OCR Confidence (35%)**: Average confidence from PaddleOCR
- **Extraction Confidence (35%)**: Field completeness score
- **Validation Confidence (30%)**: Data quality validation score

### 2. Field-Level Confidence

Individual scores for each extracted field:

- `patient_name`
- `patient_age`
- `patient_gender`
- `document_date`
- `doctor_name`
- `medications`
- `dosages`
- `diagnosis`
- `lab_results`
- `vital_signs`

### 3. Critical Fields

Fields that require high confidence:

- `patient_name`
- `medications`
- `diagnosis`
- `dosages`

If any critical field falls below the threshold, the document is routed to HITL regardless of overall confidence.

## HITL Queue

### Queue Configuration

- **Queue Name**: `vaidyalink-hitl-{environment}`
- **Visibility Timeout**: 15 minutes
- **Message Retention**: 7 days
- **Dead Letter Queue**: After 3 failed processing attempts
- **Encryption**: AWS KMS

### Message Format

```json
{
  "jobId": "job-123",
  "structuredData": {
    "patient_name": "John Doe",
    "medications": [
      {
        "name": "Aspirin",
        "dosage": "100mg"
      }
    ],
    "diagnosis": "Hypertension"
  },
  "confidenceScores": {
    "overall": 0.75,
    "ocr": 0.8,
    "extraction": 0.85,
    "validation": 0.6,
    "fieldScores": {
      "patient_name": 0.7,
      "medications": 0.8,
      "diagnosis": 0.75
    },
    "criticalFieldsBelowThreshold": ["patient_name"]
  },
  "routedAt": "2024-01-15T10:00:00Z"
}
```

## HITL Handler Lambda

### Responsibilities

1. **Queue Processing**: Consume messages from HITL queue
2. **Data Storage**: Save verification data to S3
3. **Status Updates**: Update job status in DynamoDB
4. **Verification Processing**: Handle corrected data from verifiers
5. **FHIR Triggering**: Trigger FHIR transformation after verification

### Environment Variables

```bash
SCANJOBS_TABLE=vaidyalink-scanjobs-dev
DOCUMENTS_BUCKET=vaidyalink-documents-dev
FHIR_TRANSFORMER_LAMBDA_ARN=arn:aws:lambda:region:account:function:fhir-transformer
```

### Verification Data Storage

Verification data is stored in S3 for the verification interface:

```
s3://vaidyalink-documents-{env}/hitl/{jobId}/verification-data.json
```

Format:

```json
{
  "jobId": "job-123",
  "structuredData": { ... },
  "confidenceScores": { ... },
  "routedAt": "2024-01-15T10:00:00Z",
  "originalImageKey": "raw/patient-456/job-123/original.jpg",
  "patientId": "patient-456",
  "status": "pending_verification"
}
```

## Job Status Flow

1. **processing** → Document is being processed
2. **hitl_required** → Routed to HITL queue (confidence below threshold)
3. **verified** → Human verification completed
4. **completed** → FHIR transformation completed

## Verification API

### Submit Verification

```http
POST /api/v1/hitl/{jobId}/verify
Content-Type: application/json
Authorization: Bearer {token}

{
  "correctedData": {
    "patient_name": "John Doe (Corrected)",
    "medications": [
      {
        "name": "Aspirin",
        "dosage": "100mg"
      }
    ]
  },
  "verifiedBy": "verifier@example.com",
  "notes": "Corrected patient name spelling"
}
```

### Response

```json
{
  "message": "Verification processed successfully",
  "jobId": "job-123"
}
```

## Monitoring

### CloudWatch Metrics

- `HITLQueueDepth`: Number of messages in HITL queue
- `HITLProcessingTime`: Time taken for verification
- `HITLRoutingRate`: Percentage of documents routed to HITL
- `CriticalFieldFailures`: Count of critical field confidence failures

### CloudWatch Alarms

- **High Queue Depth**: Alert when queue depth > 100
- **High Routing Rate**: Alert when routing rate > 20%
- **DLQ Messages**: Alert when messages appear in dead letter queue

## Testing

### Unit Tests

```bash
cd backend/hitl-handler
npm test
```

### Integration Testing

1. Upload a low-quality document image
2. Verify message appears in HITL queue
3. Process verification through API
4. Verify FHIR transformation is triggered

### Test Cases

- ✅ Low confidence document routes to HITL
- ✅ High confidence document bypasses HITL
- ✅ Critical field failure triggers HITL
- ✅ Verification updates job status
- ✅ Corrected data triggers FHIR transformation
- ✅ Failed messages move to DLQ after 3 attempts

## Best Practices

### For Verifiers

1. **Review Original Image**: Always compare extracted data with original document
2. **Check Critical Fields**: Pay special attention to patient name, medications, and dosages
3. **Add Notes**: Document any corrections or concerns
4. **Validate Formats**: Ensure dates, dosages, and measurements are in correct format

### For Administrators

1. **Monitor Queue Depth**: Keep queue depth below 50 for optimal response time
2. **Review DLQ**: Investigate messages in dead letter queue
3. **Adjust Threshold**: Fine-tune confidence threshold based on accuracy metrics
4. **Track Metrics**: Monitor routing rate and verification time

## Troubleshooting

### High Routing Rate (>20%)

**Possible Causes**:

- Poor quality document images
- Handwriting too unclear
- Confidence threshold too high

**Solutions**:

- Improve image preprocessing
- Adjust confidence threshold
- Provide guidance on document quality

### Messages in DLQ

**Possible Causes**:

- Invalid message format
- DynamoDB errors
- S3 access issues

**Solutions**:

- Check CloudWatch logs for errors
- Verify IAM permissions
- Replay messages after fixing issues

### Slow Verification

**Possible Causes**:

- High queue depth
- Insufficient verifiers
- Complex documents

**Solutions**:

- Add more verifiers
- Prioritize critical documents
- Improve verification interface

## Security

### Data Protection

- All messages encrypted with AWS KMS
- S3 data encrypted at rest
- TLS 1.3 for data in transit

### Access Control

- Verifiers require specific IAM role
- API requires JWT authentication
- Audit logs for all verifications

### Compliance

- HIPAA-compliant queue configuration
- Audit trail for all data corrections
- 7-year retention for verification logs

## Future Enhancements

1. **Active Learning**: Use verified data to improve AI models
2. **Confidence Calibration**: Automatically adjust thresholds based on accuracy
3. **Batch Verification**: Allow verifiers to process multiple documents
4. **Real-time Notifications**: WebSocket notifications for new HITL jobs
5. **Verification Analytics**: Dashboard showing verification metrics and trends
