# Voice to FHIR Integration - Quick Start Guide

## Overview

This guide shows how voice-extracted clinical data is automatically converted to FHIR resources and stored in AWS HealthLake.

## How It Works

```
User speaks → Transcription → Entity Extraction → FHIR Transformation → HealthLake Storage
```

## Automatic Process

When a voice recording is processed:

1. **Transcription**: Audio converted to text (Bhashini API)
2. **Entity Extraction**: Clinical entities extracted (Amazon Bedrock)
3. **FHIR Mapping**: Entities mapped to FHIR resources (automatic)
4. **Storage**: Resources stored in AWS HealthLake (automatic)
5. **Tracking**: VoiceJobs table updated with FHIR resource IDs

## Supported Clinical Data

### Symptoms → FHIR Observation

```javascript
// Voice: "I have high fever for 3 days"
// Creates:
{
  resourceType: "Observation",
  category: "symptom",
  code: { text: "fever" },
  valueString: "Duration: 3 days",
  interpretation: "High"
}
```

### Vital Signs → FHIR Observation

```javascript
// Voice: "My temperature is 38.5 degrees"
// Creates:
{
  resourceType: "Observation",
  category: "vital-signs",
  code: { coding: [{ code: "8310-5", display: "Body temperature" }] },
  valueQuantity: { value: 38.5, unit: "C" }
}
```

### Medications → FHIR MedicationStatement

```javascript
// Voice: "Taking Paracetamol 500mg twice daily"
// Creates:
{
  resourceType: "MedicationStatement",
  medication: { concept: { text: "Paracetamol" } },
  dosage: [{ text: "500mg twice daily" }]
}
```

### Allergies → FHIR Observation

```javascript
// Voice: "Allergic to Penicillin, causes rash"
// Creates:
{
  resourceType: "Observation",
  category: "allergy",
  valueString: "Allergen: Penicillin, Reaction: rash"
}
```

## Configuration

### Environment Variables

```bash
# Voice Processing Lambda
FHIR_TRANSFORMER_LAMBDA_ARN=arn:aws:lambda:region:account:function:fhir-transformer
VOICEJOBS_TABLE=VoiceJobs

# FHIR Transformer Lambda
VOICEJOBS_TABLE=VoiceJobs
HEALTHLAKE_DATASTORE_ID=your-datastore-id
HEALTHLAKE_ENDPOINT=https://healthlake.region.amazonaws.com
```

### IAM Permissions

Voice Processing Lambda needs:

```json
{
  "Effect": "Allow",
  "Action": ["lambda:InvokeFunction"],
  "Resource": "arn:aws:lambda:*:*:function:fhir-transformer"
}
```

FHIR Transformer Lambda needs:

```json
{
  "Effect": "Allow",
  "Action": ["healthlake:CreateResource", "healthlake:ReadResource", "dynamodb:UpdateItem"],
  "Resource": ["arn:aws:healthlake:*:*:datastore/*", "arn:aws:dynamodb:*:*:table/VoiceJobs"]
}
```

## Testing Locally

### 1. Test Voice Processing

```javascript
// backend/voice-processing/src/index.js
const event = {
  jobId: 'test-voice-job-123',
};

const result = await handler(event, {});
console.log(result);
```

### 2. Test FHIR Transformation

```python
# backend/fhir-transformer/src/index.py
event = {
    'source': 'voice-processing',
    'patientId': 'patient-123',
    'sourceJobId': 'voice-job-123',
    'timestamp': '2024-01-15T10:30:00Z',
    'resources': [
        {
            'resourceType': 'Observation',
            'category': 'symptom',
            'data': {'symptomName': 'fever', 'severity': 'high'},
            'confidence': 0.92
        }
    ],
    'metadata': {'language': 'hi', 'userConfirmed': True}
}

result = lambda_handler(event, {})
print(result)
```

### 3. Run Tests

```bash
# Voice processing tests
cd backend/voice-processing
npm test src/__tests__/fhir-observation-mapper.test.js

# FHIR transformer tests
cd backend/fhir-transformer
python -m pytest src/__tests__/test_voice_transform.py -v
```

## Querying FHIR Resources

### Get All Resources for a Patient

```python
from healthlake_client import HealthLakeClient

client = HealthLakeClient(datastore_id='your-datastore-id')
resources = client.get_patient_resources('patient-123')

print(f"Observations: {len(resources['Observation'])}")
print(f"Medications: {len(resources['MedicationStatement'])}")
```

### Search by Voice Job ID

```python
# Query DynamoDB to get FHIR resource IDs
import boto3

dynamodb = boto3.client('dynamodb')
response = dynamodb.get_item(
    TableName='VoiceJobs',
    Key={
        'PK': {'S': 'VOICE#voice-job-123'},
        'SK': {'S': 'METADATA'}
    }
)

fhir_resource_ids = response['Item']['fhirResourceIds']['L']
print(f"Created {len(fhir_resource_ids)} FHIR resources")
```

## Monitoring

### CloudWatch Metrics

Key metrics to monitor:

- `VoiceFHIRTransformationSuccess` - Successful transformations
- `VoiceFHIRTransformationFailure` - Failed transformations
- `VoiceFHIRResourcesCreated` - Number of resources created
- `VoiceFHIRTransformationDuration` - Processing time

### CloudWatch Logs

Search for:

```
# Successful transformations
"Voice FHIR transformation completed"

# Failures
"Voice transformation failed"

# Resource creation
"Created Observation from voice data"
"Created MedicationStatement from voice data"
```

## Troubleshooting

### Issue: FHIR transformation not triggered

**Check**:

1. `FHIR_TRANSFORMER_LAMBDA_ARN` environment variable is set
2. Voice processing Lambda has permission to invoke FHIR transformer
3. Voice job has `patientId` set

**Solution**:

```bash
# Check Lambda environment
aws lambda get-function-configuration \
  --function-name voice-processing \
  --query 'Environment.Variables.FHIR_TRANSFORMER_LAMBDA_ARN'

# Check IAM permissions
aws lambda get-policy --function-name fhir-transformer
```

### Issue: Resources not appearing in HealthLake

**Check**:

1. HealthLake datastore ID is correct
2. FHIR transformer has HealthLake permissions
3. Resources pass FHIR validation

**Solution**:

```bash
# Check HealthLake datastore
aws healthlake describe-fhir-datastore \
  --datastore-id your-datastore-id

# Check CloudWatch logs for validation errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/fhir-transformer \
  --filter-pattern "validation error"
```

### Issue: Low confidence scores

**Check**:

1. Audio quality is good
2. Language detection is correct
3. Transcription is accurate

**Solution**:

- Improve audio quality (reduce background noise)
- Specify language explicitly instead of auto-detection
- Use confirmation workflow for low-confidence transcriptions

## Best Practices

### 1. Always Set Patient ID

```javascript
// ✅ Good
const voiceJob = {
  jobId: 'voice-123',
  patientId: 'patient-456', // Required for FHIR
  audioS3Key: 'audio/recording.wav',
};

// ❌ Bad
const voiceJob = {
  jobId: 'voice-123',
  audioS3Key: 'audio/recording.wav', // Missing patientId
};
```

### 2. Enable Confirmation for Critical Data

```javascript
// For critical clinical data, enable confirmation
const ENABLE_PLAYBACK_CONFIRMATION = true;
const TRANSCRIPTION_CONFIDENCE_THRESHOLD = 0.75;
```

### 3. Monitor Confidence Scores

```javascript
// Track confidence distribution
if (confidence < 0.7) {
  console.warn('Low confidence voice extraction');
  // Route to human review
}
```

### 4. Handle Async Failures Gracefully

```javascript
// FHIR transformation is async - don't block on it
try {
  await triggerFHIRTransformation(payload);
} catch (error) {
  // Log but don't fail voice processing
  console.error('FHIR transformation failed (non-fatal):', error);
}
```

## Example: Complete Voice to FHIR Flow

```javascript
// 1. User records voice
const audioFile = await recordAudio();

// 2. Upload to S3
const s3Key = await uploadToS3(audioFile);

// 3. Create voice job
const voiceJob = await createVoiceJob({
  patientId: 'patient-123',
  audioS3Key: s3Key,
  language: 'hi',
});

// 4. Voice processing (automatic)
// - Transcription
// - Entity extraction
// - FHIR transformation (async)

// 5. Poll for completion
const result = await pollVoiceJobStatus(voiceJob.jobId);

// 6. Get FHIR resource IDs
console.log('Created FHIR resources:', result.fhirResourceIds);
// Output: ['Observation/obs-123', 'MedicationStatement/med-456']

// 7. Query HealthLake
const observations = await healthlake.search('Observation', {
  patient: 'patient-123',
  category: 'symptom',
});
```

## Next Steps

1. **Review**: Check [TASK_10.8_SUMMARY.md](./TASK_10.8_SUMMARY.md) for detailed implementation
2. **Test**: Run the test suite to verify integration
3. **Deploy**: Deploy both Lambdas with correct environment variables
4. **Monitor**: Set up CloudWatch dashboards for voice → FHIR pipeline
5. **Optimize**: Tune confidence thresholds based on production data

## Support

For issues or questions:

1. Check CloudWatch logs for both Lambdas
2. Review FHIR validation errors
3. Verify HealthLake datastore status
4. Check DynamoDB VoiceJobs table for job status
