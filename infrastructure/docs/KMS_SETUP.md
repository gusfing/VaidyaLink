# AWS KMS Customer-Managed Keys Setup

## Overview

VaidyaLink uses AWS Key Management Service (KMS) with customer-managed keys (CMKs) to encrypt all sensitive data at rest. This document describes the KMS key architecture, key policies, and usage patterns.

## Key Architecture

### Key Hierarchy

VaidyaLink implements a **multi-key strategy** with separate customer-managed keys for different data types:

1. **Primary Encryption Key** - General-purpose encryption for Lambda environment variables and CloudWatch Logs
2. **S3 Encryption Key** - Dedicated key for medical document storage in S3 buckets
3. **DynamoDB Encryption Key** - Dedicated key for patient metadata and job tracking tables
4. **Secrets Manager Key** - Dedicated key for API credentials and sensitive configuration

### Why Multiple Keys?

- **Blast Radius Limitation**: If one key is compromised, only data encrypted with that key is affected
- **Access Control Granularity**: Different services and roles can be granted access to specific keys
- **Compliance Requirements**: HIPAA recommends separation of encryption keys by data classification
- **Audit Trail Clarity**: CloudTrail logs show which key was used for each operation
- **Key Rotation Independence**: Each key can be rotated on different schedules based on data sensitivity

## Key Configuration

### Common Settings (All Keys)

```typescript
{
  enableKeyRotation: true,              // Automatic annual rotation
  rotationPeriod: Duration.days(365),   // Rotate every year
  keySpec: KeySpec.SYMMETRIC_DEFAULT,   // AES-256-GCM
  keyUsage: KeyUsage.ENCRYPT_DECRYPT,   // Symmetric encryption
  pendingWindow: Duration.days(30),     // 30-day deletion window
  removalPolicy: environment === 'prod'
    ? RemovalPolicy.RETAIN              // Keep keys in production
    : RemovalPolicy.DESTROY             // Delete in dev/staging
}
```

### Key-Specific Configurations

#### 1. Primary Encryption Key

**Alias**: `alias/vaidyalink-{environment}-primary`

**Purpose**:

- Lambda environment variable encryption
- CloudWatch Logs encryption
- General-purpose encryption for non-PHI data

**Key Policy**:

```json
{
  "Sid": "Enable IAM User Permissions",
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::{account}:root" },
  "Action": "kms:*",
  "Resource": "*"
},
{
  "Sid": "Allow CloudWatch Logs",
  "Effect": "Allow",
  "Principal": { "Service": "logs.{region}.amazonaws.com" },
  "Action": [
    "kms:Encrypt",
    "kms:Decrypt",
    "kms:ReEncrypt*",
    "kms:GenerateDataKey*",
    "kms:CreateGrant",
    "kms:DescribeKey"
  ],
  "Resource": "*",
  "Condition": {
    "ArnLike": {
      "kms:EncryptionContext:aws:logs:arn": "arn:aws:logs:{region}:{account}:log-group:/aws/lambda/vaidyalink-{environment}-*"
    }
  }
}
```

#### 2. S3 Encryption Key

**Alias**: `alias/vaidyalink-{environment}-s3`

**Purpose**:

- Medical document images (prescriptions, lab reports, scans)
- Voice recording audio files
- Processed OCR output JSON files
- FHIR export bundles

**Key Policy**:

```json
{
  "Sid": "Allow S3 Service",
  "Effect": "Allow",
  "Principal": { "Service": "s3.amazonaws.com" },
  "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
  "Resource": "*"
}
```

**S3 Bucket Configuration**:

```typescript
new s3.Bucket(this, 'DocumentsBucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: s3EncryptionKey,
  versioned: true,
  enforceSSL: true,
});
```

#### 3. DynamoDB Encryption Key

**Alias**: `alias/vaidyalink-{environment}-dynamodb`

**Purpose**:

- ScanJobs table (processing job metadata)
- Patients table (patient demographics, ABHA IDs)
- VoiceJobs table (transcription job metadata)

**Key Policy**:

```json
{
  "Sid": "Allow DynamoDB Service",
  "Effect": "Allow",
  "Principal": { "Service": "dynamodb.amazonaws.com" },
  "Action": [
    "kms:Decrypt",
    "kms:DescribeKey",
    "kms:Encrypt",
    "kms:ReEncrypt*",
    "kms:GenerateDataKey*",
    "kms:CreateGrant"
  ],
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "kms:ViaService": "dynamodb.{region}.amazonaws.com"
    }
  }
}
```

**DynamoDB Table Configuration**:

```typescript
new dynamodb.Table(this, 'PatientsTable', {
  encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
  encryptionKey: dynamoDbEncryptionKey,
  pointInTimeRecovery: true,
});
```

#### 4. Secrets Manager Key

**Alias**: `alias/vaidyalink-{environment}-secrets`

**Purpose**:

- ABDM API credentials
- Bhashini API keys
- Third-party service tokens
- Database connection strings

**Key Policy**:

```json
{
  "Sid": "Allow Secrets Manager",
  "Effect": "Allow",
  "Principal": { "Service": "secretsmanager.amazonaws.com" },
  "Action": ["kms:Decrypt", "kms:GenerateDataKey", "kms:CreateGrant"],
  "Resource": "*"
}
```

## Key Rotation

### Automatic Rotation

All KMS keys are configured with **automatic annual rotation**:

- AWS automatically creates new key material every 365 days
- Old key material is retained for decryption of existing data
- No application changes required
- CloudTrail logs rotation events

### Manual Rotation (Emergency)

If a key compromise is suspected:

1. **Create new key**:

   ```bash
   aws kms create-key \
     --description "VaidyaLink Emergency Rotation Key" \
     --key-usage ENCRYPT_DECRYPT
   ```

2. **Update key alias**:

   ```bash
   aws kms update-alias \
     --alias-name alias/vaidyalink-prod-s3 \
     --target-key-id <new-key-id>
   ```

3. **Re-encrypt data** (S3 example):

   ```bash
   aws s3 cp s3://bucket/object s3://bucket/object \
     --sse aws:kms \
     --sse-kms-key-id <new-key-id> \
     --metadata-directive REPLACE
   ```

4. **Schedule old key deletion**:
   ```bash
   aws kms schedule-key-deletion \
     --key-id <old-key-id> \
     --pending-window-in-days 30
   ```

## Access Control

### Lambda Function Access

Lambda functions are granted KMS permissions via IAM roles:

```typescript
// Document Processing Lambda needs S3 key access
s3EncryptionKey.grantDecrypt(documentProcessingLambda);
s3EncryptionKey.grantEncrypt(documentProcessingLambda);

// All Lambdas need DynamoDB key access
dynamoDbEncryptionKey.grantDecrypt(lambdaRole);
dynamoDbEncryptionKey.grantEncrypt(lambdaRole);
```

### User Access (Federated Identity)

Cognito Identity Pool authenticated users get limited S3 access:

```typescript
authenticatedRole.addToPolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
    resources: [s3EncryptionKey.keyArn],
    conditions: {
      StringLike: {
        'kms:ViaService': 's3.*.amazonaws.com',
      },
    },
  })
);
```

## Monitoring and Auditing

### CloudTrail Logging

All KMS operations are logged to CloudTrail:

- `Encrypt` - Data encryption operations
- `Decrypt` - Data decryption operations
- `GenerateDataKey` - Data key generation for envelope encryption
- `CreateGrant` - Grant creation for service access
- `ScheduleKeyDeletion` - Key deletion requests
- `DisableKey` - Key disablement

### CloudWatch Metrics

Monitor KMS usage with CloudWatch:

```typescript
new cloudwatch.Alarm(this, 'KMSThrottleAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/KMS',
    metricName: 'UserErrorCount',
    statistic: 'Sum',
    period: Duration.minutes(5),
  }),
  threshold: 10,
  evaluationPeriods: 2,
  alarmDescription: 'KMS throttling detected',
});
```

### Key Usage Dashboard

Create a CloudWatch dashboard to monitor:

- API call volume per key
- Throttling errors
- Failed decryption attempts
- Key rotation status

## Cost Optimization

### KMS Pricing (as of 2024)

- **Customer-managed keys**: $1/month per key
- **API requests**: $0.03 per 10,000 requests
- **Automatic rotation**: No additional charge

### Cost Estimates for VaidyaLink

**Monthly costs** (assuming 10,000 scans/month):

| Component           | Keys   | API Calls | Monthly Cost |
| ------------------- | ------ | --------- | ------------ |
| Key storage         | 4 keys | -         | $4.00        |
| S3 operations       | -      | ~20,000   | $0.06        |
| DynamoDB operations | -      | ~30,000   | $0.09        |
| Lambda operations   | -      | ~10,000   | $0.03        |
| **Total**           |        |           | **~$4.18**   |

### Optimization Tips

1. **Use envelope encryption**: Reduces KMS API calls by encrypting data keys locally
2. **Cache data keys**: Lambda can reuse data keys across invocations
3. **Batch operations**: Combine multiple encrypt/decrypt operations
4. **Use grants**: More efficient than IAM policies for temporary access

## Compliance

### HIPAA Requirements

✅ **Encryption at rest**: All PHI encrypted with FIPS 140-2 validated keys
✅ **Key rotation**: Annual automatic rotation enabled
✅ **Access control**: Least privilege IAM policies
✅ **Audit logging**: CloudTrail logs all key usage
✅ **Key deletion protection**: 30-day pending window

### ABDM Requirements

✅ **Data sovereignty**: Keys stored in AWS India (ap-south-1) region
✅ **Customer control**: Customer-managed keys (not AWS-managed)
✅ **Audit trail**: CloudTrail integration for compliance reporting

## Disaster Recovery

### Key Backup

KMS keys cannot be exported, but key metadata is backed up:

1. **Key policies**: Stored in CDK code (version controlled)
2. **Key aliases**: Documented in this file
3. **Key IDs**: Exported as CloudFormation outputs

### Recovery Procedures

**Scenario 1: Accidental key deletion**

- Keys have 30-day pending deletion window
- Cancel deletion within 30 days:
  ```bash
  aws kms cancel-key-deletion --key-id <key-id>
  ```

**Scenario 2: Key compromise**

- Follow manual rotation procedure (see above)
- Notify security team
- Review CloudTrail logs for unauthorized access

**Scenario 3: Region failure**

- KMS keys are region-specific
- Multi-region keys not used (data sovereignty requirement)
- Disaster recovery plan includes re-creating keys in backup region

## Troubleshooting

### Common Issues

**Issue**: `AccessDeniedException` when Lambda tries to decrypt

**Solution**: Verify Lambda execution role has `kms:Decrypt` permission:

```bash
aws iam get-role-policy \
  --role-name vaidyalink-lambda-role \
  --policy-name KMSAccess
```

**Issue**: S3 upload fails with KMS error

**Solution**: Check bucket encryption configuration and key policy:

```bash
aws s3api get-bucket-encryption --bucket vaidyalink-documents-prod
aws kms get-key-policy --key-id <key-id> --policy-name default
```

**Issue**: DynamoDB query fails with encryption error

**Solution**: Verify table encryption settings:

```bash
aws dynamodb describe-table --table-name vaidyalink-patients-prod \
  --query 'Table.SSEDescription'
```

## References

- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [HIPAA Encryption Requirements](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
- [AWS KMS Pricing](https://aws.amazon.com/kms/pricing/)
- [CDK KMS Documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_kms-readme.html)
