# Security Headers Middleware

Comprehensive security headers middleware for AWS Lambda functions that implements OWASP security best practices and HIPAA compliance requirements.

## Overview

This middleware automatically adds essential security headers to all HTTP responses from your Lambda functions, protecting against common web vulnerabilities including:

- **Clickjacking** (X-Frame-Options)
- **MIME type sniffing** (X-Content-Type-Options)
- **Cross-Site Scripting (XSS)** (X-XSS-Protection, Content-Security-Policy)
- **Man-in-the-Middle attacks** (Strict-Transport-Security)
- **Information leakage** (Referrer-Policy)
- **Unauthorized feature access** (Permissions-Policy)

## Installation

The middleware is available as part of the shared middleware module:

```bash
cd backend/your-lambda
npm install ../../shared/nodejs/middleware
```

## Quick Start

### Using the Decorator Pattern (Recommended)

```javascript
const { withSecurityHeaders } = require('@vaidyalink/middleware');

exports.handler = withSecurityHeaders(async (event) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Success' }),
  };
});
```

### Manual Application

```javascript
const { createSecurityHeadersMiddleware } = require('@vaidyalink/middleware');

const applyHeaders = createSecurityHeadersMiddleware();

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Success' }),
  };

  return applyHeaders(response);
};
```

## Default Security Headers

The middleware applies the following headers by default:

| Header                      | Value                                          | Purpose                               |
| --------------------------- | ---------------------------------------------- | ------------------------------------- |
| `X-Content-Type-Options`    | `nosniff`                                      | Prevents MIME type sniffing           |
| `X-Frame-Options`           | `DENY`                                         | Prevents clickjacking attacks         |
| `X-XSS-Protection`          | `1; mode=block`                                | Enables XSS filter in legacy browsers |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Enforces HTTPS for 1 year             |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Controls referrer information         |
| `Content-Security-Policy`   | Restrictive policy                             | Prevents XSS and data injection       |
| `Permissions-Policy`        | Restrictive policy                             | Controls browser features             |

## Configuration Presets

### Strict Preset (HIPAA Compliance)

Use for handlers dealing with Protected Health Information (PHI):

```javascript
const { withSecurityHeaders, getPreset } = require('@vaidyalink/middleware');

exports.handler = withSecurityHeaders(async (event) => {
  // Handle PHI data
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientData: {} }),
  };
}, getPreset('strict'));
```

**Strict preset features:**

- HSTS with 2-year max-age
- `Referrer-Policy: no-referrer`
- Highly restrictive CSP
- Minimal permissions policy

### API Preset

Use for REST API endpoints that don't serve HTML:

```javascript
exports.handler = withSecurityHeaders(async (event) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [] }),
  };
}, getPreset('api'));
```

**API preset features:**

- Simplified CSP for JSON responses
- Essential security headers only
- No HTML-specific protections

### Development Preset

Use for local development and testing:

```javascript
exports.handler = withSecurityHeaders(async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Dev mode' }),
  };
}, getPreset('development'));
```

**Development preset features:**

- Relaxed policies for easier debugging
- `X-Frame-Options: SAMEORIGIN`
- No HSTS enforcement

## Custom Configuration

### Override Specific Headers

```javascript
const { withSecurityHeaders } = require('@vaidyalink/middleware');

exports.handler = withSecurityHeaders(
  async (event) => {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Custom config' }),
    };
  },
  {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.example.com",
      'X-Custom-Header': 'custom-value',
    },
  }
);
```

### Disable Header Overwriting

Preserve existing headers in the response:

```javascript
const { withSecurityHeaders } = require('@vaidyalink/middleware');

exports.handler = withSecurityHeaders(
  async (event) => {
    return {
      statusCode: 200,
      headers: {
        'X-Frame-Options': 'SAMEORIGIN', // This will be preserved
      },
      body: JSON.stringify({ message: 'No overwrite' }),
    };
  },
  {
    overwrite: false,
  }
);
```

## Advanced Usage

### Combining with Authentication Middleware

```javascript
const { createAuthMiddleware } = require('@vaidyalink/middleware');
const { withSecurityHeaders } = require('@vaidyalink/middleware');

const authMiddleware = createAuthMiddleware();

exports.handler = withSecurityHeaders(async (event) => {
  // Authenticate first
  const authResult = await authMiddleware(event);

  if (!authResult.authorized) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: authResult.error }),
    };
  }

  // Process authenticated request
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: event.user }),
  };
});
```

### Dynamic Header Configuration

```javascript
const { SecurityHeadersMiddleware } = require('@vaidyalink/middleware');

const middleware = new SecurityHeadersMiddleware();

// Modify headers based on environment
if (process.env.ENVIRONMENT === 'production') {
  middleware.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
} else {
  middleware.removeHeader('Strict-Transport-Security');
}

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({ message: 'Dynamic config' }),
  };

  return middleware.apply(response);
};
```

### Error Handling

The decorator automatically applies headers to error responses:

```javascript
exports.handler = withSecurityHeaders(async (event) => {
  try {
    // Your logic here
    throw new Error('Something went wrong');
  } catch (error) {
    // Headers will still be applied
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
});
```

## Security Headers Explained

### Content-Security-Policy (CSP)

Controls which resources the browser can load:

```javascript
'Content-Security-Policy': [
  "default-src 'self'",           // Only load resources from same origin
  "script-src 'self'",            // Only execute scripts from same origin
  "style-src 'self' 'unsafe-inline'", // Allow inline styles (use sparingly)
  "img-src 'self' data: https:",  // Allow images from same origin, data URIs, HTTPS
  "connect-src 'self'",           // Only connect to same origin
  "frame-ancestors 'none'",       // Prevent embedding in frames
  "base-uri 'self'",              // Restrict base tag URLs
  "form-action 'self'"            // Only submit forms to same origin
].join('; ')
```

### Strict-Transport-Security (HSTS)

Forces browsers to use HTTPS:

```javascript
'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
```

- `max-age=31536000`: Enforce HTTPS for 1 year (31536000 seconds)
- `includeSubDomains`: Apply to all subdomains
- `preload`: Allow inclusion in browser HSTS preload lists

### Permissions-Policy

Controls browser features and APIs:

```javascript
'Permissions-Policy': [
  'geolocation=()',      // Disable geolocation
  'microphone=()',       // Disable microphone
  'camera=()',           // Disable camera
  'payment=()',          // Disable payment APIs
  'usb=()'              // Disable USB access
].join(', ')
```

## Testing

Run the test suite:

```bash
cd backend/shared/nodejs/middleware
npm test
```

Run with coverage:

```bash
npm run test:coverage
```

## Best Practices

### 1. Use Strict Preset for PHI Data

Always use the strict preset when handling Protected Health Information:

```javascript
exports.patientDataHandler = withSecurityHeaders(async (event) => {
  /* ... */
}, getPreset('strict'));
```

### 2. Customize CSP for Your Needs

Adjust Content-Security-Policy based on your actual resource requirements:

```javascript
{
  headers: {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' https://trusted-cdn.com",
      "connect-src 'self' https://api.vaidyalink.com"
    ].join('; ')
  }
}
```

### 3. Add Cache-Control for Sensitive Data

Combine security headers with cache control:

```javascript
return {
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  },
  body: JSON.stringify(sensitiveData),
};
```

### 4. Test Headers in Development

Verify headers are applied correctly:

```bash
curl -I https://api.vaidyalink.com/endpoint
```

### 5. Monitor CSP Violations

Use CSP reporting to detect policy violations:

```javascript
'Content-Security-Policy': "default-src 'self'; report-uri https://csp-report.vaidyalink.com"
```

## Troubleshooting

### Headers Not Applied

Ensure you're returning a proper response object:

```javascript
// ✅ Correct
return {
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data }),
};

// ❌ Incorrect
return { data }; // Missing statusCode and headers
```

### CSP Blocking Resources

If legitimate resources are blocked, adjust your CSP:

```javascript
{
  headers: {
    'Content-Security-Policy': "default-src 'self'; img-src 'self' https://trusted-images.com"
  }
}
```

### HSTS Issues in Development

Use the development preset or disable HSTS locally:

```javascript
const config =
  process.env.NODE_ENV === 'production' ? getPreset('strict') : getPreset('development');

exports.handler = withSecurityHeaders(handler, config);
```

## Environment Variables

No environment variables required. Configuration is done through code.

## Performance

- **Overhead**: < 1ms per request
- **Memory**: Minimal (headers cached in memory)
- **Cold Start**: No impact

## Compliance

### HIPAA

The strict preset meets HIPAA Security Rule requirements for:

- Data in transit protection (HSTS)
- Access controls (CSP, Permissions-Policy)
- Audit controls (combined with CloudTrail)

### OWASP

Implements OWASP Top 10 protections:

- A03:2021 – Injection (CSP)
- A05:2021 – Security Misconfiguration (Security headers)
- A07:2021 – Identification and Authentication Failures (Combined with auth middleware)

## Related Middleware

- [Authentication Middleware](./README.md) - JWT token validation
- [RBAC Middleware](./rbac.js) - Role-based access control
- [Rate Limiting](../rate-limiter/README.md) - Request rate limiting

## Support

For issues or questions:

1. Check the [examples](./examples/security-headers-example.js)
2. Review the [test suite](./__tests__/security-headers.test.js)
3. Consult the VaidyaLink security documentation

## License

Private - VaidyaLink Internal Use Only
