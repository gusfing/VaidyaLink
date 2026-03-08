# Confidence Scoring System

## Overview

The confidence scoring system provides multi-dimensional quality assessment for extracted medical document data. It combines OCR confidence, field extraction completeness, and data validation to determine whether extracted data should be auto-processed or routed to human verification (HITL).

## Architecture

### Components

1. **OCR Confidence**: Raw confidence scores from PaddleOCR text extraction
2. **Extraction Confidence**: Measures completeness of extracted clinical fields
3. **Validation Confidence**: Assesses data quality through format and range validation
4. **Field-Level Scores**: Individual confidence scores for each clinical field

### Confidence Score Structure

```python
{
    "overall": 0.87,              # Weighted overall confidence (0.0-1.0)
    "ocr": 0.90,                  # OCR extraction confidence
    "extraction": 0.85,           # Field completeness confidence
    "validation": 0.88,           # Data validation confidence
    "fieldScores": {              # Per-field confidence scores
        "patient_name": 0.95,
        "medications": 0.85,
        "diagnosis": 0.88,
        "document_date": 0.92
    },
    "criticalFieldsBelowThreshold": [  # Fields requiring review
        "dosages"
    ],
    "calculatedAt": "2024-01-15T10:30:00Z",
    "thresholdUsed": 0.80
}
```

## Scoring Methodology

### Overall Confidence Calculation

The overall confidence is calculated using a two-stage weighted approach:

**Stage 1: Component Score**

```
component_score = (ocr * 0.35) + (extraction * 0.35) + (validation * 0.30)
```

**Stage 2: Field-Weighted Score**

```
field_weighted_score = Σ(field_score * field_weight) / Σ(field_weight)
```

**Final Overall Score**

```
overall = (component_score * 0.70) + (field_weighted_score * 0.30)
```

### Field Weights

Critical fields have higher weights in the overall calculation:

| Field          | Weight | Critical |
| -------------- | ------ | -------- |
| patient_name   | 0.15   | Yes      |
| medications    | 0.25   | Yes      |
| dosages        | 0.15   | Yes      |
| diagnosis      | 0.15   | Yes      |
| document_date  | 0.08   | No       |
| doctor_name    | 0.05   | No       |
| patient_age    | 0.05   | No       |
| patient_gender | 0.03   | No       |
| lab_results    | 0.05   | No       |
| vital_signs    | 0.04   | No       |

### Component Weights

| Component  | Weight | Description                    |
| ---------- | ------ | ------------------------------ |
| OCR        | 0.35   | Raw text extraction confidence |
| Extraction | 0.35   | Field completeness             |
| Validation | 0.30   | Data quality checks            |

## Validation Rules

### Patient Name

- **High confidence (0.95)**: Valid characters (letters, spaces, Indian scripts)
- **Medium confidence (0.70)**: Contains some valid characters
- **Low confidence (0.30)**: Too short (< 2 characters)

### Patient Age

- **High confidence (0.95)**: 0-120 years
- **Medium confidence (0.70)**: 0-150 years
- **Low confidence (0.30)**: Outside valid range

### Gender

- **High confidence (0.98)**: Valid values (male, female, other, m, f, o)
- **Medium confidence (0.50)**: Other values

### Document Date

- **High confidence (0.95)**: Valid format, reasonable date range
- **Medium confidence (0.70)**: Valid format, questionable date
- **Low confidence (0.40)**: Invalid format

### Medications

- **High confidence (0.95)**: Has name AND dosage
- **Medium confidence (0.50)**: Has name OR dosage
- **Low confidence (0.0)**: Missing both

### Lab Results

- **High confidence (0.95)**: Has test name AND value
- **Medium confidence (0.50)**: Has test name OR value
- **Low confidence (0.0)**: Missing both

### Vital Signs

- **High confidence (0.95)**: 4-5 standard vitals present
- **Medium confidence**: 2-3 vitals present
- **Low confidence (0.50)**: Non-standard vitals only

## HITL Routing Logic

Documents are routed to Human-in-the-Loop (HITL) verification when:

1. **Overall confidence < threshold** (default: 0.80)
2. **Any critical field < threshold**

Critical fields:

- patient_name
- medications
- diagnosis
- dosages

## Usage

### Basic Usage

```python
from confidence import create_confidence_scorer

# Initialize scorer
scorer = create_confidence_scorer(confidence_threshold=0.80)

# Calculate confidence
confidence_scores = scorer.calculate_confidence(
    structured_data=extracted_data,
    ocr_results=ocr_results,
    ocr_average_confidence=0.91
)

# Check if HITL needed
if confidence_scores.overall < 0.80:
    route_to_hitl(job_id, confidence_scores)
else:
    proceed_with_fhir_transformation(job_id)
```

### Integration with Lambda Handler

```python
# In process_document function
from confidence import get_confidence_scorer

# After OCR and Bedrock extraction
scorer = get_confidence_scorer()

confidence_scores_obj = scorer.calculate_confidence(
    structured_data=structured_data.to_dict(),
    ocr_results=ocr_results,
    ocr_average_confidence=ocr_confidence
)

confidence_scores = confidence_scores_obj.to_dict()

# Route based on confidence
if should_route_to_hitl(confidence_scores):
    route_to_hitl(job_id, structured_data.to_dict(), confidence_scores)
else:
    save_extracted_data(job_id, structured_data.to_dict(), confidence_scores)
    trigger_fhir_transformation(job_id)
```

## Configuration

### Environment Variables

```bash
# Confidence threshold for auto-processing
CONFIDENCE_THRESHOLD=0.80

# OCR languages (affects confidence calculation)
OCR_LANGUAGES=en,hi

# Bedrock model (affects extraction quality)
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

### Adjusting Thresholds

To adjust the confidence threshold:

```python
# More strict (fewer auto-processed, more HITL)
scorer = create_confidence_scorer(confidence_threshold=0.90)

# More lenient (more auto-processed, fewer HITL)
scorer = create_confidence_scorer(confidence_threshold=0.70)
```

## Performance Considerations

### Computational Cost

- **OCR confidence**: Already calculated by PaddleOCR (no additional cost)
- **Extraction confidence**: O(n) where n = number of fields
- **Validation confidence**: O(n) with regex and format checks
- **Field scores**: O(n) per field

**Total overhead**: ~10-20ms per document

### Optimization Tips

1. **Singleton pattern**: Reuse scorer instance across Lambda invocations
2. **Lazy validation**: Only validate fields that are present
3. **Caching**: Cache validation regex patterns

## Monitoring

### Key Metrics

Track these CloudWatch metrics:

1. **Average overall confidence**: Monitor extraction quality trends
2. **HITL routing rate**: Percentage of documents requiring human review
3. **Critical field confidence**: Track confidence for medications, diagnosis
4. **Validation failure rate**: Fields failing validation checks

### Example CloudWatch Queries

```python
# Log confidence scores
logger.info(f"Confidence scores", extra={
    'overall_confidence': confidence_scores['overall'],
    'ocr_confidence': confidence_scores['ocr'],
    'extraction_confidence': confidence_scores['extraction'],
    'validation_confidence': confidence_scores['validation'],
    'hitl_required': confidence_scores['overall'] < threshold
})
```

## Testing

### Unit Tests

Run the confidence scoring tests:

```bash
cd backend/document-processing
python -m pytest src/__tests__/test_confidence.py -v
```

### Test Coverage

The test suite covers:

- Complete data scenarios (high confidence)
- Minimal data scenarios (low confidence)
- Empty data scenarios (zero confidence)
- Individual validation rules
- Field scoring logic
- Overall confidence calculation
- Error handling

### Example Test Cases

```python
# High confidence scenario
high_quality_data = {
    'patient_name': 'Rajesh Kumar',
    'patient_age': 45,
    'medications': [{'name': 'Aspirin', 'dosage': '100mg'}],
    'diagnosis': ['Hypertension']
}
# Expected: overall > 0.85

# Low confidence scenario
low_quality_data = {
    'patient_name': 'X',  # Too short
    'medications': [{'name': 'Unknown'}]  # Missing dosage
}
# Expected: overall < 0.80, HITL required
```

## Troubleshooting

### Common Issues

**Issue**: All documents routed to HITL

- **Cause**: Threshold too high or OCR quality poor
- **Solution**: Lower threshold or improve image preprocessing

**Issue**: Low extraction confidence despite good OCR

- **Cause**: Bedrock not extracting fields properly
- **Solution**: Review Bedrock prompt, check model version

**Issue**: Validation confidence always low

- **Cause**: Data format doesn't match validation rules
- **Solution**: Update validation rules for your data format

### Debug Mode

Enable detailed logging:

```python
import logging
logging.getLogger('confidence').setLevel(logging.DEBUG)
```

## Future Enhancements

1. **Machine Learning**: Train ML model to predict confidence based on historical HITL corrections
2. **Context-Aware Scoring**: Adjust confidence based on document type (prescription vs lab report)
3. **Temporal Patterns**: Track confidence trends over time per patient
4. **Feedback Loop**: Incorporate HITL corrections to improve scoring accuracy
5. **Multi-Language Support**: Language-specific validation rules

## References

- [PaddleOCR Documentation](https://github.com/PaddlePaddle/PaddleOCR)
- [Amazon Bedrock Best Practices](https://docs.aws.amazon.com/bedrock/)
- [FHIR Data Quality Guidelines](https://www.hl7.org/fhir/quality.html)
