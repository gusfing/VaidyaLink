"""
Clinical Data Structurer using Amazon Bedrock.

This module uses Amazon Bedrock (Claude 3.5 Sonnet) to structure
extracted OCR text into clinical fields for medical records.
"""

import json
import logging
import os
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


@dataclass
class StructuredClinicalData:
    """Structured clinical data extracted from medical documents."""

    # Patient information
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    patient_id: Optional[str] = None

    # Document metadata
    document_date: Optional[str] = None
    document_type: Optional[str] = None
    doctor_name: Optional[str] = None
    facility_name: Optional[str] = None

    # Clinical information
    chief_complaint: Optional[str] = None
    diagnosis: List[str] = None
    medications: List[Dict[str, Any]] = None
    dosages: List[str] = None
    lab_results: List[Dict[str, Any]] = None
    vital_signs: Dict[str, Any] = None
    allergies: List[str] = None
    medical_history: List[str] = None

    # Additional fields
    notes: Optional[str] = None
    follow_up_date: Optional[str] = None

    # Metadata
    extracted_text: Optional[str] = None
    extraction_timestamp: Optional[str] = None

    def __post_init__(self):
        """Initialize empty lists for list fields."""
        if self.diagnosis is None:
            self.diagnosis = []
        if self.medications is None:
            self.medications = []
        if self.dosages is None:
            self.dosages = []
        if self.lab_results is None:
            self.lab_results = []
        if self.vital_signs is None:
            self.vital_signs = {}
        if self.allergies is None:
            self.allergies = []
        if self.medical_history is None:
            self.medical_history = []

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)


class ClinicalStructurer:
    """
    Clinical data structurer using Amazon Bedrock.

    Uses Claude 3.5 Sonnet to extract structured clinical information
    from OCR-extracted text.
    """

    def __init__(
        self,
        model_id: str = "anthropic.claude-3-5-sonnet-20241022-v2:0",
        region: str = "us-east-1",
        max_tokens: int = 4096,
        temperature: float = 0.0
    ):
        """
        Initialize the clinical structurer.

        Args:
            model_id: Bedrock model identifier
            region: AWS region
            max_tokens: Maximum tokens for response
            temperature: Model temperature (0.0 for deterministic)
        """
        self.model_id = model_id
        self.max_tokens = max_tokens
        self.temperature = temperature

        # Initialize Bedrock client
        self.bedrock_runtime = boto3.client(
            service_name='bedrock-runtime',
            region_name=region
        )

        logger.info(f"Initialized ClinicalStructurer with model: {model_id}")

    def structure_clinical_data(
        self,
        extracted_text: str,
        document_context: Optional[Dict[str, Any]] = None
    ) -> StructuredClinicalData:
        """
        Structure extracted text into clinical fields.

        Args:
            extracted_text: OCR-extracted text from medical document
            document_context: Optional context (language, document type, etc.)

        Returns:
            StructuredClinicalData object with extracted fields
        """
        try:
            logger.info("Structuring clinical data with Bedrock")

            # Build prompt
            prompt = self._build_structuring_prompt(extracted_text, document_context)

            # Call Bedrock
            response = self._invoke_bedrock(prompt)

            # Parse response
            structured_data = self._parse_bedrock_response(response, extracted_text)

            logger.info("Clinical data structured successfully")
            return structured_data

        except Exception as e:
            logger.error(f"Error structuring clinical data: {str(e)}", exc_info=True)
            # Return minimal structured data with extracted text
            return StructuredClinicalData(
                extracted_text=extracted_text,
                extraction_timestamp=datetime.utcnow().isoformat()
            )

    def _build_structuring_prompt(
        self,
        extracted_text: str,
        document_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Build prompt for clinical data structuring.

        Args:
            extracted_text: OCR-extracted text
            document_context: Optional context information

        Returns:
            Formatted prompt string
        """
        context_info = ""
        if document_context:
            context_info = f"\n\nDocument Context:\n{json.dumps(document_context, indent=2)}"

        prompt = f"""You are a medical AI assistant specialized in extracting structured clinical information from medical documents.

Extract structured clinical data from the following medical document text. The text may contain handwritten or printed information in English or Indian languages.

Medical Document Text:
{extracted_text}{context_info}

Instructions:
1. Extract all available clinical information
2. For medications, include drug name, dosage, frequency, and duration
3. For lab results, include test name, value, unit, and reference range
4. For vital signs, include BP, pulse, temperature, respiratory rate, SpO2
5. Use null for missing fields
6. Preserve original text for ambiguous terms
7. Format dates as YYYY-MM-DD when possible
8. For Indian drug names, preserve original spelling

Output Format (JSON):
{{
  "patient_name": "string or null",
  "patient_age": number or null,
  "patient_gender": "male/female/other or null",
  "patient_id": "string or null",
  "document_date": "YYYY-MM-DD or null",
  "document_type": "prescription/lab_report/discharge_summary/consultation/other",
  "doctor_name": "string or null",
  "facility_name": "string or null",
  "chief_complaint": "string or null",
  "diagnosis": ["diagnosis1", "diagnosis2"],
  "medications": [
    {{
      "name": "drug name",
      "dosage": "strength and form",
      "frequency": "how often",
      "duration": "how long",
      "route": "oral/IV/topical/etc"
    }}
  ],
  "lab_results": [
    {{
      "test_name": "test name",
      "value": "result value",
      "unit": "measurement unit",
      "reference_range": "normal range",
      "status": "normal/abnormal/critical"
    }}
  ],
  "vital_signs": {{
    "blood_pressure": "systolic/diastolic",
    "pulse": "bpm",
    "temperature": "°F or °C",
    "respiratory_rate": "breaths/min",
    "spo2": "percentage"
  }},
  "allergies": ["allergy1", "allergy2"],
  "medical_history": ["condition1", "condition2"],
  "notes": "additional clinical notes",
  "follow_up_date": "YYYY-MM-DD or null"
}}

Respond with ONLY the JSON object, no additional text or explanation."""

        return prompt

    def _invoke_bedrock(self, prompt: str) -> str:
        """
        Invoke Bedrock model with prompt.

        Args:
            prompt: Formatted prompt string

        Returns:
            Model response text
        """
        try:
            # Prepare request body for Claude 3.5
            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            }

            # Invoke model
            response = self.bedrock_runtime.invoke_model(
                modelId=self.model_id,
                body=json.dumps(request_body)
            )

            # Parse response
            response_body = json.loads(response['body'].read())

            # Extract text from response
            if 'content' in response_body and len(response_body['content']) > 0:
                return response_body['content'][0]['text']
            else:
                raise ValueError("No content in Bedrock response")

        except ClientError as e:
            logger.error(f"Bedrock API error: {e.response['Error']['Message']}")
            raise
        except Exception as e:
            logger.error(f"Error invoking Bedrock: {str(e)}", exc_info=True)
            raise

    def _parse_bedrock_response(
        self,
        response_text: str,
        original_text: str
    ) -> StructuredClinicalData:
        """
        Parse Bedrock response into StructuredClinicalData.

        Args:
            response_text: JSON response from Bedrock
            original_text: Original extracted text

        Returns:
            StructuredClinicalData object
        """
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_text = response_text.strip()
            if json_text.startswith('```json'):
                json_text = json_text[7:]
            if json_text.startswith('```'):
                json_text = json_text[3:]
            if json_text.endswith('```'):
                json_text = json_text[:-3]
            json_text = json_text.strip()

            # Parse JSON
            data = json.loads(json_text)

            # Create StructuredClinicalData object
            structured_data = StructuredClinicalData(
                patient_name=data.get('patient_name'),
                patient_age=data.get('patient_age'),
                patient_gender=data.get('patient_gender'),
                patient_id=data.get('patient_id'),
                document_date=data.get('document_date'),
                document_type=data.get('document_type'),
                doctor_name=data.get('doctor_name'),
                facility_name=data.get('facility_name'),
                chief_complaint=data.get('chief_complaint'),
                diagnosis=data.get('diagnosis', []),
                medications=data.get('medications', []),
                lab_results=data.get('lab_results', []),
                vital_signs=data.get('vital_signs', {}),
                allergies=data.get('allergies', []),
                medical_history=data.get('medical_history', []),
                notes=data.get('notes'),
                follow_up_date=data.get('follow_up_date'),
                extracted_text=original_text,
                extraction_timestamp=datetime.utcnow().isoformat()
            )

            return structured_data

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Bedrock JSON response: {str(e)}")
            logger.error(f"Response text: {response_text}")
            # Return minimal structured data
            return StructuredClinicalData(
                extracted_text=original_text,
                extraction_timestamp=datetime.utcnow().isoformat(),
                notes=f"Failed to parse structured data: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Error parsing Bedrock response: {str(e)}", exc_info=True)
            return StructuredClinicalData(
                extracted_text=original_text,
                extraction_timestamp=datetime.utcnow().isoformat()
            )


def create_clinical_structurer(
    model_id: Optional[str] = None,
    region: Optional[str] = None
) -> ClinicalStructurer:
    """
    Factory function to create ClinicalStructurer instance.

    Args:
        model_id: Optional Bedrock model ID (defaults to env var or Claude 3.5)
        region: Optional AWS region (defaults to env var or us-east-1)

    Returns:
        ClinicalStructurer instance
    """
    model_id = model_id or os.environ.get(
        'BEDROCK_MODEL_ID',
        'anthropic.claude-3-5-sonnet-20241022-v2:0'
    )
    region = region or os.environ.get('AWS_REGION', 'us-east-1')

    return ClinicalStructurer(model_id=model_id, region=region)
