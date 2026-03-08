# VaidyaLink Request Signing

HMAC-SHA256 request signing for sensitive operations to prevent replay attacks and ensure request integrity.

## Installation

```bash
npm install @vaidyalink/request-signing
```

## Quick Start

```javascript
const { createSignatureMiddleware } = require('@vaidyalink/request-signing');

// Create middleware
const verifySignature = createSignatureMiddleware({
  getSecret: async (event) => {
    // Retrieve signing secret for user
    return 'user-signing-secret';
  },
  maxAgeSeconds: 300,
  sensitiveOperations: ['/delete', '/update'],
});

// Use in Lambda handler
exports.handler = async (event) => {
  const verification = await verifySignature(event);

  if (verification.statusCode) {
    return verification; // Return error
  }

  // Process request
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
```

## API

### `generateSignature(params)`

Generate HMAC-SHA256 signature for a request.

**Parameters:**

- `method` (string): HTTP method (GET, POST, etc.)
- `path` (string): Request path
- `headers` (object): Request headers
- `body` (string|object): Request body
- `secret` (string): Signing secret
- `timestamp` (number): Unix timestamp in seconds

**Returns:** Hex-encoded signature string

**Example:**

```javascript
const signature = generateSignature({
  method: 'POST',
  path: '/api/v1/patients/delete',
  headers: {},
  body: { patientId: '123' },
  secret: 'my-secret',
  timestamp: Math.floor(Date.now() / 1000),
});
```

### `verifySignature(params)`

Verify a request signature.

**Parameters:**

- `method` (string): HTTP method
- `path` (string): Request path
- `headers` (object): Request headers
- `body` (string|object): Request body
- `secret` (string): Signing secret
- `providedSignature` (string): Signature from request
- `providedTimestamp` (number): Timestamp from request
- `maxAgeSeconds` (number, optional): Maximum request age (default: 300)

**Returns:** Verification result object

```javascript
{
  valid: boolean,
  error?: string,
  message?: string
}
```

**Example:**

```javascript
const result = verifySignature({
  method: 'POST',
  path: '/api/v1/test',
  headers: {},
  body: { data: 'value' },
  secret: 'my-secret',
  providedSignature: 'abc123...',
  providedTimestamp: 1234567890,
  maxAgeSeconds: 300,
});

if (result.valid) {
  console.log('Signature valid');
} else {
  console.error('Signature invalid:', result.error);
}
```

### `createSignatureMiddleware(options)`

Create middleware for Lambda to verify request signatures.

**Options:**

- `getSecret` (function, required): Function to retrieve signing secret
- `maxAgeSeconds` (number, optional): Maximum request age (default: 300)
- `sensitiveOperations` (string[], optional): Operations requiring signing

**Returns:** Middleware function

**Example:**

```javascript
const middleware = createSignatureMiddleware({
  getSecret: async (event) => {
    const userId = event.requestContext?.authorizer?.claims?.sub;
    return await getSecretFromSecretsManager(userId);
  },
  maxAgeSeconds: 300,
  sensitiveOperations: ['/delete', '/update', '/export'],
});
```

## Error Codes

- `MISSING_SIGNATURE`: Request missing signature headers
- `REQUEST_EXPIRED`: Request timestamp too old
- `TIMESTAMP_FUTURE`: Request timestamp in the future
- `INVALID_SIGNATURE`: Signature verification failed
- `INTERNAL_ERROR`: Error retrieving secret or processing request

## Security Features

- **HMAC-SHA256**: Industry-standard cryptographic signing
- **Constant-Time Comparison**: Prevents timing attacks
- **Timestamp Validation**: Prevents replay attacks
- **Configurable Expiry**: Adjustable request age limits

## Testing

```bash
npm test
```

## Examples

See [examples/lambda-handler-example.js](./examples/lambda-handler-example.js) for complete Lambda implementation.

## Documentation

- [Quick Start Guide](../../REQUEST_SIGNING_QUICK_START.md)
- [Implementation Guide](../../REQUEST_SIGNING_GUIDE.md)

## License

MIT
