# JWT Authentication Middleware

JWT token validation middleware for AWS Lambda functions using AWS Cognito.

## Features

- Validates Cognito JWT tokens (ID tokens and Access tokens)
- JWKS-based signature verification with caching
- Role-based access control (RBAC)
- Lambda authorizer support for API Gateway
- User context injection into Lambda events

## Installation

The middleware is available as a shared module. Add it to your Lambda function:

```bash
cd backend/your-lambda
npm install ../../shared/nodejs/middleware
```

Or reference it in your Lambda layer configuration.

## Usage

### Basic Authentication Middleware

```javascript
const { createAuthMiddleware } = require('@vaidyalink/middleware');

const authMiddleware = createAuthMiddleware({
  region: 'ap-south-1',
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID, // Optional
});

exports.handler = async (event) => {
  // Validate token
  const authResult = await authMiddleware(event);

  if (!authResult.authorized) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error }),
    };
  }

  // User context is now available in event.user
  console.log('Authenticated user:', event.user.username);
  console.log('User groups:', event.user.groups);

  // Your Lambda logic here
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success', user: event.user }),
  };
};
```

### Role-Based Access Control

```javascript
const { createAuthMiddleware, requireRole } = require('@vaidyalink/middleware');

const authMiddleware = createAuthMiddleware();
const adminOnly = requireRole(['Admin', 'SuperAdmin']);

exports.handler = async (event) => {
  // First authenticate
  const authResult = await authMiddleware(event);
  if (!authResult.authorized) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error }),
    };
  }

  // Then check role
  const roleResult = adminOnly(event);
  if (!roleResult.authorized) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: roleResult.error }),
    };
  }

  // Admin-only logic here
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Admin access granted' }),
  };
};
```

### Lambda Authorizer for API Gateway

```javascript
const { createLambdaAuthorizer } = require('@vaidyalink/middleware');

const authorizer = createLambdaAuthorizer({
  region: 'ap-south-1',
  userPoolId: process.env.COGNITO_USER_POOL_ID,
});

exports.handler = async (event) => {
  return await authorizer(event);
};
```

### Direct Token Validation

```javascript
const { JWTValidator } = require('@vaidyalink/middleware');

const validator = new JWTValidator({
  region: 'ap-south-1',
  userPoolId: process.env.COGNITO_USER_POOL_ID,
});

async function validateToken(token) {
  try {
    const payload = await validator.verifyToken(token);
    console.log('Token is valid:', payload);
    return payload;
  } catch (error) {
    console.error('Token validation failed:', error.message);
    throw error;
  }
}
```

## User Context

After successful authentication, the middleware adds a `user` object to the event:

```javascript
event.user = {
  sub: 'user-uuid', // Cognito user ID
  username: 'john.doe', // Username
  email: 'john@example.com', // Email address
  groups: ['Patient', 'VerifiedUser'], // Cognito groups
  tokenUse: 'access', // 'access' or 'id'
  claims: {
    /* full JWT payload */
  }, // All JWT claims
};
```

## Environment Variables

Required environment variables:

- `COGNITO_USER_POOL_ID`: AWS Cognito User Pool ID
- `AWS_REGION`: AWS region (defaults to 'ap-south-1')
- `COGNITO_CLIENT_ID`: (Optional) Cognito App Client ID for audience validation

## Token Format

The middleware expects tokens in the Authorization header:

```
Authorization: Bearer <jwt-token>
```

Alternative header names supported:

- `Authorization`
- `authorization`
- `x-authorization`

## Error Handling

The middleware returns structured error responses:

```javascript
{
  authorized: false,
  error: "Token has expired"
}
```

Common error messages:

- "Authorization header is missing"
- "Invalid Authorization header format"
- "Token has expired"
- "Invalid token"
- "Insufficient permissions"

## Security Features

1. **JWKS Caching**: Public keys are cached for 10 minutes to reduce latency
2. **Signature Verification**: RS256 algorithm with Cognito public keys
3. **Issuer Validation**: Ensures token is from the correct Cognito User Pool
4. **Audience Validation**: Optional client ID verification
5. **Token Use Validation**: Ensures token is an access or ID token
6. **Expiration Checking**: Automatic expiration validation

## Testing

Example test with mock token:

```javascript
const { createAuthMiddleware } = require('@vaidyalink/middleware');

// Mock event
const event = {
  headers: {
    Authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
};

const authMiddleware = createAuthMiddleware();
const result = await authMiddleware(event);

if (result.authorized) {
  console.log('User authenticated:', event.user);
} else {
  console.error('Authentication failed:', result.error);
}
```

## Integration with API Gateway

### Request Authorizer

Configure API Gateway to use the Lambda authorizer:

1. Create Lambda function with `createLambdaAuthorizer`
2. In API Gateway, create a Lambda authorizer
3. Set Token Source to `Authorization`
4. Enable caching (300 seconds recommended)
5. Attach authorizer to API routes

### Direct Integration

For Lambda functions invoked directly by API Gateway:

```javascript
exports.handler = async (event) => {
  const authMiddleware = createAuthMiddleware();
  const authResult = await authMiddleware(event);

  if (!authResult.authorized) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: authResult.error }),
    };
  }

  // Protected logic here
};
```

## Performance

- JWKS keys are cached for 10 minutes
- Token verification: ~5-10ms (cached keys)
- First request: ~50-100ms (fetch JWKS)

## Troubleshooting

### "Failed to get signing key"

- Check COGNITO_USER_POOL_ID is correct
- Verify network connectivity to Cognito
- Ensure Lambda has internet access (NAT Gateway if in VPC)

### "Invalid token"

- Token may be expired
- Token may be from wrong User Pool
- Token format may be incorrect

### "Insufficient permissions"

- User doesn't have required Cognito group
- Check group names match exactly (case-sensitive)
