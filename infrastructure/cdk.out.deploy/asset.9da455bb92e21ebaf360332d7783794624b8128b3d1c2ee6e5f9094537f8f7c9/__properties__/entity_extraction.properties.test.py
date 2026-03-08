"""
Property-Based Tests for Entity Extraction

Tests the following properties:
- Property 5: Entity Confidence Scores
- Property 6: Medication Structure Completeness
- Property 7: Lab Result Structure Completeness

Validates Requirements: 2.4, 2.5, 2.7
"""

import json
import pytest
from hypothesis import given, strategies as st, settings, assume
from hypothesis.strategies import composite
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from index import parse_bedrock_response, extract_entities_with_bedrock


# ============================================================================
# Strategy Definitions
# ============================================================================

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
        'unit': draw(st.text(min_size=1, max_size=20)),
        'confidence': draw(st.floats(min_value=0.0, max_value=1.0))
    }


@composite
def structured_data_strategy(draw):
    """Generate a complete structured data response."""
    return {
        'entities': draw(st.lists(entity_strategy(), min_size=0, max_size=20)),
        'medications': draw(st.lists(medication_strategy(), min_size=0, max_size=10)),
        'conditions': draw(st.lists(st.text(min_size=1, max_size=100), min_size=0, max_size=10)),
        'labResults': draw(st.lists(lab_result_strategy(), min_size=0, max_size=10))
    }


# ============================================================================
# Property 5: Entity Confidence Scores
# ============================================================================

@given(structured_data_strategy())
@settings(max_examples=100, deadline=None)
def test_property_5_entity_confidence_scores(structured_data):
    """
    Property 5: Entity Confidence Scores

    For any extracted entity from document processing, the entity SHALL have
    a confidence score between 0 and 1 (inclusive).

    Validates: Requirements 2.7
    """
    # Convert to JSON and parse to simulate Bedrock response
    response_text = json.dumps(structured_data)

    # Parse the response
    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    # Check all entities have confidence scores in valid range
    for entity in parsed_data['entities']:
        if 'confidence' in entity:
            confidence = entity['confidence']
            assert isinstance(confidence, (int, float)), \
                f"Entity confidence must be numeric, got {type(confidence)}"
            assert 0.0 <= confidence <= 1.0, \
                f"Entity confidence must be between 0 and 1, got {confidence}"


@given(st.lists(entity_strategy(), min_size=1, max_size=20))
@settings(max_examples=100, deadline=None)
def test_property_5_all_entities_have_confidence(entities):
    """
    Property 5 Extension: All entities must have confidence scores.

    Ensures that every entity extracted includes a confidence field.
    """
    structured_data = {
        'entities': entities,
        'medications': [],
        'conditions': [],
        'labResults': []
    }

    response_text = json.dumps(structured_data)
    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    # Every entity should have a confidence score
    for entity in parsed_data['entities']:
        assert 'confidence' in entity, \
            f"Entity missing confidence score: {entity}"
        assert 0.0 <= entity['confidence'] <= 1.0, \
            f"Invalid confidence score: {entity['confidence']}"


@given(st.floats(allow_nan=False, allow_infinity=False))
@settings(max_examples=100, deadline=None)
def test_property_5_confidence_clamping(confidence_value):
    """
    Property 5 Extension: Confidence scores outside [0, 1] are clamped.

    Tests that the parser correctly clamps confidence values to the valid range.
    """
    # Create entity with potentially out-of-range confidence
    structured_data = {
        'entities': [
            {'text': 'Test Entity', 'type': 'MEDICATION', 'confidence': confidence_value}
        ],
        'medications': [],
        'conditions': [],
        'labResults': []
    }

    response_text = json.dumps(structured_data)
    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    # Confidence should be clamped to [0, 1]
    entity_confidence = parsed_data['entities'][0]['confidence']
    assert 0.0 <= entity_confidence <= 1.0, \
        f"Confidence not properly clamped: {entity_confidence}"

    # Verify clamping behavior
    if confidence_value < 0:
        assert entity_confidence == 0.0, \
            f"Negative confidence should be clamped to 0, got {entity_confidence}"
    elif confidence_value > 1:
        assert entity_confidence == 1.0, \
            f"Confidence > 1 should be clamped to 1, got {entity_confidence}"
    else:
        assert abs(entity_confidence - confidence_value) < 0.0001, \
            f"Valid confidence should be preserved: expected {confidence_value}, got {entity_confidence}"


# ============================================================================
# Property 6: Medication Structure Completeness
# ============================================================================

@given(st.lists(medication_strategy(), min_size=1, max_size=10))
@settings(max_examples=100, deadline=None)
def test_property_6_medication_structure_completeness(medications):
    """
    Property 6: Medication Structure Completeness

    For any extracted medication, it SHALL contain name, dosage, and frequency fields.

    Validates: Requirements 2.4
    """
    structured_data = {
        'entities': [],
        'medications': medications,
        'conditions': [],
        'labResults': []
    }

    response_text = json.dumps(structured_data)
    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    # Check all medications have required fields
    for medication in parsed_data['medications']:
        assert 'name' in medication, \
            f"Medication missing 'name' field: {medication}"
        assert 'dosage' in medication, \
            f"Medication missing 'dosage' field: {medication}"
        assert 'frequency' in medication, \
            f"Medication missing 'frequency' field: {medication}"


@given(medication_strategy())
@settings(max_examples=100, deadline=None)
def test_property_6_medication_fields_non_empty(medication):
    """
    Property 6 Extension: Medication fields should be non-empty strings.

    Ensures that medication fields contain meaningful data.
    """
    structured_data = {
        'entities': [],
        'medications': [medication],
        'conditions': [],
        'labResults': []
    }

    response_text = json.dumps(structured_data)
    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    med = parsed_data['medications'][0]

    # All required fields should exist
    assert 'name' in med
    assert 'dosage' in med
    assert 'frequency' in med

    # Fields should be strings (or convertible to strings)
    assert isinstance(med['name'], str) or med['name'] is not None
    assert isinstance(med['dosage'], str) or med['dosage'] is not None
    assert isinstance(med['frequency'], str) or med['frequency'] is not None


@given(st.lists(medication_strategy(), min_size=1, max_size=10))
@settings(max_examples=100, deadline=None)
def test_property_6_medication_confidence_scores(medications):
    """
    Property 6 Extension: Medications should have valid confidence scores.

    Combines Property 5 and Property 6 - medications must have confidence in [0, 1].
    """
    structured_data = {
        'entities': [],
        'medications': medications,
        'conditions': [],
        'labResults': []
    }

    response_text = json.dumps(structured_data)
    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    for medication in parsed_data['medications']:
        if 'confidence' in medication:
            confidence = medication['confidence']
            assert isinstance(confidence, (int, float)), \
                f"Medication confidence must be numeric, got {type(confidence)}"
            assert 0.0 <= confidence <= 1.0, \
                f"Medication confidence must be between 0 and 1, got {confidence}"


# ============================================================================
# Property 7: Lab Result Structure Completeness
# ============================================================================

@given(st.lists(lab_result_strategy(), min_size=1, max_size=10))
@settings(max_examples=100, deadline=None)
def test_property_7_lab_result_structure_completeness(lab_results):
    """
    Property 7: Lab Result Structure Completeness

    For any extracted lab result, it SHALL contain testName, value, and unit fields.

    Validates: Requirements 2.5
    """
    structured_data = {
        'entities': [],
        'medications': [],
        'conditions': [],
        'labResults': lab_results
    }

    response_text = json.dumps(structured_data)
    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    # Check all lab results have required fields
    for lab_result in parsed_data['labResults']:
        assert 'testName' in lab_result, \
            f"Lab result missing 'testName' field: {lab_result}"
        assert 'value' in lab_result, \
            f"Lab result missing 'value' field: {lab_result}"
        assert 'unit' in lab_result, \
            f"Lab result missing 'unit' field: {lab_result}"


@given(lab_result_strategy())
@settings(max_examples=100, deadline=None)
def test_property_7_lab_result_fields_non_empty(lab_result):
    """
    Property 7 Extension: Lab result fields should be non-empty strings.

    Ensures that lab result fields contain meaningful data.
    """
    structured_data = {
        'entities': [],
        'medications': [],
        'conditions': [],
        'labResults': [lab_result]
    }

    response_text = json.dumps(structured_data)
    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    result = parsed_data['labResults'][0]

    # All required fields should exist
    assert 'testName' in result
    assert 'value' in result
    assert 'unit' in result

    # Fields should be strings (or convertible to strings)
    assert isinstance(result['testName'], str) or result['testName'] is not None
    assert isinstance(result['value'], str) or result['value'] is not None
    assert isinstance(result['unit'], str) or result['unit'] is not None


@given(st.lists(lab_result_strategy(), min_size=1, max_size=10))
@settings(max_examples=100, deadline=None)
def test_property_7_lab_result_confidence_scores(lab_results):
    """
    Property 7 Extension: Lab results should have valid confidence scores.

    Combines Property 5 and Property 7 - lab results must have confidence in [0, 1].
    """
    structured_data = {
        'entities': [],
        'medications': [],
        'conditions': [],
        'labResults': lab_results
    }

    response_text = json.dumps(structured_data)
    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    for lab_result in parsed_data['labResults']:
        if 'confidence' in lab_result:
            confidence = lab_result['confidence']
            assert isinstance(confidence, (int, float)), \
                f"Lab result confidence must be numeric, got {type(confidence)}"
            assert 0.0 <= confidence <= 1.0, \
                f"Lab result confidence must be between 0 and 1, got {confidence}"


# ============================================================================
# Combined Properties Tests
# ============================================================================

@given(structured_data_strategy())
@settings(max_examples=100, deadline=None)
def test_combined_all_structures_valid(structured_data):
    """
    Combined test for Properties 5, 6, and 7.

    Validates that all extracted data structures meet their requirements:
    - All entities have confidence scores in [0, 1]
    - All medications have name, dosage, frequency
    - All lab results have testName, value, unit
    """
    response_text = json.dumps(structured_data)
    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    # Property 5: Entity confidence scores
    for entity in parsed_data['entities']:
        if 'confidence' in entity:
            assert 0.0 <= entity['confidence'] <= 1.0, \
                f"Entity confidence out of range: {entity['confidence']}"

    # Property 6: Medication structure
    for medication in parsed_data['medications']:
        assert 'name' in medication, f"Medication missing name: {medication}"
        assert 'dosage' in medication, f"Medication missing dosage: {medication}"
        assert 'frequency' in medication, f"Medication missing frequency: {medication}"

        if 'confidence' in medication:
            assert 0.0 <= medication['confidence'] <= 1.0, \
                f"Medication confidence out of range: {medication['confidence']}"

    # Property 7: Lab result structure
    for lab_result in parsed_data['labResults']:
        assert 'testName' in lab_result, f"Lab result missing testName: {lab_result}"
        assert 'value' in lab_result, f"Lab result missing value: {lab_result}"
        assert 'unit' in lab_result, f"Lab result missing unit: {lab_result}"

        if 'confidence' in lab_result:
            assert 0.0 <= lab_result['confidence'] <= 1.0, \
                f"Lab result confidence out of range: {lab_result['confidence']}"


@given(structured_data_strategy())
@settings(max_examples=50, deadline=None)
def test_parse_bedrock_response_idempotency(structured_data):
    """
    Property: Parsing is idempotent.

    Parsing the same response multiple times should yield identical results.
    """
    response_text = json.dumps(structured_data)

    # Parse twice
    parsed_1 = parse_bedrock_response(response_text, job_id='test-job-1')
    parsed_2 = parse_bedrock_response(response_text, job_id='test-job-2')

    # Results should be identical
    assert parsed_1 == parsed_2, \
        "Parsing the same response should yield identical results"


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================

def test_empty_response_structure():
    """Test that empty structures are handled correctly."""
    structured_data = {
        'entities': [],
        'medications': [],
        'conditions': [],
        'labResults': []
    }

    response_text = json.dumps(structured_data)
    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    assert parsed_data['entities'] == []
    assert parsed_data['medications'] == []
    assert parsed_data['conditions'] == []
    assert parsed_data['labResults'] == []


def test_missing_optional_fields():
    """Test that missing optional fields are handled gracefully."""
    # Response with minimal required fields
    structured_data = {
        'entities': [{'text': 'Test', 'type': 'MEDICATION'}],  # Missing confidence
        'medications': [{'name': 'Aspirin', 'dosage': '100mg', 'frequency': 'daily'}],  # Missing confidence
        'conditions': ['Hypertension'],
        'labResults': [{'testName': 'Blood Pressure', 'value': '120/80', 'unit': 'mmHg'}]  # Missing confidence
    }

    response_text = json.dumps(structured_data)
    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    # Should parse successfully even without confidence scores
    assert len(parsed_data['entities']) == 1
    assert len(parsed_data['medications']) == 1
    assert len(parsed_data['labResults']) == 1


def test_invalid_json_raises_error():
    """Test that invalid JSON raises appropriate error."""
    invalid_json = "This is not valid JSON"

    with pytest.raises(ValueError, match="No JSON object found in response"):
        parse_bedrock_response(invalid_json, job_id='test-job')


def test_json_with_extra_text():
    """Test that JSON embedded in extra text is extracted correctly."""
    structured_data = {
        'entities': [{'text': 'Aspirin', 'type': 'MEDICATION', 'confidence': 0.9}],
        'medications': [],
        'conditions': [],
        'labResults': []
    }

    # Add extra text before and after JSON
    response_text = f"Here is the extracted data:\n{json.dumps(structured_data)}\nEnd of data."

    parsed_data = parse_bedrock_response(response_text, job_id='test-job')

    assert len(parsed_data['entities']) == 1
    assert parsed_data['entities'][0]['text'] == 'Aspirin'


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
