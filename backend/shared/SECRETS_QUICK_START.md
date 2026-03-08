# AWS Secrets Manager Quick Start

## 1. Deploy Infrastructure

```bash
cd infrastructure
npm run deploy -- --all
```

This creates:

- KMS encryption key for secrets
- 5 pre-configured secrets with placeholder values
- IAM policies for Lambda access

## 2. Update Secret Values

### Via AWS Console

1. Go to AWS Secrets Manager console
2. Search for `vaidyalink/dev/abdm/api-credentials`
3. Click "Retrieve secret value" → "Edit"
4. Update the JSON with real credentials
5. Click "Save"

### Via AWS CLI

```bash
# Update ABDM credentials
aws secretsmanager update-secret \
  --secret-id vaidyalink/dev/abdm/api-credentials \
  --secret-string '{
    "clientId": "your-real-client-id",
    "clientSecret": "your-real-client-secret",
    "apiBaseUrl": "https://dev.abdm.gov.in",
    "facilityId": "your-facility-id"
  }'

# Update Bhashini credentials
aws secretsmanager update-secret \
  --secret-id vaidyalink/dev/bhashini/api-credentials \
  --secret-string '{
    "apiKey": "your-real-api-key",
    "apiBaseUrl": "https://api.bhashini.gov.in",
    "userId": "your-user-id"
  }'
```

## 3. Use in Lambda Functions

### Node.js

```javascript
const { getInstance } = require('@vaidyalink/secrets-manager');

exports.handler = async (event) => {
  const secretsManager = getInstance();

  // Get credentials
  const abdmCreds = await secretsManager.getABDMCredentials();

  // Use them
  const response = await fetch(`${abdmCreds.apiBaseUrl}/v1/auth`, {
    headers: {
      Authorization: `Bearer ${abdmCreds.clientSecret}`,
    },
  });

  return { statusCode: 200, body: 'Success' };
};
```

### Python

```python
from secrets_manager import get_instance

def handler(event, context):
    secrets_manager = get_instance()

    # Get credentials
    abdm_creds = secrets_manager.get_abdm_credentials()

    # Use them
    response = requests.get(
        f"{abdm_creds['apiBaseUrl']}/v1/auth",
        headers={'Authorization': f"Bearer {abdm_creds['clientSecret']}"}
    )

    return {'statusCode': 200, 'body': 'Success'}
```

## 4. Grant Lambda Access

In your CDK stack:

```typescript
import { SecretsManagerConstruct } from './constructs/secrets-manager';

// Create secrets
const secretsManager = new SecretsManagerConstruct(this, 'Secrets', {
  environment: 'dev',
  encryptionKey: security.secretsEncryptionKey,
});

// Grant Lambda access
secretsManager.grantRead('abdm', abdmLambda);
secretsManager.grantRead('bhashini', voiceLambda);
secretsManager.grantReadMultiple(['abdm', 'bedrock'], documentLambda);
```

## 5. Test Locally

```bash
# Set environment variable
export ENVIRONMENT=dev

# Run Lambda locally
sam local invoke MyFunction
```

## Available Secrets

| Secret Name                                 | Purpose              | Helper Method              |
| ------------------------------------------- | -------------------- | -------------------------- |
| `vaidyalink/{env}/abdm/api-credentials`     | ABDM API access      | `getABDMCredentials()`     |
| `vaidyalink/{env}/bhashini/api-credentials` | Bhashini API access  | `getBhashiniCredentials()` |
| `vaidyalink/{env}/bedrock/config`           | Bedrock model config | `getBedrockConfig()`       |
| `vaidyalink/{env}/database/credentials`     | Database access      | `getDatabaseCredentials()` |
| `vaidyalink/{env}/jwt/signing-key`          | JWT signing          | `getJWTSigningSecret()`    |

## Common Operations

### Force Refresh Secret

```javascript
// Node.js
const secret = await secretsManager.getSecret('my-secret', true);

// Python
secret = secrets_manager.get_secret('my-secret', (force_refresh = True));
```

### Clear Cache

```javascript
// Node.js
secretsManager.clearCache(); // Clear all

// Python
secrets_manager.clear_cache()  # Clear all
```

### Batch Get Secrets

```javascript
// Node.js
const secrets = await secretsManager.getSecrets([
  'vaidyalink/dev/abdm/api-credentials',
  'vaidyalink/dev/bhashini/api-credentials',
]);

// Python
secrets = secrets_manager.get_secrets([
  'vaidyalink/dev/abdm/api-credentials',
  'vaidyalink/dev/bhashini/api-credentials',
]);
```

## Troubleshooting

### "Secret not found"

- Check `ENVIRONMENT` env var is set
- Verify secret exists in AWS console
- Confirm secret name matches pattern

### "Access denied"

- Check Lambda execution role has `secretsmanager:GetSecretValue` permission
- Verify KMS key policy allows Lambda role to decrypt

### "Secret not updating"

- Cache TTL is 5 minutes by default
- Force refresh or clear cache
- Restart Lambda (cold start)

## Next Steps

- Read full guide: [SECRETS_MANAGER_GUIDE.md](./SECRETS_MANAGER_GUIDE.md)
- See examples: `backend/shared/nodejs/secrets/examples/`
- Configure rotation: [AWS Secrets Manager Rotation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
