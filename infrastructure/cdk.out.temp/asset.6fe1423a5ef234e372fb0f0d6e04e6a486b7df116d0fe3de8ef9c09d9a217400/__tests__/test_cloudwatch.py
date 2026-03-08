"""
Tests for CloudWatch Logging and Metrics Module
"""

import json
import sys
import os
import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from cloudwatch_logger import (
    CloudWatchMetrics,
    StructuredLogger,
    JsonFormatter,
    track_operation,
    measure_latency,
    get_metrics,
    get_structured_logger
)


class TestCloudWatchMetrics(unittest.TestCase):
    """Test CloudWatch metrics emitter."""

    def setUp(self):
        """Set up test fixtures."""
        self.metrics = CloudWatchMetrics(namespace='Test/Namespace')
        self.metrics._cloudwatch = Mock()

    def test_put_metric(self):
        """Test putting a single metric."""
        self.metrics.put_metric(
            metric_name='TestMetric',
            value=100.0,
            unit='Count',
            dimensions=[{'Name': 'Environment', 'Value': 'test'}]
        )

        self.assertEqual(len(self.metrics.metric_buffer), 1)
        self.assertEqual(self.metrics.metric_buffer[0]['MetricName'], 'TestMetric')
        self.assertEqual(self.metrics.metric_buffer[0]['Value'], 100.0)

    def test_flush_metrics(self):
        """Test flushing metrics to CloudWatch."""
        # Add metrics to buffer
        for i in range(5):
            self.metrics.put_metric(
                metric_name=f'Metric{i}',
                value=float(i),
                unit='Count'
            )

        # Flush
        self.metrics.flush_metrics()

        # Verify CloudWatch was called
        self.metrics._cloudwatch.put_metric_data.assert_called_once()
        call_args = self.metrics._cloudwatch.put_metric_data.call_args

        self.assertEqual(call_args[1]['Namespace'], 'Test/Namespace')
        self.assertEqual(len(call_args[1]['MetricData']), 5)

        # Buffer should be empty
        self.assertEqual(len(self.metrics.metric_buffer), 0)

    def test_auto_flush_on_buffer_full(self):
        """Test automatic flush when buffer reaches limit."""
        # Add metrics up to buffer size
        for i in range(20):
            self.metrics.put_metric(
                metric_name=f'Metric{i}',
                value=float(i)
            )

        # Should have flushed automatically
        self.metrics._cloudwatch.put_metric_data.assert_called_once()
        self.assertEqual(len(self.metrics.metric_buffer), 0)

    def test_record_processing_latency(self):
        """Test recording processing latency."""
        self.metrics.record_processing_latency(
            latency_ms=150.5,
            operation='ocr',
            status='success'
        )

        self.assertEqual(len(self.metrics.metric_buffer), 1)
        metric = self.metrics.metric_buffer[0]

        self.assertEqual(metric['MetricName'], 'ProcessingLatency')
        self.assertEqual(metric['Value'], 150.5)
        self.assertEqual(metric['Unit'], 'Milliseconds')
        self.assertEqual(len(metric['Dimensions']), 2)

    def test_record_ocr_accuracy(self):
        """Test recording OCR accuracy."""
        self.metrics.record_ocr_accuracy(
            confidence=0.92,
            language='en'
        )

        metric = self.metrics.metric_buffer[0]

        self.assertEqual(metric['MetricName'], 'OCRAccuracy')
        self.assertEqual(metric['Value'], 92.0)  # Converted to percentage
        self.assertEqual(metric['Unit'], 'Percent')

    def test_record_confidence_score(self):
        """Test recording confidence scores."""
        self.metrics.record_confidence_score(
            overall_confidence=0.85,
            ocr_confidence=0.90,
            extraction_confidence=0.82,
            validation_confidence=0.88
        )

        # Should have 4 metrics (1 overall + 3 components)
        self.assertEqual(len(self.metrics.metric_buffer), 4)

        # Check overall confidence
        overall_metric = self.metrics.metric_buffer[0]
        self.assertEqual(overall_metric['MetricName'], 'OverallConfidence')
        self.assertEqual(overall_metric['Value'], 85.0)

    def test_record_hitl_routing(self):
        """Test recording HITL routing."""
        self.metrics.record_hitl_routing(
            routed=True,
            reason='low_confidence'
        )

        metric = self.metrics.metric_buffer[0]

        self.assertEqual(metric['MetricName'], 'HITLRouting')
        self.assertEqual(metric['Value'], 1)
        self.assertEqual(metric['Unit'], 'Count')

    def test_record_error(self):
        """Test recording error."""
        self.metrics.record_error(
            error_category='transient',
            error_severity='high',
            operation='bedrock'
        )

        metric = self.metrics.metric_buffer[0]

        self.assertEqual(metric['MetricName'], 'ProcessingErrors')
        self.assertEqual(metric['Value'], 1)
        self.assertEqual(len(metric['Dimensions']), 3)

    def test_record_document_processed(self):
        """Test recording document processed."""
        self.metrics.record_document_processed(
            document_type='prescription',
            status='completed'
        )

        metric = self.metrics.metric_buffer[0]

        self.assertEqual(metric['MetricName'], 'DocumentsProcessed')
        self.assertEqual(metric['Value'], 1)

    def test_record_field_extraction(self):
        """Test recording field extraction."""
        self.metrics.record_field_extraction(
            field_name='patient_name',
            extracted=True,
            confidence=0.95
        )

        # Should have 2 metrics (extraction + confidence)
        self.assertEqual(len(self.metrics.metric_buffer), 2)

        extraction_metric = self.metrics.metric_buffer[0]
        self.assertEqual(extraction_metric['MetricName'], 'FieldExtraction')
        self.assertEqual(extraction_metric['Value'], 1)

        confidence_metric = self.metrics.metric_buffer[1]
        self.assertEqual(confidence_metric['MetricName'], 'FieldConfidence')
        self.assertEqual(confidence_metric['Value'], 95.0)


class TestStructuredLogger(unittest.TestCase):
    """Test structured logger."""

    def setUp(self):
        """Set up test fixtures."""
        self.logger = StructuredLogger(logger_name='test_logger')

    @patch('cloudwatch_logger.logging.getLogger')
    def test_log_event(self, mock_get_logger):
        """Test logging structured event."""
        mock_logger = Mock()
        mock_get_logger.return_value = mock_logger

        logger = StructuredLogger()
        logger.logger = mock_logger

        logger.log_event(
            event_type='test_event',
            message='Test message',
            level='INFO',
            job_id='test-job-123'
        )

        mock_logger.info.assert_called_once()

        # Parse logged JSON
        logged_data = json.loads(mock_logger.info.call_args[0][0])

        self.assertEqual(logged_data['event_type'], 'test_event')
        self.assertEqual(logged_data['message'], 'Test message')
        self.assertEqual(logged_data['job_id'], 'test-job-123')
        self.assertIn('timestamp', logged_data)

    @patch('cloudwatch_logger.logging.getLogger')
    def test_log_processing_started(self, mock_get_logger):
        """Test logging processing started event."""
        mock_logger = Mock()
        mock_get_logger.return_value = mock_logger

        logger = StructuredLogger()
        logger.logger = mock_logger

        logger.log_processing_started(
            job_id='job-123',
            bucket='test-bucket',
            key='test-key'
        )

        mock_logger.info.assert_called_once()
        logged_data = json.loads(mock_logger.info.call_args[0][0])

        self.assertEqual(logged_data['event_type'], 'processing_started')
        self.assertEqual(logged_data['job_id'], 'job-123')
        self.assertEqual(logged_data['s3_bucket'], 'test-bucket')

    @patch('cloudwatch_logger.logging.getLogger')
    def test_log_error(self, mock_get_logger):
        """Test logging error event."""
        mock_logger = Mock()
        mock_get_logger.return_value = mock_logger

        logger = StructuredLogger()
        logger.logger = mock_logger

        logger.log_error(
            job_id='job-123',
            operation='ocr',
            error_message='OCR failed',
            error_category='transient',
            error_severity='high'
        )

        mock_logger.error.assert_called_once()
        logged_data = json.loads(mock_logger.error.call_args[0][0])

        self.assertEqual(logged_data['event_type'], 'error')
        self.assertEqual(logged_data['operation'], 'ocr')
        self.assertEqual(logged_data['error_message'], 'OCR failed')


class TestJsonFormatter(unittest.TestCase):
    """Test JSON formatter."""

    def test_format_basic_record(self):
        """Test formatting basic log record."""
        formatter = JsonFormatter()

        record = unittest.mock.Mock(spec=['created', 'levelname', 'name', 'getMessage', 'exc_info'])
        record.created = datetime.utcnow().timestamp()
        record.levelname = 'INFO'
        record.name = 'test_logger'
        record.getMessage.return_value = 'Test message'
        record.exc_info = None

        formatted = formatter.format(record)
        data = json.loads(formatted)

        self.assertEqual(data['level'], 'INFO')
        self.assertEqual(data['logger'], 'test_logger')
        self.assertEqual(data['message'], 'Test message')
        self.assertIn('timestamp', data)

    def test_format_with_exception(self):
        """Test formatting log record with exception."""
        formatter = JsonFormatter()

        record = unittest.mock.Mock(spec=['created', 'levelname', 'name', 'getMessage', 'exc_info'])
        record.created = datetime.utcnow().timestamp()
        record.levelname = 'ERROR'
        record.name = 'test_logger'
        record.getMessage.return_value = 'Error occurred'
        record.exc_info = (Exception, Exception('Test error'), None)

        formatted = formatter.format(record)
        data = json.loads(formatted)

        self.assertIn('exception', data)


class TestTrackOperation(unittest.TestCase):
    """Test track_operation context manager."""

    @patch('cloudwatch_logger.time.time')
    def test_track_successful_operation(self, mock_time):
        """Test tracking successful operation."""
        mock_time.side_effect = [1000.0, 1001.5]  # Start and end times

        metrics = Mock()
        logger = Mock()

        with track_operation(
            operation_name='test_op',
            metrics=metrics,
            structured_logger=logger,
            job_id='job-123'
        ) as result:
            result['status'] = 'success'

        # Verify metrics were recorded
        metrics.record_processing_latency.assert_called_once()
        call_args = metrics.record_processing_latency.call_args

        self.assertEqual(call_args[1]['operation'], 'test_op')
        self.assertEqual(call_args[1]['status'], 'success')
        self.assertAlmostEqual(call_args[1]['latency_ms'], 1500.0, places=0)

    @patch('cloudwatch_logger.time.time')
    def test_track_failed_operation(self, mock_time):
        """Test tracking failed operation."""
        mock_time.side_effect = [1000.0, 1001.0]

        metrics = Mock()
        logger = Mock()

        with self.assertRaises(ValueError):
            with track_operation(
                operation_name='test_op',
                metrics=metrics,
                structured_logger=logger,
                job_id='job-123'
            ):
                raise ValueError('Test error')

        # Verify failure was recorded
        metrics.record_processing_latency.assert_called_once()
        call_args = metrics.record_processing_latency.call_args

        self.assertEqual(call_args[1]['status'], 'failure')

        # Verify error was logged
        logger.log_error.assert_called_once()


class TestMeasureLatency(unittest.TestCase):
    """Test measure_latency decorator."""

    @patch('cloudwatch_logger.time.time')
    @patch('cloudwatch_logger.logger')
    def test_measure_successful_function(self, mock_logger, mock_time):
        """Test measuring latency of successful function."""
        mock_time.side_effect = [1000.0, 1001.5]

        @measure_latency('test_operation')
        def test_func():
            return 'success'

        result = test_func()

        self.assertEqual(result, 'success')
        mock_logger.info.assert_called_once()

    @patch('cloudwatch_logger.time.time')
    @patch('cloudwatch_logger.logger')
    def test_measure_failed_function(self, mock_logger, mock_time):
        """Test measuring latency of failed function."""
        mock_time.side_effect = [1000.0, 1001.0]

        @measure_latency('test_operation')
        def test_func():
            raise ValueError('Test error')

        with self.assertRaises(ValueError):
            test_func()

        mock_logger.error.assert_called_once()


class TestGlobalInstances(unittest.TestCase):
    """Test global instance getters."""

    @patch('cloudwatch_logger.CloudWatchMetrics')
    def test_get_metrics(self, mock_metrics_class):
        """Test getting global metrics instance."""
        # Reset global instance
        import cloudwatch_logger
        cloudwatch_logger._metrics_instance = None

        metrics = get_metrics()

        self.assertIsNotNone(metrics)
        mock_metrics_class.assert_called_once()

    @patch('cloudwatch_logger.StructuredLogger')
    def test_get_structured_logger(self, mock_logger_class):
        """Test getting global logger instance."""
        # Reset global instance
        import cloudwatch_logger
        cloudwatch_logger._logger_instance = None

        logger = get_structured_logger()

        self.assertIsNotNone(logger)
        mock_logger_class.assert_called_once()


if __name__ == '__main__':
    unittest.main()
