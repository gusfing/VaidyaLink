# Security Headers Middleware - Quick Start Guide

Get started with security headers middleware in 5 minutes.

## What is it?

Security headers middleware automatically adds essential HTTP security headers to all Lambda responses, protecting against:

- Clickjacking attacks
- XSS (Cross-Site Scripting)
- MIME type sniffing
- Man-in-the-Middle attacks
- Information leakage

## Installation

### Node.js

```bash
cd backend/your-lambda
npm install ../../shared/nodejs/middleware
```

### Python

```bash
cd backend/your-lambda
pip install -r ../../shared/python/middleware/requirements.txt
```

## Basic Usage

### Node.js

```javascript
const { withSecurityHeaders } = require('@vaidyalink/middleware');

exports.handler = withSecurityHeaders(async (event) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Success' }),
  };
});
```

### Python

```python
from middleware.security_headers import with_security_headers
import json

@with_security_headers()
def handler(event, context):
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'message': 'Success'})
    }
```

## Common Scenarios

### 1. API Endpoints (JSON only)

**Node.js:**

```javascript
const { withSecurityHeaders, getPreset } = require('@vaidyalink/middleware');

exports.handler = withSecurityHeaders(async (event) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [] }),
  };
}, getPreset('api'));
```

**Python:**

```python
from middleware.security_headers import with_security_headers, get_preset

@with_security_headers(get_preset('api'))
def handler(event, context):
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'data': []})
    }
```

### 2. Healthcare/PHI Data (HIPAA Compliance)

**Node.js:**

```javascript
const { withSecurityHeaders, getPreset } = require('@vaidyalink/middleware');

exports.handler = withSecurityHeaders(async (event) => {
  const patientData = {
    /* PHI data */
  };
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
    },
    body: JSON.stringify(patientData),
  };
}, getPreset('strict'));
```

**Python:**

```python
from middleware.security_headers import with_security_headers, get_preset

@with_security_headers(get_preset('strict'))
def handler(event, context):
    patient_data = {}  # PHI data
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, private'
        },
        'body': json.dumps(patient_data)
    }
```

### 3. With Authentication

**Node.js:**

```javascript
const { createAuthMiddleware } = require('@vaidyalink/middleware');
const { withSecurityHeaders } = require('@vaidyalink/middleware');

const authMiddleware = createAuthMiddleware();

exports.handler = withSecurityHeaders(async (event) => {
  const authResult = await authMiddleware(event);

  if (!authResult.authorized) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: authResult.error }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: event.user }),
  };
});
```

**Python:**

```python
from middleware.auth import create_auth_middleware
from middleware.security_headers import with_security_headers

auth_middleware = create_auth_middleware()

@with_security_headers()
def handler(event, context):
    auth_result = auth_middleware(event)

    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': auth_result['error']})
        }

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'user': event['user']})
    }
```

## Available Presets

| Preset        | Use Case                              | Security Level |
| ------------- | ------------------------------------- | -------------- |
| `strict`      | PHI/Healthcare data, HIPAA compliance | Maximum        |
| `api`         | REST API endpoints (JSON only)        | High           |
| `development` | Local development and testing         | Moderate       |

## Headers Applied

All presets include these core headers:

- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-Frame-Options: DENY`
- ✅ `Strict-Transport-Security` (HSTS)
- ✅ `Content-Security-Policy` (CSP)
- ✅ `Referrer-Policy`
- ✅ `Permissions-Policy`

## Testing

Verify headers are applied:

```bash
curl -I https://your-api.execute-api.ap-south-1.amazonaws.com/prod/endpoint
```

Expected output:

```
HTTP/2 200
x-content-type-options: nosniff
x-frame-options: DENY
strict-transport-security: max-age=31536000; includeSubDomains; preload
referrer-policy: strict-origin-when-cross-origin
content-security-policy: default-src 'self'; ...
permissions-policy: geolocation=(), microphone=(), ...
```

## Custom Configuration

Override specific headers:

**Node.js:**

```javascript
exports.handler = withSecurityHeaders(
  async (event) => {
    /* ... */
  },
  {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.example.com",
    },
  }
);
```

**Python:**

```python
@with_security_headers({
    'headers': {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.example.com"
    }
})
def handler(event, context):
    pass
```

## Best Practices

1. **Always use `strict` preset for PHI data**

   ```javascript
   getPreset('strict'); // For patient records, medical data
   ```

2. **Add Cache-Control for sensitive data**

   ```javascript
   headers: {
     'Cache-Control': 'no-store, no-cache, must-revalidate, private'
   }
   ```

3. **Test in development first**

   ```javascript
   const preset =
     process.env.NODE_ENV === 'production' ? getPreset('strict') : getPreset('development');
   ```

4. **Combine with authentication**
   - Always authenticate before processing requests
   - Security headers protect the response, auth protects the endpoint

## Troubleshooting

### Headers not showing up?

Check your response format:

```javascript
// ✅ Correct
return {
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data }),
};

// ❌ Wrong
return { data }; // Missing statusCode and headers
```

### CSP blocking resources?

Adjust your Content-Security-Policy:

```javascript
{
  headers: {
    'Content-Security-Policy': "default-src 'self'; img-src 'self' https://trusted-cdn.com"
  }
}
```

## Next Steps

- 📖 Read the full documentation:
  - [Node.js Documentation](./nodejs/middleware/SECURITY_HEADERS.md)
  - [Python Documentation](./python/middleware/SECURITY_HEADERS.md)
- 🔍 Check out examples:
  - [Node.js Examples](./nodejs/middleware/examples/security-headers-example.js)
  - [Python Examples](./python/middleware/examples/security_headers_example.py)
- 🧪 Review tests:
  - [Node.js Tests](./nodejs/middleware/__tests__/security-headers.test.js)
  - [Python Tests](./python/middleware/test_security_headers.py)

## Support

For questions or issues:

1. Check the examples in the `examples/` directory
2. Review the test files for usage patterns
3. Consult the full documentation

## Compliance

- ✅ HIPAA Security Rule compliant (with `strict` preset)
- ✅ OWASP Top 10 protections
- ✅ Industry best practices for HTTP security headers
