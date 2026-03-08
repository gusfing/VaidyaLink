# Error Handling Quick Reference Card

## Import Statement

```python
from error_handling import (
    with_retry, RetryConfig, CircuitBreaker, ErrorReporter,
    ErrorContext, ErrorCategory, ErrorSeverity,
    OCRExtractionError, BedrockStructuringError,
    S3OperationError, DynamoDBOperationError, ValidationError,
    categorize_aws_error, calculate_backoff_delay
)
```

## Error Categories

| Category     | Description                                     | Retry?                |
| ------------ | ----------------------------------------------- | --------------------- |
| `TRANSIENT`  | Temporary errors (network, service unavailable) | ✅ Yes                |
| `THROTTLING` | Rate limiting errors                            | ✅ Yes (longer delay) |
| `PERMANENT`  | Won't succeed on retry (invalid data)           | ❌ No                 |
| `RESOURCE`   | Not found, access denied                        | ❌ No                 |
| `VALIDATION` | Invalid input                                   | ❌ No                 |

## Error Severities

| Severity   | When to Use                   | Log Level |
| ---------- | ----------------------------- | --------- |
| `LOW`      | Minor issues, optional fields | INFO      |
| `MEDIUM`   | Recoverable issues            | WARNING   |
| `HIGH`     | Job failures                  | ERROR     |
| `CRITICAL` | System-wide failures          | CRITICAL  |

## Custom Exceptions

```python
# OCR errors
raise OCRExtractionError("message", category=ErrorCategory.TRANSIENT, severity=ErrorSeverity.HIGH)

# Bedrock errors
raise BedrockStructuringError("message", category=ErrorCategory.TRANSIENT, severity=ErrorSeverity.HIGH)

# S3 errors
raise S3OperationError("message", category=ErrorCategory.TRANSIENT, severity=ErrorSeverity.MEDIUM)

# DynamoDB errors
raise DynamoDBOperationError("message", category=ErrorCategory.TRANSIENT, severity=ErrorSeverity.MEDIUM)

# Validation errors
raise ValidationError("message", metadata={'field': 'value'})
```

## Retry Decorator

```python
# Basic usage
@with_retry(config=RetryConfig(max_attempts=3))
def my_function():
    pass

# Custom configuration
@with_retry(
    config=RetryConfig(
        max_attempts=5,
        initial_delay=2.0,
        max_delay=60.0,
        exponential_base=2.0,
        jitter=True
    ),
    operation_name="my_operation"
)
def my_function():
    pass
```

## Circuit Breaker

```python
# Initialize
circuit_breaker = CircuitBreaker(
    failure_threshold=5,      # Open after 5 failures
    recovery_timeout=60,      # Try recovery after 60s
    expected_exception=Error
)

# Use
result = circuit_breaker.call(function, arg1, arg2)
```

## Error Reporter

```python
# Initialize
error_reporter = ErrorReporter()

# Report error
error_context = ErrorContext(
    job_id='job-123',
    operation='operation_name',
    attempt=1,
    error_category=ErrorCategory.TRANSIENT,
    error_severity=ErrorSeverity.HIGH,
    error_message='Error message',
    timestamp=datetime.utcnow().isoformat(),
    metadata={'key': 'value'}
)

error_reporter.report_error(error_context, emit_metric=True)
```

## Retry Configurations

### Fast Operations (< 1s)

```python
RetryConfig(max_attempts=3, initial_delay=0.5, max_delay=10.0)
```

### Medium Operations (1-5s)

```python
RetryConfig(max_attempts=3, initial_delay=1.0, max_delay=30.0)
```

### Slow Operations (> 5s)

```python
RetryConfig(max_attempts=3, initial_delay=2.0, max_delay=60.0)
```

## AWS Error Categorization

```python
from botocore.exceptions import ClientError

try:
    # AWS operation
    pass
except ClientError as e:
    category = categorize_aws_error(e)
    # Returns appropriate ErrorCategory
```

## Common Patterns

### S3 Download with Retry

```python
@with_retry(config=RetryConfig(max_attempts=3, initial_delay=0.5))
def download_from_s3(bucket: str, key: str):
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        return response['Body'].read()
    except ClientError as e:
        raise S3OperationError(
            f"Download failed: {e.response['Error']['Code']}",
            category=categorize_aws_error(e),
            metadata={'bucket': bucket, 'key': key}
        )
```

### External API with Circuit Breaker

```python
api_circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60)

def call_external_api(data):
    try:
        return api_circuit_breaker.call(api_function, data)
    except Exception as e:
        raise BedrockStructuringError(
            f"API call failed: {str(e)}",
            category=ErrorCategory.TRANSIENT
        )
```

### Manual Retry Loop

```python
def process_with_retry(job_id: str):
    attempt = 0
    max_attempts = 3

    while attempt < max_attempts:
        try:
            attempt += 1
            return do_processing(job_id)
        except TransientError as e:
            if attempt >= max_attempts:
                raise
            delay = calculate_backoff_delay(attempt - 1, RetryConfig())
            time.sleep(delay)
```

## CloudWatch Metrics

**Namespace**: `VaidyaLink/DocumentProcessing`
**Metric**: `ProcessingErrors`
**Dimensions**: Operation, ErrorCategory, ErrorSeverity

## CloudWatch Logs Insights

### Error rate by operation

```
fields @timestamp, operation, error_message
| filter error_category = "transient"
| stats count() by operation
| sort count desc
```

### Recent critical errors

```
fields @timestamp, job_id, operation, error_message
| filter error_severity = "critical"
| sort @timestamp desc
| limit 20
```

## Testing

```bash
# Run error handling tests
pytest src/__tests__/test_error_handling.py -v

# Run specific test
pytest src/__tests__/test_error_handling.py::TestRetryDecorator::test_retry_on_transient_error -v
```

## Troubleshooting

| Problem                    | Solution                                          |
| -------------------------- | ------------------------------------------------- |
| Too many retries           | Reduce `max_attempts` or `max_delay`              |
| Circuit breaker stuck open | Check service health, increase `recovery_timeout` |
| No CloudWatch metrics      | Check IAM permissions for PutMetricData           |
| Lambda timeout             | Reduce retry attempts or delays                   |

## Best Practices

1. ✅ Use specific error types (not generic Exception)
2. ✅ Include metadata in exceptions
3. ✅ Set appropriate severity levels
4. ✅ Use circuit breakers for external services
5. ✅ Configure retry based on operation speed
6. ✅ Report errors with full context
7. ✅ Monitor CloudWatch metrics
8. ✅ Set up alarms for critical errors

## Documentation

- **Full Guide**: [ERROR_HANDLING.md](./ERROR_HANDLING.md)
- **Quick Start**: [ERROR_HANDLING_QUICK_START.md](./ERROR_HANDLING_QUICK_START.md)
- **Tests**: [src/**tests**/test_error_handling.py](./src/__tests__/test_error_handling.py)
- **Implementation**: [src/index.py](./src/index.py)
