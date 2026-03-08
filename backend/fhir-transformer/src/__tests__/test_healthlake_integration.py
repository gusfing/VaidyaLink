"""
Unit tests for HealthLake integration in FHIR Transformer
"""

import pytest
import json
import os
import sys
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utils.healthlake_store import HealthLakeStore
from utils.fhir_builder import FHIRResourceBuilder


class TestHealthLakeStore:
    """Test suite for HealthLakeStore class"""

    @pytest.fixture
    def mock_healthlake_client(self):
        """Mock HealthLake client"""
        with patch('utils.healthlake_store.HealthLakeClient') as mock_client:
            yield mock_client

    @pytest.fixture
    def healthlake_store(self, mock_healthlake_client):
        """Create HealthLakeStore instance with mocked client"""
        with patch.dict(os.environ, {
            'HEALTHLAKE_DATASTORE_ID': 'test-datastore-123',
            'HEALTHLAKE_ENDPOINT': 'https://healthlake.test.amazonaws.com',
            'AWS_REGION': 'us-east-1'
        }):
            store = HealthLakeStore()
            return store

    @pytest.fixture
    def sample_patient_resource(self):
        """Create sample Patient FHIR resource"""
        builder = FHIRResourceBuilder()
        patient_data = {
            'patientId': 'patient-123',
            'name': 'Test Patient',
            'gender': 'male',
            'birthDate': '1990-01-01',
            'phone': '+91-9876543210'
        }
        return builder.create_patient(patient_data)

    @pytest.fixture
    def sample_medication_resource(self):
        """Create sample MedicationStatement FHIR resource"""
        builder = FHIRResourceBuilder()
        medication_data = {
            'medicationName': 'Paracetamol',
            'status': 'active',
            'dosage': {
                'text': 'One tablet twice daily',
                'doseValue': 500,
                'doseUnit': 'mg',
                'frequency': 2,
                'period': 1,
                'periodUnit': 'd'
            }
        }
        return builder.create_medication_statement(medication_data, 'Patient/patient-123')

    def test_store_initialization(self, mock_healthlake_client):
        """Test HealthLakeStore initialization"""
        with patch.dict(os.environ, {
            'HEALTHLAKE_DATASTORE_ID': 'test-datastore-123',
            'HEALTHLAKE_ENDPOINT': 'https://healthlake.test.amazonaws.com',
            'AWS_REGION': 'us-east-1',
            'AWS_ACCOUNT_ID': 'test-account'
        }):
            # Need to reload config after setting env vars
            import importlib
            import config
            importlib.reload(config)

            store = HealthLakeStore(
                datastore_id='test-datastore-123',
                datastore_endpoint='https://healthlake.test.amazonaws.com',
                region='us-east-1'
            )

            # Check that client was initialized
            mock_healthlake_client.assert_called_once()


    def test_store_single_resource_success(self, healthlake_store, sample_patient_resource):
        """Test successful storage of a single resource"""
        # Mock successful response
        healthlake_store.client.create_resource = Mock(return_value={
            'id': 'patient-456',
            'resourceType': 'Patient',
            'meta': {'versionId': '1'}
        })

        success, resource_id, error = healthlake_store.store_resource(sample_patient_resource)

        assert success is True
        assert resource_id == 'patient-456'
        assert error is None
        healthlake_store.client.create_resource.assert_called_once()

    def test_store_single_resource_failure(self, healthlake_store, sample_patient_resource):
        """Test failed storage of a single resource"""
        # Mock failure
        healthlake_store.client.create_resource = Mock(
            side_effect=Exception("HealthLake API error")
        )

        success, resource_id, error = healthlake_store.store_resource(
            sample_patient_resource,
            retry_count=2
        )

        assert success is False
        assert resource_id is None
        assert "HealthLake API error" in error
        assert healthlake_store.client.create_resource.call_count == 2  # Retried

    def test_store_single_resource_retry_success(self, healthlake_store, sample_patient_resource):
        """Test successful storage after retry"""
        # Mock failure then success
        healthlake_store.client.create_resource = Mock(
            side_effect=[
                Exception("Temporary error"),
                {'id': 'patient-789', 'resourceType': 'Patient'}
            ]
        )

        success, resource_id, error = healthlake_store.store_resource(
            sample_patient_resource,
            retry_count=3
        )

        assert success is True
        assert resource_id == 'patient-789'
        assert error is None
        assert healthlake_store.client.create_resource.call_count == 2

    def test_store_resources_batch_all_success(
        self,
        healthlake_store,
        sample_patient_resource,
        sample_medication_resource
    ):
        """Test batch storage with all resources succeeding"""
        resources = [sample_patient_resource, sample_medication_resource]

        # Mock successful responses
        healthlake_store.client.create_resource = Mock(side_effect=[
            {'id': 'patient-111', 'resourceType': 'Patient'},
            {'id': 'med-222', 'resourceType': 'MedicationStatement'}
        ])

        results = healthlake_store.store_resources_batch(resources)

        assert results['total'] == 2
        assert results['successful'] == 2
        assert results['failed'] == 0
        assert len(results['resource_ids']) == 2
        assert 'Patient/patient-111' in results['resource_ids']
        assert 'MedicationStatement/med-222' in results['resource_ids']
        assert len(results['errors']) == 0

    def test_store_resources_batch_partial_failure(
        self,
        healthlake_store,
        sample_patient_resource,
        sample_medication_resource
    ):
        """Test batch storage with some resources failing"""
        resources = [sample_patient_resource, sample_medication_resource]

        # Mock mixed responses
        healthlake_store.client.create_resource = Mock(side_effect=[
            {'id': 'patient-333', 'resourceType': 'Patient'},
            Exception("Medication storage failed")
        ])

        results = healthlake_store.store_resources_batch(resources)

        assert results['total'] == 2
        assert results['successful'] == 1
        assert results['failed'] == 1
        assert len(results['resource_ids']) == 1
        assert 'Patient/patient-333' in results['resource_ids']
        assert len(results['errors']) == 1
        assert results['errors'][0]['resourceType'] == 'MedicationStatement'

    def test_store_resources_batch_empty_list(self, healthlake_store):
        """Test batch storage with empty resource list"""
        results = healthlake_store.store_resources_batch([])

        assert results['total'] == 0
        assert results['successful'] == 0
        assert results['failed'] == 0
        assert len(results['resource_ids']) == 0

    def test_get_patient_resources(self, healthlake_store):
        """Test retrieving all resources for a patient"""
        mock_resources = {
            'Observation': [
                {'id': 'obs-1', 'resourceType': 'Observation'},
                {'id': 'obs-2', 'resourceType': 'Observation'}
            ],
            'MedicationStatement': [
                {'id': 'med-1', 'resourceType': 'MedicationStatement'}
            ]
        }

        healthlake_store.client.get_patient_resources = Mock(return_value=mock_resources)

        resources = healthlake_store.get_patient_resources('patient-123')

        assert 'Observation' in resources
        assert len(resources['Observation']) == 2
        assert 'MedicationStatement' in resources
        assert len(resources['MedicationStatement']) == 1
        healthlake_store.client.get_patient_resources.assert_called_once_with('patient-123')

    def test_search_resources(self, healthlake_store):
        """Test searching for resources"""
        mock_results = [
            {'id': 'obs-1', 'resourceType': 'Observation'},
            {'id': 'obs-2', 'resourceType': 'Observation'}
        ]

        healthlake_store.client.search_resources = Mock(return_value=mock_results)

        results = healthlake_store.search_resources(
            'Observation',
            {'patient': 'patient-123', 'code': '8867-4'}
        )

        assert len(results) == 2
        assert results[0]['id'] == 'obs-1'
        healthlake_store.client.search_resources.assert_called_once()

    def test_update_resource(self, healthlake_store):
        """Test updating a resource"""
        updated_data = {
            'id': 'patient-123',
            'resourceType': 'Patient',
            'name': [{'text': 'Updated Name'}]
        }

        healthlake_store.client.update_resource = Mock(return_value=updated_data)

        result = healthlake_store.update_resource('Patient', 'patient-123', updated_data)

        assert result['id'] == 'patient-123'
        assert result['name'][0]['text'] == 'Updated Name'
        healthlake_store.client.update_resource.assert_called_once()

    def test_delete_resource(self, healthlake_store):
        """Test deleting a resource"""
        healthlake_store.client.delete_resource = Mock()

        healthlake_store.delete_resource('Patient', 'patient-123')

        healthlake_store.client.delete_resource.assert_called_once_with('Patient', 'patient-123')

    def test_store_resource_no_id_returned(self, healthlake_store, sample_patient_resource):
        """Test handling when HealthLake doesn't return an ID"""
        healthlake_store.client.create_resource = Mock(return_value={
            'resourceType': 'Patient'
            # No 'id' field
        })

        success, resource_id, error = healthlake_store.store_resource(sample_patient_resource)

        assert success is True
        assert resource_id is None
        assert error == "No ID returned"


class TestHealthLakeIntegrationInHandler:
    """Test HealthLake integration in the main Lambda handler"""

    @pytest.fixture
    def mock_healthlake_store(self):
        """Mock HealthLakeStore"""
        with patch('index.HealthLakeStore') as mock_store:
            yield mock_store

    @pytest.fixture
    def sample_event(self):
        """Sample Lambda event"""
        return {
            'operation': 'transform',
            'patientId': 'patient-123',
            'jobId': 'job-456',
            'data': {
                'patientData': {
                    'patientId': 'patient-123',
                    'name': 'Test Patient',
                    'gender': 'male',
                    'birthDate': '1990-01-01'
                },
                'medications': [
                    {
                        'medicationName': 'Paracetamol',
                        'status': 'active',
                        'dosage': {
                            'text': 'One tablet twice daily'
                        }
                    }
                ]
            }
        }

    def test_handler_stores_resources_in_healthlake(
        self,
        mock_healthlake_store,
        sample_event
    ):
        """Test that handler successfully stores resources in HealthLake"""
        # Mock successful storage
        mock_store_instance = Mock()
        mock_store_instance.store_resources_batch = Mock(return_value={
            'total': 2,
            'successful': 2,
            'failed': 0,
            'resource_ids': ['Patient/patient-123', 'MedicationStatement/med-456'],
            'errors': []
        })
        mock_healthlake_store.return_value = mock_store_instance

        # Import and call handler
        from index import handle_transform

        response = handle_transform(sample_event, {})

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['resourceCount'] == 2
        assert len(body['resourceIds']) == 2
        mock_store_instance.store_resources_batch.assert_called_once()

    def test_handler_handles_partial_storage_failure(
        self,
        mock_healthlake_store,
        sample_event
    ):
        """Test handler handles partial storage failures gracefully"""
        # Mock partial failure
        mock_store_instance = Mock()
        mock_store_instance.store_resources_batch = Mock(return_value={
            'total': 2,
            'successful': 1,
            'failed': 1,
            'resource_ids': ['Patient/patient-123'],
            'errors': [{'resourceType': 'MedicationStatement', 'error': 'Storage failed'}]
        })
        mock_healthlake_store.return_value = mock_store_instance

        from index import handle_transform

        response = handle_transform(sample_event, {})

        # Should still return success if at least one resource stored
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert len(body['resourceIds']) == 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

