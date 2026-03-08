# Clinical Summarizer Lambda

Generate 30-second clinical summaries from patient FHIR resources using Amazon Bedrock with Claude 3.5 Sonnet.

## Overview

The Clinical Summarizer Lambda is responsible for generating automated, concise clinical summaries of patient records. It queries AWS HealthLake for FHIR resources, aggregates clinical data chronologically, and uses Amazon Bedrock to generate structured summaries that highlight critical information for healthcare providers.

## Runtime

**Python 3.11**

## Key Features

- **Fast Summarization**: Generates summaries within 30 seconds
- **Intelligent Aggregation**: Chronologically orders clinical events
- **Critical Highlights**: Emphasizes chronic conditions, allergies, current medications, and recent diagnoses
- **Confidence Scoring**: Provides confidence scores for each extracted clinical fact
- **Flexible Output**: Supports JSON, Markdown, and HTML output formats
- **Smart Caching**: Caches frequently accessed summaries to reduce costs and latency
- **Medical Term Disambiguation**: Flags ambiguous medical terminology for clinician review

## Responsibilities

1. **Query HealthLake**: Retrieve patient FHIR resources from AWS HealthLake
2. **Data Aggregation**: Aggregate and organize clinical data chronologically
3. **AI Summarization**: Generate structured summaries using Claude 3.5 Sonnet
4. **Confidence Scoring**: Calculate confidence scores for extracted facts
5. **Output Formatting**: Format summaries for clinical display
6. **Caching**: Cache summaries for improved performance

## Architecture

```
┌─────────────────┐
│   API Gateway   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Clinical Summarizer Lambda         │
│  ┌───────────────────────────────┐  │
│  │ 1. Query HealthLake           │  │
│  │ 2. Aggregate Clinical Data    │  │
│  │ 3. Generate Summary (Bedrock) │  │
│  │ 4. Calculate Confidence       │  │
│  │ 5. Format Output              │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│  AWS HealthLake │  │ Amazon Bedrock  │
│  (FHIR Store)   │  │ (Claude 3.5)    │
└─────────────────┘  └─────────────────┘
```

## Environment Variables

### AWS Configuration

- `AWS_REGION` - AWS region (default: ap-south-1)
- `AWS_ACCOUNT_ID` - AWS account ID

### Amazon Bedrock Configuration

- `BEDROCK_MODEL_ID` - Bedrock model ID (default: anthropic.claude-3-5-sonnet-20241022-v2:0)
- `BEDROCK_REGION` - Bedrock region (default: us-east-1)
- `BEDROCK_MAX_TOKENS` - Maximum tokens for summary (default: 1024)
- `BEDROCK_TEMPERATURE` - Model temperature (default: 0.0)
- `BEDROCK_TOP_P` - Top-p sampling parameter (default: 0.9)

### AWS HealthLake Configuration

- `HEALTHLAKE_DATASTORE_ID` - HealthLake datastore identifier
- `HEALTHLAKE_ENDPOINT` - HealthLake API endpoint
- `HEALTHLAKE_API_VERSION` - FHIR API version (default: R4)

### Summary Configuration

- `MAX_SUMMARY_WORDS` - Maximum summary length in words (default: 200)
- `MAX_RECENT_ENCOUNTERS` - Maximum recent encounters to include (default: 10)
- `MAX_MEDICATIONS` - Maximum medications to highlight (default: 15)
- `MIN_FACT_CONFIDENCE` - Minimum confidence for including facts (default: 0.70)
- `ENABLE_CHRONOLOGICAL_ORDER` - Enable chronological ordering (default: true)
- `ENABLE_CRITICAL_HIGHLIGHTS` - Enable critical information highlighting (default: true)

### Clinical Data Configuration

- `FHIR_RESOURCE_TYPES` - FHIR resource types to include (comma-separated)
- `MAX_RECORD_AGE_DAYS` - Maximum age of records in days (default: 730)
- `INCLUDE_LAB_RESULTS` - Include lab results (default: true)
- `INCLUDE_VITAL_SIGNS` - Include vital signs (default: true)
- `INCLUDE_DIAGNOSTIC_REPORTS` - Include diagnostic reports (default: true)

### Cache Configuration

- `ENABLE_SUMMARY_CACHE` - Enable caching (default: true)
- `CACHE_TTL_SECONDS` - Cache TTL in seconds (default: 3600)
- `INVALIDATE_ON_NEW_RECORDS` - Invalidate cache on new records (default: true)

### Performance Configuration

- `MAX_PROCESSING_TIME` - Maximum processing time in seconds (default: 30)
- `ENABLE_PARALLEL_FETCH` - Enable parallel FHIR resource fetching (default: true)
- `MAX_CONCURRENT_QUERIES` - Maximum concurrent FHIR queries (default: 5)

### Monitoring Configuration

- `LOG_GROUP` - CloudWatch log group
- `LOG_LEVEL` - Logging level (default: INFO)
- `ENABLE_XRAY_TRACING` - Enable X-Ray tracing (default: true)
- `ENABLE_DETAILED_METRICS` - Enable detailed metrics (default: true)

### Encryption Configuration

- `KMS_KEY_ID` - KMS key ID for encrypting cached summaries
- `ENABLE_ENCRYPTION` - Enable encryption for cached data (default: true)

## Event Structure

### Input Event

```json
{
  "patientId": "patient-123",
  "options": {
    "maxWords": 200,
    "includeLabResults": true,
    "includeVitalSigns": true,
    "includeDiagnosticReports": true,
    "maxRecordAgeDays": 730,
    "outputFormat": "json"
  }
}
```

### Response

```json
{
  "statusCode": 200,
  "body": {
    "summary": {
      "patientId": "patient-123",
      "summary": "## Chronic Conditions\n- Type 2 Diabetes Mellitus (confidence: 95%)\n...",
      "confidenceScores": {
        "overall": 0.92,
        "chronicConditions": 0.95,
        "medications": 0.9,
        "recentVisits": 0.88
      },
      "metadata": {
        "resourceCount": 45,
        "generatedAt": "2024-01-15T10:30:00Z",
        "processingTimeMs": 2500,
        "modelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "outputFormat": "json"
      }
    },
    "cached": false,
    "requestId": "abc-123"
  }
}
```

## Dependencies

See `requirements.txt` for complete list:

- **boto3** - AWS SDK for Python
- **anthropic** - Amazon Bedrock SDK
- **fhir.resources** - FHIR resource parsing
- **python-dotenv** - Environment variable management
- **pytest** - Testing framework

## Local Development

### Setup

1. Install dependencies:

```bash
cd backend/clinical-summarizer
pip install -r requirements.txt
```

2. Copy environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run tests:

```bash
pytest
```

### Docker Development

Build and run the Lambda locally:

```bash
# Build Docker image
docker build -f Dockerfile.dev -t clinical-summarizer:dev .

# Run container
docker run -p 9000:8080 \
  -e AWS_REGION=ap-south-1 \
  -e BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0 \
  clinical-summarizer:dev

# Test the Lambda
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d '{"patientId": "patient-123", "options": {"maxWords": 200}}'
```

## Testing

### Run All Tests

```bash
pytest
```

### Run Specific Test File

```bash
pytest src/__tests__/test_handler.py
```

### Run with Coverage

```bash
pytest --cov=src --cov-report=html
```

### Run Integration Tests

```bash
pytest -m integration
```

## Implementation Status

### Task 11.1: Create Lambda function with Python 3.11 ✅

- [x] Lambda handler structure
- [x] Error handling
- [x] Logging setup
- [x] Environment variable configuration
- [x] Basic unit tests
- [x] Docker development setup
- [x] Documentation

### Upcoming Tasks

- **Task 11.2**: Implement HealthLake query logic
- **Task 11.3**: Create data aggregation pipeline
- **Task 11.4**: Integrate Amazon Bedrock for summarization
- **Task 11.5**: Implement prompt engineering for medical summaries
- **Task 11.6**: Add confidence scoring for extracted facts
- **Task 11.7**: Create structured output formatting
- **Task 11.8**: Implement caching for frequently accessed summaries

## Error Handling

The Lambda implements comprehensive error handling:

- **ClinicalSummarizerError**: Base exception for all summarizer errors
- **HealthLakeQueryError**: Errors querying AWS HealthLake
- **BedrockSummarizationError**: Errors generating summaries with Bedrock

All errors are logged with context and return appropriate HTTP status codes.

## Performance Considerations

- **Cold Start Optimization**: Singleton pattern for AWS clients
- **Parallel Processing**: Concurrent FHIR resource fetching
- **Caching**: Smart caching to reduce redundant API calls
- **Timeout Management**: 30-second processing time limit

## Security

- **Encryption**: All cached data encrypted with AWS KMS
- **IAM Permissions**: Least privilege access to HealthLake and Bedrock
- **Audit Logging**: All operations logged to CloudWatch
- **PHI Protection**: HIPAA-compliant data handling

## Monitoring

The Lambda emits custom CloudWatch metrics:

- Summary generation latency
- HealthLake query performance
- Bedrock API latency
- Cache hit/miss rates
- Error rates by type

## Related Services

- **AWS HealthLake**: FHIR data store
- **Amazon Bedrock**: AI summarization
- **Document Processing Lambda**: Upstream data source
- **FHIR Transformer Lambda**: FHIR resource creation
- **Patient Dashboard**: Summary consumer

## Support

For issues or questions, refer to:

- [VaidyaLink Documentation](../../docs/)
- [FHIR Transformer Integration](../fhir-transformer/)
- [HealthLake Setup Guide](../../infrastructure/docs/HEALTHLAKE_QUICK_START.md)
