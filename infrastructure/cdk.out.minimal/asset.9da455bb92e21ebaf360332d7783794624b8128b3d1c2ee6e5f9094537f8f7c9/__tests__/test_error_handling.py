"""
Unit tests for error handling and CloudWatch metrics in document processor.

Tests verify:
- Exception catching and logging with full context
- Job status updates to 'failed' with error messages
- CloudWatch metric emission for processing errors
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock, call
from datetime import datetime
from botocore.exceptions import ClientError


# Mock AWS clients before importing index
@pytest.fixture(autouse=True)
def mock_aws_clients():
    """Mock AWS clients for all tests."""
    with patch('boto3.resource') as mock_dynamodb, \
         patch('boto3.client') as mock_client:

        # Setup DynamoDB mock
        mock_table = Mock()
        mock_dynamodb.return_value.Table.return_value = mock_table

        # Setup CloudWatch mock
        mock_cloudwatch = Mock()
        mock_bedrock = Mock()

        def client_side_effect(service_name):
            if service_name == 'cloudwatch':
                return mock_cloudwatch
            elif service_name == 'bedrock-runtime':
                return mock_bedrock
            return Mock()

        mock_client.side_effect = client_side_effect

        yield {
            'dynamodb': mock_dynamodb,
            'table': mock_table,
            'cloudwatch': mock_cloudwatch,
            'bedrock': mock_bedrock
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
    context.request_id = 'test-request-id-123'
    return context


def test_handle_processing_error_updates_job_status(mock_aws_clients):
    """Test that handle_processing_error updates job status to 'failed'."""
    from index import handle_processing_error

    job_id = 'test-job-123'
    stage = 'OCR extraction'
    error = Exception('OCR failed: invalid image format')
    processing_start_time = 1234567890.0

    # Call the error handler
    handle_processing_error(job_id, stage, error, processing_start_time)

    # Verify job status was updated to 'failed'
    mock_aws_clients['table'].update_item.assert_called_once()
    call_args = mock_aws_clients['table'].update_item.call_args

    assert call_args[1]['Key'] == {'jobId': job_id}
    assert ':status' in call_args[1]['ExpressionAttributeValues']
    assert call_args[1]['ExpressionAttributeValues'][':status'] == 'failed'
    assert 'OCR extraction failed' in call_args[1]['ExpressionAttributeValues'][':message']


def test_handle_processing_error_emits_cloudwatch_metric(mock_aws_clients):
    """Test that handle_processing_error emits CloudWatch metrics."""
    from index import handle_processing_error

    job_id = 'test-job-123'
    stage = 'Entity extraction'
    error = ValueError('Invalid entity format')
    processing_start_time = 1234567890.0

    # Call the error handler
    handle_processing_error(job_id, stage, error, processing_start_time)

    # Verify CloudWatch metrics were emitted
    assert mock_aws_clients['cloudwatch'].put_metric_data.call_count >= 1

    # Check that ProcessingError metric was emitted
    calls = mock_aws_clients['cloudwatch'].put_metric_data.call_args_list
    metric_names = []
    for call in calls:
        metric_data = call[1]['MetricData'][0]
        metric_names.append(metric_data['MetricName'])

    assert 'ProcessingError' in metric_names


def test_emit_processing_metric_with_dimensions(mock_aws_clients):
    """Test that emit_processing_metric includes custom dimensions."""
    from index import emit_processing_metric

    metric_name = 'ProcessingError'
    value = 1
    unit = 'Count'
    job_id = 'test-job-123'
    dimensions = {
        'Status': 'Failed',
        'ErrorType': 'ValueError',
        'Stage': 'OCR extraction'
    }

    # Emit metric
    emit_processing_metric(metric_name, value, unit, job_id, dimensions)

    # Verify CloudWatch was called
    mock_aws_clients['cloudwatch'].put_metric_data.assert_called_once()

    # Verify metric data structure
    call_args = mock_aws_clients['cloudwatch'].put_metric_data.call_args
    assert call_args[1]['Namespace'] == 'DocumentScanDemo'

    metric_data = call_args[1]['MetricData'][0]
    assert metric_data['MetricName'] == metric_name
    assert metric_data['Value'] == value
    assert metric_data['Unit'] == unit

    # Verify dimensions
    dimension_dict = {d['Name']: d['Value'] for d in metric_data['Dimensions']}
    assert dimension_dict['Service'] == 'DocumentProcessor'
    assert dimension_dict['Status'] == 'Failed'
    assert dimension_dict['ErrorType'] == 'ValueError'
    assert dimension_dict['Stage'] == 'OCR extraction'


def test_emit_processing_metric_handles_cloudwatch_errors(mock_aws_clients, caplog):
    """Test that emit_processing_metric handles CloudWatch errors gracefully."""
    from index import emit_processing_metric

    # Make CloudWatch raise an error
    mock_aws_clients['cloudwatch'].put_metric_data.side_effect = ClientError(
        {'Error': {'Code': 'ServiceUnavailable', 'Message': 'Service unavailable'}},
        'PutMetricData'
    )

    # Emit metric - should not raise exception
    emit_processing_metric('TestMetric', 1, 'Count', 'job-123')

    # Verify error was logged
    assert 'Failed to emit CloudWatch metric' in caplog.text


def test_process_s3_event_catches_all_exceptions(mock_aws_clients, sample_s3_event, lambda_context):
    """Test that process_s3_event catches all exceptions and updates job status."""
    from index import process_s3_event

    # Make extract_text_with_ocr raise an exception
    with patch('index.extract_text_with_ocr') as mock_ocr:
        mock_ocr.side_effect = Exception('OCR service unavailable')

        # Process event - should catch exception
        with pytest.raises(Exception, match='OCR service unavailable'):
            process_s3_event(sample_s3_event['Records'][0], lambda_context.request_id)

        # Verify job status was updated to 'failed'
        update_calls = [call for call in mock_aws_clients['table'].update_item.call_args_list
                       if ':status' in call[1].get('ExpressionAttributeValues', {})]

        # Should have at least one call with status='failed'
        failed_calls = [call for call in update_calls
                       if call[1]['ExpressionAttributeValues'][':status'] == 'failed']
        assert len(failed_calls) >= 1


def test_process_s3_event_emits_success_metrics_on_completion(mock_aws_clients, sample_s3_event, lambda_context):
    """Test that process_s3_event emits success metrics when processing completes."""
    from index import process_s3_event

    # Mock all processing functions to succeed
    with patch('index.extract_text_with_ocr') as mock_ocr, \
         patch('index.extract_entities_with_bedrock') as mock_bedrock, \
         patch('index.transform_to_fhir') as mock_fhir, \
         patch('index.store_results') as mock_store:

        mock_ocr.return_value = 'Sample OCR text'
        mock_bedrock.return_value = {
            'entities': [],
            'medications': [],
            'conditions': [],
            'labResults': []
        }
        mock_fhir.return_value = {'resourceType': 'Bundle', 'type': 'collection'}

        # Process event
        process_s3_event(sample_s3_event['Records'][0], lambda_context.request_id)

        # Verify success metrics were emitted
        calls = mock_aws_clients['cloudwatch'].put_metric_data.call_args_list
        metric_names = []
        for call in calls:
            metric_data = call[1]['MetricData'][0]
            metric_names.append(metric_data['MetricName'])

        assert 'ProcessingSuccess' in metric_names
        assert 'ProcessingDuration' in metric_names


def test_top_level_error_handler_logs_full_context(mock_aws_clients, sample_s3_event, lambda_context, caplog):
    """Test that top-level error handler logs full context including S3 record."""
    from index import process_s3_event

    # Make extract_job_id_from_key return None to trigger error
    with patch('index.extract_job_id_from_key') as mock_extract:
        mock_extract.return_value = None

        # Process event - should catch exception
        with pytest.raises(ValueError, match='Invalid S3 key format'):
            process_s3_event(sample_s3_event['Records'][0], lambda_context.request_id)

        # Verify error was logged with context
        assert 'Invalid S3 key format' in caplog.text


def test_error_handler_includes_error_type_in_metadata(mock_aws_clients):
    """Test that error handler includes error type in job metadata."""
    from index import handle_processing_error

    job_id = 'test-job-123'
    stage = 'FHIR transformation'
    error = ValueError('Invalid FHIR resource')
    processing_start_time = 1234567890.0

    # Call the error handler
    handle_processing_error(job_id, stage, error, processing_start_time)

    # Verify error type was included in metadata
    call_args = mock_aws_clients['table'].update_item.call_args
    assert ':failedStage' in call_args[1]['ExpressionAttributeValues']
    assert call_args[1]['ExpressionAttributeValues'][':failedStage'] == stage
    assert ':errorType' in call_args[1]['ExpressionAttributeValues']
    assert call_args[1]['ExpressionAttributeValues'][':errorType'] == 'ValueError'


def test_error_metrics_include_stage_dimension(mock_aws_clients):
    """Test that error metrics include the processing stage as a dimension."""
    from index import handle_processing_error

    job_id = 'test-job-123'
    stage = 'Entity extraction'
    error = Exception('Bedrock throttled')
    processing_start_time = 1234567890.0

    # Call the error handler
    handle_processing_error(job_id, stage, error, processing_start_time)

    # Verify stage dimension was included
    calls = mock_aws_clients['cloudwatch'].put_metric_data.call_args_list

    # Find the ProcessingError metric call
    for call in calls:
        metric_data = call[1]['MetricData'][0]
        if metric_data['MetricName'] == 'ProcessingError':
            dimension_dict = {d['Name']: d['Value'] for d in metric_data['Dimensions']}
            assert 'Stage' in dimension_dict
            assert dimension_dict['Stage'] == stage
            break
    else:
        pytest.fail('ProcessingError metric not found')
