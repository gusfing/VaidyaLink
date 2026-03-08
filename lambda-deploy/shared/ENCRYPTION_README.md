# VaidyaLink Encryption Utilities

HIPAA-compliant encryption utilities for protecting PHI (Protected Health Information) data using AWS KMS customer-managed keys.

## Overview

This package provides two levels of encryption:

1. **KMS Encryption**: Direct encryption/decryption using AWS KMS for individual values
2. **Field-Level Encryption**: Automatic encryption of sensitive fields in patient records

## Features

- ✅ AWS KMS customer-managed keys with automatic rotation
- ✅ Encryption context for audit trails and additional security
- ✅ Field-level encryption for PHI data
- ✅ Support for both Python and Node.js backends
- ✅ Envelope encryption for large data
- ✅ Key rotation support via re-encryption
- ✅ HIPAA-compliant implementation

## Installation

### Python

```bash
pip install boto3
```

### Node.js

```bash
npm install @aws-sdk/client-kms
```

## Configuration

Set the following environment variables:

```bash
# Required: KMS key ID or alias
VAIDYALINK_KMS_KEY_ID=alias/vaidyalink-prod-primary

# Optional: AWS region (defaults to ap-south-1)
AWS_REGION=ap-south-1
```

## Usage

### Python

#### Basic KMS Encryption

```python
from encryption import KMSEncryption

# Initialize
kms = KMSEncryption()

# Encrypt data
plaintext = "Sensitive patient information"
ciphertext = kms.encrypt(plaintext)

# Decrypt data
decrypted = kms.decrypt(ciphertext)
```

#### KMS Encryption with Context

Encryption context provides additional authenticated data and audit trails:

```python
# Encrypt with context
context = {
    'patient_id': '123',
    'data_type': 'medical_history',
    'department': 'cardiology'
}
ciphertext = kms.encrypt(plaintext, encryption_context=context)

# Decrypt with same context (required)
decrypted = kms.decrypt(ciphertext, encryption_context=context)
```

#### Field-Level Encryption

```python
from encryption import FieldEncryption

# Initialize
field_enc = FieldEncryption()

# Encrypt patient record
patient_record = {
    'patient_id': '123',
    'patient_name': 'Rajesh Kumar',
    'age': 45,
    'medical_history': 'Diabetes Type 2',
    'phone_number': '+91-9876543210'
}

encrypted_record = field_enc.encrypt_record(
    patient_record,
    patient_id='123'
)

# Result:
# {
#     'patient_id': '123',  # Not encrypted (not in sensitive fields)
#     'patient_name': 'AQICAHh...encrypted...==',
#     'patient_name_encrypted': True,
#     'age': 45,  # Not encrypted
#     'medical_history': 'AQICAHh...encrypted...==',
#     'medical_history_encrypted': True,
#     'phone_number': 'AQICAHh...encrypted...==',
#     'phone_number_encrypted': True
# }

# Decrypt record
decrypted_record = field_enc.decrypt_record(
    encrypted_record,
    patient_id='123'
)

# Partial decryption (only specific fields)
partial_decrypt = field_enc.decrypt_record(
    encrypted_record,
    patient_id='123',
    fields_to_decrypt=['patient_name']
)
```

#### Single Field Encryption

```python
# Encrypt single field
encrypted_name = field_enc.encrypt_field(
    'patient_name',
    'Rajesh Kumar',
    patient_id='123'
)

# Decrypt single field
decrypted_name = field_enc.decrypt_field(
    'patient_name',
    encrypted_name,
    patient_id='123'
)
```

### Node.js

#### Basic KMS Encryption

```javascript
const { KMSEncryption } = require('./encryption');

// Initialize
const kms = new KMSEncryption();

// Encrypt data
const plaintext = 'Sensitive patient information';
const ciphertext = await kms.encrypt(plaintext);

// Decrypt data
const decrypted = await kms.decrypt(ciphertext);
```

#### KMS Encryption with Context

```javascript
// Encrypt with context
const context = {
  patient_id: '123',
  data_type: 'medical_history',
  department: 'cardiology',
};
const ciphertext = await kms.encrypt(plaintext, context);

// Decrypt with same context (required)
const decrypted = await kms.decrypt(ciphertext, context);
```

#### Field-Level Encryption

```javascript
const { FieldEncryption } = require('./encryption');

// Initialize
const fieldEnc = new FieldEncryption();

// Encrypt patient record
const patientRecord = {
  patient_id: '123',
  patient_name: 'Rajesh Kumar',
  age: 45,
  medical_history: 'Diabetes Type 2',
  phone_number: '+91-9876543210',
};

const encryptedRecord = await fieldEnc.encryptRecord(patientRecord, '123');

// Decrypt record
const decryptedRecord = await fieldEnc.decryptRecord(encryptedRecord, '123');

// Partial decryption
const partialDecrypt = await fieldEnc.decryptRecord(encryptedRecord, '123', null, ['patient_name']);
```

#### Single Field Encryption

```javascript
// Encrypt single field
const encryptedName = await fieldEnc.encryptField('patient_name', 'Rajesh Kumar', '123');

// Decrypt single field
const decryptedName = await fieldEnc.decryptField('patient_name', encryptedName, '123');
```

## Advanced Features

### Envelope Encryption

For encrypting large amounts of data, use envelope encryption:

```python
# Python
data_key = kms.generate_data_key(key_spec='AES_256')
plaintext_key = data_key['plaintext']
encrypted_key = data_key['ciphertext']

# Use plaintext_key to encrypt your data locally
# Store encrypted_key with the encrypted data
```

```javascript
// Node.js
const dataKey = await kms.generateDataKey('AES_256');
const plaintextKey = dataKey.plaintext;
const encryptedKey = dataKey.ciphertext;

// Use plaintextKey to encrypt your data locally
// Store encryptedKey with the encrypted data
```

### Key Rotation

Re-encrypt data with a new KMS key:

```python
# Python
new_ciphertext = kms.re_encrypt(
    old_ciphertext,
    destination_key_id='alias/vaidyalink-prod-primary-v2'
)
```

```javascript
// Node.js
const newCiphertext = await kms.reEncrypt(oldCiphertext, 'alias/vaidyalink-prod-primary-v2');
```

### Custom Sensitive Fields

Add or remove fields from the sensitive fields list:

```python
# Python
field_enc.add_sensitive_field('custom_phi_field')
field_enc.remove_sensitive_field('phone_number')
field_enc.is_sensitive_field('custom_phi_field')  # True
```

```javascript
// Node.js
fieldEnc.addSensitiveField('custom_phi_field');
fieldEnc.removeSensitiveField('phone_number');
fieldEnc.isSensitiveField('custom_phi_field'); // true
```

## Default Sensitive Fields

The following fields are encrypted by default:

- `patient_name`
- `abha_id`
- `phone_number`
- `email`
- `address`
- `medical_history`
- `diagnosis`
- `prescription_details`
- `lab_results`
- `doctor_notes`
- `emergency_contact`
- `insurance_details`

## Best Practices

### 1. Always Use Encryption Context

Encryption context provides:

- Additional security layer
- Audit trail for compliance
- Protection against ciphertext substitution attacks

```python
# Good
context = {
    'patient_id': patient_id,
    'data_type': 'medical_record',
    'timestamp': datetime.now().isoformat()
}
encrypted = kms.encrypt(data, context)
```

### 2. Store Encryption Markers

Always store the `_encrypted` markers to identify encrypted fields:

```python
# The field_encryption module does this automatically
encrypted_record = field_enc.encrypt_record(record)
# encrypted_record['patient_name_encrypted'] = True
```

### 3. Use Partial Decryption

Only decrypt fields you need to reduce exposure:

```python
# Only decrypt name for display
partial = field_enc.decrypt_record(
    encrypted_record,
    patient_id='123',
    fields_to_decrypt=['patient_name']
)
```

### 4. Handle Errors Gracefully

```python
try:
    decrypted = kms.decrypt(ciphertext, context)
except Exception as e:
    logger.error(f"Decryption failed: {e}")
    # Handle error appropriately
```

### 5. Rotate Keys Regularly

AWS KMS supports automatic key rotation (enabled in our infrastructure):

```python
# Re-encrypt data when rotating to new key
new_ciphertext = kms.re_encrypt(
    old_ciphertext,
    new_key_id,
    source_encryption_context=old_context,
    destination_encryption_context=new_context
)
```

### 6. Use IAM Policies

Restrict KMS key access using IAM policies:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"],
      "Resource": "arn:aws:kms:ap-south-1:ACCOUNT:key/KEY-ID",
      "Condition": {
        "StringEquals": {
          "kms:EncryptionContext:service": "vaidyalink"
        }
      }
    }
  ]
}
```

## Lambda Integration

### Python Lambda Handler

```python
from encryption import FieldEncryption
import json

field_enc = FieldEncryption()

def lambda_handler(event, context):
    # Parse patient record from event
    patient_record = json.loads(event['body'])
    patient_id = event['pathParameters']['patientId']

    # Encrypt sensitive fields
    encrypted_record = field_enc.encrypt_record(
        patient_record,
        patient_id=patient_id
    )

    # Store in DynamoDB
    # ...

    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Record encrypted and stored'})
    }
```

### Node.js Lambda Handler

```javascript
const { FieldEncryption } = require('./encryption');

const fieldEnc = new FieldEncryption();

exports.handler = async (event) => {
  // Parse patient record from event
  const patientRecord = JSON.parse(event.body);
  const patientId = event.pathParameters.patientId;

  // Encrypt sensitive fields
  const encryptedRecord = await fieldEnc.encryptRecord(patientRecord, patientId);

  // Store in DynamoDB
  // ...

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Record encrypted and stored' }),
  };
};
```

## Testing

### Python Tests

```bash
cd backend/shared/python/encryption
pytest test_kms_encryption.py test_field_encryption.py -v
```

### Node.js Tests

```bash
cd backend/shared/nodejs/encryption
npm test
```

## Security Considerations

1. **Never log plaintext PHI data**
2. **Always use encryption context for audit trails**
3. **Implement least-privilege IAM policies**
4. **Enable CloudTrail logging for KMS operations**
5. **Use separate KMS keys for different data types**
6. **Implement key rotation policies**
7. **Monitor KMS usage with CloudWatch**
8. **Validate encryption context on decryption**

## Compliance

This implementation meets the following compliance requirements:

- ✅ HIPAA Security Rule - Technical Safeguards
- ✅ HIPAA Encryption Standards (45 CFR § 164.312(a)(2)(iv))
- ✅ ABDM Security Guidelines
- ✅ AWS HIPAA Eligible Services

## Performance Considerations

- **KMS API Limits**: 5,500 requests/second (shared across all operations)
- **Latency**: ~10-50ms per KMS operation
- **Cost**: $0.03 per 10,000 requests
- **Caching**: Consider caching data keys for envelope encryption

## Troubleshooting

### Common Errors

**Error: "KMS key ID is required"**

- Solution: Set `VAIDYALINK_KMS_KEY_ID` environment variable

**Error: "KMS encryption failed [AccessDenied]"**

- Solution: Check IAM permissions for KMS key access

**Error: "Invalid base64-encoded ciphertext"**

- Solution: Ensure ciphertext is properly base64 encoded

**Error: "Encryption context doesn't match"**

- Solution: Use the same context for encryption and decryption

## Support

For issues or questions:

- Check CloudWatch Logs for detailed error messages
- Review CloudTrail for KMS operation audit logs
- Contact the VaidyaLink security team

## License

Copyright © 2024 VaidyaLink. All rights reserved.
