"""
Role-Based Access Control (RBAC) Configuration
Defines roles, permissions, and access control rules for VaidyaLink
"""

from typing import List, Dict, Set, Optional, Callable, Any
from enum import Enum


class Role(str, Enum):
    """User roles in the system"""
    PATIENT = "Patient"
    HEALTHCARE_PROVIDER = "HealthcareProvider"
    ADMIN = "Admin"
    HITL_VERIFIER = "HITLVerifier"


class Permission(str, Enum):
    """System permissions"""
    # Document scanning permissions
    SCAN_UPLOAD = "scan:upload"
    SCAN_READ_OWN = "scan:read:own"
    SCAN_READ_ALL = "scan:read:all"
    SCAN_DELETE_OWN = "scan:delete:own"
    SCAN_DELETE_ALL = "scan:delete:all"

    # Voice recording permissions
    VOICE_UPLOAD = "voice:upload"
    VOICE_READ_OWN = "voice:read:own"
    VOICE_READ_ALL = "voice:read:all"

    # Patient record permissions
    RECORD_READ_OWN = "record:read:own"
    RECORD_READ_ALL = "record:read:all"
    RECORD_WRITE_OWN = "record:write:own"
    RECORD_WRITE_ALL = "record:write:all"
    RECORD_EXPORT = "record:export"

    # ABDM permissions
    ABDM_LINK = "abdm:link"
    ABDM_FETCH = "abdm:fetch"
    ABDM_PUSH = "abdm:push"
    ABDM_CONSENT = "abdm:consent"

    # HITL permissions
    HITL_VIEW_QUEUE = "hitl:view:queue"
    HITL_VERIFY = "hitl:verify"
    HITL_ASSIGN = "hitl:assign"

    # Admin permissions
    USER_MANAGE = "user:manage"
    SYSTEM_CONFIG = "system:config"
    AUDIT_VIEW = "audit:view"


# Role-to-permissions mapping
ROLE_PERMISSIONS: Dict[str, List[str]] = {
    Role.PATIENT: [
        Permission.SCAN_UPLOAD,
        Permission.SCAN_READ_OWN,
        Permission.SCAN_DELETE_OWN,
        Permission.VOICE_UPLOAD,
        Permission.VOICE_READ_OWN,
        Permission.RECORD_READ_OWN,
        Permission.RECORD_WRITE_OWN,
        Permission.RECORD_EXPORT,
        Permission.ABDM_LINK,
        Permission.ABDM_FETCH,
        Permission.ABDM_CONSENT,
    ],
    Role.HEALTHCARE_PROVIDER: [
        Permission.SCAN_UPLOAD,
        Permission.SCAN_READ_OWN,
        Permission.SCAN_READ_ALL,
        Permission.VOICE_UPLOAD,
        Permission.VOICE_READ_OWN,
        Permission.VOICE_READ_ALL,
        Permission.RECORD_READ_OWN,
        Permission.RECORD_READ_ALL,
        Permission.RECORD_WRITE_OWN,
        Permission.RECORD_WRITE_ALL,
        Permission.RECORD_EXPORT,
        Permission.ABDM_PUSH,
        Permission.ABDM_FETCH,
        Permission.ABDM_CONSENT,
    ],
    Role.HITL_VERIFIER: [
        Permission.SCAN_READ_ALL,
        Permission.HITL_VIEW_QUEUE,
        Permission.HITL_VERIFY,
        Permission.RECORD_READ_ALL,
    ],
    Role.ADMIN: list(Permission),  # Admins have all permissions
}

# API endpoint to permission mapping
ENDPOINT_PERMISSIONS: Dict[str, List[str]] = {
    # Scan endpoints
    "POST /api/v1/scans/upload-url": [Permission.SCAN_UPLOAD],
    "POST /api/v1/scans": [Permission.SCAN_UPLOAD],
    "GET /api/v1/scans/:jobId": [Permission.SCAN_READ_OWN, Permission.SCAN_READ_ALL],
    "GET /api/v1/scans/:jobId/data": [Permission.SCAN_READ_OWN, Permission.SCAN_READ_ALL],
    "DELETE /api/v1/scans/:jobId": [Permission.SCAN_DELETE_OWN, Permission.SCAN_DELETE_ALL],

    # Voice endpoints
    "POST /api/v1/voice/upload-url": [Permission.VOICE_UPLOAD],
    "POST /api/v1/voice/transcribe": [Permission.VOICE_UPLOAD],
    "POST /api/v1/voice/:jobId/confirm": [Permission.VOICE_READ_OWN, Permission.VOICE_READ_ALL],

    # Patient record endpoints
    "GET /api/v1/patients/:id/records": [Permission.RECORD_READ_OWN, Permission.RECORD_READ_ALL],
    "GET /api/v1/patients/:id/summary": [Permission.RECORD_READ_OWN, Permission.RECORD_READ_ALL],
    "GET /api/v1/patients/:id/export": [Permission.RECORD_EXPORT],
    "PUT /api/v1/patients/:id/records": [Permission.RECORD_WRITE_OWN, Permission.RECORD_WRITE_ALL],

    # ABDM endpoints
    "POST /api/v1/abdm/link": [Permission.ABDM_LINK],
    "GET /api/v1/abdm/records": [Permission.ABDM_FETCH],
    "POST /api/v1/abdm/push": [Permission.ABDM_PUSH],
    "POST /api/v1/abdm/consent": [Permission.ABDM_CONSENT],

    # HITL endpoints
    "GET /api/v1/hitl/queue": [Permission.HITL_VIEW_QUEUE],
    "POST /api/v1/hitl/:jobId/verify": [Permission.HITL_VERIFY],
    "POST /api/v1/hitl/:jobId/assign": [Permission.HITL_ASSIGN],

    # Admin endpoints
    "GET /api/v1/admin/users": [Permission.USER_MANAGE],
    "POST /api/v1/admin/users": [Permission.USER_MANAGE],
    "PUT /api/v1/admin/users/:id": [Permission.USER_MANAGE],
    "DELETE /api/v1/admin/users/:id": [Permission.USER_MANAGE],
    "GET /api/v1/admin/audit": [Permission.AUDIT_VIEW],
    "PUT /api/v1/admin/config": [Permission.SYSTEM_CONFIG],
}

# Rate limiting tiers by role
RATE_LIMITS: Dict[str, Dict[str, int]] = {
    Role.PATIENT: {
        "requests_per_minute": 100,
        "burst_capacity": 200,
    },
    Role.HEALTHCARE_PROVIDER: {
        "requests_per_minute": 1000,
        "burst_capacity": 2000,
    },
    Role.HITL_VERIFIER: {
        "requests_per_minute": 500,
        "burst_capacity": 1000,
    },
    Role.ADMIN: {
        "requests_per_minute": 2000,
        "burst_capacity": 4000,
    },
}


def get_role_permissions(role: str) -> List[str]:
    """Get permissions for a role"""
    return ROLE_PERMISSIONS.get(role, [])


def get_user_permissions(user_roles: List[str]) -> List[str]:
    """Get all permissions for a user based on their roles"""
    if not isinstance(user_roles, list):
        user_roles = [user_roles]

    permissions: Set[str] = set()
    for role in user_roles:
        role_perms = get_role_permissions(role)
        permissions.update(role_perms)

    return list(permissions)


def has_permission(user_roles: List[str], required_permission: str) -> bool:
    """Check if user has a specific permission"""
    user_permissions = get_user_permissions(user_roles)
    return required_permission in user_permissions


def has_any_permission(user_roles: List[str], required_permissions: List[str]) -> bool:
    """Check if user has any of the required permissions"""
    if not isinstance(required_permissions, list):
        required_permissions = [required_permissions]

    user_permissions = get_user_permissions(user_roles)
    return any(perm in user_permissions for perm in required_permissions)


def has_all_permissions(user_roles: List[str], required_permissions: List[str]) -> bool:
    """Check if user has all required permissions"""
    if not isinstance(required_permissions, list):
        required_permissions = [required_permissions]

    user_permissions = get_user_permissions(user_roles)
    return all(perm in user_permissions for perm in required_permissions)


def get_endpoint_permissions(method: str, path: str) -> List[str]:
    """Get required permissions for an endpoint"""
    # Try exact match first
    exact_key = f"{method} {path}"
    if exact_key in ENDPOINT_PERMISSIONS:
        return ENDPOINT_PERMISSIONS[exact_key]

    # Normalize path by replacing last segment with :id or :jobId
    path_segments = path.split('/')
    if path_segments:
        last_segment = path_segments[-1]

        # Check if last segment looks like an ID
        known_segments = ['upload-url', 'transcribe', 'confirm', 'records', 'summary',
                         'export', 'link', 'push', 'consent', 'queue', 'verify',
                         'assign', 'users', 'audit', 'config']

        if last_segment and last_segment not in known_segments:
            path_segments[-1] = ':id'
            normalized_path = '/'.join(path_segments)
            normalized_key = f"{method} {normalized_path}"

            if normalized_key in ENDPOINT_PERMISSIONS:
                return ENDPOINT_PERMISSIONS[normalized_key]

            # Try with :jobId
            path_segments[-1] = ':jobId'
            job_id_path = '/'.join(path_segments)
            job_id_key = f"{method} {job_id_path}"

            if job_id_key in ENDPOINT_PERMISSIONS:
                return ENDPOINT_PERMISSIONS[job_id_key]

    return []


def can_access_endpoint(user_roles: List[str], method: str, path: str) -> bool:
    """Check if user can access an endpoint"""
    required_permissions = get_endpoint_permissions(method, path)

    if not required_permissions:
        # No specific permissions required
        return True

    # User needs at least one of the required permissions
    return has_any_permission(user_roles, required_permissions)


def owns_resource(user_id: str, resource_owner_id: str) -> bool:
    """Check if user owns a resource"""
    return user_id == resource_owner_id


def get_rate_limit(user_roles: List[str]) -> Dict[str, int]:
    """Get rate limit for user based on their highest privilege role"""
    if not isinstance(user_roles, list):
        user_roles = [user_roles]

    # Priority order: Admin > HealthcareProvider > HITLVerifier > Patient
    role_priority = [Role.ADMIN, Role.HEALTHCARE_PROVIDER, Role.HITL_VERIFIER, Role.PATIENT]

    for role in role_priority:
        if role in user_roles:
            return RATE_LIMITS[role]

    # Default to patient limits
    return RATE_LIMITS[Role.PATIENT]


def require_permission(required_permissions: List[str]):
    """
    Middleware to check permissions for an endpoint

    Usage:
        permission_check = require_permission([Permission.SCAN_UPLOAD])

        def handler(event, context):
            result = permission_check(event)
            if not result['authorized']:
                return {
                    'statusCode': 403,
                    'body': json.dumps({'error': result['error']})
                }
    """
    if not isinstance(required_permissions, list):
        required_permissions = [required_permissions]

    def middleware(event: Dict[str, Any]) -> Dict[str, Any]:
        user = event.get('user')

        if not user:
            return {
                'authorized': False,
                'error': 'User context not found. Ensure auth middleware runs first.',
            }

        user_roles = user.get('groups', [])

        if not has_any_permission(user_roles, required_permissions):
            return {
                'authorized': False,
                'error': f'Insufficient permissions. Required: {" or ".join(required_permissions)}',
            }

        return {'authorized': True}

    return middleware


def require_ownership(get_resource_owner_id: Callable):
    """
    Middleware to check resource ownership

    Usage:
        async def get_scan_owner(event):
            job_id = event['pathParameters']['jobId']
            # Fetch from database
            return owner_id

        ownership_check = require_ownership(get_scan_owner)

        async def handler(event, context):
            result = await ownership_check(event)
            if not result['authorized']:
                return {
                    'statusCode': 403,
                    'body': json.dumps({'error': result['error']})
                }
    """
    async def middleware(event: Dict[str, Any]) -> Dict[str, Any]:
        user = event.get('user')

        if not user:
            return {
                'authorized': False,
                'error': 'User context not found. Ensure auth middleware runs first.',
            }

        user_id = user.get('sub')
        user_roles = user.get('groups', [])

        # Admins and healthcare providers can access all resources
        if Role.ADMIN in user_roles or Role.HEALTHCARE_PROVIDER in user_roles:
            return {'authorized': True}

        # Check ownership
        resource_owner_id = await get_resource_owner_id(event)

        if not owns_resource(user_id, resource_owner_id):
            return {
                'authorized': False,
                'error': 'Access denied. You can only access your own resources.',
            }

        return {'authorized': True}

    return middleware
