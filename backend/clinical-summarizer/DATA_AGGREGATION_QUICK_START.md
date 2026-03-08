# Data Aggregation Pipeline - Quick Start Guide

## Overview

The Data Aggregation Pipeline transforms FHIR resources into structured clinical data for AI summarization. This guide will get you started in 5 minutes.

## Quick Example

```python
from utils.data_aggregator import aggregate_clinical_data

# Your FHIR resources from HealthLake
fhir_resources = [
    {
        'resourceType': 'Patient',
        'id': 'patient-123',
        'name': [{'text': 'John Doe'}],
        'gender': 'male',
        'birthDate': '1985-06-15'
    },
    {
        'resourceType': 'Condition',
        'id': 'condition-1',
        'code': {
            'coding': [{'code': 'E11', 'display': 'Type 2 Diabetes Mellitus'}]
        },
        'clinicalStatus': {'coding': [{'display': 'active'}]},
        'onsetDateTime': '2020-01-15'
    },
    {
        'resourceType': 'MedicationStatement',
        'id': 'med-1',
        'medicationCodeableConcept': {
            'coding': [{'code': 'A10BA02', 'display': 'Metformin 500mg'}]
        },
        'status': 'active',
        'effectiveDateTime': '2020-01-20'
    }
]

# Aggregate the data
options = {'includeLabResults': True, 'includeVitalSigns': True}
result = aggregate_clinical_data(fhir_resources, options)

# Access the structured data
print(f"Patient: {result['patient']['name']}")
print(f"Conditions: {len(result['conditions'])}")
print(f"Medications: {len(result['medications'])}")
print(f"Chronic Conditions: {len(result['criticalInformation']['chronicConditions'])}")
```

## What You Get

The aggregation pipeline returns a structured dictionary with:

### 1. Patient Demographics

```python
result['patient']
# {
#     'id': 'patient-123',
#     'name': 'John Doe',
#     'gender': 'male',
#     'age': 39,
#     'phone': '+91-9876543210',
#     'identifiers': {'abhaId': '12-3456-7890-1234'}
# }
```

### 2. Clinical Data Categories

```python
result['conditions']      # All diagnoses and conditions
result['medications']     # Current and past medications
result['encounters']      # Clinical visits
result['observations']    # Lab results and vital signs
result['allergies']       # Allergies and intolerances
result['procedures']      # Surgeries and procedures
result['diagnosticReports']  # Imaging and pathology reports
```

### 3. Critical Information

```python
result['criticalInformation']
# {
#     'chronicConditions': [...],    # Chronic conditions requiring management
#     'currentMedications': [...],   # Active medications
#     'criticalAllergies': [...],    # High-criticality allergies
#     'abnormalLabResults': [...],   # Abnormal lab values
#     'recentDiagnoses': [...]       # Diagnoses within last 30 days
# }
```

### 4. Chronological Timeline

```python
result['timeline']
# [
#     {'date': '2024-01-15', 'type': 'observation', 'display': 'Glucose', 'value': '120 mg/dL'},
#     {'date': '2020-01-20', 'type': 'medication', 'display': 'Metformin 500mg'},
#     {'date': '2020-01-15', 'type': 'condition', 'display': 'Type 2 Diabetes'}
# ]
```

## Common Use Cases

### Use Case 1: Get Chronic Conditions

```python
aggregated = aggregate_clinical_data(fhir_resources, options)

chronic_conditions = aggregated['criticalInformation']['chronicConditions']
for condition in chronic_conditions:
    print(f"- {condition['display']} (since {condition['onsetDate']})")
```

### Use Case 2: Get Current Medications

```python
aggregated = aggregate_clinical_data(fhir_resources, options)

current_meds = aggregated['criticalInformation']['currentMedications']
for med in current_meds:
    print(f"- {med['display']}: {med['dosage']}")
```

### Use Case 3: Get Recent Clinical Events

```python
aggregated = aggregate_clinical_data(fhir_resources, options)

# Get last 5 events
recent_events = aggregated['timeline'][:5]
for event in recent_events:
    print(f"{event['date']}: {event['type']} - {event['display']}")
```

### Use Case 4: Check for Critical Allergies

```python
aggregated = aggregate_clinical_data(fhir_resources, options)

critical_allergies = aggregated['criticalInformation']['criticalAllergies']
if critical_allergies:
    print("⚠️ CRITICAL ALLERGIES:")
    for allergy in critical_allergies:
        print(f"- {allergy['display']} ({allergy['type']})")
```

### Use Case 5: Get Abnormal Lab Results

```python
aggregated = aggregate_clinical_data(fhir_resources, options)

abnormal_labs = aggregated['criticalInformation']['abnormalLabResults']
for lab in abnormal_labs:
    print(f"- {lab['display']}: {lab['value']} {lab['unit']} ({lab['interpretation'][0]['display']})")
```

## Configuration Options

### Include/Exclude Data Types

```python
options = {
    'includeLabResults': True,          # Include laboratory results
    'includeVitalSigns': True,          # Include vital signs
    'includeDiagnosticReports': True    # Include diagnostic reports
}

# Example: Only include vital signs, exclude lab results
options = {
    'includeLabResults': False,
    'includeVitalSigns': True,
    'includeDiagnosticReports': False
}
```

## Individual Extraction Functions

You can also use individual extraction functions for specific resource types:

### Extract Patient Demographics

```python
from utils.data_aggregator import extract_patient_demographics

patient_resources = [...]  # List of Patient FHIR resources
patient_data = extract_patient_demographics(patient_resources)
```

### Extract Conditions

```python
from utils.data_aggregator import extract_conditions

condition_resources = [...]  # List of Condition FHIR resources
conditions = extract_conditions(condition_resources)

# Check for chronic conditions
chronic = [c for c in conditions if c['isChronic']]
```

### Extract Medications

```python
from utils.data_aggregator import extract_medications

medication_resources = [...]  # List of MedicationStatement FHIR resources
medications = extract_medications(medication_resources)

# Get active medications
active_meds = [m for m in medications if m['isActive']]
```

### Extract Observations

```python
from utils.data_aggregator import extract_observations

observation_resources = [...]  # List of Observation FHIR resources
observations = extract_observations(
    observation_resources,
    include_lab_results=True,
    include_vital_signs=True
)

# Separate lab results and vital signs
lab_results = [o for o in observations if o['isLabResult']]
vital_signs = [o for o in observations if o['isVitalSign']]
```

### Identify Critical Information

```python
from utils.data_aggregator import identify_critical_information

critical_info = identify_critical_information(
    conditions=conditions,
    medications=medications,
    allergies=allergies,
    observations=observations
)

print(f"Chronic conditions: {len(critical_info['chronicConditions'])}")
print(f"Current medications: {len(critical_info['currentMedications'])}")
print(f"Critical allergies: {len(critical_info['criticalAllergies'])}")
```

### Create Timeline

```python
from utils.data_aggregator import create_chronological_timeline

timeline = create_chronological_timeline(
    conditions=conditions,
    medications=medications,
    encounters=encounters,
    observations=observations,
    procedures=procedures,
    diagnostic_reports=diagnostic_reports
)

# Timeline is sorted by date (most recent first)
for event in timeline[:10]:  # Last 10 events
    print(f"{event['date']}: {event['type']} - {event['display']}")
```

## Error Handling

```python
from utils.data_aggregator import aggregate_clinical_data, DataAggregationError

try:
    aggregated = aggregate_clinical_data(fhir_resources, options)
except DataAggregationError as e:
    print(f"Aggregation failed: {str(e)}")
    # Handle error appropriately
```

## Integration with Lambda Handler

The aggregation pipeline is automatically used in the Lambda handler:

```python
# In your Lambda function
def lambda_handler(event, context):
    patient_id = event['patientId']
    options = event.get('options', {})

    # Query HealthLake (implemented in Task 11.2)
    fhir_resources = query_patient_resources(patient_id, options)

    # Aggregate data (Task 11.3 - this pipeline)
    aggregated_data = aggregate_clinical_data(fhir_resources, options)

    # Generate summary with Bedrock (Task 11.4)
    summary = generate_summary_with_bedrock(patient_id, aggregated_data, options)

    return {
        'statusCode': 200,
        'body': json.dumps({'summary': summary})
    }
```

## Testing

Run the comprehensive test suite:

```bash
# Run all aggregation tests
pytest src/__tests__/test_data_aggregator.py -v

# Run specific test class
pytest src/__tests__/test_data_aggregator.py::TestExtractConditions -v

# Run with coverage
pytest src/__tests__/test_data_aggregator.py --cov=src/utils/data_aggregator
```

## Performance Tips

1. **Filter Early**: Use options to exclude unnecessary data types
2. **Limit Resources**: Use MAX_RECENT_ENCOUNTERS and MAX_MEDICATIONS environment variables
3. **Batch Processing**: Process multiple patients in parallel if needed

## Common Patterns

### Pattern 1: Summary for Doctor

```python
# Get key information for doctor's review
aggregated = aggregate_clinical_data(fhir_resources, options)

summary = {
    'patient': aggregated['patient']['name'],
    'age': aggregated['patient']['age'],
    'chronic_conditions': [c['display'] for c in aggregated['criticalInformation']['chronicConditions']],
    'current_medications': [m['display'] for m in aggregated['criticalInformation']['currentMedications']],
    'critical_allergies': [a['display'] for a in aggregated['criticalInformation']['criticalAllergies']],
    'recent_visits': len([e for e in aggregated['encounters'] if e['startDate'] > '2024-01-01'])
}
```

### Pattern 2: Medication Reconciliation

```python
# Get all medications for reconciliation
aggregated = aggregate_clinical_data(fhir_resources, options)

active_meds = [m for m in aggregated['medications'] if m['isActive']]
stopped_meds = [m for m in aggregated['medications'] if not m['isActive']]

print(f"Active: {len(active_meds)}, Stopped: {len(stopped_meds)}")
```

### Pattern 3: Allergy Check

```python
# Check for specific allergen
aggregated = aggregate_clinical_data(fhir_resources, options)

def has_allergy(allergen_name):
    for allergy in aggregated['allergies']:
        if allergen_name.lower() in allergy['display'].lower():
            return True, allergy
    return False, None

has_penicillin_allergy, allergy_details = has_allergy('penicillin')
if has_penicillin_allergy:
    print(f"⚠️ Patient allergic to {allergy_details['display']}")
```

## Next Steps

1. **Read Full Documentation**: [DATA_AGGREGATION.md](./DATA_AGGREGATION.md)
2. **Explore Examples**: Check the test files for more usage examples
3. **Integrate with Bedrock**: Use aggregated data for AI summarization (Task 11.4)
4. **Customize**: Extend extraction functions for your specific needs

## Troubleshooting

### Issue: Empty Results

**Problem**: `aggregate_clinical_data` returns empty lists

**Solution**: Check that FHIR resources have the correct `resourceType` field

```python
# Verify resource types
for resource in fhir_resources:
    print(resource.get('resourceType'))
```

### Issue: Missing Patient Data

**Problem**: `result['patient']` is empty

**Solution**: Ensure at least one Patient resource is included

```python
# Check for Patient resource
has_patient = any(r.get('resourceType') == 'Patient' for r in fhir_resources)
print(f"Has patient resource: {has_patient}")
```

### Issue: Chronic Conditions Not Detected

**Problem**: Known chronic conditions not flagged as chronic

**Solution**: The detection uses keyword matching. Verify the condition display name contains chronic keywords (diabetes, hypertension, etc.)

```python
# Check condition display names
for condition in result['conditions']:
    print(f"{condition['display']} - Chronic: {condition['isChronic']}")
```

## Support

For questions or issues:

- Review the [full documentation](./DATA_AGGREGATION.md)
- Check the [test files](./src/__tests__/test_data_aggregator.py) for examples
- Refer to the [FHIR R4 specification](https://hl7.org/fhir/R4/)

## Related Documentation

- [Clinical Summarizer README](./README.md)
- [HealthLake Quick Start](../../infrastructure/docs/HEALTHLAKE_QUICK_START.md)
- [FHIR Transformer](../fhir-transformer/README.md)
