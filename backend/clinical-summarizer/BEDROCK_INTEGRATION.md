# Amazon Bedrock Integration for Clinical Summarization

## Overview

This document describes the Amazon Bedrock integration for generating clinical summaries in the VaidyaLink Clinical Summarizer Lambda. The integration uses Claude 3.5 Sonnet to transform aggregated FHIR resources into concise, structured clinical summaries.

## Implementation

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Lambda Handler (index.py)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Query HealthLake for FHIR resources                │  │
│  │ 2. Aggregate clinical data (data_aggregator.py)       │  │
│  │ 3. Generate summary (bedrock_summarizer.py)           │  │
│  │ 4. Extract confidence scores                          │  │
│  │ 5. Format and return summary                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              BedrockSummarizer (bedrock_summarizer.py)       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • Build prompt from aggregated data                   │  │
│  │ • Invoke Bedrock Runtime API                          │  │
│  │ • Parse response and extract confidence scores        │  │
│  │ • Handle errors and retries                           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Amazon Bedrock                            │
│              Claude 3.5 Sonnet Model                         │
│  anthropic.claude-3-5-sonnet-20241022-v2:0                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. BedrockSummarizer Class

Located in `src/utils/bedrock_summarizer.py`, this class encapsulates all Bedrock interaction logic.

**Key Methods:**

- `generate_summary()`: Main entry point for summary generation
- `_build_prompt()`: Constructs the prompt from aggregated clinical data
- `_invoke_bedrock()`: Calls the Bedrock Runtime API
- `_parse_response()`: Extracts summary text and confidence scores
- `_extract_confidence_scores()`: Parses confidence scores from the summary

**Configuration:**

```python
summarizer = BedrockSummarizer(
    model_id='anthropic.claude-3-5-sonnet-20241022-v2:0',
    region='us-east-1',
    max_tokens=1024,
    temperature=0.0,  # Deterministic output
    top_p=0.9
)
```

#### 2. Prompt Engineering

The prompt is carefully structured to generate medical summaries that meet clinical requirements:

**Prompt Structure:**

```
You are a medical AI assistant generating a concise clinical summary for a healthcare provider.

Patient Information:
- Name: [name]
- Age: [age] years
- Gender: [gender]

Chronic Conditions:
- [condition] (onset: [date], severity: [severity])

Current Medications:
- [medication]: [dosage] (started: [date])

Allergies:
- [allergen] ([type]): [reactions]

Recent Encounters:
- [date]: [type] - [reason]

Abnormal Lab Results:
- [test]: [value] [unit] ([interpretation]) - [date]

Recent Diagnoses (last 30 days):
- [diagnosis] - [date] ([status])

Generate a structured clinical summary following these requirements:

1. Maximum [maxWords] words
2. Bullet-point format
3. Highlight the following sections:
   - Chronic Conditions (with confidence scores)
   - Current Medications (with dosages and confidence scores)
   - Allergies (with severity)
   - Recent Visits (last 3 months)
   - Abnormal Lab Results (if any)
   - Recent Diagnoses (last 30 days)
4. Include confidence scores (0-100%) for each clinical fact
5. Flag any ambiguous medical terminology that requires clinician review
6. Use chronological order for events

Output Format:
## Chronic Conditions
- [condition] (confidence: X%)

## Current Medications
- [medication] [dosage] (confidence: X%)

## Allergies
- [allergen] - [severity] - [reaction]

## Recent Visits
- [date]: [type] - [reason]

## Abnormal Lab Results
- [test]: [value] [unit] ([interpretation]) - [date] (confidence: X%)

## Recent Diagnoses
- [diagnosis] - [date] (confidence: X%)

## Flags for Review
- [ambiguous terms or concerns]

## Overall Confidence Score
[X%]

Generate the summary now:
```

**Key Features:**

- **Structured Output**: Enforces consistent formatting with markdown sections
- **Confidence Scores**: Requests confidence percentages for each clinical fact
- **Critical Highlights**: Emphasizes chronic conditions, medications, allergies
- **Chronological Order**: Ensures events are presented in time sequence
- **Ambiguity Flagging**: Identifies terms requiring clinician review
- **Word Limit**: Enforces maximum word count (default: 200 words)

#### 3. Confidence Score Extraction

The system extracts confidence scores from the generated summary using regex patterns:

```python
# Overall confidence score
overall_match = re.search(r'Overall Confidence Score[:\s]+(\d+)%', summary_text)

# Section-specific confidence scores
confidence_pattern = r'\(confidence:\s*(\d+)%\)'
scores = re.findall(confidence_pattern, section_text)
```

**Confidence Score Categories:**

- `overall`: Overall summary confidence (0.0 - 1.0)
- `chronicConditions`: Confidence in chronic condition identification
- `medications`: Confidence in medication information
- `allergies`: Confidence in allergy information (typically high)
- `recentVisits`: Confidence in encounter data
- `labResults`: Confidence in lab result interpretation
- `recentDiagnoses`: Confidence in recent diagnosis information

#### 4. Integration with Lambda Handler

The `generate_summary_with_bedrock()` function in `index.py` integrates the Bedrock summarizer:

```python
def generate_summary_with_bedrock(
    patient_id: str,
    aggregated_data: Dict[str, Any],
    options: Dict[str, Any]
) -> tuple[str, Dict[str, float]]:
    """Generate clinical summary using Amazon Bedrock."""

    # Import Bedrock summarizer
    from utils.bedrock_summarizer import create_bedrock_summarizer

    # Create summarizer instance
    summarizer = create_bedrock_summarizer(
        model_id=BEDROCK_MODEL_ID,
        region=BEDROCK_REGION,
        max_tokens=int(os.environ.get('BEDROCK_MAX_TOKENS', '1024')),
        temperature=float(os.environ.get('BEDROCK_TEMPERATURE', '0.0')),
        top_p=float(os.environ.get('BEDROCK_TOP_P', '0.9'))
    )

    # Generate summary
    summary_text, confidence_scores = summarizer.generate_summary(
        patient_id=patient_id,
        aggregated_data=aggregated_data,
        options=options
    )

    return summary_text, confidence_scores
```

## Configuration

### Environment Variables

```bash
# Bedrock Model Configuration
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_REGION=us-east-1
BEDROCK_MAX_TOKENS=1024
BEDROCK_TEMPERATURE=0.0
BEDROCK_TOP_P=0.9

# Summary Configuration
MAX_SUMMARY_WORDS=200
MIN_FACT_CONFIDENCE=0.70
```

### IAM Permissions

The Lambda execution role requires the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
      ]
    }
  ]
}
```

## Usage

### Basic Usage

```python
from utils.bedrock_summarizer import create_bedrock_summarizer

# Create summarizer
summarizer = create_bedrock_summarizer()

# Generate summary
summary_text, confidence_scores = summarizer.generate_summary(
    patient_id='patient-123',
    aggregated_data=aggregated_data,
    options={'maxWords': 200}
)

print(summary_text)
print(f"Overall confidence: {confidence_scores['overall']:.2%}")
```

### Example Output

```markdown
## Chronic Conditions

- Type 2 Diabetes Mellitus (confidence: 95%)
- Hypertension (confidence: 92%)

## Current Medications

- Metformin 500mg - One tablet twice daily (confidence: 98%)
- Lisinopril 10mg - One tablet daily (confidence: 98%)

## Allergies

- Penicillin - High severity - Rash, Itching

## Recent Visits

- 2024-01-05: Outpatient - Cough and fever

## Abnormal Lab Results

- HbA1c: 7.2 % (High) - 2024-01-10 (confidence: 95%)

## Recent Diagnoses

- Acute Bronchitis - 2024-01-05 (confidence: 90%)

## Flags for Review

- None

## Overall Confidence Score

94%
```

## Error Handling

The integration includes comprehensive error handling:

### Bedrock API Errors

```python
try:
    summary_text, confidence_scores = summarizer.generate_summary(...)
except BedrockSummarizerError as e:
    logger.error(f"Bedrock error: {str(e)}")
    # Handle error (retry, fallback, etc.)
```

### Common Error Scenarios

1. **Throttling**: Rate limit exceeded
   - Error: `ThrottlingException`
   - Solution: Implement exponential backoff retry

2. **Model Not Available**: Model ID incorrect or not accessible
   - Error: `ValidationException`
   - Solution: Verify model ID and region

3. **Invalid Request**: Malformed request body
   - Error: `ValidationException`
   - Solution: Check request format and parameters

4. **Timeout**: Request exceeds timeout limit
   - Error: `TimeoutException`
   - Solution: Reduce input size or increase timeout

## Performance Considerations

### Latency

- **Target**: < 30 seconds for summary generation
- **Typical**: 2-5 seconds for Claude 3.5 Sonnet
- **Factors**: Input size, model load, network latency

### Cost Optimization

- **Model Selection**: Claude 3.5 Sonnet balances quality and cost
- **Token Limits**: Max 1024 tokens reduces costs
- **Caching**: Implement summary caching (Task 11.8)
- **Batch Processing**: Process multiple summaries in parallel

### Cold Start Optimization

- **Singleton Pattern**: Reuse Bedrock client across invocations
- **Lazy Loading**: Initialize client only when needed
- **Connection Pooling**: Maintain persistent connections

## Testing

### Unit Tests

Run unit tests for the Bedrock summarizer:

```bash
pytest src/__tests__/test_bedrock_summarizer.py -v
```

### Integration Tests

Test the complete flow with mocked Bedrock:

```bash
pytest src/__tests__/test_handler.py::TestGenerateSummaryWithBedrock -v
```

### Manual Testing

Test with a real Bedrock endpoint:

```bash
# Set environment variables
export BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
export BEDROCK_REGION=us-east-1

# Run the Lambda locally
python src/index.py
```

## Monitoring

### CloudWatch Metrics

The integration emits custom metrics:

- `BedrockInvocationCount`: Number of Bedrock API calls
- `BedrockInvocationLatency`: Time to generate summary
- `BedrockErrorCount`: Number of failed API calls
- `SummaryConfidenceScore`: Average confidence scores

### CloudWatch Logs

All Bedrock interactions are logged:

```
INFO: Generating summary for patient patient-123
INFO: Initialized BedrockSummarizer with model: anthropic.claude-3-5-sonnet-20241022-v2:0
INFO: Successfully generated summary (overall confidence: 94%)
```

### X-Ray Tracing

Enable X-Ray tracing to monitor Bedrock API performance:

```python
from aws_xray_sdk.core import xray_recorder

@xray_recorder.capture('generate_summary')
def generate_summary(...):
    # Summary generation logic
```

## Security

### Data Privacy

- **PHI Protection**: All patient data encrypted in transit (TLS 1.3)
- **No Data Retention**: Bedrock does not store input/output data
- **Audit Logging**: All API calls logged to CloudTrail

### Access Control

- **IAM Policies**: Least privilege access to Bedrock
- **VPC Endpoints**: Private connectivity to Bedrock (optional)
- **Encryption**: KMS encryption for cached summaries

## Troubleshooting

### Issue: Empty Summary Response

**Symptom**: Summary text is empty or contains only headers

**Solution**:

1. Check aggregated data has sufficient information
2. Verify prompt includes clinical context
3. Increase max_tokens if summary is truncated

### Issue: Low Confidence Scores

**Symptom**: Confidence scores consistently below 70%

**Solution**:

1. Review source FHIR data quality
2. Check for missing or incomplete fields
3. Verify medical terminology mapping

### Issue: Bedrock Timeout

**Symptom**: Request times out after 30 seconds

**Solution**:

1. Reduce input data size
2. Limit number of FHIR resources
3. Increase Lambda timeout setting

## Next Steps

### Task 11.5: Prompt Engineering

- Refine prompt for better medical accuracy
- Add specialty-specific prompts (cardiology, oncology, etc.)
- Implement multi-language support

### Task 11.6: Confidence Scoring

- Enhance confidence score calculation
- Add field-level confidence tracking
- Implement confidence thresholds for HITL routing

### Task 11.7: Structured Output Formatting

- Support multiple output formats (JSON, Markdown, HTML)
- Add customizable templates
- Implement section filtering

### Task 11.8: Caching

- Implement DynamoDB caching for summaries
- Add cache invalidation on new records
- Optimize cache TTL based on usage patterns

## References

- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Claude 3.5 Sonnet Model Card](https://www.anthropic.com/claude)
- [VaidyaLink Design Document](../../.kiro/specs/vaidyalink/design.md)
- [Clinical Summarizer Requirements](../../.kiro/specs/vaidyalink/requirements.md)

## Support

For issues or questions:

- Check CloudWatch Logs for error details
- Review X-Ray traces for performance bottlenecks
- Consult the troubleshooting section above
- Contact the VaidyaLink development team
