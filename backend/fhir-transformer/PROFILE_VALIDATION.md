# FHIR Profile Validation

## Overview

The FHIR Validator now supports validation against multiple FHIR profiles beyond the base R4 specification. This enables VaidyaLink to ensure resources conform to specific healthcare standards and requirements.

## Supported Profiles

### 1. Base FHIR R4 (Default)

- Standard FHIR R4 specification validation
- Validates resource structure and required fields
- No additional profile-specific requirements

### 2. ABDM (Ayushman Bharat Digital Mission)

- Indian healthcare interoperability standard
- **Requirements:**
  - Patient resources should have ABHA ID identifier
  - Indian phone numbers with +91 prefix
  - Medications coded with ATC or Indian Pharmacopoeia
  - Laboratory observations coded with LOINC
- **Use case:** Compliance with Indian national health infrastructure

### 3. VaidyaLink Custom Profile

- VaidyaLink-specific requirements for AI-extracted data
- **Requirements:**
  - Confidence scores in notes for AI-extracted resources
  - VaidyaLink system identifiers
  - Extraction date metadata
- **Use case:** Internal quality assurance for AI-powered digitization

### 4. US Core Profile

- US healthcare interoperability standard
- **Requirements:**
  - Patient resources with family and given names
  - Medications coded with RxNorm
  - US-specific code systems (CPT, ICD-10-CM)
- **Use case:** Medical tourism - Indian patients seeking care in the US

## Usage

### Basic Validation (Base R4)

```python
from utils.validator import FHIRValidator
from utils.fhir_builder import FHIRResourceBuilder

# Create validator with default base R4 profile
validator = FHIRValidator()

# Create and validate a resource
builder = FHIRResourceBuilder()
patient = builder.create_patient({
    "patientId": "patient-123",
    "name": "John Doe",
    "gender": "male",
    "birthDate": "1990-01-01"
})

is_valid = validator.validate_resource(patient)
if not is_valid:
    errors = validator.get_errors()
    print(f"Validation errors: {errors}")
```

### Profile-Specific Validation

```python
from utils.validator import FHIRValidator, ProfileType

# Validate against ABDM profile
abdm_validator = FHIRValidator(profile=ProfileType.ABDM)

patient = builder.create_patient({
    "patientId": "patient-123",
    "abhaId": "12-3456-7890-1234",  # ABDM requires ABHA ID
    "name": "Rajesh Kumar",
    "gender": "male",
    "birthDate": "1985-06-15",
    "phone": "+91-9876543210"  # ABDM requires +91 prefix
})

is_valid = abdm_validator.validate_resource(patient)
warnings = abdm_validator.get_warnings()  # Check for profile-specific warnings
```

### Explicit Profile URL Validation

```python
# Validate against a specific profile URL
validator = FHIRValidator()

profile_url = "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"
is_valid = validator.validate_resource(patient, profile_url=profile_url)
```

### VaidyaLink Profile for AI-Extracted Data

```python
from utils.validator import ProfileType

vaidyalink_validator = FHIRValidator(profile=ProfileType.VAIDYALINK)

# Create medication with confidence score
medication = builder.create_medication_statement({
    "medicationName": "Paracetamol",
    "status": "active",
    "confidence": 0.92,  # VaidyaLink profile expects confidence scores
    "extractionDate": "2024-01-15"
}, "Patient/patient-123")

is_valid = vaidyalink_validator.validate_resource(medication)
```

### US Core Profile for Medical Tourism

```python
from utils.validator import ProfileType

us_core_validator = FHIRValidator(profile=ProfileType.US_CORE)

# Create patient with US Core requirements
patient = builder.create_patient({
    "patientId": "patient-123",
    "name": "John Doe",
    "familyName": "Doe",  # US Core requires family name
    "givenName": "John",  # US Core requires given name
    "gender": "male",
    "birthDate": "1990-01-01"
})

is_valid = us_core_validator.validate_resource(patient)
```

## Validation Results

### Error Levels

1. **Errors**: Critical issues that make the resource invalid
   - Missing required fields
   - Invalid data types
   - Serialization failures

2. **Warnings**: Profile-specific recommendations
   - Missing optional but recommended fields
   - Non-standard code systems
   - Profile conformance issues

### Accessing Validation Results

```python
validator = FHIRValidator(profile=ProfileType.ABDM)
is_valid = validator.validate_resource(resource)

# Get errors (critical issues)
errors = validator.get_errors()
for error in errors:
    print(f"Error: {error['message']} at {error['location']}")

# Get warnings (recommendations)
warnings = validator.get_warnings()
for warning in warnings:
    print(f"Warning: {warning['message']} (code: {warning['code']})")

# Get all issues
all_issues = validator.get_all_issues()
```

## Profile-Specific Validation Rules

### ABDM Profile Rules

| Resource Type            | Validation Rule                              | Severity |
| ------------------------ | -------------------------------------------- | -------- |
| Patient                  | Must have ABHA ID identifier                 | Warning  |
| Patient                  | Phone numbers should have +91 prefix         | Warning  |
| MedicationStatement      | Should use ATC or Indian Pharmacopoeia codes | Warning  |
| Observation (laboratory) | Should use LOINC codes                       | Warning  |

### VaidyaLink Profile Rules

| Resource Type        | Validation Rule                                        | Severity |
| -------------------- | ------------------------------------------------------ | -------- |
| All with notes       | Should include confidence scores for AI-extracted data | Warning  |
| All with identifiers | Should have VaidyaLink system identifier               | Warning  |

### US Core Profile Rules

| Resource Type       | Validation Rule         | Severity |
| ------------------- | ----------------------- | -------- |
| Patient             | Must have family name   | Warning  |
| Patient             | Must have given name    | Warning  |
| MedicationStatement | Should use RxNorm codes | Warning  |

## Integration with Lambda Handler

```python
# In Lambda handler (src/index.py)
from utils.validator import FHIRValidator, ProfileType
from utils.fhir_builder import FHIRResourceBuilder

def lambda_handler(event, context):
    # Determine profile based on use case
    profile = ProfileType.ABDM  # For ABDM integration
    # profile = ProfileType.VAIDYALINK  # For internal processing
    # profile = ProfileType.US_CORE  # For medical tourism

    validator = FHIRValidator(profile=profile)
    builder = FHIRResourceBuilder()

    # Create FHIR resources
    patient = builder.create_patient(event['patientData'])

    # Validate before storing
    if not validator.validate_resource(patient):
        errors = validator.get_errors()
        return {
            'statusCode': 400,
            'body': {
                'error': 'Validation failed',
                'details': errors
            }
        }

    # Check warnings but don't fail
    warnings = validator.get_warnings()
    if warnings:
        logger.warning(f"Profile validation warnings: {warnings}")

    # Proceed with storage
    # ...
```

## Bundle Validation

Validate entire FHIR bundles with all contained resources:

```python
validator = FHIRValidator(profile=ProfileType.ABDM)

# Create bundle with multiple resources
bundle = builder.create_bundle([patient, medication, observation])

# Validate bundle and all entries
is_valid = validator.validate_bundle(bundle)

# Get validation results for all resources
errors = validator.get_errors()
warnings = validator.get_warnings()
```

## Best Practices

1. **Choose the Right Profile**
   - Use ABDM profile for resources that will be shared with ABDM infrastructure
   - Use VaidyaLink profile for internal AI-extracted data
   - Use US Core profile for medical tourism scenarios
   - Use Base R4 for general-purpose validation

2. **Handle Warnings Appropriately**
   - Warnings don't prevent resource creation
   - Log warnings for monitoring and quality improvement
   - Consider warnings as recommendations, not requirements

3. **Validate Early**
   - Validate resources immediately after creation
   - Catch issues before storing in HealthLake
   - Reduce downstream errors and data quality issues

4. **Profile Declaration**
   - Resources can declare conformance via `meta.profile`
   - Validator checks for profile declaration
   - Missing profile declaration generates a warning

## Testing

Run profile validation tests:

```bash
cd backend/fhir-transformer
python -m pytest src/__tests__/test_validator.py::TestProfileValidation -v
```

## Future Enhancements

1. **Additional Profiles**
   - International Patient Summary (IPS)
   - HL7 India profiles
   - Custom hospital-specific profiles

2. **Profile Registry**
   - Dynamic profile loading from registry
   - Version-specific profile validation
   - Custom profile definition support

3. **Validation Reports**
   - Detailed validation reports with recommendations
   - Compliance scoring
   - Automated profile selection based on use case

## References

- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [ABDM FHIR Profiles](https://nrces.in/ndhm/fhir/r4/)
- [US Core Implementation Guide](http://hl7.org/fhir/us/core/)
- [FHIR Profiling](https://www.hl7.org/fhir/profiling.html)
