"""
Unit tests for Clinical Summarizer Lambda handler
"""

import json
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Import handler functions
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from index import (
    lambda_handler,
    generate_clinical_summary,
    query_patient_resources,
    aggregate_clinical_data,
    generate_summary_with_bedrock,
    format_summary,
    get_cached_summary,
    cache_summary,
    ClinicalSummarizerError,
    HealthLakeQueryError,
    BedrockSummarizationError
)


class TestLambdaHandler:
    """Tests for main Lambda handler"""

    def test_handler_missing_patient_id(self):
        """Test handler with missing patient ID"""
        event = {}
        context = Mock(request_id='test-123')

        response = lambda_handler(event, context)

        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'error' in body
        assert body['error'] == 'ClinicalSummarizerError'
        assert 'patientId is required' in body['message']

    def test_handler_with_valid_patient_id(self):
        """Test handler with valid patient ID"""
        event = {
            'patientId': 'patient-123',
            'options': {
                'maxWords': 200
            }
        }
        context = Mock(request_id='test-123')

        with patch('index.get_cached_summary', return_value=None), \
             patch('index.generate_clinical_summary') as mock_generate, \
             patch('index.cache_summary'):

            mock_generate.return_value = {
                'patientId': 'patient-123',
                'summary': 'Test summary',
                'confidenceScores': {'overall': 0.85},
                'metadata': {
                    'resourceCount': 5,
                    'generatedAt': datetime.utcnow().isoformat(),
                    'processingTimeMs': 100
                }
            }

            response = lambda_handler(event, context)

            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert 'summary' in body
            assert body['cached'] is False
            assert body['summary']['patientId'] == 'patient-123'

    def test_handler_returns_cached_summary(self):
        """Test handler returns cached summary when available"""
        event = {
            'patientId': 'patient-123',
            'options': {}
        }
        context = Mock(request_id='test-123')

        cached_summary = {
            'patientId': 'patient-123',
            'summary': 'Cached summary',
            'confidenceScores': {'overall': 0.85},
            'metadata': {
                'resourceCount': 5,
                'generatedAt': datetime.utcnow().isoformat(),
                'processingTimeMs': 100
            }
        }

        with patch('index.ENABLE_SUMMARY_CACHE', True), \
             patch('index.get_cached_summary', return_value=cached_summary):

            response = lambda_handler(event, context)

            assert response['statusCode'] == 200
            body = json.loads(response['body'])
            assert body['cached'] is True
            assert body['summary'] == cached_summary

    def test_handler_internal_error(self):
        """Test handler handles unexpected errors"""
        event = {
            'patientId': 'patient-123'
        }
        context = Mock(request_id='test-123')

        with patch('index.get_cached_summary', side_effect=Exception('Unexpected error')):
            response = lambda_handler(event, context)

            assert response['statusCode'] == 500
            body = json.loads(response['body'])
            assert body['error'] == 'InternalError'


class TestGenerateClinicalSummary:
    """Tests for generate_clinical_summary function"""

    def test_generate_summary_no_resources(self):
        """Test summary generation with no FHIR resources"""
        patient_id = 'patient-123'
        options = {}

        with patch('index.query_patient_resources', return_value=[]):
            summary = generate_clinical_summary(patient_id, options)

            assert summary['patientId'] == patient_id
            assert 'No clinical data available' in summary['summary']
            assert summary['metadata']['resourceCount'] == 0

    def test_generate_summary_with_resources(self):
        """Test summary generation with FHIR resources"""
        patient_id = 'patient-123'
        options = {'maxWords': 200}

        mock_resources = [
            {'resourceType': 'Patient', 'id': 'patient-123'},
            {'resourceType': 'Condition', 'id': 'condition-1'}
        ]

        mock_aggregated = {
            'patient': {'id': 'patient-123'},
            'conditions': [{'id': 'condition-1'}],
            'medications': [],
            'encounters': []
        }

        mock_summary_text = 'Test clinical summary'
        mock_confidence = {'overall': 0.85}

        with patch('index.query_patient_resources', return_value=mock_resources), \
             patch('index.aggregate_clinical_data', return_value=mock_aggregated), \
             patch('index.generate_summary_with_bedrock', return_value=(mock_summary_text, mock_confidence)), \
             patch('index.format_summary', return_value=mock_summary_text):

            summary = generate_clinical_summary(patient_id, options)

            assert summary['patientId'] == patient_id
            assert summary['summary'] == mock_summary_text
            assert summary['confidenceScores'] == mock_confidence
            assert summary['metadata']['resourceCount'] == 2
            assert 'processingTimeMs' in summary['metadata']


class TestQueryPatientResources:
    """Tests for query_patient_resources function"""

    @patch.dict(os.environ, {
        'HEALTHLAKE_DATASTORE_ID': 'test-datastore-id',
        'HEALTHLAKE_DATASTORE_ENDPOINT': 'https://test-endpoint.amazonaws.com'
    })
    def test_query_patient_resources_success(self):
        """Test successful query of patient resources"""
        patient_id = 'patient-123'
        options = {}

        # Mock HealthLake client
        mock_client = Mock()
        mock_healthlake_class = Mock(return_value=mock_client)

        # Mock search results for different resource types
        mock_patient = {'resourceType': 'Patient', 'id': 'patient-123'}
        mock_encounter = {'resourceType': 'Encounter', 'id': 'enc-1', 'period': {'start': '2024-01-15'}}
        mock_condition = {'resourceType': 'Condition', 'id': 'cond-1'}
        mock_medication = {'resourceType': 'MedicationStatement', 'id': 'med-1', 'effectiveDateTime': '2024-01-15'}
        mock_allergy = {'resourceType': 'AllergyIntolerance', 'id': 'allergy-1'}
        mock_observation = {'resourceType': 'Observation', 'id': 'obs-1'}
        mock_diagnostic = {'resourceType': 'DiagnosticReport', 'id': 'diag-1'}

        def search_side_effect(resource_type, search_params):
            if resource_type == 'Patient':
                return [mock_patient]
            elif resource_type == 'Encounter':
                return [mock_encounter]
            elif resource_type == 'Condition':
                return [mock_condition]
            elif resource_type == 'MedicationStatement':
                return [mock_medication]
            elif resource_type == 'AllergyIntolerance':
                return [mock_allergy]
            elif resource_type == 'Observation':
                return [mock_observation]
            elif resource_type == 'DiagnosticReport':
                return [mock_diagnostic]
            return []

        mock_client.search_resources.side_effect = search_side_effect

        # Mock the healthlake module
        mock_healthlake_module = Mock()
        mock_healthlake_module.healthlake_client.HealthLakeClient = mock_healthlake_class

        with patch.dict('sys.modules', {'healthlake': mock_healthlake_module, 'healthlake.healthlake_client': mock_healthlake_module.healthlake_client}):
            resources = query_patient_resources(patient_id, options)

            # Verify all resource types were queried
            assert len(resources) == 7
            assert any(r['resourceType'] == 'Patient' for r in resources)
            assert any(r['resourceType'] == 'Encounter' for r in resources)
            assert any(r['resourceType'] == 'Condition' for r in resources)
            assert any(r['resourceType'] == 'MedicationStatement' for r in resources)
            assert any(r['resourceType'] == 'AllergyIntolerance' for r in resources)
            assert any(r['resourceType'] == 'Observation' for r in resources)
            assert any(r['resourceType'] == 'DiagnosticReport' for r in resources)

    @patch.dict(os.environ, {
        'HEALTHLAKE_DATASTORE_ID': 'test-datastore-id',
        'HEALTHLAKE_DATASTORE_ENDPOINT': 'https://test-endpoint.amazonaws.com'
    })
    def test_query_patient_resources_with_options(self):
        """Test query with specific options"""
        patient_id = 'patient-123'
        options = {
            'includeLabResults': False,
            'includeDiagnosticReports': False,
            'maxRecordAgeDays': 30
        }

        mock_client = Mock()
        mock_healthlake_class = Mock(return_value=mock_client)

        mock_patient = {'resourceType': 'Patient', 'id': 'patient-123'}
        mock_encounter = {'resourceType': 'Encounter', 'id': 'enc-1'}

        def search_side_effect(resource_type, search_params):
            # Verify date filter is applied
            if resource_type != 'Patient':
                assert 'date' in search_params
                assert search_params['date'].startswith('ge')

            if resource_type == 'Patient':
                return [mock_patient]
            elif resource_type == 'Encounter':
                return [mock_encounter]
            return []

        mock_client.search_resources.side_effect = search_side_effect

        # Mock the healthlake module
        mock_healthlake_module = Mock()
        mock_healthlake_module.healthlake_client.HealthLakeClient = mock_healthlake_class

        with patch.dict('sys.modules', {'healthlake': mock_healthlake_module, 'healthlake.healthlake_client': mock_healthlake_module.healthlake_client}):
            resources = query_patient_resources(patient_id, options)

            # Verify Observation and DiagnosticReport were not queried
            resource_types = [r['resourceType'] for r in resources]
            assert 'Observation' not in resource_types
            assert 'DiagnosticReport' not in resource_types

    @patch.dict(os.environ, {
        'HEALTHLAKE_DATASTORE_ID': 'test-datastore-id',
        'HEALTHLAKE_DATASTORE_ENDPOINT': 'https://test-endpoint.amazonaws.com'
    })
    def test_query_patient_resources_limits_encounters(self):
        """Test that encounter results are limited to MAX_RECENT_ENCOUNTERS"""
        patient_id = 'patient-123'
        options = {}

        mock_client = Mock()
        mock_healthlake_class = Mock(return_value=mock_client)

        # Create more encounters than the limit
        mock_encounters = [
            {'resourceType': 'Encounter', 'id': f'enc-{i}', 'period': {'start': f'2024-01-{i:02d}'}}
            for i in range(1, 15)
        ]

        def search_side_effect(resource_type, search_params):
            if resource_type == 'Encounter':
                return mock_encounters
            return []

        mock_client.search_resources.side_effect = search_side_effect

        # Mock the healthlake module
        mock_healthlake_module = Mock()
        mock_healthlake_module.healthlake_client.HealthLakeClient = mock_healthlake_class

        with patch('index.MAX_RECENT_ENCOUNTERS', 10):
            with patch.dict('sys.modules', {'healthlake': mock_healthlake_module, 'healthlake.healthlake_client': mock_healthlake_module.healthlake_client}):
                resources = query_patient_resources(patient_id, options)

                # Should only return MAX_RECENT_ENCOUNTERS
                encounters = [r for r in resources if r['resourceType'] == 'Encounter']
                assert len(encounters) <= 10

    @patch.dict(os.environ, {
        'HEALTHLAKE_DATASTORE_ID': 'test-datastore-id',
        'HEALTHLAKE_DATASTORE_ENDPOINT': 'https://test-endpoint.amazonaws.com'
    })
    def test_query_patient_resources_limits_medications(self):
        """Test that medication results are limited to MAX_MEDICATIONS"""
        patient_id = 'patient-123'
        options = {}

        mock_client = Mock()
        mock_healthlake_class = Mock(return_value=mock_client)

        # Create more medications than the limit
        mock_medications = [
            {'resourceType': 'MedicationStatement', 'id': f'med-{i}', 'effectiveDateTime': f'2024-01-{i:02d}'}
            for i in range(1, 20)
        ]

        def search_side_effect(resource_type, search_params):
            if resource_type == 'MedicationStatement':
                return mock_medications
            return []

        mock_client.search_resources.side_effect = search_side_effect

        # Mock the healthlake module
        mock_healthlake_module = Mock()
        mock_healthlake_module.healthlake_client.HealthLakeClient = mock_healthlake_class

        with patch('index.MAX_MEDICATIONS', 15):
            with patch.dict('sys.modules', {'healthlake': mock_healthlake_module, 'healthlake.healthlake_client': mock_healthlake_module.healthlake_client}):
                resources = query_patient_resources(patient_id, options)

                # Should only return MAX_MEDICATIONS
                medications = [r for r in resources if r['resourceType'] == 'MedicationStatement']
                assert len(medications) <= 15

    @patch.dict(os.environ, {
        'HEALTHLAKE_DATASTORE_ID': 'test-datastore-id',
        'HEALTHLAKE_DATASTORE_ENDPOINT': 'https://test-endpoint.amazonaws.com'
    })
    def test_query_patient_resources_handles_partial_failure(self):
        """Test that query continues even if one resource type fails"""
        patient_id = 'patient-123'
        options = {}

        mock_client = Mock()
        mock_healthlake_class = Mock(return_value=mock_client)

        mock_patient = {'resourceType': 'Patient', 'id': 'patient-123'}
        mock_condition = {'resourceType': 'Condition', 'id': 'cond-1'}

        def search_side_effect(resource_type, search_params):
            if resource_type == 'Patient':
                return [mock_patient]
            elif resource_type == 'Encounter':
                raise Exception('HealthLake error')
            elif resource_type == 'Condition':
                return [mock_condition]
            return []

        mock_client.search_resources.side_effect = search_side_effect

        # Mock the healthlake module
        mock_healthlake_module = Mock()
        mock_healthlake_module.healthlake_client.HealthLakeClient = mock_healthlake_class

        with patch.dict('sys.modules', {'healthlake': mock_healthlake_module, 'healthlake.healthlake_client': mock_healthlake_module.healthlake_client}):
            resources = query_patient_resources(patient_id, options)

            # Should still return Patient and Condition despite Encounter failure
            assert len(resources) >= 2
            assert any(r['resourceType'] == 'Patient' for r in resources)
            assert any(r['resourceType'] == 'Condition' for r in resources)

    def test_query_patient_resources_missing_env_vars(self):
        """Test handling of missing environment variables"""
        patient_id = 'patient-123'
        options = {}

        # Ensure env vars are not set
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(HealthLakeQueryError) as exc_info:
                query_patient_resources(patient_id, options)

            assert 'Unexpected error during HealthLake query' in str(exc_info.value)


class TestAggregateClinicalData:
    """Tests for aggregate_clinical_data function"""

    def test_aggregate_clinical_data_placeholder(self):
        """Test aggregate_clinical_data returns structured data (placeholder)"""
        fhir_resources = [
            {'resourceType': 'Patient', 'id': 'patient-123'},
            {'resourceType': 'Condition', 'id': 'condition-1'}
        ]
        options = {}

        aggregated = aggregate_clinical_data(fhir_resources, options)

        assert isinstance(aggregated, dict)
        assert 'patient' in aggregated
        assert 'conditions' in aggregated
        assert 'medications' in aggregated
        assert 'encounters' in aggregated


class TestGenerateSummaryWithBedrock:
    """Tests for generate_summary_with_bedrock function"""

    @patch('boto3.client')
    def test_generate_summary_with_bedrock_placeholder(self, mock_boto_client):
        """Test generate_summary_with_bedrock with mocked Bedrock"""
        # Mock Bedrock response
        mock_bedrock = MagicMock()
        mock_boto_client.return_value = mock_bedrock

        mock_response = {
            'body': MagicMock()
        }
        mock_response['body'].read.return_value = json.dumps({
            'content': [
                {
                    'text': """## Chronic Conditions
- None

## Current Medications
- None

## Allergies
- None

## Recent Visits
- None

## Overall Confidence Score
85%"""
                }
            ],
            'stop_reason': 'end_turn'
        }).encode()
        mock_bedrock.invoke_model.return_value = mock_response

        patient_id = 'patient-123'
        aggregated_data = {
            'patient': {'name': 'Test Patient', 'age': 30, 'gender': 'male'},
            'criticalInformation': {
                'chronicConditions': [],
                'currentMedications': [],
                'criticalAllergies': [],
                'abnormalLabResults': [],
                'recentDiagnoses': []
            },
            'conditions': [],
            'medications': [],
            'allergies': [],
            'encounters': [],
            'observations': []
        }
        options = {'maxWords': 200}

        summary_text, confidence_scores = generate_summary_with_bedrock(
            patient_id, aggregated_data, options
        )

        assert isinstance(summary_text, str)
        assert isinstance(confidence_scores, dict)
        assert 'overall' in confidence_scores
        assert confidence_scores['overall'] > 0.0


class TestFormatSummary:
    """Tests for format_summary function"""

    def test_format_summary_json(self):
        """Test format_summary with JSON format"""
        summary_text = 'Test summary'
        output_format = 'json'

        formatted = format_summary(summary_text, output_format)

        assert isinstance(formatted, str)

    def test_format_summary_markdown(self):
        """Test format_summary with Markdown format"""
        summary_text = 'Test summary'
        output_format = 'markdown'

        formatted = format_summary(summary_text, output_format)

        assert isinstance(formatted, str)


class TestCaching:
    """Tests for caching functions"""

    def test_get_cached_summary_placeholder(self):
        """Test get_cached_summary returns None (placeholder)"""
        patient_id = 'patient-123'
        options = {}

        cached = get_cached_summary(patient_id, options)

        assert cached is None

    def test_cache_summary_placeholder(self):
        """Test cache_summary executes without error (placeholder)"""
        patient_id = 'patient-123'
        options = {}
        summary = {
            'patientId': patient_id,
            'summary': 'Test summary'
        }

        # Should not raise any exceptions
        cache_summary(patient_id, options, summary)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
