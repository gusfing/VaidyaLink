"""
Unit tests for FHIR Transformer Lambda handler
"""

import json
import pytest
from unittest.mock import Mock, patch
from datetime import datetime

# Import the handler
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from index import lambda_handler, handle_transform, handle_export, handle_validate, FHIRTransformerError


class TestLambdaHandler:
    """Test cases for main Lambda handler"""

    def test_handler_with_transform_operation(self):
        """Test handler with transform operation"""
        event = {
            'operation': 'transform',
            'patientId': 'patient-123',
            'jobId': 'job-456',
            'data': {
                'patientData': {'name': 'Test Patient'}
            }
        }
        context = Mock()

        response = lambda_handler(event, context)

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['patientId'] == 'patient-123'
        assert body['jobId'] == 'job-456'
        assert 'timestamp' in body

    def test_handler_with_export_operation(self):
        """Test handler with export operation"""
        event = {
            'operation': 'export',
            'patientId': 'patient-123',
            'options': {
                'exportFormat': 'json'
            }
        }
        context = Mock()

        response = lambda_handler(event, context)

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['patientId'] == 'patient-123'
        assert body['format'] == 'json'

    def test_handler_with_validate_operation(self):
        """Test handler with validate operation"""
        event = {
            'operation': 'validate',
            'data': {
                'patientData': {'name': 'Test Patient'}
            }
        }
        context = Mock()

        response = lambda_handler(event, context)

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['valid'] is True
        assert 'errors' in body
        assert 'warnings' in body

    def test_handler_with_unknown_operation(self):
        """Test handler with unknown operation"""
        event = {
            'operation': 'unknown'
        }
        context = Mock()

        response = lambda_handler(event, context)

        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert body['error'] == 'FHIRTransformerError'

    def test_handler_with_missing_operation_defaults_to_transform(self):
        """Test handler defaults to transform when operation is missing"""
        event = {
            'patientId': 'patient-123',
            'jobId': 'job-456',
            'data': {}
        }
        context = Mock()

        response = lambda_handler(event, context)

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert 'message' in body


class TestHandleTransform:
    """Test cases for transform handler"""

    def test_transform_with_valid_data(self):
        """Test transform with valid clinical data"""
        event = {
            'patientId': 'patient-123',
            'jobId': 'job-456',
            'data': {
                'patientData': {'name': 'Test Patient'},
                'medications': [{'name': 'Aspirin'}]
            },
            'options': {}
        }
        context = Mock()

        response = handle_transform(event, context)

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['patientId'] == 'patient-123'
        assert body['jobId'] == 'job-456'
        assert 'resourceIds' in body

    def test_transform_without_patient_id_raises_error(self):
        """Test transform without patientId raises error"""
        event = {
            'data': {}
        }
        context = Mock()

        with pytest.raises(FHIRTransformerError, match="patientId is required"):
            handle_transform(event, context)


class TestHandleExport:
    """Test cases for export handler"""

    def test_export_with_valid_patient_id(self):
        """Test export with valid patient ID"""
        event = {
            'patientId': 'patient-123',
            'options': {
                'exportFormat': 'json'
            }
        }
        context = Mock()

        response = handle_export(event, context)

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['patientId'] == 'patient-123'
        assert body['format'] == 'json'

    def test_export_without_patient_id_raises_error(self):
        """Test export without patientId raises error"""
        event = {
            'options': {}
        }
        context = Mock()

        with pytest.raises(FHIRTransformerError, match="patientId is required"):
            handle_export(event, context)

    def test_export_defaults_to_json_format(self):
        """Test export defaults to JSON format"""
        event = {
            'patientId': 'patient-123',
            'options': {}
        }
        context = Mock()

        response = handle_export(event, context)

        body = json.loads(response['body'])
        assert body['format'] == 'json'


class TestHandleValidate:
    """Test cases for validate handler"""

    def test_validate_with_fhir_resources(self):
        """Test validation with FHIR resources"""
        event = {
            'data': {
                'patientData': {'name': 'Test Patient'},
                'medications': []
            }
        }
        context = Mock()

        response = handle_validate(event, context)

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert 'valid' in body
        assert 'errors' in body
        assert 'warnings' in body


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
