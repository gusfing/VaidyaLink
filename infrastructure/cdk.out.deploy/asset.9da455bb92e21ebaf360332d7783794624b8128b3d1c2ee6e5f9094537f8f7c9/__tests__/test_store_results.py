"""
Unit tests for store_results function.

Tests verify that results are correctly stored in DynamoDB with all required fields,
including TTL calculation and processedAt timestamp.
"""

import pytest
import time
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock
from botocore.exceptions import ClientError


# Mock environment variables before importing index
@patch.dict('os.environ', {
    'JOBS_TABLE': 'test-jobs-table',
    'BEDROCK_MODEL_ID': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'AWS_REGION': 'us-east-1'
})
def test_store_results_success():
    """Test successful storage of complete results in DynamoDB."""
    from src.index import store_results

    # Mock DynamoDB table
    mock_table = MagicMock()

    with patch('src.index.dynamodb') as mock_dynamodb:
        mock_dynamodb.Table.return_value = mock_table

        # Test data
        job_id = 'test-job-123'
        ocr_text = 'Patient has diabetes and hypertension.'
        structured_data = {
            'entities': [
                {'text': 'diabetes', 'type': 'CONDITION', 'confidence': 0.95}
            ],
            'medications': [
                {'name': 'Metformin', 'dosage': '500mg', 'frequency': 'twice daily', 'confidence': 0.9}
            ],
            'conditions': ['diabetes', 'hypertension'],
            'labResults': [
                {'testName': 'HbA1c', 'value': '7.2', 'unit': '%', 'confidence': 0.92}
            ]
        }
        fhir_bundle = {
            'resourceType': 'Bundle',
            'type': 'collection',
            'entry': []
        }
        document_url = 's3://test-bucket/uploads/user123/test-job-123-document.pdf'

        # Call function
        store_results(job_id, ocr_text, structured_data, fhir_bundle, document_url)

        # Verify update_item was called
        assert mock_table.update_item.called
        call_args = mock_table.update_item.call_args

        # Verify Key
        assert call_args[1]['Key'] == {'jobId': job_id}

        # Verify UpdateExpression contains all required fields
        update_expr = call_args[1]['UpdateExpression']
        assert 'ocrText' in update_expr
        assert 'entities' in update_expr
        assert 'medications' in update_expr
        assert 'conditions' in update_expr
        assert 'labResults' in update_expr
        assert 'fhirResource' in update_expr
        assert 'documentUrl' in update_expr
        assert 'processedAt' in update_expr
        assert 'ttl' in update_expr

        # Verify ExpressionAttributeValues
        values = call_args[1]['ExpressionAttributeValues']
        assert values[':ocr_text'] == ocr_text
        assert values[':entities'] == structured_data['entities']
        assert values[':medications'] == structured_data['medications']
        assert values[':conditions'] == structured_data['conditions']
        assert values[':lab_results'] == structured_data['labResults']
        assert values[':fhir_resource'] == fhir_bundle
        assert values[':document_url'] == document_url
        assert ':processed_at' in values
        assert ':ttl' in values


@patch.dict('os.environ', {
    'JOBS_TABLE': 'test-jobs-table',
    'BEDROCK_MODEL_ID': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'AWS_REGION': 'us-east-1'
})
def test_store_results_ttl_calculation():
    """Test that TTL is correctly calculated as 90 days from now."""
    from src.index import store_results

    mock_table = MagicMock()

    with patch('src.index.dynamodb') as mock_dynamodb:
        mock_dynamodb.Table.return_value = mock_table

        # Record current time
        before_time = int(time.time())

        # Call function
        store_results(
            job_id='test-job-123',
            ocr_text='Test text',
            structured_data={'entities': [], 'medications': [], 'conditions': [], 'labResults': []},
            fhir_bundle={'resourceType': 'Bundle', 'type': 'collection'},
            document_url='s3://bucket/key'
        )

        after_time = int(time.time())

        # Get TTL value from call
        call_args = mock_table.update_item.call_args
        ttl_value = call_args[1]['ExpressionAttributeValues'][':ttl']

        # Verify TTL is approximately 90 days from now
        # Allow 1 second tolerance for test execution time
        expected_ttl_min = before_time + (90 * 24 * 60 * 60)
        expected_ttl_max = after_time + (90 * 24 * 60 * 60)

        assert expected_ttl_min <= ttl_value <= expected_ttl_max, \
            f"TTL {ttl_value} not within expected range [{expected_ttl_min}, {expected_ttl_max}]"


@patch.dict('os.environ', {
    'JOBS_TABLE': 'test-jobs-table',
    'BEDROCK_MODEL_ID': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'AWS_REGION': 'us-east-1'
})
def test_store_results_processedAt_timestamp():
    """Test that processedAt timestamp is in ISO format."""
    from src.index import store_results

    mock_table = MagicMock()

    with patch('src.index.dynamodb') as mock_dynamodb:
        mock_dynamodb.Table.return_value = mock_table

        # Call function
        store_results(
            job_id='test-job-123',
            ocr_text='Test text',
            structured_data={'entities': [], 'medications': [], 'conditions': [], 'labResults': []},
            fhir_bundle={'resourceType': 'Bundle', 'type': 'collection'},
            document_url='s3://bucket/key'
        )

        # Get processedAt value from call
        call_args = mock_table.update_item.call_args
        processed_at = call_args[1]['ExpressionAttributeValues'][':processed_at']

        # Verify it's a valid ISO timestamp
        try:
            parsed_time = datetime.fromisoformat(processed_at)
            assert isinstance(parsed_time, datetime)
        except ValueError:
            pytest.fail(f"processedAt '{processed_at}' is not a valid ISO timestamp")


@patch.dict('os.environ', {
    'JOBS_TABLE': 'test-jobs-table',
    'BEDROCK_MODEL_ID': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'AWS_REGION': 'us-east-1'
})
def test_store_results_handles_missing_fields():
    """Test that store_results handles missing optional fields gracefully."""
    from src.index import store_results

    mock_table = MagicMock()

    with patch('src.index.dynamodb') as mock_dynamodb:
        mock_dynamodb.Table.return_value = mock_table

        # Structured data with missing fields
        structured_data = {}

        # Call function
        store_results(
            job_id='test-job-123',
            ocr_text='Test text',
            structured_data=structured_data,
            fhir_bundle={'resourceType': 'Bundle', 'type': 'collection'},
            document_url='s3://bucket/key'
        )

        # Verify empty arrays are used for missing fields
        call_args = mock_table.update_item.call_args
        values = call_args[1]['ExpressionAttributeValues']

        assert values[':entities'] == []
        assert values[':medications'] == []
        assert values[':conditions'] == []
        assert values[':lab_results'] == []


@patch.dict('os.environ', {
    'JOBS_TABLE': 'test-jobs-table',
    'BEDROCK_MODEL_ID': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'AWS_REGION': 'us-east-1'
})
def test_store_results_dynamodb_error():
    """Test that DynamoDB errors are properly handled and re-raised."""
    from src.index import store_results

    mock_table = MagicMock()
    mock_table.update_item.side_effect = ClientError(
        {'Error': {'Code': 'ResourceNotFoundException', 'Message': 'Table not found'}},
        'UpdateItem'
    )

    with patch('src.index.dynamodb') as mock_dynamodb:
        mock_dynamodb.Table.return_value = mock_table

        # Call function and expect exception
        with pytest.raises(Exception) as exc_info:
            store_results(
                job_id='test-job-123',
                ocr_text='Test text',
                structured_data={'entities': [], 'medications': [], 'conditions': [], 'labResults': []},
                fhir_bundle={'resourceType': 'Bundle', 'type': 'collection'},
                document_url='s3://bucket/key'
            )

        # Verify error message
        assert 'Failed to store results in DynamoDB' in str(exc_info.value)
