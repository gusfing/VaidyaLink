# Request Signing Quick Start

Get request signing working in 5 minutes.

## 1. Backend Setup (Node.js Lambda)

```javascript
// handler.js
const { createSignatureMiddleware } = require('@vaidyalink/request-signing');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

async function getSigningSecret(event) {
  const userId = event.requestContext?.authorizer?.claims?.sub;
  const command = new GetSecretValueCommand({
    SecretId: `vaidyalink/signing-secrets/${userId}`,
  });
  const response = await secretsClient.send(command);
  const secret = JSON.parse(response.SecretString);
  return secret.signingKey;
}

const verifySignature = createSignatureMiddleware({
  getSecret: getSigningSecret,
  maxAgeSeconds: 300,
  sensitiveOperations: ['/delete', '/update', '/export'],
});

exports.deletePatient = async (event) => {
  // Verify signature
  const verification = await verifySignature(event);
  if (verification.statusCode) return verification;

  // Your logic here
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
```

## 2. Backend Setup (Python Lambda)

```python
# handler.py
from request_signing import create_signature_middleware
import boto3
import json

secrets_client = boto3.client('secretsmanager')

def get_signing_secret(event):
    user_id = event['requestContext']['authorizer']['claims']['sub']
    response = secrets_client.get_secret_value(
        SecretId=f'vaidyalink/signing-secrets/{user_id}'
    )
    secret = json.loads(response['SecretString'])
    return secret['signingKey']

verify_signature = create_signature_middleware(
    get_secret=get_signing_secret,
    max_age_seconds=300,
    sensitive_operations=['/delete', '/update', '/export']
)

async def delete_patient(event, context):
    # Verify signature
    verification = await verify_signature(event)
    if 'statusCode' in verification:
        return verification

    # Your logic here
    return {'statusCode': 200, 'body': json.dumps({'success': True})}
```

## 3. Frontend Setup

The API client automatically signs sensitive requests:

```typescript
// No changes needed - automatic signing is enabled
import apiClient from '@/lib/api/client';

// This will be automatically signed
await apiClient.delete('/api/v1/patients/123/delete');
```

## 4. Secret Management

### Generate Secret

```javascript
const crypto = require('crypto');
const secret = crypto.randomBytes(32).toString('hex');
```

### Store in Secrets Manager

```javascript
const { SecretsManagerClient, CreateSecretCommand } = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({ region: 'us-east-1' });
await client.send(
  new CreateSecretCommand({
    Name: `vaidyalink/signing-secrets/${userId}`,
    SecretString: JSON.stringify({ signingKey: secret }),
  })
);
```

### Provide to Frontend

After authentication, send the secret to the client:

```javascript
// Backend: Include in auth response
return {
  statusCode: 200,
  body: JSON.stringify({
    tokens: {
      /* ... */
    },
    signingSecret: secret,
  }),
};
```

```typescript
// Frontend: Store after login
import { storeUserSigningSecret } from '@/lib/api/request-signing';

const response = await login(credentials);
storeUserSigningSecret(response.signingSecret);
```

## 5. Test It

```bash
# Node.js
cd backend/shared/nodejs/request-signing
npm test

# Python
cd backend/shared/python/request_signing
pytest test_request_signing.py
```

## Sensitive Operations

These operations require signing by default:

- `/delete` - Delete operations
- `/update` - Update operations
- `/export` - Data export
- `/abdm/consent` - ABDM consent management
- `/patients/merge` - Patient record merging

## Common Issues

### "MISSING_SIGNATURE" Error

- Ensure frontend has signing secret stored
- Check that operation path matches sensitive operations list

### "INVALID_SIGNATURE" Error

- Verify client and server use same secret
- Check system clocks are synchronized

### "REQUEST_EXPIRED" Error

- Increase `maxAgeSeconds` if needed
- Check for network latency issues

## Next Steps

- Read [REQUEST_SIGNING_GUIDE.md](./REQUEST_SIGNING_GUIDE.md) for detailed documentation
- Implement secret rotation
- Add CloudWatch monitoring
- Configure audit logging
