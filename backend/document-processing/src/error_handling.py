"""
Error Handling and Retry Logic for Document Processing

This module provides comprehensive error handling, retry logic, and circuit breaker
patterns for the document processing pipeline.
"""

import time
import logging
from typing import Callable, Any, Optional, Dict, List, Type
from functools import wraps
from dataclasses import dataclass
from enum import Enum
from datetime import datetime, timedelta
import boto3
from botocore.exceptions import ClientError, BotoCoreError

logger = logging.getLogger(__name__)


class ErrorCategory(Enum):
    """Categories of errors for different handling strategies"""
    TRANSIENT = "transient"  # Temporary errors that can be retried
    PERMANENT = "permanent"  # Errors that won't succeed on retry
    THROTTLING = "throttling"  # Rate limiting errors
    RESOURCE = "resource"  # Resource not found or access denied
    VALIDATION = "validation"  # Input validation errors


class ErrorSeverity(Enum):
    """Severity levels for error reporting"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class RetryConfig:
    """Configuration for retry behavior"""
    max_attempts: int = 3
    initial_delay: float = 1.0  # seconds
    max_delay: float = 60.0  # seconds
    exponential_base: float = 2.0
    jitter: bool = True


@dataclass
class ErrorContext:
    """Context information for error handling"""
    job_id: str
    operation: str
    attempt: int
    error_category: ErrorCategory
    error_severity: ErrorSeverity
    error_message: str
    timestamp: str
    stack_trace: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class DocumentProcessingError(Exception):
    """Base exception for document processing errors"""
    def __init__(
        self,
        message: str,
        category: ErrorCategory = ErrorCategory.PERMANENT,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        metadata: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.category = category
        self.severity = severity
        self.metadata = metadata or {}


class OCRExtractionError(DocumentProcessingError):
    """Error during OCR text extraction"""
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            category=kwargs.get('category', ErrorCategory.TRANSIENT),
            severity=kwargs.get('severity', ErrorSeverity.HIGH),
            metadata=kwargs.get('metadata')
        )


class BedrockStructuringError(DocumentProcessingError):
    """Error during Bedrock clinical data structuring"""
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            category=kwargs.get('category', ErrorCategory.TRANSIENT),
            severity=kwargs.get('severity', ErrorSeverity.HIGH),
            metadata=kwargs.get('metadata')
        )


class S3OperationError(DocumentProcessingError):
    """Error during S3 operations"""
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            category=kwargs.get('category', ErrorCategory.TRANSIENT),
            severity=kwargs.get('severity', ErrorSeverity.MEDIUM),
            metadata=kwargs.get('metadata')
        )


class DynamoDBOperationError(DocumentProcessingError):
    """Error during DynamoDB operations"""
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            category=kwargs.get('category', ErrorCategory.TRANSIENT),
            severity=kwargs.get('severity', ErrorSeverity.MEDIUM),
            metadata=kwargs.get('metadata')
        )


class ValidationError(DocumentProcessingError):
    """Error during input validation"""
    def __init__(self, message: str, **kwargs):
        super().__init__(
            message,
            category=ErrorCategory.VALIDATION,
            severity=ErrorSeverity.LOW,
            metadata=kwargs.get('metadata')
        )


def categorize_aws_error(error: Exception) -> ErrorCategory:
    """
    Categorize AWS SDK errors for appropriate retry strategy.

    Args:
        error: Exception from AWS SDK

    Returns:
        ErrorCategory for the error
    """
    if isinstance(error, ClientError):
        error_code = error.response.get('Error', {}).get('Code', '')

        # Throttling errors
        if error_code in [
            'ThrottlingException',
            'ProvisionedThroughputExceededException',
            'RequestLimitExceeded',
            'TooManyRequestsException',
            'SlowDown'
        ]:
            return ErrorCategory.THROTTLING

        # Transient errors
        if error_code in [
            'ServiceUnavailable',
            'InternalError',
            'RequestTimeout',
            'RequestTimeoutException'
        ]:
            return ErrorCategory.TRANSIENT

        # Resource errors
        if error_code in [
            'NoSuchKey',
            'NoSuchBucket',
            'ResourceNotFoundException',
            'AccessDenied',
            'AccessDeniedException'
        ]:
            return ErrorCategory.RESOURCE

        # Validation errors
        if error_code in [
            'ValidationException',
            'InvalidParameterException',
            'InvalidParameterValue'
        ]:
            return ErrorCategory.VALIDATION

    # Default to transient for unknown errors
    return ErrorCategory.TRANSIENT


def calculate_backoff_delay(
    attempt: int,
    config: RetryConfig
) -> float:
    """
    Calculate exponential backoff delay with jitter.

    Args:
        attempt: Current attempt number (0-indexed)
        config: Retry configuration

    Returns:
        Delay in seconds
    """
    delay = min(
        config.initial_delay * (config.exponential_base ** attempt),
        config.max_delay
    )

    if config.jitter:
        import random
        delay = delay * (0.5 + random.random() * 0.5)

    return delay


def with_retry(
    config: Optional[RetryConfig] = None,
    retryable_exceptions: Optional[List[Type[Exception]]] = None,
    operation_name: str = "operation"
):
    """
    Decorator to add retry logic to functions.

    Args:
        config: Retry configuration
        retryable_exceptions: List of exception types to retry
        operation_name: Name of the operation for logging

    Returns:
        Decorated function with retry logic
    """
    if config is None:
        config = RetryConfig()

    if retryable_exceptions is None:
        retryable_exceptions = [
            ClientError,
            BotoCoreError,
            OCRExtractionError,
            BedrockStructuringError,
            S3OperationError,
            DynamoDBOperationError
        ]

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None

            for attempt in range(config.max_attempts):
                try:
                    return func(*args, **kwargs)

                except tuple(retryable_exceptions) as e:
                    last_exception = e

                    # Categorize the error
                    if isinstance(e, DocumentProcessingError):
                        category = e.category
                    elif isinstance(e, (ClientError, BotoCoreError)):
                        category = categorize_aws_error(e)
                    else:
                        category = ErrorCategory.TRANSIENT

                    # Don't retry permanent or validation errors
                    if category in [ErrorCategory.PERMANENT, ErrorCategory.VALIDATION]:
                        logger.error(
                            f"{operation_name} failed with non-retryable error: {str(e)}"
                        )
                        raise

                    # Check if we should retry
                    if attempt < config.max_attempts - 1:
                        delay = calculate_backoff_delay(attempt, config)

                        logger.warning(
                            f"{operation_name} failed (attempt {attempt + 1}/{config.max_attempts}): "
                            f"{str(e)}. Retrying in {delay:.2f}s..."
                        )

                        time.sleep(delay)
                    else:
                        logger.error(
                            f"{operation_name} failed after {config.max_attempts} attempts: {str(e)}"
                        )

            # All retries exhausted
            raise last_exception

        return wrapper
    return decorator


class CircuitBreaker:
    """
    Circuit breaker pattern to prevent cascading failures.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Too many failures, requests fail immediately
    - HALF_OPEN: Testing if service recovered
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: Type[Exception] = Exception
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception

        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = "CLOSED"

    def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection.

        Args:
            func: Function to execute
            *args: Positional arguments
            **kwargs: Keyword arguments

        Returns:
            Function result

        Raises:
            Exception: If circuit is open or function fails
        """
        if self.state == "OPEN":
            if self._should_attempt_reset():
                self.state = "HALF_OPEN"
                logger.info("Circuit breaker entering HALF_OPEN state")
            else:
                raise Exception(
                    f"Circuit breaker is OPEN. Service unavailable. "
                    f"Will retry after {self.recovery_timeout}s"
                )

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result

        except self.expected_exception as e:
            self._on_failure()
            raise

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self.last_failure_time is None:
            return True

        return (
            datetime.utcnow() - self.last_failure_time
        ).total_seconds() >= self.recovery_timeout

    def _on_success(self):
        """Handle successful call"""
        self.failure_count = 0
        if self.state == "HALF_OPEN":
            self.state = "CLOSED"
            logger.info("Circuit breaker reset to CLOSED state")

    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()

        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.error(
                f"Circuit breaker opened after {self.failure_count} failures"
            )


class ErrorReporter:
    """
    Centralized error reporting and metrics.
    """

    def __init__(self):
        self._cloudwatch = None
        self.namespace = 'VaidyaLink/DocumentProcessing'

    @property
    def cloudwatch(self):
        """Lazy initialization of CloudWatch client"""
        if self._cloudwatch is None:
            self._cloudwatch = boto3.client('cloudwatch')
        return self._cloudwatch

    def report_error(
        self,
        error_context: ErrorContext,
        emit_metric: bool = True
    ):
        """
        Report error with context and emit CloudWatch metrics.

        Args:
            error_context: Error context information
            emit_metric: Whether to emit CloudWatch metric
        """
        # Log error with full context
        log_message = (
            f"Error in {error_context.operation} "
            f"(job: {error_context.job_id}, attempt: {error_context.attempt}): "
            f"{error_context.error_message}"
        )

        if error_context.error_severity == ErrorSeverity.CRITICAL:
            logger.critical(log_message, extra={'context': error_context.__dict__})
        elif error_context.error_severity == ErrorSeverity.HIGH:
            logger.error(log_message, extra={'context': error_context.__dict__})
        elif error_context.error_severity == ErrorSeverity.MEDIUM:
            logger.warning(log_message, extra={'context': error_context.__dict__})
        else:
            logger.info(log_message, extra={'context': error_context.__dict__})

        # Emit CloudWatch metric
        if emit_metric:
            try:
                self.cloudwatch.put_metric_data(
                    Namespace=self.namespace,
                    MetricData=[
                        {
                            'MetricName': 'ProcessingErrors',
                            'Value': 1,
                            'Unit': 'Count',
                            'Timestamp': datetime.utcnow(),
                            'Dimensions': [
                                {
                                    'Name': 'Operation',
                                    'Value': error_context.operation
                                },
                                {
                                    'Name': 'ErrorCategory',
                                    'Value': error_context.error_category.value
                                },
                                {
                                    'Name': 'ErrorSeverity',
                                    'Value': error_context.error_severity.value
                                }
                            ]
                        }
                    ]
                )
            except Exception as e:
                logger.warning(f"Failed to emit error metric: {str(e)}")
