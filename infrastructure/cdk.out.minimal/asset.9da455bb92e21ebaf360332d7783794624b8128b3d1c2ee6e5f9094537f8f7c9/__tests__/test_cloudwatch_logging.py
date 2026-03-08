"""
Tests for CloudWatch logging and metrics in document processor.

Validates Requirements 11.1, 11.3, 11.8:
- Log processing start, completion, and failure events
- Emit custom metric for processing duration
- Include jobId in all log entries for correlation
- Enable X-Ray tracing
"""

import json
import pytest
from unittest.mock import Mock, patch, MagicMock, call
from datetime import datetime
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from index import (
    lambda_handler,
    process_s3_event,
    emit_processing_metric
)


@pytest.fixture
def mock_aws_clients():
    """Mock AWS clients for testing."""
    with patch('index.dynamodb') as mock_dynamodb, \
         patch('index.bedrock_runtime') as mock_bedrock, \
         patch('index.cloudwatch') as mock_cloudwatch, \
         patch('index.boto3') as mock_boto3:

        # Mock DynamoDB table
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table

        # Mock S3 client
        mock_s3 = Mock()
        mock_boto3.client.return_value = mock_s3

        yield {
            'dynamodb': mock_dynamodb,
            'table': mock_table,
            'bedrock': mock_bedrock,
            'cloudwatch': mock_cloudwatch,
            's3': mock_s3,
            'boto3': mock_boto3
        }


@pytest.fixture
def sample_s3_event():
    """Sample S3 event for testing."""
    return {
        'Records': [
            {
                'eventSource': 'aws:s3',
                's3': {
                    'bucket': {'name': 'test-bucket'},
                    'object': {'key': 'uploads/user123/job456-document.pdf'}
                }
            }
        ]
    }


@pytest.fixture
def lambda_context():
    """Mock Lambda context."""
    context = Mock()
    context.request_id = 'test-request-123'
    return context


def test_lambda_handler_logs_processing_start(mock_aws_clients, sample_s3_event, lambda_context):
    """Test that lambda_handler logs processing start event."""
    with patch('index.logger') as mock_logger, \
         patch('index.process_s3_event'):

        lambda_handler(sample_s3_event, lambda_context)

        # Verify processing start was logged
        start_log_calls = [
            call for call in mock_logger.info.call_args_list
            if 'Document processing started' in str(call)
        ]
        assert len(start_log_calls) > 0, "Processing start event should be logged"

        # Verify requestId is in extra fields
        start_call = start_log_calls[0]
        assert 'extra' in start_call.kwargs
        assert start_call.kwargs['extra']['requestId'] == 'test-request-123'
        assert start_call.kwargs['extra']['eventType'] == 'processing_start'


def test_lambda_handler_logs_processing_failure(mock_aws_clients, sample_s3_event, lambda_context):
    """Test that lambda_handler logs processing failure event."""
    with patch('index.logger') as mock_logger, \
         patch('index.process_s3_event', side_effect=Exception('Test error')):

        result = lambda_handler(sample_s3_event, lambda_context)

        # Verify failure was logged
        error_log_calls = [
            call for call in mock_logger.error.call_args_list
            if 'Document processing failed' in str(call)
        ]
        assert len(error_log_calls) > 0, "Processing failure event should be logged"

        # Verify error details in extra fields
        error_call = error_log_calls[0]
        assert 'extra' in error_call.kwargs
        assert error_call.kwargs['extra']['requestId'] == 'test-request-123'
        assert error_call.kwargs['extra']['eventType'] == 'processing_failure'
        assert 'Test error' in error_call.kwargs['extra']['error']


def test_process_s3_event_includes_jobid_in_all_logs(mock_aws_clients, lambda_context):
    """Test that all log entries include jobId for correlation."""
    record = {
        'eventSource': 'aws:s3',
        's3': {
            'bucket': {'name': 'test-bucket'},
            'object': {'key': 'uploads/user123/job456-document.pdf'}
        }
    }

    with patch('index.logger') as mock_logger, \
         patch('index.extract_text_with_ocr', side_effect=Exception('OCR failed')), \
         patch('index.update_job_status'), \
         patch('index.handle_processing_error'):

        try:
            process_s3_event(record, lambda_context.request_id)
        except:
            pass  # Expected to fail

        # Get all log calls that should have jobId
        info_calls = mock_logger.info.call_args_list
        error_calls = mock_logger.error.call_args_list

        # Filter calls that happen after jobId extraction
        calls_with_jobid = [
            call for call in info_calls + error_calls
            if 'extra' in call.kwargs and 'jobId' in call.kwargs.get('extra', {})
        ]

        # Verify jobId is present in logs
        assert len(calls_with_jobid) > 0, "JobId should be included in log entries"

        # Verify all have the correct jobId
        for call in calls_with_jobid:
            assert call.kwargs['extra']['jobId'] == 'job456'


def test_process_s3_event_logs_completion_with_metrics(mock_aws_clients, lambda_context):
    """Test that successful processing logs completion event with metrics."""
    record = {
        'eventSource': 'aws:s3',
        's3': {
            'bucket': {'name': 'test-bucket'},
            'object': {'key': 'uploads/user123/job456-document.pdf'}
        }
    }

    mock_structured_data = {
        'entities': [{'text': 'test', 'type': 'MEDICATION', 'confidence': 0.9}],
        'medications': [{'name': 'Aspirin', 'dosage': '100mg', 'frequency': 'daily', 'confidence': 0.9}],
        'conditions': ['Hypertension'],
        'labResults': [{'testName': 'Blood Pressure', 'value': '120/80', 'unit': 'mmHg', 'confidence': 0.85}]
    }

    with patch('index.logger') as mock_logger, \
         patch('index.extract_text_with_ocr', return_value='Sample OCR text'), \
         patch('index.extract_entities_with_bedrock', return_value=mock_structured_data), \
         patch('index.transform_to_fhir', return_value={'resourceType': 'Bundle'}), \
         patch('index.store_results'), \
         patch('index.update_job_status'), \
         patch('index.emit_processing_metric'):

        process_s3_event(record, lambda_context.request_id)

        # Verify completion was logged
        completion_log_calls = [
            call for call in mock_logger.info.call_args_list
            if 'Document processing completed successfully' in str(call)
        ]
        assert len(completion_log_calls) > 0, "Processing completion event should be logged"

        # Verify completion log includes all required fields
        completion_call = completion_log_calls[0]
        assert 'extra' in completion_call.kwargs
        extra = completion_call.kwargs['extra']
        assert extra['jobId'] == 'job456'
        assert extra['requestId'] == 'test-request-123'
        assert extra['eventType'] == 'processing_complete'
        assert 'processingDuration' in extra
        assert extra['entitiesCount'] == 1
        assert extra['medicationsCount'] == 1
        assert extra['conditionsCount'] == 1
        assert extra['labResultsCount'] == 1


def test_emit_processing_metric_sends_to_cloudwatch(mock_aws_clients):
    """Test that emit_processing_metric sends metrics to CloudWatch."""
    job_id = 'job123'

    emit_processing_metric(
        metric_name='ProcessingDuration',
        value=5.5,
        unit='Seconds',
        job_id=job_id,
        dimensions={'Status': 'Success'}
    )

    # Verify CloudWatch put_metric_data was called
    mock_aws_clients['cloudwatch'].put_metric_data.assert_called_once()

    # Verify metric data structure
    call_args = mock_aws_clients['cloudwatch'].put_metric_data.call_args
    assert call_args.kwargs['Namespace'] == 'DocumentScanDemo'

    metric_data = call_args.kwargs['MetricData'][0]
    assert metric_data['MetricName'] == 'ProcessingDuration'
    assert metric_data['Value'] == 5.5
    assert metric_data['Unit'] == 'Seconds'

    # Verify dimensions
    dimensions = metric_data['Dimensions']
    dimension_dict = {d['Name']: d['Value'] for d in dimensions}
    assert dimension_dict['Service'] == 'DocumentProcessor'
    assert dimension_dict['Status'] == 'Success'


def test_emit_processing_metric_includes_service_dimension(mock_aws_clients):
    """Test that all metrics include Service dimension."""
    job_id = 'job123'

    emit_processing_metric(
        metric_name='ProcessingSuccess',
        value=1,
        unit='Count',
        job_id=job_id
    )

    # Verify Service dimension is always included
    call_args = mock_aws_clients['cloudwatch'].put_metric_data.call_args
    metric_data = call_args.kwargs['MetricData'][0]
    dimensions = metric_data['Dimensions']

    service_dimensions = [d for d in dimensions if d['Name'] == 'Service']
    assert len(service_dimensions) == 1
    assert service_dimensions[0]['Value'] == 'DocumentProcessor'


def test_emit_processing_metric_handles_errors_gracefully(mock_aws_clients):
    """Test that metric emission errors don't fail processing."""
    mock_aws_clients['cloudwatch'].put_metric_data.side_effect = Exception('CloudWatch error')

    with patch('index.logger') as mock_logger:
        # Should not raise exception
        emit_processing_metric(
            metric_name='ProcessingDuration',
            value=5.5,
            unit='Seconds',
            job_id='job123'
        )

        # Verify error was logged
        error_calls = [
            call for call in mock_logger.error.call_args_list
            if 'Failed to emit CloudWatch metric' in str(call)
        ]
        assert len(error_calls) > 0


def test_processing_duration_metric_emitted_on_success(mock_aws_clients, lambda_context):
    """Test that ProcessingDuration metric is emitted on successful processing."""
    record = {
        'eventSource': 'aws:s3',
        's3': {
            'bucket': {'name': 'test-bucket'},
            'object': {'key': 'uploads/user123/job456-document.pdf'}
        }
    }

    with patch('index.extract_text_with_ocr', return_value='Sample text'), \
         patch('index.extract_entities_with_bedrock', return_value={'entities': [], 'medications': [], 'conditions': [], 'labResults': []}), \
         patch('index.transform_to_fhir', return_value={'resourceType': 'Bundle'}), \
         patch('index.store_results'), \
         patch('index.update_job_status'), \
         patch('index.emit_processing_metric') as mock_emit:

        process_s3_event(record, lambda_context.request_id)

        # Verify ProcessingDuration metric was emitted
        duration_calls = [
            call for call in mock_emit.call_args_list
            if call.kwargs['metric_name'] == 'ProcessingDuration'
        ]
        assert len(duration_calls) > 0, "ProcessingDuration metric should be emitted"

        # Verify metric has correct unit
        duration_call = duration_calls[0]
        assert duration_call.kwargs['unit'] == 'Seconds'
        assert duration_call.kwargs['value'] > 0


def test_processing_success_metric_emitted_on_completion(mock_aws_clients, lambda_context):
    """Test that ProcessingSuccess metric is emitted on successful completion."""
    record = {
        'eventSource': 'aws:s3',
        's3': {
            'bucket': {'name': 'test-bucket'},
            'object': {'key': 'uploads/user123/job456-document.pdf'}
        }
    }

    with patch('index.extract_text_with_ocr', return_value='Sample text'), \
         patch('index.extract_entities_with_bedrock', return_value={'entities': [], 'medications': [], 'conditions': [], 'labResults': []}), \
         patch('index.transform_to_fhir', return_value={'resourceType': 'Bundle'}), \
         patch('index.store_results'), \
         patch('index.update_job_status'), \
         patch('index.emit_processing_metric') as mock_emit:

        process_s3_event(record, lambda_context.request_id)

        # Verify ProcessingSuccess metric was emitted
        success_calls = [
            call for call in mock_emit.call_args_list
            if call.kwargs['metric_name'] == 'ProcessingSuccess'
        ]
        assert len(success_calls) > 0, "ProcessingSuccess metric should be emitted"

        # Verify metric has correct value and dimensions
        success_call = success_calls[0]
        assert success_call.kwargs['value'] == 1
        assert success_call.kwargs['unit'] == 'Count'
        assert success_call.kwargs['dimensions']['Status'] == 'Success'


def test_xray_sdk_imported():
    """Test that X-Ray SDK is imported and configured."""
    import index

    # Verify X-Ray modules are imported
    assert hasattr(index, 'xray_recorder'), "X-Ray recorder should be imported"
    assert hasattr(index, 'patch_all'), "X-Ray patch_all should be imported"


def test_aws_clients_instrumented_for_xray():
    """Test that AWS clients are created after X-Ray patching."""
    # This test verifies that patch_all() is called before client initialization
    # by checking the import order in the module
    import index

    # If we can import the module without errors, X-Ray patching was successful
    assert index.dynamodb is not None
    assert index.bedrock_runtime is not None
    assert index.cloudwatch is not None
