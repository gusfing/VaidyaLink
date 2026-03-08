"""
Tests for FHIR Bundle Export Functionality

Tests the handle_export function and bundle generation for patient data export.
"""

import json
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Mock the imports before importing the module
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, '/opt/python')

# Import the handler
from index import handle_export, FHIRTransformerError


class TestFHIRBundleExport:
    """Test suite for FHIR bundle export functionality"""

    @pytest.fixture
    def mock_healthlake_store(self):
        """Mock HealthLakeStore"""
        with patch('index.HealthLakeStore') as mock:
            store_instance = Mock()
            mock.return_value = store_instance

            # Mock patient resources
            store_instance.get_patient_resources.return_value = {
                'Observation': [
                    {
                        'resourceType': 'Observation',
                        'id': 'obs-1',
                        'status': 'final',
                        'code': {'text': 'Blood Pressure'}
                    },
                    {
                        'resourceType': 'Observation',
                        'id': 'obs-2',
                        'status': 'final',
                        'code': {'text': 'Heart Rate'}
                    }
                ],
                'MedicationStatement': [
                    {
                        'resourceType': 'MedicationStatement',
                        'id': 'med-1',
                        'status': 'active',
                        'medication': {'text': 'Aspirin'}
                    }
                ],
                'Encounter': [],
                'Condition': [],
                'Procedure': [],
                'DiagnosticReport': [],
                'AllergyIntolerance': []
            }

            # Mock patient resource read
            store_instance.client.read_resource.return_value = {
                'resourceType': 'Patient',
                'id': 'patient-123',
                'name': [{'text': 'John Doe'}]
            }

            yield store_instance

    @pytest.fixture
    def mock_fhir_builder(self):
        """Mock FHIRResourceBuilder"""
        with patch('index.FHIRResourceBuilder') as mock:
            builder_instance = Mock()
            mock.return_value = builder_instance

            # Mock bundle creation
            mock_bundle = Mock()
            mock_bundle.dict.return_value = {
                'resourceType': 'Bundle',
                'type': 'collection',
                'entry': []
            }
            builder_instance.create_bundle.return_value = mock_bundle
            builder_instance.resource_to_json.return_value = json.dumps({
                'resourceType': 'Bundle',
                'type': 'collection',
                'entry': []
            })

            yield builder_instance

    @pytest.fixture
    def mock_s3_client(self):
        """Mock S3 client"""
        with patch('index.boto3.client') as mock:
            s3_instance = Mock()
            mock.return_value = s3_instance

            # Mock S3 operations
            s3_instance.put_object.return_value = {'ETag': '"abc123"'}
            s3_instance.generate_presigned_url.return_value = 'https://s3.amazonaws.com/bucket/key?signature=xyz'

            yield s3_instance

    @pytest.fixture
    def mock_config(self):
        """Mock Config"""
        with patch('index.Config') as mock:
            mock.S3_BUCKET = 'test-bucket'
            yield mock

    def test_export_json_success(self, mock_healthlake_store, mock_fhir_builder, mock_s3_client, mock_config):
        """Test successful JSON export"""
        event = {
            'patientId': 'patient-123',
            'options': {
                'exportFormat': 'json',
                'bundleType': 'collection'
            }
        }
        context = Mock()

        result = handle_export(event, context)

        # Verify response
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['message'] == 'FHIR export completed successfully'
        assert body['patientId'] == 'patient-123'
        assert body['format'] == 'json'
        assert body['bundleType'] == 'collection'
        assert body['resourceCount'] == 4  # 1 Patient + 2 Observations + 1 MedicationStatement
        assert 'downloadUrl' in body
        assert 's3Location' in body

        # Verify HealthLake was queried
        mock_healthlake_store.get_patient_resources.assert_called_once_with('patient-123')
        mock_healthlake_store.client.read_resource.assert_called_once_with('Patient', 'patient-123')

        # Verify bundle was created
        mock_fhir_builder.create_bundle.assert_called_once()
        bundle_resources = mock_fhir_builder.create_bundle.call_args[0][0]
        assert len(bundle_resources) == 4

        # Verify S3 upload
        mock_s3_client.put_object.assert_called_once()
        put_call = mock_s3_client.put_object.call_args
        assert put_call[1]['Bucket'] == 'test-bucket'
        assert 'exports/patient-123/' in put_call[1]['Key']
        assert put_call[1]['ContentType'] == 'application/fhir+json'

    def test_export_without_patient_resource(self, mock_healthlake_store, mock_fhir_builder, mock_s3_client, mock_config):
        """Test export excluding Patient resource"""
        event = {
            'patientId': 'patient-123',
            'options': {
                'exportFormat': 'json',
                'includePatient': False
            }
        }
        context = Mock()

        result = handle_export(event, context)

        # Verify Patient resource was not fetched
        mock_healthlake_store.client.read_resource.assert_not_called()

        # Verify response
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['resourceCount'] == 3  # Only 2 Observations + 1 MedicationStatement

    def test_export_with_resource_type_filter(self, mock_healthlake_store, mock_fhir_builder, mock_s3_client, mock_config):
        """Test export with specific resource types"""
        event = {
            'patientId': 'patient-123',
            'options': {
                'exportFormat': 'json',
                'includePatient': True,
                'resourceTypes': ['Observation']
            }
        }
        context = Mock()

        result = handle_export(event, context)

        # Verify response
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['resourceCount'] == 3  # 1 Patient + 2 Observations only
        assert body['resourceCountByType'] == {'Observation': 2}

    def test_export_xml_format(self, mock_healthlake_store, mock_fhir_builder, mock_s3_client, mock_config):
        """Test XML export format (currently exports as JSON with warning)"""
        event = {
            'patientId': 'patient-123',
            'options': {
                'exportFormat': 'xml'
            }
        }
        context = Mock()

        result = handle_export(event, context)

        # Verify response
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['format'] == 'xml'

        # Verify S3 upload - currently uses JSON format
        put_call = mock_s3_client.put_object.call_args
        assert '.json' in put_call[1]['Key']  # Currently exports as JSON
        assert put_call[1]['ContentType'] == 'application/fhir+json'  # Currently JSON

    def test_export_no_patient_id(self):
        """Test export without patient ID"""
        event = {
            'options': {
                'exportFormat': 'json'
            }
        }
        context = Mock()

        with pytest.raises(FHIRTransformerError) as exc_info:
            handle_export(event, context)

        assert 'patientId is required' in str(exc_info.value)

    def test_export_invalid_format(self):
        """Test export with invalid format"""
        event = {
            'patientId': 'patient-123',
            'options': {
                'exportFormat': 'pdf'
            }
        }
        context = Mock()

        with pytest.raises(FHIRTransformerError) as exc_info:
            handle_export(event, context)

        assert 'Invalid export format' in str(exc_info.value)

    def test_export_invalid_bundle_type(self):
        """Test export with invalid bundle type"""
        event = {
            'patientId': 'patient-123',
            'options': {
                'bundleType': 'invalid'
            }
        }
        context = Mock()

        with pytest.raises(FHIRTransformerError) as exc_info:
            handle_export(event, context)

        assert 'Invalid bundle type' in str(exc_info.value)

    def test_export_no_resources_found(self, mock_healthlake_store, mock_fhir_builder, mock_config):
        """Test export when no resources exist for patient"""
        # Mock empty resources
        mock_healthlake_store.get_patient_resources.return_value = {
            'Observation': [],
            'MedicationStatement': [],
            'Encounter': [],
            'Condition': [],
            'Procedure': [],
            'DiagnosticReport': [],
            'AllergyIntolerance': []
        }
        mock_healthlake_store.client.read_resource.side_effect = Exception("Patient not found")

        event = {
            'patientId': 'patient-999',
            'options': {
                'exportFormat': 'json'
            }
        }
        context = Mock()

        result = handle_export(event, context)

        # Verify 404 response
        assert result['statusCode'] == 404
        body = json.loads(result['body'])
        assert body['error'] == 'NoResourcesFound'
        assert 'patient-999' in body['message']

    def test_export_s3_failure(self, mock_healthlake_store, mock_fhir_builder, mock_s3_client, mock_config):
        """Test export when S3 upload fails"""
        mock_s3_client.put_object.side_effect = Exception("S3 upload failed")

        event = {
            'patientId': 'patient-123',
            'options': {
                'exportFormat': 'json'
            }
        }
        context = Mock()

        with pytest.raises(FHIRTransformerError) as exc_info:
            handle_export(event, context)

        assert 'Failed to store export bundle' in str(exc_info.value)

    def test_export_transaction_bundle_type(self, mock_healthlake_store, mock_fhir_builder, mock_s3_client, mock_config):
        """Test export with transaction bundle type"""
        event = {
            'patientId': 'patient-123',
            'options': {
                'exportFormat': 'json',
                'bundleType': 'transaction'
            }
        }
        context = Mock()

        result = handle_export(event, context)

        # Verify bundle type
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['bundleType'] == 'transaction'

        # Verify bundle was created with correct type
        mock_fhir_builder.create_bundle.assert_called_once()
        call_args = mock_fhir_builder.create_bundle.call_args
        assert call_args[1]['bundle_type'] == 'transaction'

    def test_export_resource_count_by_type(self, mock_healthlake_store, mock_fhir_builder, mock_s3_client, mock_config):
        """Test that resource counts by type are correctly reported"""
        event = {
            'patientId': 'patient-123',
            'options': {
                'exportFormat': 'json',
                'includePatient': False
            }
        }
        context = Mock()

        result = handle_export(event, context)

        # Verify resource count breakdown
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['resourceCountByType'] == {
            'Observation': 2,
            'MedicationStatement': 1
        }

    def test_export_s3_metadata(self, mock_healthlake_store, mock_fhir_builder, mock_s3_client, mock_config):
        """Test that S3 object metadata is correctly set"""
        event = {
            'patientId': 'patient-123',
            'options': {
                'exportFormat': 'json',
                'bundleType': 'collection'
            }
        }
        context = Mock()

        result = handle_export(event, context)

        # Verify S3 metadata
        put_call = mock_s3_client.put_object.call_args
        metadata = put_call[1]['Metadata']
        assert metadata['patient-id'] == 'patient-123'
        assert metadata['bundle-type'] == 'collection'
        assert metadata['resource-count'] == '4'
        assert 'export-timestamp' in metadata

    def test_export_presigned_url_expiration(self, mock_healthlake_store, mock_fhir_builder, mock_s3_client, mock_config):
        """Test that presigned URL has correct expiration"""
        event = {
            'patientId': 'patient-123',
            'options': {
                'exportFormat': 'json'
            }
        }
        context = Mock()

        result = handle_export(event, context)

        # Verify presigned URL generation
        mock_s3_client.generate_presigned_url.assert_called_once()
        call_args = mock_s3_client.generate_presigned_url.call_args
        assert call_args[1]['ExpiresIn'] == 3600  # 1 hour

        # Verify response includes expiration info
        body = json.loads(result['body'])
        assert body['expiresIn'] == 3600


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
