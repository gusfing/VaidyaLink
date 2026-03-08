"""
Authentication middleware for Document Processing Lambda
"""

import sys
import os

# Add shared middleware to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../shared/python'))

from middleware.auth import create_auth_middleware, require_role

# Initialize auth middleware
auth_middleware = create_auth_middleware({
    'region': os.environ.get('AWS_REGION', 'ap-south-1'),
    'user_pool_id': os.environ.get('COGNITO_USER_POOL_ID'),
    'client_id': os.environ.get('COGNITO_CLIENT_ID'),
})

# Role definitions
require_patient = require_role(['Patient', 'VerifiedUser', 'HealthcareProvider'])
require_provider = require_role(['HealthcareProvider', 'Admin'])


def authenticate(event):
    """Authenticate request and add user context"""
    return auth_middleware(event)


def check_patient_access(event):
    """Check if user has patient access"""
    return require_patient(event)


def check_provider_access(event):
    """Check if user has provider access"""
    return require_provider(event)


def verify_resource_ownership(event, resource_patient_id):
    """Verify user owns the resource"""
    user = event.get('user')

    if not user:
        return {'authorized': False, 'error': 'User context not found'}

    # Admins can access any resource
    if 'Admin' in user['groups'] or 'SuperAdmin' in user['groups']:
        return {'authorized': True}

    # Check if user's patient ID matches resource
    user_patient_id = user['claims'].get('custom:patientId') or user['sub']

    if user_patient_id != resource_patient_id:
        return {
            'authorized': False,
            'error': 'Access denied: You can only access your own records'
        }

    return {'authorized': True}
