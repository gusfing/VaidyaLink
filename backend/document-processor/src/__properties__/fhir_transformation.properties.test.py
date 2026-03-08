"""
Property-Based Tests for FHIR Transformation

Tests the following property:
- Property 8: FHIR Transformation Validity

Validates Requirements: 2.8
"""

import json
import pytest
from hypothesis import given, strategies as st, settings, assume
from hypothesis.strategies import composite
from datetime import datetime
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


# ============================================================================
# Strategy Definitions
# ============================================================================

@composite
def medication_strategy(draw):
    """Generate a valid medication with name, dosage, frequency, and confidence."""
    return {
        'name': draw(st.text(min_size=1, max_size=100)),
        'dosage': draw(st.text(min_size=1, max_size=50)),
        'frequency': draw(st.text(min_size=1, max_size=50)),
        'confidence': draw(st.floats(min_value=0.0, max_value=1.0))
    }


@composite
def lab_result_strategy(draw):
    """Generate a valid lab result with testName, value, unit, and confidence."""
    return {
        'testName': draw(st.text(min_size=1, max_size=100)),
        'value': draw(st.text(min_size=1, max_size=50)),
        'unit': draw(st.text(min_size=0, max_size=20)),
        'confidence': draw(st.floats(min_value=0.0, max_value=1.0))
    }


@composite
def entity_strategy(draw):
    """Generate a valid entity with text, type, and confidence."""
    entity_types = ['MEDICATION', 'CONDITION', 'LAB_TEST', 'PROCEDURE', 'SYMPTOM', 'DIAGNOSIS']

    return {
        'text': draw(st.text(min_size=1, max_size=100)),
        'type': draw(st.sampled_from(entity_types)),
        'confidence': draw(st.floats(min_value=0.0, max_value=1.0))
    }


@composite
def structured_data_strategy(draw):
    """Generate a complete structured data response for FHIR transformation."""
    return {
        'entities': draw(st.lists(entity_strategy(), min_size=0, max_size=20)),
        'medications': draw(st.lists(medication_strategy(), min_size=0, max_size=10)),
        'conditions': draw(st.lists(st.text(min_size=1, max_size=100), min_size=0, max_size=10)),
        'labResults': draw(st.lists(lab_result_strategy(), min_size=0, max_size=10))
    }


# ============================================================================
# Property 8: FHIR Transformation Validity
# ============================================================================

@given(structured_data_strategy(), st.text(min_size=1, max_size=50))
@settings(max_examples=100, deadline=None)
def test_property_8_fhir_bundle_structure(structured_data, job_id):
    """
    Property 8: FHIR Transformation Validity

    For any processed document or voice transcription, the generated FHIR resource
    SHALL be valid according to FHIR R4 specification with resourceType "Bundle"
    and type "collection".

    Validates: Requirements 2.8
    """
    fhir_bundle = transform_to_fhir(structured_data, job_id)

    # Verify Bundle structure
    assert isinstance(fhir_bundle, dict), \
        "FHIR bundle must be a dictionary"

    assert 'resourceType' in fhir_bundle, \
        "FHIR bundle must have 'resourceType' field"

    assert fhir_bundle['resourceType'] == 'Bundle', \
        f"FHIR resourceType must be 'Bundle', got '{fhir_bundle['resourceType']}'"

    assert 'type' in fhir_bundle, \
        "FHIR bundle must have 'type' field"

    assert fhir_bundle['type'] == 'collection', \
        f"FHIR bundle type must be 'collection', got '{fhir_bundle['type']}'"


@given(structured_data_strategy(), st.text(min_size=1, max_size=50))
@settings(max_examples=100, deadline=None)
def test_property_8_fhir_bundle_required_fields(structured_data, job_id):
    """
    Property 8 Extension: FHIR Bundle must have all required fields.

    Validates that the bundle contains id, timestamp, and entry fields.
    """
    fhir_bundle = transform_to_fhir(structured_data, job_id)

    # Required fields per FHIR R4 Bundle specification
    assert 'id' in fhir_bundle, \
        "FHIR bundle must have 'id' field"

    assert 'timestamp' in fhir_bundle, \
        "FHIR bundle must have 'timestamp' field"

    assert 'entry' in fhir_bundle, \
        "FHIR bundle must have 'entry' field"

    # Verify id format
    assert fhir_bundle['id'] == f"bundle-{job_id}", \
        f"FHIR bundle id must be 'bundle-{{job_id}}', got '{fhir_bundle['id']}'"

    # Verify timestamp format (ISO 8601 with Z suffix)
    timestamp = fhir_bundle['timestamp']
    assert isinstance(timestamp, str), \
        "FHIR bundle timestamp must be a string"
    assert timestamp.endswith('Z'), \
        "FHIR bundle timestamp must end with 'Z' (UTC indicator)"

    # Verify timestamp is valid ISO format
    try:
        datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    except ValueError:
        pytest.fail(f"FHIR bundle timestamp is not valid ISO format: {timestamp}")

    # Verify entry is a list
    assert isinstance(fhir_bundle['entry'], list), \
        "FHIR bundle entry must be a list"


@given(structured_data_strategy(), st.text(min_size=1, max_size=50))
@settings(max_examples=100, deadline=None)
def test_property_8_fhir_entry_count_matches_data(structured_data, job_id):
    """
    Property 8 Extension: FHIR Bundle entry count matches input data.

    The number of entries should equal the sum of medications, conditions, and lab results.
    """
    fhir_bundle = transform_to_fhir(structured_data, job_id)

    expected_count = (
        len(structured_data.get('medications', [])) +
        len(structured_data.get('conditions', [])) +
        len(structured_data.get('labResults', []))
    )

    actual_count = len(fhir_bundle['entry'])

    assert actual_count == expected_count, \
        f"FHIR bundle should have {expected_count} entries, got {actual_count}"


@given(structured_data_strategy(), st.text(min_size=1, max_size=50))
@settings(max_examples=100, deadline=None)
def test_property_8_fhir_entries_have_required_fields(structured_data, job_id):
    """
    Property 8 Extension: All FHIR Bundle entries have required fields.

    Each entry must have 'fullUrl' and 'resource' fields.
    """
    fhir_bundle = transform_to_fhir(structured_data, job_id)

    for idx, entry in enumerate(fhir_bundle['entry']):
        assert 'fullUrl' in entry, \
            f"Entry {idx} missing 'fullUrl' field"

        assert 'resource' in entry, \
            f"Entry {idx} missing 'resource' field"

        # Verify fullUrl format (should be URN)
        assert entry['fullUrl'].startswith('urn:uuid:'), \
            f"Entry {idx} fullUrl should start with 'urn:uuid:', got '{entry['fullUrl']}'"

        # Verify resource is a dictionary
        assert isinstance(entry['resource'], dict), \
            f"Entry {idx} resource must be a dictionary"


@given(structured_data_strategy(), st.text(min_size=1, max_size=50))
@settings(max_examples=100, deadline=None)
def test_property_8_fhir_resources_have_valid_types(structured_data, job_id):
    """
    Property 8 Extension: All FHIR resources have valid resourceType.

    Resources should be MedicationStatement, Condition, or Observation.
    """
    fhir_bundle = transform_to_fhir(structured_data, job_id)

    valid_resource_types = {'MedicationStatement', 'Condition', 'Observation'}

    for idx, entry in enumerate(fhir_bundle['entry']):
        resource = entry['resource']

        assert 'resourceType' in resource, \
            f"Entry {idx} resource missing 'resourceType' field"

        resource_type = resource['resourceType']
        assert resource_type in valid_resource_types, \
            f"Entry {idx} has invalid resourceType '{resource_type}', " \
            f"expected one of {valid_resource_types}"


@given(structured_data_strategy(), st.text(min_size=1, max_size=50))
@settings(max_examples=100, deadline=None)
def test_property_8_fhir_fullurls_are_unique(structured_data, job_id):
    """
    Property 8 Extension: All FHIR Bundle entries have unique fullUrl values.

    No two entries should have the same fullUrl.
    """
    fhir_bundle = transform_to_fhir(structured_data, job_id)

    full_urls = [entry['fullUrl'] for entry in fhir_bundle['entry']]

    # Check for uniqueness
    assert len(full_urls) == len(set(full_urls)), \
        f"FHIR bundle has duplicate fullUrl values: {full_urls}"


@given(st.lists(medication_strategy(), min_size=1, max_size=10), st.text(min_size=1, max_size=50))
@settings(max_examples=100, deadline=None)
def test_property_8_medication_statement_structure(medications, job_id):
    """
    Property 8 Extension: MedicationStatement resources have valid structure.

    Validates that medication resources conform to FHIR R4 MedicationStatement.
    """
    structured_data = {
        'entities': [],
        'medications': medications,
        'conditions': [],
        'labResults': []
    }

    fhir_bundle = transform_to_fhir(structured_data, job_id)

    for entry in fhir_bundle['entry']:
        resource = entry['resource']

        if resource['resourceType'] == 'MedicationStatement':
            # Required fields for MedicationStatement
            assert 'id' in resource, \
                "MedicationStatement must have 'id' field"

            assert 'status' in resource, \
                "MedicationStatement must have 'status' field"

            assert resource['status'] == 'active', \
                f"MedicationStatement status should be 'active', got '{resource['status']}'"

            assert 'medicationCodeableConcept' in resource, \
                "MedicationStatement must have 'medicationCodeableConcept' field"

            assert 'text' in resource['medicationCodeableConcept'], \
                "MedicationStatement medicationCodeableConcept must have 'text' field"

            assert 'dosage' in resource, \
                "MedicationStatement must have 'dosage' field"

            assert isinstance(resource['dosage'], list), \
                "MedicationStatement dosage must be a list"

            assert len(resource['dosage']) > 0, \
                "MedicationStatement dosage list must not be empty"


@given(st.lists(st.text(min_size=1, max_size=100), min_size=1, max_size=10), st.text(min_size=1, max_size=50))
@settings(max_examples=100, deadline=None)
def test_property_8_condition_resource_structure(conditions, job_id):
    """
    Property 8 Extension: Condition resources have valid structure.

    Validates that condition resources conform to FHIR R4 Condition.
    """
    structured_data = {
        'entities': [],
        'medications': [],
        'conditions': conditions,
        'labResults': []
    }

    fhir_bundle = transform_to_fhir(structured_data, job_id)

    for entry in fhir_bundle['entry']:
        resource = entry['resource']

        if resource['resourceType'] == 'Condition':
            # Required fields for Condition
            assert 'id' in resource, \
                "Condition must have 'id' field"

            assert 'clinicalStatus' in resource, \
                "Condition must have 'clinicalStatus' field"

            assert 'coding' in resource['clinicalStatus'], \
                "Condition clinicalStatus must have 'coding' field"

            assert len(resource['clinicalStatus']['coding']) > 0, \
                "Condition clinicalStatus coding must not be empty"

            assert resource['clinicalStatus']['coding'][0]['code'] == 'active', \
                "Condition clinicalStatus code should be 'active'"

            assert 'verificationStatus' in resource, \
                "Condition must have 'verificationStatus' field"

            assert 'code' in resource, \
                "Condition must have 'code' field"

            assert 'text' in resource['code'], \
                "Condition code must have 'text' field"

            assert 'recordedDate' in resource, \
                "Condition must have 'recordedDate' field"


@given(st.lists(lab_result_strategy(), min_size=1, max_size=10), st.text(min_size=1, max_size=50))
@settings(max_examples=100, deadline=None)
def test_property_8_observation_resource_structure(lab_results, job_id):
    """
    Property 8 Extension: Observation resources have valid structure.

    Validates that observation resources conform to FHIR R4 Observation.
    """
    structured_data = {
        'entities': [],
        'medications': [],
        'conditions': [],
        'labResults': lab_results
    }

    fhir_bundle = transform_to_fhir(structured_data, job_id)

    for entry in fhir_bundle['entry']:
        resource = entry['resource']

        if resource['resourceType'] == 'Observation':
            # Required fields for Observation
            assert 'id' in resource, \
                "Observation must have 'id' field"

            assert 'status' in resource, \
                "Observation must have 'status' field"

            assert resource['status'] == 'final', \
                f"Observation status should be 'final', got '{resource['status']}'"

            assert 'category' in resource, \
                "Observation must have 'category' field"

            assert isinstance(resource['category'], list), \
                "Observation category must be a list"

            assert len(resource['category']) > 0, \
                "Observation category list must not be empty"

            assert resource['category'][0]['coding'][0]['code'] == 'laboratory', \
                "Observation category code should be 'laboratory'"

            assert 'code' in resource, \
                "Observation must have 'code' field"

            assert 'text' in resource['code'], \
                "Observation code must have 'text' field"

            assert 'valueQuantity' in resource, \
                "Observation must have 'valueQuantity' field"

            assert 'value' in resource['valueQuantity'], \
                "Observation valueQuantity must have 'value' field"

            assert 'unit' in resource['valueQuantity'], \
                "Observation valueQuantity must have 'unit' field"


@given(structured_data_strategy(), st.text(min_size=1, max_size=50))
@settings(max_examples=50, deadline=None)
def test_property_8_fhir_bundle_is_json_serializable(structured_data, job_id):
    """
    Property 8 Extension: FHIR Bundle is JSON serializable.

    The bundle should be convertible to JSON without errors.
    """
    fhir_bundle = transform_to_fhir(structured_data, job_id)

    # Should be able to serialize to JSON
    try:
        json_str = json.dumps(fhir_bundle)
        assert isinstance(json_str, str), \
            "JSON serialization should produce a string"
    except (TypeError, ValueError) as e:
        pytest.fail(f"FHIR bundle is not JSON serializable: {e}")

    # Should be able to deserialize back
    try:
        deserialized = json.loads(json_str)
        assert deserialized == fhir_bundle, \
            "Deserialized bundle should match original"
    except (TypeError, ValueError) as e:
        pytest.fail(f"FHIR bundle JSON cannot be deserialized: {e}")


@given(structured_data_strategy(), st.text(min_size=1, max_size=50))
@settings(max_examples=50, deadline=None)
def test_property_8_fhir_transformation_is_deterministic(structured_data, job_id):
    """
    Property 8 Extension: FHIR transformation is deterministic (except timestamp).

    Transforming the same data twice should produce identical results except for timestamp.
    """
    fhir_bundle_1 = transform_to_fhir(structured_data, job_id)
    fhir_bundle_2 = transform_to_fhir(structured_data, job_id)

    # Remove timestamps for comparison (they will differ)
    bundle_1_copy = fhir_bundle_1.copy()
    bundle_2_copy = fhir_bundle_2.copy()

    timestamp_1 = bundle_1_copy.pop('timestamp')
    timestamp_2 = bundle_2_copy.pop('timestamp')

    # Also remove timestamps from Condition resources
    for entry in bundle_1_copy.get('entry', []):
        if entry['resource'].get('resourceType') == 'Condition':
            entry['resource'].pop('recordedDate', None)

    for entry in bundle_2_copy.get('entry', []):
        if entry['resource'].get('resourceType') == 'Condition':
            entry['resource'].pop('recordedDate', None)

    # Also remove timestamps from Observation resources
    for entry in bundle_1_copy.get('entry', []):
        if entry['resource'].get('resourceType') == 'Observation':
            entry['resource'].pop('effectiveDateTime', None)

    for entry in bundle_2_copy.get('entry', []):
        if entry['resource'].get('resourceType') == 'Observation':
            entry['resource'].pop('effectiveDateTime', None)

    # Everything else should be identical
    assert bundle_1_copy == bundle_2_copy, \
        "FHIR transformation should be deterministic (excluding timestamps)"


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================

def test_empty_structured_data_produces_valid_bundle():
    """Test that empty structured data produces a valid FHIR bundle."""
    structured_data = {
        'entities': [],
        'medications': [],
        'conditions': [],
        'labResults': []
    }

    job_id = 'test-empty-job'
    fhir_bundle = transform_to_fhir(structured_data, job_id)

    # Should still be a valid bundle
    assert fhir_bundle['resourceType'] == 'Bundle'
    assert fhir_bundle['type'] == 'collection'
    assert fhir_bundle['id'] == f'bundle-{job_id}'
    assert 'timestamp' in fhir_bundle
    assert fhir_bundle['entry'] == []


def test_medication_with_missing_optional_fields():
    """Test that medications with missing optional fields are handled gracefully."""
    medication = {
        'name': 'Aspirin'
        # Missing dosage, frequency, confidence
    }

    job_id = 'test-job'
    index = 0

    resource = create_medication_statement(medication, job_id, index)

    # Should create valid resource with defaults
    assert resource['resourceType'] == 'MedicationStatement'
    assert resource['medicationCodeableConcept']['text'] == 'Aspirin'
    assert 'Unknown dosage' in resource['dosage'][0]['text']
    assert 'Unknown frequency' in resource['dosage'][0]['text']


def test_condition_creates_valid_resource():
    """Test that condition string creates valid FHIR Condition resource."""
    condition = 'Type 2 Diabetes'
    job_id = 'test-job'
    index = 0

    resource = create_condition(condition, job_id, index)

    assert resource['resourceType'] == 'Condition'
    assert resource['code']['text'] == 'Type 2 Diabetes'
    assert resource['clinicalStatus']['coding'][0]['code'] == 'active'
    assert resource['verificationStatus']['coding'][0]['code'] == 'unconfirmed'


def test_lab_result_with_missing_optional_fields():
    """Test that lab results with missing optional fields are handled gracefully."""
    lab_result = {
        'testName': 'Blood Glucose'
        # Missing value, unit, confidence
    }

    job_id = 'test-job'
    index = 0

    resource = create_observation(lab_result, job_id, index)

    # Should create valid resource with defaults
    assert resource['resourceType'] == 'Observation'
    assert resource['code']['text'] == 'Blood Glucose'
    assert resource['valueQuantity']['value'] == 'Unknown'
    assert resource['valueQuantity']['unit'] == ''


def test_fhir_bundle_with_mixed_resources():
    """Test FHIR bundle with all resource types."""
    structured_data = {
        'entities': [],
        'medications': [
            {'name': 'Aspirin', 'dosage': '100mg', 'frequency': 'daily', 'confidence': 0.9}
        ],
        'conditions': ['Hypertension'],
        'labResults': [
            {'testName': 'Blood Pressure', 'value': '120/80', 'unit': 'mmHg', 'confidence': 0.95}
        ]
    }

    job_id = 'test-mixed-job'
    fhir_bundle = transform_to_fhir(structured_data, job_id)

    # Should have 3 entries (1 medication + 1 condition + 1 observation)
    assert len(fhir_bundle['entry']) == 3

    # Verify resource types
    resource_types = [entry['resource']['resourceType'] for entry in fhir_bundle['entry']]
    assert 'MedicationStatement' in resource_types
    assert 'Condition' in resource_types
    assert 'Observation' in resource_types


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
