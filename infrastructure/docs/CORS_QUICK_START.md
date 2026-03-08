# CORS Quick Start Guide

## What is CORS?

Cross-Origin Resource Sharing (CORS) is a security mechanism that allows web applications running on one domain to access resources from another domain. For VaidyaLink, this enables the frontend (e.g., `https://app.vaidyalink.com`) to call the API (e.g., `https://api.vaidyalink.com`).

## Quick Setup

### 1. Default Configuration (Recommended)

The CORS configuration is automatically applied based on your environment:

```typescript
// In your CDK stack
const apiGateway = new ApiGatewayConstruct(this, 'ApiGateway', {
  environment: 'production', // or 'staging', 'dev'
  userPool: userPool,
  // ... other props
});
```

**Allowed Origins by Environment:**

- **Production**: `https://vaidyalink.com`, `https://www.vaidyalink.com`, `https://app.vaidyalink.com`
- **Staging**: `https://staging.vaidyalink.com`, `https://staging-app.vaidyalink.com`
- **Development**: `http://localhost:3000`, `http://localhost:3001`, `https://dev.vaidyalink.com`

### 2. Custom Origins

To add custom origins:

```typescript
const apiGateway = new ApiGatewayConstruct(this, 'ApiGateway', {
  environment: 'production',
  userPool: userPool,
  allowedOrigins: ['https://vaidyalink.com', 'https://custom-domain.com'],
  // ... other props
});
```

### 3. Deploy

```bash
cd infrastructure
cdk deploy --context environment=production
```

## Frontend Integration

### Fetch API

```typescript
// Make authenticated API call
const response = await fetch('https://api.vaidyalink.com/api/v1/scans', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  credentials: 'include', // Important: Include credentials
  body: JSON.stringify({
    patientId: '123',
    imageS3Key: 'scan.jpg',
  }),
});

const data = await response.json();
```

### Axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.vaidyalink.com',
  withCredentials: true, // Important: Include credentials
});

// Make request
const response = await api.post(
  '/api/v1/scans',
  {
    patientId: '123',
    imageS3Key: 'scan.jpg',
  },
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);
```

### Next.js API Client

```typescript
// lib/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
```

## Testing CORS

### Test with curl

```bash
# Test preflight (OPTIONS)
curl -X OPTIONS https://api.vaidyalink.com/api/v1/scans \
  -H "Origin: https://app.vaidyalink.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  -i

# Expected response headers:
# Access-Control-Allow-Origin: https://app.vaidyalink.com
# Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
# Access-Control-Allow-Headers: Authorization,Content-Type,...
# Access-Control-Max-Age: 3600
```

### Test with Browser Console

```javascript
// Open browser console on https://app.vaidyalink.com
fetch('https://api.vaidyalink.com/api/v1/scans', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer <your-token>',
  },
  credentials: 'include',
  body: JSON.stringify({ patientId: '123', imageS3Key: 'test.jpg' }),
})
  .then((r) => r.json())
  .then(console.log)
  .catch(console.error);
```

## Common Issues

### Issue: "No 'Access-Control-Allow-Origin' header"

**Solution**: Add your origin to allowed origins list

```typescript
allowedOrigins: ['https://your-domain.com'];
```

### Issue: "Credentials flag is true, but header is not"

**Solution**: Ensure credentials are enabled (default in VaidyaLink)

```typescript
allowCredentials: true; // Already set by default
```

### Issue: CORS works locally but not in production

**Solution**: Check environment-specific origins

```bash
# Verify production origins
cdk diff --context environment=production

# Check frontend URL matches allowed origin
echo $NEXT_PUBLIC_API_URL
```

## Environment Variables

### Frontend (.env.local)

```bash
# Development
NEXT_PUBLIC_API_URL=http://localhost:3000

# Staging
NEXT_PUBLIC_API_URL=https://staging-api.vaidyalink.com

# Production
NEXT_PUBLIC_API_URL=https://api.vaidyalink.com
```

### Infrastructure (CDK Context)

```bash
# Deploy with environment context
cdk deploy --context environment=production
```

## Security Checklist

- [ ] Use HTTPS in production (never HTTP)
- [ ] Whitelist specific origins (never use `*` wildcard)
- [ ] Enable credentials for authenticated requests
- [ ] Validate origins in Lambda for sensitive operations
- [ ] Set appropriate preflight cache duration (1 hour)
- [ ] Monitor CORS errors in CloudWatch
- [ ] Test CORS in all environments before deployment

## Next Steps

1. **Read Full Documentation**: [CORS_CONFIGURATION.md](./CORS_CONFIGURATION.md)
2. **Test Your Setup**: Use curl or browser console
3. **Monitor**: Set up CloudWatch alarms for CORS errors
4. **Review**: Audit allowed origins quarterly

## Support

For issues or questions:

1. Check [CORS_CONFIGURATION.md](./CORS_CONFIGURATION.md) for detailed troubleshooting
2. Review CloudWatch logs for CORS errors
3. Test with curl to isolate frontend vs backend issues
4. Verify environment variables match allowed origins
