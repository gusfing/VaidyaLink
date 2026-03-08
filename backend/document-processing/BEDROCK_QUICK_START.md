# Amazon Bedrock Integration - Quick Start Guide

Get started with clinical data structuring using Amazon Bedrock in under 5 minutes.

## Prerequisites

- AWS account with Bedrock access
- Python 3.11+
- boto3 installed
- Bedrock model access enabled (Claude 3.5 Sonnet)

## Step 1: Enable Bedrock Model Access

1. Go to AWS Console → Amazon Bedrock
2. Navigate to "Model access"
3. Request access to "Anthropic Claude 3.5 Sonnet"
4. Wait for approval (usually instant)

## Step 2: Set Up IAM Permissions

Add to your Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
    }
  ]
}
```

## Step 3: Install Dependencies

```bash
pip install boto3>=1.34.0
```

## Step 4: Basic Usage

```python
from bedrock import create_clinical_structurer

# Create structurer
structurer = create_clinical_structurer()

# Extract structured data
text = """
Patient: Rajesh Kumar
Age: 55 years
Date: 15/01/2024

Diagnosis: Type 2 Diabetes Mellitus

Rx:
1. Tab Metformin 500mg - 1 tablet twice daily after meals
2. Tab Glimepiride 2mg - 1 tablet once daily before breakfast

Follow-up: After 1 month
"""

result = structurer.structure_clinical_data(text)

# Access structured fields
print(f"Patient: {result.patient_name}")
print(f"Age: {result.patient_age}")
print(f"Diagnosis: {result.diagnosis}")
print(f"Medications: {len(result.medications)}")

# Convert to dictionary for storage
data_dict = result.to_dict()
```

## Step 5: Integration with Lambda

```python
import os
from bedrock import create_clinical_structurer

# Global variable for Lambda container reuse
clinical_structurer = None

def get_structurer():
    global clinical_structurer
    if clinical_structurer is None:
        clinical_structurer = create_clinical_structurer()
    return clinical_structurer

def handler(event, context):
    # Get OCR text from event
    ocr_text = event['extractedText']

    # Structure clinical data
    structurer = get_structurer()
    structured_data = structurer.structure_clinical_data(ocr_text)

    # Return structured data
    return {
        'statusCode': 200,
        'body': structured_data.to_dict()
    }
```

## Step 6: Environment Variables

Set these in your Lambda configuration:

```bash
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
AWS_REGION=us-east-1
LOG_LEVEL=INFO
```

## Step 7: Test Locally

```python
# test_bedrock_local.py
from bedrock import create_clinical_structurer

def test_prescription():
    structurer = create_clinical_structurer()

    text = """
    Dr. Amit Patel
    Date: 20/01/2024

    Patient: Priya Sharma, Age: 28
    Diagnosis: Upper Respiratory Tract Infection

    Rx:
    1. Tab Azithromycin 500mg OD x 3 days
    2. Tab Paracetamol 650mg TDS x 5 days
    """

    result = structurer.structure_clinical_data(text)

    assert result.patient_name == "Priya Sharma"
    assert result.patient_age == 28
    assert len(result.medications) == 2

    print("✓ Test passed!")
    print(f"Extracted: {result.patient_name}, {result.patient_age} years")
    print(f"Medications: {[m['name'] for m in result.medications]}")

if __name__ == "__main__":
    test_prescription()
```

Run the test:

```bash
python test_bedrock_local.py
```

## Common Use Cases

### 1. Prescription Processing

```python
prescription_text = """
Dr. Sarah Johnson
Date: 15/03/2024

Patient: Michael Chen, Age: 42
Diagnosis: Hypertension

Rx:
1. Tab Amlodipine 5mg - Once daily
2. Tab Atorvastatin 10mg - Once daily at bedtime
"""

result = structurer.structure_clinical_data(prescription_text)
print(f"Medications: {result.medications}")
```

### 2. Lab Report Processing

```python
lab_report_text = """
Lab Report
Patient: Sarah Williams, Age: 35
Date: 10/03/2024

Test Results:
- HbA1c: 6.8% (Ref: 4.0-5.6%)
- Fasting Blood Sugar: 125 mg/dL (Ref: 70-100 mg/dL)
- Total Cholesterol: 220 mg/dL (Ref: <200 mg/dL)
"""

result = structurer.structure_clinical_data(lab_report_text)
print(f"Lab Results: {result.lab_results}")
```

### 3. Multilingual Documents

```python
hindi_text = """
मरीज का नाम: राजेश कुमार
उम्र: 45 साल

निदान: उच्च रक्तचाप

दवाइयाँ:
1. एम्लोडिपिन 5mg - दिन में एक बार
"""

result = structurer.structure_clinical_data(hindi_text)
print(f"Patient: {result.patient_name}")
```

## Troubleshooting

### Issue: "Access Denied" Error

**Solution**: Enable Bedrock model access in AWS Console

```bash
aws bedrock list-foundation-models --region us-east-1
```

### Issue: High Latency

**Solution**: Use Lambda provisioned concurrency or increase memory

```python
# Increase Lambda memory to 1024MB or higher
# This also increases CPU allocation
```

### Issue: JSON Parse Error

**Solution**: Check Bedrock response in logs

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Performance Tips

1. **Reuse Structurer**: Use singleton pattern in Lambda
2. **Optimize Memory**: Allocate 1024MB+ for faster execution
3. **Monitor Costs**: Track Bedrock API usage in CloudWatch
4. **Cache Results**: Store structured data in S3 to avoid re-processing

## Cost Estimation

Claude 3.5 Sonnet pricing (as of 2024):

- Input: $3 per million tokens
- Output: $15 per million tokens

Typical document:

- Input: ~500 tokens (OCR text)
- Output: ~300 tokens (structured JSON)
- Cost per document: ~$0.005 (half a cent)

For 1000 documents/day:

- Daily cost: ~$5
- Monthly cost: ~$150

## Next Steps

1. Read [BEDROCK_INTEGRATION.md](./BEDROCK_INTEGRATION.md) for detailed documentation
2. Review [design.md](../../.kiro/specs/vaidyalink/design.md) for architecture
3. Check [requirements.md](../../.kiro/specs/vaidyalink/requirements.md) for specifications
4. Run unit tests: `pytest src/__tests__/test_bedrock.py`

## Support

For issues or questions:

1. Check CloudWatch Logs for error details
2. Review Bedrock API documentation
3. Verify IAM permissions
4. Test with simple examples first

## Example Output

Input:

```
Patient: John Doe, Age: 45
Diagnosis: Hypertension
Rx: Lisinopril 10mg once daily
```

Output:

```json
{
  "patient_name": "John Doe",
  "patient_age": 45,
  "document_type": "prescription",
  "diagnosis": ["Hypertension"],
  "medications": [
    {
      "name": "Lisinopril",
      "dosage": "10mg",
      "frequency": "once daily",
      "route": "oral"
    }
  ],
  "extracted_text": "Patient: John Doe, Age: 45...",
  "extraction_timestamp": "2024-01-15T10:30:00Z"
}
```

## Resources

- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Claude 3.5 Sonnet Model Card](https://www.anthropic.com/claude)
- [VaidyaLink Project Documentation](../../docs/)
