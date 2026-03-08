# Property-Based Tests for Document Processor

This directory contains property-based tests for the document processor Lambda function using the Hypothesis library.

## Overview

Property-based testing validates universal correctness properties that should hold for all valid inputs, rather than testing specific examples. These tests generate hundreds of random test cases to verify that the system behaves correctly across a wide range of inputs.

## Test Files

### `entity_extraction.properties.test.py`

Tests the entity extraction functionality with the following properties:

- **Property 5: Entity Confidence Scores** - All extracted entities must have confidence scores between 0 and 1 (inclusive)
- **Property 6: Medication Structure Completeness** - All medications must contain name, dosage, and frequency fields
- **Property 7: Lab Result Structure Completeness** - All lab results must contain testName, value, and unit fields

**Validates Requirements:** 2.4, 2.5, 2.7

## Running the Tests

### Prerequisites

Install the required dependencies:

```bash
cd backend/document-processor
pip install -r requirements.txt
```

### Run All Property Tests

```bash
# From the document-processor directory
pytest src/__properties__/ -v

# Or run with more examples (default is 100)
pytest src/__properties__/ -v --hypothesis-max-examples=500
```

### Run Specific Test File

```bash
pytest src/__properties__/entity_extraction.properties.test.py -v
```

### Run Specific Test

```bash
pytest src/__properties__/entity_extraction.properties.test.py::test_property_5_entity_confidence_scores -v
```

## Test Configuration

The tests use the following Hypothesis settings:

- **max_examples**: 100 (can be overridden with `--hypothesis-max-examples`)
- **deadline**: None (no time limit per test case)

## Understanding Property Tests

### Property 5: Entity Confidence Scores

This property ensures that all confidence scores are valid probabilities:

```python
# For any entity extracted from a document
assert 0.0 <= entity['confidence'] <= 1.0
```

The test generates random entities with various confidence values and verifies:

- Confidence scores are numeric
- Confidence scores are within [0, 1]
- Out-of-range values are clamped correctly

### Property 6: Medication Structure Completeness

This property ensures medications have all required fields:

```python
# For any medication extracted
assert 'name' in medication
assert 'dosage' in medication
assert 'frequency' in medication
```

The test generates random medications and verifies:

- All required fields are present
- Fields contain valid data types
- Confidence scores (if present) are valid

### Property 7: Lab Result Structure Completeness

This property ensures lab results have all required fields:

```python
# For any lab result extracted
assert 'testName' in lab_result
assert 'value' in lab_result
assert 'unit' in lab_result
```

The test generates random lab results and verifies:

- All required fields are present
- Fields contain valid data types
- Confidence scores (if present) are valid

## Test Strategies

The tests use custom Hypothesis strategies to generate realistic test data:

- **entity_strategy**: Generates entities with text, type, and confidence
- **medication_strategy**: Generates medications with name, dosage, frequency, and confidence
- **lab_result_strategy**: Generates lab results with testName, value, unit, and confidence
- **structured_data_strategy**: Generates complete structured data responses

## Debugging Failed Tests

When a property test fails, Hypothesis will:

1. Show the failing example
2. Attempt to shrink it to the minimal failing case
3. Save it for replay in `.hypothesis/` directory

To replay a specific failing example:

```bash
pytest src/__properties__/entity_extraction.properties.test.py -v --hypothesis-seed=<seed>
```

## Integration with CI/CD

These tests should be run as part of the CI/CD pipeline before deploying the document processor Lambda:

```bash
# In your CI/CD script
cd backend/document-processor
pip install -r requirements.txt
pytest src/__properties__/ -v --hypothesis-max-examples=200
```

## Additional Resources

- [Hypothesis Documentation](https://hypothesis.readthedocs.io/)
- [Property-Based Testing Guide](https://hypothesis.works/articles/what-is-property-based-testing/)
- [AWS Real Data Integration Spec](.kiro/specs/aws-real-data-integration/)
