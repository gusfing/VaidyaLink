# CloudWatch Logging and Metrics for Document Processing

This document describes the CloudWatch logging and metrics implementation for the VaidyaLink document processing Lambda function.

## Overview

The document processing Lambda emits comprehensive CloudWatch metrics and structured logs to enable:

- **Performance monitoring**: Track processing latency for each operation
- **Quality monitoring**: Monitor OCR accuracy and confidence scores
- **Error tracking**: Identify and categorize processing errors
- **Business metrics**: Track document processing rates and HITL routing
- **Operational insights**: Structured logs for troubleshooting and analysis

## Architecture

### Components

1. **CloudWatchMetrics**: Emits custom metrics to CloudWatch
2. **StructuredLogger**: Emits JSON-formatted structured logs
3. **JsonFormatter**: Formats log records as JSON for CloudWatch Logs Insights
4. **Helper Functions**: Decorators and context managers for automatic tracking

### Metrics Namespace

All metrics are emitted to the namespace: `VaidyaLink/DocumentProcessing`

## Custom Metrics

### Processing Latency

Tracks the time taken for each operation in milliseconds.

**Metric Name**: `ProcessingLatency`
**Unit**: Milliseconds
**Dimensions**:

- `Operation`: ocr, bedrock, total
- `Status`: success, failure

**Example CloudWatch Query**:

```
SELECT AVG(ProcessingLatency)
FROM "VaidyaLink/DocumentProcessing"
WHERE Operation = 'ocr'
GROUP BY Status
```

### OCR Accuracy

Tracks OCR confidence scores as a percentage.

**Metric Name**: `OCRAccuracy`
**Unit**: Percent
**Dimensions**:

- `Language`: en, hi, ta, etc.

**Example CloudWatch Query**:

```
SELECT AVG(OCRAccuracy)
FROM "VaidyaLink/DocumentProcessing"
WHERE Language = 'en'
```

### Overall Confidence

Tracks the overall confidence score for extracted data.

**Metric Name**: `OverallConfidence`
**Unit**: Percent
**Dimensions**: None

**Example CloudWatch Query**:

```
SELECT AVG(OverallConfidence), MIN(OverallConfidence), MAX(OverallConfidence)
FROM "VaidyaLink/DocumentProcessing"
```

### Component Confidence

Tracks confidence scores for each component (OCR, Extraction, Validation).

**Metric Name**: `ComponentConfidence`
**Unit**: Percent
**Dimensions**:

- `Component`: OCR, Extraction, Validation

**Example CloudWatch Query**:

```
SELECT AVG(ComponentConfidence)
FROM "VaidyaLink/DocumentProcessing"
GROUP BY Component
```

### HITL Routing

Tracks when documents are routed to human-in-the-loop verification.

**Metric Name**: `HITLRouting`
**Unit**: Count
**Dimensions**:

- `Routed`: true, false
- `Reason`: low_confidence, validation_failed, etc.

**Example CloudWatch Query**:

```
SELECT SUM(HITLRouting)
FROM "VaidyaLink/DocumentProcessing"
WHERE Routed = 'true'
```

### Processing Errors

Tracks errors during document processing.

**Metric Name**: `ProcessingErrors`
**Unit**: Count
**Dimensions**:

- `ErrorCategory`: transient, permanent, throttling, resource, validation
- `ErrorSeverity`: low, medium, high, critical
- `Operation`: ocr, bedrock, s3, dynamodb, etc.

**Example CloudWatch Query**:

```
SELECT SUM(ProcessingErrors)
FROM "VaidyaLink/DocumentProcessing"
GROUP BY ErrorCategory, ErrorSeverity
```

### Documents Processed

Tracks the number of documents processed.

**Metric Name**: `DocumentsProcessed`
**Unit**: Count
**Dimensions**:

- `DocumentType`: prescription, lab_report, discharge_summary, etc.
- `Status`: completed, failed, hitl_required

**Example CloudWatch Query**:

```
SELECT SUM(DocumentsProcessed)
FROM "VaidyaLink/DocumentProcessing"
GROUP BY Status
```

### Field Extraction

Tracks field-level extraction success and confidence.

**Metric Name**: `FieldExtraction`
**Unit**: Count
**Dimensions**:

- `FieldName`: patient_name, medications, diagnosis, etc.
- `Extracted`: true, false

**Metric Name**: `FieldConfidence`
**Unit**: Percent
**Dimensions**:

- `FieldName`: patient_name, medications, diagnosis, etc.

**Example CloudWatch Query**:

```
SELECT AVG(FieldConfidence)
FROM "VaidyaLink/DocumentProcessing"
WHERE FieldName = 'medications'
```

## Structured Logging

### Log Format

All logs are emitted in JSON format for easy parsing with CloudWatch Logs Insights.

**Standard Fields**:

- `timestamp`: ISO 8601 timestamp
- `level`: Log level (INFO, WARNING, ERROR, CRITICAL)
- `logger`: Logger name
- `message`: Human-readable message
- `event_type`: Type of event (processing_started, ocr_extraction, etc.)

**Example Log Entry**:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "logger": "document_processing",
  "message": "Started processing job job-123",
  "event_type": "processing_started",
  "job_id": "job-123",
  "s3_bucket": "vaidyalink-documents",
  "s3_key": "raw/patient-456/job-123/original.jpg"
}
```

### Event Types

#### processing_started

Emitted when document processing begins.

**Fields**:

- `job_id`: Job identifier
- `s3_bucket`: S3 bucket name
- `s3_key`: S3 object key

#### processing_completed

Emitted when document processing completes successfully.

**Fields**:

- `job_id`: Job identifier
- `duration_ms`: Total processing time in milliseconds
- `overall_confidence`: Overall confidence score
- `hitl_required`: Whether HITL verification is needed

#### ocr_extraction

Emitted after OCR text extraction.

**Fields**:

- `job_id`: Job identifier
- `text_regions`: Number of text regions extracted
- `average_confidence`: Average OCR confidence
- `duration_ms`: OCR processing time

#### bedrock_structuring

Emitted after Bedrock structures clinical data.

**Fields**:

- `job_id`: Job identifier
- `fields_extracted`: Number of fields extracted
- `duration_ms`: Bedrock processing time

#### confidence_calculation

Emitted after confidence scores are calculated.

**Fields**:

- `job_id`: Job identifier
- `overall_confidence`: Overall confidence score
- `critical_fields_below_threshold`: List of critical fields below threshold

#### hitl_routing

Emitted when a job is routed to HITL.

**Fields**:

- `job_id`: Job identifier
- `confidence`: Overall confidence score
- `critical_fields_below_threshold`: List of critical fields

#### error

Emitted when an error occurs.

**Fields**:

- `job_id`: Job identifier
- `operation`: Operation where error occurred
- `error_message`: Error message
- `error_category`: Error category
- `error_severity`: Error severity
- `attempt`: Retry attempt number

## CloudWatch Logs Insights Queries

### Find Failed Jobs

```
fields @timestamp, job_id, error_message, error_category
| filter event_type = "error"
| sort @timestamp desc
| limit 100
```

### Calculate Average Processing Time

```
fields @timestamp, job_id, duration_ms
| filter event_type = "processing_completed"
| stats avg(duration_ms) as avg_duration, max(duration_ms) as max_duration, min(duration_ms) as min_duration
```

### Find Low Confidence Extractions

```
fields @timestamp, job_id, overall_confidence, critical_fields_below_threshold
| filter event_type = "confidence_calculation" and overall_confidence < 0.80
| sort overall_confidence asc
| limit 50
```

### Track HITL Routing Rate

```
fields @timestamp, job_id
| filter event_type = "hitl_routing"
| stats count() as hitl_count by bin(5m)
```

### Monitor OCR Performance by Language

```
fields @timestamp, job_id, average_confidence
| filter event_type = "ocr_extraction"
| stats avg(average_confidence) as avg_confidence by language
```

### Error Rate by Category

```
fields @timestamp, error_category, error_severity
| filter event_type = "error"
| stats count() as error_count by error_category, error_severity
```

## CloudWatch Alarms

### Recommended Alarms

#### High Error Rate

**Metric**: `ProcessingErrors`
**Threshold**: > 5 errors in 5 minutes
**Action**: Send SNS notification to on-call team

```python
alarm = cloudwatch.Alarm(
    alarm_name='DocumentProcessing-HighErrorRate',
    metric=cloudwatch.Metric(
        namespace='VaidyaLink/DocumentProcessing',
        metric_name='ProcessingErrors',
        statistic='Sum',
        period=Duration.minutes(5)
    ),
    threshold=5,
    evaluation_periods=1,
    comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
)
```

#### Low OCR Accuracy

**Metric**: `OCRAccuracy`
**Threshold**: < 85% average over 10 minutes
**Action**: Send SNS notification

```python
alarm = cloudwatch.Alarm(
    alarm_name='DocumentProcessing-LowOCRAccuracy',
    metric=cloudwatch.Metric(
        namespace='VaidyaLink/DocumentProcessing',
        metric_name='OCRAccuracy',
        statistic='Average',
        period=Duration.minutes(10)
    ),
    threshold=85,
    evaluation_periods=2,
    comparison_operator=cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD
)
```

#### High Processing Latency

**Metric**: `ProcessingLatency` (Operation=total)
**Threshold**: > 45000ms (45 seconds) average
**Action**: Send SNS notification

```python
alarm = cloudwatch.Alarm(
    alarm_name='DocumentProcessing-HighLatency',
    metric=cloudwatch.Metric(
        namespace='VaidyaLink/DocumentProcessing',
        metric_name='ProcessingLatency',
        dimensions={'Operation': 'total'},
        statistic='Average',
        period=Duration.minutes(5)
    ),
    threshold=45000,
    evaluation_periods=2,
    comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
)
```

#### High HITL Routing Rate

**Metric**: `HITLRouting` (Routed=true)
**Threshold**: > 50% of documents in 15 minutes
**Action**: Send SNS notification

```python
alarm = cloudwatch.Alarm(
    alarm_name='DocumentProcessing-HighHITLRate',
    metric=cloudwatch.Metric(
        namespace='VaidyaLink/DocumentProcessing',
        metric_name='HITLRouting',
        dimensions={'Routed': 'true'},
        statistic='Sum',
        period=Duration.minutes(15)
    ),
    threshold=50,
    evaluation_periods=1,
    comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
)
```

## Usage Examples

### Basic Usage in Lambda Handler

```python
from cloudwatch_logger import get_metrics, get_structured_logger

# Initialize (done once per Lambda container)
metrics = get_metrics()
structured_logger = get_structured_logger()

def handler(event, context):
    job_id = event['jobId']

    # Log processing start
    structured_logger.log_processing_started(
        job_id=job_id,
        bucket='my-bucket',
        key='my-key'
    )

    # Process document...

    # Record metrics
    metrics.record_processing_latency(
        latency_ms=1500.0,
        operation='ocr',
        status='success'
    )

    metrics.record_ocr_accuracy(
        confidence=0.92,
        language='en'
    )

    # Flush metrics before returning
    metrics.flush_metrics()

    return {'statusCode': 200}
```

### Using track_operation Context Manager

```python
from cloudwatch_logger import track_operation, get_metrics, get_structured_logger

metrics = get_metrics()
structured_logger = get_structured_logger()

def process_document(job_id, bucket, key):
    with track_operation(
        operation_name='document_processing',
        metrics=metrics,
        structured_logger=structured_logger,
        job_id=job_id,
        bucket=bucket,
        key=key
    ) as result:
        # Do processing...
        result['status'] = 'success'
        result['confidence'] = 0.92
```

### Using measure_latency Decorator

```python
from cloudwatch_logger import measure_latency

@measure_latency('ocr_extraction')
def extract_text(image_data):
    # OCR processing...
    return ocr_results
```

## Environment Variables

- `CLOUDWATCH_NAMESPACE`: CloudWatch namespace (default: `VaidyaLink/DocumentProcessing`)
- `LOG_LEVEL`: Logging level (default: `INFO`)
- `AWS_REGION`: AWS region for CloudWatch client

## Performance Considerations

### Metric Buffering

Metrics are buffered and sent in batches of up to 20 (CloudWatch limit) to reduce API calls and improve performance.

### Automatic Flushing

- Metrics are automatically flushed when the buffer reaches 20 metrics
- Call `metrics.flush_metrics()` before Lambda returns to ensure all metrics are sent

### Lazy Initialization

CloudWatch clients are initialized lazily to minimize cold start time.

## Cost Optimization

### Metric Costs

- Custom metrics: $0.30 per metric per month
- API requests: $0.01 per 1,000 PutMetricData requests

**Estimated monthly cost** (1M documents/month):

- ~15 metrics per document = 15M metric data points
- Batched in groups of 20 = 750K API requests
- Cost: ~$7.50/month for metrics

### Log Costs

- CloudWatch Logs ingestion: $0.50 per GB
- CloudWatch Logs storage: $0.03 per GB per month

**Estimated monthly cost** (1M documents/month):

- ~2KB per document = 2GB logs
- Ingestion: $1.00
- Storage (30 days): $0.06
- Total: ~$1.06/month for logs

## Troubleshooting

### Metrics Not Appearing

1. Check IAM permissions for `cloudwatch:PutMetricData`
2. Verify metrics are being flushed before Lambda returns
3. Check CloudWatch namespace spelling
4. Review Lambda logs for metric emission errors

### Logs Not Structured

1. Verify JsonFormatter is configured
2. Check LOG_LEVEL environment variable
3. Ensure structured_logger is initialized

### High Latency

1. Check metric buffer size (reduce if needed)
2. Verify CloudWatch client is initialized lazily
3. Consider async metric emission for high-volume scenarios

## Best Practices

1. **Always flush metrics** before Lambda returns
2. **Use dimensions** to enable detailed filtering and analysis
3. **Set up alarms** for critical metrics
4. **Use CloudWatch Logs Insights** for log analysis
5. **Monitor costs** and adjust retention policies as needed
6. **Test metric emission** in development environment
7. **Document custom metrics** for team visibility

## Related Documentation

- [Error Handling Guide](ERROR_HANDLING.md)
- [HITL Routing](HITL_ROUTING.md)
- [Confidence Scoring](CONFIDENCE_SCORING.md)
- [AWS CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)
