# Confidence Scoring Quick Start

## Overview

The confidence scoring system automatically assesses the quality of extracted medical data and determines whether documents need human verification.

## 5-Minute Setup

### 1. Import the Module

```python
from confidence import create_confidence_scorer
```

### 2. Initialize Scorer

```python
# Use default threshold (0.80)
scorer = create_confidence_scorer()

# Or customize threshold
scorer = create_confidence_scorer(confidence_threshold=0.85)
```

### 3. Calculate Confidence

```python
confidence_scores = scorer.calculate_confidence(
    structured_data=extracted_clinical_data,
    ocr_results=ocr_results_list,
    ocr_average_confidence=0.91
)
```

### 4. Check Results

```python
# Get overall confidence
print(f"Overall confidence: {confidence_scores.overall}")

# Check if HITL needed
if confidence_scores.overall < 0.80:
    print("Route to HITL for human verification")
    print(f"Critical fields below threshold: {confidence_scores.critical_fields_below_threshold}")
else:
    print("Auto-process document")

# View field-level scores
for field, score in confidence_scores.field_scores.items():
    print(f"{field}: {score:.2f}")
```

## Complete Example

```python
from confidence import create_confidence_scorer
from ocr import create_ocr_extractor
from bedrock import create_clinical_structurer

# Initialize components
ocr_extractor = create_ocr_extractor(languages=['en', 'hi'])
structurer = create_clinical_structurer()
scorer = create_confidence_scorer(confidence_threshold=0.80)

# Process document
def process_medical_document(image_data):
    # Step 1: OCR extraction
    ocr_results = ocr_extractor.extract_text(image_data)
    ocr_confidence = ocr_extractor.get_average_confidence(ocr_results)
    full_text = ocr_extractor.get_full_text(ocr_results)

    # Step 2: Clinical structuring
    structured_data = structurer.structure_clinical_data(full_text)

    # Step 3: Confidence scoring
    confidence_scores = scorer.calculate_confidence(
        structured_data=structured_data.to_dict(),
        ocr_results=ocr_results,
        ocr_average_confidence=ocr_confidence
    )

    # Step 4: Decision
    if confidence_scores.overall >= 0.80:
        return {
            'status': 'auto_processed',
            'data': structured_data.to_dict(),
            'confidence': confidence_scores.to_dict()
        }
    else:
        return {
            'status': 'hitl_required',
            'data': structured_data.to_dict(),
            'confidence': confidence_scores.to_dict(),
            'reason': f"Low confidence: {confidence_scores.overall:.2f}"
        }
```

## Understanding Confidence Scores

### Overall Score Components

```python
{
    "overall": 0.87,        # Main decision metric
    "ocr": 0.90,           # Text extraction quality
    "extraction": 0.85,    # Field completeness
    "validation": 0.88     # Data quality
}
```

### Field-Level Scores

```python
{
    "patient_name": 0.95,   # High confidence
    "medications": 0.85,    # Good confidence
    "diagnosis": 0.72,      # Below threshold - needs review
    "document_date": 0.92
}
```

### Critical Fields

These fields must meet the threshold:

- `patient_name`
- `medications`
- `diagnosis`
- `dosages`

If any critical field is below threshold, the document goes to HITL.

## Common Scenarios

### Scenario 1: High Quality Document

```python
# Input: Clear printed prescription
ocr_confidence = 0.95
structured_data = {
    'patient_name': 'Rajesh Kumar',
    'patient_age': 45,
    'medications': [{'name': 'Aspirin', 'dosage': '100mg'}],
    'diagnosis': ['Hypertension']
}

# Result
confidence_scores.overall = 0.91  # ✓ Auto-process
```

### Scenario 2: Handwritten Document

```python
# Input: Handwritten prescription with unclear text
ocr_confidence = 0.72
structured_data = {
    'patient_name': 'R Kumar',  # Partial name
    'medications': [{'name': 'Aspirin'}],  # Missing dosage
}

# Result
confidence_scores.overall = 0.68  # ✗ Route to HITL
critical_fields_below = ['medications', 'diagnosis']
```

### Scenario 3: Incomplete Document

```python
# Input: Document with missing information
ocr_confidence = 0.88
structured_data = {
    'patient_name': 'John Doe',
    'document_date': '2024-01-15'
    # Missing medications, diagnosis
}

# Result
confidence_scores.overall = 0.45  # ✗ Route to HITL
critical_fields_below = ['medications', 'diagnosis']
```

## Adjusting Thresholds

### For Higher Accuracy (More HITL)

```python
# 90% threshold - only very confident documents auto-process
scorer = create_confidence_scorer(confidence_threshold=0.90)
```

**Use when:**

- Critical medical decisions depend on data
- High accuracy is more important than speed
- HITL resources are available

### For Higher Throughput (Less HITL)

```python
# 70% threshold - more documents auto-process
scorer = create_confidence_scorer(confidence_threshold=0.70)
```

**Use when:**

- Speed is important
- Data will be reviewed by clinicians anyway
- HITL resources are limited

### Recommended Thresholds by Document Type

| Document Type       | Threshold | Reasoning                         |
| ------------------- | --------- | --------------------------------- |
| Prescriptions       | 0.85      | Critical medication info          |
| Lab Reports         | 0.80      | Numeric data easier to validate   |
| Consultation Notes  | 0.75      | Less structured, more narrative   |
| Discharge Summaries | 0.80      | Important but reviewed by doctors |

## Integration with Lambda

```python
# In your Lambda handler
from confidence import get_confidence_scorer

def handler(event, context):
    # ... OCR and structuring code ...

    # Get scorer (singleton for Lambda reuse)
    scorer = get_confidence_scorer()

    # Calculate confidence
    confidence_scores = scorer.calculate_confidence(
        structured_data=structured_data.to_dict(),
        ocr_results=ocr_results,
        ocr_average_confidence=ocr_confidence
    )

    # Route based on confidence
    if confidence_scores.overall < CONFIDENCE_THRESHOLD:
        route_to_hitl(job_id, structured_data, confidence_scores)
        status = 'hitl_required'
    else:
        save_extracted_data(job_id, structured_data, confidence_scores)
        trigger_fhir_transformation(job_id)
        status = 'completed'

    return {
        'statusCode': 200,
        'body': json.dumps({
            'jobId': job_id,
            'status': status,
            'confidence': confidence_scores.to_dict()
        })
    }
```

## Testing

### Run Unit Tests

```bash
cd backend/document-processing
python -m pytest src/__tests__/test_confidence.py -v
```

### Test with Sample Data

```python
# Create test data
test_data = {
    'patient_name': 'Test Patient',
    'patient_age': 30,
    'medications': [{'name': 'Test Med', 'dosage': '10mg'}]
}

test_ocr_results = [
    Mock(text='Test', confidence=0.90),
    Mock(text='Patient', confidence=0.92)
]

# Calculate confidence
scorer = create_confidence_scorer()
scores = scorer.calculate_confidence(
    structured_data=test_data,
    ocr_results=test_ocr_results,
    ocr_average_confidence=0.91
)

print(f"Overall: {scores.overall}")
print(f"Field scores: {scores.field_scores}")
```

## Monitoring

### Log Confidence Metrics

```python
import logging

logger.info(
    "Confidence calculated",
    extra={
        'job_id': job_id,
        'overall_confidence': confidence_scores.overall,
        'ocr_confidence': confidence_scores.ocr,
        'hitl_required': confidence_scores.overall < threshold,
        'critical_fields_below': len(confidence_scores.critical_fields_below_threshold)
    }
)
```

### CloudWatch Metrics

```python
import boto3

cloudwatch = boto3.client('cloudwatch')

# Publish confidence metric
cloudwatch.put_metric_data(
    Namespace='VaidyaLink/DocumentProcessing',
    MetricData=[
        {
            'MetricName': 'OverallConfidence',
            'Value': confidence_scores.overall,
            'Unit': 'None'
        },
        {
            'MetricName': 'HITLRoutingRate',
            'Value': 1 if confidence_scores.overall < threshold else 0,
            'Unit': 'Count'
        }
    ]
)
```

## Troubleshooting

### Issue: All documents going to HITL

**Check:**

1. OCR confidence - is it consistently low?
2. Threshold setting - is it too high?
3. Validation rules - are they too strict?

**Solution:**

```python
# Debug individual components
print(f"OCR: {confidence_scores.ocr}")
print(f"Extraction: {confidence_scores.extraction}")
print(f"Validation: {confidence_scores.validation}")

# Identify bottleneck and adjust
```

### Issue: Low confidence despite good OCR

**Check:**

1. Field extraction - is Bedrock extracting fields?
2. Validation rules - do they match your data format?

**Solution:**

```python
# Check field scores
for field, score in confidence_scores.field_scores.items():
    if score < 0.80:
        print(f"Low confidence field: {field} = {score}")
```

## Next Steps

1. **Read full documentation**: [CONFIDENCE_SCORING.md](./CONFIDENCE_SCORING.md)
2. **Review validation rules**: Customize for your data format
3. **Set up monitoring**: Track confidence metrics in CloudWatch
4. **Tune thresholds**: Adjust based on HITL feedback

## Support

For issues or questions:

1. Check logs for detailed confidence breakdown
2. Review test cases in `src/__tests__/test_confidence.py`
3. Consult full documentation in `CONFIDENCE_SCORING.md`
