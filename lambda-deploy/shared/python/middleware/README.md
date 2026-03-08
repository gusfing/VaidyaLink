# JWT Authentication Middleware (Python)

JWT token validation middleware for AWS Lambda functions using AWS Cognito.

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### Basic Authentication

```python
from middleware.auth import create_auth_middleware
import json

auth_middleware = create_auth_middleware({
    'region': 'ap-south-1',
    'user_pool_id': 'ap-south-1_XXXXXXXXX',
    'client_id': 'your-client-id'  # Optional
})

def handler(event, context):
    # Validate token
    auth_result = auth_middleware(event)

    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'body': json.dumps({'error': auth_result['error']})
        }

    # User context is now available
    user = event['user']
    print(f"Authenticated user: {user['username']}")

    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Success', 'user': user})
    }
```

### Using Decorators

```python
from middleware.auth import authenticated, authorized
import json

@authenticated()
def handler(event, context):
    user = event['user']

    return {
        'statusCode': 200,
        'body': json.dumps({'message': f'Hello {user["username"]}'})
    }
```

### Role-Based Access Control

```python
from middleware.auth import authenticated, authorized
import json

@authenticated()
@authorized('Admin', 'SuperAdmin')
def handler(event, context):
    # Only users with Admin or SuperAdmin role can access
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Admin access granted'})
    }
```

### Manual Role Checking

```python
from middleware.auth import create_auth_middleware, require_role
import json

auth_middleware = create_auth_middleware()
admin_only = require_role(['Admin'])

def handler(event, context):
    # Authenticate
    auth_result = auth_middleware(event)
    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'body': json.dumps({'error': auth_result['error']})
        }

    # Check role
    role_result = admin_only(event)
    if not role_result['authorized']:
        return {
            'statusCode': 403,
            'body': json.dumps({'error': role_result['error']})
        }

    # Admin logic here
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Success'})
    }
```

### Lambda Authorizer

```python
from middleware.auth import create_lambda_authorizer

authorizer = create_lambda_authorizer({
    'region': 'ap-south-1',
    'user_pool_id': 'ap-south-1_XXXXXXXXX'
})

def handler(event, context):
    return authorizer(event)
```

## User Context

After authentication, the middleware adds a `user` dict to the event:

```python
event['user'] = {
    'sub': 'user-uuid',
    'username': 'john.doe',
    'email': 'john@example.com',
    'groups': ['Patient', 'VerifiedUser'],
    'token_use': 'access',
    'claims': { ... }  # Full JWT payload
}
```

## Environment Variables

- `COGNITO_USER_POOL_ID`: AWS Cognito User Pool ID (required)
- `AWS_REGION`: AWS region (default: 'ap-south-1')
- `COGNITO_CLIENT_ID`: Cognito App Client ID (optional)

## Error Handling

```python
auth_result = auth_middleware(event)

if not auth_result['authorized']:
    error_message = auth_result['error']
    # Handle error
```

Common errors:

- "Authorization header is missing"
- "Invalid Authorization header format"
- "Token has expired"
- "Invalid token"
- "Insufficient permissions"

## Testing

```python
import pytest
from middleware.auth import JWTValidator, has_role

def test_extract_token():
    validator = JWTValidator({
        'user_pool_id': 'test-pool'
    })

    token = validator.extract_token('Bearer test-token')
    assert token == 'test-token'

def test_has_role():
    user = {'groups': ['Patient', 'VerifiedUser']}
    assert has_role(user, ['Patient']) == True
    assert has_role(user, ['Admin']) == False
```

## Integration with Document Processing Lambda

```python
# backend/document-processing/src/handler.py
from middleware.auth import authenticated
import json

@authenticated()
def handler(event, context):
    user = event['user']

    # Get document from S3
    # Process with OCR
    # Store results

    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Document processed',
            'userId': user['sub']
        })
    }
```

## Performance

- JWKS keys are cached automatically
- Token verification: ~5-10ms (cached keys)
- First request: ~50-100ms (fetch JWKS)
