# Encryption Utilities - Quick Start Guide

Get started with VaidyaLink encryption utilities in 5 minutes.

## Prerequisites

- AWS KMS key configured (see infrastructure setup)
- AWS credentials configured
- Python 3.11+ or Node.js 18+

## Setup

### Python

```bash
cd backend/shared/python/encryption
pip install -r requirements.txt
```

### Node.js

```bash
cd backend/shared/nodejs/encryption
npm install
```

## Environment Variables

```bash
# Required
export VAIDYALINK_KMS_KEY_ID="alias/vaidyalink-dev-primary"

# Optional (defaults to ap-south-1)
export AWS_REGION="ap-south-1"
```

## Basic Usage

### Python - Encrypt a Patient Record

```python
from encryption import FieldEncryption

# Initialize
field_enc = FieldEncryption()

# Your patient data
patient = {
    'patient_id': '123',
    'patient_name': 'Rajesh Kumar',
    'age': 45,
    'medical_history': 'Diabetes Type 2'
}

# Encrypt (only sensitive fields are encrypted)
encrypted = field_enc.encrypt_record(patient, patient_id='123')

# Decrypt
decrypted = field_enc.decrypt_record(encrypted, patient_id='123')
```

### Node.js - Encrypt a Patient Record

```javascript
const { FieldEncryption } = require('./encryption');

// Initialize
const fieldEnc = new FieldEncryption();

// Your patient data
const patient = {
  patient_id: '123',
  patient_name: 'Rajesh Kumar',
  age: 45,
  medical_history: 'Diabetes Type 2',
};

// Encrypt (only sensitive fields are encrypted)
const encrypted = await fieldEnc.encryptRecord(patient, '123');

// Decrypt
const decrypted = await fieldEnc.decryptRecord(encrypted, '123');
```

## What Gets Encrypted?

By default, these fields are automatically encrypted:

✅ `patient_name` - Patient's full name
✅ `abha_id` - ABHA health ID
✅ `phone_number` - Contact number
✅ `email` - Email address
✅ `address` - Physical address
✅ `medical_history` - Medical history text
✅ `diagnosis` - Diagnosis information
✅ `prescription_details` - Prescription data
✅ `lab_results` - Lab test results
✅ `doctor_notes` - Doctor's notes
✅ `emergency_contact` - Emergency contact info
✅ `insurance_details` - Insurance information

❌ `patient_id` - Not encrypted (used for indexing)
❌ `age` - Not encrypted (non-sensitive)
❌ `gender` - Not encrypted (non-sensitive)

## Lambda Integration

### Python Lambda

```python
from encryption import FieldEncryption
import json

field_enc = FieldEncryption()

def lambda_handler(event, context):
    # Parse input
    patient = json.loads(event['body'])
    patient_id = event['pathParameters']['patientId']

    # Encrypt
    encrypted = field_enc.encrypt_record(patient, patient_id)

    # Store in DynamoDB
    # dynamodb.put_item(TableName='Patients', Item=encrypted)

    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Success'})
    }
```

### Node.js Lambda

```javascript
const { FieldEncryption } = require('./encryption');

const fieldEnc = new FieldEncryption();

exports.handler = async (event) => {
  // Parse input
  const patient = JSON.parse(event.body);
  const patientId = event.pathParameters.patientId;

  // Encrypt
  const encrypted = await fieldEnc.encryptRecord(patient, patientId);

  // Store in DynamoDB
  // await dynamodb.putItem({ TableName: 'Patients', Item: encrypted });

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  };
};
```

## Testing

### Python

```bash
cd backend/shared/python/encryption
pytest -v
```

### Node.js

```bash
cd backend/shared/nodejs/encryption
npm test
```

## Common Patterns

### 1. Partial Decryption (Performance Optimization)

Only decrypt fields you need:

```python
# Python
partial = field_enc.decrypt_record(
    encrypted,
    patient_id='123',
    fields_to_decrypt=['patient_name']  # Only decrypt name
)
```

```javascript
// Node.js
const partial = await fieldEnc.decryptRecord(
  encrypted,
  '123',
  null,
  ['patient_name'] // Only decrypt name
);
```

### 2. Single Field Encryption

Encrypt individual fields:

```python
# Python
encrypted_name = field_enc.encrypt_field(
    'patient_name',
    'Rajesh Kumar',
    patient_id='123'
)
```

```javascript
// Node.js
const encryptedName = await fieldEnc.encryptField('patient_name', 'Rajesh Kumar', '123');
```

### 3. Custom Sensitive Fields

Add your own sensitive fields:

```python
# Python
field_enc.add_sensitive_field('custom_phi_field')
```

```javascript
// Node.js
fieldEnc.addSensitiveField('custom_phi_field');
```

## Security Best Practices

1. ✅ **Always use encryption context** - Provides audit trail
2. ✅ **Use partial decryption** - Only decrypt what you need
3. ✅ **Never log plaintext PHI** - Always log encrypted values
4. ✅ **Validate patient_id** - Ensure context matches
5. ✅ **Enable CloudTrail** - Monitor KMS operations

## Troubleshooting

### Error: "KMS key ID is required"

**Solution**: Set the environment variable:

```bash
export VAIDYALINK_KMS_KEY_ID="alias/vaidyalink-dev-primary"
```

### Error: "AccessDenied"

**Solution**: Check IAM permissions for KMS key access:

```json
{
  "Effect": "Allow",
  "Action": ["kms:Encrypt", "kms:Decrypt"],
  "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY-ID"
}
```

### Error: "Encryption context doesn't match"

**Solution**: Use the same context for encryption and decryption:

```python
# Encrypt with context
encrypted = field_enc.encrypt_field('name', 'John', patient_id='123')

# Decrypt with SAME context
decrypted = field_enc.decrypt_field('name', encrypted, patient_id='123')
```

## Next Steps

- Read the [full documentation](./ENCRYPTION_README.md)
- Check [example Lambda handlers](./python/encryption/examples/)
- Review [security best practices](./ENCRYPTION_README.md#security-considerations)
- Set up [CloudWatch monitoring](./ENCRYPTION_README.md#troubleshooting)

## Support

For issues or questions, check:

- CloudWatch Logs for detailed errors
- CloudTrail for KMS operation audit logs
- Infrastructure team for KMS key access

---

**Ready to encrypt?** Start with the examples above and refer to the full documentation for advanced features.
