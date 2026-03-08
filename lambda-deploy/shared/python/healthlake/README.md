# AWS HealthLake Client Helper

Simplified interface for interacting with AWS HealthLake FHIR datastores in Python Lambda functions.

## Installation

This module is part of the VaidyaLink shared utilities. No separate installation required.

## Environment Variables

```bash
HEALTHLAKE_DATASTORE_ID=your-datastore-id
HEALTHLAKE_DATASTORE_ENDPOINT=https://healthlake.us-east-1.amazonaws.com/datastore/your-datastore-id
AWS_REGION=us-east-1
```

## Usage

### Basic Operations

```python
from healthlake import HealthLakeClient

# Initialize client (uses environment variables)
healthlake = HealthLakeClient()

# Or provide configuration explicitly
healthlake = HealthLakeClient(
    datastore_id='your-datastore-id',
    datastore_endpoint='https://healthlake.us-east-1.amazonaws.com/datastore/your-datastore-id',
    region='us-east-1'
)
```

### Create a FHIR Resource

```python
patient = healthlake.create_resource('Patient', {
    'name': [{
        'use': 'official',
        'family': 'Kumar',
        'given': ['Rajesh']
    }],
    'gender': 'male',
    'birthDate': '1985-06-15'
})

print(f"Created patient: {patient['id']}")
```

### Read a FHIR Resource

```python
patient = healthlake.read_resource('Patient', 'patient-123')
print(f"Patient name: {patient['name'][0]['text']}")
```

### Update a FHIR Resource

```python
patient['telecom'] = [{
    'system': 'phone',
    'value': '+91-9876543210'
}]

updated_patient = healthlake.update_resource('Patient', 'patient-123', patient)
```

### Delete a FHIR Resource

```python
healthlake.delete_resource('Patient', 'patient-123')
```

### Search for Resources

```python
# Search for patients by name
patients = healthlake.search_resources('Patient', {
    'name': 'Kumar',
    'gender': 'male'
})

# Search for observations for a specific patient
observations = healthlake.search_resources('Observation', {
    'patient': 'patient-123',
    'category': 'vital-signs'
})
```

### Get All Patient Resources

```python
# Fetch all clinical resources for a patient
patient_data = healthlake.get_patient_resources('patient-123')

print(f"Observations: {len(patient_data['Observation'])}")
print(f"Conditions: {len(patient_data['Condition'])}")
print(f"Medications: {len(patient_data['MedicationStatement'])}")
```

### Create FHIR Bundle

```python
resources = [
    {
        'resourceType': 'Patient',
        'id': 'patient-123',
        'name': [{'family': 'Kumar', 'given': ['Rajesh']}]
    },
    {
        'resourceType': 'Observation',
        'status': 'final',
        'code': {'text': 'Blood Pressure'},
        'subject': {'reference': 'Patient/patient-123'}
    }
]

bundle = healthlake.create_bundle(resources, bundle_type='transaction')
print(f"Bundle entries: {len(bundle['entry'])}")
```

## Lambda Function Example

```python
import json
from healthlake import HealthLakeClient

def lambda_handler(event, context):
    healthlake = HealthLakeClient()

    try:
        # Extract patient data from event
        patient_data = json.loads(event['body'])

        # Create patient in HealthLake
        patient = healthlake.create_resource('Patient', patient_data)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Patient created successfully',
                'patientId': patient['id']
            })
        }
    except Exception as error:
        print(f"Error: {error}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(error)
            })
        }
```

## Error Handling

All methods raise exceptions with descriptive messages:

```python
try:
    patient = healthlake.read_resource('Patient', 'invalid-id')
except Exception as error:
    print(f"Failed to read patient: {error}")
    # Error: Failed to read Patient/invalid-id: ResourceNotFoundException
```

## FHIR Resource Types Supported

- Patient
- Observation
- Condition
- MedicationStatement
- Procedure
- DiagnosticReport
- Encounter
- AllergyIntolerance
- And all other FHIR R4 resources

## IAM Permissions Required

The Lambda execution role needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "healthlake:CreateResource",
        "healthlake:ReadResource",
        "healthlake:UpdateResource",
        "healthlake:DeleteResource",
        "healthlake:SearchWithGet",
        "healthlake:SearchWithPost"
      ],
      "Resource": "arn:aws:healthlake:region:account:datastore/datastore-id"
    }
  ]
}
```

## Related Documentation

- [AWS HealthLake Developer Guide](https://docs.aws.amazon.com/healthlake/)
- [FHIR R4 Specification](https://www.hl7.org/fhir/R4/)
- [VaidyaLink FHIR Transformer Lambda](../../fhir-transformer/)
