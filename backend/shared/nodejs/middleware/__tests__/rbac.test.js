/**
 * Unit tests for RBAC system
 */

const {
  ROLES,
  PERMISSIONS,
  getRolePermissions,
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessEndpoint,
  ownsResource,
  getRateLimit,
  requirePermission,
  requireOwnership,
} = require('../rbac');

describe('RBAC System', () => {
  describe('getRolePermissions', () => {
    it('should return permissions for Patient role', () => {
      const permissions = getRolePermissions(ROLES.PATIENT);
      expect(permissions).toContain(PERMISSIONS.SCAN_UPLOAD);
      expect(permissions).toContain(PERMISSIONS.RECORD_READ_OWN);
      expect(permissions).not.toContain(PERMISSIONS.RECORD_READ_ALL);
    });

    it('should return permissions for HealthcareProvider role', () => {
      const permissions = getRolePermissions(ROLES.HEALTHCARE_PROVIDER);
      expect(permissions).toContain(PERMISSIONS.SCAN_READ_ALL);
      expect(permissions).toContain(PERMISSIONS.RECORD_WRITE_ALL);
      expect(permissions).toContain(PERMISSIONS.ABDM_PUSH);
    });

    it('should return all permissions for Admin role', () => {
      const permissions = getRolePermissions(ROLES.ADMIN);
      expect(permissions).toContain(PERMISSIONS.USER_MANAGE);
      expect(permissions).toContain(PERMISSIONS.SYSTEM_CONFIG);
      expect(permissions.length).toBeGreaterThan(20);
    });

    it('should return empty array for unknown role', () => {
      const permissions = getRolePermissions('UnknownRole');
      expect(permissions).toEqual([]);
    });
  });

  describe('getUserPermissions', () => {
    it('should return permissions for single role', () => {
      const permissions = getUserPermissions([ROLES.PATIENT]);
      expect(permissions).toContain(PERMISSIONS.SCAN_UPLOAD);
      expect(permissions).toContain(PERMISSIONS.RECORD_READ_OWN);
    });

    it('should combine permissions from multiple roles', () => {
      const permissions = getUserPermissions([ROLES.PATIENT, ROLES.HITL_VERIFIER]);
      expect(permissions).toContain(PERMISSIONS.SCAN_UPLOAD); // From Patient
      expect(permissions).toContain(PERMISSIONS.HITL_VERIFY); // From HITLVerifier
    });

    it('should deduplicate permissions', () => {
      const permissions = getUserPermissions([ROLES.PATIENT, ROLES.HEALTHCARE_PROVIDER]);
      const scanUploadCount = permissions.filter((p) => p === PERMISSIONS.SCAN_UPLOAD).length;
      expect(scanUploadCount).toBe(1);
    });

    it('should handle string input', () => {
      const permissions = getUserPermissions(ROLES.PATIENT);
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
    });
  });

  describe('hasPermission', () => {
    it('should return true if user has permission', () => {
      const result = hasPermission([ROLES.PATIENT], PERMISSIONS.SCAN_UPLOAD);
      expect(result).toBe(true);
    });

    it('should return false if user does not have permission', () => {
      const result = hasPermission([ROLES.PATIENT], PERMISSIONS.USER_MANAGE);
      expect(result).toBe(false);
    });

    it('should work with multiple roles', () => {
      const result = hasPermission([ROLES.PATIENT, ROLES.HITL_VERIFIER], PERMISSIONS.HITL_VERIFY);
      expect(result).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the required permissions', () => {
      const result = hasAnyPermission(
        [ROLES.PATIENT],
        [PERMISSIONS.SCAN_UPLOAD, PERMISSIONS.USER_MANAGE]
      );
      expect(result).toBe(true);
    });

    it('should return false if user has none of the required permissions', () => {
      const result = hasAnyPermission(
        [ROLES.PATIENT],
        [PERMISSIONS.USER_MANAGE, PERMISSIONS.SYSTEM_CONFIG]
      );
      expect(result).toBe(false);
    });

    it('should handle string input', () => {
      const result = hasAnyPermission([ROLES.PATIENT], PERMISSIONS.SCAN_UPLOAD);
      expect(result).toBe(true);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all required permissions', () => {
      const result = hasAllPermissions(
        [ROLES.PATIENT],
        [PERMISSIONS.SCAN_UPLOAD, PERMISSIONS.RECORD_READ_OWN]
      );
      expect(result).toBe(true);
    });

    it('should return false if user is missing any permission', () => {
      const result = hasAllPermissions(
        [ROLES.PATIENT],
        [PERMISSIONS.SCAN_UPLOAD, PERMISSIONS.USER_MANAGE]
      );
      expect(result).toBe(false);
    });
  });

  describe('canAccessEndpoint', () => {
    it('should allow Patient to upload scans', () => {
      const result = canAccessEndpoint([ROLES.PATIENT], 'POST', '/api/v1/scans');
      expect(result).toBe(true);
    });

    it('should allow HealthcareProvider to read all scans', () => {
      const result = canAccessEndpoint([ROLES.HEALTHCARE_PROVIDER], 'GET', '/api/v1/scans/job-123');
      expect(result).toBe(true);
    });

    it('should deny Patient from accessing admin endpoints', () => {
      const result = canAccessEndpoint([ROLES.PATIENT], 'GET', '/api/v1/admin/users');
      expect(result).toBe(false);
    });

    it('should allow Admin to access all endpoints', () => {
      const result = canAccessEndpoint([ROLES.ADMIN], 'GET', '/api/v1/admin/users');
      expect(result).toBe(true);
    });

    it('should allow access to endpoints without specific permissions', () => {
      const result = canAccessEndpoint([ROLES.PATIENT], 'GET', '/api/v1/health');
      expect(result).toBe(true);
    });
  });

  describe('ownsResource', () => {
    it('should return true if user owns resource', () => {
      const result = ownsResource('user-123', 'user-123');
      expect(result).toBe(true);
    });

    it('should return false if user does not own resource', () => {
      const result = ownsResource('user-123', 'user-456');
      expect(result).toBe(false);
    });
  });

  describe('getRateLimit', () => {
    it('should return Patient rate limit', () => {
      const limit = getRateLimit([ROLES.PATIENT]);
      expect(limit.requestsPerMinute).toBe(100);
      expect(limit.burstCapacity).toBe(200);
    });

    it('should return HealthcareProvider rate limit', () => {
      const limit = getRateLimit([ROLES.HEALTHCARE_PROVIDER]);
      expect(limit.requestsPerMinute).toBe(1000);
      expect(limit.burstCapacity).toBe(2000);
    });

    it('should return highest privilege rate limit for multiple roles', () => {
      const limit = getRateLimit([ROLES.PATIENT, ROLES.ADMIN]);
      expect(limit.requestsPerMinute).toBe(2000); // Admin limit
    });

    it('should prioritize HealthcareProvider over Patient', () => {
      const limit = getRateLimit([ROLES.PATIENT, ROLES.HEALTHCARE_PROVIDER]);
      expect(limit.requestsPerMinute).toBe(1000);
    });
  });

  describe('requirePermission middleware', () => {
    it('should authorize user with required permission', () => {
      const event = {
        user: {
          groups: [ROLES.PATIENT],
        },
      };

      const middleware = requirePermission([PERMISSIONS.SCAN_UPLOAD]);
      const result = middleware(event);

      expect(result.authorized).toBe(true);
    });

    it('should reject user without required permission', () => {
      const event = {
        user: {
          groups: [ROLES.PATIENT],
        },
      };

      const middleware = requirePermission([PERMISSIONS.USER_MANAGE]);
      const result = middleware(event);

      expect(result.authorized).toBe(false);
      expect(result.error).toContain('Insufficient permissions');
    });

    it('should reject if user context is missing', () => {
      const event = {};

      const middleware = requirePermission([PERMISSIONS.SCAN_UPLOAD]);
      const result = middleware(event);

      expect(result.authorized).toBe(false);
      expect(result.error).toContain('User context not found');
    });

    it('should handle string input', () => {
      const event = {
        user: {
          groups: [ROLES.PATIENT],
        },
      };

      const middleware = requirePermission(PERMISSIONS.SCAN_UPLOAD);
      const result = middleware(event);

      expect(result.authorized).toBe(true);
    });
  });

  describe('requireOwnership middleware', () => {
    it('should authorize resource owner', async () => {
      const event = {
        user: {
          sub: 'user-123',
          groups: [ROLES.PATIENT],
        },
      };

      const getResourceOwnerId = async () => 'user-123';
      const middleware = requireOwnership(getResourceOwnerId);
      const result = await middleware(event);

      expect(result.authorized).toBe(true);
    });

    it('should reject non-owner', async () => {
      const event = {
        user: {
          sub: 'user-123',
          groups: [ROLES.PATIENT],
        },
      };

      const getResourceOwnerId = async () => 'user-456';
      const middleware = requireOwnership(getResourceOwnerId);
      const result = await middleware(event);

      expect(result.authorized).toBe(false);
      expect(result.error).toContain('Access denied');
    });

    it('should allow Admin to access any resource', async () => {
      const event = {
        user: {
          sub: 'admin-123',
          groups: [ROLES.ADMIN],
        },
      };

      const getResourceOwnerId = async () => 'user-456';
      const middleware = requireOwnership(getResourceOwnerId);
      const result = await middleware(event);

      expect(result.authorized).toBe(true);
    });

    it('should allow HealthcareProvider to access any resource', async () => {
      const event = {
        user: {
          sub: 'provider-123',
          groups: [ROLES.HEALTHCARE_PROVIDER],
        },
      };

      const getResourceOwnerId = async () => 'user-456';
      const middleware = requireOwnership(getResourceOwnerId);
      const result = await middleware(event);

      expect(result.authorized).toBe(true);
    });
  });

  describe('Role hierarchy', () => {
    it('should give Admin all permissions', () => {
      const adminPerms = getUserPermissions([ROLES.ADMIN]);
      const patientPerms = getUserPermissions([ROLES.PATIENT]);
      const providerPerms = getUserPermissions([ROLES.HEALTHCARE_PROVIDER]);

      patientPerms.forEach((perm) => {
        expect(adminPerms).toContain(perm);
      });

      providerPerms.forEach((perm) => {
        expect(adminPerms).toContain(perm);
      });
    });

    it('should give HealthcareProvider more permissions than Patient', () => {
      const patientPerms = getUserPermissions([ROLES.PATIENT]);
      const providerPerms = getUserPermissions([ROLES.HEALTHCARE_PROVIDER]);

      expect(providerPerms.length).toBeGreaterThan(patientPerms.length);
      expect(providerPerms).toContain(PERMISSIONS.RECORD_READ_ALL);
      expect(patientPerms).not.toContain(PERMISSIONS.RECORD_READ_ALL);
    });
  });
});
