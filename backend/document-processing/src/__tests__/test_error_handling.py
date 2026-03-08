"""
Tests for error handling and retry logic
"""

import pytest
import time
from unittest.mock import Mock, patch, MagicMock
from botocore.exceptions import ClientError

from error_handling import (
    ErrorCategory,
    ErrorSeverity,
    RetryConfig,
    ErrorContext,
    DocumentProcessingError,
    OCRExtractionError,
    BedrockStructuringError,
    S3OperationError,
    DynamoDBOperationError,
    ValidationError,
    categorize_aws_error,
    calculate_backoff_delay,
    with_retry,
    CircuitBreaker,
    ErrorReporter
)


class TestErrorCategorization:
    """Test error categorization logic"""

    def test_categorize_throttling_error(self):
        """Test that throttling errors are correctly categorized"""
        error = ClientError(
            {'Error': {'Code': 'ThrottlingException', 'Message': 'Rate exceeded'}},
            'operation'
        )

        category = categorize_aws_error(error)
        assert category == ErrorCategory.THROTTLING

    def test_categorize_transient_error(self):
        """Test that transient errors are correctly categorized"""
        error = ClientError(
            {'Error': {'Code': 'ServiceUnavailable', 'Message': 'Service unavailable'}},
            'operation'
        )

        category = categorize_aws_error(error)
        assert category == ErrorCategory.TRANSIENT

    def test_categorize_resource_error(self):
        """Test that resource errors are correctly categorized"""
        error = ClientError(
            {'Error': {'Code': 'NoSuchKey', 'Message': 'Key not found'}},
            'operation'
        )

        category = categorize_aws_error(error)
        assert category == ErrorCategory.RESOURCE

    def test_categorize_validation_error(self):
        """Test that validation errors are correctly categorized"""
        error = ClientError(
            {'Error': {'Code': 'ValidationException', 'Message': 'Invalid input'}},
            'operation'
        )

        category = categorize_aws_error(error)
        assert category == ErrorCategory.VALIDATION

    def test_categorize_unknown_error(self):
        """Test that unknown errors default to transient"""
        error = ClientError(
            {'Error': {'Code': 'UnknownError', 'Message': 'Unknown'}},
            'operation'
        )

        category = categorize_aws_error(error)
        assert category == ErrorCategory.TRANSIENT


class TestBackoffCalculation:
    """Test exponential backoff calculation"""

    def test_initial_delay(self):
        """Test that initial delay is correct"""
        config = RetryConfig(initial_delay=1.0, exponential_base=2.0, jitter=False)
        delay = calculate_backoff_delay(0, config)
        assert delay == 1.0

    def test_exponential_growth(self):
        """Test that delay grows exponentially"""
        config = RetryConfig(initial_delay=1.0, exponential_base=2.0, jitter=False)

        delay1 = calculate_backoff_delay(0, config)
        delay2 = calculate_backoff_delay(1, config)
        delay3 = calculate_backoff_delay(2, config)

        assert delay1 == 1.0
        assert delay2 == 2.0
        assert delay3 == 4.0

    def test_max_delay_cap(self):
        """Test that delay is capped at max_delay"""
        config = RetryConfig(initial_delay=1.0, exponential_base=2.0, max_delay=5.0, jitter=False)

        delay = calculate_backoff_delay(10, config)
        assert delay == 5.0

    def test_jitter_adds_randomness(self):
        """Test that jitter adds randomness to delay"""
        config = RetryConfig(initial_delay=1.0, exponential_base=2.0, jitter=True)

        delays = [calculate_backoff_delay(1, config) for _ in range(10)]

        # All delays should be between 1.0 and 2.0 (50% to 100% of base delay)
        assert all(1.0 <= d <= 2.0 for d in delays)

        # Delays should not all be the same (randomness)
        assert len(set(delays)) > 1


class TestRetryDecorator:
    """Test retry decorator functionality"""

    def test_successful_execution_no_retry(self):
        """Test that successful execution doesn't retry"""
        mock_func = Mock(return_value="success")

        @with_retry(config=RetryConfig(max_attempts=3))
        def test_func():
            return mock_func()

        result = test_func()

        assert result == "success"
        assert mock_func.call_count == 1

    def test_retry_on_transient_error(self):
        """Test that transient errors trigger retry"""
        mock_func = Mock(side_effect=[
            OCRExtractionError("Transient error", category=ErrorCategory.TRANSIENT),
            "success"
        ])

        @with_retry(config=RetryConfig(max_attempts=3, initial_delay=0.01))
        def test_func():
            return mock_func()

        result = test_func()

        assert result == "success"
        assert mock_func.call_count == 2

    def test_no_retry_on_permanent_error(self):
        """Test that permanent errors don't retry"""
        mock_func = Mock(side_effect=OCRExtractionError(
            "Permanent error",
            category=ErrorCategory.PERMANENT
        ))

        @with_retry(config=RetryConfig(max_attempts=3))
        def test_func():
            return mock_func()

        with pytest.raises(OCRExtractionError):
            test_func()

        assert mock_func.call_count == 1

    def test_no_retry_on_validation_error(self):
        """Test that validation errors don't retry"""
        mock_func = Mock(side_effect=ValidationError("Invalid input"))

        @with_retry(config=RetryConfig(max_attempts=3))
        def test_func():
            return mock_func()

        with pytest.raises(ValidationError):
            test_func()

        assert mock_func.call_count == 1

    def test_max_attempts_exhausted(self):
        """Test that retries stop after max attempts"""
        mock_func = Mock(side_effect=OCRExtractionError(
            "Transient error",
            category=ErrorCategory.TRANSIENT
        ))

        @with_retry(config=RetryConfig(max_attempts=3, initial_delay=0.01))
        def test_func():
            return mock_func()

        with pytest.raises(OCRExtractionError):
            test_func()

        assert mock_func.call_count == 3

    def test_retry_with_aws_client_error(self):
        """Test retry with AWS ClientError"""
        mock_func = Mock(side_effect=[
            ClientError(
                {'Error': {'Code': 'ServiceUnavailable', 'Message': 'Service unavailable'}},
                'operation'
            ),
            "success"
        ])

        @with_retry(config=RetryConfig(max_attempts=3, initial_delay=0.01))
        def test_func():
            return mock_func()

        result = test_func()

        assert result == "success"
        assert mock_func.call_count == 2


class TestCircuitBreaker:
    """Test circuit breaker functionality"""

    def test_closed_state_allows_calls(self):
        """Test that closed circuit allows calls"""
        circuit_breaker = CircuitBreaker(failure_threshold=3)
        mock_func = Mock(return_value="success")

        result = circuit_breaker.call(mock_func)

        assert result == "success"
        assert circuit_breaker.state == "CLOSED"

    def test_opens_after_threshold_failures(self):
        """Test that circuit opens after threshold failures"""
        circuit_breaker = CircuitBreaker(failure_threshold=3)
        mock_func = Mock(side_effect=Exception("Error"))

        # Trigger failures up to threshold
        for _ in range(3):
            with pytest.raises(Exception):
                circuit_breaker.call(mock_func)

        assert circuit_breaker.state == "OPEN"

    def test_open_state_rejects_calls(self):
        """Test that open circuit rejects calls immediately"""
        circuit_breaker = CircuitBreaker(failure_threshold=2, recovery_timeout=60)
        mock_func = Mock(side_effect=Exception("Error"))

        # Open the circuit
        for _ in range(2):
            with pytest.raises(Exception):
                circuit_breaker.call(mock_func)

        assert circuit_breaker.state == "OPEN"

        # Next call should fail immediately without calling function
        with pytest.raises(Exception, match="Circuit breaker is OPEN"):
            circuit_breaker.call(mock_func)

        # Function should not have been called the third time
        assert mock_func.call_count == 2

    def test_half_open_after_recovery_timeout(self):
        """Test that circuit enters half-open state after timeout"""
        circuit_breaker = CircuitBreaker(failure_threshold=2, recovery_timeout=0.1)
        mock_func = Mock(side_effect=Exception("Error"))

        # Open the circuit
        for _ in range(2):
            with pytest.raises(Exception):
                circuit_breaker.call(mock_func)

        assert circuit_breaker.state == "OPEN"

        # Wait for recovery timeout
        time.sleep(0.2)

        # Next call should attempt (half-open)
        mock_func.side_effect = None
        mock_func.return_value = "success"

        result = circuit_breaker.call(mock_func)

        assert result == "success"
        assert circuit_breaker.state == "CLOSED"

    def test_resets_on_success_in_half_open(self):
        """Test that successful call in half-open resets circuit"""
        circuit_breaker = CircuitBreaker(failure_threshold=2, recovery_timeout=0.1)

        # Open the circuit
        mock_func = Mock(side_effect=Exception("Error"))
        for _ in range(2):
            with pytest.raises(Exception):
                circuit_breaker.call(mock_func)

        # Wait and succeed
        time.sleep(0.2)
        mock_func.side_effect = None
        mock_func.return_value = "success"

        circuit_breaker.call(mock_func)

        assert circuit_breaker.state == "CLOSED"
        assert circuit_breaker.failure_count == 0


class TestCustomExceptions:
    """Test custom exception classes"""

    def test_ocr_extraction_error(self):
        """Test OCRExtractionError initialization"""
        error = OCRExtractionError(
            "OCR failed",
            category=ErrorCategory.TRANSIENT,
            severity=ErrorSeverity.HIGH,
            metadata={'key': 'value'}
        )

        assert str(error) == "OCR failed"
        assert error.category == ErrorCategory.TRANSIENT
        assert error.severity == ErrorSeverity.HIGH
        assert error.metadata == {'key': 'value'}

    def test_bedrock_structuring_error(self):
        """Test BedrockStructuringError initialization"""
        error = BedrockStructuringError("Bedrock failed")

        assert str(error) == "Bedrock failed"
        assert error.category == ErrorCategory.TRANSIENT
        assert error.severity == ErrorSeverity.HIGH

    def test_s3_operation_error(self):
        """Test S3OperationError initialization"""
        error = S3OperationError("S3 failed")

        assert str(error) == "S3 failed"
        assert error.category == ErrorCategory.TRANSIENT
        assert error.severity == ErrorSeverity.MEDIUM

    def test_dynamodb_operation_error(self):
        """Test DynamoDBOperationError initialization"""
        error = DynamoDBOperationError("DynamoDB failed")

        assert str(error) == "DynamoDB failed"
        assert error.category == ErrorCategory.TRANSIENT
        assert error.severity == ErrorSeverity.MEDIUM

    def test_validation_error(self):
        """Test ValidationError initialization"""
        error = ValidationError("Invalid input")

        assert str(error) == "Invalid input"
        assert error.category == ErrorCategory.VALIDATION
        assert error.severity == ErrorSeverity.LOW


class TestErrorReporter:
    """Test error reporting functionality"""

    @patch('error_handling.boto3.client')
    def test_report_error_logs_message(self, mock_boto_client):
        """Test that error reporting logs messages"""
        reporter = ErrorReporter()

        error_context = ErrorContext(
            job_id='test-job',
            operation='test_operation',
            attempt=1,
            error_category=ErrorCategory.TRANSIENT,
            error_severity=ErrorSeverity.HIGH,
            error_message='Test error',
            timestamp='2024-01-01T00:00:00Z'
        )

        with patch('error_handling.logger') as mock_logger:
            reporter.report_error(error_context, emit_metric=False)

            mock_logger.error.assert_called_once()

    @patch('error_handling.boto3.client')
    def test_report_error_emits_metric(self, mock_boto_client):
        """Test that error reporting emits CloudWatch metrics"""
        mock_cloudwatch = MagicMock()
        mock_boto_client.return_value = mock_cloudwatch

        reporter = ErrorReporter()

        error_context = ErrorContext(
            job_id='test-job',
            operation='test_operation',
            attempt=1,
            error_category=ErrorCategory.TRANSIENT,
            error_severity=ErrorSeverity.HIGH,
            error_message='Test error',
            timestamp='2024-01-01T00:00:00Z'
        )

        reporter.report_error(error_context, emit_metric=True)

        mock_cloudwatch.put_metric_data.assert_called_once()

        call_args = mock_cloudwatch.put_metric_data.call_args
        assert call_args[1]['Namespace'] == 'VaidyaLink/DocumentProcessing'
        assert call_args[1]['MetricData'][0]['MetricName'] == 'ProcessingErrors'
        assert call_args[1]['MetricData'][0]['Value'] == 1

    @patch('error_handling.boto3.client')
    def test_report_critical_error_uses_critical_log(self, mock_boto_client):
        """Test that critical errors use critical log level"""
        reporter = ErrorReporter()

        error_context = ErrorContext(
            job_id='test-job',
            operation='test_operation',
            attempt=1,
            error_category=ErrorCategory.PERMANENT,
            error_severity=ErrorSeverity.CRITICAL,
            error_message='Critical error',
            timestamp='2024-01-01T00:00:00Z'
        )

        with patch('error_handling.logger') as mock_logger:
            reporter.report_error(error_context, emit_metric=False)

            mock_logger.critical.assert_called_once()


class TestRetryConfig:
    """Test RetryConfig dataclass"""

    def test_default_values(self):
        """Test that RetryConfig has correct defaults"""
        config = RetryConfig()

        assert config.max_attempts == 3
        assert config.initial_delay == 1.0
        assert config.max_delay == 60.0
        assert config.exponential_base == 2.0
        assert config.jitter is True

    def test_custom_values(self):
        """Test that RetryConfig accepts custom values"""
        config = RetryConfig(
            max_attempts=5,
            initial_delay=2.0,
            max_delay=120.0,
            exponential_base=3.0,
            jitter=False
        )

        assert config.max_attempts == 5
        assert config.initial_delay == 2.0
        assert config.max_delay == 120.0
        assert config.exponential_base == 3.0
        assert config.jitter is False
