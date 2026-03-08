"""
JWT Token Validation Middleware for AWS Lambda (Python)
Validates Cognito JWT tokens from API Gateway requests
"""

import os
import json
import time
from typing import Dict, List, Optional, Any
from functools import wraps
import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError


class JWTValidator:
    """JWT token validator for AWS Cognito"""

    def __init__(self, config: Optional[Dict[str, str]] = None):
        config = config or {}
        self.region = config.get('region') or os.environ.get('AWS_REGION', 'ap-south-1')
        self.user_pool_id = config.get('user_pool_id') or os.environ.get('COGNITO_USER_POOL_ID')
        self.client_id = config.get('client_id') or os.environ.get('COGNITO_CLIENT_ID')

        if not self.user_pool_id:
            raise ValueError('COGNITO_USER_POOL_ID is required')

        # JWKS endpoint for Cognito
        jwks_url = f'https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}/.well-known/jwks.json'
        self.jwks_client = PyJWKClient(jwks_url, cache_keys=True, max_cached_keys=10)
        self.issuer = f'https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}'

    def extract_token(self, auth_header: Optional[str]) -> str:
        """Extract token from Authorization header"""
        if not auth_header:
            raise ValueError('Authorization header is missing')

        parts = auth_header.split(' ')

        if len(parts) != 2 or parts[0] != 'Bearer':
            raise ValueError('Invalid Authorization header format. Expected: Bearer <token>')

        return parts[1]

    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode JWT token"""
        try:
            # Get signing key from JWKS
            signing_key = self.jwks_client.get_signing_key_from_jwt(token)

            # Verify token
            options = {
                'verify_signature': True,
                'verify_exp': True,
                'verify_iss': True,
                'verify_aud': False,  # Cognito doesn't always include aud
            }

            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=['RS256'],
                issuer=self.issuer,
                options=options,
            )

            # Additional validation
            token_use = payload.get('token_use')
            if token_use not in ['access', 'id']:
                raise ValueError('Invalid token_use claim')

            # Verify client_id if configured
            if self.client_id:
                aud = payload.get('aud') or payload.get('client_id')
                if aud != self.client_id:
                    raise ValueError('Invalid audience')

            return payload

        except ExpiredSignatureError:
            raise ValueError('Token has expired')
        except InvalidTokenError as e:
            raise ValueError(f'Invalid token: {str(e)}')


def create_auth_middleware(config: Optional[Dict[str, str]] = None):
    """
    Create authentication middleware for Lambda handlers

    Usage:
        auth_middleware = create_auth_middleware()

        def handler(event, context):
            auth_result = auth_middleware(event)
            if not auth_result['authorized']:
                return {
                    'statusCode': 401,
                    'body': json.dumps({'error': auth_result['error']})
                }

            # Access user info
            user = event['user']
            print(f"User: {user['username']}")
    """
    validator = JWTValidator(config)

    def middleware(event: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # Extract token from headers
            headers = event.get('headers', {})
            auth_header = (
                headers.get('Authorization')
                or headers.get('authorization')
                or headers.get('x-authorization')
            )

            token = validator.extract_token(auth_header)

            # Verify token
            payload = validator.verify_token(token)

            # Add user context to event
            event['user'] = {
                'sub': payload.get('sub'),
                'username': payload.get('cognito:username') or payload.get('username'),
                'email': payload.get('email'),
                'groups': payload.get('cognito:groups', []),
                'token_use': payload.get('token_use'),
                'claims': payload,
            }

            # Enrich user with RBAC permissions and rate limits
            enrich_user_with_rbac(event['user'])

            return {'authorized': True, 'user': event['user']}

        except Exception as e:
            print(f'Authentication failed: {str(e)}')
            return {'authorized': False, 'error': str(e)}

    return middleware


def require_role(required_roles: List[str]):
    """
    Role-based access control middleware

    Usage:
        admin_only = require_role(['Admin', 'SuperAdmin'])

        def handler(event, context):
            role_result = admin_only(event)
            if not role_result['authorized']:
                return {
                    'statusCode': 403,
                    'body': json.dumps({'error': role_result['error']})
                }
    """
    if not isinstance(required_roles, list):
        required_roles = [required_roles]

    def middleware(event: Dict[str, Any]) -> Dict[str, Any]:
        user = event.get('user')

        if not user:
            return {
                'authorized': False,
                'error': 'User context not found. Ensure auth middleware runs first.',
            }

        user_groups = user.get('groups', [])

        if not any(role in user_groups for role in required_roles):
            return {
                'authorized': False,
                'error': f'Insufficient permissions. Required roles: {", ".join(required_roles)}',
            }

        return {'authorized': True}

    return middleware


def has_role(user: Dict[str, Any], required_roles: List[str]) -> bool:
    """Check if user has required role"""
    if not isinstance(required_roles, list):
        required_roles = [required_roles]

    user_groups = user.get('groups', [])
    return any(role in user_groups for role in required_roles)


def extract_user_permissions(user: Dict[str, Any]) -> List[str]:
    """Extract user permissions from groups/roles"""
    from . import rbac
    return rbac.get_user_permissions(user.get('groups', []))


def enrich_user_with_rbac(user: Dict[str, Any]) -> Dict[str, Any]:
    """Add RBAC context to user object"""
    from . import rbac

    user['permissions'] = rbac.get_user_permissions(user.get('groups', []))
    user['rate_limit'] = rbac.get_rate_limit(user.get('groups', []))

    return user


def authenticated(config: Optional[Dict[str, str]] = None):
    """
    Decorator for Lambda handlers requiring authentication

    Usage:
        @authenticated()
        def handler(event, context):
            user = event['user']
            return {
                'statusCode': 200,
                'body': json.dumps({'message': f'Hello {user["username"]}'})
            }
    """
    auth_middleware = create_auth_middleware(config)

    def decorator(handler):
        @wraps(handler)
        def wrapper(event, context):
            auth_result = auth_middleware(event)

            if not auth_result['authorized']:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    'body': json.dumps({'error': 'Unauthorized', 'message': auth_result['error']}),
                }

            return handler(event, context)

        return wrapper

    return decorator


def authorized(*required_roles):
    """
    Decorator for Lambda handlers requiring specific roles

    Usage:
        @authenticated()
        @authorized('Admin', 'SuperAdmin')
        def handler(event, context):
            return {'statusCode': 200, 'body': 'Admin access'}
    """
    role_middleware = require_role(list(required_roles))

    def decorator(handler):
        @wraps(handler)
        def wrapper(event, context):
            role_result = role_middleware(event)

            if not role_result['authorized']:
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    'body': json.dumps({'error': 'Forbidden', 'message': role_result['error']}),
                }

            return handler(event, context)

        return wrapper

    return decorator


def create_lambda_authorizer(config: Optional[Dict[str, str]] = None):
    """
    Create Lambda authorizer for API Gateway

    Usage:
        authorizer = create_lambda_authorizer()

        def handler(event, context):
            return authorizer(event)
    """
    validator = JWTValidator(config)

    def authorizer(event: Dict[str, Any]) -> Dict[str, Any]:
        try:
            token = validator.extract_token(event['authorizationToken'])
            payload = validator.verify_token(token)

            # Generate IAM policy
            policy = generate_policy(payload['sub'], 'Allow', event['methodArn'], payload)

            return policy

        except Exception as e:
            print(f'Authorization failed: {str(e)}')
            raise Exception('Unauthorized')

    return authorizer


def generate_policy(
    principal_id: str, effect: str, resource: str, context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Generate IAM policy for API Gateway"""
    context = context or {}

    policy = {
        'principalId': principal_id,
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [
                {'Action': 'execute-api:Invoke', 'Effect': effect, 'Resource': resource}
            ],
        },
        'context': {
            'sub': context.get('sub', ''),
            'username': context.get('cognito:username') or context.get('username', ''),
            'email': context.get('email', ''),
            'groups': json.dumps(context.get('cognito:groups', [])),
        },
    }

    return policy
