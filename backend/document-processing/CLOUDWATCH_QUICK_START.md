# CloudWatch Logging and Metrics - Quick Start Guide

Get started with CloudWatch logging and metrics for the document processing Lambda in 5 minutes.

## Prerequisites

- AWS account with CloudWatch access
- IAM permissions for `cloudwatch:PutMetricData` and `logs:CreateLogGroup`
- Document processing Lambda deployed

## Step 1: Verify IAM Permissions

Ensure your Lambda execution role has these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["cloudwatch:PutMetricData"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

## Step 2: Set Environment Variables

Configure these environment variables in your Lambda:

```bash
CLOUDWATCH_NAMESPACE=VaidyaLink/DocumentProcessing
LOG_LEVEL=INFO
AWS_REGION=us-east-1
```

## Step 3: Initialize in Lambda Handler

The CloudWatch logger and metrics are already integrated into the main handler. No additional code changes needed!

```python
# Already implemented in src/index.py
from cloudwatch_logger import get_metrics, get_structured_logger

metrics = get_metrics()
structured_logger = get_structured_logger()
```

## Step 4: View Metrics in CloudWatch Console

1. Open AWS CloudWatch Console
2. Navigate to **Metrics** → **All metrics**
3. Select namespace: **VaidyaLink/DocumentProcessing**
4. View available metrics:
   - ProcessingLatency
   - OCRAccuracy
   - OverallConfidence
   - HITLRouting
   - ProcessingErrors
   - DocumentsProcessed

## Step 5: Query Logs with CloudWatch Logs Insights

1. Open CloudWatch Console
2. Navigate to **Logs** → **Logs Insights**
3. Select log group: `/aws/lambda/document-processing`
4. Run sample queries:

### Find Recent Processing Events

```
fields @timestamp, job_id, event_type, message
| filter event_type = "processing_completed"
| sort @timestamp desc
| limit 20
```

### Calculate Average Processing Time

```
fields @timestamp, duration_ms
| filter event_type = "processing_completed"
| stats avg(duration_ms) as avg_duration
```

### Find Errors

```
fields @timestamp, job_id, error_message, error_category
| filter event_type = "error"
| sort @timestamp desc
```

## Step 6: Create CloudWatch Alarms

### High Error Rate Alarm

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name DocumentProcessing-HighErrorRate \
  --alarm-description "Alert when error rate exceeds threshold" \
  --metric-name ProcessingErrors \
  --namespace VaidyaLink/DocumentProcessing \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:alerts
```

### Low OCR Accuracy Alarm

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name DocumentProcessing-LowOCRAccuracy \
  --alarm-description "Alert when OCR accuracy drops" \
  --metric-name OCRAccuracy \
  --namespace VaidyaLink/DocumentProcessing \
  --statistic Average \
  --period 600 \
  --evaluation-periods 2 \
  --threshold 85 \
  --comparison-operator LessThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:alerts
```

## Step 7: Create CloudWatch Dashboard

Create a dashboard to visualize key metrics:

```bash
aws cloudwatch put-dashboard \
  --dashboard-name DocumentProcessing \
  --dashboard-body file://dashboard.json
```

**dashboard.json**:

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [["VaidyaLink/DocumentProcessing", "ProcessingLatency", { "stat": "Average" }]],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Processing Latency"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [["VaidyaLink/DocumentProcessing", "OCRAccuracy", { "stat": "Average" }]],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "OCR Accuracy"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [["VaidyaLink/DocumentProcessing", "DocumentsProcessed", { "stat": "Sum" }]],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Documents Processed"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [["VaidyaLink/DocumentProcessing", "ProcessingErrors", { "stat": "Sum" }]],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Processing Errors"
      }
    }
  ]
}
```

## Key Metrics to Monitor

### Performance Metrics

- **ProcessingLatency**: Track processing time for each operation
  - Target: < 30 seconds for OCR, < 45 seconds total
  - Alert if: > 45 seconds average

- **OCRAccuracy**: Monitor OCR confidence scores
  - Target: > 90% average
  - Alert if: < 85% average

### Quality Metrics

- **OverallConfidence**: Track extraction confidence
  - Target: > 85% average
  - Alert if: < 80% average

- **HITLRouting**: Monitor HITL routing rate
  - Target: < 20% of documents
  - Alert if: > 50% of documents

### Operational Metrics

- **ProcessingErrors**: Track error rates
  - Target: < 1% error rate
  - Alert if: > 5 errors in 5 minutes

- **DocumentsProcessed**: Monitor throughput
  - Track: Documents per minute
  - Alert if: Drops below expected rate

## Common Queries

### Top 10 Slowest Jobs

```
fields @timestamp, job_id, duration_ms
| filter event_type = "processing_completed"
| sort duration_ms desc
| limit 10
```

### Error Distribution by Category

```
fields error_category, error_severity
| filter event_type = "error"
| stats count() by error_category, error_severity
```

### HITL Routing Reasons

```
fields @timestamp, job_id, confidence, critical_fields_below_threshold
| filter event_type = "hitl_routing"
| sort @timestamp desc
```

### OCR Performance by Language

```
fields language, average_confidence
| filter event_type = "ocr_extraction"
| stats avg(average_confidence) by language
```

## Testing

### Test Metric Emission

```python
# Test script
import boto3
from cloudwatch_logger import CloudWatchMetrics

metrics = CloudWatchMetrics()

# Emit test metric
metrics.record_processing_latency(
    latency_ms=1500.0,
    operation='test',
    status='success'
)

# Flush
metrics.flush_metrics()

print("Test metric emitted successfully!")
```

### Verify Metrics in Console

1. Wait 1-2 minutes for metrics to appear
2. Navigate to CloudWatch → Metrics
3. Select namespace: VaidyaLink/DocumentProcessing
4. Verify test metric appears

## Troubleshooting

### Metrics Not Appearing

**Problem**: Metrics don't show up in CloudWatch

**Solutions**:

1. Check IAM permissions
2. Verify namespace spelling
3. Ensure `flush_metrics()` is called
4. Check Lambda logs for errors

### Logs Not Structured

**Problem**: Logs appear as plain text instead of JSON

**Solutions**:

1. Verify JsonFormatter is configured
2. Check LOG_LEVEL environment variable
3. Review Lambda handler initialization

### High Costs

**Problem**: CloudWatch costs are higher than expected

**Solutions**:

1. Reduce metric emission frequency
2. Adjust log retention period
3. Use metric filters instead of custom metrics
4. Review and optimize dimensions

## Next Steps

1. **Set up alarms** for critical metrics
2. **Create dashboards** for team visibility
3. **Configure SNS notifications** for alerts
4. **Review metrics weekly** to identify trends
5. **Optimize based on insights** from logs and metrics

## Additional Resources

- [Full Documentation](CLOUDWATCH_LOGGING_METRICS.md)
- [Error Handling Guide](ERROR_HANDLING.md)
- [AWS CloudWatch Best Practices](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Best_Practice_Recommended_Alarms_AWS_Services.html)
- [CloudWatch Logs Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)

## Support

For issues or questions:

1. Check Lambda logs in CloudWatch
2. Review error metrics and logs
3. Consult the full documentation
4. Contact the DevOps team
