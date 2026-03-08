# FHIR Profile Validation - Quick Start Guide

## What is Profile Validation?

Profile validation ensures your FHIR resources conform to specific healthcare standards beyond the base FHIR R4 specification. VaidyaLink supports multiple profiles for different use cases.

## Quick Examples

### 1. Basic Validation (Default)

```python
from utils.validator import FHIRValidator
from utils.fhir_builder import FHIRResourceBuilder

validator = FHIRValidator()
builder = FHIRResourceBuilder()

patient = builder.create_patient({
    "patientId": "patient-123",
    "name": "John Doe",
    "gender": "male",
    "birthDate": "1990-01-01"
})

if validator.validate_resource(patient):
    print("✓ Valid FHIR resource")
else:
    print("✗ Validation failed:", validator.get_errors())
```

### 2. ABDM Profile (Indian Healthcare)

```python
from utils.validator import FHIRValidator, ProfileType

# Use ABDM profile for Indian healthcare compliance
validator = FHIRValidator(profile=ProfileType.ABDM)

patient = builder.create_patient({
    "patientId": "patient-123",
    "abhaId": "12-3456-7890-1234",  # ABHA ID for ABDM
    "name": "Rajesh Kumar",
    "gender": "male",
    "birthDate": "1985-06-15",
    "phone": "+91-9876543210"  # Indian phone format
})

is_valid = validator.validate_resource(patient)
warnings = validator.get_warnings()  # Check recommendations
```

### 3. VaidyaLink Profile (AI-Extracted Data)

```python
from utils.validator import ProfileType

# Use VaidyaLink profile for AI-extracted resources
validator = FHIRValidator(profile=ProfileType.VAIDYALINK)

medication = builder.create_medication_statement({
    "medicationName": "Paracetamol",
    "status": "active",
    "confidence": 0.92,  # AI confidence score
    "extractionDate": "2024-01-15"
}, "Patient/patient-123")

is_valid = validator.validate_resource(medication)
```

### 4. US Core Profile (Medical Tourism)

```python
from utils.validator import ProfileType

# Use US Core profile for US healthcare compatibility
validator = FHIRValidator(profile=ProfileType.US_CORE)

patient = builder.create_patient({
    "patientId": "patient-123",
    "name": "John Doe",
    "familyName": "Doe",  # Required by US Core
    "givenName": "John",  # Required by US Core
    "gender": "male",
    "birthDate": "1990-01-01"
})

is_valid = validator.validate_resource(patient)
```

## Available Profiles

| Profile                  | Use Case                | Key Requirements      |
| ------------------------ | ----------------------- | --------------------- |
| `ProfileType.BASE_R4`    | General FHIR validation | Base FHIR R4 spec     |
| `ProfileType.ABDM`       | Indian healthcare       | ABHA ID, Indian codes |
| `ProfileType.VAIDYALINK` | AI-extracted data       | Confidence scores     |
| `ProfileType.US_CORE`    | Medical tourism         | US code systems       |

## Handling Validation Results

```python
validator = FHIRValidator(profile=ProfileType.ABDM)
is_valid = validator.validate_resource(resource)

# Errors (critical - resource is invalid)
if not is_valid:
    for error in validator.get_errors():
        print(f"ERROR: {error['message']}")
        print(f"  Location: {error['location']}")
        print(f"  Code: {error['code']}")

# Warnings (recommendations - resource is still valid)
for warning in validator.get_warnings():
    print(f"WARNING: {warning['message']}")
    print(f"  Code: {warning['code']}")
```

## Common Use Cases

### Use Case 1: ABDM Integration

```python
# When pushing data to ABDM infrastructure
validator = FHIRValidator(profile=ProfileType.ABDM)

# Validate all resources before ABDM push
for resource in resources:
    if not validator.validate_resource(resource):
        logger.error(f"ABDM validation failed: {validator.get_errors()}")
        # Handle error
```

### Use Case 2: Quality Assurance for AI Extraction

```python
# When processing AI-extracted medical records
validator = FHIRValidator(profile=ProfileType.VAIDYALINK)

# Ensure confidence scores are present
medication = builder.create_medication_statement({
    "medicationName": "Aspirin",
    "confidence": 0.89,  # From OCR/AI
    "extractionDate": "2024-01-15"
}, patient_ref)

if validator.validate_resource(medication):
    # Check if confidence is acceptable
    warnings = validator.get_warnings()
    if not warnings:
        print("✓ High-quality AI extraction")
```

### Use Case 3: Medical Tourism Export

```python
# When exporting records for US healthcare providers
validator = FHIRValidator(profile=ProfileType.US_CORE)

# Validate bundle before export
bundle = builder.create_bundle(resources)
if validator.validate_bundle(bundle):
    # Export to US-compatible format
    export_to_us_format(bundle)
```

## Testing Your Implementation

```bash
# Run profile validation tests
cd backend/fhir-transformer
python -m pytest src/__tests__/test_validator.py::TestProfileValidation -v
```

## Next Steps

1. Read the full [Profile Validation Guide](./PROFILE_VALIDATION.md)
2. Review [FHIR Builder documentation](./QUICK_START.md)
3. Check [FHIR Parser Integration](./FHIR_PARSER_INTEGRATION.md)

## Common Issues

### Issue: "Profile not declared" warning

```python
# Solution: Resources automatically declare profiles when validated
# This is just a warning, not an error
validator = FHIRValidator(profile=ProfileType.ABDM)
is_valid = validator.validate_resource(patient)  # Still valid
```

### Issue: Missing ABHA ID warning with ABDM profile

```python
# Solution: Add ABHA ID to patient data
patient_data = {
    "patientId": "patient-123",
    "abhaId": "12-3456-7890-1234",  # Add this
    "name": "Patient Name",
    # ...
}
```

### Issue: Missing confidence score with VaidyaLink profile

```python
# Solution: Add confidence and extraction date
medication_data = {
    "medicationName": "Drug Name",
    "confidence": 0.92,  # Add this
    "extractionDate": "2024-01-15",  # Add this
    # ...
}
```

## Support

For questions or issues:

1. Check the [full documentation](./PROFILE_VALIDATION.md)
2. Review test examples in `src/__tests__/test_validator.py`
3. See Lambda integration in `src/index.py`
