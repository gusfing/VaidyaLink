# AWS HealthLake Client Helper

Simplified interface for interacting with AWS HealthLake FHIR datastores in Node.js Lambda functions.

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

```javascript
const { HealthLakeClient } = require('../shared/nodejs/healthlake');

// Initialize client (uses environment variables)
const healthlake = new HealthLakeClient();

// Or provide configuration explicitly
const healthlake = new HealthLakeClient({
  datastoreId: 'your-datastore-id',
  datastoreEndpoint: 'https://healthlake.us-east-1.amazonaws.com/datastore/your-datastore-id',
  region: 'us-east-1',
});
```

### Create a FHIR Resource

```javascript
const patient = await healthlake.createResource('Patient', {
  name: [
    {
      use: 'official',
      family: 'Kumar',
      given: ['Rajesh'],
    },
  ],
  gender: 'male',
  birthDate: '1985-06-15',
});

console.log('Created patient:', patient.id);
```

### Read a FHIR Resource

```javascript
const patient = await healthlake.readResource('Patient', 'patient-123');
console.log('Patient name:', patient.name[0].text);
```

### Update a FHIR Resource

```javascript
const updatedPatient = await healthlake.updateResource('Patient', 'patient-123', {
  ...patient,
  telecom: [
    {
      system: 'phone',
      value: '+91-9876543210',
    },
  ],
});
```

### Delete a FHIR Resource

```javascript
await healthlake.deleteResource('Patient', 'patient-123');
```

### Search for Resources

```javascript
// Search for patients by name
const patients = await healthlake.searchResources('Patient', {
  name: 'Kumar',
  gender: 'male',
});

// Search for observations for a specific patient
const observations = await healthlake.searchResources('Observation', {
  patient: 'patient-123',
  category: 'vital-signs',
});
```

### Get All Patient Resources

```javascript
// Fetch all clinical resources for a patient
const patientData = await healthlake.getPatientResources('patient-123');

console.log('Observations:', patientData.Observation.length);
console.log('Conditions:', patientData.Condition.length);
console.log('Medications:', patientData.MedicationStatement.length);
```

### Create FHIR Bundle

```javascript
const resources = [
  {
    resourceType: 'Patient',
    id: 'patient-123',
    name: [{ family: 'Kumar', given: ['Rajesh'] }],
  },
  {
    resourceType: 'Observation',
    status: 'final',
    code: { text: 'Blood Pressure' },
    subject: { reference: 'Patient/patient-123' },
  },
];

const bundle = healthlake.createBundle(resources, 'transaction');
console.log('Bundle entries:', bundle.entry.length);
```

## Lambda Function Example

```javascript
const { HealthLakeClient } = require('../shared/nodejs/healthlake');

exports.handler = async (event) => {
  const healthlake = new HealthLakeClient();

  try {
    // Extract patient data from event
    const patientData = JSON.parse(event.body);

    // Create patient in HealthLake
    const patient = await healthlake.createResource('Patient', patientData);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Patient created successfully',
        patientId: patient.id,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
};
```

## Error Handling

All methods throw errors with descriptive messages:

```javascript
try {
  const patient = await healthlake.readResource('Patient', 'invalid-id');
} catch (error) {
  console.error('Failed to read patient:', error.message);
  // Error: Failed to read Patient/invalid-id: ResourceNotFoundException
}
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
