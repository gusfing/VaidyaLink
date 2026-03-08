"""
Tests for Voice Data FHIR Transformation

Tests the integration between voice processing Lambda and FHIR transformer,
ensuring voice-extracted clinical entities are correctly mapped to FHIR resources.
"""

import pytest
import json
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock

# Import the handler
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from index import (
    handle_voice_transform,
    create_observation_from_voice,
    create_medication_from_voice,
    update_voice_job_with_fhir_ids,
    FHIRTransformerError
)
from utils.fhir_builder import FHIRResourceBuilder


@pytest.fixture
def mock_healthlake_store():
    """Mock HealthLake store"""
    with patch('index.HealthLakeStore') as mock_store_class:
        mock_store = Mock()
        mock_store.store_resources_batch.return_value = {
            'total': 3,
            'successful': 3,
            'failed': 0,
            'resource_ids': ['Observation/obs-1', 'Observation/obs-2', 'MedicationStatement/med-1'],
            'errors': []
        }
        mock_store_class.return_value = mock_store
        yield mock_store


@pytest.fixture
def mock_dynamodb():
    """Mock DynamoDB client"""
    with patch('boto3.client') as mock_boto:
        mock_client = Mock()
        mock_boto.return_value = mock_client
        yield mock_client


@pytest.fixture
def sample_voice_payload():
    """Sample voice processing payload"""
    return {
        'source': 'voice-processing',
        'sourceJobId': 'voice-job-123',
        'patientId': 'patient-456',
        'timestamp': '2024-01-15T10:30:00Z',
        'resources': [
            {
                'resourceType': 'Observation',
                'category': 'symptom',
                'data': {
                    'symptomName': 'fever',
                    'severity': 'high',
                    'duration': '3 days',
                    'onset': '2024-01-12',
                    'bodyLocation': 'whole body'
                },
                'confidence': 0.92,
                'sourceText': 'Patient reports high fever for 3 days'
            },
            {
                'resourceType': 'Observation',
                'category': 'vital-signs',
                'data': {
                    'vitalType': 'temperature',
                    'value': '39.2°C',
                    'loincCode': '8310-5',
                    'display': 'Body temperature'
                },
                'confidence': 0.95
            },
            {
                'resourceType': 'MedicationStatement',
                'category': 'medication',
                'data': {
                    'medicationName': 'Paracetamol',
                    'dosage': '500mg',
                    'frequency': 'twice daily',
                    'route': 'oral',
                    'duration': '5 days'
                },
                'confidence': 0.88,
                'sourceText': 'Taking Paracetamol 500mg twice daily'
            }
        ],
        'metadata': {
            'overallConfidence': 0.90,
            'confidenceByEntity': {
                'symptoms': 0.92,
                'vitalSigns': 0.95,
                'currentMedications': 0.88
            },
            'extractionMethod': 'voice-transcription',
            'language': 'hi',
            'userConfirmed': True
        }
    }


class TestVoiceTransform:
    """Test voice data transformation to FHIR"""

    def test_handle_voice_transform_success(self, sample_voice_payload, mock_healthlake_store, mock_dynamodb):
        """Test successful voice data transformation"""
        context = Mock()

        result = handle_voice_transform(sample_voice_payload, context)

        assert result['statusCode'] == 200
        body = json.loads(result['body'])

        assert body['message'] == 'Voice FHIR transformation completed'
        assert body['patientId'] == 'patient-456'
        assert body['jobId'] == 'voice-job-123'
        assert body['resourceCount'] == 3
        assert len(body['resourceIds']) == 3
        assert body['language'] == 'hi'
        assert body['overallConfidence'] == 0.90
        assert body['userConfirmed'] is True

        # Verify HealthLake store was called
        mock_healthlake_store.store_resources_batch.assert_called_once()
        stored_resources = mock_healthlake_store.store_resources_batch.call_args[0][0]
        assert len(stored_resources) == 3

        # Verify DynamoDB update was called
        mock_dynamodb.update_item.assert_called_once()

    def test_handle_voice_transform_missing_patient_id(self, sample_voice_payload):
        """Test error when patientId is missing"""
        payload = sample_voice_payload.copy()
        del payload['patientId']
        context = Mock()

        with pytest.raises(FHIRTransformerError, match='patientId is required'):
            handle_voice_transform(payload, context)

    def test_handle_voice_transform_no_resources(self, mock_healthlake_store):
        """Test handling of payload with no resources"""
        payload = {
            'source': 'voice-processing',
            'sourceJobId': 'voice-job-123',
            'patientId': 'patient-456',
            'resources': [],
            'metadata': {}
        }
        context = Mock()

        result = handle_voice_transform(payload, context)

        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['message'] == 'No resources to transform'
        assert body['resourceCount'] == 0

        # HealthLake should not be called
        mock_healthlake_store.store_resources_batch.assert_not_called()

    def test_handle_voice_transform_invalid_resources(self, mock_healthlake_store, mock_dynamodb):
        """Test handling of invalid resources"""
        payload = {
            'source': 'voice-processing',
            'sourceJobId': 'voice-job-123',
            'patientId': 'patient-456',
            'timestamp': '2024-01-15T10:30:00Z',
            'resources': [
                {'resourceType': 'Observation'},  # Missing data
                {'data': {'symptomName': 'fever'}},  # Missing resourceType
                {
                    'resourceType': 'Observation',
                    'category': 'symptom',
                    'data': {'symptomName': 'headache'},
                    'confidence': 0.85
                }
            ],
            'metadata': {'overallConfidence': 0.85, 'language': 'en'}
        }
        context = Mock()

        result = handle_voice_transform(payload, context)

        # Should only create 1 valid resource
        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['resourceCount'] == 1

    def test_handle_voice_transform_healthlake_failure(self, sample_voice_payload):
        """Test handling of HealthLake storage failure"""
        with patch('index.HealthLakeStore') as mock_store_class:
            mock_store = Mock()
            mock_store.store_resources_batch.side_effect = Exception('HealthLake connection failed')
            mock_store_class.return_value = mock_store

            context = Mock()

            with pytest.raises(FHIRTransformerError, match='Failed to store voice resources'):
                handle_voice_transform(sample_voice_payload, context)

    def test_handle_voice_transform_partial_healthlake_failure(self, sample_voice_payload, mock_dynamodb):
        """Test handling of partial HealthLake storage failure"""
        with patch('index.HealthLakeStore') as mock_store_class:
            mock_store = Mock()
            mock_store.store_resources_batch.return_value = {
                'total': 3,
                'successful': 2,
                'failed': 1,
                'resource_ids': ['Observation/obs-1', 'MedicationStatement/med-1'],
                'errors': [{'resourceType': 'Observation', 'error': 'Validation failed'}]
            }
            mock_store_class.return_value = mock_store

            context = Mock()
            result = handle_voice_transform(sample_voice_payload, context)

            # Should succeed with partial results
            assert result['statusCode'] == 200
            body = json.loads(result['body'])
            assert len(body['resourceIds']) == 2


class TestCreateObservationFromVoice:
    """Test observation creation from voice data"""

    def test_create_symptom_observation(self):
        """Test creating symptom observation"""
        builder = FHIRResourceBuilder()
        data = {
            'symptomName': 'fever',
            'severity': 'high',
            'duration': '3 days',
            'onset': '2024-01-12',
            'bodyLocation': 'whole body'
        }
        metadata = {'language': 'hi', 'userConfirmed': True}

        observation = create_observation_from_voice(
            builder, data, 'symptom', 'patient-123', 0.92,
            'Patient reports high fever', '2024-01-15T10:30:00Z', metadata
        )

        assert observation.status == 'final'
        assert observation.subject.reference == 'Patient/patient-123'
        # FHIR library converts ISO string to datetime object
        assert observation.effectiveDateTime is not None

        # Check note contains voice context
        note_text = observation.note[0].text
        assert 'Voice transcription' in note_text
        assert 'hi language' in note_text
        assert 'Confidence: 92%' in note_text
        assert 'User confirmed' in note_text

        # Check value contains symptom details
        assert 'Duration: 3 days' in observation.valueString
        assert 'Onset: 2024-01-12' in observation.valueString
        assert 'Location: whole body' in observation.valueString

    def test_create_vital_sign_observation(self):
        """Test creating vital sign observation"""
        builder = FHIRResourceBuilder()
        data = {
            'vitalType': 'temperature',
            'value': '38.5°C',
            'loincCode': '8310-5',
            'display': 'Body temperature'
        }
        metadata = {'language': 'en', 'userConfirmed': False}

        observation = create_observation_from_voice(
            builder, data, 'vital-signs', 'patient-123', 0.95,
            None, '2024-01-15T10:30:00Z', metadata
        )

        assert observation.status == 'final'
        assert observation.code.coding[0].code == '8310-5'
        assert observation.code.coding[0].display == 'Body temperature'

        # Should extract numeric value - valueString is not set when valueQuantity is present
        assert observation.valueQuantity is not None
        assert observation.valueQuantity.value == 38.5
        assert observation.valueQuantity.unit == 'C'

    def test_create_allergy_observation(self):
        """Test creating allergy observation"""
        builder = FHIRResourceBuilder()
        data = {
            'allergen': 'Penicillin',
            'reaction': 'rash',
            'severity': 'moderate'
        }
        metadata = {'language': 'en', 'userConfirmed': True}

        observation = create_observation_from_voice(
            builder, data, 'allergy', 'patient-123', 0.88,
            'Allergic to Penicillin', '2024-01-15T10:30:00Z', metadata
        )

        assert observation.status == 'final'
        assert 'Allergy: Penicillin' in observation.code.text
        assert 'Allergen: Penicillin' in observation.valueString
        assert 'Reaction: rash' in observation.valueString
        assert 'Severity: moderate' in observation.valueString

    def test_create_chief_complaint_observation(self):
        """Test creating chief complaint observation"""
        builder = FHIRResourceBuilder()
        data = {'complaint': 'Severe chest pain radiating to left arm'}
        metadata = {'language': 'en', 'userConfirmed': True}

        observation = create_observation_from_voice(
            builder, data, 'chief-complaint', 'patient-123', 0.94,
            None, '2024-01-15T10:30:00Z', metadata
        )

        assert observation.status == 'final'
        assert observation.code.text == 'Chief Complaint'
        assert observation.valueString == 'Severe chest pain radiating to left arm'

    def test_create_medical_history_observation(self):
        """Test creating medical history observation"""
        builder = FHIRResourceBuilder()
        data = {
            'condition': 'Type 2 Diabetes',
            'diagnosedDate': '2018-03-15',
            'status': 'active'
        }
        metadata = {'language': 'hi', 'userConfirmed': True}

        observation = create_observation_from_voice(
            builder, data, 'medical-history', 'patient-123', 0.86,
            None, '2024-01-15T10:30:00Z', metadata
        )

        assert observation.status == 'final'
        assert 'Medical History: Type 2 Diabetes' in observation.code.text
        assert 'Condition: Type 2 Diabetes' in observation.valueString
        assert 'Diagnosed: 2018-03-15' in observation.valueString
        assert 'Status: active' in observation.valueString


class TestCreateMedicationFromVoice:
    """Test medication statement creation from voice data"""

    def test_create_medication_statement(self):
        """Test creating medication statement"""
        builder = FHIRResourceBuilder()
        data = {
            'medicationName': 'Paracetamol',
            'dosage': '500mg',
            'frequency': 'twice daily',
            'route': 'oral',
            'duration': '5 days',
            'startDate': '2024-01-15'
        }
        metadata = {'language': 'hi', 'userConfirmed': True}

        med_statement = create_medication_from_voice(
            builder, data, 'patient-123', 0.88,
            'Taking Paracetamol 500mg', '2024-01-15T10:30:00Z', metadata
        )

        assert med_statement.status == 'active'
        assert med_statement.subject.reference == 'Patient/patient-123'
        # FHIR library converts date string to date object
        assert med_statement.effectivePeriod.start is not None

        # Check medication name
        assert 'Paracetamol' in med_statement.medication.concept.text

        # Check dosage
        assert len(med_statement.dosage) > 0
        dosage = med_statement.dosage[0]
        assert '500mg' in dosage.text
        assert 'twice daily' in dosage.text
        assert 'oral' in dosage.text

        # Check note contains voice context
        note_text = med_statement.note[0].text
        assert 'Voice transcription' in note_text
        assert 'hi language' in note_text
        assert 'Confidence: 88%' in note_text
        assert 'Duration: 5 days' in note_text

    def test_create_medication_with_parsed_dosage(self):
        """Test medication with parsed dosage value"""
        builder = FHIRResourceBuilder()
        data = {
            'medicationName': 'Amoxicillin',
            'dosage': '250mg',
            'frequency': 'three times daily'
        }
        metadata = {'language': 'en', 'userConfirmed': False}

        med_statement = create_medication_from_voice(
            builder, data, 'patient-123', 0.85,
            None, '2024-01-15T10:30:00Z', metadata
        )

        # Should parse dosage value and unit
        dosage = med_statement.dosage[0]
        assert dosage.doseAndRate is not None
        # Access as object, not dictionary
        assert dosage.doseAndRate[0].doseQuantity.value == 250
        assert dosage.doseAndRate[0].doseQuantity.unit == 'mg'

    def test_create_medication_with_route_mapping(self):
        """Test medication with route code mapping"""
        builder = FHIRResourceBuilder()
        data = {
            'medicationName': 'Insulin',
            'dosage': '10 units',
            'route': 'injection'
        }
        metadata = {'language': 'en', 'userConfirmed': True}

        med_statement = create_medication_from_voice(
            builder, data, 'patient-123', 0.90,
            None, '2024-01-15T10:30:00Z', metadata
        )

        # Should map injection to SNOMED CT code
        dosage = med_statement.dosage[0]
        assert dosage.route is not None
        assert dosage.route.coding[0].code == '47625008'
        assert 'Intravenous' in dosage.route.coding[0].display


class TestUpdateVoiceJobWithFHIRIds:
    """Test DynamoDB update for voice jobs"""

    def test_update_voice_job_success(self, mock_dynamodb):
        """Test successful DynamoDB update"""
        resource_ids = ['Observation/obs-1', 'Observation/obs-2', 'MedicationStatement/med-1']

        with patch.dict(os.environ, {'VOICEJOBS_TABLE': 'VoiceJobs-Test'}):
            update_voice_job_with_fhir_ids('voice-job-123', resource_ids)

        # Verify DynamoDB update was called correctly
        mock_dynamodb.update_item.assert_called_once()
        call_args = mock_dynamodb.update_item.call_args[1]

        assert call_args['TableName'] == 'VoiceJobs-Test'
        assert call_args['Key']['PK']['S'] == 'VOICE#voice-job-123'
        assert call_args['Key']['SK']['S'] == 'METADATA'
        assert len(call_args['ExpressionAttributeValues'][':ids']['L']) == 3

    def test_update_voice_job_failure(self, mock_dynamodb):
        """Test DynamoDB update failure"""
        mock_dynamodb.update_item.side_effect = Exception('DynamoDB error')

        with pytest.raises(Exception, match='DynamoDB error'):
            update_voice_job_with_fhir_ids('voice-job-123', ['Observation/obs-1'])


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
