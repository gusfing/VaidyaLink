# Bedrock Integration Quick Start

## Overview

This guide helps you quickly integrate and test the Amazon Bedrock summarization feature in the Clinical Summarizer Lambda.

## Prerequisites

- AWS account with Bedrock access
- Claude 3.5 Sonnet model enabled in your region
- Python 3.11+ installed
- AWS credentials configured

## Setup

### 1. Install Dependencies

```bash
cd backend/clinical-summarizer
pip install -r requirements.txt
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and set:

```bash
# Bedrock Configuration
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_REGION=us-east-1
BEDROCK_MAX_TOKENS=1024
BEDROCK_TEMPERATURE=0.0

# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCOUNT_ID=your-account-id

# HealthLake Configuration
HEALTHLAKE_DATASTORE_ID=your-datastore-id
HEALTHLAKE_ENDPOINT=https://healthlake.ap-south-1.amazonaws.com
```

### 3. Set IAM Permissions

Ensure your Lambda execution role has:

```json
{
  "Effect": "Allow",
  "Action": ["bedrock:InvokeModel"],
  "Resource": [
    "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
  ]
}
```

## Usage

### Basic Example

```python
from utils.bedrock_summarizer import create_bedrock_summarizer

# Sample aggregated data
aggregated_data = {
    'patient': {
        'name': 'John Doe',
        'age': 45,
        'gender': 'male'
    },
    'criticalInformation': {
        'chronicConditions': [
            {
                'display': 'Type 2 Diabetes Mellitus',
                'onsetDate': '2020-01-15',
                'severity': 'moderate'
            }
        ],
        'currentMedications': [
            {
                'display': 'Metformin 500mg',
                'dosage': 'One tablet twice daily',
                'startDate': '2020-01-20'
            }
        ],
        'criticalAllergies': [],
        'abnormalLabResults': [],
        'recentDiagnoses': []
    },
    'conditions': [],
    'medications': [],
    'allergies': [],
    'encounters': [],
    'observations': []
}

# Create summarizer
summarizer = create_bedrock_summarizer()

# Generate summary
summary_text, confidence_scores = summarizer.generate_summary(
    patient_id='patient-123',
    aggregated_data=aggregated_data,
    options={'maxWords': 200}
)

# Print results
print("Summary:")
print(summary_text)
print("\nConfidence Scores:")
for category, score in confidence_scores.items():
    print(f"  {category}: {score:.2%}")
```

### Lambda Handler Example

```python
import json
from index import lambda_handler

# Test event
event = {
    'patientId': 'patient-123',
    'options': {
        'maxWords': 200,
        'includeLabResults': True,
        'includeVitalSigns': True,
        'outputFormat': 'json'
    }
}

# Mock context
class Context:
    request_id = 'test-request-123'
    function_name = 'clinical-summarizer-test'

# Invoke handler
response = lambda_handler(event, Context())

# Print response
print(json.dumps(response, indent=2))
```

## Testing

### Run Unit Tests

```bash
# Test Bedrock summarizer
pytest src/__tests__/test_bedrock_summarizer.py -v

# Test handler integration
pytest src/__tests__/test_handler.py -v

# Run all tests
pytest src/__tests__/ -v
```

### Test with Mock Data

```bash
# Run the Lambda locally with test data
python src/index.py
```

## Expected Output

### Summary Format

```markdown
## Chronic Conditions

- Type 2 Diabetes Mellitus (confidence: 95%)

## Current Medications

- Metformin 500mg - One tablet twice daily (confidence: 98%)

## Allergies

- None

## Recent Visits

- None

## Abnormal Lab Results

- None

## Recent Diagnoses

- None

## Flags for Review

- None

## Overall Confidence Score

96%
```

### Confidence Scores

```json
{
  "overall": 0.96,
  "chronicConditions": 0.95,
  "medications": 0.98,
  "allergies": 1.0,
  "recentVisits": 0.0,
  "labResults": 0.0,
  "recentDiagnoses": 0.0
}
```

## Common Issues

### Issue: "Model not found"

**Error**: `ValidationException: Model ID not found`

**Solution**:

1. Verify model ID is correct
2. Check Bedrock is enabled in your region
3. Ensure you have access to Claude 3.5 Sonnet

### Issue: "Access denied"

**Error**: `AccessDeniedException`

**Solution**:

1. Check IAM permissions
2. Verify Bedrock policy is attached to execution role
3. Ensure model ARN is correct

### Issue: "Empty summary"

**Error**: Summary text is empty

**Solution**:

1. Check aggregated data has content
2. Verify prompt is being built correctly
3. Increase max_tokens if needed

## Next Steps

1. **Customize Prompts**: Edit `_build_prompt()` in `bedrock_summarizer.py`
2. **Add Caching**: Implement summary caching (Task 11.8)
3. **Enhance Confidence**: Improve confidence score extraction (Task 11.6)
4. **Format Output**: Add multiple output formats (Task 11.7)

## Resources

- [Full Documentation](./BEDROCK_INTEGRATION.md)
- [API Reference](./README.md)
- [Design Document](../../.kiro/specs/vaidyalink/design.md)

## Support

For help:

- Check CloudWatch Logs: `/aws/lambda/vaidyalink-clinical-summarizer-prod`
- Review test cases: `src/__tests__/test_bedrock_summarizer.py`
- Contact: VaidyaLink development team
