# CORS Configuration Guide

## Overview

This document describes the Cross-Origin Resource Sharing (CORS) configuration for VaidyaLink API Gateway. CORS is a security feature that controls which web applications can access the API from different domains.

## Architecture

### Components

1. **CorsConfig Construct** (`infrastructure/lib/constructs/cors.ts`)
   - Centralized CORS configuration management
   - Environment-specific origin whitelisting
   - Security header configuration

2. **API Gateway Integration** (`infrastructure/lib/constructs/api-gateway.ts`)
   - Automatic OPTIONS method handling
   - Preflight request caching
   - Response header injection

### Security Requirements

- **Task 6.3**: Configure CORS policies
- **Requirement 7**: Security and Privacy - Implement secure cross-origin access control

## Configuration

### Environment-Specific Origins

#### Production

```typescript
allowedOrigins: [
  'https://vaidyalink.com',
  'https://www.vaidyalink.com',
  'https://app.vaidyalink.com',
];
```

#### Staging

```typescript
allowedOrigins: ['https://staging.vaidyalink.com', 'https://staging-app.vaidyalink.com'];
```

#### Development

```typescript
allowedOrigins: [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'https://dev.vaidyalink.com',
];
```

### Allowed Headers

The following request headers are permitted:

- `Content-Type` - Request content type
- `Authorization` - JWT tokens from Cognito
- `X-Amz-Date` - AWS signature date
- `X-Api-Key` - API key for external integrations
- `X-Amz-Security-Token` - AWS temporary credentials
- `X-Amz-User-Agent` - AWS SDK user agent
- `X-Request-Id` - Request correlation ID
- `Accept` - Response content type preference
- `Accept-Language` - Language preference for multilingual support

### Exposed Headers

The following response headers are exposed to clients:

- `X-Request-Id` - Request correlation ID
- `X-Amzn-RequestId` - AWS request ID
- `X-Amzn-Trace-Id` - X-Ray trace ID
- `Content-Length` - Response size
- `Content-Type` - Response content type
- `Date` - Response timestamp

### Allowed Methods

- `GET` - Retrieve resources
- `POST` - Create resources
- `PUT` - Replace resources
- `PATCH` - Update resources
- `DELETE` - Remove resources
- `OPTIONS` - Preflight requests

### Preflight Cache

- **Max Age**: 3600 seconds (1 hour)
- **Credentials**: Enabled (allows cookies and authorization headers)

## Usage

### Basic Usage in CDK Stack

```typescript
import { ApiGatewayConstruct } from './constructs/api-gateway';

const apiGateway = new ApiGatewayConstruct(this, 'ApiGateway', {
  environment: 'production',
  userPool: userPool,
  // ... other props
  allowedOrigins: ['https://vaidyalink.com', 'https://app.vaidyalink.com'],
});
```

### Custom CORS Configuration

```typescript
import { CorsConfig } from './constructs/cors';

const customCors = CorsConfig.createRestApiCors(this, 'CustomCors', {
  environment: 'production',
  allowedOrigins: ['https://custom-domain.com'],
  maxAge: cdk.Duration.hours(2),
  allowCredentials: true,
});
```

### Lambda Response Headers

For Lambda functions that return custom responses:

```typescript
import { CorsConfig } from '../constructs/cors';

export const handler = async (event: APIGatewayProxyEvent) => {
  const origin = event.headers.origin || event.headers.Origin;

  return {
    statusCode: 200,
    headers: CorsConfig.getCorsResponseHeaders(origin),
    body: JSON.stringify({ message: 'Success' }),
  };
};
```

### Origin Validation in Lambda

```typescript
import { CorsConfig } from '../constructs/cors';

const allowedOrigins = ['https://vaidyalink.com', 'https://app.vaidyalink.com'];

export const handler = async (event: APIGatewayProxyEvent) => {
  const origin = event.headers.origin || event.headers.Origin;

  if (!CorsConfig.isOriginAllowed(origin, allowedOrigins)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Origin not allowed' }),
    };
  }

  // Process request...
};
```

## How CORS Works

### Preflight Request Flow

1. **Browser sends OPTIONS request**

   ```http
   OPTIONS /api/v1/scans HTTP/1.1
   Origin: https://app.vaidyalink.com
   Access-Control-Request-Method: POST
   Access-Control-Request-Headers: Authorization, Content-Type
   ```

2. **API Gateway responds with CORS headers**

   ```http
   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: https://app.vaidyalink.com
   Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
   Access-Control-Allow-Headers: Authorization,Content-Type,...
   Access-Control-Allow-Credentials: true
   Access-Control-Max-Age: 3600
   ```

3. **Browser caches preflight response for 1 hour**

4. **Browser sends actual request**

   ```http
   POST /api/v1/scans HTTP/1.1
   Origin: https://app.vaidyalink.com
   Authorization: Bearer eyJhbGc...
   Content-Type: application/json
   ```

5. **API Gateway includes CORS headers in response**
   ```http
   HTTP/1.1 201 Created
   Access-Control-Allow-Origin: https://app.vaidyalink.com
   Access-Control-Allow-Credentials: true
   Content-Type: application/json
   ```

### Simple Request Flow

For simple requests (GET without custom headers), no preflight is required:

1. **Browser sends request directly**

   ```http
   GET /api/v1/patients/123/summary HTTP/1.1
   Origin: https://app.vaidyalink.com
   ```

2. **API Gateway responds with CORS headers**
   ```http
   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: https://app.vaidyalink.com
   Access-Control-Allow-Credentials: true
   Content-Type: application/json
   ```

## Security Considerations

### Origin Whitelisting

- **Never use `*` (wildcard) in production** - The current configuration uses explicit origin lists
- **Validate origins in Lambda** - For sensitive operations, validate the origin header
- **Use HTTPS only in production** - HTTP origins are only allowed in development

### Credentials

- **Credentials enabled** - Allows cookies and authorization headers
- **Requires specific origins** - Cannot use wildcard with credentials
- **Secure cookies** - Use `Secure` and `SameSite` attributes

### Headers

- **Minimize exposed headers** - Only expose necessary response headers
- **Validate request headers** - Check for required headers in Lambda functions
- **Avoid sensitive data in headers** - Don't expose PHI in custom headers

## Testing

### Test CORS with curl

```bash
# Test preflight request
curl -X OPTIONS https://api.vaidyalink.com/api/v1/scans \
  -H "Origin: https://app.vaidyalink.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  -v

# Test actual request
curl -X POST https://api.vaidyalink.com/api/v1/scans \
  -H "Origin: https://app.vaidyalink.com" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"patientId":"123","imageS3Key":"test.jpg"}' \
  -v
```

### Test with Browser Console

```javascript
// Test CORS from browser console
fetch('https://api.vaidyalink.com/api/v1/scans', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer <token>',
  },
  credentials: 'include',
  body: JSON.stringify({
    patientId: '123',
    imageS3Key: 'test.jpg',
  }),
})
  .then((response) => response.json())
  .then((data) => console.log('Success:', data))
  .catch((error) => console.error('Error:', error));
```

### Expected Response Headers

```http
Access-Control-Allow-Origin: https://app.vaidyalink.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Request-Id
Access-Control-Expose-Headers: X-Request-Id,X-Amzn-RequestId,X-Amzn-Trace-Id
Access-Control-Max-Age: 3600
```

## Troubleshooting

### Common Issues

#### 1. CORS Error: "No 'Access-Control-Allow-Origin' header"

**Cause**: Origin not in allowed list or CORS not configured

**Solution**:

```typescript
// Add origin to allowed list
allowedOrigins: ['https://your-domain.com'];
```

#### 2. CORS Error: "Credentials flag is true, but Access-Control-Allow-Credentials is not"

**Cause**: Credentials not enabled in CORS configuration

**Solution**:

```typescript
allowCredentials: true;
```

#### 3. CORS Error: "Request header field X is not allowed"

**Cause**: Custom header not in allowed headers list

**Solution**:

```typescript
allowHeaders: [
  'Content-Type',
  'Authorization',
  'X-Custom-Header', // Add your header
];
```

#### 4. Preflight Request Fails with 403

**Cause**: API Gateway authorizer blocking OPTIONS requests

**Solution**: OPTIONS requests should bypass authorization (handled automatically by API Gateway)

#### 5. CORS Works in Development but Not Production

**Cause**: Different origins between environments

**Solution**: Verify production origin is in allowed list

```bash
# Check current origin
echo $FRONTEND_URL

# Verify in CDK stack
cdk diff --context environment=production
```

## Monitoring

### CloudWatch Metrics

Monitor CORS-related metrics:

- **4xx Errors** - May indicate CORS issues
- **OPTIONS Method Count** - Preflight request volume
- **Latency** - Preflight cache effectiveness

### CloudWatch Logs

Search for CORS errors:

```
fields @timestamp, @message
| filter @message like /CORS/
| sort @timestamp desc
| limit 100
```

### X-Ray Tracing

View CORS preflight requests in X-Ray service map:

1. Open AWS X-Ray console
2. Select VaidyaLink API Gateway
3. Filter by HTTP method: OPTIONS
4. Analyze preflight request patterns

## Best Practices

1. **Use environment-specific origins** - Don't mix development and production origins
2. **Enable credentials** - Required for authenticated requests
3. **Cache preflight responses** - Use appropriate max-age (1 hour recommended)
4. **Minimize allowed headers** - Only include necessary headers
5. **Validate origins in Lambda** - Add extra validation for sensitive operations
6. **Monitor CORS errors** - Set up CloudWatch alarms for 403 errors
7. **Test thoroughly** - Test CORS in all environments before deployment
8. **Document custom origins** - Keep track of all allowed origins
9. **Use HTTPS in production** - Never allow HTTP origins in production
10. **Review regularly** - Audit allowed origins quarterly

## References

- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [AWS API Gateway CORS](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html)
- [OWASP CORS Security](https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny)
- [VaidyaLink Requirements Document](../../.kiro/specs/vaidyalink/requirements.md)
