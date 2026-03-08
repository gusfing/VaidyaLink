# API Key Management Module

Lambda functions for managing API keys in VaidyaLink's external integration system.

## Overview

This module provides complete API key lifecycle management:

- **Create**: Generate new API keys with tier-based rate limiting
- **List**: Query API keys with filtering and pagination
- **Revoke**: Disable compromised or unused keys
- **Rotate**: Generate new keys while maintaining service continuity

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    API Gateway                          │
│  POST   /api/v1/keys                                    │
│  GET    /api/v1/keys                                    │
│  DELETE /api/v1/keys/{keyId}                            │
│  POST   /api/v1/keys/{keyId}/rotate                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Lambda Functions                           │
│  • create-key.ts    - Create new API keys               │
│  • list-keys.ts     - List and filter keys              │
│  • revoke-key.ts    - Revoke keys                       │
│  • rotate-key.ts    - Rotate keys                       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Data Layer                                 │
│  • DynamoDB      - Key metadata                         │
│  • API Gateway   - API key values                       │
│  • CloudWatch    - Metrics and logs                     │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
backend/api-key-management/
├── src/
│   ├── handlers/
│   │   ├── create-key.ts      # Create API key handler
│   │   ├── list-keys.ts       # List API keys handler
│   │   ├── revoke-key.ts      # Revoke API key handler
│   │   └── rotate-key.ts      # Rotate API key handler
│   ├── middleware/
│   │   └── api-key-validator.ts  # API key validation middleware
│   └── index.ts               # Exports
├── dist/                      # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

```bash
cd backend/api-key-management
npm install
```

## Build

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## Development

```bash
# Watch mode for development
npm run watch

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Lint code
npm run lint

# Format code
npm run format
```

## Lambda Handlers

### Create Key Handler

**Function**: `create-key.handler`

Creates a new API key with specified tier and permissions.

**Request:**

```json
{
  "name": "external-integration",
  "description": "API key for partner integration",
  "tier": "Standard",
  "permissions": ["scans:read", "patients:read"],
  "expiresInDays": 365
}
```

**Response:**

```json
{
  "keyId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "vl_live_abc123...",
  "name": "external-integration",
  "tier": "Standard",
  "createdAt": "2024-01-15T10:30:00Z",
  "expiresAt": "2025-01-15T10:30:00Z"
}
```

**Authorization**: Admin role required

### List Keys Handler

**Function**: `list-keys.handler`

Lists API keys with filtering and pagination.

**Query Parameters:**

- `owner` - Filter by owner user ID
- `status` - Filter by status (active, revoked, expired)
- `tier` - Filter by tier
- `limit` - Results per page (default: 50)
- `lastEvaluatedKey` - Pagination token

**Response:**

```json
{
  "keys": [
    {
      "keyId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "external-integration",
      "tier": "Standard",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z",
      "lastUsedAt": "2024-01-20T14:22:00Z",
      "requestCount": 1523
    }
  ],
  "count": 1,
  "nextToken": "..."
}
```

**Authorization**:

- Admins can see all keys
- Regular users can only see their own keys

### Revoke Key Handler

**Function**: `revoke-key.handler`

Revokes an API key, making it immediately invalid.

**Path Parameters:**

- `keyId` - ID of the key to revoke

**Response:**

```json
{
  "keyId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "API key revoked successfully",
  "revokedAt": "2024-01-20T15:00:00Z"
}
```

**Authorization**: Admin role required

### Rotate Key Handler

**Function**: `rotate-key.handler`

Rotates an API key by creating a new one and optionally deleting the old one.

**Path Parameters:**

- `keyId` - ID of the key to rotate

**Request:**

```json
{
  "deleteOldKey": true
}
```

**Response:**

```json
{
  "keyId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "vl_live_xyz789...",
  "name": "external-integration",
  "tier": "Standard",
  "rotatedAt": "2024-06-15T10:30:00Z",
  "previousKeyDeleted": true
}
```

**Authorization**: Admin role required

## Middleware

### API Key Validator

Validates API keys and tracks usage.

**Usage:**

```typescript
import { validateApiKey, withApiKeyValidation } from './middleware/api-key-validator';

// Option 1: Manual validation
export const handler = async (event: APIGatewayProxyEvent) => {
  const validation = await validateApiKey(event, ['scans:read']);

  if (!validation.isValid) {
    return validation.errorResponse!;
  }

  // Continue with handler logic
  const metadata = validation.metadata;
  // ...
};

// Option 2: Higher-order function
export const handler = withApiKeyValidation(
  async (event, metadata) => {
    // Handler logic with validated API key
    console.log('Key tier:', metadata.tier);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Success' }),
    };
  },
  ['scans:read', 'scans:write']
);
```

**Features:**

- Validates API key exists and is active
- Checks expiration date
- Verifies required permissions
- Updates last used timestamp
- Increments request count
- Emits CloudWatch metrics

## Environment Variables

All Lambda functions use these environment variables:

```bash
# DynamoDB table for API key metadata
API_KEY_TABLE=vaidyalink-dev-api-keys

# Environment name
ENVIRONMENT=dev

# Usage plan IDs (for create and rotate handlers)
STANDARD_USAGE_PLAN_ID=abc123
HEALTHCARE_USAGE_PLAN_ID=def456
ENTERPRISE_USAGE_PLAN_ID=ghi789
```

## IAM Permissions

Lambda functions require these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/vaidyalink-*-api-keys",
        "arn:aws:dynamodb:*:*:table/vaidyalink-*-api-keys/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["apigateway:POST", "apigateway:GET", "apigateway:DELETE", "apigateway:PATCH"],
      "Resource": [
        "arn:aws:apigateway:*::/apikeys",
        "arn:aws:apigateway:*::/apikeys/*",
        "arn:aws:apigateway:*::/usageplans/*/keys",
        "arn:aws:apigateway:*::/usageplans/*/keys/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "cloudwatch:PutMetricData",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "cloudwatch:namespace": "VaidyaLink/ApiKeys"
        }
      }
    }
  ]
}
```

## CloudWatch Metrics

The module emits these custom metrics:

| Metric Name               | Description           | Dimensions        |
| ------------------------- | --------------------- | ----------------- |
| `ApiKeyCreated`           | New API key created   | Environment, Tier |
| `ApiKeyRevoked`           | API key revoked       | Environment, Tier |
| `ApiKeyRotated`           | API key rotated       | Environment, Tier |
| `ApiKeyValidationSuccess` | Successful validation | Environment, Type |
| `ApiKeyValidationFailed`  | Failed validation     | Environment, Type |

**Namespace**: `VaidyaLink/ApiKeys`

## DynamoDB Schema

**Table**: `vaidyalink-{environment}-api-keys`

**Primary Key:**

- `keyId` (String) - Partition key

**Attributes:**

```typescript
{
  keyId: string;              // UUID
  apiGatewayKeyId: string;    // API Gateway key ID
  name: string;               // Human-readable name
  description: string;        // Optional description
  tier: string;               // Standard | HealthcareProvider | Enterprise
  owner: string;              // User ID who created the key
  permissions: string[];      // Array of permission strings
  status: string;             // active | revoked | expired
  createdAt: string;          // ISO 8601 timestamp
  updatedAt: string;          // ISO 8601 timestamp
  expiresAt: string;          // ISO 8601 timestamp
  lastUsedAt: string | null;  // ISO 8601 timestamp
  requestCount: number;       // Total requests made
  lastRotatedAt: string | null; // ISO 8601 timestamp
  revokedAt?: string;         // ISO 8601 timestamp
  revokedBy?: string;         // User ID who revoked
  previousKeyId?: string;     // Previous API Gateway key ID
}
```

**Global Secondary Indexes:**

1. **OwnerIndex**
   - Partition key: `owner`
   - Sort key: `createdAt`
   - Use case: List keys by owner

2. **StatusIndex**
   - Partition key: `status`
   - Sort key: `lastUsedAt`
   - Use case: Query active/revoked keys

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
# Set up test environment
export AWS_REGION=us-east-1
export API_KEY_TABLE=vaidyalink-test-api-keys
export ENVIRONMENT=test

# Run integration tests
npm run test:integration
```

### Manual Testing

```bash
# Create test API key
aws lambda invoke \
  --function-name vaidyalink-dev-create-api-key \
  --payload '{"body":"{\"name\":\"test-key\",\"tier\":\"Standard\",\"permissions\":[\"scans:read\"]}"}' \
  response.json

# List API keys
aws lambda invoke \
  --function-name vaidyalink-dev-list-api-keys \
  --payload '{}' \
  response.json

# Revoke API key
aws lambda invoke \
  --function-name vaidyalink-dev-revoke-api-key \
  --payload '{"pathParameters":{"keyId":"550e8400-e29b-41d4-a716-446655440000"}}' \
  response.json
```

## Deployment

Deployed via AWS CDK using the `ApiKeyManagementConstruct`:

```typescript
import { ApiKeyManagementConstruct } from './constructs/api-key-management';

const apiKeyManagement = new ApiKeyManagementConstruct(this, 'ApiKeyManagement', {
  environment: 'production',
  api: restApi,
  encryptionKey: kmsKey,
  userPool: cognitoUserPool,
});
```

## Monitoring

### CloudWatch Logs

Logs are available in:

- `/aws/lambda/vaidyalink-{env}-create-api-key`
- `/aws/lambda/vaidyalink-{env}-list-api-keys`
- `/aws/lambda/vaidyalink-{env}-revoke-api-key`
- `/aws/lambda/vaidyalink-{env}-rotate-api-key`

### CloudWatch Dashboards

Create a dashboard to monitor API key operations:

```bash
aws cloudwatch put-dashboard \
  --dashboard-name VaidyaLink-ApiKeys \
  --dashboard-body file://dashboard.json
```

## Security

- **Encryption**: All data encrypted at rest using AWS KMS
- **RBAC**: Only admins can create/revoke/rotate keys
- **Audit Logging**: All operations logged to CloudWatch
- **Rate Limiting**: Tier-based rate limits enforced
- **Expiration**: Keys automatically expire after configured period
- **Rotation**: Support for zero-downtime key rotation

## Troubleshooting

### Common Issues

**Issue**: "Unauthorized: User ID not found"

- **Cause**: Missing or invalid Cognito token
- **Solution**: Ensure valid Authorization header with Cognito JWT

**Issue**: "Forbidden: Only admins can create API keys"

- **Cause**: User doesn't have admin role
- **Solution**: Grant admin role in Cognito user attributes

**Issue**: "Failed to create API Gateway API key"

- **Cause**: API Gateway service limits or permissions
- **Solution**: Check IAM permissions and service quotas

**Issue**: "API key not found"

- **Cause**: Invalid keyId or key was deleted
- **Solution**: Verify keyId exists in DynamoDB table

## Support

- **Documentation**: [API Key Management Docs](../../docs/API_KEY_MANAGEMENT_QUICK_START.md)
- **Issues**: GitHub Issues
- **Email**: support@vaidyalink.com
