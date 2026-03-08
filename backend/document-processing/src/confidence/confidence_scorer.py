"""
Confidence Score Calculation for Medical Document Processing

This module calculates multi-dimensional confidence scores for extracted
clinical data, combining OCR confidence, field validation, and data quality metrics.
"""

import logging
import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class ConfidenceScores:
    """Container for all confidence scores."""

    # Overall confidence (weighted average)
    overall: float

    # Component scores
    ocr: float
    extraction: float
    validation: float

    # Field-level scores
    field_scores: Dict[str, float]

    # Critical field flags
    critical_fields_below_threshold: List[str]

    # Metadata
    calculated_at: str
    threshold_used: float

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'overall': round(self.overall, 4),
            'ocr': round(self.ocr, 4),
            'extraction': round(self.extraction, 4),
            'validation': round(self.validation, 4),
            'fieldScores': {k: round(v, 4) for k, v in self.field_scores.items()},
            'criticalFieldsBelowThreshold': self.critical_fields_below_threshold,
            'calculatedAt': self.calculated_at,
            'thresholdUsed': self.threshold_used
        }


class ConfidenceScorer:
    """
    Calculate confidence scores for extracted clinical data.

    Combines multiple signals:
    1. OCR confidence from PaddleOCR
    2. Field extraction completeness
    3. Data validation (format, range, consistency)
    4. Clinical data quality metrics
    """

    # Critical fields that require high confidence
    CRITICAL_FIELDS = [
        'patient_name',
        'medications',
        'diagnosis',
        'dosages'
    ]

    # Field weights for overall score calculation
    FIELD_WEIGHTS = {
        'patient_name': 0.15,
        'patient_age': 0.05,
        'patient_gender': 0.03,
        'document_date': 0.08,
        'doctor_name': 0.05,
        'medications': 0.25,
        'dosages': 0.15,
        'diagnosis': 0.15,
        'lab_results': 0.05,
        'vital_signs': 0.04
    }

    # Component weights for overall score
    COMPONENT_WEIGHTS = {
        'ocr': 0.35,
        'extraction': 0.35,
        'validation': 0.30
    }

    def __init__(self, confidence_threshold: float = 0.80):
        """
        Initialize confidence scorer.

        Args:
            confidence_threshold: Minimum confidence for auto-processing
        """
        self.confidence_threshold = confidence_threshold
        logger.info(f"Initialized ConfidenceScorer with threshold: {confidence_threshold}")

    def calculate_confidence(
        self,
        structured_data: Dict[str, Any],
        ocr_results: List[Any],
        ocr_average_confidence: float
    ) -> ConfidenceScores:
        """
        Calculate comprehensive confidence scores.

        Args:
            structured_data: Extracted clinical data from Bedrock
            ocr_results: List of OCRResult objects from PaddleOCR
            ocr_average_confidence: Average OCR confidence score

        Returns:
            ConfidenceScores object with all calculated scores
        """
        try:
            logger.info("Calculating confidence scores")

            # 1. OCR confidence (already calculated)
            ocr_confidence = ocr_average_confidence

            # 2. Extraction confidence (field completeness)
            extraction_confidence = self._calculate_extraction_confidence(structured_data)

            # 3. Validation confidence (data quality)
            validation_confidence = self._calculate_validation_confidence(structured_data)

            # 4. Field-level confidence scores
            field_scores = self._calculate_field_scores(
                structured_data,
                ocr_results,
                ocr_average_confidence
            )

            # 5. Calculate weighted overall confidence
            overall_confidence = self._calculate_overall_confidence(
                ocr_confidence,
                extraction_confidence,
                validation_confidence,
                field_scores
            )

            # 6. Identify critical fields below threshold
            critical_fields_below = self._identify_critical_fields_below_threshold(
                field_scores
            )

            confidence_scores = ConfidenceScores(
                overall=overall_confidence,
                ocr=ocr_confidence,
                extraction=extraction_confidence,
                validation=validation_confidence,
                field_scores=field_scores,
                critical_fields_below_threshold=critical_fields_below,
                calculated_at=datetime.utcnow().isoformat(),
                threshold_used=self.confidence_threshold
            )

            logger.info(f"Confidence calculation complete - Overall: {overall_confidence:.2f}, "
                       f"OCR: {ocr_confidence:.2f}, "
                       f"Extraction: {extraction_confidence:.2f}, "
                       f"Validation: {validation_confidence:.2f}")

            return confidence_scores

        except Exception as e:
            logger.error(f"Error calculating confidence scores: {str(e)}", exc_info=True)
            # Return minimal confidence scores
            return ConfidenceScores(
                overall=0.0,
                ocr=ocr_average_confidence,
                extraction=0.0,
                validation=0.0,
                field_scores={},
                critical_fields_below_threshold=self.CRITICAL_FIELDS,
                calculated_at=datetime.utcnow().isoformat(),
                threshold_used=self.confidence_threshold
            )

    def _calculate_extraction_confidence(
        self,
        structured_data: Dict[str, Any]
    ) -> float:
        """
        Calculate extraction confidence based on field completeness.

        Args:
            structured_data: Extracted clinical data

        Returns:
            Extraction confidence score (0.0 to 1.0)
        """
        total_fields = 0
        extracted_fields = 0

        # Check each field
        for field, weight in self.FIELD_WEIGHTS.items():
            total_fields += 1
            value = structured_data.get(field)

            # Check if field has meaningful data
            if value is not None:
                if isinstance(value, str) and value.strip():
                    extracted_fields += 1
                elif isinstance(value, list) and len(value) > 0:
                    extracted_fields += 1
                elif isinstance(value, dict) and len(value) > 0:
                    extracted_fields += 1
                elif isinstance(value, (int, float)):
                    extracted_fields += 1

        if total_fields == 0:
            return 0.0

        extraction_confidence = extracted_fields / total_fields

        logger.debug(f"Extraction confidence: {extraction_confidence:.2f} "
                    f"({extracted_fields}/{total_fields} fields)")

        return extraction_confidence

    def _calculate_validation_confidence(
        self,
        structured_data: Dict[str, Any]
    ) -> float:
        """
        Calculate validation confidence based on data quality checks.

        Args:
            structured_data: Extracted clinical data

        Returns:
            Validation confidence score (0.0 to 1.0)
        """
        validation_scores = []

        # Validate patient name
        if structured_data.get('patient_name'):
            score = self._validate_patient_name(structured_data['patient_name'])
            validation_scores.append(score)

        # Validate patient age
        if structured_data.get('patient_age'):
            score = self._validate_age(structured_data['patient_age'])
            validation_scores.append(score)

        # Validate gender
        if structured_data.get('patient_gender'):
            score = self._validate_gender(structured_data['patient_gender'])
            validation_scores.append(score)

        # Validate document date
        if structured_data.get('document_date'):
            score = self._validate_date(structured_data['document_date'])
            validation_scores.append(score)

        # Validate medications
        if structured_data.get('medications'):
            score = self._validate_medications(structured_data['medications'])
            validation_scores.append(score)

        # Validate lab results
        if structured_data.get('lab_results'):
            score = self._validate_lab_results(structured_data['lab_results'])
            validation_scores.append(score)

        # Validate vital signs
        if structured_data.get('vital_signs'):
            score = self._validate_vital_signs(structured_data['vital_signs'])
            validation_scores.append(score)

        if not validation_scores:
            return 0.5  # Neutral score if no validations performed

        validation_confidence = sum(validation_scores) / len(validation_scores)

        logger.debug(f"Validation confidence: {validation_confidence:.2f} "
                    f"({len(validation_scores)} validations)")

        return validation_confidence

    def _calculate_field_scores(
        self,
        structured_data: Dict[str, Any],
        ocr_results: List[Any],
        ocr_average_confidence: float
    ) -> Dict[str, float]:
        """
        Calculate confidence score for each field.

        Args:
            structured_data: Extracted clinical data
            ocr_results: OCR results with per-text confidence
            ocr_average_confidence: Average OCR confidence

        Returns:
            Dictionary mapping field names to confidence scores
        """
        field_scores = {}

        # Patient name
        if structured_data.get('patient_name'):
            field_scores['patient_name'] = self._score_field(
                structured_data['patient_name'],
                ocr_average_confidence,
                self._validate_patient_name(structured_data['patient_name'])
            )
        else:
            field_scores['patient_name'] = 0.0

        # Patient age
        if structured_data.get('patient_age'):
            field_scores['patient_age'] = self._score_field(
                structured_data['patient_age'],
                ocr_average_confidence,
                self._validate_age(structured_data['patient_age'])
            )
        else:
            field_scores['patient_age'] = 0.0

        # Patient gender
        if structured_data.get('patient_gender'):
            field_scores['patient_gender'] = self._score_field(
                structured_data['patient_gender'],
                ocr_average_confidence,
                self._validate_gender(structured_data['patient_gender'])
            )
        else:
            field_scores['patient_gender'] = 0.0

        # Document date
        if structured_data.get('document_date'):
            field_scores['document_date'] = self._score_field(
                structured_data['document_date'],
                ocr_average_confidence,
                self._validate_date(structured_data['document_date'])
            )
        else:
            field_scores['document_date'] = 0.0

        # Doctor name
        if structured_data.get('doctor_name'):
            field_scores['doctor_name'] = self._score_field(
                structured_data['doctor_name'],
                ocr_average_confidence,
                self._validate_doctor_name(structured_data['doctor_name'])
            )
        else:
            field_scores['doctor_name'] = 0.0

        # Medications
        if structured_data.get('medications'):
            field_scores['medications'] = self._score_field(
                structured_data['medications'],
                ocr_average_confidence,
                self._validate_medications(structured_data['medications'])
            )
        else:
            field_scores['medications'] = 0.0

        # Diagnosis
        if structured_data.get('diagnosis'):
            field_scores['diagnosis'] = self._score_field(
                structured_data['diagnosis'],
                ocr_average_confidence,
                0.85  # Default high confidence for diagnosis if extracted
            )
        else:
            field_scores['diagnosis'] = 0.0

        # Lab results
        if structured_data.get('lab_results'):
            field_scores['lab_results'] = self._score_field(
                structured_data['lab_results'],
                ocr_average_confidence,
                self._validate_lab_results(structured_data['lab_results'])
            )
        else:
            field_scores['lab_results'] = 0.0

        # Vital signs
        if structured_data.get('vital_signs'):
            field_scores['vital_signs'] = self._score_field(
                structured_data['vital_signs'],
                ocr_average_confidence,
                self._validate_vital_signs(structured_data['vital_signs'])
            )
        else:
            field_scores['vital_signs'] = 0.0

        return field_scores

    def _score_field(
        self,
        field_value: Any,
        ocr_confidence: float,
        validation_score: float
    ) -> float:
        """
        Calculate confidence score for a single field.

        Args:
            field_value: The extracted field value
            ocr_confidence: OCR confidence for the document
            validation_score: Validation score for the field

        Returns:
            Field confidence score (0.0 to 1.0)
        """
        # Weighted combination of OCR and validation
        field_score = (ocr_confidence * 0.6) + (validation_score * 0.4)

        # Boost score if field has rich data
        if isinstance(field_value, list) and len(field_value) > 0:
            field_score = min(1.0, field_score * 1.05)
        elif isinstance(field_value, dict) and len(field_value) > 0:
            field_score = min(1.0, field_score * 1.05)

        return field_score

    def _calculate_overall_confidence(
        self,
        ocr_confidence: float,
        extraction_confidence: float,
        validation_confidence: float,
        field_scores: Dict[str, float]
    ) -> float:
        """
        Calculate weighted overall confidence score.

        Args:
            ocr_confidence: OCR component confidence
            extraction_confidence: Extraction component confidence
            validation_confidence: Validation component confidence
            field_scores: Field-level confidence scores

        Returns:
            Overall confidence score (0.0 to 1.0)
        """
        # Component-based score
        component_score = (
            ocr_confidence * self.COMPONENT_WEIGHTS['ocr'] +
            extraction_confidence * self.COMPONENT_WEIGHTS['extraction'] +
            validation_confidence * self.COMPONENT_WEIGHTS['validation']
        )

        # Field-weighted score
        field_weighted_score = 0.0
        total_weight = 0.0

        for field, weight in self.FIELD_WEIGHTS.items():
            if field in field_scores:
                field_weighted_score += field_scores[field] * weight
                total_weight += weight

        if total_weight > 0:
            field_weighted_score = field_weighted_score / total_weight

        # Combine component and field scores (70% component, 30% field)
        overall = (component_score * 0.7) + (field_weighted_score * 0.3)

        return overall

    def _identify_critical_fields_below_threshold(
        self,
        field_scores: Dict[str, float]
    ) -> List[str]:
        """
        Identify critical fields with confidence below threshold.

        Args:
            field_scores: Field-level confidence scores

        Returns:
            List of critical field names below threshold
        """
        critical_below = []

        for field in self.CRITICAL_FIELDS:
            score = field_scores.get(field, 0.0)
            if score < self.confidence_threshold:
                critical_below.append(field)

        return critical_below

    # Validation methods

    def _validate_patient_name(self, name: str) -> float:
        """Validate patient name format."""
        if not name or not isinstance(name, str):
            return 0.0

        name = name.strip()

        # Check minimum length
        if len(name) < 2:
            return 0.3

        # Check for valid characters (letters, spaces, common Indian name characters)
        if re.match(r'^[a-zA-Z\s\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F]+$', name):
            return 0.95

        # Partial match
        if re.match(r'^[a-zA-Z\s]+$', name):
            return 0.90

        return 0.70

    def _validate_age(self, age: Any) -> float:
        """Validate patient age."""
        try:
            age_int = int(age)
            if 0 <= age_int <= 120:
                return 0.95
            elif 0 <= age_int <= 150:
                return 0.70
            else:
                return 0.30
        except (ValueError, TypeError):
            return 0.0

    def _validate_gender(self, gender: str) -> float:
        """Validate gender field."""
        if not gender or not isinstance(gender, str):
            return 0.0

        gender_lower = gender.lower().strip()
        valid_genders = ['male', 'female', 'other', 'm', 'f', 'o']

        if gender_lower in valid_genders:
            return 0.98

        return 0.50

    def _validate_date(self, date_str: str) -> float:
        """Validate date format."""
        if not date_str or not isinstance(date_str, str):
            return 0.0

        # Try parsing common date formats
        date_formats = [
            '%Y-%m-%d',
            '%d-%m-%Y',
            '%d/%m/%Y',
            '%Y/%m/%d'
        ]

        for fmt in date_formats:
            try:
                parsed_date = datetime.strptime(date_str, fmt)
                # Check if date is reasonable (not in future, not too old)
                now = datetime.now()
                if parsed_date <= now and (now - parsed_date).days < 36500:  # 100 years
                    return 0.95
                else:
                    return 0.70
            except ValueError:
                continue

        return 0.40

    def _validate_doctor_name(self, name: str) -> float:
        """Validate doctor name format."""
        # Similar to patient name validation
        return self._validate_patient_name(name)

    def _validate_medications(self, medications: List[Dict[str, Any]]) -> float:
        """Validate medications list."""
        if not medications or not isinstance(medications, list):
            return 0.0

        if len(medications) == 0:
            return 0.0

        valid_count = 0
        for med in medications:
            if isinstance(med, dict):
                # Check for required fields
                has_name = bool(med.get('name'))
                has_dosage = bool(med.get('dosage'))

                if has_name and has_dosage:
                    valid_count += 1
                elif has_name:
                    valid_count += 0.5

        if len(medications) > 0:
            return min(0.95, valid_count / len(medications))

        return 0.0

    def _validate_lab_results(self, lab_results: List[Dict[str, Any]]) -> float:
        """Validate lab results list."""
        if not lab_results or not isinstance(lab_results, list):
            return 0.0

        if len(lab_results) == 0:
            return 0.0

        valid_count = 0
        for result in lab_results:
            if isinstance(result, dict):
                has_test = bool(result.get('test_name'))
                has_value = bool(result.get('value'))

                if has_test and has_value:
                    valid_count += 1
                elif has_test:
                    valid_count += 0.5

        if len(lab_results) > 0:
            return min(0.95, valid_count / len(lab_results))

        return 0.0

    def _validate_vital_signs(self, vital_signs: Dict[str, Any]) -> float:
        """Validate vital signs data."""
        if not vital_signs or not isinstance(vital_signs, dict):
            return 0.0

        if len(vital_signs) == 0:
            return 0.0

        # Check for common vital signs
        expected_vitals = ['blood_pressure', 'pulse', 'temperature', 'respiratory_rate', 'spo2']
        found_count = sum(1 for vital in expected_vitals if vital_signs.get(vital))

        if found_count > 0:
            return min(0.95, found_count / len(expected_vitals))

        return 0.50  # Has some data but not standard vitals


def create_confidence_scorer(confidence_threshold: float = 0.80) -> ConfidenceScorer:
    """
    Factory function to create ConfidenceScorer instance.

    Args:
        confidence_threshold: Minimum confidence for auto-processing

    Returns:
        ConfidenceScorer instance
    """
    return ConfidenceScorer(confidence_threshold=confidence_threshold)
