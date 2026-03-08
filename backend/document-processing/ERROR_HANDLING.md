# Error Handling and Retry Logic

This document describes the comprehensive error handling and retry logic implemented in the document processing Lambda.

## Overview

The error handling system provides:

- **Automatic retry logic** with exponential backoff
- **Circuit breaker pattern** to prevent cascading failures
- **Error categorization** for intelligent retry decisions
- **Centralized error reporting** with CloudWatch metrics
- **Custom exception hierarchy** for different error types

## Error Categories

Errors are categorized to determine the appropriate handling strategy:

### ErrorCategory.TRANSIENT

Temporary errors that can be retried:

- Network timeouts
- Service unavailable errors
- Temporary resource exhaustion

**Strategy**: Retry with exponential backoff

### ErrorCategory.THROTTLING

Rate limiting errors:

- ThrottlingException
- ProvisionedThroughputExceededException
- TooManyRequestsException

**Strategy**: Retry with longer backoff delays

### ErrorCategory.PERMANENT

Errors that won't succeed on retry:

- Invalid input data
- Missing required fields
- Unsupported file formats

**Strategy**: Fail immediately, no retry

### ErrorCategory.RESOURCE

Resource not found or access denied:

- NoSuchKey
- NoSuchBucket
- AccessDenied

**Strategy**: Fail immediately, no retry

### ErrorCategory.VALIDATION

Input validation errors:

- ValidationException
- InvalidParameterException

**Strategy**: Fail immediately, no retry

## Custom Exceptions

### DocumentProcessingError

Base exception for all document processing errors.

```python
raise DocumentProcessingError(
    "Error message",
    category=ErrorCategory.TRANSIENT,
    severity=ErrorSeverity.HIGH,
    metadata={'key': 'value'}
)
```

### OCRExtractionError

Raised when OCR text extraction fails.

```python
raise OCRExtractionError(
    "Failed to extract text from image",
    category=ErrorCategory.TRANSIENT,
    severity=ErrorSeverity.HIGH,
    metadata={'bucket': bucket, 'key': key}
)
```

### BedrockStructuringError

Raised when Bedrock clinical data structuring fails.

```python
raise BedrockStructuringError(
    "Failed to structure clinical data",
    category=ErrorCategory.TRANSIENT,
    severity=ErrorSeverity.HIGH
)
```

### S3OperationError

Raised when S3 operations fail.

```python
raise S3OperationError(
    "Failed to download image from S3",
    category=ErrorCategory.TRANSIENT,
    severity=ErrorSeverity.MEDIUM,
    metadata={'bucket': bucket, 'key': key}
)
```

### DynamoDBOperationError

Raised when DynamoDB operations fail.

```python
raise DynamoDBOperationError(
    "Failed to update job status",
    category=ErrorCategory.TRANSIENT,
    severity=ErrorSeverity.MEDIUM,
    metadata={'job_id': job_id}
)
```

### ValidationError

Raised when input validation fails.

```python
raise ValidationError(
    "jobId is required",
    metadata={'event': event}
)
```

## Retry Decorator

The `@with_retry` decorator adds automatic retry logic to functions.

### Basic Usage

```python
from error_handling import with_retry, RetryConfig

@with_retry(
    config=RetryConfig(max_attempts=3, initial_delay=1.0),
    operation_name="my_operation"
)
def my_function():
    # Function code
    pass
```

### Configuration Options

```python
RetryConfig(
    max_attempts=3,        # Maximum number of retry attempts
    initial_delay=1.0,     # Initial delay in seconds
    max_delay=60.0,        # Maximum delay in seconds
    exponential_base=2.0,  # Base for exponential backoff
    jitter=True            # Add randomness to delays
)
```

### Retry Behavior

1. **Successful execution**: Returns immediately, no retry
2. **Transient error**: Retries with exponential backoff
3. **Permanent error**: Fails immediately, no retry
4. **Max attempts reached**: Raises the last exception

### Exponential Backoff

Delays between retries grow exponentially:

- Attempt 1: 1.0s
- Attempt 2: 2.0s
- Attempt 3: 4.0s
- Attempt 4: 8.0s (capped at max_delay)

With jitter enabled, delays are randomized between 50% and 100% of the calculated value.

## Circuit Breaker

The circuit breaker pattern prevents cascading failures by temporarily blocking requests to failing services.

### States

1. **CLOSED**: Normal operation, requests pass through
2. **OPEN**: Too many failures, requests fail immediately
3. **HALF_OPEN**: Testing if service recovered

### Usage

```python
from error_handling import CircuitBreaker, BedrockStructuringError

bedrock_circuit_breaker = CircuitBreaker(
    failure_threshold=5,      # Open after 5 failures
    recovery_timeout=60,      # Try recovery after 60s
    expected_exception=BedrockStructuringError
)

# Use circuit breaker
result = bedrock_circuit_breaker.call(
    bedrock_function,
    arg1,
    arg2
)
```

### Behavior

1. **CLOSED state**: Calls pass through normally
2. **After 5 failures**: Circuit opens
3. **OPEN state**: Calls fail immediately for 60 seconds
4. **After timeout**: Circuit enters HALF_OPEN
5. **Successful call**: Circuit closes
6. **Failed call**: Circuit reopens

## Error Reporting

The `ErrorReporter` class provides centralized error reporting with CloudWatch metrics.

### Usage

```python
from error_handling import ErrorReporter, ErrorContext, ErrorCategory, ErrorSeverity

error_reporter = ErrorReporter()

error_context = ErrorContext(
    job_id='job-123',
    operation='extract_text',
    attempt=1,
    error_category=ErrorCategory.TRANSIENT,
    error_severity=ErrorSeverity.HIGH,
    error_message='OCR extraction failed',
    timestamp=datetime.utcnow().isoformat(),
    metadata={'bucket': 'my-bucket', 'key': 'my-key'}
)

error_reporter.report_error(error_context, emit_metric=True)
```

### CloudWatch Metrics

Errors are reported to CloudWatch with the following dimensions:

- **Namespace**: `VaidyaLink/DocumentProcessing`
- **MetricName**: `ProcessingErrors`
- **Dimensions**:
  - `Operation`: Function or operation name
  - `ErrorCategory`: Error category (transient, permanent, etc.)
  - `ErrorSeverity`: Error severity (low, medium, high, critical)

### Log Levels

Errors are logged at different levels based on severity:

- **CRITICAL**: ErrorSeverity.CRITICAL
- **ERROR**: ErrorSeverity.HIGH
- **WARNING**: ErrorSeverity.MEDIUM
- **INFO**: ErrorSeverity.LOW

## Implementation in Document Processing

### Main Handler

The main handler catches all exceptions and returns appropriate HTTP status codes:

```python
def handler(event, context):
    try:
        # Process event
        pass
    except ValidationError as e:
        return {'statusCode': 400, 'body': json.dumps({'error': str(e)})}
    except Exception as e:
        error_reporter.report_error(error_context)
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
```

### Process Document Pipeline

The document processing pipeline implements retry logic at multiple levels:

1. **Overall pipeline**: Manual retry loop with backoff
2. **OCR extraction**: `@with_retry` decorator + circuit breaker for S3
3. **Bedrock structuring**: Circuit breaker protection
4. **S3 operations**: `@with_retry` decorator + circuit breaker
5. **DynamoDB operations**: `@with_retry` decorator

### Error Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Error Occurs                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Categorize Error (AWS or Custom)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────┴─────────┐
                    │                   │
         ┌──────────▼──────────┐  ┌────▼────────────┐
         │  Permanent/         │  │   Transient/    │
         │  Validation         │  │   Throttling    │
         └──────────┬──────────┘  └────┬────────────┘
                    │                   │
                    ▼                   ▼
         ┌──────────────────┐  ┌────────────────────┐
         │  Fail Immediately│  │  Retry with Backoff│
         │  Report Error    │  │  Report Error      │
         └──────────────────┘  └────────────────────┘
```

## Best Practices

### 1. Use Appropriate Error Types

```python
# Good
raise OCRExtractionError("Failed to extract text", category=ErrorCategory.TRANSIENT)

# Bad
raise Exception("Failed to extract text")
```

### 2. Include Metadata

```python
# Good
raise S3OperationError(
    "Failed to download image",
    metadata={'bucket': bucket, 'key': key, 'job_id': job_id}
)

# Bad
raise S3OperationError("Failed to download image")
```

### 3. Set Appropriate Severity

```python
# Critical: System-wide failure
raise DocumentProcessingError("Database connection lost", severity=ErrorSeverity.CRITICAL)

# High: Job failure
raise OCRExtractionError("OCR failed", severity=ErrorSeverity.HIGH)

# Medium: Recoverable issue
raise S3OperationError("S3 timeout", severity=ErrorSeverity.MEDIUM)

# Low: Minor issue
raise ValidationError("Optional field missing", severity=ErrorSeverity.LOW)
```

### 4. Use Circuit Breakers for External Services

```python
# Good - protects against cascading failures
result = bedrock_circuit_breaker.call(bedrock_function, args)

# Bad - no protection
result = bedrock_function(args)
```

### 5. Configure Retry Appropriately

```python
# Fast operations - short delays
@with_retry(config=RetryConfig(max_attempts=3, initial_delay=0.5, max_delay=10.0))
def quick_operation():
    pass

# Slow operations - longer delays
@with_retry(config=RetryConfig(max_attempts=3, initial_delay=2.0, max_delay=60.0))
def slow_operation():
    pass
```

## Monitoring and Alerting

### CloudWatch Metrics

Monitor these metrics in CloudWatch:

- `ProcessingErrors` by `Operation`
- `ProcessingErrors` by `ErrorCategory`
- `ProcessingErrors` by `ErrorSeverity`

### Recommended Alarms

1. **High Error Rate**
   - Metric: `ProcessingErrors`
   - Threshold: > 10 errors in 5 minutes
   - Action: Alert on-call engineer

2. **Critical Errors**
   - Metric: `ProcessingErrors` where `ErrorSeverity=critical`
   - Threshold: > 1 error in 5 minutes
   - Action: Page on-call engineer

3. **Circuit Breaker Open**
   - Log pattern: "Circuit breaker opened"
   - Action: Alert DevOps team

### CloudWatch Logs Insights Queries

**Error rate by operation:**

```
fields @timestamp, operation, error_message
| filter error_category = "transient"
| stats count() by operation
| sort count desc
```

**Recent critical errors:**

```
fields @timestamp, job_id, operation, error_message
| filter error_severity = "critical"
| sort @timestamp desc
| limit 20
```

## Testing

Run the error handling tests:

```bash
cd backend/document-processing
pytest src/__tests__/test_error_handling.py -v
```

### Test Coverage

- Error categorization
- Exponential backoff calculation
- Retry decorator behavior
- Circuit breaker state transitions
- Custom exception initialization
- Error reporting and metrics

## Troubleshooting

### Issue: Too many retries

**Symptom**: Lambda timeout due to excessive retries

**Solution**: Reduce `max_attempts` or `max_delay` in RetryConfig

### Issue: Circuit breaker stuck open

**Symptom**: All requests failing with "Circuit breaker is OPEN"

**Solution**:

1. Check if external service is healthy
2. Increase `recovery_timeout`
3. Reduce `failure_threshold`

### Issue: Errors not being reported

**Symptom**: No CloudWatch metrics for errors

**Solution**:

1. Check IAM permissions for CloudWatch PutMetricData
2. Verify `emit_metric=True` in error_reporter.report_error()
3. Check CloudWatch Logs for metric emission errors

## Future Enhancements

1. **Dead Letter Queue Integration**: Automatically send failed jobs to DLQ
2. **Adaptive Retry**: Adjust retry strategy based on error patterns
3. **Distributed Tracing**: Integrate with AWS X-Ray for end-to-end tracing
4. **Error Aggregation**: Group similar errors for better visibility
5. **Auto-Recovery**: Automatically trigger recovery actions for known errors
