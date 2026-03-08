# Amazon Bedrock Integration for Clinical Data Structuring

This document describes the Amazon Bedrock integration for structuring OCR-extracted text into clinical fields.

## Overview

The Bedrock integration uses Claude 3.5 Sonnet to transform unstructured medical document text into structured clinical data. This enables downstream processing, FHIR transformation, and clinical decision support.

## Architecture

```
OCR Text → Bedrock Structurer → StructuredClinicalData → FHIR Transformer
```

### Components

1. **ClinicalStructurer**: Main class for Bedrock integration
2. **StructuredClinicalData**: Dataclass representing structured clinical fields
3. **Factory Function**: `create_clinical_structurer()` for easy instantiation

## Usage

### Basic Usage

```python
from bedrock import create_clinical_structurer

# Create structurer instance
structurer = create_clinical_structurer()

# Structure clinical data
extracted_text = """
Patient: John Doe, Age: 45
Diagnosis: Hypertension
Rx: Lisinopril 10mg once daily
"""

structured_data = structurer.structure_clinical_data(extracted_text)

print(structured_data.patient_name)  # "John Doe"
print(structured_data.patient_age)   # 45
print(structured_data.diagnosis)     # ["Hypertension"]
print(structured_data.medications)   # [{"name": "Lisinopril", ...}]
```

### With Document Context

```python
# Provide additional context for better structuring
context = {
    'language': 'hi',
    'documentType': 'prescription',
    'ocrConfidence': 0.92
}

structured_data = structurer.structure_clinical_data(
    extracted_text=text,
    document_context=context
)
```

### Integration in Lambda Handler

```python
from bedrock import create_clinical_structurer

# Initialize once (Lambda container reuse)
clinical_structurer = None

def get_clinical_structurer():
    global clinical_structurer
    if clinical_structurer is None:
        clinical_structurer = create_clinical_structurer()
    return clinical_structurer

def handler(event, context):
    # Extract text with OCR
    ocr_text = extract_text_from_image(...)

    # Structure clinical data
    structurer = get_clinical_structurer()
    structured_data = structurer.structure_clinical_data(ocr_text)

    # Use structured data
    save_to_database(structured_data.to_dict())
```

## Structured Data Fields

### Patient Information

- `patient_name`: Full name
- `patient_age`: Age in years
- `patient_gender`: male/female/other
- `patient_id`: Medical record number or ID

### Document Metadata

- `document_date`: Date of document (YYYY-MM-DD)
- `document_type`: prescription/lab_report/discharge_summary/consultation/other
- `doctor_name`: Prescribing/attending physician
- `facility_name`: Healthcare facility name

### Clinical Information

- `chief_complaint`: Primary complaint or reason for visit
- `diagnosis`: List of diagnoses
- `medications`: List of medication objects with name, dosage, frequency, duration, route
- `lab_results`: List of lab test results with name, value, unit, reference range, status
- `vital_signs`: Dictionary with BP, pulse, temperature, respiratory rate, SpO2
- `allergies`: List of known allergies
- `medical_history`: List of past medical conditions

### Additional Fields

- `notes`: Additional clinical notes
- `follow_up_date`: Next appointment date
- `extracted_text`: Original OCR text
- `extraction_timestamp`: ISO 8601 timestamp

## Configuration

### Environment Variables

```bash
# Bedrock model ID (default: Claude 3.5 Sonnet)
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# AWS region for Bedrock
AWS_REGION=us-east-1

# Logging level
LOG_LEVEL=INFO
```

### Model Parameters

```python
structurer = ClinicalStructurer(
    model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
    region="us-east-1",
    max_tokens=4096,      # Maximum response tokens
    temperature=0.0       # Deterministic output
)
```

## Prompt Engineering

The structurer uses a carefully crafted prompt that:

1. Provides clear instructions for extraction
2. Handles multilingual content (English + Indian languages)
3. Preserves original spelling for Indian drug names
4. Formats dates consistently (YYYY-MM-DD)
5. Structures medications with complete details
6. Extracts lab results with reference ranges
7. Returns pure JSON for reliable parsing

### Prompt Structure

```
System Context: Medical AI assistant
Task: Extract structured clinical data
Input: OCR-extracted text + optional context
Output Format: JSON schema with all clinical fields
Instructions: Specific extraction rules
```

## Error Handling

The structurer implements robust error handling:

1. **Bedrock API Errors**: Logged and re-raised
2. **JSON Parse Errors**: Returns minimal structured data with original text
3. **Missing Fields**: Uses `None` or empty lists/dicts
4. **Markdown Code Blocks**: Automatically stripped from response

### Fallback Behavior

If structuring fails, the system returns:

```python
StructuredClinicalData(
    extracted_text=original_text,
    extraction_timestamp=datetime.utcnow().isoformat(),
    notes="Error message"
)
```

This ensures the pipeline continues even if Bedrock fails.

## Performance Considerations

### Lambda Container Reuse

Use singleton pattern to reuse Bedrock client:

```python
clinical_structurer = None

def get_clinical_structurer():
    global clinical_structurer
    if clinical_structurer is None:
        clinical_structurer = create_clinical_structurer()
    return clinical_structurer
```

### Cold Start Optimization

- Bedrock client initialization: ~100ms
- First API call: ~2-5 seconds
- Subsequent calls: ~1-3 seconds

### Cost Optimization

- Use temperature=0.0 for deterministic output (no retries needed)
- Set appropriate max_tokens (4096 is sufficient for most documents)
- Cache structured results in S3 to avoid re-processing

## Testing

### Unit Tests

```bash
cd backend/document-processing
pytest src/__tests__/test_bedrock.py -v
```

### Test Coverage

- StructuredClinicalData initialization and conversion
- Prompt building with and without context
- Bedrock invocation success and error cases
- JSON parsing with various formats
- End-to-end structuring scenarios
- Integration with realistic medical documents

### Mock Bedrock Responses

```python
from unittest.mock import MagicMock, patch

@patch('boto3.client')
def test_structuring(mock_client):
    mock_runtime = MagicMock()
    mock_client.return_value = mock_runtime

    # Mock Bedrock response
    mock_response = {
        'body': MagicMock()
    }
    response_body = {
        'content': [{'text': '{"patient_name": "Test"}'}]
    }
    mock_response['body'].read.return_value = json.dumps(response_body).encode()
    mock_runtime.invoke_model.return_value = mock_response

    # Test structuring
    structurer = ClinicalStructurer()
    result = structurer.structure_clinical_data("Patient: Test")

    assert result.patient_name == "Test"
```

## IAM Permissions

The Lambda execution role needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": ["arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"]
    }
  ]
}
```

## Monitoring

### CloudWatch Metrics

Track these custom metrics:

- `BedrockInvocationCount`: Number of Bedrock API calls
- `BedrockInvocationLatency`: API call duration
- `BedrockInvocationErrors`: Failed API calls
- `StructuringSuccessRate`: Successful structuring percentage

### Logging

The structurer logs:

- Initialization with model ID
- Structuring start/completion
- Bedrock API errors
- JSON parsing errors
- Fallback activations

### Example Logs

```
INFO: Initialized ClinicalStructurer with model: anthropic.claude-3-5-sonnet-20241022-v2:0
INFO: Structuring clinical data with Bedrock
INFO: Clinical data structured successfully
```

## Troubleshooting

### Issue: Bedrock API Throttling

**Symptom**: `ThrottlingException` errors

**Solution**:

- Implement exponential backoff
- Request quota increase
- Use reserved capacity for high volume

### Issue: JSON Parse Errors

**Symptom**: Structured data returns with notes about parse failure

**Solution**:

- Check Bedrock response format
- Verify prompt instructions
- Review model output in logs

### Issue: Missing Fields

**Symptom**: Expected fields are `None` or empty

**Solution**:

- Improve OCR quality
- Enhance prompt with examples
- Add field-specific extraction rules

### Issue: High Latency

**Symptom**: Structuring takes >5 seconds

**Solution**:

- Reduce max_tokens if possible
- Use Lambda provisioned concurrency
- Consider caching for repeated documents

## Best Practices

1. **Singleton Pattern**: Reuse structurer instance across Lambda invocations
2. **Error Handling**: Always handle Bedrock failures gracefully
3. **Logging**: Log all structuring attempts for debugging
4. **Validation**: Validate structured data before FHIR transformation
5. **Monitoring**: Track success rates and latencies
6. **Cost Control**: Set appropriate max_tokens and monitor usage
7. **Testing**: Test with diverse medical document types
8. **Prompt Tuning**: Continuously improve prompt based on results

## Future Enhancements

1. **Few-Shot Learning**: Add examples to prompt for better accuracy
2. **Field Validation**: Validate extracted values against medical databases
3. **Confidence Scoring**: Add per-field confidence scores from Bedrock
4. **Multi-Model Support**: Support other Bedrock models
5. **Streaming**: Use streaming API for faster time-to-first-token
6. **Caching**: Cache common extractions to reduce costs
7. **Fine-Tuning**: Fine-tune model on Indian medical documents

## References

- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Claude 3.5 Sonnet Model Card](https://www.anthropic.com/claude)
- [HL7 FHIR Specification](https://www.hl7.org/fhir/)
- [VaidyaLink Design Document](../../.kiro/specs/vaidyalink/design.md)
