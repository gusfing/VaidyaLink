"""
Tests for DynamoDB Query Helpers
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dynamodb.query_helpers import (
    get_patient_scans,
    get_scans_by_status,
    get_hitl_queue,
    get_patient_by_abha,
    get_scan_job,
    get_batch_scan_jobs,
    get_patient,
    get_all_patient_scans,
)


@pytest.fixture
def mock_dynamodb_table():
    """Mock DynamoDB table"""
    with patch('dynamodb.query_helpers.dynamodb') as mock_db:
        mock_table = MagicMock()
        mock_db.Table.return_value = mock_table
        yield mock_table


@pytest.fixture
def mock_batch_get():
    """Mock batch_get_item"""
    with patch('dynamodb.query_helpers.dynamodb.batch_get_item') as mock_batch:
        yield mock_batch


class TestGetPatientScans:
    def test_query_patient_scans_using_patient_index(self, mock_dynamodb_table):
        """Test querying patient scans using PatientIndex"""
        mock_items = [
            {'jobId': 'job-1', 'patientId': 'patient-123', 'status': 'completed'},
            {'jobId': 'job-2', 'patientId': 'patient-123', 'status': 'completed'},
        ]

        mock_dynamodb_table.query.return_value = {
            'Items': mock_items,
            'Count': 2,
        }

        result = get_patient_scans('patient-123')

        assert result['items'] == mock_items
        assert result['count'] == 2
        assert mock_dynamodb_table.query.called

        # Verify index name
        call_kwargs = mock_dynamodb_table.query.call_args[1]
        assert call_kwargs['IndexName'] == 'PatientIndex'

    def test_support_date_range_filtering(self, mock_dynamodb_table):
        """Test date range filtering"""
        mock_dynamodb_table.query.return_value = {
            'Items': [],
            'Count': 0,
        }

        get_patient_scans('patient-123', start_date='2024-01-01T00:00:00Z')

        # Verify date condition was added
        call_kwargs = mock_dynamodb_table.query.call_args[1]
        assert 'KeyConditionExpression' in call_kwargs

    def test_support_pagination(self, mock_dynamodb_table):
        """Test pagination support"""
        last_key = {'PK': 'JOB#job-1', 'SK': 'METADATA'}

        mock_dynamodb_table.query.return_value = {
            'Items': [],
            'LastEvaluatedKey': last_key,
        }

        result = get_patient_scans('patient-123', last_evaluated_key=last_key)

        assert result['last_evaluated_key'] == last_key

        # Verify ExclusiveStartKey was passed
        call_kwargs = mock_dynamodb_table.query.call_args[1]
        assert call_kwargs['ExclusiveStartKey'] == last_key


class TestGetScansByStatus:
    def test_query_scans_by_status_using_status_index(self, mock_dynamodb_table):
        """Test querying scans by status using StatusIndex"""
        mock_items = [
            {'jobId': 'job-1', 'status': 'hitl_required'},
            {'jobId': 'job-2', 'status': 'hitl_required'},
        ]

        mock_dynamodb_table.query.return_value = {
            'Items': mock_items,
            'Count': 2,
        }

        result = get_scans_by_status('hitl_required')

        assert result['items'] == mock_items
        assert result['count'] == 2

        # Verify index name
        call_kwargs = mock_dynamodb_table.query.call_args[1]
        assert call_kwargs['IndexName'] == 'StatusIndex'

    def test_use_fifo_ordering_by_default(self, mock_dynamodb_table):
        """Test FIFO ordering (oldest first)"""
        mock_dynamodb_table.query.return_value = {'Items': []}

        get_scans_by_status('pending')

        # Verify ascending order
        call_kwargs = mock_dynamodb_table.query.call_args[1]
        assert call_kwargs['ScanIndexForward'] is True


class TestGetHITLQueue:
    def test_return_jobs_requiring_hitl_verification(self, mock_dynamodb_table):
        """Test getting HITL queue"""
        mock_items = [
            {'jobId': 'job-1', 'status': 'hitl_required', 'confidenceScores': {'field1': 0.75}},
        ]

        mock_dynamodb_table.query.return_value = {'Items': mock_items}

        result = get_hitl_queue()

        assert result == mock_items


class TestGetPatientByABHA:
    def test_find_patient_by_abha_id_using_abha_index(self, mock_dynamodb_table):
        """Test finding patient by ABHA ID using ABHAIndex"""
        mock_patient = {
            'patientId': 'patient-123',
            'abhaId': '12-3456-7890-1234',
            'name': 'Test Patient',
        }

        mock_dynamodb_table.query.return_value = {'Items': [mock_patient]}

        result = get_patient_by_abha('12-3456-7890-1234')

        assert result == mock_patient

        # Verify index name
        call_kwargs = mock_dynamodb_table.query.call_args[1]
        assert call_kwargs['IndexName'] == 'ABHAIndex'

    def test_return_none_if_patient_not_found(self, mock_dynamodb_table):
        """Test returning None when patient not found"""
        mock_dynamodb_table.query.return_value = {'Items': []}

        result = get_patient_by_abha('non-existent')

        assert result is None


class TestGetScanJob:
    def test_get_scan_job_by_id_using_primary_key(self, mock_dynamodb_table):
        """Test getting scan job by ID using primary key"""
        mock_job = {
            'PK': 'JOB#job-123',
            'SK': 'METADATA',
            'jobId': 'job-123',
            'status': 'completed',
        }

        mock_dynamodb_table.get_item.return_value = {'Item': mock_job}

        result = get_scan_job('job-123')

        assert result == mock_job

        # Verify primary key structure
        call_kwargs = mock_dynamodb_table.get_item.call_args[1]
        assert call_kwargs['Key']['PK'] == 'JOB#job-123'
        assert call_kwargs['Key']['SK'] == 'METADATA'


class TestGetBatchScanJobs:
    def test_get_multiple_jobs_using_batch_get_item(self, mock_batch_get):
        """Test getting multiple jobs using batch_get_item"""
        mock_jobs = [
            {'jobId': 'job-1', 'status': 'completed'},
            {'jobId': 'job-2', 'status': 'completed'},
        ]

        mock_batch_get.return_value = {
            'Responses': {
                'vaidyalink-scanjobs-dev': mock_jobs,
            }
        }

        result = get_batch_scan_jobs(['job-1', 'job-2'])

        assert result == mock_jobs

    def test_throw_error_if_more_than_25_job_ids_provided(self):
        """Test error when more than 25 job IDs provided"""
        job_ids = [f'job-{i}' for i in range(26)]

        with pytest.raises(ValueError, match='maximum 25 items'):
            get_batch_scan_jobs(job_ids)

    def test_return_empty_array_for_empty_input(self):
        """Test returning empty array for empty input"""
        result = get_batch_scan_jobs([])
        assert result == []


class TestGetAllPatientScans:
    def test_paginate_through_all_items(self, mock_dynamodb_table):
        """Test pagination through all items"""
        # Mock two pages of results
        mock_dynamodb_table.query.side_effect = [
            {
                'Items': [{'jobId': f'job-{i}'} for i in range(100)],
                'LastEvaluatedKey': {'PK': 'JOB#job-99'},
            },
            {
                'Items': [{'jobId': f'job-{i}'} for i in range(100, 150)],
                'LastEvaluatedKey': None,
            },
        ]

        result = get_all_patient_scans('patient-123')

        assert len(result) == 150
        assert mock_dynamodb_table.query.call_count == 2

    def test_respect_max_items_limit(self, mock_dynamodb_table):
        """Test respecting max_items limit"""
        # Mock infinite pagination
        mock_dynamodb_table.query.return_value = {
            'Items': [{'jobId': f'job-{i}'} for i in range(100)],
            'LastEvaluatedKey': {'PK': 'JOB#job-99'},
        }

        result = get_all_patient_scans('patient-123', max_items=150)

        # Should stop after 200 items (2 pages)
        assert len(result) <= 200


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
