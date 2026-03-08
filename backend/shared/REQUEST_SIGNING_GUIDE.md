# Request Signing Implementation Guide

## Overview

Request signing provides an additional layer of security for sensitive operations in VaidyaLink by ensuring:

1. **Request Integrity**: The request hasn't been tampered with in transit
2. **Replay Attack Prevention**: Requests can't be captured and replayed later
3. **Authentication**: The request comes from a legitimate client with the correct secret

## How It Works

### Signature Generation

1. **Canonical String**: Create a standardized representation of the request

   ```
   METHOD\n
   PATH\n
   TIMESTAMP\n
   BODY
   ```

2. **HMAC-SHA256**: Generate signature using the canonical string and a shared secret

   ```
   signature = HMAC-SHA256(secret, canonical_string)
   ```

3. **Headers**: Include signature and timestamp in request headers
   ```
   X-VaidyaLink-Signature: <hex_signature>
   X-VaidyaLink-Timestamp: <unix_timestamp>
   ```

### Signature Verification

1. **Timestamp Check**: Verify request is not expired (default: 5 minutes)
2. **Signature Regeneration**: Generate expected signature using same algorithm
3. **Constant-Time Comparison**: Compare signatures to prevent timing attacks

## Backend Implementation

### Node.js Lambda

```javascript
const { createSignatureMiddleware } = require('@vaidyalink/request-signing');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

async function getSigningSecret(event) {
  const userId = event.requestContext?.authorizer?.claims?.sub;
  const secretName = `vaidyalink/signing-secrets/${userId}`;

  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await secretsClient.send(command);

  const secret = JSON.parse(response.SecretString);
  return secret.signingKey;
}

const verifySignature = createSignatureMiddleware({
  getSecret: getSigningSecret,
  maxAgeSeconds: 300,
  sensitiveOperations: ['/delete', '/update', '/export'],
});

exports.handler = async (event) => {
  // Verify signature
  const verification = await verifySignature(event);

  if (verification.statusCode) {
    return verification; // Return error response
  }

  // Process request
  // ...
};
```

### Python Lambda

```python
from request_signing import create_signature_middleware
import boto3
import json

secrets_client = boto3.client('secretsmanager')

def get_signing_secret(event):
    user_id = event['requestContext']['authorizer']['claims']['sub']
    secret_name = f'vaidyalink/signing-secrets/{user_id}'

    response = secrets_client.get_secret_value(SecretId=secret_name)
    secret = json.loads(response['SecretString'])
    return secret['signingKey']

verify_signature = create_signature_middleware(
    get_secret=get_signing_secret,
    max_age_seconds=300,
    sensitive_operations=['/delete', '/update', '/export']
)

async def handler(event, context):
    # Verify signature
    verification = await verify_signature(event)

    if 'statusCode' in verification:
        return verification  # Return error response

    # Process request
    # ...
```

## Frontend Implementation

### Automatic Signing

The API client automatically signs requests to sensitive endpoints:

```typescript
import apiClient from '@/lib/api/client';

// This request will be automatically signed
await apiClient.delete('/api/v1/patients/123/delete');

// This request will also be signed
await apiClient.post('/api/v1/patients/123/export', {
  format: 'json',
});
```

### Manual Signing

For custom implementations:

```typescript
import { generateSignedHeaders, getUserSigningSecret } from '@/lib/api/request-signing';

const secret = await getUserSigningSecret();
const headers = generateSignedHeaders({
  method: 'DELETE',
  path: '/api/v1/patients/123/delete',
  body: { reason: 'Patient request' },
  secret,
});

// Use headers in request
fetch(url, {
  method: 'DELETE',
  headers: {
    ...headers,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ reason: 'Patient request' }),
});
```

## Sensitive Operations

The following operations require request signing:

- **Patient Data Deletion**: `/delete`
- **Patient Data Updates**: `/update`
- **Data Export**: `/export`
- **ABDM Consent Management**: `/abdm/consent`
- **Patient Record Merging**: `/patients/merge`

## Secret Management

### Secret Generation

Generate a unique signing secret for each user during registration:

```javascript
const crypto = require('crypto');

function generateSigningSecret() {
  return crypto.randomBytes(32).toString('hex');
}
```

### Secret Storage

Store secrets in AWS Secrets Manager:

```javascript
const { SecretsManagerClient, CreateSecretCommand } = require('@aws-sdk/client-secrets-manager');

async function storeSigningSecret(userId, secret) {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

  const command = new CreateSecretCommand({
    Name: `vaidyalink/signing-secrets/${userId}`,
    SecretString: JSON.stringify({
      signingKey: secret,
      createdAt: new Date().toISOString(),
    }),
    Tags: [
      { Key: 'Application', Value: 'VaidyaLink' },
      { Key: 'Purpose', Value: 'RequestSigning' },
    ],
  });

  await client.send(command);
}
```

### Secret Rotation

Implement periodic secret rotation:

```javascript
async function rotateSigningSecret(userId) {
  const newSecret = generateSigningSecret();

  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

  const command = new UpdateSecretCommand({
    SecretId: `vaidyalink/signing-secrets/${userId}`,
    SecretString: JSON.stringify({
      signingKey: newSecret,
      createdAt: new Date().toISOString(),
      rotatedAt: new Date().toISOString(),
    }),
  });

  await client.send(command);

  return newSecret;
}
```

## Security Considerations

### 1. Timestamp Validation

- **Max Age**: Default 300 seconds (5 minutes)
- **Future Tolerance**: 60 seconds to account for clock skew
- **Purpose**: Prevents replay attacks

### 2. Constant-Time Comparison

Both implementations use constant-time comparison to prevent timing attacks:

- **Node.js**: `crypto.timingSafeEqual()`
- **Python**: `hmac.compare_digest()`

### 3. Secret Protection

- Store secrets in AWS Secrets Manager
- Never log or expose secrets
- Rotate secrets periodically
- Use IAM policies to restrict access

### 4. HTTPS Only

Request signing should only be used over HTTPS to prevent:

- Secret exposure
- Man-in-the-middle attacks
- Request interception

## Error Handling

### Common Errors

1. **MISSING_SIGNATURE**: Request missing signature headers

   ```json
   {
     "error": "MISSING_SIGNATURE",
     "message": "Request signature and timestamp are required"
   }
   ```

2. **REQUEST_EXPIRED**: Request timestamp too old

   ```json
   {
     "error": "REQUEST_EXPIRED",
     "message": "Request expired. Age: 350s, Max: 300s"
   }
   ```

3. **TIMESTAMP_FUTURE**: Request timestamp in the future

   ```json
   {
     "error": "TIMESTAMP_FUTURE",
     "message": "Request timestamp is in the future"
   }
   ```

4. **INVALID_SIGNATURE**: Signature verification failed
   ```json
   {
     "error": "INVALID_SIGNATURE",
     "message": "Signature verification failed"
   }
   ```

### Client-Side Handling

```typescript
try {
  await apiClient.delete('/api/v1/patients/123/delete');
} catch (error) {
  if (error.response?.status === 401) {
    const errorData = error.response.data;

    if (errorData.error === 'REQUEST_EXPIRED') {
      // Retry request with new timestamp
      await apiClient.delete('/api/v1/patients/123/delete');
    } else if (errorData.error === 'INVALID_SIGNATURE') {
      // Re-authenticate to get new secret
      window.location.href = '/login';
    }
  }
}
```

## Testing

### Unit Tests

Both Node.js and Python implementations include comprehensive unit tests:

```bash
# Node.js
cd backend/shared/nodejs/request-signing
npm test

# Python
cd backend/shared/python/request_signing
pytest test_request_signing.py
```

### Integration Testing

Test end-to-end signing flow:

```javascript
describe('Request Signing Integration', () => {
  it('should sign and verify request', async () => {
    const secret = 'test-secret';
    const body = { data: 'value' };

    // Client generates signature
    const headers = generateSignedHeaders({
      method: 'POST',
      path: '/api/v1/test',
      body,
      secret,
    });

    // Server verifies signature
    const verification = verifySignature({
      method: 'POST',
      path: '/api/v1/test',
      body,
      secret,
      providedSignature: headers['X-VaidyaLink-Signature'],
      providedTimestamp: parseInt(headers['X-VaidyaLink-Timestamp']),
      maxAgeSeconds: 300,
    });

    expect(verification.valid).toBe(true);
  });
});
```

## Performance Considerations

### Overhead

- **Signature Generation**: ~1-2ms
- **Signature Verification**: ~1-2ms
- **Secret Retrieval**: ~50-100ms (cached after first request)

### Optimization

1. **Cache Secrets**: Cache retrieved secrets in Lambda memory
2. **Selective Signing**: Only sign truly sensitive operations
3. **Async Operations**: Use async/await for non-blocking execution

## Monitoring

### CloudWatch Metrics

Track signature verification metrics:

```javascript
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

async function recordSignatureMetric(success) {
  const client = new CloudWatchClient({ region: process.env.AWS_REGION });

  const command = new PutMetricDataCommand({
    Namespace: 'VaidyaLink/Security',
    MetricData: [
      {
        MetricName: 'SignatureVerification',
        Value: success ? 1 : 0,
        Unit: 'Count',
        Timestamp: new Date(),
      },
    ],
  });

  await client.send(command);
}
```

### Audit Logging

Log all signature verification attempts:

```javascript
console.log(
  JSON.stringify({
    event: 'signature_verification',
    success: verification.valid,
    error: verification.error,
    userId: event.requestContext?.authorizer?.claims?.sub,
    path: event.path,
    method: event.httpMethod,
    timestamp: new Date().toISOString(),
  })
);
```

## Compliance

Request signing helps meet compliance requirements:

- **HIPAA**: Ensures data integrity and prevents unauthorized access
- **ABDM**: Provides additional security for health data operations
- **Audit Trail**: All signed requests are logged for compliance

## Troubleshooting

### Issue: Signature Mismatch

**Symptoms**: All requests fail with INVALID_SIGNATURE

**Causes**:

- Client and server using different secrets
- Body serialization differences
- Clock skew between client and server

**Solutions**:

1. Verify secret retrieval on both sides
2. Ensure consistent JSON serialization
3. Check system clocks are synchronized

### Issue: Requests Expiring

**Symptoms**: Requests fail with REQUEST_EXPIRED

**Causes**:

- Network latency
- Client clock behind server
- Max age too restrictive

**Solutions**:

1. Increase maxAgeSeconds
2. Synchronize system clocks
3. Implement retry logic

## References

- [HMAC-SHA256 Specification](https://tools.ietf.org/html/rfc2104)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
