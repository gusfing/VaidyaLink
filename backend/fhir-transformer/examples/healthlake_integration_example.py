"""
Example: HealthLake Integration with FHIR Transformer

This example demonstrates how to use the FHIR Transformer Lambda
to create and store FHIR resources in AWS HealthLake.
"""

import json
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.utils.healthlake_store import HealthLakeStore
from src.utils.fhir_builder import FHIRResourceBuilder
from src.utils.validator import FHIRValidator, ProfileType


def example_1_store_single_patient():
    """Example 1: Create and store a single patient resource"""
    print("\n=== Example 1: Store Single Patient ===\n")

    # Create patient resource
    builder = FHIRResourceBuilder()
    patient = builder.create_patient({
        'patientId': 'example-patient-001',
        'name': 'Rajesh Kumar',
        'familyName': 'Kumar',
        'givenName': 'Rajesh',
        'gender': 'male',
        'birthDate': '1985-06-15',
        'phone': '+91-9876543210',
        'abhaId': '12-3456-7890-1234',
        'preferredLanguage': 'hi'
    })

    # Validate resource
    validator = FHIRValidator(profile=ProfileType.ABDM)
    if not validator.validate_resource(patient):
        print(f"Validation failed: {validator.get_errors()}")
        return

    print("✓ Patient resource created and validated")

    # Store in HealthLake
    store = HealthLakeStore()
    success, resource_id, error = store.store_resource(patient)

    if success:
        print(f"✓ Patient stored successfully: {resource_id}")
    else:
        print(f"✗ Storage failed: {error}")


def example_2_store_medication_batch():
    """Example 2: Create and store multiple medication resources"""
    print("\n=== Example 2: Store Medication Batch ===\n")

    builder = FHIRResourceBuilder()

    # Create multiple medication statements
    medications_data = [
        {
            'medicationName': 'Paracetamol',
            'status': 'active',
            'dosage': {
                'text': 'One tablet twice daily',
                'doseValue': 500,
                'doseUnit': 'mg',
                'frequency': 2,
                'period': 1,
                'periodUnit': 'd'
            },
            'confidence': 0.95,
            'extractionDate': '2024-01-15'
        },
        {
            'medicationName': 'Metformin',
            'status': 'active',
            'dosage': {
                'text': 'One tablet before breakfast',
                'doseValue': 500,
                'doseUnit': 'mg',
                'frequency': 1,
                'period': 1,
                'periodUnit': 'd'
            },
            'confidence': 0.92
        }
    ]

    medications = []
    for med_data in medications_data:
        med = builder.create_medication_statement(
            med_data,
            'Patient/example-patient-001'
        )
        medications.append(med)

    print(f"✓ Created {len(medications)} medication resources")

    # Store batch in HealthLake
    store = HealthLakeStore()
    results = store.store_resources_batch(medications)

    print(f"\nStorage Results:")
    print(f"  Total: {results['total']}")
    print(f"  Successful: {results['successful']}")
    print(f"  Failed: {results['failed']}")
    print(f"  Resource IDs: {results['resource_ids']}")

    if results['errors']:
        print(f"  Errors: {results['errors']}")


def example_3_store_complete_patient_record():
    """Example 3: Store a complete patient record with multiple resource types"""
    print("\n=== Example 3: Store Complete Patient Record ===\n")

    builder = FHIRResourceBuilder()
    resources = []

    # 1. Patient
    patient = builder.create_patient({
        'patientId': 'example-patient-002',
        'name': 'Priya Sharma',
        'gender': 'female',
        'birthDate': '1992-03-20',
        'phone': '+91-9876543211'
    })
    resources.append(patient)
    print("✓ Created Patient resource")

    # 2. Medication
    medication = builder.create_medication_statement(
        {
            'medicationName': 'Aspirin',
            'dosage': {'text': 'One tablet daily'}
        },
        'Patient/example-patient-002'
    )
    resources.append(medication)
    print("✓ Created MedicationStatement resource")

    # 3. Observation (Blood Pressure)
    observation = builder.create_observation(
        {
            'observationName': 'Blood Pressure',
            'category': 'vital-signs',
            'code': '85354-9',
            'display': 'Blood pressure systolic and diastolic',
            'valueQuantity': {
                'value': 120,
                'unit': 'mmHg'
            },
            'effectiveDateTime': '2024-01-15T10:30:00Z',
            'confidence': 0.98
        },
        'Patient/example-patient-002'
    )
    resources.append(observation)
    print("✓ Created Observation resource")

    # Store all resources
    store = HealthLakeStore()
    results = store.store_resources_batch(resources)

    print(f"\n✓ Stored complete patient record:")
    print(f"  {results['successful']}/{results['total']} resources stored successfully")
    for resource_id in results['resource_ids']:
        print(f"  - {resource_id}")


def example_4_query_patient_resources():
    """Example 4: Query all resources for a patient"""
    print("\n=== Example 4: Query Patient Resources ===\n")

    store = HealthLakeStore()

    # Get all resources for a patient
    patient_id = 'example-patient-001'
    try:
        patient_resources = store.get_patient_resources(patient_id)

        print(f"Resources for patient {patient_id}:")
        for resource_type, resources in patient_resources.items():
            if resources:
                print(f"  {resource_type}: {len(resources)} resources")
                for resource in resources[:3]:  # Show first 3
                    print(f"    - {resource.get('id', 'N/A')}")
    except Exception as e:
        print(f"Query failed: {str(e)}")


def example_5_search_observations():
    """Example 5: Search for specific observations"""
    print("\n=== Example 5: Search Observations ===\n")

    store = HealthLakeStore()

    # Search for blood pressure observations
    try:
        observations = store.search_resources(
            'Observation',
            {
                'patient': 'example-patient-001',
                'code': '85354-9',  # LOINC code for blood pressure
                'date': 'ge2024-01-01'  # Greater than or equal to 2024-01-01
            }
        )

        print(f"Found {len(observations)} blood pressure observations:")
        for obs in observations:
            date = obs.get('effectiveDateTime', 'N/A')
            value = obs.get('valueQuantity', {})
            print(f"  - Date: {date}, Value: {value.get('value')} {value.get('unit')}")
    except Exception as e:
        print(f"Search failed: {str(e)}")


def example_6_lambda_handler_simulation():
    """Example 6: Simulate Lambda handler invocation"""
    print("\n=== Example 6: Lambda Handler Simulation ===\n")

    # Simulate Lambda event
    event = {
        'operation': 'transform',
        'patientId': 'example-patient-003',
        'jobId': 'job-12345',
        'data': {
            'patientData': {
                'patientId': 'example-patient-003',
                'name': 'Amit Patel',
                'gender': 'male',
                'birthDate': '1988-11-10',
                'phone': '+91-9876543212'
            },
            'medications': [
                {
                    'medicationName': 'Ibuprofen',
                    'status': 'active',
                    'dosage': {
                        'text': 'One tablet three times daily',
                        'doseValue': 400,
                        'doseUnit': 'mg',
                        'frequency': 3,
                        'period': 1,
                        'periodUnit': 'd'
                    }
                }
            ],
            'observations': [
                {
                    'observationName': 'Heart Rate',
                    'category': 'vital-signs',
                    'valueQuantity': {
                        'value': 72,
                        'unit': 'beats/minute'
                    },
                    'effectiveDateTime': '2024-01-15T10:30:00Z'
                }
            ]
        }
    }

    print("Event:")
    print(json.dumps(event, indent=2))

    # Import and call handler
    try:
        from src.index import handle_transform

        response = handle_transform(event, {})

        print("\nResponse:")
        print(json.dumps(json.loads(response['body']), indent=2))

        if response['statusCode'] == 200:
            print("\n✓ Lambda handler executed successfully")
        else:
            print(f"\n✗ Lambda handler failed with status {response['statusCode']}")
    except Exception as e:
        print(f"\n✗ Handler execution failed: {str(e)}")


def main():
    """Run all examples"""
    print("=" * 60)
    print("HealthLake Integration Examples")
    print("=" * 60)

    # Note: These examples require valid AWS credentials and HealthLake datastore
    print("\nNote: Set these environment variables before running:")
    print("  - HEALTHLAKE_DATASTORE_ID")
    print("  - HEALTHLAKE_ENDPOINT")
    print("  - AWS_REGION")
    print("  - AWS_ACCOUNT_ID")

    # Check if environment is configured
    if not os.environ.get('HEALTHLAKE_DATASTORE_ID'):
        print("\n⚠ Environment not configured. Set environment variables to run examples.")
        return

    try:
        # Run examples
        example_1_store_single_patient()
        example_2_store_medication_batch()
        example_3_store_complete_patient_record()
        example_4_query_patient_resources()
        example_5_search_observations()
        example_6_lambda_handler_simulation()

        print("\n" + "=" * 60)
        print("All examples completed!")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ Error running examples: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()

