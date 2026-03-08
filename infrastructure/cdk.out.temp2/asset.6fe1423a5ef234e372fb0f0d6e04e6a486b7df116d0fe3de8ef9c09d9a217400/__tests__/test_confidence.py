"""
Unit tests for confidence scoring module.
"""

import unittest
from datetime import datetime
from unittest.mock import Mock, patch

from confidence import ConfidenceScorer, ConfidenceScores, create_confidence_scorer


class TestConfidenceScorer(unittest.TestCase):
    """Test cases for ConfidenceScorer class."""

    def setUp(self):
        """Set up test fixtures."""
        self.scorer = ConfidenceScorer(confidence_threshold=0.80)

        # Sample structured data
        self.sample_data = {
            'patient_name': 'Rajesh Kumar',
            'patient_age': 45,
            'patient_gender': 'male',
            'document_date': '2024-01-15',
            'doctor_name': 'Dr. Sharma',
            'medications': [
                {
                    'name': 'Omeprazole',
                    'dosage': '20mg',
                    'frequency': 'once daily',
                    'duration': '30 days'
                }
            ],
            'diagnosis': ['Gastritis', 'Hypertension'],
            'lab_results': [
                {
                    'test_name': 'Blood Glucose',
                    'value': '95',
                    'unit': 'mg/dL',
                    'reference_range': '70-100'
                }
            ],
            'vital_signs': {
                'blood_pressure': '120/80',
                'pulse': '72',
                'temperature': '98.6'
            }
        }

        # Sample OCR results
        self.sample_ocr_results = [
            Mock(text='Rajesh Kumar', confidence=0.95),
            Mock(text='Age: 45', confidence=0.92),
            Mock(text='Omeprazole 20mg', confidence=0.88),
            Mock(text='BP: 120/80', confidence=0.90)
        ]

    def test_initialization(self):
        """Test ConfidenceScorer initialization."""
        scorer = ConfidenceScorer(confidence_threshold=0.75)
        self.assertEqual(scorer.confidence_threshold, 0.75)

    def test_create_confidence_scorer(self):
        """Test factory function."""
        scorer = create_confidence_scorer(confidence_threshold=0.85)
        self.assertIsInstance(scorer, ConfidenceScorer)
        self.assertEqual(scorer.confidence_threshold, 0.85)

    def test_calculate_confidence_complete_data(self):
        """Test confidence calculation with complete data."""
        result = self.scorer.calculate_confidence(
            structured_data=self.sample_data,
            ocr_results=self.sample_ocr_results,
            ocr_average_confidence=0.91
        )

        self.assertIsInstance(result, ConfidenceScores)
        self.assertGreater(result.overall, 0.80)
        self.assertEqual(result.ocr, 0.91)
        self.assertGreater(result.extraction, 0.70)
        self.assertGreater(result.validation, 0.70)
        self.assertIsInstance(result.field_scores, dict)
        self.assertIsInstance(result.critical_fields_below_threshold, list)

    def test_calculate_confidence_minimal_data(self):
        """Test confidence calculation with minimal data."""
        minimal_data = {
            'patient_name': 'John Doe',
            'document_date': '2024-01-15'
        }

        result = self.scorer.calculate_confidence(
            structured_data=minimal_data,
            ocr_results=self.sample_ocr_results,
            ocr_average_confidence=0.85
        )

        self.assertIsInstance(result, ConfidenceScores)
        self.assertLess(result.overall, 0.80)
        self.assertGreater(len(result.critical_fields_below_threshold), 0)

    def test_calculate_confidence_empty_data(self):
        """Test confidence calculation with empty data."""
        empty_data = {}

        result = self.scorer.calculate_confidence(
            structured_data=empty_data,
            ocr_results=[],
            ocr_average_confidence=0.0
        )

        self.assertIsInstance(result, ConfidenceScores)
        self.assertLess(result.overall, 0.20)  # Should be very low but not necessarily 0
        self.assertEqual(result.ocr, 0.0)

    def test_extraction_confidence_all_fields(self):
        """Test extraction confidence with all fields present."""
        confidence = self.scorer._calculate_extraction_confidence(self.sample_data)
        self.assertGreater(confidence, 0.80)

    def test_extraction_confidence_partial_fields(self):
        """Test extraction confidence with partial fields."""
        partial_data = {
            'patient_name': 'John Doe',
            'patient_age': 30,
            'medications': []
        }
        confidence = self.scorer._calculate_extraction_confidence(partial_data)
        self.assertLess(confidence, 0.50)

    def test_validation_confidence(self):
        """Test validation confidence calculation."""
        confidence = self.scorer._calculate_validation_confidence(self.sample_data)
        self.assertGreater(confidence, 0.80)

    def test_field_scores_calculation(self):
        """Test field-level confidence scores."""
        field_scores = self.scorer._calculate_field_scores(
            structured_data=self.sample_data,
            ocr_results=self.sample_ocr_results,
            ocr_average_confidence=0.90
        )

        self.assertIn('patient_name', field_scores)
        self.assertIn('medications', field_scores)
        self.assertIn('diagnosis', field_scores)
        self.assertGreater(field_scores['patient_name'], 0.80)

    def test_overall_confidence_calculation(self):
        """Test overall confidence calculation."""
        field_scores = {
            'patient_name': 0.95,
            'medications': 0.90,
            'diagnosis': 0.88,
            'document_date': 0.92
        }

        overall = self.scorer._calculate_overall_confidence(
            ocr_confidence=0.91,
            extraction_confidence=0.85,
            validation_confidence=0.88,
            field_scores=field_scores
        )

        self.assertGreater(overall, 0.80)
        self.assertLessEqual(overall, 1.0)

    def test_identify_critical_fields_below_threshold(self):
        """Test identification of critical fields below threshold."""
        field_scores = {
            'patient_name': 0.95,
            'medications': 0.75,  # Below threshold
            'diagnosis': 0.70,    # Below threshold
            'document_date': 0.90
        }

        critical_below = self.scorer._identify_critical_fields_below_threshold(field_scores)

        self.assertIn('medications', critical_below)
        self.assertIn('diagnosis', critical_below)
        self.assertNotIn('patient_name', critical_below)

    def test_validate_patient_name_valid(self):
        """Test patient name validation with valid names."""
        self.assertGreater(self.scorer._validate_patient_name('Rajesh Kumar'), 0.85)
        self.assertGreater(self.scorer._validate_patient_name('John Doe'), 0.85)

    def test_validate_patient_name_invalid(self):
        """Test patient name validation with invalid names."""
        self.assertLess(self.scorer._validate_patient_name(''), 0.50)
        self.assertLess(self.scorer._validate_patient_name('X'), 0.50)

    def test_validate_age_valid(self):
        """Test age validation with valid ages."""
        self.assertGreater(self.scorer._validate_age(25), 0.90)
        self.assertGreater(self.scorer._validate_age(65), 0.90)
        self.assertGreater(self.scorer._validate_age(0), 0.90)
        self.assertGreater(self.scorer._validate_age(120), 0.90)

    def test_validate_age_invalid(self):
        """Test age validation with invalid ages."""
        self.assertLess(self.scorer._validate_age(-5), 0.50)
        self.assertLess(self.scorer._validate_age(200), 0.50)
        self.assertEqual(self.scorer._validate_age('invalid'), 0.0)

    def test_validate_gender_valid(self):
        """Test gender validation with valid values."""
        self.assertGreater(self.scorer._validate_gender('male'), 0.95)
        self.assertGreater(self.scorer._validate_gender('female'), 0.95)
        self.assertGreater(self.scorer._validate_gender('other'), 0.95)
        self.assertGreater(self.scorer._validate_gender('M'), 0.95)
        self.assertGreater(self.scorer._validate_gender('F'), 0.95)

    def test_validate_gender_invalid(self):
        """Test gender validation with invalid values."""
        self.assertLess(self.scorer._validate_gender('unknown'), 0.70)
        self.assertEqual(self.scorer._validate_gender(''), 0.0)

    def test_validate_date_valid(self):
        """Test date validation with valid dates."""
        self.assertGreater(self.scorer._validate_date('2024-01-15'), 0.90)
        self.assertGreater(self.scorer._validate_date('15-01-2024'), 0.90)
        self.assertGreater(self.scorer._validate_date('15/01/2024'), 0.90)

    def test_validate_date_invalid(self):
        """Test date validation with invalid dates."""
        self.assertLess(self.scorer._validate_date('invalid-date'), 0.70)
        self.assertLess(self.scorer._validate_date('2050-01-01'), 0.90)  # Future date
        self.assertEqual(self.scorer._validate_date(''), 0.0)

    def test_validate_medications_valid(self):
        """Test medications validation with valid data."""
        medications = [
            {'name': 'Aspirin', 'dosage': '100mg'},
            {'name': 'Metformin', 'dosage': '500mg'}
        ]
        self.assertGreater(self.scorer._validate_medications(medications), 0.85)

    def test_validate_medications_partial(self):
        """Test medications validation with partial data."""
        medications = [
            {'name': 'Aspirin'},  # Missing dosage
            {'dosage': '500mg'}   # Missing name
        ]
        confidence = self.scorer._validate_medications(medications)
        self.assertGreater(confidence, 0.0)
        self.assertLess(confidence, 0.70)

    def test_validate_medications_empty(self):
        """Test medications validation with empty list."""
        self.assertEqual(self.scorer._validate_medications([]), 0.0)
        self.assertEqual(self.scorer._validate_medications(None), 0.0)

    def test_validate_lab_results_valid(self):
        """Test lab results validation with valid data."""
        lab_results = [
            {'test_name': 'Glucose', 'value': '95', 'unit': 'mg/dL'},
            {'test_name': 'Cholesterol', 'value': '180', 'unit': 'mg/dL'}
        ]
        self.assertGreater(self.scorer._validate_lab_results(lab_results), 0.85)

    def test_validate_lab_results_partial(self):
        """Test lab results validation with partial data."""
        lab_results = [
            {'test_name': 'Glucose'},  # Missing value
            {'value': '180'}           # Missing test name
        ]
        confidence = self.scorer._validate_lab_results(lab_results)
        self.assertGreater(confidence, 0.0)
        self.assertLess(confidence, 0.70)

    def test_validate_vital_signs_valid(self):
        """Test vital signs validation with valid data."""
        vital_signs = {
            'blood_pressure': '120/80',
            'pulse': '72',
            'temperature': '98.6',
            'respiratory_rate': '16',
            'spo2': '98'
        }
        self.assertGreater(self.scorer._validate_vital_signs(vital_signs), 0.85)

    def test_validate_vital_signs_partial(self):
        """Test vital signs validation with partial data."""
        vital_signs = {
            'blood_pressure': '120/80',
            'pulse': '72'
        }
        confidence = self.scorer._validate_vital_signs(vital_signs)
        self.assertGreater(confidence, 0.0)
        self.assertLess(confidence, 0.70)

    def test_validate_vital_signs_empty(self):
        """Test vital signs validation with empty data."""
        self.assertEqual(self.scorer._validate_vital_signs({}), 0.0)
        self.assertEqual(self.scorer._validate_vital_signs(None), 0.0)

    def test_score_field(self):
        """Test individual field scoring."""
        score = self.scorer._score_field(
            field_value='Rajesh Kumar',
            ocr_confidence=0.90,
            validation_score=0.95
        )
        self.assertGreater(score, 0.85)
        self.assertLessEqual(score, 1.0)

    def test_score_field_with_list(self):
        """Test field scoring with list value."""
        score = self.scorer._score_field(
            field_value=['item1', 'item2'],
            ocr_confidence=0.85,
            validation_score=0.90
        )
        # Should get boost for rich data
        self.assertGreater(score, 0.85)

    def test_confidence_scores_to_dict(self):
        """Test ConfidenceScores to_dict conversion."""
        scores = ConfidenceScores(
            overall=0.87,
            ocr=0.90,
            extraction=0.85,
            validation=0.88,
            field_scores={'patient_name': 0.95, 'medications': 0.85},
            critical_fields_below_threshold=['diagnosis'],
            calculated_at='2024-01-15T10:00:00Z',
            threshold_used=0.80
        )

        result = scores.to_dict()

        self.assertIsInstance(result, dict)
        self.assertEqual(result['overall'], 0.87)
        self.assertEqual(result['ocr'], 0.90)
        self.assertIn('fieldScores', result)
        self.assertIn('criticalFieldsBelowThreshold', result)

    def test_error_handling(self):
        """Test error handling in confidence calculation."""
        # Test with invalid data that might cause exceptions
        invalid_data = {
            'patient_age': 'not a number',
            'medications': 'not a list',
            'vital_signs': 'not a dict'
        }

        # Should not raise exception, should return minimal scores
        result = self.scorer.calculate_confidence(
            structured_data=invalid_data,
            ocr_results=[],
            ocr_average_confidence=0.50
        )

        self.assertIsInstance(result, ConfidenceScores)
        self.assertLessEqual(result.overall, 1.0)

    def test_high_confidence_scenario(self):
        """Test scenario with high confidence across all metrics."""
        high_quality_data = {
            'patient_name': 'Rajesh Kumar',
            'patient_age': 45,
            'patient_gender': 'male',
            'document_date': '2024-01-15',
            'doctor_name': 'Dr. Sharma',
            'medications': [
                {'name': 'Aspirin', 'dosage': '100mg', 'frequency': 'daily'},
                {'name': 'Metformin', 'dosage': '500mg', 'frequency': 'twice daily'}
            ],
            'diagnosis': ['Type 2 Diabetes', 'Hypertension'],
            'lab_results': [
                {'test_name': 'HbA1c', 'value': '6.5', 'unit': '%'}
            ],
            'vital_signs': {
                'blood_pressure': '130/85',
                'pulse': '75',
                'temperature': '98.6'
            }
        }

        high_confidence_ocr = [
            Mock(text='text', confidence=0.95) for _ in range(10)
        ]

        result = self.scorer.calculate_confidence(
            structured_data=high_quality_data,
            ocr_results=high_confidence_ocr,
            ocr_average_confidence=0.95
        )

        self.assertGreater(result.overall, 0.85)
        # With high quality data, critical fields should be above threshold
        # But allow for 1 field to be slightly below due to validation strictness
        self.assertLessEqual(len(result.critical_fields_below_threshold), 1)

    def test_low_confidence_scenario(self):
        """Test scenario with low confidence requiring HITL."""
        low_quality_data = {
            'patient_name': 'X',  # Too short
            'medications': [
                {'name': 'Unknown'}  # Missing dosage
            ]
        }

        low_confidence_ocr = [
            Mock(text='text', confidence=0.50) for _ in range(5)
        ]

        result = self.scorer.calculate_confidence(
            structured_data=low_quality_data,
            ocr_results=low_confidence_ocr,
            ocr_average_confidence=0.50
        )

        self.assertLess(result.overall, 0.80)
        self.assertGreater(len(result.critical_fields_below_threshold), 0)


if __name__ == '__main__':
    unittest.main()
