# Field-Level Encryption Integration Guide

Complete guide for implementing field-level encryption in VaidyaLink Lambda functions and DynamoDB operations.

## Table of Contents

1. [Overview](#overview)
2. [PHI Fields Reference](#phi-fields-reference)
3. [DynamoDB Integration](#dynamodb-integration)
4. [Lambda Handler Patterns](#lambda-handler-patterns)
5. [Best Practices](#best-practices)
6. [Performance Optimization](#performance-optimization)
7. [Troubleshooting](#troubleshooting)

## Overview

VaidyaLink implements field-level encryption for all Protected Health Information (PHI) data stored in DynamoDB. This ensures HIPAA compliance while maintaining the ability to query and index non-sensitive fields.

### Architecture

```
┌─────────────────┐
│  Lambda Handler │
│                 │
│  1. Receive     │
│  2. Encrypt PHI │──┐
│  3. Store       │  │
└─────────────────┘  │
                     │
                     ▼
              ┌──────────────┐
              │ Field        │
              │ Encryption   │
              │ Service      │
              └──────────────┘
                     │
                     ▼
              ┌──────────────┐
              │  AWS KMS     │
              │  Encryption  │
              └──────────────┘
                     │
                     ▼
              ┌──────────────┐
              │  DynamoDB    │
              │  (Encrypted) │
              └──────────────┘
```

### Key Features

- ✅ Automatic encryption of sensitive fields
- ✅ Selective field decryption for performance
- ✅ Encryption context for audit trails
- ✅ Support for both Python and Node.js
- ✅ Integration with AWS KMS customer-managed keys
- ✅ HIPAA-compliant implementation

## PHI Fields Reference

### Automatically Encrypted Fields

The following fields are automatically encrypted when present in records:

#### Patient Demographics

- `patient_name` / `name` - Patient's full name
- `abha_id` - Ayushman Bharat Health Account ID
- `phone_number` / `phone` - Contact phone number
- `email` - Email address
- `address` - Physical address
- `date_of_birth` / `dateOfBirth` - Date of birth
- `emergency_contact` / `emergencyContact` - Emergency contact information

#### Medical Information

- `medical_history` / `medicalHistory` - Medical history text
- `diagnosis` - Diagnosis information
- `prescription_details` / `prescriptionDetails` - Prescription data
- `lab_results` / `labResults` - Laboratory test results
- `doctor_notes` / `doctorNotes` - Doctor's clinical notes
- `extracted_data` / `extractedData` - OCR extracted medical data
- `transcription` / `transcribed_text` / `transcribedText` - Voice transcriptions
- `clinical_notes` / `clinicalNotes` - Clinical notes
- `treatment_plan` / `treatmentPlan` - Treatment plans
- `medication_list` / `medicationList` - Medication lists

#### Financial Information

- `insurance_details` / `insuranceDetails` - Insurance information

### Non-Encrypted Fields

These fields remain in plaintext for querying and indexing:

- `patient_id` / `patientId` - Patient identifier
- `job_id` / `jobId` - Job identifier
- `status` - Processing status
- `age` - Patient age
- `gender` - Patient gender
- `createdAt` / `updatedAt` - Timestamps
- `imageS3Key` / `audioS3Key` - S3 object keys
- `confidenceScores` - AI confidence scores

## DynamoDB Integration

### Patient Table

#### Store Patient Record

**Python:**

```python
from encryption import FieldEncryption
import boto3

dynamodb = boto3.resource('dynamodb')
field_encryption = FieldEncryption()

def store_patient(patient_data):
    patient_id = patient_data['patientId']

    # Encrypt sensitive fields
    encrypted = field_encryption.encrypt_record(
        patient_data,
        patient_id=patient_id,
        additional_context={'table': 'Patients'}
    )

    # Add DynamoDB keys
    item = {
        'PK': f'PATIENT#{patient_id}',
        'SK': 'PROFILE',
        **encrypted,
        'createdAt': datetime.utcnow().isoformat()
    }

    table = dynamodb.Table('VaidyaLink-Patients')
    table.put_item(Item=item)
```

**Node.js:**

```javascript
const { FieldEncryption } = require('./encryption');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const fieldEncryption = new FieldEncryption();

async function storePatient(patientData) {
  const patientId = patientData.patientId;

  // Encrypt sensitive fields
  const encrypted = await fieldEncryption.encryptRecord(patientData, patientId, {
    table: 'Patients',
  });

  // Add DynamoDB keys
  const item = {
    PK: `PATIENT#${patientId}`,
    SK: 'PROFILE',
    ...encrypted,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: 'VaidyaLink-Patients',
      Item: item,
    })
  );
}
```

#### Retrieve Patient Record

**Python:**

```python
def get_patient(patient_id, fields_to_decrypt=None):
    table = dynamodb.Table('VaidyaLink-Patients')

    response = table.get_item(
        Key={'PK': f'PATIENT#{patient_id}', 'SK': 'PROFILE'}
    )

    if 'Item' not in response:
        return None

    # Decrypt (partial or full)
    decrypted = field_encryption.decrypt_record(
        response['Item'],
        patient_id=patient_id,
        fields_to_decrypt=fields_to_decrypt  # None = decrypt all
    )

    return decrypted
```

**Node.js:**

```javascript
async function getPatient(patientId, fieldsToDecrypt = null) {
  const result = await docClient.send(
    new GetCommand({
      TableName: 'VaidyaLink-Patients',
      Key: { PK: `PATIENT#${patientId}`, SK: 'PROFILE' },
    })
  );

  if (!result.Item) return null;

  // Decrypt (partial or full)
  const decrypted = await fieldEncryption.decryptRecord(
    result.Item,
    patientId,
    null,
    fieldsToDecrypt // null = decrypt all
  );

  return decrypted;
}
```

### ScanJobs Table

#### Store Scan Job with Extracted Data

**Python:**

```python
def store_scan_job(scan_job_data):
    job_id = scan_job_data['jobId']
    patient_id = scan_job_data['patientId']

    # Encrypt extracted medical data
    encrypted = field_encryption.encrypt_record(
        scan_job_data,
        patient_id=patient_id,
        additional_context={
            'table': 'ScanJobs',
            'job_id': job_id
        }
    )

    item = {
        'PK': f'JOB#{job_id}',
        'SK': 'METADATA',
        **encrypted,
        'createdAt': datetime.utcnow().isoformat()
    }

    table = dynamodb.Table('VaidyaLink-ScanJobs')
    table.put_item(Item=item)
```

**Node.js:**

```javascript
async function storeScanJob(scanJobData) {
  const jobId = scanJobData.jobId;
  const patientId = scanJobData.patientId;

  // Encrypt extracted medical data
  const encrypted = await fieldEncryption.encryptRecord(scanJobData, patientId, {
    table: 'ScanJobs',
    job_id: jobId,
  });

  const item = {
    PK: `JOB#${jobId}`,
    SK: 'METADATA',
    ...encrypted,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: 'VaidyaLink-ScanJobs',
      Item: item,
    })
  );
}
```

### VoiceJobs Table

#### Store Voice Job with Transcription

**Python:**

```python
def store_voice_job(voice_job_data):
    job_id = voice_job_data['jobId']
    patient_id = voice_job_data['patientId']

    # Encrypt transcription
    encrypted = field_encryption.encrypt_record(
        voice_job_data,
        patient_id=patient_id,
        additional_context={
            'table': 'VoiceJobs',
            'job_id': job_id
        }
    )

    item = {
        'PK': f'VOICE#{job_id}',
        'SK': 'METADATA',
        **encrypted,
        'createdAt': datetime.utcnow().isoformat()
    }

    table = dynamodb.Table('VaidyaLink-VoiceJobs')
    table.put_item(Item=item)
```

**Node.js:**

```javascript
async function storeVoiceJob(voiceJobData) {
  const jobId = voiceJobData.jobId;
  const patientId = voiceJobData.patientId;

  // Encrypt transcription
  const encrypted = await fieldEncryption.encryptRecord(voiceJobData, patientId, {
    table: 'VoiceJobs',
    job_id: jobId,
  });

  const item = {
    PK: `VOICE#${jobId}`,
    SK: 'METADATA',
    ...encrypted,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: 'VaidyaLink-VoiceJobs',
      Item: item,
    })
  );
}
```

## Lambda Handler Patterns

### Pattern 1: API Gateway Handler with Full Encryption

**Python:**

```python
from encryption import FieldEncryption
import json

field_encryption = FieldEncryption()

def lambda_handler(event, context):
    try:
        # Parse request
        body = json.loads(event['body'])
        patient_id = event['pathParameters']['patientId']

        # Encrypt and store
        encrypted = field_encryption.encrypt_record(
            body,
            patient_id=patient_id
        )

        # Store in DynamoDB
        # ...

        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Success'})
        }
    except Exception as e:
        print(f'Error: {e}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
```

### Pattern 2: Partial Decryption for Display

**Node.js:**

```javascript
exports.handler = async (event) => {
  try {
    const patientId = event.pathParameters.patientId;

    // Retrieve from DynamoDB
    const encrypted = await getFromDynamoDB(patientId);

    // Decrypt only fields needed for display
    const partial = await fieldEncryption.decryptRecord(
      encrypted,
      patientId,
      null,
      ['patient_name', 'age'] // Only decrypt name and age
    );

    return {
      statusCode: 200,
      body: JSON.stringify(partial),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

### Pattern 3: S3 Event Trigger with Encryption

**Python:**

```python
def process_document(event, context):
    """Process uploaded document and encrypt extracted data"""

    # Get S3 object details
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']

    # Extract patient_id from key
    patient_id = key.split('/')[1]

    # Download and process document
    # extracted_data = ocr_process(bucket, key)

    # Encrypt extracted medical data
    encrypted_data = field_encryption.encrypt_record(
        extracted_data,
        patient_id=patient_id,
        additional_context={
            'source': 's3_trigger',
            'bucket': bucket
        }
    )

    # Store in DynamoDB
    # ...
```

### Pattern 4: Batch Processing

**Node.js:**

```javascript
exports.batchProcess = async (event) => {
  const records = JSON.parse(event.body).records;

  // Encrypt all records in parallel
  const encrypted = await Promise.all(
    records.map((record) => fieldEncryption.encryptRecord(record, record.patientId))
  );

  // Batch write to DynamoDB
  // await batchWriteToDynamoDB(encrypted);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `${encrypted.length} records processed`,
    }),
  };
};
```

## Best Practices

### 1. Always Use Encryption Context

Encryption context provides audit trails and additional security:

```python
# Good
encrypted = field_encryption.encrypt_record(
    data,
    patient_id=patient_id,
    additional_context={
        'table': 'Patients',
        'operation': 'create',
        'source': 'api_gateway'
    }
)

# Bad - missing context
encrypted = field_encryption.encrypt_record(data)
```

### 2. Use Partial Decryption

Only decrypt fields you need to reduce exposure and improve performance:

```javascript
// Good - only decrypt what's needed for display
const summary = await fieldEncryption.decryptRecord(
  encrypted,
  patientId,
  null,
  ['patient_name'] // Only name
);

// Bad - decrypting everything when only name is needed
const full = await fieldEncryption.decryptRecord(encrypted, patientId);
```

### 3. Handle Errors Gracefully

```python
try:
    decrypted = field_encryption.decrypt_record(encrypted, patient_id)
except Exception as e:
    logger.error(f'Decryption failed for patient {patient_id}: {e}')
    # Return error response or use fallback
    return {'error': 'Unable to decrypt patient data'}
```

### 4. Reuse Encryption Instances

Initialize encryption services outside the handler for reuse:

```javascript
// Good - reused across invocations
const fieldEncryption = new FieldEncryption();

exports.handler = async (event) => {
  // Use fieldEncryption
};

// Bad - creates new instance every time
exports.handler = async (event) => {
  const fieldEncryption = new FieldEncryption(); // Wasteful
};
```

### 5. Never Log Plaintext PHI

```python
# Bad - logs sensitive data
logger.info(f'Patient name: {patient_data["patient_name"]}')

# Good - log only identifiers
logger.info(f'Processing patient: {patient_id}')
```

### 6. Validate Patient ID Context

Always ensure the patient_id used for decryption matches the record:

```javascript
async function getPatientRecord(recordId, requestedPatientId) {
  const record = await getFromDB(recordId);

  // Validate patient ID matches
  if (record.patientId !== requestedPatientId) {
    throw new Error('Patient ID mismatch');
  }

  // Safe to decrypt with correct context
  return await fieldEncryption.decryptRecord(record, requestedPatientId);
}
```

## Performance Optimization

### 1. Batch Operations

Process multiple records in parallel:

```python
import asyncio

async def batch_encrypt(records):
    tasks = [
        field_encryption.encrypt_record(record, record['patientId'])
        for record in records
    ]
    return await asyncio.gather(*tasks)
```

### 2. Caching Decrypted Data

Cache frequently accessed decrypted data (with TTL):

```javascript
const cache = new Map();
const CACHE_TTL = 300000; // 5 minutes

async function getCachedPatient(patientId) {
  const cached = cache.get(patientId);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const decrypted = await getAndDecryptPatient(patientId);
  cache.set(patientId, {
    data: decrypted,
    timestamp: Date.now(),
  });

  return decrypted;
}
```

### 3. Selective Field Encryption

Only encrypt fields that contain data:

```python
# The library already handles this, but be aware:
record = {
    'patient_name': 'John Doe',
    'medical_history': None  # Won't be encrypted
}
encrypted = field_encryption.encrypt_record(record)
# medical_history remains None
```

### 4. Use Envelope Encryption for Large Data

For large medical documents, use envelope encryption:

```javascript
const { KMSEncryption } = require('./encryption');
const kms = new KMSEncryption();

// Generate data key
const dataKey = await kms.generateDataKey('AES_256');

// Use plaintext key to encrypt large document locally
// Store encrypted data key with document
// Decrypt data key when needed to decrypt document
```

## Troubleshooting

### Error: "KMS key ID is required"

**Cause**: Environment variable not set

**Solution**:

```bash
export VAIDYALINK_KMS_KEY_ID="alias/vaidyalink-prod-primary"
```

### Error: "Encryption context doesn't match"

**Cause**: Decryption context doesn't match encryption context

**Solution**: Use the same patient_id and additional_context:

```python
# Encryption
encrypted = field_encryption.encrypt_record(
    data,
    patient_id='123',
    additional_context={'table': 'Patients'}
)

# Decryption - must match
decrypted = field_encryption.decrypt_record(
    encrypted,
    patient_id='123',  # Must match
    additional_context={'table': 'Patients'}  # Must match
)
```

### Error: "AccessDenied" from KMS

**Cause**: Lambda execution role lacks KMS permissions

**Solution**: Add KMS permissions to Lambda role:

```json
{
  "Effect": "Allow",
  "Action": ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"],
  "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY-ID"
}
```

### Performance Issues

**Symptoms**: Slow Lambda execution, high latency

**Solutions**:

1. Use partial decryption
2. Implement caching
3. Process records in parallel
4. Increase Lambda memory (improves CPU)

### Debugging Encrypted Data

**View encryption markers**:

```python
# Check which fields are encrypted
for key, value in record.items():
    if key.endswith('_encrypted'):
        print(f'{key.replace("_encrypted", "")} is encrypted')
```

## Monitoring and Audit

### CloudWatch Metrics

Monitor encryption operations:

```python
import boto3

cloudwatch = boto3.client('cloudwatch')

def log_encryption_metric(operation, success):
    cloudwatch.put_metric_data(
        Namespace='VaidyaLink/Encryption',
        MetricData=[{
            'MetricName': 'EncryptionOperations',
            'Value': 1,
            'Unit': 'Count',
            'Dimensions': [
                {'Name': 'Operation', 'Value': operation},
                {'Name': 'Success', 'Value': str(success)}
            ]
        }]
    )
```

### CloudTrail Audit

All KMS operations are logged to CloudTrail. Review encryption context in logs:

```json
{
  "eventName": "Encrypt",
  "requestParameters": {
    "encryptionContext": {
      "patient_id": "123",
      "table": "Patients",
      "service": "vaidyalink"
    }
  }
}
```

## Additional Resources

- [ENCRYPTION_README.md](./ENCRYPTION_README.md) - Complete encryption documentation
- [ENCRYPTION_QUICK_START.md](./ENCRYPTION_QUICK_START.md) - Quick start guide
- [KMS_SETUP.md](../infrastructure/docs/KMS_SETUP.md) - KMS infrastructure setup
- [HIPAA Compliance Guide](./HIPAA_COMPLIANCE.md) - HIPAA compliance details

## Support

For issues or questions:

- Check CloudWatch Logs for detailed error messages
- Review CloudTrail for KMS operation audit logs
- Contact the VaidyaLink security team

---

**Last Updated**: 2024
**Version**: 1.0.0
