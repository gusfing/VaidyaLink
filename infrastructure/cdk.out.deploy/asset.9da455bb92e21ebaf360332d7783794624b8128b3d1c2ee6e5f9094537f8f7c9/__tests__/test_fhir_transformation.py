"""
Unit tests for FHIR transformation functionality.

Tests the transformation of extracted medical data to FHIR R4 Bundle format.
"""

import pytest
import json
from datetime import datetime
from unittest.mock import patch, MagicMock
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from index import (
    transform_to_fhir,
    create_medication_statement,
    create_condition,
    create_observation
)


class TestFHIRTransformation:
    """Test suite for FHIR transformation functions."""

    def test_transform_to_fhir_creates_bundle(self):
        """Test that transform_to_fhir creates a valid FHIR Bundle."""
        structured_data = {
            'entities': [],
            'medications': [
                {
                    'name': 'Aspirin',
                    'dosage': '100mg',
                    'frequency': 'once daily',
                    'confidence': 0.95
                }
            ],
            'conditions': ['Hypertension'],
            'labResults': [
                {
                    'testName': 'Blood Glucose',
                    'value': '120',
                    'unit': 'mg/dL',
                    'confidence': 0.9
                }
            ]
        }

        job_id = 'test-job-123'
        fhir_bundle = transform_to_fhir(structured_data, job_id)

        # Verify bundle structure
        assert fhir_bundle['resourceType'] == 'Bundle'
        assert fhir_bundle['type'] == 'collection'
        assert fhir_bundle['id'] == f'bundle-{job_id}'
        assert 'timestamp' in fhir_bundle
        assert 'entry' in fhir_bundle

        # Verify entries count (1 medication + 1 condition + 1 observation)
        assert len(fhir_bundle['entry']) == 3

    def test_transform_to_fhir_with_empty_data(self):
        """Test FHIR transformation with empty structured data."""
        structured_data = {
            'entities': [],
            'medications': [],
            'conditions': [],
            'labResults': []
        }

        job_id = 'test-job-empty'
        fhir_bundle = transform_to_fhir(structured_data, job_id)

        # Verify bundle is created even with no data
        assert fhir_bundle['resourceType'] == 'Bundle'
        assert fhir_bundle['type'] == 'collection'
        assert len(fhir_bundle['entry']) == 0

    def test_create_medication_statement(self):
        """Test creation of FHIR MedicationStatement resource."""
        medication = {
            'name': 'Metformin',
            'dosage': '500mg',
            'frequency': 'twice daily',
            'confidence': 0.88
        }

        job_id = 'test-job-456'
        index = 0

        resource = create_medication_statement(medication, job_id, index)

        # Verify resource structure
        assert resource['resourceType'] == 'MedicationStatement'
        assert resource['id'] == f'medication-{job_id}-{index}'
        assert resource['status'] == 'active'
        assert resource['medicationCodeableConcept']['text'] == 'Metformin'
        assert len(resource['dosage']) == 1
        assert resource['dosage'][0]['text'] == '500mg twice daily'

        # Verify confidence extension
        assert len(resource['extension']) == 1
        assert resource['extension'][0]['valueDecimal'] == 0.88

    def test_create_medication_statement_with_missing_fields(self):
        """Test medication statement creation with missing optional fields."""
        medication = {
            'name': 'Unknown Med'
        }

        job_id = 'test-job-789'
        index = 1

        resource = create_medication_statement(medication, job_id, index)

        # Verify defaults are used
        assert resource['medicationCodeableConcept']['text'] == 'Unknown Med'
        assert 'Unknown dosage' in resource['dosage'][0]['text']
        assert 'Unknown frequency' in resource['dosage'][0]['text']
        assert resource['extension'][0]['valueDecimal'] == 0.0

    def test_create_condition(self):
        """Test creation of FHIR Condition resource."""
        condition = 'Type 2 Diabetes'
        job_id = 'test-job-condition'
        index = 0

        resource = create_condition(condition, job_id, index)

        # Verify resource structure
        assert resource['resourceType'] == 'Condition'
        assert resource['id'] == f'condition-{job_id}-{index}'
        assert resource['code']['text'] == 'Type 2 Diabetes'

        # Verify clinical status
        assert resource['clinicalStatus']['coding'][0]['code'] == 'active'

        # Verify verification status
        assert resource['verificationStatus']['coding'][0]['code'] == 'unconfirmed'

        # Verify recorded date exists
        assert 'recordedDate' in resource

    def test_create_observation(self):
        """Test creation of FHIR Observation resource for lab results."""
        lab_result = {
            'testName': 'Hemoglobin A1C',
            'value': '6.5',
            'unit': '%',
            'confidence': 0.92
        }

        job_id = 'test-job-obs'
        index = 0

        resource = create_observation(lab_result, job_id, index)

        # Verify resource structure
        assert resource['resourceType'] == 'Observation'
        assert resource['id'] == f'observation-{job_id}-{index}'
        assert resource['status'] == 'final'

        # Verify category
        assert len(resource['category']) == 1
        assert resource['category'][0]['coding'][0]['code'] == 'laboratory'

        # Verify code
        assert resource['code']['text'] == 'Hemoglobin A1C'

        # Verify value
        assert resource['valueQuantity']['value'] == '6.5'
        assert resource['valueQuantity']['unit'] == '%'

        # Verify confidence extension
        assert resource['extension'][0]['valueDecimal'] == 0.92

    def test_create_observation_with_missing_fields(self):
        """Test observation creation with missing optional fields."""
        lab_result = {
            'testName': 'Unknown Test'
        }

        job_id = 'test-job-obs-missing'
        index = 1

        resource = create_observation(lab_result, job_id, index)

        # Verify defaults are used
        assert resource['code']['text'] == 'Unknown Test'
        assert resource['valueQuantity']['value'] == 'Unknown'
        assert resource['valueQuantity']['unit'] == ''
        assert resource['extension'][0]['valueDecimal'] == 0.0

    def test_transform_to_fhir_with_multiple_resources(self):
        """Test FHIR transformation with multiple resources of each type."""
        structured_data = {
            'entities': [],
            'medications': [
                {'name': 'Med1', 'dosage': '10mg', 'frequency': 'daily', 'confidence': 0.9},
                {'name': 'Med2', 'dosage': '20mg', 'frequency': 'twice daily', 'confidence': 0.85}
            ],
            'conditions': ['Condition1', 'Condition2', 'Condition3'],
            'labResults': [
                {'testName': 'Test1', 'value': '100', 'unit': 'mg/dL', 'confidence': 0.95},
                {'testName': 'Test2', 'value': '200', 'unit': 'mmol/L', 'confidence': 0.88}
            ]
        }

        job_id = 'test-job-multiple'
        fhir_bundle = transform_to_fhir(structured_data, job_id)

        # Verify total entries (2 medications + 3 conditions + 2 observations = 7)
        assert len(fhir_bundle['entry']) == 7

        # Count resource types
        medication_count = sum(1 for entry in fhir_bundle['entry']
                              if entry['resource']['resourceType'] == 'MedicationStatement')
        condition_count = sum(1 for entry in fhir_bundle['entry']
                             if entry['resource']['resourceType'] == 'Condition')
        observation_count = sum(1 for entry in fhir_bundle['entry']
                               if entry['resource']['resourceType'] == 'Observation')

        assert medication_count == 2
        assert condition_count == 3
        assert observation_count == 2

    def test_fhir_bundle_has_unique_fullurls(self):
        """Test that all entries in FHIR bundle have unique fullUrl values."""
        structured_data = {
            'entities': [],
            'medications': [
                {'name': 'Med1', 'dosage': '10mg', 'frequency': 'daily', 'confidence': 0.9},
                {'name': 'Med2', 'dosage': '20mg', 'frequency': 'twice daily', 'confidence': 0.85}
            ],
            'conditions': ['Condition1', 'Condition2'],
            'labResults': [
                {'testName': 'Test1', 'value': '100', 'unit': 'mg/dL', 'confidence': 0.95}
            ]
        }

        job_id = 'test-job-unique'
        fhir_bundle = transform_to_fhir(structured_data, job_id)

        # Extract all fullUrl values
        full_urls = [entry['fullUrl'] for entry in fhir_bundle['entry']]

        # Verify all are unique
        assert len(full_urls) == len(set(full_urls))

    def test_fhir_bundle_timestamp_format(self):
        """Test that FHIR bundle timestamp is in ISO format with Z suffix."""
        structured_data = {
            'entities': [],
            'medications': [],
            'conditions': [],
            'labResults': []
        }

        job_id = 'test-job-timestamp'
        fhir_bundle = transform_to_fhir(structured_data, job_id)

        # Verify timestamp format
        timestamp = fhir_bundle['timestamp']
        assert timestamp.endswith('Z')

        # Verify it can be parsed as ISO datetime
        try:
            datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except ValueError:
            pytest.fail("Timestamp is not in valid ISO format")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
