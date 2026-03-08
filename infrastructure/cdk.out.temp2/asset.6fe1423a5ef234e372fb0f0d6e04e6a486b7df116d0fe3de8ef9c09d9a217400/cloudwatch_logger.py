"""
CloudWatch Logging and Metrics for Document Processing Lambda

This module provides structured logging and custom CloudWatch metrics
for monitoring document processing operations.
"""

import json
import logging
import os
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
from functools import wraps
from contextlib import contextmanager

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class CloudWatchMetrics:
    """
    CloudWatch custom metrics emitter for document processing.

    Tracks:
    - Processing latency
    - OCR accuracy
    - Confidence scores
    - Error rates
    - HITL routing rates
    """

    def __init__(
        self,
        namespace: str = 'VaidyaLink/DocumentProcessing',
        region: Optional[str] = None
    ):
        """
        Initialize CloudWatch metrics emitter.

        Args:
            namespace: CloudWatch namespace for metrics
            region: AWS region (defaults to env var or us-east-1)
        """
        self.namespace = namespace
        self.region = region or os.environ.get('AWS_REGION', 'us-east-1')

        # Initialize CloudWatch client (lazy)
        self._cloudwatch = None

        # Metric buffer for batch sending
        self.metric_buffer: List[Dict[str, Any]] = []
        self.buffer_size = 20  # CloudWatch limit is 20 metrics per request

        logger.info(f"Initialized CloudWatchMetrics with namespace: {namespace}")

    @property
    def cloudwatch(self):
        """Lazy initialization of CloudWatch client."""
        if self._cloudwatch is None:
            self._cloudwatch = boto3.client('cloudwatch', region_name=self.region)
        return self._cloudwatch

    def put_metric(
        self,
        metric_name: str,
        value: float,
        unit: str = 'None',
        dimensions: Optional[List[Dict[str, str]]] = None,
        timestamp: Optional[datetime] = None
    ):
        """
        Put a single metric to CloudWatch.

        Args:
            metric_name: Name of the metric
            value: Metric value
            unit: Unit of measurement
            dimensions: List of dimension dicts with Name and Value keys
            timestamp: Metric timestamp (defaults to now)
        """
        try:
            metric_data = {
                'MetricName': metric_name,
                'Value': value,
                'Unit': unit,
                'Timestamp': timestamp or datetime.utcnow()
            }

            if dimensions:
                metric_data['Dimensions'] = dimensions

            # Add to buffer
            self.metric_buffer.append(metric_data)

            # Flush if buffer is full
            if len(self.metric_buffer) >= self.buffer_size:
                self.flush_metrics()

        except Exception as e:
            logger.warning(f"Failed to buffer metric {metric_name}: {str(e)}")

    def flush_metrics(self):
        """Flush buffered metrics to CloudWatch."""
        if not self.metric_buffer:
            return

        try:
            self.cloudwatch.put_metric_data(
                Namespace=self.namespace,
                MetricData=self.metric_buffer
            )

            logger.debug(f"Flushed {len(self.metric_buffer)} metrics to CloudWatch")
            self.metric_buffer = []

        except ClientError as e:
            logger.error(f"Failed to flush metrics to CloudWatch: {e.response['Error']['Message']}")
            # Clear buffer to prevent memory buildup
            self.metric_buffer = []
        except Exception as e:
            logger.error(f"Unexpected error flushing metrics: {str(e)}")
            self.metric_buffer = []

    def record_processing_latency(
        self,
        latency_ms: float,
        operation: str,
        status: str = 'success'
    ):
        """
        Record processing latency metric.

        Args:
            latency_ms: Latency in milliseconds
            operation: Operation name (e.g., 'ocr', 'bedrock', 'total')
            status: Operation status (success/failure)
        """
        self.put_metric(
            metric_name='ProcessingLatency',
            value=latency_ms,
            unit='Milliseconds',
            dimensions=[
                {'Name': 'Operation', 'Value': operation},
                {'Name': 'Status', 'Value': status}
            ]
        )

    def record_ocr_accuracy(
        self,
        confidence: float,
        language: str = 'en'
    ):
        """
        Record OCR accuracy metric.

        Args:
            confidence: OCR confidence score (0.0 to 1.0)
            language: Language code
        """
        self.put_metric(
            metric_name='OCRAccuracy',
            value=confidence * 100,  # Convert to percentage
            unit='Percent',
            dimensions=[
                {'Name': 'Language', 'Value': language}
            ]
        )

    def record_confidence_score(
        self,
        overall_confidence: float,
        ocr_confidence: float,
        extraction_confidence: float,
        validation_confidence: float
    ):
        """
        Record confidence scores.

        Args:
            overall_confidence: Overall confidence score
            ocr_confidence: OCR component confidence
            extraction_confidence: Extraction component confidence
            validation_confidence: Validation component confidence
        """
        # Overall confidence
        self.put_metric(
            metric_name='OverallConfidence',
            value=overall_confidence * 100,
            unit='Percent'
        )

        # Component confidences
        for component, confidence in [
            ('OCR', ocr_confidence),
            ('Extraction', extraction_confidence),
            ('Validation', validation_confidence)
        ]:
            self.put_metric(
                metric_name='ComponentConfidence',
                value=confidence * 100,
                unit='Percent',
                dimensions=[
                    {'Name': 'Component', 'Value': component}
                ]
            )

    def record_hitl_routing(
        self,
        routed: bool,
        reason: str = 'low_confidence'
    ):
        """
        Record HITL routing event.

        Args:
            routed: Whether job was routed to HITL
            reason: Routing reason
        """
        self.put_metric(
            metric_name='HITLRouting',
            value=1 if routed else 0,
            unit='Count',
            dimensions=[
                {'Name': 'Routed', 'Value': 'true' if routed else 'false'},
                {'Name': 'Reason', 'Value': reason}
            ]
        )

    def record_error(
        self,
        error_category: str,
        error_severity: str,
        operation: str
    ):
        """
        Record error metric.

        Args:
            error_category: Error category (transient/permanent/throttling/etc)
            error_severity: Error severity (low/medium/high/critical)
            operation: Operation where error occurred
        """
        self.put_metric(
            metric_name='ProcessingErrors',
            value=1,
            unit='Count',
            dimensions=[
                {'Name': 'ErrorCategory', 'Value': error_category},
                {'Name': 'ErrorSeverity', 'Value': error_severity},
                {'Name': 'Operation', 'Value': operation}
            ]
        )

    def record_document_processed(
        self,
        document_type: str = 'unknown',
        status: str = 'completed'
    ):
        """
        Record document processing completion.

        Args:
            document_type: Type of document (prescription/lab_report/etc)
            status: Processing status (completed/failed/hitl_required)
        """
        self.put_metric(
            metric_name='DocumentsProcessed',
            value=1,
            unit='Count',
            dimensions=[
                {'Name': 'DocumentType', 'Value': document_type},
                {'Name': 'Status', 'Value': status}
            ]
        )

    def record_field_extraction(
        self,
        field_name: str,
        extracted: bool,
        confidence: float
    ):
        """
        Record field extraction metric.

        Args:
            field_name: Name of the extracted field
            extracted: Whether field was successfully extracted
            confidence: Field confidence score
        """
        self.put_metric(
            metric_name='FieldExtraction',
            value=1 if extracted else 0,
            unit='Count',
            dimensions=[
                {'Name': 'FieldName', 'Value': field_name},
                {'Name': 'Extracted', 'Value': 'true' if extracted else 'false'}
            ]
        )

        if extracted:
            self.put_metric(
                metric_name='FieldConfidence',
                value=confidence * 100,
                unit='Percent',
                dimensions=[
                    {'Name': 'FieldName', 'Value': field_name}
                ]
            )


class StructuredLogger:
    """
    Structured logging for document processing with CloudWatch Logs Insights support.

    Emits JSON-formatted logs with consistent structure for easy querying.
    """

    def __init__(
        self,
        logger_name: str = __name__,
        log_level: str = 'INFO'
    ):
        """
        Initialize structured logger.

        Args:
            logger_name: Logger name
            log_level: Logging level
        """
        self.logger = logging.getLogger(logger_name)
        self.logger.setLevel(getattr(logging, log_level.upper()))

        # Add JSON formatter if not already configured
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(JsonFormatter())
            self.logger.addHandler(handler)

    def log_event(
        self,
        event_type: str,
        message: str,
        level: str = 'INFO',
        **kwargs
    ):
        """
        Log a structured event.

        Args:
            event_type: Type of event (e.g., 'processing_started', 'ocr_completed')
            message: Human-readable message
            level: Log level
            **kwargs: Additional structured data
        """
        log_data = {
            'event_type': event_type,
            'message': message,
            'timestamp': datetime.utcnow().isoformat(),
            **kwargs
        }

        log_method = getattr(self.logger, level.lower())
        log_method(json.dumps(log_data))

    def log_processing_started(
        self,
        job_id: str,
        bucket: str,
        key: str
    ):
        """Log processing start event."""
        self.log_event(
            event_type='processing_started',
            message=f'Started processing job {job_id}',
            level='INFO',
            job_id=job_id,
            s3_bucket=bucket,
            s3_key=key
        )

    def log_processing_completed(
        self,
        job_id: str,
        duration_ms: float,
        confidence: float,
        hitl_required: bool
    ):
        """Log processing completion event."""
        self.log_event(
            event_type='processing_completed',
            message=f'Completed processing job {job_id}',
            level='INFO',
            job_id=job_id,
            duration_ms=duration_ms,
            overall_confidence=confidence,
            hitl_required=hitl_required
        )

    def log_ocr_extraction(
        self,
        job_id: str,
        text_regions: int,
        average_confidence: float,
        duration_ms: float
    ):
        """Log OCR extraction event."""
        self.log_event(
            event_type='ocr_extraction',
            message=f'OCR extracted {text_regions} text regions',
            level='INFO',
            job_id=job_id,
            text_regions=text_regions,
            average_confidence=average_confidence,
            duration_ms=duration_ms
        )

    def log_bedrock_structuring(
        self,
        job_id: str,
        fields_extracted: int,
        duration_ms: float
    ):
        """Log Bedrock structuring event."""
        self.log_event(
            event_type='bedrock_structuring',
            message=f'Bedrock structured {fields_extracted} fields',
            level='INFO',
            job_id=job_id,
            fields_extracted=fields_extracted,
            duration_ms=duration_ms
        )

    def log_confidence_calculation(
        self,
        job_id: str,
        overall_confidence: float,
        critical_fields_below_threshold: List[str]
    ):
        """Log confidence calculation event."""
        self.log_event(
            event_type='confidence_calculation',
            message=f'Calculated confidence: {overall_confidence:.2f}',
            level='INFO',
            job_id=job_id,
            overall_confidence=overall_confidence,
            critical_fields_below_threshold=critical_fields_below_threshold
        )

    def log_hitl_routing(
        self,
        job_id: str,
        confidence: float,
        critical_fields: List[str]
    ):
        """Log HITL routing event."""
        self.log_event(
            event_type='hitl_routing',
            message=f'Job {job_id} routed to HITL',
            level='WARNING',
            job_id=job_id,
            confidence=confidence,
            critical_fields_below_threshold=critical_fields
        )

    def log_error(
        self,
        job_id: str,
        operation: str,
        error_message: str,
        error_category: str,
        error_severity: str,
        **kwargs
    ):
        """Log error event."""
        self.log_event(
            event_type='error',
            message=f'Error in {operation}: {error_message}',
            level='ERROR',
            job_id=job_id,
            operation=operation,
            error_message=error_message,
            error_category=error_category,
            error_severity=error_severity,
            **kwargs
        )


class JsonFormatter(logging.Formatter):
    """JSON formatter for CloudWatch Logs."""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data = {
            'timestamp': datetime.utcfromtimestamp(record.created).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage()
        }

        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)

        # Add extra fields
        if hasattr(record, 'context'):
            log_data['context'] = record.context

        return json.dumps(log_data)


@contextmanager
def track_operation(
    operation_name: str,
    metrics: CloudWatchMetrics,
    structured_logger: StructuredLogger,
    job_id: str,
    **kwargs
):
    """
    Context manager to track operation timing and emit metrics.

    Args:
        operation_name: Name of the operation
        metrics: CloudWatchMetrics instance
        structured_logger: StructuredLogger instance
        job_id: Job identifier
        **kwargs: Additional context data

    Yields:
        Dictionary to store operation results
    """
    start_time = time.time()
    result = {}

    structured_logger.log_event(
        event_type=f'{operation_name}_started',
        message=f'Started {operation_name}',
        level='INFO',
        job_id=job_id,
        **kwargs
    )

    try:
        yield result

        # Success
        duration_ms = (time.time() - start_time) * 1000

        metrics.record_processing_latency(
            latency_ms=duration_ms,
            operation=operation_name,
            status='success'
        )

        structured_logger.log_event(
            event_type=f'{operation_name}_completed',
            message=f'Completed {operation_name}',
            level='INFO',
            job_id=job_id,
            duration_ms=duration_ms,
            **kwargs,
            **result
        )

    except Exception as e:
        # Failure
        duration_ms = (time.time() - start_time) * 1000

        metrics.record_processing_latency(
            latency_ms=duration_ms,
            operation=operation_name,
            status='failure'
        )

        structured_logger.log_error(
            job_id=job_id,
            operation=operation_name,
            error_message=str(e),
            error_category='unknown',
            error_severity='high',
            duration_ms=duration_ms,
            **kwargs
        )

        raise


def measure_latency(operation_name: str):
    """
    Decorator to measure and log operation latency.

    Args:
        operation_name: Name of the operation

    Returns:
        Decorated function
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()

            try:
                result = func(*args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000

                logger.info(
                    f'{operation_name} completed in {duration_ms:.2f}ms',
                    extra={'duration_ms': duration_ms, 'operation': operation_name}
                )

                return result

            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000

                logger.error(
                    f'{operation_name} failed after {duration_ms:.2f}ms: {str(e)}',
                    extra={'duration_ms': duration_ms, 'operation': operation_name}
                )

                raise

        return wrapper
    return decorator


# Global instances (initialized in Lambda handler)
_metrics_instance: Optional[CloudWatchMetrics] = None
_logger_instance: Optional[StructuredLogger] = None


def get_metrics() -> CloudWatchMetrics:
    """Get or create global CloudWatchMetrics instance."""
    global _metrics_instance

    if _metrics_instance is None:
        namespace = os.environ.get('CLOUDWATCH_NAMESPACE', 'VaidyaLink/DocumentProcessing')
        _metrics_instance = CloudWatchMetrics(namespace=namespace)

    return _metrics_instance


def get_structured_logger() -> StructuredLogger:
    """Get or create global StructuredLogger instance."""
    global _logger_instance

    if _logger_instance is None:
        log_level = os.environ.get('LOG_LEVEL', 'INFO')
        _logger_instance = StructuredLogger(log_level=log_level)

    return _logger_instance
