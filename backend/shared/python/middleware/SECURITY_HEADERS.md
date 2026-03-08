# Security Headers Middleware (Python)

Comprehensive security headers middleware for AWS Lambda functions (Python) that implements OWASP security best practices and HIPAA compliance requirements.

## Overview

This middleware automatically adds essential security headers to all HTTP responses from your Lambda functions, protecting against common web vulnerabilities.

## Installation

```bash
pip install -r requirements.txt
```

No additional dependencies required beyond the existing middleware requirements.

## Quick Start

### Using the Decorator Pattern (Recommended)

```python
from middleware.security_headers import with_security_headers
import json

@with_security_headers()
def handler(event, context):
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'message': 'Success'})
    }
```

### Manual Application

```python
from middleware.security_headers import create_security_headers_middleware
import json

apply_headers = create_security_headers_middleware()

def handler(event, context):
    response = {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'message': 'Success'})
    }

    return apply_headers(response)
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

```python
from middleware.security_headers import with_security_headers, get_preset
import json

@with_security_headers(get_preset('strict'))
def handler(event, context):
    # Handle PHI data
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'patientData': {}})
    }
```

**Strict preset features:**

- HSTS with 2-year max-age
- `Referrer-Policy: no-referrer`
- Highly restrictive CSP
- Minimal permissions policy

### API Preset

Use for REST API endpoints that don't serve HTML:

```python
@with_security_headers(get_preset('api'))
def handler(event, context):
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'data': []})
    }
```

**API preset features:**

- Simplified CSP for JSON responses
- Essential security headers only
- No HTML-specific protections

### Development Preset

Use for local development and testing:

```python
@with_security_headers(get_preset('development'))
def handler(event, context):
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Dev mode'})
    }
```

**Development preset features:**

- Relaxed policies for easier debugging
- `X-Frame-Options: SAMEORIGIN`
- No HSTS enforcement

## Custom Configuration

### Override Specific Headers

```python
from middleware.security_headers import with_security_headers
import json

@with_security_headers({
    'headers': {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.example.com",
        'X-Custom-Header': 'custom-value'
    }
})
def handler(event, context):
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Custom config'})
    }
```

### Disable Header Overwriting

Preserve existing headers in the response:

```python
@with_security_headers({'overwrite': False})
def handler(event, context):
    return {
        'statusCode': 200,
        'headers': {
            'X-Frame-Options': 'SAMEORIGIN'  # This will be preserved
        },
        'body': json.dumps({'message': 'No overwrite'})
    }
```

## Advanced Usage

### Combining with Authentication Middleware

```python
from middleware.auth import create_auth_middleware
from middleware.security_headers import with_security_headers
import json

auth_middleware = create_auth_middleware()

@with_security_headers()
def handler(event, context):
    # Authenticate first
    auth_result = auth_middleware(event)

    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': auth_result['error']})
        }

    # Process authenticated request
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'user': event['user']})
    }
```

### Dynamic Header Configuration

```python
from middleware.security_headers import SecurityHeadersMiddleware
import os
import json

middleware = SecurityHeadersMiddleware()

# Modify headers based on environment
if os.environ.get('ENVIRONMENT') == 'production':
    middleware.set_header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
else:
    middleware.remove_header('Strict-Transport-Security')

def handler(event, context):
    response = {
        'statusCode': 200,
        'body': json.dumps({'message': 'Dynamic config'})
    }

    return middleware.apply(response)
```

### Error Handling

The decorator automatically applies headers to error responses:

```python
@with_security_headers()
def handler(event, context):
    try:
        # Your logic here
        raise Exception('Something went wrong')
    except Exception as error:
        # Headers will still be applied
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(error)})
        }
```

## Security Headers Explained

### Content-Security-Policy (CSP)

Controls which resources the browser can load:

```python
'Content-Security-Policy': '; '.join([
    "default-src 'self'",           # Only load resources from same origin
    "script-src 'self'",            # Only execute scripts from same origin
    "style-src 'self' 'unsafe-inline'", # Allow inline styles (use sparingly)
    "img-src 'self' data: https:",  # Allow images from same origin, data URIs, HTTPS
    "connect-src 'self'",           # Only connect to same origin
    "frame-ancestors 'none'",       # Prevent embedding in frames
    "base-uri 'self'",              # Restrict base tag URLs
    "form-action 'self'"            # Only submit forms to same origin
])
```

### Strict-Transport-Security (HSTS)

Forces browsers to use HTTPS:

```python
'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
```

- `max-age=31536000`: Enforce HTTPS for 1 year (31536000 seconds)
- `includeSubDomains`: Apply to all subdomains
- `preload`: Allow inclusion in browser HSTS preload lists

### Permissions-Policy

Controls browser features and APIs:

```python
'Permissions-Policy': ', '.join([
    'geolocation=()',      # Disable geolocation
    'microphone=()',       # Disable microphone
    'camera=()',           # Disable camera
    'payment=()',          # Disable payment APIs
    'usb=()'              # Disable USB access
])
```

## Testing

Run the test suite:

```bash
cd backend/shared/python/middleware
pytest test_security_headers.py -v
```

Run with coverage:

```bash
pytest test_security_headers.py --cov=security_headers --cov-report=html
```

## Best Practices

### 1. Use Strict Preset for PHI Data

Always use the strict preset when handling Protected Health Information:

```python
@with_security_headers(get_preset('strict'))
def patient_data_handler(event, context):
    # Handle PHI
    pass
```

### 2. Customize CSP for Your Needs

Adjust Content-Security-Policy based on your actual resource requirements:

```python
{
    'headers': {
        'Content-Security-Policy': '; '.join([
            "default-src 'self'",
            "script-src 'self' https://trusted-cdn.com",
            "connect-src 'self' https://api.vaidyalink.com"
        ])
    }
}
```

### 3. Add Cache-Control for Sensitive Data

Combine security headers with cache control:

```python
return {
    'statusCode': 200,
    'headers': {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private'
    },
    'body': json.dumps(sensitive_data)
}
```

### 4. Test Headers in Development

Verify headers are applied correctly:

```bash
curl -I https://api.vaidyalink.com/endpoint
```

### 5. Monitor CSP Violations

Use CSP reporting to detect policy violations:

```python
'Content-Security-Policy': "default-src 'self'; report-uri https://csp-report.vaidyalink.com"
```

## Troubleshooting

### Headers Not Applied

Ensure you're returning a proper response dictionary:

```python
# ✅ Correct
return {
    'statusCode': 200,
    'headers': {'Content-Type': 'application/json'},
    'body': json.dumps({'data': data})
}

# ❌ Incorrect
return {'data': data}  # Missing statusCode and headers
```

### CSP Blocking Resources

If legitimate resources are blocked, adjust your CSP:

```python
{
    'headers': {
        'Content-Security-Policy': "default-src 'self'; img-src 'self' https://trusted-images.com"
    }
}
```

### HSTS Issues in Development

Use the development preset or disable HSTS locally:

```python
import os

config = get_preset('strict') if os.environ.get('ENV') == 'production' else get_preset('development')

@with_security_headers(config)
def handler(event, context):
    pass
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
- [RBAC Middleware](./rbac.py) - Role-based access control

## Support

For issues or questions:

1. Check the [examples](./examples/security_headers_example.py)
2. Review the [test suite](./test_security_headers.py)
3. Consult the VaidyaLink security documentation

## License

Private - VaidyaLink Internal Use Only
