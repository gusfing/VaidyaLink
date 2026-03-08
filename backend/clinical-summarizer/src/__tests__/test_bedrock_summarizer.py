"""
Unit tests for Bedrock Summarizer

Tests the Amazon Bedrock integration for clinical summarization.
"""

import pytest
import json
import sys
import os
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils.bedrock_summarizer import (
    BedrockSummarizer,
    BedrockSummarizerError,
    create_bedrock_summarizer
)


@pytest.fixture
def mock_bedrock_client():
    """Mock Bedrock Runtime client."""
    with patch('boto3.client') as mock_client:
        mock_instance = MagicMock()
        mock_client.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def sample_aggregated_data():
    """Sample aggregated clinical data."""
    return {
        'patient': {
            'id': 'patient-123',
            'name': 'John Doe',
            'age': 45,
            'gender': 'male'
        },
        'criticalInformation': {
            'chronicConditions': [
                {
                    'display': 'Type 2 Diabetes Mellitus',
                    'onsetDate': '2020-01-15',
                    'severity': 'moderate'
                },
                {
                    'display': 'Hypertension',
                    'onsetDate': '2018-06-20',
                    'severity': 'mild'
                }
            ],
            'currentMedications': [
                {
                    'display': 'Metformin 500mg',
                    'dosage': 'One tablet twice daily',
                    'startDate': '2020-01-20'
                },
                {
                    'display': 'Lisinopril 10mg',
                    'dosage': 'One tablet daily',
                    'startDate': '2018-07-01'
                }
            ],
            'criticalAllergies': [
                {
                    'display': 'Penicillin',
                    'type': 'allergy',
                    'reactions': [
                        {'manifestation': 'Rash'},
                        {'manifestation': 'Itching'}
                    ]
                }
            ],
            'abnormalLabResults': [
                {
                    'display': 'HbA1c',
                    'value': '7.2',
                    'unit': '%',
                    'interpretation': [{'display': 'High'}],
                    'effectiveDate': '2024-01-10'
                }
            ],
            'recentDiagnoses': [
                {
                    'display': 'Acute Bronchitis',
                    'recordedDate': '2024-01-05',
                    'clinicalStatus': 'active'
                }
            ]
        },
        'conditions': [],
        'medications': [],
        'allergies': [],
        'encounters': [
            {
                'startDate': '2024-01-05',
                'classDisplay': 'Outpatient',
                'reason': 'Cough and fever'
            }
        ],
        'observations': [],
        'metadata': {
            'totalResources': 15,
            'aggregatedAt': datetime.utcnow().isoformat()
        }
    }


@pytest.fixture
def sample_bedrock_response():
    """Sample Bedrock API response."""
    return {
        'content': [
            {
                'text': """## Chronic Conditions
- Type 2 Diabetes Mellitus (confidence: 95%)
- Hypertension (confidence: 92%)

## Current Medications
- Metformin 500mg - One tablet twice daily (confidence: 98%)
- Lisinopril 10mg - One tablet daily (confidence: 98%)

## Allergies
- Penicillin - High severity - Rash, Itching

## Recent Visits
- 2024-01-05: Outpatient - Cough and fever

## Abnormal Lab Results
- HbA1c: 7.2 % (High) - 2024-01-10 (confidence: 95%)

## Recent Diagnoses
- Acute Bronchitis - 2024-01-05 (confidence: 90%)

## Flags for Review
- None

## Overall Confidence Score
94%"""
            }
        ],
        'stop_reason': 'end_turn'
    }


class TestBedrockSummarizer:
    """Test suite for BedrockSummarizer class."""

    def test_initialization(self, mock_bedrock_client):
        """Test BedrockSummarizer initialization."""
        summarizer = BedrockSummarizer(
            model_id='test-model',
            region='us-east-1',
            max_tokens=1024,
            temperature=0.0,
            top_p=0.9
        )

        assert summarizer.model_id == 'test-model'
        assert summarizer.region == 'us-east-1'
        assert summarizer.max_tokens == 1024
        assert summarizer.temperature == 0.0
        assert summarizer.top_p == 0.9

    def test_initialization_with_defaults(self, mock_bedrock_client):
        """Test BedrockSummarizer initialization with default values."""
        with patch.dict('os.environ', {
            'BEDROCK_MODEL_ID': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
            'BEDROCK_REGION': 'us-east-1'
        }):
            summarizer = BedrockSummarizer()

            assert summarizer.model_id == 'anthropic.claude-3-5-sonnet-20241022-v2:0'
            assert summarizer.region == 'us-east-1'

    def test_generate_summary_success(
        self,
        mock_bedrock_client,
        sample_aggregated_data,
        sample_bedrock_response
    ):
        """Test successful summary generation."""
        # Mock Bedrock response
        mock_response = {
            'body': Mock()
        }
        mock_response['body'].read.return_value = json.dumps(sample_bedrock_response).encode()
        mock_bedrock_client.invoke_model.return_value = mock_response

        # Create summarizer
        summarizer = BedrockSummarizer()

        # Generate summary
        summary_text, confidence_scores = summarizer.generate_summary(
            patient_id='patient-123',
            aggregated_data=sample_aggregated_data,
            options={'maxWords': 200}
        )

        # Verify summary text
        assert 'Type 2 Diabetes Mellitus' in summary_text
        assert 'Metformin 500mg' in summary_text
        assert 'Penicillin' in summary_text

        # Verify confidence scores
        assert 'overall' in confidence_scores
        assert confidence_scores['overall'] == 0.94
        assert confidence_scores['chronicConditions'] > 0.9
        assert confidence_scores['medications'] > 0.9

    def test_build_prompt(self, mock_bedrock_client, sample_aggregated_data):
        """Test prompt building from aggregated data."""
        summarizer = BedrockSummarizer()

        prompt = summarizer._build_prompt(
            aggregated_data=sample_aggregated_data,
            options={'maxWords': 200}
        )

        # Verify prompt contains key information
        assert 'John Doe' in prompt
        assert '45 years' in prompt
        assert 'Type 2 Diabetes Mellitus' in prompt
        assert 'Metformin 500mg' in prompt
        assert 'Penicillin' in prompt
        assert 'Maximum 200 words' in prompt

    def test_format_patient_context(self, mock_bedrock_client):
        """Test patient context formatting."""
        summarizer = BedrockSummarizer()

        patient = {
            'name': 'Jane Smith',
            'age': 35,
            'gender': 'female'
        }

        context = summarizer._format_patient_context(patient)

        assert 'Jane Smith' in context
        assert '35 years' in context
        assert 'female' in context

    def test_format_patient_context_empty(self, mock_bedrock_client):
        """Test patient context formatting with empty data."""
        summarizer = BedrockSummarizer()

        context = summarizer._format_patient_context({})

        assert 'Not available' in context

    def test_invoke_bedrock(self, mock_bedrock_client, sample_bedrock_response):
        """Test Bedrock API invocation."""
        # Mock Bedrock response
        mock_response = {
            'body': Mock()
        }
        mock_response['body'].read.return_value = json.dumps(sample_bedrock_response).encode()
        mock_bedrock_client.invoke_model.return_value = mock_response

        summarizer = BedrockSummarizer()

        response = summarizer._invoke_bedrock("Test prompt")

        # Verify API was called
        mock_bedrock_client.invoke_model.assert_called_once()

        # Verify response
        assert 'content' in response
        assert response['stop_reason'] == 'end_turn'

    def test_parse_response(self, mock_bedrock_client, sample_bedrock_response):
        """Test response parsing."""
        summarizer = BedrockSummarizer()

        summary_text, confidence_scores = summarizer._parse_response(sample_bedrock_response)

        # Verify summary text
        assert 'Type 2 Diabetes Mellitus' in summary_text
        assert 'Metformin 500mg' in summary_text

        # Verify confidence scores
        assert confidence_scores['overall'] == 0.94
        assert confidence_scores['chronicConditions'] > 0.9

    def test_parse_response_empty(self, mock_bedrock_client):
        """Test response parsing with empty content."""
        summarizer = BedrockSummarizer()

        with pytest.raises(BedrockSummarizerError, match="Empty response"):
            summarizer._parse_response({'content': []})

    def test_extract_confidence_scores(self, mock_bedrock_client):
        """Test confidence score extraction."""
        summarizer = BedrockSummarizer()

        summary_text = """## Chronic Conditions
- Diabetes (confidence: 95%)
- Hypertension (confidence: 90%)

## Current Medications
- Metformin (confidence: 98%)

## Overall Confidence Score
94%"""

        scores = summarizer._extract_confidence_scores(summary_text)

        assert scores['overall'] == 0.94
        assert scores['chronicConditions'] == 0.925  # Average of 95 and 90
        assert scores['medications'] == 0.98

    def test_extract_section(self, mock_bedrock_client):
        """Test section extraction from summary."""
        summarizer = BedrockSummarizer()

        text = """## Chronic Conditions
- Diabetes
- Hypertension

## Current Medications
- Metformin"""

        section = summarizer._extract_section(text, 'Chronic Conditions')

        assert 'Diabetes' in section
        assert 'Hypertension' in section
        assert 'Metformin' not in section

    def test_bedrock_api_error(self, mock_bedrock_client, sample_aggregated_data):
        """Test handling of Bedrock API errors."""
        from botocore.exceptions import ClientError

        # Mock API error
        error_response = {
            'Error': {
                'Code': 'ThrottlingException',
                'Message': 'Rate exceeded'
            }
        }
        mock_bedrock_client.invoke_model.side_effect = ClientError(
            error_response,
            'InvokeModel'
        )

        summarizer = BedrockSummarizer()

        with pytest.raises(BedrockSummarizerError, match="Rate exceeded"):
            summarizer.generate_summary(
                patient_id='patient-123',
                aggregated_data=sample_aggregated_data,
                options={'maxWords': 200}
            )

    def test_create_bedrock_summarizer_factory(self, mock_bedrock_client):
        """Test factory function for creating summarizer."""
        summarizer = create_bedrock_summarizer(
            model_id='test-model',
            region='us-west-2',
            max_tokens=512
        )

        assert isinstance(summarizer, BedrockSummarizer)
        assert summarizer.model_id == 'test-model'
        assert summarizer.region == 'us-west-2'
        assert summarizer.max_tokens == 512


class TestBedrockIntegration:
    """Integration tests for Bedrock summarizer."""

    @pytest.mark.integration
    def test_end_to_end_summarization(
        self,
        mock_bedrock_client,
        sample_aggregated_data,
        sample_bedrock_response
    ):
        """Test end-to-end summarization flow."""
        # Mock Bedrock response
        mock_response = {
            'body': Mock()
        }
        mock_response['body'].read.return_value = json.dumps(sample_bedrock_response).encode()
        mock_bedrock_client.invoke_model.return_value = mock_response

        # Create summarizer
        summarizer = create_bedrock_summarizer()

        # Generate summary
        summary_text, confidence_scores = summarizer.generate_summary(
            patient_id='patient-123',
            aggregated_data=sample_aggregated_data,
            options={
                'maxWords': 200,
                'includeLabResults': True,
                'includeVitalSigns': True
            }
        )

        # Verify complete summary
        assert len(summary_text) > 0
        assert 'Chronic Conditions' in summary_text
        assert 'Current Medications' in summary_text
        assert 'Allergies' in summary_text

        # Verify confidence scores
        assert confidence_scores['overall'] > 0.0
        assert all(0.0 <= score <= 1.0 for score in confidence_scores.values())
