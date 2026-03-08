# Data Aggregation Pipeline

## Overview

The Data Aggregation Pipeline is a critical component of the Clinical Summarizer Lambda that transforms raw FHIR resources into structured, chronologically organized clinical data suitable for AI-powered summarization. It extracts, categorizes, and prioritizes patient information to prepare optimal context for Amazon Bedrock's Claude 3.5 Sonnet model.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Data Aggregation Pipeline                     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. Group Resources by Type                                 │ │
│  │    - Patient, Condition, Medication, Encounter, etc.       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 2. Extract & Structure Data                                │ │
│  │    - Patient Demographics                                  │ │
│  │    - Conditions (Chronic & Acute)                          │ │
│  │    - Medications (Active & Historical)                     │ │
│  │    - Encounters (Visits)                                   │ │
│  │    - Observations (Labs & Vitals)                          │ │
│  │    - Allergies                                             │ │
│  │    - Diagnostic Reports                                    │ │
│  │    - Procedures                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 3. Identify Critical Information                           │ │
│  │    - Chronic conditions                                    │ │
│  │    - Active medications                                    │ │
│  │    - Critical allergies                                    │ │
│  │    - Abnormal lab results                                  │ │
│  │    - Recent diagnoses                                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 4. Create Chronological Timeline                           │ │
│  │    - Sort all events by date                               │ │
│  │    - Most recent first                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 5. Return Aggregated Structure                             │ │
│  │    - Ready for LLM consumption                             │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Comprehensive Data Extraction

The pipeline extracts data from all major FHIR resource types:

- **Patient**: Demographics, contact information, identifiers (ABHA ID)
- **Condition**: Diagnoses, chronic conditions, clinical status
- **MedicationStatement**: Current and past medications, dosages
- **Encounter**: Clinical visits, hospitalizations
- **Observation**: Lab results, vital signs
- **AllergyIntolerance**: Allergies, intolerances, reactions
- **DiagnosticReport**: Imaging, pathology reports
- **Procedure**: Surgeries, interventions

### 2. Intelligent Categorization

- **Chronic Condition Detection**: Automatically identifies chronic conditions (diabetes, hypertension, etc.)
- **Active Medication Detection**: Determines which medications are currently active
- **Lab Result Classification**: Separates lab results from vital signs
- **Criticality Assessment**: Flags high-criticality allergies and abnormal results

### 3. Chronological Organization

All clinical events are sorted chronologically (most recent first) to provide temporal context for summarization.

### 4. Critical Information Highlighting

The pipeline automatically identifies and flags:

- Chronic conditions requiring ongoing management
- Current active medications
- High-criticality allergies
- Abnormal lab results
- Recent diagnoses (within 30 days)

## Data Structure

### Input

```python
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
    # ... more resources
]

options = {
    'includeLabResults': True,
    'includeVitalSigns': True,
    'includeDiagnosticReports': True
}
```

### Output

```python
{
    'patient': {
        'id': 'patient-123',
        'name': 'John Doe',
        'gender': 'male',
        'birthDate': '1985-06-15',
        'age': 39,
        'phone': '+91-9876543210',
        'email': 'john@example.com',
        'identifiers': {'abhaId': '12-3456-7890-1234'}
    },
    'conditions': [
        {
            'id': 'condition-1',
            'code': 'E11',
            'display': 'Type 2 Diabetes Mellitus',
            'system': 'ICD-10',
            'clinicalStatus': 'active',
            'onsetDate': '2020-01-15',
            'isChronic': True,
            'severity': 'moderate'
        }
    ],
    'medications': [
        {
            'id': 'med-1',
            'display': 'Metformin 500mg',
            'status': 'active',
            'isActive': True,
            'startDate': '2020-01-20',
            'dosage': 'One tablet twice daily'
        }
    ],
    'encounters': [...],
    'observations': [...],
    'allergies': [...],
    'procedures': [...],
    'diagnosticReports': [...],
    'criticalInformation': {
        'chronicConditions': [
            {
                'display': 'Type 2 Diabetes Mellitus',
                'onsetDate': '2020-01-15',
                'severity': 'moderate'
            }
        ],
        'currentMedications': [
            {
                'display': 'Metformin 500mg',
                'dosage': 'One tablet twice daily',
                'startDate': '2020-01-20'
            }
        ],
        'criticalAllergies': [],
        'abnormalLabResults': [],
        'recentDiagnoses': []
    },
    'timeline': [
        {
            'date': '2024-01-15',
            'type': 'observation',
            'display': 'Glucose',
            'value': '120 mg/dL',
            'details': {...}
        },
        {
            'date': '2020-01-20',
            'type': 'medication',
            'display': 'Metformin 500mg',
            'status': 'active',
            'details': {...}
        },
        {
            'date': '2020-01-15',
            'type': 'condition',
            'display': 'Type 2 Diabetes Mellitus',
            'status': 'active',
            'details': {...}
        }
    ],
    'metadata': {
        'totalResources': 15,
        'resourceCounts': {
            'Patient': 1,
            'Condition': 3,
            'MedicationStatement': 5,
            'Encounter': 4,
            'Observation': 2
        },
        'aggregatedAt': '2024-01-15T10:30:00Z'
    }
}
```

## Usage

### Basic Usage

```python
from utils.data_aggregator import aggregate_clinical_data

# FHIR resources from HealthLake
fhir_resources = [...]

# Aggregation options
options = {
    'includeLabResults': True,
    'includeVitalSigns': True,
    'includeDiagnosticReports': True
}

# Aggregate data
aggregated_data = aggregate_clinical_data(fhir_resources, options)

# Access structured data
patient_name = aggregated_data['patient']['name']
chronic_conditions = aggregated_data['criticalInformation']['chronicConditions']
timeline = aggregated_data['timeline']
```

### Individual Extraction Functions

You can also use individual extraction functions:

```python
from utils.data_aggregator import (
    extract_patient_demographics,
    extract_conditions,
    extract_medications,
    identify_critical_information
)

# Extract specific data types
patient_data = extract_patient_demographics(patient_resources)
conditions = extract_conditions(condition_resources)
medications = extract_medications(medication_resources)

# Identify critical information
critical_info = identify_critical_information(
    conditions=conditions,
    medications=medications,
    allergies=allergies,
    observations=observations
)
```

## Configuration Options

### Aggregation Options

- `includeLabResults` (bool): Include laboratory results in observations (default: True)
- `includeVitalSigns` (bool): Include vital signs in observations (default: True)
- `includeDiagnosticReports` (bool): Include diagnostic reports (default: True)

### Environment Variables

The aggregation pipeline respects these environment variables from the main Lambda:

- `MAX_RECENT_ENCOUNTERS`: Maximum number of encounters to include (default: 10)
- `MAX_MEDICATIONS`: Maximum number of medications to include (default: 15)

## Data Extraction Details

### Patient Demographics

Extracts:

- Name (official name preferred)
- Gender
- Birth date and calculated age
- Contact information (phone, email)
- Address
- Preferred language
- Identifiers (ABHA ID, etc.)

### Conditions

Extracts:

- Condition code and display name
- Clinical status (active, resolved, etc.)
- Verification status
- Onset date
- Chronic condition flag
- Severity
- Category
- Notes

**Chronic Condition Detection**: Uses keyword matching to identify chronic conditions:

- Diabetes, Hypertension, Asthma, COPD
- Chronic Kidney Disease, Heart Failure
- Cancer, HIV, Epilepsy
- Parkinson's, Alzheimer's

### Medications

Extracts:

- Medication code and display name
- Status (active, stopped, completed)
- Active medication flag
- Start and end dates
- Dosage information
- Reason for medication
- Notes

**Active Medication Detection**: Considers medications active if:

- Status is 'active', 'intended', or 'on-hold'
- End date is in the future or not specified

### Observations

Extracts:

- Observation code and display name
- Category (laboratory, vital-signs)
- Status
- Effective date
- Value and unit
- Interpretation (normal, high, low, critical)
- Reference range
- Notes

**Category Detection**: Identifies lab results and vital signs based on category coding.

### Allergies

Extracts:

- Allergen code and display name
- Clinical status
- Verification status
- Type (allergy, intolerance)
- Categories (food, medication, environment)
- Criticality (low, high, unable-to-assess)
- Onset and recorded dates
- Reaction manifestations and severity
- Notes

**Sorting**: Allergies are sorted by criticality (high first) and recorded date (most recent first).

## Critical Information Identification

### Chronic Conditions

Identifies conditions that are:

- Flagged as chronic
- Have active clinical status

### Current Medications

Identifies medications that are:

- Currently active
- Not stopped or completed

### Critical Allergies

Identifies allergies that are:

- High criticality
- Active clinical status

### Abnormal Lab Results

Identifies observations that are:

- Laboratory results
- Have interpretation of: high, low, critical, or abnormal

### Recent Diagnoses

Identifies conditions that are:

- Recorded within the last 30 days

## Chronological Timeline

The timeline includes all clinical events sorted by date (most recent first):

- **Conditions**: Onset date or recorded date
- **Medications**: Start date
- **Encounters**: Start date
- **Observations**: Effective date
- **Procedures**: Performed date
- **Diagnostic Reports**: Effective date or issued date

Events without dates are excluded from the timeline.

## Error Handling

The pipeline includes comprehensive error handling:

```python
from utils.data_aggregator import DataAggregationError

try:
    aggregated_data = aggregate_clinical_data(fhir_resources, options)
except DataAggregationError as e:
    logger.error(f"Aggregation failed: {str(e)}")
    # Handle error
```

## Performance Considerations

### Efficiency

- **Single Pass**: Each resource is processed once
- **Lazy Evaluation**: Only requested data types are processed
- **Sorting**: Efficient sorting algorithms for chronological ordering

### Scalability

- Handles up to 100 resources per type (configurable via environment variables)
- Memory-efficient processing
- No external API calls during aggregation

## Testing

Comprehensive unit tests cover:

- Empty resource lists
- Single resource type
- Multiple resource types
- Chronic condition detection
- Active medication detection
- Critical information identification
- Chronological sorting
- Edge cases and error conditions

Run tests:

```bash
pytest src/__tests__/test_data_aggregator.py -v
```

## Integration with Clinical Summarizer

The aggregation pipeline is integrated into the main Lambda handler:

```python
# In index.py
from utils.data_aggregator import aggregate_clinical_data

def generate_clinical_summary(patient_id: str, options: Dict[str, Any]):
    # Query HealthLake
    fhir_resources = query_patient_resources(patient_id, options)

    # Aggregate data
    aggregated_data = aggregate_clinical_data(fhir_resources, options)

    # Generate summary with Bedrock
    summary = generate_summary_with_bedrock(patient_id, aggregated_data, options)

    return summary
```

## Future Enhancements

Potential improvements for future iterations:

1. **Advanced Chronic Condition Detection**: Use comprehensive code lists (ICD-10, SNOMED CT)
2. **Drug Interaction Detection**: Flag potential medication interactions
3. **Trend Analysis**: Identify trends in lab results over time
4. **Risk Stratification**: Calculate clinical risk scores
5. **Medication Adherence**: Analyze medication refill patterns
6. **Social Determinants**: Extract social determinants of health
7. **Care Gaps**: Identify missing preventive care

## Related Documentation

- [Clinical Summarizer README](./README.md)
- [HealthLake Integration](../../infrastructure/docs/HEALTHLAKE_QUICK_START.md)
- [FHIR Transformer](../fhir-transformer/README.md)
- [Quick Start Guide](./DATA_AGGREGATION_QUICK_START.md)

## Support

For issues or questions about the data aggregation pipeline:

1. Check the unit tests for usage examples
2. Review the inline code documentation
3. Refer to the FHIR R4 specification for resource structures
4. Contact the VaidyaLink development team
