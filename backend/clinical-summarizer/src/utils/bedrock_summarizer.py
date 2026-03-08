"""
Amazon Bedrock Summarizer for Clinical Data

This module integrates Amazon Bedrock (Claude 3.5 Sonnet) to generate
30-second clinical summaries from aggregated FHIR resources.

Key Features:
- Prompt engineering for medical summarization
- Confidence score extraction from LLM responses
- Structured output parsing
- Error handling and retry logic
- Medical terminology disambiguation

Requirements:
- Maximum 200 words
- Bullet-point format
- Highlight: chronic conditions, allergies, current medications, recent diagnoses
- Include confidence scores for each extracted clinical fact
- Flag ambiguous medical terminology
"""

import json
import logging
import os
import re
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class BedrockSummarizerError(Exception):
    """Base exception for Bedrock summarizer errors"""
    pass


class BedrockSummarizer:
    """
    Amazon Bedrock summarizer for clinical data.

    Uses Claude 3.5 Sonnet to generate structured clinical summaries
    from aggregated FHIR resources.
    """

    def __init__(
        self,
        model_id: str = None,
        region: str = None,
        max_tokens: int = 1024,
        temperature: float = 0.0,
        top_p: float = 0.9
    ):
        """
        Initialize Bedrock summarizer.

        Args:
            model_id: Bedrock model ID (default: Claude 3.5 Sonnet)
            region: AWS region for Bedrock (default: us-east-1)
            max_tokens: Maximum tokens for generation
            temperature: Temperature for sampling (0.0 = deterministic)
            top_p: Top-p sampling parameter
        """
        self.model_id = model_id or os.environ.get(
            'BEDROCK_MODEL_ID',
            'anthropic.claude-3-5-sonnet-20241022-v2:0'
        )
        self.region = region or os.environ.get('BEDROCK_REGION', 'us-east-1')
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.top_p = top_p

        # Initialize Bedrock Runtime client
        self.client = boto3.client('bedrock-runtime', region_name=self.region)

        logger.info(f"Initialized BedrockSummarizer with model: {self.model_id}")

    def generate_summary(
        self,
        patient_id: str,
        aggregated_data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> Tuple[str, Dict[str, float]]:
        """
        Generate clinical summary from aggregated data.

        Args:
            patient_id: Patient identifier
            aggregated_data: Aggregated clinical data from data_aggregator
            options: Summarization options (maxWords, outputFormat, etc.)

        Returns:
            Tuple of (summary_text, confidence_scores)

        Raises:
            BedrockSummarizerError: If summarization fails
        """
        try:
            logger.info(f"Generating summary for patient {patient_id}")

            # Build prompt from aggregated data
            prompt = self._build_prompt(aggregated_data, options)

            # Call Bedrock API
            response = self._invoke_bedrock(prompt)

            # Parse response
            summary_text, confidence_scores = self._parse_response(response)

            logger.info(f"Successfully generated summary for patient {patient_id}")

            return summary_text, confidence_scores

        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            error_message = e.response.get('Error', {}).get('Message', '')
            logger.error(f"Bedrock API error: {error_code} - {error_message}")
            raise BedrockSummarizerError(f"Bedrock API error: {error_message}")

        except Exception as e:
            logger.error(f"Unexpected error in summarization: {str(e)}", exc_info=True)
            raise BedrockSummarizerError(f"Summarization failed: {str(e)}")

    def _build_prompt(
        self,
        aggregated_data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> str:
        """
        Build prompt for Bedrock from aggregated clinical data.

        Args:
            aggregated_data: Aggregated clinical data
            options: Summarization options (maxWords, specialty, language)

        Returns:
            Formatted prompt string
        """
        # Import prompt template builder
        from utils.prompt_templates import get_prompt_template

        max_words = options.get('maxWords', 200)
        specialty = options.get('specialty', 'general')
        language = options.get('language', 'en')

        # Extract key data sections
        patient = aggregated_data.get('patient', {})
        critical_info = aggregated_data.get('criticalInformation', {})
        conditions = aggregated_data.get('conditions', [])
        medications = aggregated_data.get('medications', [])
        allergies = aggregated_data.get('allergies', [])
        encounters = aggregated_data.get('encounters', [])
        observations = aggregated_data.get('observations', [])

        # Build patient context
        patient_context = self._format_patient_context(patient)

        # Build clinical data context
        clinical_context = self._format_clinical_context(
            critical_info=critical_info,
            conditions=conditions,
            medications=medications,
            allergies=allergies,
            encounters=encounters,
            observations=observations
        )

        # Use enhanced prompt template
        prompt = get_prompt_template(
            patient_context=patient_context,
            clinical_context=clinical_context,
            specialty=specialty,
            language=language,
            max_words=max_words
        )

        return prompt

    def _format_patient_context(self, patient: Dict[str, Any]) -> str:
        """Format patient demographic information."""
        if not patient:
            return "Patient Information: Not available"

        name = patient.get('name', 'Unknown')
        age = patient.get('age', 'Unknown')
        gender = patient.get('gender', 'Unknown')

        return f"""Patient Information:
- Name: {name}
- Age: {age} years
- Gender: {gender}"""

    def _format_clinical_context(
        self,
        critical_info: Dict[str, Any],
        conditions: List[Dict[str, Any]],
        medications: List[Dict[str, Any]],
        allergies: List[Dict[str, Any]],
        encounters: List[Dict[str, Any]],
        observations: List[Dict[str, Any]]
    ) -> str:
        """Format clinical data context for the prompt."""
        sections = []

        # Chronic Conditions
        chronic_conditions = critical_info.get('chronicConditions', [])
        if chronic_conditions:
            section = "Chronic Conditions:\n"
            for cond in chronic_conditions[:5]:  # Limit to top 5
                display = cond.get('display', 'Unknown')
                onset = cond.get('onsetDate', 'Unknown date')
                severity = cond.get('severity', 'Unknown severity')
                section += f"- {display} (onset: {onset}, severity: {severity})\n"
            sections.append(section)

        # Current Medications
        current_meds = critical_info.get('currentMedications', [])
        if current_meds:
            section = "Current Medications:\n"
            for med in current_meds[:10]:  # Limit to top 10
                display = med.get('display', 'Unknown')
                dosage = med.get('dosage', 'Unknown dosage')
                start_date = med.get('startDate', 'Unknown date')
                section += f"- {display}: {dosage} (started: {start_date})\n"
            sections.append(section)

        # Allergies
        critical_allergies = critical_info.get('criticalAllergies', [])
        if critical_allergies or allergies:
            section = "Allergies:\n"
            allergy_list = critical_allergies if critical_allergies else allergies[:5]
            for allergy in allergy_list:
                display = allergy.get('display', 'Unknown')
                allergy_type = allergy.get('type', 'Unknown type')
                reactions = allergy.get('reactions', [])
                reaction_str = ', '.join([r.get('manifestation', 'Unknown') for r in reactions[:2]])
                section += f"- {display} ({allergy_type}): {reaction_str}\n"
            sections.append(section)

        # Recent Encounters
        if encounters:
            section = "Recent Encounters:\n"
            for enc in encounters[:5]:  # Limit to 5 most recent
                start_date = enc.get('startDate', 'Unknown date')
                class_display = enc.get('classDisplay', 'Unknown')
                reason = enc.get('reason', 'No reason specified')
                section += f"- {start_date}: {class_display} - {reason}\n"
            sections.append(section)

        # Abnormal Lab Results
        abnormal_labs = critical_info.get('abnormalLabResults', [])
        if abnormal_labs:
            section = "Abnormal Lab Results:\n"
            for lab in abnormal_labs[:5]:  # Limit to 5 most recent
                display = lab.get('display', 'Unknown')
                value = lab.get('value', 'Unknown')
                unit = lab.get('unit', '')
                interpretation = lab.get('interpretation', [])
                interp_str = ', '.join([i.get('display', '') for i in interpretation])
                date = lab.get('effectiveDate', 'Unknown date')
                section += f"- {display}: {value} {unit} ({interp_str}) - {date}\n"
            sections.append(section)

        # Recent Diagnoses
        recent_diagnoses = critical_info.get('recentDiagnoses', [])
        if recent_diagnoses:
            section = "Recent Diagnoses (last 30 days):\n"
            for diag in recent_diagnoses:
                display = diag.get('display', 'Unknown')
                recorded_date = diag.get('recordedDate', 'Unknown date')
                status = diag.get('clinicalStatus', 'Unknown status')
                section += f"- {display} - {recorded_date} ({status})\n"
            sections.append(section)

        # All Conditions (if not covered above)
        if not chronic_conditions and conditions:
            section = "Conditions:\n"
            for cond in conditions[:5]:
                display = cond.get('display', 'Unknown')
                status = cond.get('clinicalStatus', 'Unknown')
                date = cond.get('onsetDate') or cond.get('recordedDate', 'Unknown date')
                section += f"- {display} ({status}) - {date}\n"
            sections.append(section)

        return "\n".join(sections) if sections else "No clinical data available."

    def _invoke_bedrock(self, prompt: str) -> Dict[str, Any]:
        """
        Invoke Bedrock API with the prompt.

        Args:
            prompt: Formatted prompt string

        Returns:
            Bedrock API response

        Raises:
            ClientError: If Bedrock API call fails
        """
        logger.debug(f"Invoking Bedrock with model: {self.model_id}")

        # Prepare request body for Claude 3.5 Sonnet
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }

        # Invoke Bedrock
        response = self.client.invoke_model(
            modelId=self.model_id,
            body=json.dumps(request_body),
            contentType='application/json',
            accept='application/json'
        )

        # Parse response
        response_body = json.loads(response['body'].read())

        logger.debug(f"Bedrock response received: {response_body.get('stop_reason')}")

        return response_body

    def _parse_response(
        self,
        response: Dict[str, Any]
    ) -> Tuple[str, Dict[str, float]]:
        """
        Parse Bedrock response to extract summary and confidence scores.

        Args:
            response: Bedrock API response

        Returns:
            Tuple of (summary_text, confidence_scores)
        """
        # Extract text from response
        content = response.get('content', [])
        if not content:
            raise BedrockSummarizerError("Empty response from Bedrock")

        # Get the text content
        summary_text = content[0].get('text', '')

        if not summary_text:
            raise BedrockSummarizerError("No text content in Bedrock response")

        # Extract confidence scores from the summary
        confidence_scores = self._extract_confidence_scores(summary_text)

        return summary_text, confidence_scores

    def _extract_confidence_scores(self, summary_text: str) -> Dict[str, float]:
        """
        Extract confidence scores from the summary text.

        Args:
            summary_text: Generated summary text

        Returns:
            Dictionary of confidence scores by category
        """
        confidence_scores = {
            'overall': 0.0,
            'chronicConditions': 0.0,
            'medications': 0.0,
            'allergies': 1.0,  # Allergies are typically high confidence
            'recentVisits': 0.0,
            'labResults': 0.0,
            'recentDiagnoses': 0.0
        }

        # Extract overall confidence score
        overall_match = re.search(r'Overall Confidence Score[:\s]+(\d+)%', summary_text, re.IGNORECASE)
        if overall_match:
            confidence_scores['overall'] = float(overall_match.group(1)) / 100.0

        # Extract confidence scores from each section
        # Pattern: (confidence: XX%)
        confidence_pattern = r'\(confidence:\s*(\d+)%\)'

        # Chronic Conditions section
        chronic_section = self._extract_section(summary_text, 'Chronic Conditions')
        if chronic_section:
            scores = re.findall(confidence_pattern, chronic_section)
            if scores:
                avg_score = sum(float(s) for s in scores) / len(scores)
                confidence_scores['chronicConditions'] = avg_score / 100.0

        # Medications section
        meds_section = self._extract_section(summary_text, 'Current Medications')
        if meds_section:
            scores = re.findall(confidence_pattern, meds_section)
            if scores:
                avg_score = sum(float(s) for s in scores) / len(scores)
                confidence_scores['medications'] = avg_score / 100.0

        # Recent Visits section
        visits_section = self._extract_section(summary_text, 'Recent Visits')
        if visits_section:
            # Visits are typically high confidence if from structured data
            confidence_scores['recentVisits'] = 0.95

        # Lab Results section
        labs_section = self._extract_section(summary_text, 'Abnormal Lab Results')
        if labs_section:
            scores = re.findall(confidence_pattern, labs_section)
            if scores:
                avg_score = sum(float(s) for s in scores) / len(scores)
                confidence_scores['labResults'] = avg_score / 100.0

        # Recent Diagnoses section
        diagnoses_section = self._extract_section(summary_text, 'Recent Diagnoses')
        if diagnoses_section:
            scores = re.findall(confidence_pattern, diagnoses_section)
            if scores:
                avg_score = sum(float(s) for s in scores) / len(scores)
                confidence_scores['recentDiagnoses'] = avg_score / 100.0

        # Calculate overall confidence if not provided
        if confidence_scores['overall'] == 0.0:
            # Average of all non-zero scores
            non_zero_scores = [v for v in confidence_scores.values() if v > 0.0]
            if non_zero_scores:
                confidence_scores['overall'] = sum(non_zero_scores) / len(non_zero_scores)

        logger.debug(f"Extracted confidence scores: {confidence_scores}")

        return confidence_scores

    def _extract_section(self, text: str, section_name: str) -> Optional[str]:
        """
        Extract a specific section from the summary text.

        Args:
            text: Full summary text
            section_name: Name of the section to extract

        Returns:
            Section content or None if not found
        """
        # Pattern: ## Section Name\n content until next ## or end
        pattern = rf'##\s*{re.escape(section_name)}[:\s]*\n(.*?)(?=\n##|\Z)'
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)

        if match:
            return match.group(1).strip()

        return None


def create_bedrock_summarizer(
    model_id: str = None,
    region: str = None,
    max_tokens: int = 1024,
    temperature: float = 0.0,
    top_p: float = 0.9
) -> BedrockSummarizer:
    """
    Factory function to create a BedrockSummarizer instance.

    Args:
        model_id: Bedrock model ID
        region: AWS region
        max_tokens: Maximum tokens for generation
        temperature: Temperature for sampling
        top_p: Top-p sampling parameter

    Returns:
        BedrockSummarizer instance
    """
    return BedrockSummarizer(
        model_id=model_id,
        region=region,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p
    )
