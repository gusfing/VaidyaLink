# KMS Quick Start Guide

## Overview

VaidyaLink uses 4 customer-managed KMS keys for encrypting different types of data. This guide shows you how to use them in your code.

## Available Keys

```typescript
import { SecurityConstruct } from '../lib/constructs/security';

const security = new SecurityConstruct(this, 'Security', {
  environment: 'dev',
});

// 4 keys available:
security.encryptionKey; // Primary key (Lambda, CloudWatch)
security.s3EncryptionKey; // S3 buckets
security.dynamoDbEncryptionKey; // DynamoDB tables
security.secretsEncryptionKey; // Secrets Manager
```

## Usage Examples

### 1. Encrypt S3 Bucket

```typescript
import * as s3 from 'aws-cdk-lib/aws-s3';

const bucket = new s3.Bucket(this, 'MyBucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: security.s3EncryptionKey,
  enforceSSL: true,
});
```

### 2. Encrypt DynamoDB Table

```typescript
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

const table = new dynamodb.Table(this, 'MyTable', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
  encryptionKey: security.dynamoDbEncryptionKey,
});
```

### 3. Encrypt Lambda Environment Variables

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';

const fn = new lambda.Function(this, 'MyFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda'),
  environment: {
    SECRET_KEY: 'my-secret-value',
  },
  environmentEncryption: security.encryptionKey,
});
```

### 4. Encrypt Secrets Manager Secret

```typescript
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

const secret = new secretsmanager.Secret(this, 'MySecret', {
  secretName: 'my-api-key',
  encryptionKey: security.secretsEncryptionKey,
});
```

### 5. Grant Lambda Access to KMS Key

```typescript
// Grant decrypt permission
security.s3EncryptionKey.grantDecrypt(myLambdaFunction);

// Grant encrypt permission
security.s3EncryptionKey.grantEncrypt(myLambdaFunction);

// Grant both encrypt and decrypt
security.s3EncryptionKey.grant(myLambdaFunction, 'kms:Encrypt', 'kms:Decrypt');
```

### 6. Encrypt CloudWatch Log Group

```typescript
import * as logs from 'aws-cdk-lib/aws-logs';

const logGroup = new logs.LogGroup(this, 'MyLogGroup', {
  logGroupName: '/aws/lambda/my-function',
  encryptionKey: security.encryptionKey,
  retention: logs.RetentionDays.ONE_MONTH,
});
```

## Key Selection Guide

| Data Type                   | Use This Key            | Reason                      |
| --------------------------- | ----------------------- | --------------------------- |
| Medical documents (S3)      | `s3EncryptionKey`       | Dedicated key for PHI data  |
| Patient metadata (DynamoDB) | `dynamoDbEncryptionKey` | Separate key for database   |
| API credentials             | `secretsEncryptionKey`  | Isolated secrets encryption |
| Lambda env vars             | `encryptionKey`         | General-purpose encryption  |
| CloudWatch Logs             | `encryptionKey`         | General-purpose encryption  |

## Key Aliases

Keys are accessible via aliases for CLI/SDK usage:

```bash
# Development
alias/vaidyalink-dev-primary
alias/vaidyalink-dev-s3
alias/vaidyalink-dev-dynamodb
alias/vaidyalink-dev-secrets

# Production
alias/vaidyalink-prod-primary
alias/vaidyalink-prod-s3
alias/vaidyalink-prod-dynamodb
alias/vaidyalink-prod-secrets
```

## CLI Examples

### Encrypt a file

```bash
aws kms encrypt \
  --key-id alias/vaidyalink-dev-s3 \
  --plaintext fileb://document.pdf \
  --output text \
  --query CiphertextBlob | base64 --decode > document.pdf.encrypted
```

### Decrypt a file

```bash
aws kms decrypt \
  --ciphertext-blob fileb://document.pdf.encrypted \
  --output text \
  --query Plaintext | base64 --decode > document.pdf
```

### Get key details

```bash
aws kms describe-key --key-id alias/vaidyalink-dev-s3
```

## SDK Examples

### Node.js (Lambda)

```javascript
const { KMSClient, EncryptCommand, DecryptCommand } = require('@aws-sdk/client-kms');

const kms = new KMSClient({ region: 'ap-south-1' });

// Encrypt
async function encryptData(plaintext) {
  const command = new EncryptCommand({
    KeyId: 'alias/vaidyalink-prod-s3',
    Plaintext: Buffer.from(plaintext),
  });
  const response = await kms.send(command);
  return response.CiphertextBlob;
}

// Decrypt
async function decryptData(ciphertext) {
  const command = new DecryptCommand({
    CiphertextBlob: ciphertext,
  });
  const response = await kms.send(command);
  return response.Plaintext.toString();
}
```

### Python (Lambda)

```python
import boto3
import base64

kms = boto3.client('kms', region_name='ap-south-1')

# Encrypt
def encrypt_data(plaintext):
    response = kms.encrypt(
        KeyId='alias/vaidyalink-prod-s3',
        Plaintext=plaintext.encode()
    )
    return base64.b64encode(response['CiphertextBlob'])

# Decrypt
def decrypt_data(ciphertext):
    response = kms.decrypt(
        CiphertextBlob=base64.b64decode(ciphertext)
    )
    return response['Plaintext'].decode()
```

## Testing

Run KMS tests:

```bash
cd infrastructure
npm test -- security.test.ts
```

## Troubleshooting

### Error: AccessDeniedException

**Problem**: Lambda can't decrypt data

**Solution**: Grant KMS permissions to Lambda role

```typescript
security.s3EncryptionKey.grantDecrypt(lambdaFunction);
```

### Error: Key not found

**Problem**: Using wrong key alias

**Solution**: Check environment and key type

```bash
aws kms list-aliases | grep vaidyalink
```

### Error: Throttling

**Problem**: Too many KMS API calls

**Solution**: Implement caching or use envelope encryption

```typescript
// Cache data keys in Lambda
let cachedDataKey;

export const handler = async (event) => {
  if (!cachedDataKey) {
    cachedDataKey = await generateDataKey();
  }
  // Use cached key for encryption
};
```

## Best Practices

1. **Use the right key**: Don't use S3 key for DynamoDB or vice versa
2. **Grant minimal permissions**: Only grant decrypt if that's all you need
3. **Cache data keys**: Reduce KMS API calls in Lambda
4. **Use envelope encryption**: For large files, encrypt with data key
5. **Monitor usage**: Set up CloudWatch alarms for throttling
6. **Rotate regularly**: Keys auto-rotate annually, but monitor rotation status

## Cost Optimization

- Each key costs $1/month
- API calls cost $0.03 per 10,000 requests
- Use envelope encryption to reduce API calls
- Cache data keys in Lambda between invocations

## Security Checklist

- [ ] Using customer-managed keys (not AWS-managed)
- [ ] Automatic rotation enabled (365 days)
- [ ] Least privilege IAM policies
- [ ] CloudTrail logging enabled
- [ ] 30-day deletion window configured
- [ ] Keys tagged for compliance tracking

## Additional Resources

- [Full KMS Setup Documentation](./KMS_SETUP.md)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [CDK KMS API Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_kms-readme.html)
