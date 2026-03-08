# AWS HealthLake Quick Start Guide

This guide helps you get started with the AWS HealthLake FHIR data store for VaidyaLink.

## Overview

AWS HealthLake is a HIPAA-eligible service that stores, transforms, and analyzes health data in FHIR format. VaidyaLink uses HealthLake to:

- Store structured FHIR R4 resources (Patient, Observation, MedicationStatement, etc.)
- Enable queryable access to patient health records
- Support FHIR bundle exports for medical tourism
- Maintain HIPAA compliance with encryption at rest and in transit

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Lambda Functions                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    FHIR      │  │   Clinical   │  │     ABDM     │      │
│  │ Transformer  │  │  Summarizer  │  │  Connector   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              AWS HealthLake FHIR R4 Datastore                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • Customer-Managed KMS Encryption                   │  │
│  │  • CloudWatch Logging                                │  │
│  │  • IAM Role-Based Access Control                     │  │
│  │  • FHIR R4 Compliant                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Deployment

### Prerequisites

- AWS CDK installed and configured
- AWS account with HealthLake service enabled
- KMS encryption key created (handled by SecurityConstruct)

### Deploy HealthLake Infrastructure

```bash
# Navigate to infrastructure directory
cd infrastructure

# Deploy the stack
npm run deploy -- --all

# Or deploy specific environment
npm run deploy -- --context environment=dev
```

### Verify Deployment

```bash
# Get datastore ID from CloudFormation outputs
aws cloudformation describe-stacks \
  --stack-name VaidyaLinkStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`HealthLakeDatastoreId`].OutputValue' \
  --output text

# Check datastore status
aws healthlake describe-fhir-datastore \
  --datastore-id <datastore-id> \
  --region us-east-1
```

## Configuration

### Environment Variables

Set these environment variables in your Lambda functions:

```bash
HEALTHLAKE_DATASTORE_ID=<your-datastore-id>
HEALTHLAKE_DATASTORE_ENDPOINT=<your-datastore-endpoint>
AWS_REGION=us-east-1
```

These are automatically set by the CDK construct when deploying Lambda functions.

### IAM Permissions

Lambda functions need the HealthLake access role created by the construct:

```typescript
import { HealthLakeConstruct } from '../lib/constructs/healthlake';

const healthlake = new HealthLakeConstruct(this, 'HealthLake', {
  environment: 'dev',
  encryptionKey: security.encryptionKey,
});

// Use the Lambda access role for your functions
const myLambda = new lambda.Function(this, 'MyFunction', {
  // ... other props
  role: healthlake.lambdaAccessRole,
});
```

## Usage Examples

### Python Lambda Function

```python
from healthlake import HealthLakeClient

def lambda_handler(event, context):
    # Initialize client (uses environment variables)
    healthlake = HealthLakeClient()

    # Create a patient resource
    patient = healthlake.create_resource('Patient', {
        'name': [{
            'use': 'official',
            'family': 'Kumar',
            'given': ['Rajesh']
        }],
        'gender': 'male',
        'birthDate': '1985-06-15',
        'identifier': [{
            'system': 'https://abdm.gov.in/abha',
            'value': '12-3456-7890-1234'
        }]
    })

    return {
        'statusCode': 200,
        'body': json.dumps({
            'patientId': patient['id']
        })
    }
```

### Node.js Lambda Function

```javascript
const { HealthLakeClient } = require('../shared/nodejs/healthlake');

exports.handler = async (event) => {
  // Initialize client (uses environment variables)
  const healthlake = new HealthLakeClient();

  // Search for patient observations
  const observations = await healthlake.searchResources('Observation', {
    patient: 'patient-123',
    category: 'vital-signs',
    date: 'ge2024-01-01',
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      count: observations.length,
      observations: observations,
    }),
  };
};
```

## Common Operations

### Create FHIR Resources

```python
# Create Patient
patient = healthlake.create_resource('Patient', patient_data)

# Create Observation
observation = healthlake.create_resource('Observation', {
    'resourceType': 'Observation',
    'status': 'final',
    'code': {
        'coding': [{
            'system': 'http://loinc.org',
            'code': '85354-9',
            'display': 'Blood pressure'
        }]
    },
    'subject': {'reference': f"Patient/{patient['id']}"},
    'valueQuantity': {
        'value': 120,
        'unit': 'mmHg',
        'system': 'http://unitsofmeasure.org',
        'code': 'mm[Hg]'
    }
})
```

### Search Resources

```python
# Search by patient
observations = healthlake.search_resources('Observation', {
    'patient': 'patient-123'
})

# Search with multiple parameters
medications = healthlake.search_resources('MedicationStatement', {
    'patient': 'patient-123',
    'status': 'active',
    'effective': 'ge2024-01-01'
})
```

### Get All Patient Data

```python
# Fetch all clinical resources for a patient
patient_data = healthlake.get_patient_resources('patient-123')

# Access specific resource types
for observation in patient_data['Observation']:
    print(f"Observation: {observation['code']['text']}")

for condition in patient_data['Condition']:
    print(f"Condition: {condition['code']['text']}")
```

### Create FHIR Bundle for Export

```python
# Get all patient resources
patient_data = healthlake.get_patient_resources('patient-123')

# Flatten all resources into a single list
all_resources = []
for resource_type, resources in patient_data.items():
    all_resources.extend(resources)

# Create bundle
bundle = healthlake.create_bundle(all_resources, bundle_type='collection')

# Export as JSON
import json
with open('patient-export.json', 'w') as f:
    json.dump(bundle, f, indent=2)
```

## Monitoring

### CloudWatch Logs

HealthLake operations are logged to CloudWatch:

```bash
# View logs
aws logs tail /aws/healthlake/vaidyalink-dev --follow
```

### CloudWatch Metrics

Monitor HealthLake usage:

- API call count
- Error rates
- Latency metrics

```bash
# Get metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/HealthLake \
  --metric-name APICallCount \
  --dimensions Name=DatastoreId,Value=<datastore-id> \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

## Security

### Encryption

- **At Rest**: Customer-managed KMS key with automatic rotation
- **In Transit**: TLS 1.3 for all API calls

### Access Control

- IAM role-based access with minimum privilege principle
- No public access to datastore
- All operations logged to CloudTrail

### Compliance

- HIPAA-eligible service
- Audit logging enabled
- Data retention policies enforced

## Troubleshooting

### Common Issues

**Issue**: `HEALTHLAKE_DATASTORE_ID not set`

**Solution**: Ensure environment variables are configured in Lambda function:

```typescript
const myLambda = new lambda.Function(this, 'MyFunction', {
  environment: {
    HEALTHLAKE_DATASTORE_ID: healthlake.datastoreId,
    HEALTHLAKE_DATASTORE_ENDPOINT: healthlake.datastoreEndpoint,
  },
});
```

**Issue**: `AccessDeniedException` when calling HealthLake

**Solution**: Verify Lambda execution role has HealthLake permissions:

```bash
# Check role policies
aws iam list-attached-role-policies --role-name vaidyalink-healthlake-lambda-dev
```

**Issue**: `ResourceNotFoundException` for FHIR resource

**Solution**: Verify resource ID and type are correct:

```python
try:
    patient = healthlake.read_resource('Patient', patient_id)
except Exception as e:
    print(f"Resource not found: {e}")
```

## Cost Optimization

### Pricing Model

HealthLake charges for:

- Data storage (per GB per month)
- API requests (per request)
- Data transfer out

### Optimization Tips

1. **Batch Operations**: Use FHIR bundles for multiple resources
2. **Efficient Queries**: Use specific search parameters to reduce result sets
3. **Caching**: Cache frequently accessed resources in DynamoDB
4. **Data Lifecycle**: Archive old records to S3 for long-term storage

## Next Steps

- [FHIR Transformer Lambda Setup](../../backend/fhir-transformer/README.md)
- [Clinical Summarizer Lambda Setup](../../backend/clinical-summarizer/README.md)
- [FHIR R4 Specification](https://www.hl7.org/fhir/R4/)
- [AWS HealthLake Documentation](https://docs.aws.amazon.com/healthlake/)

## Support

For issues or questions:

- Check [AWS HealthLake Troubleshooting](https://docs.aws.amazon.com/healthlake/latest/devguide/troubleshooting.html)
- Review CloudWatch logs for error details
- Contact VaidyaLink development team
