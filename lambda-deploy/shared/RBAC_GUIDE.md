# Role-Based Access Control (RBAC) Guide

## Overview

VaidyaLink implements a comprehensive Role-Based Access Control (RBAC) system to enforce the principle of least privilege and ensure secure access to healthcare data. The system is integrated with AWS Cognito and provides fine-grained permission controls across all API endpoints.

## Roles

The system defines four primary roles:

### 1. Patient

- **Purpose**: End users accessing their own health records
- **Key Permissions**:
  - Upload and manage own documents
  - Record voice histories
  - View and export own health records
  - Link ABHA ID and manage consent
- **Rate Limit**: 100 requests/minute, 200 burst capacity

### 2. HealthcareProvider

- **Purpose**: Medical professionals managing patient records
- **Key Permissions**:
  - Upload documents for patients
  - View all patient records
  - Write to patient records
  - Push data to ABDM
  - Generate clinical summaries
- **Rate Limit**: 1000 requests/minute, 2000 burst capacity

### 3. HITLVerifier

- **Purpose**: Human-in-the-loop verification specialists
- **Key Permissions**:
  - View HITL verification queue
  - Verify and correct low-confidence extractions
  - Read all scan data
- **Rate Limit**: 500 requests/minute, 1000 burst capacity

### 4. Admin

- **Purpose**: System administrators
- **Key Permissions**: All permissions in the system
- **Rate Limit**: 2000 requests/minute, 4000 burst capacity

## Permission Model

Permissions follow a hierarchical naming convention:

```
<resource>:<action>:<scope>
```

Examples:

- `scan:upload` - Upload scans
- `record:read:own` - Read own records
- `record:read:all` - Read all records
- `user:manage` - Manage users

### Permission Categories

1. **Document Scanning**: `scan:*`
2. **Voice Recording**: `voice:*`
3. **Patient Records**: `record:*`
4. **ABDM Integration**: `abdm:*`
5. **HITL Operations**: `hitl:*`
6. **Administration**: `user:*`, `system:*`, `audit:*`

## Usage

### Node.js Lambda Functions

#### Basic Authentication

```javascript
const { createAuthMiddleware } = require('./middleware/auth');

const authMiddleware = createAuthMiddleware();

exports.handler = async (event, context) => {
  // Authenticate request
  const authResult = await authMiddleware(event);

  if (!authResult.authorized) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error }),
    };
  }

  // Access user info with RBAC context
  const user = event.user;
  console.log('User:', user.username);
  console.log('Roles:', user.groups);
  console.log('Permissions:', user.permissions);
  console.log('Rate Limit:', user.rateLimit);

  // Your handler logic
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  };
};
```

#### Role-Based Access

```javascript
const { createAuthMiddleware, requireRole } = require('./middleware/auth');

const authMiddleware = createAuthMiddleware();

exports.handler = async (event, context) => {
  // Authenticate
  const authResult = await authMiddleware(event);
  if (!authResult.authorized) {
    return { statusCode: 401, body: JSON.stringify({ error: authResult.error }) };
  }

  // Check role
  const roleCheck = requireRole(['Admin', 'HealthcareProvider'])(event);
  if (!roleCheck.authorized) {
    return { statusCode: 403, body: JSON.stringify({ error: roleCheck.error }) };
  }

  // Handler logic for admins and providers only
  return { statusCode: 200, body: JSON.stringify({ message: 'Success' }) };
};
```

#### Permission-Based Access

```javascript
const { createAuthMiddleware } = require('./middleware/auth');
const { requirePermission, PERMISSIONS } = require('./middleware/rbac');

const authMiddleware = createAuthMiddleware();

exports.handler = async (event, context) => {
  // Authenticate
  const authResult = await authMiddleware(event);
  if (!authResult.authorized) {
    return { statusCode: 401, body: JSON.stringify({ error: authResult.error }) };
  }

  // Check permission
  const permCheck = requirePermission([PERMISSIONS.SCAN_UPLOAD])(event);
  if (!permCheck.authorized) {
    return { statusCode: 403, body: JSON.stringify({ error: permCheck.error }) };
  }

  // Handler logic
  return { statusCode: 200, body: JSON.stringify({ message: 'Success' }) };
};
```

#### Resource Ownership Check

```javascript
const { createAuthMiddleware } = require('./middleware/auth');
const { requireOwnership } = require('./middleware/rbac');
const { getScanJob } = require('./services/database');

const authMiddleware = createAuthMiddleware();

exports.handler = async (event, context) => {
  // Authenticate
  const authResult = await authMiddleware(event);
  if (!authResult.authorized) {
    return { statusCode: 401, body: JSON.stringify({ error: authResult.error }) };
  }

  // Check ownership
  const getResourceOwnerId = async (event) => {
    const jobId = event.pathParameters.jobId;
    const job = await getScanJob(jobId);
    return job.patientId;
  };

  const ownershipCheck = requireOwnership(getResourceOwnerId);
  const ownerResult = await ownershipCheck(event);

  if (!ownerResult.authorized) {
    return { statusCode: 403, body: JSON.stringify({ error: ownerResult.error }) };
  }

  // Handler logic - user can only access their own resources
  return { statusCode: 200, body: JSON.stringify({ message: 'Success' }) };
};
```

### Python Lambda Functions

#### Basic Authentication

```python
from middleware.auth import create_auth_middleware
import json

auth_middleware = create_auth_middleware()

def handler(event, context):
    # Authenticate request
    auth_result = auth_middleware(event)

    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'body': json.dumps({'error': auth_result['error']})
        }

    # Access user info with RBAC context
    user = event['user']
    print(f"User: {user['username']}")
    print(f"Roles: {user['groups']}")
    print(f"Permissions: {user['permissions']}")
    print(f"Rate Limit: {user['rate_limit']}")

    # Your handler logic
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Success'})
    }
```

#### Using Decorators

```python
from middleware.auth import authenticated, authorized
import json

@authenticated()
@authorized('Admin', 'HealthcareProvider')
def handler(event, context):
    # This handler is only accessible to Admins and HealthcareProviders
    user = event['user']

    return {
        'statusCode': 200,
        'body': json.dumps({'message': f'Hello {user["username"]}'})
    }
```

#### Permission-Based Access

```python
from middleware.auth import create_auth_middleware
from middleware.rbac import require_permission, Permission
import json

auth_middleware = create_auth_middleware()

def handler(event, context):
    # Authenticate
    auth_result = auth_middleware(event)
    if not auth_result['authorized']:
        return {'statusCode': 401, 'body': json.dumps({'error': auth_result['error']})}

    # Check permission
    perm_check = require_permission([Permission.SCAN_UPLOAD])
    perm_result = perm_check(event)

    if not perm_result['authorized']:
        return {'statusCode': 403, 'body': json.dumps({'error': perm_result['error']})}

    # Handler logic
    return {'statusCode': 200, 'body': json.dumps({'message': 'Success'})}
```

#### Resource Ownership Check

```python
from middleware.auth import create_auth_middleware
from middleware.rbac import require_ownership
from services.database import get_scan_job
import json

auth_middleware = create_auth_middleware()

async def handler(event, context):
    # Authenticate
    auth_result = auth_middleware(event)
    if not auth_result['authorized']:
        return {'statusCode': 401, 'body': json.dumps({'error': auth_result['error']})}

    # Check ownership
    async def get_resource_owner_id(event):
        job_id = event['pathParameters']['jobId']
        job = await get_scan_job(job_id)
        return job['patientId']

    ownership_check = require_ownership(get_resource_owner_id)
    owner_result = await ownership_check(event)

    if not owner_result['authorized']:
        return {'statusCode': 403, 'body': json.dumps({'error': owner_result['error']})}

    # Handler logic
    return {'statusCode': 200, 'body': json.dumps({'message': 'Success'})}
```

## Cognito Integration

### Adding Roles to Users

Roles are managed through Cognito User Groups. To assign a role to a user:

1. **Via AWS Console**:
   - Navigate to Cognito User Pools
   - Select your user pool
   - Go to "Groups" and create groups: `Patient`, `HealthcareProvider`, `Admin`, `HITLVerifier`
   - Add users to appropriate groups

2. **Via AWS CLI**:

```bash
# Create group
aws cognito-idp create-group \
  --group-name Patient \
  --user-pool-id ap-south-1_XXXXX \
  --description "Patient users"

# Add user to group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ap-south-1_XXXXX \
  --username user@example.com \
  --group-name Patient
```

3. **Via CDK/CloudFormation**:

```typescript
import * as cognito from 'aws-cdk-lib/aws-cognito';

const patientGroup = new cognito.CfnUserPoolGroup(this, 'PatientGroup', {
  userPoolId: userPool.userPoolId,
  groupName: 'Patient',
  description: 'Patient users',
});
```

### JWT Token Structure

After authentication, the JWT token includes group membership:

```json
{
  "sub": "user-123",
  "cognito:username": "patient@example.com",
  "email": "patient@example.com",
  "cognito:groups": ["Patient"],
  "token_use": "access",
  "iss": "https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_XXXXX",
  "exp": 1234567890
}
```

## API Gateway Integration

### Rate Limiting by Role

Configure API Gateway usage plans based on user roles:

```typescript
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

// Patient tier
const patientPlan = api.addUsagePlan('PatientPlan', {
  throttle: {
    rateLimit: 100,
    burstLimit: 200,
  },
});

// Healthcare Provider tier
const providerPlan = api.addUsagePlan('ProviderPlan', {
  throttle: {
    rateLimit: 1000,
    burstLimit: 2000,
  },
});
```

### Lambda Authorizer

Use the built-in Lambda authorizer for API Gateway:

```javascript
const { createLambdaAuthorizer } = require('./middleware/auth');

exports.handler = createLambdaAuthorizer();
```

This returns an IAM policy with user context that API Gateway uses for authorization.

## Testing

### Running Tests

```bash
# Node.js tests
cd backend/shared/nodejs/middleware
npm test

# Python tests
cd backend/shared/python/middleware
pytest test_rbac.py
```

### Example Test Cases

```javascript
// Test permission check
it('should allow Patient to upload scans', () => {
  const result = canAccessEndpoint(['Patient'], 'POST', '/api/v1/scans');
  expect(result).toBe(true);
});

// Test role hierarchy
it('should give Admin all permissions', () => {
  const adminPerms = getUserPermissions(['Admin']);
  const patientPerms = getUserPermissions(['Patient']);

  patientPerms.forEach((perm) => {
    expect(adminPerms).toContain(perm);
  });
});
```

## Security Best Practices

1. **Principle of Least Privilege**: Assign users the minimum role necessary
2. **Regular Audits**: Review user roles and permissions periodically
3. **Token Expiration**: Configure appropriate JWT token expiration times
4. **Multi-Factor Authentication**: Enable MFA for Admin and HealthcareProvider roles
5. **Audit Logging**: Log all authorization failures for security monitoring
6. **Resource Ownership**: Always verify resource ownership for patient data access

## Troubleshooting

### Common Issues

1. **"User context not found" error**
   - Ensure `createAuthMiddleware()` runs before RBAC checks
   - Verify JWT token is included in Authorization header

2. **"Insufficient permissions" error**
   - Check user's Cognito groups match required roles
   - Verify role-to-permission mappings in `rbac.js`/`rbac.py`

3. **Rate limit exceeded**
   - Check user's role and corresponding rate limit
   - Consider upgrading user to higher privilege role if legitimate

4. **Ownership check fails for Admin**
   - Verify Admin role is correctly assigned in Cognito
   - Check `requireOwnership` middleware allows Admin bypass

## Extending the System

### Adding New Roles

1. Add role to `ROLES` enum in `rbac.js`/`rbac.py`
2. Define permissions in `ROLE_PERMISSIONS` mapping
3. Create Cognito group with matching name
4. Update rate limits in `RATE_LIMITS`
5. Add tests for new role

### Adding New Permissions

1. Add permission to `PERMISSIONS` enum
2. Assign to appropriate roles in `ROLE_PERMISSIONS`
3. Map to endpoints in `ENDPOINT_PERMISSIONS`
4. Add tests for new permission

### Custom Permission Logic

For complex authorization logic, create custom middleware:

```javascript
function requireCustomLogic() {
  return async (event) => {
    const user = event.user;

    // Custom logic here
    if (customCondition(user)) {
      return { authorized: true };
    }

    return { authorized: false, error: 'Custom check failed' };
  };
}
```

## References

- [AWS Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [ABDM Security Guidelines](https://abdm.gov.in/)
