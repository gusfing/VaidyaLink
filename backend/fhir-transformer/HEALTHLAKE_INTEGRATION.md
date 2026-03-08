# HealthLake Integration Guide

## Overview

The FHIR Transformer Lambda integrates with AWS HealthLake to store structured FHIR R4 resources. This integration enables:

- Persistent storage of patient health records
- FHIR-compliant data querying
- Interoperability with other healthcare systems
- Compliance with healthcare data standards

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FHIR Transformer Lambda                   │
│                                                              │
│  ┌────────────────┐    ┌──────────────────┐               │
│  │ FHIR Builder   │───▶│ FHIR Validator   │               │
│  └────────────────┘    └──────────────────┘               │
│           │                      │                          │
│           ▼                      ▼                          │
│  ┌──────────────────────────────────────┐                 │
│  │      HealthLake Store                │                 │
│  │  - Batch operations                  │                 │
│  │  - Retry logic                       │                 │
│  │  - Error handling                    │                 │
│  └──────────────────────────────────────┘                 │
│           │                                                 │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS HealthLake                            │
│                                                              │
│  ┌────────────────┐    ┌──────────────────┐               │
│  │ FHIR Datastore │    │  FHIR Search API │               │
│  │  - Patient     │    │  - Query by ID   │               │
│  │  - Medication  │    │  - Search params │               │
│  │  - Observation │    │  - Bundles       │               │
│  │  - Encounter   │    └──────────────────┘               │
│  │  - Diagnostic  │                                        │
│  └────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. HealthLakeStore Class

Located in `src/utils/healthlake_store.py`, this class provides high-level operations for HealthLake:

```python
from utils.healthlake_store import HealthLakeStore

# Initialize store
store = HealthLakeStore()

# Store single resource
success, resource_id, error = store.store_resource(fhir_resource)

# Store multiple resources
results = store.store_resources_batch(fhir_resources)

# Query patient resources
patient_data = store.get_patient_resources('patient-123')

# Search resources
observations = store.search_resources(
    'Observation',
    {'patient': 'patient-123', 'code': '8867-4'}
)
```

### 2. HealthLakeClient (Shared Library)

Located in `backend/shared/python/healthlake/healthlake_client.py`, this provides low-level AWS HealthLake API access:

```python
from healthlake.healthlake_client import HealthLakeClient

client = HealthLakeClient(
    datastore_id='your-datastore-id',
    datastore_endpoint='https://healthlake.region.amazonaws.com'
)

# Create resource
resource = client.create_resource('Patient', patient_data)

# Read resource
patient = client.read_resource('Patient', 'patient-123')

# Update resource
updated = client.update_resource('Patient', 'patient-123', updated_data)

# Delete resource
client.delete_resource('Patient', 'patient-123')

# Search resources
results = client.search_resources('Observation', {'patient': 'patient-123'})
```

## Configuration

### Environment Variables

```bash
# Required
HEALTHLAKE_DATASTORE_ID=your-datastore-id
HEALTHLAKE_ENDPOINT=https://healthlake.ap-south-1.amazonaws.com
AWS_REGION=ap-south-1

# Optional
ENABLE_BATCH_OPERATIONS=true
MAX_BATCH_SIZE=100
```

### IAM Permissions

The Lambda execution role requires these permissions:

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
      "Resource": "arn:aws:healthlake:region:account-id:datastore/fhir/datastore-id"
    }
  ]
}
```

## Usage Examples

### Example 1: Transform and Store Patient Data

```python
from index import lambda_handler

event = {
    'operation': 'transform',
    'patientId': 'patient-123',
    'jobId': 'job-456',
    'data': {
        'patientData': {
            'patientId': 'patient-123',
            'name': 'Rajesh Kumar',
            'gender': 'male',
            'birthDate': '1985-06-15',
            'phone': '+91-9876543210',
            'abhaId': '12-3456-7890-1234'
        },
        'medications': [
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
                'confidence': 0.95
            }
        ],
        'observations': [
            {
                'observationName': 'Blood Pressure',
                'category': 'vital-signs',
                'valueQuantity': {
                    'value': 120,
                    'unit': 'mmHg'
                },
                'effectiveDateTime': '2024-01-15T10:30:00Z'
            }
        ]
    }
}

response = lambda_handler(event, {})
print(response)
# {
#     'statusCode': 200,
#     'body': {
#         'message': 'FHIR transformation completed',
#         'patientId': 'patient-123',
#         'jobId': 'job-456',
#         'resourceIds': [
#             'Patient/abc-123',
#             'MedicationStatement/def-456',
#             'Observation/ghi-789'
#         ],
#         'resourceCount': 3
#     }
# }
```

### Example 2: Query Patient Resources

```python
from utils.healthlake_store import HealthLakeStore

store = HealthLakeStore()

# Get all resources for a patient
patient_resources = store.get_patient_resources('patient-123')

print(f"Observations: {len(patient_resources['Observation'])}")
print(f"Medications: {len(patient_resources['MedicationStatement'])}")
print(f"Encounters: {len(patient_resources['Encounter'])}")
```

### Example 3: Search for Specific Observations

```python
from utils.healthlake_store import HealthLakeStore

store = HealthLakeStore()

# Search for blood pressure observations
bp_observations = store.search_resources(
    'Observation',
    {
        'patient': 'patient-123',
        'code': '85354-9',  # LOINC code for blood pressure
        'date': 'ge2024-01-01'  # Greater than or equal to 2024-01-01
    }
)

for obs in bp_observations:
    print(f"Date: {obs['effectiveDateTime']}")
    print(f"Value: {obs['valueQuantity']['value']} {obs['valueQuantity']['unit']}")
```

## Error Handling

### Retry Logic

The HealthLakeStore implements automatic retry with exponential backoff:

```python
# Default: 3 retries
success, resource_id, error = store.store_resource(resource, retry_count=3)

if not success:
    logger.error(f"Failed to store resource after retries: {error}")
```

### Partial Failure Handling

When storing multiple resources, the system continues even if some fail:

```python
results = store.store_resources_batch(resources)

if results['failed'] > 0:
    logger.warning(f"{results['failed']} resources failed to store")
    for error in results['errors']:
        logger.error(f"Failed {error['resourceType']}: {error['error']}")

# Process successful resources
for resource_id in results['resource_ids']:
    logger.info(f"Successfully stored: {resource_id}")
```

### Common Errors

| Error                                              | Cause                        | Solution                            |
| -------------------------------------------------- | ---------------------------- | ----------------------------------- |
| `HEALTHLAKE_DATASTORE_ID must be provided`         | Missing environment variable | Set `HEALTHLAKE_DATASTORE_ID`       |
| `Failed to create resource: ValidationException`   | Invalid FHIR resource        | Check resource against FHIR R4 spec |
| `Failed to create resource: AccessDeniedException` | Insufficient IAM permissions | Add required HealthLake permissions |
| `Failed to create resource: ThrottlingException`   | Rate limit exceeded          | Implement exponential backoff       |

## Performance Considerations

### Batch Operations

For optimal performance when storing multiple resources:

```python
# Good: Batch operation
results = store.store_resources_batch(resources)

# Avoid: Sequential individual stores
for resource in resources:
    store.store_resource(resource)  # Slower
```

### Resource Caching

Enable caching for frequently accessed resources:

```bash
ENABLE_RESOURCE_CACHE=true
CACHE_TTL_SECONDS=300
```

### Concurrent Operations

Configure parallel processing:

```bash
ENABLE_PARALLEL_CREATION=true
MAX_CONCURRENT_OPERATIONS=10
```

## Monitoring

### CloudWatch Metrics

The integration emits custom metrics:

- `HealthLakeStorageSuccess`: Number of successful resource stores
- `HealthLakeStorageFailure`: Number of failed resource stores
- `HealthLakeStorageLatency`: Time taken to store resources
- `HealthLakeBatchSize`: Number of resources in batch operations

### CloudWatch Logs

Log entries include:

```
[INFO] Initialized HealthLake store for datastore: abc-123
[INFO] Storing Patient resource (attempt 1/3)
[INFO] Successfully stored Patient/patient-456
[INFO] HealthLake storage complete: 3 successful, 0 failed out of 3 total
```

### X-Ray Tracing

Enable X-Ray for distributed tracing:

```bash
ENABLE_XRAY_TRACING=true
```

## Testing

### Unit Tests

Run unit tests:

```bash
cd backend/fhir-transformer
pytest src/__tests__/test_healthlake_integration.py -v
```

### Integration Tests

Test against LocalStack:

```bash
# Start LocalStack with HealthLake
docker-compose up -d

# Run integration tests
pytest src/__tests__/test_healthlake_integration.py --integration
```

### Manual Testing

Test with sample data:

```bash
# Invoke Lambda locally
aws lambda invoke \
  --function-name vaidyalink-fhir-transformer-dev \
  --payload file://test-event.json \
  response.json

# Check response
cat response.json
```

## Troubleshooting

### Issue: Resources not appearing in HealthLake

**Symptoms**: Lambda succeeds but resources not queryable

**Solutions**:

1. Check datastore ID is correct
2. Verify IAM permissions
3. Check resource validation passed
4. Wait for indexing (can take 1-2 minutes)

### Issue: Validation errors

**Symptoms**: `ValidationException` when storing resources

**Solutions**:

1. Enable strict validation: `FHIR_VALIDATION_MODE=strict`
2. Check resource against FHIR R4 spec
3. Review validation errors in logs
4. Use FHIR validator before storage

### Issue: Slow performance

**Symptoms**: High latency for resource storage

**Solutions**:

1. Enable batch operations
2. Increase concurrent operations
3. Use resource caching
4. Check network connectivity to HealthLake

## Best Practices

1. **Always validate resources** before storing in HealthLake
2. **Use batch operations** for multiple resources
3. **Implement retry logic** for transient failures
4. **Monitor CloudWatch metrics** for performance issues
5. **Enable X-Ray tracing** for debugging
6. **Use appropriate FHIR profiles** (ABDM, US Core, etc.)
7. **Handle partial failures** gracefully
8. **Log resource IDs** for tracking and debugging

## Related Documentation

- [AWS HealthLake Documentation](https://docs.aws.amazon.com/healthlake/)
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [FHIR Builder Guide](./FHIR_PARSER_INTEGRATION.md)
- [FHIR Validation Guide](./PROFILE_VALIDATION.md)
- [HealthLake Quick Start](../../infrastructure/docs/HEALTHLAKE_QUICK_START.md)
