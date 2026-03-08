# HealthLake Integration - Quick Start

## 5-Minute Setup

### Step 1: Set Environment Variables

```bash
export HEALTHLAKE_DATASTORE_ID="your-datastore-id"
export HEALTHLAKE_ENDPOINT="https://healthlake.ap-south-1.amazonaws.com"
export AWS_REGION="ap-south-1"
```

### Step 2: Test the Integration

```python
from utils.healthlake_store import HealthLakeStore
from utils.fhir_builder import FHIRResourceBuilder

# Create a patient resource
builder = FHIRResourceBuilder()
patient = builder.create_patient({
    'patientId': 'test-patient-001',
    'name': 'Test Patient',
    'gender': 'male',
    'birthDate': '1990-01-01'
})

# Store in HealthLake
store = HealthLakeStore()
success, resource_id, error = store.store_resource(patient)

if success:
    print(f"✓ Patient stored successfully: {resource_id}")
else:
    print(f"✗ Storage failed: {error}")
```

### Step 3: Query the Resource

```python
# Retrieve the patient
patient_data = store.client.read_resource('Patient', resource_id)
print(f"Patient name: {patient_data['name'][0]['text']}")
```

## Common Use Cases

### Use Case 1: Store Scan Results

```python
event = {
    'operation': 'transform',
    'patientId': 'patient-123',
    'data': {
        'medications': [{
            'medicationName': 'Paracetamol',
            'dosage': {'text': 'One tablet twice daily'}
        }]
    }
}

from index import lambda_handler
response = lambda_handler(event, {})
```

### Use Case 2: Batch Store Multiple Resources

```python
resources = [patient, medication, observation]
results = store.store_resources_batch(resources)
print(f"Stored {results['successful']}/{results['total']} resources")
```

### Use Case 3: Search Patient Records

```python
# Get all resources for a patient
patient_resources = store.get_patient_resources('patient-123')

# Search specific observations
bp_readings = store.search_resources(
    'Observation',
    {'patient': 'patient-123', 'code': '85354-9'}
)
```

## Verification

### Check Resource in HealthLake

```bash
aws healthlake read-resource \
  --datastore-id $HEALTHLAKE_DATASTORE_ID \
  --resource-type Patient \
  --resource-id patient-123
```

### Run Tests

```bash
pytest src/__tests__/test_healthlake_integration.py -v
```

## Next Steps

- Read the [full integration guide](./HEALTHLAKE_INTEGRATION.md)
- Review [FHIR resource building](./FHIR_PARSER_INTEGRATION.md)
- Check [validation profiles](./PROFILE_VALIDATION.md)

## Troubleshooting

**Problem**: `HEALTHLAKE_DATASTORE_ID must be provided`
**Solution**: Set the environment variable or pass it to HealthLakeStore()

**Problem**: `AccessDeniedException`
**Solution**: Add HealthLake permissions to Lambda execution role

**Problem**: `ValidationException`
**Solution**: Validate FHIR resource before storing (use FHIRValidator)
