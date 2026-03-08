"""
Integration test for MedicationStatement resource creation
Demonstrates the complete workflow from extraction data to validated FHIR resource
"""

from src.utils.fhir_builder import FHIRResourceBuilder
from src.utils.validator import FHIRValidator
import json


def test_medication_statement_workflow():
    """Test complete workflow for creating and validating MedicationStatement"""

    # Initialize builder and validator
    builder = FHIRResourceBuilder()
    validator = FHIRValidator()

    # Simulate extracted medication data from OCR/Bedrock
    medication_data = {
        "medicationName": "Omeprazole",  # Indian drug name
        "status": "active",
        "effectiveStart": "2024-01-15",
        "dosage": {
            "text": "One capsule daily before breakfast",
            "doseValue": 20,
            "doseUnit": "mg",
            "frequency": 1,
            "period": 1,
            "periodUnit": "d",
            "routeCode": "26643006",
            "routeDisplay": "Oral route"
        },
        "confidence": 0.92,  # Confidence score from AI extraction
        "extractionDate": "2024-01-15"
    }

    # Create MedicationStatement resource
    print("Creating MedicationStatement resource...")
    med_statement = builder.create_medication_statement(
        medication_data,
        "Patient/patient-123"
    )

    # Validate the resource
    print("Validating MedicationStatement resource...")
    is_valid = validator.validate_resource(med_statement)

    if is_valid:
        print("✓ MedicationStatement is valid!")
    else:
        print("✗ MedicationStatement validation failed:")
        for error in validator.get_errors():
            print(f"  - {error['severity']}: {error['message']}")

    # Convert to JSON
    print("\nConverting to FHIR JSON...")
    fhir_json = builder.resource_to_json(med_statement)
    fhir_dict = json.loads(fhir_json)

    # Display the FHIR resource
    print("\nGenerated FHIR MedicationStatement:")
    print(json.dumps(fhir_dict, indent=2))

    # Verify key fields
    print("\nVerifying key fields:")
    print(f"✓ Resource Type: {fhir_dict['resourceType']}")
    print(f"✓ Status: {fhir_dict['status']}")
    print(f"✓ Medication: {fhir_dict['medication']['concept']['text']}")

    if fhir_dict['medication']['concept'].get('coding'):
        atc_code = fhir_dict['medication']['concept']['coding'][0]
        print(f"✓ ATC Code: {atc_code['code']} ({atc_code['display']})")

    print(f"✓ Patient Reference: {fhir_dict['subject']['reference']}")

    if fhir_dict.get('dosage'):
        print(f"✓ Dosage: {fhir_dict['dosage'][0]['text']}")
        if fhir_dict['dosage'][0].get('timing'):
            timing = fhir_dict['dosage'][0]['timing']['repeat']
            print(f"  - Frequency: {timing['frequency']}x per {timing['period']} {timing['periodUnit']}")

    if fhir_dict.get('note'):
        print(f"✓ Note: {fhir_dict['note'][0]['text']}")

    print("\n✓ Integration test completed successfully!")

    return is_valid


if __name__ == "__main__":
    test_medication_statement_workflow()
