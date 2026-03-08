# Error Handling Quick Start Guide

Get started with error handling and retry logic in the document processing Lambda.

## Quick Overview

The error handling system provides:

- ✅ Automatic retries with exponential backoff
- ✅ Circuit breaker protection for external services
- ✅ Intelligent error categorization
- ✅ CloudWatch metrics and logging
- ✅ Custom exception types

## 5-Minute Setup

### 1. Import Error Handling Components

```python
from error_handling import (
    with_retry,
    RetryConfig,
    CircuitBreaker,
    ErrorReporter,
    ErrorContext,
    ErrorCategory,
    ErrorSeverity,
    OCRExtractionError,
    BedrockStructuringError,
    S3OperationError,
    DynamoDBOperationError,
    ValidationError
)
```

### 2. Add Retry to Functions

```python
@with_retry(
    config=RetryConfig(max_attempts=3, initial_delay=1.0),
    operation_name="my_operation"
)
def my_function():
    # Your code here
    pass
```

### 3. Use Circuit Breakers

```python
# Initialize circuit breaker
bedrock_circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=60
)

# Use it
result = bedrock_circuit_breaker.call(
    bedrock_function,
    arg1,
    arg2
)
```

### 4. Raise Custom Exceptions

```python
# Instead of generic exceptions
raise Exception("OCR failed")

# Use specific error types
raise OCRExtractionError(
    "Failed to extract text from image",
    category=ErrorCategory.TRANSIENT,
    severity=ErrorSeverity.HIGH,
    metadata={'bucket': bucket, 'key': key}
)
```

### 5. Report Errors

```python
error_reporter = ErrorReporter()

error_context = ErrorContext(
    job_id='job-123',
    operation='extract_text',
    attempt=1,
    error_category=ErrorCategory.TRANSIENT,
    error_severity=ErrorSeverity.HIGH,
    error_message='OCR extraction failed',
    timestamp=datetime.utcnow().isoformat()
)

error_reporter.report_error(error_context)
```

## Common Patterns

### Pattern 1: Retry S3 Operations

```python
@with_retry(
    config=RetryConfig(max_attempts=3, initial_delay=0.5, max_delay=10.0),
    operation_name="download_from_s3"
)
def download_from_s3(bucket: str, key: str):
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        return response['Body'].read()
    except ClientError as e:
        raise S3OperationError(
            f"Failed to download: {e.response['Error']['Code']}",
            category=categorize_aws_error(e),
            metadata={'bucket': bucket, 'key': key}
        )
```

### Pattern 2: Protect External API Calls

```python
# Initialize circuit breaker
api_circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=60,
    expected_exception=BedrockStructuringError
)

# Use it
def call_bedrock_api(text: str):
    try:
        return api_circuit_breaker.call(
            bedrock_client.invoke_model,
            modelId=model_id,
            body=json.dumps({'text': text})
        )
    except Exception as e:
        raise BedrockStructuringError(
            f"Bedrock API call failed: {str(e)}",
            category=ErrorCategory.TRANSIENT
        )
```

### Pattern 3: Handle Validation Errors

```python
def validate_input(event: dict):
    if 'jobId' not in event:
        raise ValidationError(
            "jobId is required",
            metadata={'event_keys': list(event.keys())}
        )

    if not event['jobId']:
        raise ValidationError(
            "jobId cannot be empty",
            metadata={'job_id': event['jobId']}
        )
```

### Pattern 4: Comprehensive Error Handling

```python
def process_document(job_id: str):
    attempt = 0
    max_attempts = 3

    while attempt < max_attempts:
        try:
            attempt += 1

            # Your processing logic
            result = do_processing(job_id)
            return result

        except (OCRExtractionError, BedrockStructuringError) as e:
            # Report error
            error_context = ErrorContext(
                job_id=job_id,
                operation='process_document',
                attempt=attempt,
                error_category=e.category,
                error_severity=e.severity,
                error_message=str(e),
                timestamp=datetime.utcnow().isoformat()
            )
            error_reporter.report_error(error_context)

            # Don't retry permanent errors
            if e.category == ErrorCategory.PERMANENT:
                raise

            # Retry with backoff
            if attempt < max_attempts:
                delay = calculate_backoff_delay(attempt - 1, RetryConfig())
                time.sleep(delay)
            else:
                raise
```

## Error Types Cheat Sheet

| Error Type                | When to Use        | Category   | Severity |
| ------------------------- | ------------------ | ---------- | -------- |
| `OCRExtractionError`      | OCR fails          | TRANSIENT  | HIGH     |
| `BedrockStructuringError` | Bedrock fails      | TRANSIENT  | HIGH     |
| `S3OperationError`        | S3 operation fails | TRANSIENT  | MEDIUM   |
| `DynamoDBOperationError`  | DynamoDB fails     | TRANSIENT  | MEDIUM   |
| `ValidationError`         | Invalid input      | VALIDATION | LOW      |

## Retry Configuration Guide

### Fast Operations (< 1 second)

```python
RetryConfig(
    max_attempts=3,
    initial_delay=0.5,
    max_delay=10.0
)
```

### Medium Operations (1-5 seconds)

```python
RetryConfig(
    max_attempts=3,
    initial_delay=1.0,
    max_delay=30.0
)
```

### Slow Operations (> 5 seconds)

```python
RetryConfig(
    max_attempts=3,
    initial_delay=2.0,
    max_delay=60.0
)
```

## Testing Your Error Handling

### Test Retry Logic

```python
def test_retry_on_transient_error():
    mock_func = Mock(side_effect=[
        OCRExtractionError("Transient", category=ErrorCategory.TRANSIENT),
        "success"
    ])

    @with_retry(config=RetryConfig(max_attempts=3, initial_delay=0.01))
    def test_func():
        return mock_func()

    result = test_func()
    assert result == "success"
    assert mock_func.call_count == 2
```

### Test Circuit Breaker

```python
def test_circuit_breaker_opens():
    circuit_breaker = CircuitBreaker(failure_threshold=3)
    mock_func = Mock(side_effect=Exception("Error"))

    # Trigger failures
    for _ in range(3):
        with pytest.raises(Exception):
            circuit_breaker.call(mock_func)

    assert circuit_breaker.state == "OPEN"
```

## Monitoring

### View Errors in CloudWatch

1. Go to CloudWatch Console
2. Navigate to Metrics → VaidyaLink/DocumentProcessing
3. View `ProcessingErrors` metric
4. Filter by dimensions:
   - Operation
   - ErrorCategory
   - ErrorSeverity

### CloudWatch Logs Insights Query

```
fields @timestamp, job_id, operation, error_message, error_category
| filter error_severity = "high" or error_severity = "critical"
| sort @timestamp desc
| limit 50
```

## Troubleshooting

### Problem: Function times out

**Cause**: Too many retry attempts

**Solution**: Reduce max_attempts or max_delay

```python
RetryConfig(max_attempts=2, max_delay=10.0)
```

### Problem: Circuit breaker always open

**Cause**: External service is down or threshold too low

**Solution**:

1. Check external service health
2. Increase failure_threshold

```python
CircuitBreaker(failure_threshold=10)
```

### Problem: Errors not in CloudWatch

**Cause**: Missing IAM permissions

**Solution**: Add CloudWatch PutMetricData permission to Lambda role

## Next Steps

1. Read the full [Error Handling Documentation](./ERROR_HANDLING.md)
2. Review [test examples](./src/__tests__/test_error_handling.py)
3. Set up CloudWatch alarms for critical errors
4. Implement error handling in your Lambda functions

## Need Help?

- Check the [full documentation](./ERROR_HANDLING.md)
- Review [test cases](./src/__tests__/test_error_handling.py)
- Look at [implementation examples](./src/index.py)
