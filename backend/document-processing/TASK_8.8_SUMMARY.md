# Task 8.8 Summary: CloudWatch Logging and Metrics

## Overview

Implemented comprehensive CloudWatch logging and metrics for the document processing Lambda function to enable monitoring, troubleshooting, and operational insights.

## Implementation Details

### 1. CloudWatch Metrics Module (`cloudwatch_logger.py`)

Created a comprehensive module with the following components:

#### CloudWatchMetrics Class

- Emits custom metrics to CloudWatch namespace `VaidyaLink/DocumentProcessing`
- Buffers metrics for batch sending (up to 20 metrics per request)
- Automatic flushing when buffer is full
- Tracks:
  - Processing latency (by operation and status)
  - OCR accuracy (by language)
  - Confidence scores (overall and by component)
  - HITL routing events
  - Processing errors (by category and severity)
  - Documents processed (by type and status)
  - Field-level extraction metrics

#### StructuredLogger Class

- Emits JSON-formatted logs for CloudWatch Logs Insights
- Structured event logging with consistent schema
- Pre-built methods for common events:
  - `log_processing_started()`
  - `log_processing_completed()`
  - `log_ocr_extraction()`
  - `log_bedrock_structuring()`
  - `log_confidence_calculation()`
  - `log_hitl_routing()`
  - `log_error()`

#### Helper Functions

- `track_operation()`: Context manager for automatic operation tracking
- `measure_latency()`: Decorator for latency measurement
- `get_metrics()`: Global metrics instance getter
- `get_structured_logger()`: Global logger instance getter

### 2. Integration with Main Handler

Updated `src/index.py` to integrate CloudWatch logging and metrics:

- Initialize metrics and logger at Lambda container level
- Track processing latency for each operation (OCR, Bedrock, total)
- Emit OCR accuracy metrics
- Record confidence scores
- Track HITL routing decisions
- Log structured events at key points
- Emit error metrics with categorization
- Flush metrics before Lambda returns

### 3. Custom Metrics Emitted

| Metric Name         | Unit         | Dimensions                              | Purpose                       |
| ------------------- | ------------ | --------------------------------------- | ----------------------------- |
| ProcessingLatency   | Milliseconds | Operation, Status                       | Track processing time         |
| OCRAccuracy         | Percent      | Language                                | Monitor OCR quality           |
| OverallConfidence   | Percent      | None                                    | Track extraction confidence   |
| ComponentConfidence | Percent      | Component                               | Monitor component performance |
| HITLRouting         | Count        | Routed, Reason                          | Track HITL routing rate       |
| ProcessingErrors    | Count        | ErrorCategory, ErrorSeverity, Operation | Monitor error rates           |
| DocumentsProcessed  | Count        | DocumentType, Status                    | Track throughput              |
| FieldExtraction     | Count        | FieldName, Extracted                    | Monitor field extraction      |
| FieldConfidence     | Percent      | FieldName                               | Track field-level confidence  |

### 4. Structured Log Events

All logs are emitted in JSON format with these event types:

- `processing_started`: Document processing begins
- `processing_completed`: Processing finishes successfully
- `ocr_extraction`: OCR text extraction completes
- `bedrock_structuring`: Bedrock structures clinical data
- `confidence_calculation`: Confidence scores calculated
- `hitl_routing`: Job routed to HITL
- `error`: Error occurs during processing

### 5. Testing

Created comprehensive test suite (`test_cloudwatch.py`):

- 21 test cases covering all functionality
- Tests for metrics emission
- Tests for structured logging
- Tests for helper functions
- All tests passing ✅

### 6. Documentation

Created two documentation files:

#### CLOUDWATCH_LOGGING_METRICS.md

- Complete reference documentation
- Metric definitions and dimensions
- Log event schemas
- CloudWatch Logs Insights queries
- Recommended alarms
- Usage examples
- Cost analysis
- Troubleshooting guide

#### CLOUDWATCH_QUICK_START.md

- 5-minute quick start guide
- IAM permissions setup
- Environment variable configuration
- Sample queries
- Alarm creation examples
- Dashboard configuration
- Common troubleshooting

## Key Features

### Performance Monitoring

- Track latency for OCR, Bedrock, and total processing
- Identify bottlenecks and optimization opportunities
- Monitor against SLA targets (< 45 seconds total)

### Quality Monitoring

- OCR accuracy tracking by language
- Confidence score monitoring
- Field-level extraction success rates
- HITL routing rate tracking

### Error Tracking

- Categorized error metrics (transient, permanent, throttling, etc.)
- Severity-based error tracking
- Operation-specific error rates
- Structured error logs for troubleshooting

### Operational Insights

- Document processing throughput
- Processing status distribution
- Document type analysis
- Real-time monitoring via CloudWatch dashboards

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
fields @timestamp, duration_ms
| filter event_type = "processing_completed"
| stats avg(duration_ms) as avg_duration
```

### Find Low Confidence Extractions

```
fields @timestamp, job_id, overall_confidence
| filter event_type = "confidence_calculation" and overall_confidence < 0.80
| sort overall_confidence asc
```

## Recommended CloudWatch Alarms

1. **High Error Rate**: > 5 errors in 5 minutes
2. **Low OCR Accuracy**: < 85% average over 10 minutes
3. **High Processing Latency**: > 45 seconds average
4. **High HITL Routing Rate**: > 50% of documents in 15 minutes

## Cost Estimate

### Monthly Cost (1M documents/month)

**Metrics**:

- ~15 metrics per document = 15M metric data points
- Batched in groups of 20 = 750K API requests
- Cost: ~$7.50/month

**Logs**:

- ~2KB per document = 2GB logs
- Ingestion: $1.00
- Storage (30 days): $0.06
- Cost: ~$1.06/month

**Total**: ~$8.56/month for comprehensive monitoring

## Environment Variables

- `CLOUDWATCH_NAMESPACE`: Namespace for metrics (default: `VaidyaLink/DocumentProcessing`)
- `LOG_LEVEL`: Logging level (default: `INFO`)
- `AWS_REGION`: AWS region for CloudWatch client

## IAM Permissions Required

```json
{
  "Effect": "Allow",
  "Action": [
    "cloudwatch:PutMetricData",
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents"
  ],
  "Resource": "*"
}
```

## Usage Example

```python
from cloudwatch_logger import get_metrics, get_structured_logger

# Initialize (done once per Lambda container)
metrics = get_metrics()
structured_logger = get_structured_logger()

def handler(event, context):
    job_id = event['jobId']

    # Log processing start
    structured_logger.log_processing_started(job_id, bucket, key)

    # Process document...

    # Record metrics
    metrics.record_processing_latency(1500.0, 'ocr', 'success')
    metrics.record_ocr_accuracy(0.92, 'en')

    # Flush metrics before returning
    metrics.flush_metrics()

    return {'statusCode': 200}
```

## Benefits

1. **Proactive Monitoring**: Identify issues before they impact users
2. **Performance Optimization**: Data-driven optimization decisions
3. **Quality Assurance**: Track OCR and extraction quality over time
4. **Operational Visibility**: Real-time insights into system health
5. **Troubleshooting**: Structured logs for rapid issue resolution
6. **Cost Tracking**: Monitor processing costs and efficiency
7. **SLA Compliance**: Track against performance targets

## Next Steps

1. Deploy updated Lambda function
2. Verify metrics appear in CloudWatch
3. Create CloudWatch dashboard
4. Set up recommended alarms
5. Configure SNS notifications
6. Review metrics weekly for optimization opportunities

## Files Created/Modified

### Created

- `backend/document-processing/src/cloudwatch_logger.py` - Main module
- `backend/document-processing/src/__tests__/test_cloudwatch.py` - Test suite
- `backend/document-processing/CLOUDWATCH_LOGGING_METRICS.md` - Full documentation
- `backend/document-processing/CLOUDWATCH_QUICK_START.md` - Quick start guide
- `backend/document-processing/TASK_8.8_SUMMARY.md` - This summary

### Modified

- `backend/document-processing/src/index.py` - Integrated CloudWatch logging and metrics

## Testing Results

```
21 passed, 44 warnings in 0.41s
```

All tests passing successfully! ✅

## Compliance

- Follows AWS CloudWatch best practices
- Implements metric buffering for cost optimization
- Uses structured logging for CloudWatch Logs Insights
- Includes comprehensive error tracking
- Provides actionable monitoring and alerting

## References

- [AWS CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)
- [CloudWatch Logs Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
- [CloudWatch Best Practices](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Best_Practice_Recommended_Alarms_AWS_Services.html)
