/**
 * Role-Based Access Control (RBAC) Configuration
 * Defines roles, permissions, and access control rules for VaidyaLink
 */

// Role definitions
const ROLES = {
  PATIENT: 'Patient',
  HEALTHCARE_PROVIDER: 'HealthcareProvider',
  ADMIN: 'Admin',
  HITL_VERIFIER: 'HITLVerifier',
};

// Permission definitions
const PERMISSIONS = {
  // Document scanning permissions
  SCAN_UPLOAD: 'scan:upload',
  SCAN_READ_OWN: 'scan:read:own',
  SCAN_READ_ALL: 'scan:read:all',
  SCAN_DELETE_OWN: 'scan:delete:own',
  SCAN_DELETE_ALL: 'scan:delete:all',

  // Voice recording permissions
  VOICE_UPLOAD: 'voice:upload',
  VOICE_READ_OWN: 'voice:read:own',
  VOICE_READ_ALL: 'voice:read:all',

  // Patient record permissions
  RECORD_READ_OWN: 'record:read:own',
  RECORD_READ_ALL: 'record:read:all',
  RECORD_WRITE_OWN: 'record:write:own',
  RECORD_WRITE_ALL: 'record:write:all',
  RECORD_EXPORT: 'record:export',

  // ABDM permissions
  ABDM_LINK: 'abdm:link',
  ABDM_FETCH: 'abdm:fetch',
  ABDM_PUSH: 'abdm:push',
  ABDM_CONSENT: 'abdm:consent',

  // HITL permissions
  HITL_VIEW_QUEUE: 'hitl:view:queue',
  HITL_VERIFY: 'hitl:verify',
  HITL_ASSIGN: 'hitl:assign',

  // Admin permissions
  USER_MANAGE: 'user:manage',
  SYSTEM_CONFIG: 'system:config',
  AUDIT_VIEW: 'audit:view',
};

// Role-to-permissions mapping
const ROLE_PERMISSIONS = {
  [ROLES.PATIENT]: [
    PERMISSIONS.SCAN_UPLOAD,
    PERMISSIONS.SCAN_READ_OWN,
    PERMISSIONS.SCAN_DELETE_OWN,
    PERMISSIONS.VOICE_UPLOAD,
    PERMISSIONS.VOICE_READ_OWN,
    PERMISSIONS.RECORD_READ_OWN,
    PERMISSIONS.RECORD_WRITE_OWN,
    PERMISSIONS.RECORD_EXPORT,
    PERMISSIONS.ABDM_LINK,
    PERMISSIONS.ABDM_FETCH,
    PERMISSIONS.ABDM_CONSENT,
  ],
  [ROLES.HEALTHCARE_PROVIDER]: [
    PERMISSIONS.SCAN_UPLOAD,
    PERMISSIONS.SCAN_READ_OWN,
    PERMISSIONS.SCAN_READ_ALL,
    PERMISSIONS.VOICE_UPLOAD,
    PERMISSIONS.VOICE_READ_OWN,
    PERMISSIONS.VOICE_READ_ALL,
    PERMISSIONS.RECORD_READ_OWN,
    PERMISSIONS.RECORD_READ_ALL,
    PERMISSIONS.RECORD_WRITE_OWN,
    PERMISSIONS.RECORD_WRITE_ALL,
    PERMISSIONS.RECORD_EXPORT,
    PERMISSIONS.ABDM_PUSH,
    PERMISSIONS.ABDM_FETCH,
    PERMISSIONS.ABDM_CONSENT,
  ],
  [ROLES.HITL_VERIFIER]: [
    PERMISSIONS.SCAN_READ_ALL,
    PERMISSIONS.HITL_VIEW_QUEUE,
    PERMISSIONS.HITL_VERIFY,
    PERMISSIONS.RECORD_READ_ALL,
  ],
  [ROLES.ADMIN]: [
    ...Object.values(PERMISSIONS), // Admins have all permissions
  ],
};

// API endpoint to permission mapping
const ENDPOINT_PERMISSIONS = {
  // Scan endpoints
  'POST /api/v1/scans/upload-url': [PERMISSIONS.SCAN_UPLOAD],
  'POST /api/v1/scans': [PERMISSIONS.SCAN_UPLOAD],
  'GET /api/v1/scans/:jobId': [PERMISSIONS.SCAN_READ_OWN, PERMISSIONS.SCAN_READ_ALL],
  'GET /api/v1/scans/:jobId/data': [PERMISSIONS.SCAN_READ_OWN, PERMISSIONS.SCAN_READ_ALL],
  'DELETE /api/v1/scans/:jobId': [PERMISSIONS.SCAN_DELETE_OWN, PERMISSIONS.SCAN_DELETE_ALL],

  // Voice endpoints
  'POST /api/v1/voice/upload-url': [PERMISSIONS.VOICE_UPLOAD],
  'POST /api/v1/voice/transcribe': [PERMISSIONS.VOICE_UPLOAD],
  'POST /api/v1/voice/:jobId/confirm': [PERMISSIONS.VOICE_READ_OWN, PERMISSIONS.VOICE_READ_ALL],

  // Patient record endpoints
  'GET /api/v1/patients/:id/records': [PERMISSIONS.RECORD_READ_OWN, PERMISSIONS.RECORD_READ_ALL],
  'GET /api/v1/patients/:id/summary': [PERMISSIONS.RECORD_READ_OWN, PERMISSIONS.RECORD_READ_ALL],
  'GET /api/v1/patients/:id/export': [PERMISSIONS.RECORD_EXPORT],
  'PUT /api/v1/patients/:id/records': [PERMISSIONS.RECORD_WRITE_OWN, PERMISSIONS.RECORD_WRITE_ALL],

  // ABDM endpoints
  'POST /api/v1/abdm/link': [PERMISSIONS.ABDM_LINK],
  'GET /api/v1/abdm/records': [PERMISSIONS.ABDM_FETCH],
  'POST /api/v1/abdm/push': [PERMISSIONS.ABDM_PUSH],
  'POST /api/v1/abdm/consent': [PERMISSIONS.ABDM_CONSENT],

  // HITL endpoints
  'GET /api/v1/hitl/queue': [PERMISSIONS.HITL_VIEW_QUEUE],
  'POST /api/v1/hitl/:jobId/verify': [PERMISSIONS.HITL_VERIFY],
  'POST /api/v1/hitl/:jobId/assign': [PERMISSIONS.HITL_ASSIGN],

  // Admin endpoints
  'GET /api/v1/admin/users': [PERMISSIONS.USER_MANAGE],
  'POST /api/v1/admin/users': [PERMISSIONS.USER_MANAGE],
  'PUT /api/v1/admin/users/:id': [PERMISSIONS.USER_MANAGE],
  'DELETE /api/v1/admin/users/:id': [PERMISSIONS.USER_MANAGE],
  'GET /api/v1/admin/audit': [PERMISSIONS.AUDIT_VIEW],
  'PUT /api/v1/admin/config': [PERMISSIONS.SYSTEM_CONFIG],
};

// Rate limiting tiers by role
const RATE_LIMITS = {
  [ROLES.PATIENT]: {
    requestsPerMinute: 100,
    burstCapacity: 200,
  },
  [ROLES.HEALTHCARE_PROVIDER]: {
    requestsPerMinute: 1000,
    burstCapacity: 2000,
  },
  [ROLES.HITL_VERIFIER]: {
    requestsPerMinute: 500,
    burstCapacity: 1000,
  },
  [ROLES.ADMIN]: {
    requestsPerMinute: 2000,
    burstCapacity: 4000,
  },
};

/**
 * Get permissions for a role
 */
function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get all permissions for a user based on their roles
 */
function getUserPermissions(userRoles) {
  if (!Array.isArray(userRoles)) {
    userRoles = [userRoles];
  }

  const permissions = new Set();
  userRoles.forEach((role) => {
    const rolePerms = getRolePermissions(role);
    rolePerms.forEach((perm) => permissions.add(perm));
  });

  return Array.from(permissions);
}

/**
 * Check if user has a specific permission
 */
function hasPermission(userRoles, requiredPermission) {
  const userPermissions = getUserPermissions(userRoles);
  return userPermissions.includes(requiredPermission);
}

/**
 * Check if user has any of the required permissions
 */
function hasAnyPermission(userRoles, requiredPermissions) {
  if (!Array.isArray(requiredPermissions)) {
    requiredPermissions = [requiredPermissions];
  }

  const userPermissions = getUserPermissions(userRoles);
  return requiredPermissions.some((perm) => userPermissions.includes(perm));
}

/**
 * Check if user has all required permissions
 */
function hasAllPermissions(userRoles, requiredPermissions) {
  if (!Array.isArray(requiredPermissions)) {
    requiredPermissions = [requiredPermissions];
  }

  const userPermissions = getUserPermissions(userRoles);
  return requiredPermissions.every((perm) => userPermissions.includes(perm));
}

/**
 * Get required permissions for an endpoint
 */
function getEndpointPermissions(method, path) {
  // Try exact match first
  const exactKey = `${method} ${path}`;
  if (ENDPOINT_PERMISSIONS[exactKey]) {
    return ENDPOINT_PERMISSIONS[exactKey];
  }

  // Normalize path by replacing last segment with :id or :jobId
  const pathSegments = path.split('/');
  if (pathSegments.length > 0) {
    const lastSegment = pathSegments[pathSegments.length - 1];

    // Check if last segment looks like an ID (not a known path segment)
    if (
      lastSegment &&
      ![
        'upload-url',
        'transcribe',
        'confirm',
        'records',
        'summary',
        'export',
        'link',
        'push',
        'consent',
        'queue',
        'verify',
        'assign',
        'users',
        'audit',
        'config',
      ].includes(lastSegment)
    ) {
      pathSegments[pathSegments.length - 1] = ':id';
      const normalizedPath = pathSegments.join('/');
      const normalizedKey = `${method} ${normalizedPath}`;

      if (ENDPOINT_PERMISSIONS[normalizedKey]) {
        return ENDPOINT_PERMISSIONS[normalizedKey];
      }

      // Try with :jobId for specific endpoints
      pathSegments[pathSegments.length - 1] = ':jobId';
      const jobIdPath = pathSegments.join('/');
      const jobIdKey = `${method} ${jobIdPath}`;

      if (ENDPOINT_PERMISSIONS[jobIdKey]) {
        return ENDPOINT_PERMISSIONS[jobIdKey];
      }
    }
  }

  return [];
}

/**
 * Check if user can access an endpoint
 */
function canAccessEndpoint(userRoles, method, path) {
  const requiredPermissions = getEndpointPermissions(method, path);

  if (requiredPermissions.length === 0) {
    // No specific permissions required
    return true;
  }

  // User needs at least one of the required permissions
  return hasAnyPermission(userRoles, requiredPermissions);
}

/**
 * Check if user owns a resource
 */
function ownsResource(userId, resourceOwnerId) {
  return userId === resourceOwnerId;
}

/**
 * Get rate limit for user based on their highest privilege role
 */
function getRateLimit(userRoles) {
  if (!Array.isArray(userRoles)) {
    userRoles = [userRoles];
  }

  // Priority order: Admin > HealthcareProvider > HITLVerifier > Patient
  const rolePriority = [ROLES.ADMIN, ROLES.HEALTHCARE_PROVIDER, ROLES.HITL_VERIFIER, ROLES.PATIENT];

  for (const role of rolePriority) {
    if (userRoles.includes(role)) {
      return RATE_LIMITS[role];
    }
  }

  // Default to patient limits
  return RATE_LIMITS[ROLES.PATIENT];
}

/**
 * Middleware to check permissions for an endpoint
 */
function requirePermission(requiredPermissions) {
  if (!Array.isArray(requiredPermissions)) {
    requiredPermissions = [requiredPermissions];
  }

  return (event) => {
    if (!event.user) {
      return {
        authorized: false,
        error: 'User context not found. Ensure auth middleware runs first.',
      };
    }

    const userRoles = event.user.groups || [];

    if (!hasAnyPermission(userRoles, requiredPermissions)) {
      return {
        authorized: false,
        error: `Insufficient permissions. Required: ${requiredPermissions.join(' or ')}`,
      };
    }

    return { authorized: true };
  };
}

/**
 * Middleware to check resource ownership
 */
function requireOwnership(getResourceOwnerId) {
  return async (event) => {
    if (!event.user) {
      return {
        authorized: false,
        error: 'User context not found. Ensure auth middleware runs first.',
      };
    }

    const userId = event.user.sub;
    const userRoles = event.user.groups || [];

    // Admins and healthcare providers can access all resources
    if (userRoles.includes(ROLES.ADMIN) || userRoles.includes(ROLES.HEALTHCARE_PROVIDER)) {
      return { authorized: true };
    }

    // Check ownership
    const resourceOwnerId = await getResourceOwnerId(event);

    if (!ownsResource(userId, resourceOwnerId)) {
      return {
        authorized: false,
        error: 'Access denied. You can only access your own resources.',
      };
    }

    return { authorized: true };
  };
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ENDPOINT_PERMISSIONS,
  RATE_LIMITS,
  getRolePermissions,
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getEndpointPermissions,
  canAccessEndpoint,
  ownsResource,
  getRateLimit,
  requirePermission,
  requireOwnership,
};
