# Clinical Summarizer Lambda - Quick Start Guide

Get started with the Clinical Summarizer Lambda in 5 minutes.

## Prerequisites

- Python 3.11 installed
- AWS CLI configured
- Access to AWS HealthLake datastore
- Access to Amazon Bedrock (Claude 3.5 Sonnet)

## Quick Setup

### 1. Install Dependencies

```bash
cd backend/clinical-summarizer
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set required variables:

```bash
# Required
HEALTHLAKE_DATASTORE_ID=your-datastore-id
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Optional (defaults provided)
AWS_REGION=ap-south-1
BEDROCK_REGION=us-east-1
MAX_SUMMARY_WORDS=200
```

### 3. Run Tests

```bash
pytest
```

Expected output:

```
============================= test session starts ==============================
collected 15 items

src/__tests__/test_handler.py::TestLambdaHandler::test_handler_missing_patient_id PASSED
src/__tests__/test_handler.py::TestLambdaHandler::test_handler_with_valid_patient_id PASSED
...
============================== 15 passed in 2.34s ===============================
```

### 4. Test Locally

Create a test event file `test-event.json`:

```json
{
  "patientId": "patient-123",
  "options": {
    "maxWords": 200,
    "includeLabResults": true,
    "includeVitalSigns": true,
    "outputFormat": "json"
  }
}
```

Run the handler:

```bash
python src/index.py
```

### 5. Deploy with Docker (Optional)

```bash
# Build image
docker build -f Dockerfile.dev -t clinical-summarizer:dev .

# Run container
docker run -p 9000:8080 \
  --env-file .env \
  clinical-summarizer:dev

# Test the Lambda
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d @test-event.json
```

## Usage Examples

### Basic Summary Request

```python
import boto3
import json

lambda_client = boto3.client('lambda')

response = lambda_client.invoke(
    FunctionName='vaidyalink-clinical-summarizer-prod',
    InvocationType='RequestResponse',
    Payload=json.dumps({
        'patientId': 'patient-123',
        'options': {
            'maxWords': 200
        }
    })
)

result = json.loads(response['Payload'].read())
print(result['body']['summary'])
```

### Custom Options

```python
response = lambda_client.invoke(
    FunctionName='vaidyalink-clinical-summarizer-prod',
    InvocationType='RequestResponse',
    Payload=json.dumps({
        'patientId': 'patient-456',
        'options': {
            'maxWords': 150,
            'includeLabResults': True,
            'includeVitalSigns': True,
            'includeDiagnosticReports': False,
            'maxRecordAgeDays': 365,
            'outputFormat': 'markdown'
        }
    })
)
```

### With Caching

```python
# First request - generates summary
response1 = lambda_client.invoke(
    FunctionName='vaidyalink-clinical-summarizer-prod',
    Payload=json.dumps({'patientId': 'patient-789'})
)
result1 = json.loads(response1['Payload'].read())
print(f"Cached: {result1['body']['cached']}")  # False
print(f"Processing time: {result1['body']['summary']['metadata']['processingTimeMs']}ms")

# Second request - returns cached summary
response2 = lambda_client.invoke(
    FunctionName='vaidyalink-clinical-summarizer-prod',
    Payload=json.dumps({'patientId': 'patient-789'})
)
result2 = json.loads(response2['Payload'].read())
print(f"Cached: {result2['body']['cached']}")  # True
print(f"Processing time: much faster!")
```

## Expected Output

### JSON Format (Default)

```json
{
  "patientId": "patient-123",
  "summary": "## Chronic Conditions\n- Type 2 Diabetes Mellitus (confidence: 95%)\n- Hypertension (confidence: 92%)\n\n## Current Medications\n- Metformin 500mg twice daily (confidence: 98%)\n- Lisinopril 10mg once daily (confidence: 96%)\n\n## Recent Visits\n- 2024-01-10: Routine diabetes follow-up (confidence: 94%)\n- 2023-12-15: Blood pressure check (confidence: 91%)\n\n## Flags\n- Monitor blood glucose levels closely\n- Consider medication adjustment if HbA1c remains elevated",
  "confidenceScores": {
    "overall": 0.94,
    "chronicConditions": 0.95,
    "medications": 0.97,
    "recentVisits": 0.92
  },
  "metadata": {
    "resourceCount": 45,
    "generatedAt": "2024-01-15T10:30:00Z",
    "processingTimeMs": 2500,
    "modelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "outputFormat": "json"
  }
}
```

## Common Issues

### Issue: "HealthLake datastore not found"

**Solution**: Verify your `HEALTHLAKE_DATASTORE_ID` is correct:

```bash
aws healthlake list-fhir-datastores --region ap-south-1
```

### Issue: "Bedrock model not accessible"

**Solution**: Ensure you have access to Claude 3.5 Sonnet:

```bash
aws bedrock list-foundation-models --region us-east-1 \
  --query 'modelSummaries[?contains(modelId, `claude-3-5-sonnet`)]'
```

### Issue: "No FHIR resources found"

**Solution**: This is expected if the patient has no records yet. The Lambda will return:

```json
{
  "summary": "No clinical data available for this patient.",
  "metadata": {
    "resourceCount": 0
  }
}
```

## Next Steps

1. **Implement HealthLake Query** (Task 11.2)
   - Add FHIR resource querying logic
   - Implement filtering and pagination

2. **Add Data Aggregation** (Task 11.3)
   - Chronological ordering
   - Data deduplication
   - Priority scoring

3. **Integrate Bedrock** (Task 11.4)
   - Connect to Claude 3.5 Sonnet
   - Implement prompt engineering
   - Add response parsing

4. **Add Confidence Scoring** (Task 11.6)
   - Calculate fact-level confidence
   - Implement scoring algorithms
   - Add validation rules

5. **Implement Caching** (Task 11.8)
   - DynamoDB cache layer
   - Cache invalidation logic
   - TTL management

## Resources

- [AWS HealthLake Documentation](https://docs.aws.amazon.com/healthlake/)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [VaidyaLink Architecture](../../docs/)

## Support

For questions or issues:

1. Check the [README.md](./README.md) for detailed documentation
2. Review the [Design Document](../../.kiro/specs/vaidyalink/design.md)
3. Consult the [Requirements Document](../../.kiro/specs/vaidyalink/requirements.md)
