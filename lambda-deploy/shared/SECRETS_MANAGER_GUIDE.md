# AWS Secrets Manager Integration Guide

## Overview

VaidyaLink uses AWS Secrets Manager to securely store and manage sensitive credentials including:

- ABDM API credentials
- Bhashini API keys
- Amazon Bedrock configuration
- Database credentials
- JWT signing secrets

All secrets are encrypted at rest using customer-managed KMS keys and cached in Lambda memory for performance.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Lambda Function                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Secrets Manager Client (with caching)                 │ │
│  │  - 5-minute cache TTL                                  │ │
│  │  - Automatic JSON parsing                             │ │
│  │  - Singleton pattern for container reuse              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              AWS Secrets Manager                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  vaidyalink/{env}/abdm/api-credentials                │ │
│  │  vaidyalink/{env}/bhashini/api-credentials            │ │
│  │  vaidyalink/{env}/bedrock/config                      │ │
│  │  vaidyalink/{env}/database/credentials                │ │
│  │  vaidyalink/{env}/jwt/signing-key                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   AWS KMS                                    │
│  Customer-Managed Key: vaidyalink-{env}-secrets             │
│  - Automatic key rotation (365 days)                        │
│  - HIPAA compliant                                          │
└─────────────────────────────────────────────────────────────┘
```

## Secret Naming Convention

All secrets follow this pattern:

```
vaidyalink/{environment}/{service}/{secret-type}
```

Examples:

- `vaidyalink/dev/abdm/api-credentials`
- `vaidyalink/prod/bhashini/api-credentials`
- `vaidyalink/staging/bedrock/config`

## Infrastructure Setup

### CDK Construct

The `SecretsManagerConstruct` creates all required secrets:

```typescript
import { SecretsManagerConstruct } from './constructs/secrets-manager';

const secretsManager = new SecretsManagerConstruct(this, 'SecretsManager', {
  environment: 'dev',
  encryptionKey: security.secretsEncryptionKey,
});
```

### Grant Lambda Access

```typescript
// Grant read access to specific secrets
secretsManager.grantRead('abdm', myLambdaFunction);

// Grant read access to multiple secrets
secretsManager.grantReadMultiple(['abdm', 'bhashini'], myLambdaFunction);
```

## Usage in Lambda Functions

### Node.js

```javascript
const { getInstance } = require('@vaidyalink/secrets-manager');

exports.handler = async (event) => {
  const secretsManager = getInstance();

  // Get ABDM credentials
  const abdmCreds = await secretsManager.getABDMCredentials();
  console.log('Client ID:', abdmCreds.clientId);

  // Get Bhashini credentials
  const bhashiniCreds = await secretsManager.getBhashiniCredentials();

  // Get Bedrock config
  const bedrockConfig = await secretsManager.getBedrockConfig();

  // Get JWT signing secret
  const jwtSecret = await secretsManager.getJWTSigningSecret();

  // Get custom secret
  const customSecret = await secretsManager.getSecret('vaidyalink/dev/custom/my-secret');

  // Batch get multiple secrets
  const secrets = await secretsManager.getSecrets([
    'vaidyalink/dev/abdm/api-credentials',
    'vaidyalink/dev/bhashini/api-credentials',
  ]);
};
```

### Python

```python
from secrets_manager import get_instance

def handler(event, context):
    secrets_manager = get_instance()

    # Get ABDM credentials
    abdm_creds = secrets_manager.get_abdm_credentials()
    print(f"Client ID: {abdm_creds['clientId']}")

    # Get Bhashini credentials
    bhashini_creds = secrets_manager.get_bhashini_credentials()

    # Get Bedrock config
    bedrock_config = secrets_manager.get_bedrock_config()

    # Get JWT signing secret
    jwt_secret = secrets_manager.get_jwt_signing_secret()

    # Get custom secret
    custom_secret = secrets_manager.get_secret('vaidyalink/dev/custom/my-secret')

    # Batch get multiple secrets
    secrets = secrets_manager.get_secrets([
        'vaidyalink/dev/abdm/api-credentials',
        'vaidyalink/dev/bhashini/api-credentials',
    ])
```

## Secret Formats

### ABDM API Credentials

```json
{
  "clientId": "your-abdm-client-id",
  "clientSecret": "your-abdm-client-secret",
  "apiBaseUrl": "https://dev.abdm.gov.in",
  "facilityId": "your-facility-id"
}
```

### Bhashini API Credentials

```json
{
  "apiKey": "your-bhashini-api-key",
  "apiBaseUrl": "https://api.bhashini.gov.in",
  "userId": "your-user-id"
}
```

### Bedrock Configuration

```json
{
  "modelId": "anthropic.claude-3-5-sonnet-20240620-v1:0",
  "region": "ap-south-1",
  "maxTokens": "4096",
  "temperature": "0.7"
}
```

### Database Credentials

```json
{
  "username": "vaidyalink_admin",
  "password": "auto-generated-secure-password"
}
```

### JWT Signing Secret

```
auto-generated-64-character-secret
```

## Caching

The Secrets Manager client implements automatic caching:

- **Cache TTL**: 5 minutes (300 seconds) by default
- **Cache Location**: Lambda container memory
- **Cache Invalidation**: Automatic after TTL expires

### Custom Cache TTL

```javascript
// Node.js
const secretsManager = new SecretsManager({ cacheTTL: 600000 }); // 10 minutes

// Python
secrets_manager = SecretsManager(cache_ttl=600)  # 10 minutes
```

### Force Refresh

```javascript
// Node.js
const secret = await secretsManager.getSecret('my-secret', true); // force refresh

// Python
secret = secrets_manager.get_secret('my-secret', (force_refresh = True));
```

### Clear Cache

```javascript
// Node.js
secretsManager.clearCache('my-secret'); // Clear specific secret
secretsManager.clearCache(); // Clear all

// Python
secrets_manager.clear_cache('my-secret')  # Clear specific secret
secrets_manager.clear_cache()  # Clear all
```

## Updating Secrets

### Via AWS Console

1. Navigate to AWS Secrets Manager
2. Find the secret (e.g., `vaidyalink/dev/abdm/api-credentials`)
3. Click "Retrieve secret value"
4. Click "Edit"
5. Update the JSON value
6. Click "Save"

### Via AWS CLI

```bash
# Update ABDM credentials
aws secretsmanager update-secret \
  --secret-id vaidyalink/dev/abdm/api-credentials \
  --secret-string '{
    "clientId": "new-client-id",
    "clientSecret": "new-client-secret",
    "apiBaseUrl": "https://dev.abdm.gov.in",
    "facilityId": "new-facility-id"
  }'

# Update Bhashini API key
aws secretsmanager update-secret \
  --secret-id vaidyalink/dev/bhashini/api-credentials \
  --secret-string '{
    "apiKey": "new-api-key",
    "apiBaseUrl": "https://api.bhashini.gov.in",
    "userId": "new-user-id"
  }'
```

### Via CDK

Secrets are created with placeholder values. Update them after deployment:

```bash
# After CDK deploy
npm run update-secrets
```

## Secret Rotation

### Automatic Rotation (Future)

AWS Secrets Manager supports automatic rotation for database credentials:

```typescript
databaseCredentials.addRotationSchedule('RotationSchedule', {
  automaticallyAfter: cdk.Duration.days(30),
  rotationLambda: rotationFunction,
});
```

### Manual Rotation

1. Update the secret value in AWS Secrets Manager
2. Lambda functions will automatically pick up the new value after cache TTL expires
3. For immediate update, clear the cache or restart Lambda functions

## IAM Permissions

Lambda functions need these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
      "Resource": ["arn:aws:secretsmanager:ap-south-1:*:secret:vaidyalink/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:DescribeKey"],
      "Resource": ["arn:aws:kms:ap-south-1:*:key/*"],
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "secretsmanager.ap-south-1.amazonaws.com"
        }
      }
    }
  ]
}
```

## Best Practices

1. **Never hardcode secrets** in code or environment variables
2. **Use the singleton pattern** (`getInstance()`) for Lambda container reuse
3. **Leverage caching** to reduce API calls and improve performance
4. **Use specific secret names** instead of wildcards in IAM policies
5. **Rotate secrets regularly** (at least every 90 days)
6. **Monitor secret access** using CloudTrail logs
7. **Use different secrets per environment** (dev, staging, prod)
8. **Test secret rotation** in non-production environments first

## Monitoring

### CloudWatch Metrics

Monitor secret access patterns:

- `secretsmanager:GetSecretValue` API calls
- KMS decrypt operations
- Lambda function errors related to secrets

### CloudTrail Logs

All secret access is logged to CloudTrail:

```json
{
  "eventName": "GetSecretValue",
  "eventSource": "secretsmanager.amazonaws.com",
  "requestParameters": {
    "secretId": "vaidyalink/dev/abdm/api-credentials"
  },
  "userIdentity": {
    "principalId": "AIDAI...",
    "arn": "arn:aws:sts::123456789012:assumed-role/lambda-role/function-name"
  }
}
```

## Troubleshooting

### Secret Not Found

```
Error: Secrets Manager can't find the specified secret
```

**Solution**: Verify the secret name and environment variable `ENVIRONMENT` is set correctly.

### Access Denied

```
Error: User is not authorized to perform: secretsmanager:GetSecretValue
```

**Solution**: Check Lambda execution role has `secretsmanager:GetSecretValue` permission.

### KMS Decrypt Error

```
Error: User is not authorized to perform: kms:Decrypt
```

**Solution**: Ensure Lambda role has KMS decrypt permission for the secrets encryption key.

### Cache Issues

If secrets aren't updating:

1. Check cache TTL setting
2. Force refresh: `getSecret(name, true)`
3. Clear cache: `clearCache()`
4. Restart Lambda function (cold start)

## Cost Optimization

- **Caching**: Reduces API calls by 99%+ (5-minute cache = ~288 calls/day → ~3 calls/day)
- **Batch Loading**: Use `getSecrets()` for multiple secrets
- **Singleton Pattern**: Reuse client across Lambda invocations
- **Pricing**: $0.40/10,000 API calls + $0.05/secret/month

Example cost for 1M Lambda invocations/month:

- Without caching: 1M API calls = $40
- With caching (5 min): ~3,000 API calls = $0.12
- **Savings**: $39.88/month (99.7% reduction)

## Security Considerations

1. **Encryption**: All secrets encrypted with customer-managed KMS keys
2. **Access Control**: Least privilege IAM policies
3. **Audit Logging**: All access logged to CloudTrail
4. **Network Security**: Secrets Manager uses VPC endpoints (optional)
5. **Compliance**: HIPAA-eligible service
6. **Key Rotation**: Automatic KMS key rotation enabled

## References

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-secrets-manager/)
- [Boto3 Secrets Manager](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/secretsmanager.html)
- [VaidyaLink Security Documentation](./ENCRYPTION_README.md)
