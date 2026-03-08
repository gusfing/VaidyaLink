# Integration Guide

This guide explains how to integrate the JWT authentication middleware into your Lambda functions and API Gateway.

## Lambda Function Integration

### Step 1: Install Dependencies

```bash
cd backend/your-lambda
npm install jsonwebtoken jwks-rsa
```

### Step 2: Copy Middleware

Copy the shared middleware to your Lambda or use Lambda Layers:

```bash
# Option 1: Copy directly
cp -r backend/shared/nodejs/middleware backend/your-lambda/src/

# Option 2: Use as Lambda Layer (recommended)
# See infrastructure/lib/constructs/lambda-layers.ts
```

### Step 3: Update Lambda Handler

```javascript
const { createAuthMiddleware } = require('./middleware/auth');

const authMiddleware = createAuthMiddleware();

exports.handler = async (event) => {
  // Authenticate
  const authResult = await authMiddleware(event);

  if (!authResult.authorized) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error }),
    };
  }

  // Your logic here
  console.log('Authenticated user:', event.user.username);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  };
};
```

### Step 4: Set Environment Variables

Add to your Lambda configuration:

```bash
COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
COGNITO_CLIENT_ID=your-client-id
AWS_REGION=ap-south-1
```

## API Gateway Integration

### Option 1: Lambda Authorizer (Recommended)

Use a centralized Lambda authorizer for all API routes.

#### Create Authorizer Lambda

```javascript
// backend/shared/nodejs/authorizer/index.js
const { createLambdaAuthorizer } = require('../middleware/auth');

const authorizer = createLambdaAuthorizer();

exports.handler = async (event) => {
  return await authorizer(event);
};
```

#### Configure in CDK

```typescript
// infrastructure/lib/constructs/api-gateway.ts
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';

// Create authorizer Lambda
const authorizerFn = new lambda.Function(this, 'Authorizer', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('backend/shared/nodejs/authorizer'),
  environment: {
    COGNITO_USER_POOL_ID: userPool.userPoolId,
    COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
  },
});

// Create API Gateway authorizer
const authorizer = new apigateway.TokenAuthorizer(this, 'JWTAuthorizer', {
  handler: authorizerFn,
  identitySource: 'method.request.header.Authorization',
  resultsCacheTtl: Duration.minutes(5),
});

// Apply to routes
api.root.addMethod('GET', lambdaIntegration, {
  authorizer,
  authorizationType: apigateway.AuthorizationType.CUSTOM,
});
```

### Option 2: Direct Lambda Validation

Each Lambda validates tokens independently.

```javascript
exports.handler = async (event) => {
  const authMiddleware = createAuthMiddleware();
  const authResult = await authMiddleware(event);

  if (!authResult.authorized) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error }),
    };
  }

  // Protected logic
};
```

### Option 3: Cognito Authorizer (API Gateway Native)

Use API Gateway's built-in Cognito authorizer:

```typescript
// infrastructure/lib/constructs/api-gateway.ts
const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
  cognitoUserPools: [userPool],
});

api.root.addMethod('GET', lambdaIntegration, {
  authorizer,
  authorizationType: apigateway.AuthorizationType.COGNITO,
});
```

Note: With Cognito Authorizer, you still need middleware to extract user context from `event.requestContext.authorizer.claims`.

## Lambda Layer Setup

Create a Lambda Layer for shared middleware:

### Step 1: Create Layer Structure

```bash
mkdir -p lambda-layers/auth-middleware/nodejs/node_modules
cd lambda-layers/auth-middleware/nodejs
npm init -y
npm install jsonwebtoken jwks-rsa
cp -r ../../../backend/shared/nodejs/middleware node_modules/@vaidyalink/
```

### Step 2: Deploy Layer with CDK

```typescript
// infrastructure/lib/constructs/lambda-layers.ts
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class LambdaLayers extends Construct {
  public readonly authMiddlewareLayer: lambda.LayerVersion;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.authMiddlewareLayer = new lambda.LayerVersion(this, 'AuthMiddleware', {
      code: lambda.Code.fromAsset('lambda-layers/auth-middleware'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'JWT authentication middleware',
    });
  }
}
```

### Step 3: Use Layer in Lambda

```typescript
const myFunction = new lambda.Function(this, 'MyFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('backend/my-lambda'),
  layers: [layers.authMiddlewareLayer],
  environment: {
    COGNITO_USER_POOL_ID: userPool.userPoolId,
  },
});
```

## Testing

### Unit Tests

```bash
cd backend/shared/nodejs/middleware
npm test
npm run test:coverage
```

### Integration Tests

```javascript
// Test with real Cognito token
const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

// Get test token
const authResult = await cognito
  .initiateAuth({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: process.env.COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: 'testuser',
      PASSWORD: 'TestPassword123!',
    },
  })
  .promise();

const token = authResult.AuthenticationResult.IdToken;

// Test Lambda
const lambda = new AWS.Lambda();
const result = await lambda
  .invoke({
    FunctionName: 'my-function',
    Payload: JSON.stringify({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
  })
  .promise();
```

### Local Testing

```javascript
// Mock event
const event = {
  headers: {
    Authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
};

const handler = require('./index').handler;
const result = await handler(event);
console.log(result);
```

## Troubleshooting

### Lambda in VPC

If your Lambda is in a VPC, ensure it has internet access via NAT Gateway to reach Cognito JWKS endpoint.

```typescript
const myFunction = new lambda.Function(this, 'MyFunction', {
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  // ...
});
```

### CORS Issues

Add CORS headers to error responses:

```javascript
return {
  statusCode: 401,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  },
  body: JSON.stringify({ error: 'Unauthorized' }),
};
```

### Token Caching

JWKS keys are cached for 10 minutes. To clear cache, redeploy Lambda or wait for cache expiration.

### Performance

- First request: ~50-100ms (fetch JWKS)
- Subsequent requests: ~5-10ms (cached keys)
- Consider using Lambda authorizer with caching for better performance

## Security Best Practices

1. **Always use HTTPS**: Tokens should only be transmitted over TLS
2. **Short token expiration**: Configure Cognito for 1-hour token expiration
3. **Rotate secrets**: Regularly rotate Cognito app client secrets
4. **Least privilege**: Use role-based access control
5. **Audit logging**: Log all authentication attempts
6. **Rate limiting**: Implement rate limiting in API Gateway
7. **Token refresh**: Implement token refresh flow in frontend

## Monitoring

Add CloudWatch metrics:

```javascript
const { CloudWatch } = require('@aws-sdk/client-cloudwatch');
const cloudwatch = new CloudWatch();

// Log authentication metrics
await cloudwatch.putMetricData({
  Namespace: 'VaidyaLink/Auth',
  MetricData: [
    {
      MetricName: 'AuthenticationSuccess',
      Value: 1,
      Unit: 'Count',
    },
  ],
});
```

## Next Steps

1. Implement token refresh flow
2. Add MFA support
3. Implement session management
4. Add audit logging
5. Set up CloudWatch alarms for auth failures
