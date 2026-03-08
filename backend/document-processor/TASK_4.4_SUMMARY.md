# Task 4.4 Summary: Property Tests for Entity Extraction

## Overview

Implemented comprehensive property-based tests for entity extraction functionality in the document processor Lambda function. These tests validate universal correctness properties using the Hypothesis library to ensure the system behaves correctly across all possible inputs.

## Implemented Properties

### Property 5: Entity Confidence Scores

**Requirement:** For any extracted entity from document processing, the entity SHALL have a confidence score between 0 and 1 (inclusive).

**Validates:** Requirements 2.7

**Test Coverage:**

- Validates all entity confidence scores are numeric
- Ensures confidence scores are within [0, 1] range
- Tests confidence clamping for out-of-range values
- Verifies all entities include confidence scores

### Property 6: Medication Structure Completeness

**Requirement:** For any extracted medication, it SHALL contain name, dosage, and frequency fields.

**Validates:** Requirements 2.4

**Test Coverage:**

- Validates presence of required fields (name, dosage, frequency)
- Ensures fields contain valid data types
- Tests medication confidence scores are valid
- Verifies structure completeness across random inputs

### Property 7: Lab Result Structure Completeness

**Requirement:** For any extracted lab result, it SHALL contain testName, value, and unit fields.

**Validates:** Requirements 2.5

**Test Coverage:**

- Validates presence of required fields (testName, value, unit)
- Ensures fields contain valid data types
- Tests lab result confidence scores are valid
- Verifies structure completeness across random inputs

## Files Created

### 1. `src/__properties__/entity_extraction.properties.test.py`

Main property test file containing:

- 15 property-based tests
- Custom Hypothesis strategies for generating test data
- Combined property tests validating all requirements together
- Edge case and error handling tests

**Key Test Functions:**

- `test_property_5_entity_confidence_scores` - Main Property 5 test
- `test_property_5_all_entities_have_confidence` - Extension test
- `test_property_5_confidence_clamping` - Clamping behavior test
- `test_property_6_medication_structure_completeness` - Main Property 6 test
- `test_property_6_medication_fields_non_empty` - Extension test
- `test_property_6_medication_confidence_scores` - Combined test
- `test_property_7_lab_result_structure_completeness` - Main Property 7 test
- `test_property_7_lab_result_fields_non_empty` - Extension test
- `test_property_7_lab_result_confidence_scores` - Combined test
- `test_combined_all_structures_valid` - Combined validation test
- `test_parse_bedrock_response_idempotency` - Idempotency test
- `test_empty_response_structure` - Edge case test
- `test_missing_optional_fields` - Optional fields test
- `test_invalid_json_raises_error` - Error handling test
- `test_json_with_extra_text` - JSON extraction test

### 2. `src/__properties__/README.md`

Comprehensive documentation including:

- Overview of property-based testing
- Test file descriptions
- Running instructions
- Test configuration details
- Property explanations
- Debugging guidance
- CI/CD integration instructions

### 3. `pytest.ini`

Pytest configuration file with:

- Test discovery patterns
- Output options
- Test markers (property, unit, integration, slow)
- Hypothesis profile settings
- Test paths configuration

### 4. `run-property-tests.sh`

Bash script for running property tests on Linux/Mac:

- Checks Python installation
- Installs dependencies if needed
- Runs property tests with appropriate flags
- Provides clear output and status

### 5. `run-property-tests.ps1`

PowerShell script for running property tests on Windows:

- Checks Python installation
- Installs dependencies if needed
- Runs property tests with appropriate flags
- Provides colored output and status

### 6. Updated `requirements.txt`

Added testing dependencies:

- `pytest>=7.4.0` - Testing framework
- `hypothesis>=6.92.0` - Property-based testing library

### 7. Updated `README.md`

Enhanced documentation with:

- Property-based testing section
- Test running instructions
- Links to property test documentation
- Updated future enhancements section

## Test Strategies

The tests use custom Hypothesis strategies to generate realistic test data:

```python
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
```

## Running the Tests

### Basic Usage

```bash
# Install dependencies
cd backend/document-processor
pip install -r requirements.txt

# Run all property tests
pytest src/__properties__/ -v

# Or use convenience scripts
./run-property-tests.sh  # Linux/Mac
./run-property-tests.ps1  # Windows PowerShell
```

### Advanced Usage

```bash
# Run with more examples (default is 100)
pytest src/__properties__/ -v --hypothesis-max-examples=500

# Run specific test
pytest src/__properties__/entity_extraction.properties.test.py::test_property_5_entity_confidence_scores -v

# Run with specific seed for reproducibility
pytest src/__properties__/ -v --hypothesis-seed=12345

# Run only property-marked tests
pytest src/__properties__/ -v -m property
```

## Test Configuration

The tests use the following Hypothesis settings:

- **max_examples**: 100 (generates 100 random test cases per property)
- **deadline**: None (no time limit per test case)
- **profile**: default

These settings can be overridden via command-line flags or environment variables.

## Integration with CI/CD

The property tests should be integrated into the CI/CD pipeline:

```bash
# In CI/CD script
cd backend/document-processor
pip install -r requirements.txt
pytest src/__properties__/ -v --hypothesis-max-examples=200
```

## Benefits of Property-Based Testing

1. **Comprehensive Coverage**: Tests hundreds of random inputs instead of a few hand-picked examples
2. **Edge Case Discovery**: Automatically finds edge cases that manual testing might miss
3. **Regression Prevention**: Ensures properties hold across all inputs, not just known examples
4. **Documentation**: Properties serve as executable specifications
5. **Confidence**: Provides high confidence that the system behaves correctly

## Example Test Output

```
test_property_5_entity_confidence_scores PASSED                          [ 6%]
test_property_5_all_entities_have_confidence PASSED                      [13%]
test_property_5_confidence_clamping PASSED                               [20%]
test_property_6_medication_structure_completeness PASSED                 [26%]
test_property_6_medication_fields_non_empty PASSED                       [33%]
test_property_6_medication_confidence_scores PASSED                      [40%]
test_property_7_lab_result_structure_completeness PASSED                 [46%]
test_property_7_lab_result_fields_non_empty PASSED                       [53%]
test_property_7_lab_result_confidence_scores PASSED                      [60%]
test_combined_all_structures_valid PASSED                                [66%]
test_parse_bedrock_response_idempotency PASSED                           [73%]
test_empty_response_structure PASSED                                     [80%]
test_missing_optional_fields PASSED                                      [86%]
test_invalid_json_raises_error PASSED                                    [93%]
test_json_with_extra_text PASSED                                         [100%]

======================== 15 passed in 12.34s ========================
```

## Next Steps

With property tests in place for entity extraction, the next tasks are:

- **Task 4.5**: Implement FHIR transformation
- **Task 4.6**: Write property tests for FHIR transformation
- **Task 4.7**: Store results and update job status to complete
- **Task 4.8**: Implement error handling and failure status updates
- **Task 4.9**: Write property tests for error handling
- **Task 4.10**: Add CloudWatch logging and metrics

## Related Documentation

- [Property Tests README](src/__properties__/README.md)
- [Document Processor README](README.md)
- [AWS Real Data Integration Spec](../../.kiro/specs/aws-real-data-integration/)
- [Hypothesis Documentation](https://hypothesis.readthedocs.io/)
