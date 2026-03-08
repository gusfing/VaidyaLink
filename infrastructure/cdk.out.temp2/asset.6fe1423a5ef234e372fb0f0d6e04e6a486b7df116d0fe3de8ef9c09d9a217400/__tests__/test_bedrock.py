"""
Unit tests for Amazon Bedrock clinical data structuring.
"""

import json
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

from bedrock.clinical_structurer import (
    ClinicalStructurer,
    StructuredClinicalData,
    create_clinical_structurer
)


class TestStructuredClinicalData:
    """Test StructuredClinicalData dataclass."""

    def test_initialization_with_defaults(self):
        """Test initialization with default values."""
        data = StructuredClinicalData()

        assert data.patient_name is None
        assert data.diagnosis == []
        assert data.medications == []
        assert data.vital_signs == {}
        assert data.allergies == []

    def test_initialization_with_values(self):
        """Test initialization with provided values."""
        data = StructuredClinicalData(
            patient_name="John Doe",
            patient_age=45,
            diagnosis=["Hypertension"],
            medications=[{"name": "Lisinopril", "dosage": "10mg"}]
        )

        assert data.patient_name == "John Doe"
        assert data.patient_age == 45
        assert len(data.diagnosis) == 1
        assert len(data.medications) == 1

    def test_to_dict(self):
        """Test conversion to dictionary."""
        data = StructuredClinicalData(
            patient_name="Jane Smith",
            patient_age=32,
            diagnosis=["Diabetes Type 2"]
        )

        result = data.to_dict()

        assert isinstance(result, dict)
        assert result['patient_name'] == "Jane Smith"
        assert result['patient_age'] == 32
        assert result['diagnosis'] == ["Diabetes Type 2"]


class TestClinicalStructurer:
    """Test ClinicalStructurer class."""

    @pytest.fixture
    def mock_bedrock_client(self):
        """Create mock Bedrock client."""
        with patch('boto3.client') as mock_client:
            mock_runtime = MagicMock()
            mock_client.return_value = mock_runtime
            yield mock_runtime

    @pytest.fixture
    def structurer(self, mock_bedrock_client):
        """Create ClinicalStructurer instance with mocked client."""
        return ClinicalStructurer(
            model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
            region="us-east-1"
        )

    def test_initialization(self, structurer):
        """Test structurer initialization."""
        assert structurer.model_id == "anthropic.claude-3-5-sonnet-20241022-v2:0"
        assert structurer.max_tokens == 4096
        assert structurer.temperature == 0.0

    def test_build_structuring_prompt(self, structurer):
        """Test prompt building."""
        extracted_text = "Patient: John Doe\nDiagnosis: Hypertension"

        prompt = structurer._build_structuring_prompt(extracted_text)

        assert "John Doe" in prompt
        assert "Hypertension" in prompt
        assert "JSON" in prompt
        assert "patient_name" in prompt

    def test_build_structuring_prompt_with_context(self, structurer):
        """Test prompt building with document context."""
        extracted_text = "Patient: Jane Smith"
        context = {"language": "en", "documentType": "prescription"}

        prompt = structurer._build_structuring_prompt(extracted_text, context)

        assert "Jane Smith" in prompt
        assert "Document Context" in prompt
        assert "language" in prompt

    def test_invoke_bedrock_success(self, structurer, mock_bedrock_client):
        """Test successful Bedrock invocation."""
        # Mock response
        mock_response = {
            'body': MagicMock()
        }
        response_body = {
            'content': [
                {
                    'text': '{"patient_name": "John Doe"}'
                }
            ]
        }
        mock_response['body'].read.return_value = json.dumps(response_body).encode()
        mock_bedrock_client.invoke_model.return_value = mock_response

        result = structurer._invoke_bedrock("test prompt")

        assert result == '{"patient_name": "John Doe"}'
        mock_bedrock_client.invoke_model.assert_called_once()

    def test_invoke_bedrock_error(self, structurer, mock_bedrock_client):
        """Test Bedrock invocation error handling."""
        mock_bedrock_client.invoke_model.side_effect = Exception("API Error")

        with pytest.raises(Exception) as exc_info:
            structurer._invoke_bedrock("test prompt")

        assert "API Error" in str(exc_info.value)

    def test_parse_bedrock_response_valid_json(self, structurer):
        """Test parsing valid JSON response."""
        response_text = json.dumps({
            "patient_name": "John Doe",
            "patient_age": 45,
            "diagnosis": ["Hypertension"],
            "medications": [
                {
                    "name": "Lisinopril",
                    "dosage": "10mg",
                    "frequency": "once daily"
                }
            ]
        })
        original_text = "Patient: John Doe, Age: 45"

        result = structurer._parse_bedrock_response(response_text, original_text)

        assert isinstance(result, StructuredClinicalData)
        assert result.patient_name == "John Doe"
        assert result.patient_age == 45
        assert len(result.diagnosis) == 1
        assert len(result.medications) == 1
        assert result.extracted_text == original_text

    def test_parse_bedrock_response_with_markdown(self, structurer):
        """Test parsing JSON wrapped in markdown code blocks."""
        response_text = '''```json
{
    "patient_name": "Jane Smith",
    "patient_age": 32
}
```'''
        original_text = "Patient: Jane Smith"

        result = structurer._parse_bedrock_response(response_text, original_text)

        assert result.patient_name == "Jane Smith"
        assert result.patient_age == 32

    def test_parse_bedrock_response_invalid_json(self, structurer):
        """Test parsing invalid JSON response."""
        response_text = "This is not valid JSON"
        original_text = "Patient: John Doe"

        result = structurer._parse_bedrock_response(response_text, original_text)

        # Should return minimal structured data
        assert isinstance(result, StructuredClinicalData)
        assert result.extracted_text == original_text
        assert result.patient_name is None

    def test_structure_clinical_data_success(self, structurer, mock_bedrock_client):
        """Test successful clinical data structuring."""
        # Mock Bedrock response
        mock_response = {
            'body': MagicMock()
        }
        response_body = {
            'content': [
                {
                    'text': json.dumps({
                        "patient_name": "Rajesh Kumar",
                        "patient_age": 55,
                        "document_type": "prescription",
                        "diagnosis": ["Type 2 Diabetes"],
                        "medications": [
                            {
                                "name": "Metformin",
                                "dosage": "500mg",
                                "frequency": "twice daily",
                                "route": "oral"
                            }
                        ]
                    })
                }
            ]
        }
        mock_response['body'].read.return_value = json.dumps(response_body).encode()
        mock_bedrock_client.invoke_model.return_value = mock_response

        extracted_text = "Patient: Rajesh Kumar, Age: 55\nDiagnosis: Type 2 Diabetes\nRx: Metformin 500mg BD"

        result = structurer.structure_clinical_data(extracted_text)

        assert isinstance(result, StructuredClinicalData)
        assert result.patient_name == "Rajesh Kumar"
        assert result.patient_age == 55
        assert result.document_type == "prescription"
        assert len(result.diagnosis) == 1
        assert len(result.medications) == 1
        assert result.medications[0]['name'] == "Metformin"

    def test_structure_clinical_data_with_context(self, structurer, mock_bedrock_client):
        """Test structuring with document context."""
        # Mock Bedrock response
        mock_response = {
            'body': MagicMock()
        }
        response_body = {
            'content': [
                {
                    'text': '{"patient_name": "Test Patient"}'
                }
            ]
        }
        mock_response['body'].read.return_value = json.dumps(response_body).encode()
        mock_bedrock_client.invoke_model.return_value = mock_response

        extracted_text = "Patient: Test Patient"
        context = {"language": "hi", "ocrConfidence": 0.92}

        result = structurer.structure_clinical_data(extracted_text, context)

        assert result.patient_name == "Test Patient"
        mock_bedrock_client.invoke_model.assert_called_once()

    def test_structure_clinical_data_error_handling(self, structurer, mock_bedrock_client):
        """Test error handling during structuring."""
        mock_bedrock_client.invoke_model.side_effect = Exception("Bedrock error")

        extracted_text = "Patient: John Doe"

        # Should not raise, but return minimal structured data
        result = structurer.structure_clinical_data(extracted_text)

        assert isinstance(result, StructuredClinicalData)
        assert result.extracted_text == extracted_text
        assert result.patient_name is None


class TestFactoryFunction:
    """Test factory function."""

    @patch('boto3.client')
    def test_create_clinical_structurer_defaults(self, mock_client):
        """Test factory function with default parameters."""
        structurer = create_clinical_structurer()

        assert isinstance(structurer, ClinicalStructurer)
        assert structurer.model_id == "anthropic.claude-3-5-sonnet-20241022-v2:0"

    @patch('boto3.client')
    @patch.dict('os.environ', {'BEDROCK_MODEL_ID': 'custom-model', 'AWS_REGION': 'us-west-2'})
    def test_create_clinical_structurer_from_env(self, mock_client):
        """Test factory function with environment variables."""
        structurer = create_clinical_structurer()

        assert structurer.model_id == "custom-model"

    @patch('boto3.client')
    def test_create_clinical_structurer_with_params(self, mock_client):
        """Test factory function with explicit parameters."""
        structurer = create_clinical_structurer(
            model_id="test-model",
            region="eu-west-1"
        )

        assert structurer.model_id == "test-model"


class TestIntegrationScenarios:
    """Integration test scenarios with realistic medical data."""

    @pytest.fixture
    def structurer(self):
        """Create structurer with mocked Bedrock client."""
        with patch('boto3.client') as mock_client:
            mock_runtime = MagicMock()
            mock_client.return_value = mock_runtime
            yield ClinicalStructurer(), mock_runtime

    def test_prescription_document(self, structurer):
        """Test structuring a prescription document."""
        clinical_structurer, mock_bedrock = structurer

        # Mock response for prescription
        mock_response = {
            'body': MagicMock()
        }
        response_body = {
            'content': [
                {
                    'text': json.dumps({
                        "patient_name": "Priya Sharma",
                        "patient_age": 28,
                        "document_type": "prescription",
                        "document_date": "2024-01-15",
                        "doctor_name": "Dr. Amit Patel",
                        "diagnosis": ["Upper Respiratory Tract Infection"],
                        "medications": [
                            {
                                "name": "Azithromycin",
                                "dosage": "500mg",
                                "frequency": "once daily",
                                "duration": "3 days",
                                "route": "oral"
                            },
                            {
                                "name": "Paracetamol",
                                "dosage": "650mg",
                                "frequency": "three times daily",
                                "duration": "5 days",
                                "route": "oral"
                            }
                        ]
                    })
                }
            ]
        }
        mock_response['body'].read.return_value = json.dumps(response_body).encode()
        mock_bedrock.invoke_model.return_value = mock_response

        extracted_text = """
        Dr. Amit Patel
        Date: 15/01/2024

        Patient: Priya Sharma, Age: 28
        Diagnosis: URTI

        Rx:
        1. Tab Azithromycin 500mg OD x 3 days
        2. Tab Paracetamol 650mg TDS x 5 days
        """

        result = clinical_structurer.structure_clinical_data(extracted_text)

        assert result.patient_name == "Priya Sharma"
        assert result.document_type == "prescription"
        assert len(result.medications) == 2
        assert result.medications[0]['name'] == "Azithromycin"

    def test_lab_report_document(self, structurer):
        """Test structuring a lab report document."""
        clinical_structurer, mock_bedrock = structurer

        # Mock response for lab report
        mock_response = {
            'body': MagicMock()
        }
        response_body = {
            'content': [
                {
                    'text': json.dumps({
                        "patient_name": "Vikram Singh",
                        "patient_age": 42,
                        "document_type": "lab_report",
                        "document_date": "2024-01-20",
                        "lab_results": [
                            {
                                "test_name": "HbA1c",
                                "value": "7.2",
                                "unit": "%",
                                "reference_range": "4.0-5.6",
                                "status": "abnormal"
                            },
                            {
                                "test_name": "Fasting Blood Sugar",
                                "value": "145",
                                "unit": "mg/dL",
                                "reference_range": "70-100",
                                "status": "abnormal"
                            }
                        ]
                    })
                }
            ]
        }
        mock_response['body'].read.return_value = json.dumps(response_body).encode()
        mock_bedrock.invoke_model.return_value = mock_response

        extracted_text = """
        Lab Report
        Patient: Vikram Singh, Age: 42
        Date: 20/01/2024

        Test Results:
        HbA1c: 7.2% (Ref: 4.0-5.6%)
        FBS: 145 mg/dL (Ref: 70-100 mg/dL)
        """

        result = clinical_structurer.structure_clinical_data(extracted_text)

        assert result.patient_name == "Vikram Singh"
        assert result.document_type == "lab_report"
        assert len(result.lab_results) == 2
        assert result.lab_results[0]['test_name'] == "HbA1c"
        assert result.lab_results[0]['status'] == "abnormal"
