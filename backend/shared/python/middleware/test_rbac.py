"""
Unit tests for RBAC system
"""

import pytest
from .rbac import (
    Role,
    Permission,
    get_role_permissions,
    get_user_permissions,
    has_permission,
    has_any_permission,
    has_all_permissions,
    can_access_endpoint,
    owns_resource,
    get_rate_limit,
    require_permission,
    require_ownership,
)


class TestRolePermissions:
    def test_patient_permissions(self):
        """Patient should have basic permissions"""
        permissions = get_role_permissions(Role.PATIENT)
        assert Permission.SCAN_UPLOAD in permissions
        assert Permission.RECORD_READ_OWN in permissions
        assert Permission.RECORD_READ_ALL not in permissions

    def test_healthcare_provider_permissions(self):
        """HealthcareProvider should have elevated permissions"""
        permissions = get_role_permissions(Role.HEALTHCARE_PROVIDER)
        assert Permission.SCAN_READ_ALL in permissions
        assert Permission.RECORD_WRITE_ALL in permissions
        assert Permission.ABDM_PUSH in permissions

    def test_admin_permissions(self):
        """Admin should have all permissions"""
        permissions = get_role_permissions(Role.ADMIN)
        assert Permission.USER_MANAGE in permissions
        assert Permission.SYSTEM_CONFIG in permissions
        assert len(permissions) > 20

    def test_unknown_role(self):
        """Unknown role should return empty permissions"""
        permissions = get_role_permissions("UnknownRole")
        assert permissions == []


class TestUserPermissions:
    def test_single_role(self):
        """User with single role should get role permissions"""
        permissions = get_user_permissions([Role.PATIENT])
        assert Permission.SCAN_UPLOAD in permissions
        assert Permission.RECORD_READ_OWN in permissions

    def test_multiple_roles(self):
        """User with multiple roles should get combined permissions"""
        permissions = get_user_permissions([Role.PATIENT, Role.HITL_VERIFIER])
        assert Permission.SCAN_UPLOAD in permissions  # From Patient
        assert Permission.HITL_VERIFY in permissions  # From HITLVerifier

    def test_deduplication(self):
        """Permissions should be deduplicated"""
        permissions = get_user_permissions([Role.PATIENT, Role.HEALTHCARE_PROVIDER])
        scan_upload_count = permissions.count(Permission.SCAN_UPLOAD)
        assert scan_upload_count == 1

    def test_string_input(self):
        """Should handle string input"""
        permissions = get_user_permissions(Role.PATIENT)
        assert isinstance(permissions, list)
        assert len(permissions) > 0


class TestPermissionChecks:
    def test_has_permission_true(self):
        """User should have permission"""
        result = has_permission([Role.PATIENT], Permission.SCAN_UPLOAD)
        assert result is True

    def test_has_permission_false(self):
        """User should not have permission"""
        result = has_permission([Role.PATIENT], Permission.USER_MANAGE)
        assert result is False

    def test_has_permission_multiple_roles(self):
        """User with multiple roles should have combined permissions"""
        result = has_permission([Role.PATIENT, Role.HITL_VERIFIER], Permission.HITL_VERIFY)
        assert result is True

    def test_has_any_permission_true(self):
        """User should have at least one permission"""
        result = has_any_permission(
            [Role.PATIENT], [Permission.SCAN_UPLOAD, Permission.USER_MANAGE]
        )
        assert result is True

    def test_has_any_permission_false(self):
        """User should not have any permission"""
        result = has_any_permission(
            [Role.PATIENT], [Permission.USER_MANAGE, Permission.SYSTEM_CONFIG]
        )
        assert result is False

    def test_has_all_permissions_true(self):
        """User should have all permissions"""
        result = has_all_permissions(
            [Role.PATIENT], [Permission.SCAN_UPLOAD, Permission.RECORD_READ_OWN]
        )
        assert result is True

    def test_has_all_permissions_false(self):
        """User should not have all permissions"""
        result = has_all_permissions(
            [Role.PATIENT], [Permission.SCAN_UPLOAD, Permission.USER_MANAGE]
        )
        assert result is False


class TestEndpointAccess:
    def test_patient_can_upload_scans(self):
        """Patient should be able to upload scans"""
        result = can_access_endpoint([Role.PATIENT], "POST", "/api/v1/scans")
        assert result is True

    def test_provider_can_read_all_scans(self):
        """HealthcareProvider should be able to read all scans"""
        result = can_access_endpoint(
            [Role.HEALTHCARE_PROVIDER], "GET", "/api/v1/scans/job-123"
        )
        assert result is True

    def test_patient_cannot_access_admin(self):
        """Patient should not access admin endpoints"""
        result = can_access_endpoint([Role.PATIENT], "GET", "/api/v1/admin/users")
        assert result is False

    def test_admin_can_access_all(self):
        """Admin should access all endpoints"""
        result = can_access_endpoint([Role.ADMIN], "GET", "/api/v1/admin/users")
        assert result is True

    def test_unrestricted_endpoint(self):
        """Endpoints without permissions should be accessible"""
        result = can_access_endpoint([Role.PATIENT], "GET", "/api/v1/health")
        assert result is True


class TestResourceOwnership:
    def test_owns_resource_true(self):
        """User should own resource"""
        result = owns_resource("user-123", "user-123")
        assert result is True

    def test_owns_resource_false(self):
        """User should not own resource"""
        result = owns_resource("user-123", "user-456")
        assert result is False


class TestRateLimits:
    def test_patient_rate_limit(self):
        """Patient should have basic rate limit"""
        limit = get_rate_limit([Role.PATIENT])
        assert limit["requests_per_minute"] == 100
        assert limit["burst_capacity"] == 200

    def test_provider_rate_limit(self):
        """HealthcareProvider should have higher rate limit"""
        limit = get_rate_limit([Role.HEALTHCARE_PROVIDER])
        assert limit["requests_per_minute"] == 1000
        assert limit["burst_capacity"] == 2000

    def test_multiple_roles_highest_limit(self):
        """Multiple roles should get highest privilege limit"""
        limit = get_rate_limit([Role.PATIENT, Role.ADMIN])
        assert limit["requests_per_minute"] == 2000  # Admin limit

    def test_role_priority(self):
        """HealthcareProvider should have priority over Patient"""
        limit = get_rate_limit([Role.PATIENT, Role.HEALTHCARE_PROVIDER])
        assert limit["requests_per_minute"] == 1000


class TestRequirePermissionMiddleware:
    def test_authorized_user(self):
        """User with permission should be authorized"""
        event = {"user": {"groups": [Role.PATIENT]}}

        middleware = require_permission([Permission.SCAN_UPLOAD])
        result = middleware(event)

        assert result["authorized"] is True

    def test_unauthorized_user(self):
        """User without permission should be rejected"""
        event = {"user": {"groups": [Role.PATIENT]}}

        middleware = require_permission([Permission.USER_MANAGE])
        result = middleware(event)

        assert result["authorized"] is False
        assert "Insufficient permissions" in result["error"]

    def test_missing_user_context(self):
        """Missing user context should be rejected"""
        event = {}

        middleware = require_permission([Permission.SCAN_UPLOAD])
        result = middleware(event)

        assert result["authorized"] is False
        assert "User context not found" in result["error"]


class TestRequireOwnershipMiddleware:
    @pytest.mark.asyncio
    async def test_resource_owner(self):
        """Resource owner should be authorized"""
        event = {"user": {"sub": "user-123", "groups": [Role.PATIENT]}}

        async def get_owner(event):
            return "user-123"

        middleware = require_ownership(get_owner)
        result = await middleware(event)

        assert result["authorized"] is True

    @pytest.mark.asyncio
    async def test_non_owner(self):
        """Non-owner should be rejected"""
        event = {"user": {"sub": "user-123", "groups": [Role.PATIENT]}}

        async def get_owner(event):
            return "user-456"

        middleware = require_ownership(get_owner)
        result = await middleware(event)

        assert result["authorized"] is False
        assert "Access denied" in result["error"]

    @pytest.mark.asyncio
    async def test_admin_access(self):
        """Admin should access any resource"""
        event = {"user": {"sub": "admin-123", "groups": [Role.ADMIN]}}

        async def get_owner(event):
            return "user-456"

        middleware = require_ownership(get_owner)
        result = await middleware(event)

        assert result["authorized"] is True

    @pytest.mark.asyncio
    async def test_provider_access(self):
        """HealthcareProvider should access any resource"""
        event = {"user": {"sub": "provider-123", "groups": [Role.HEALTHCARE_PROVIDER]}}

        async def get_owner(event):
            return "user-456"

        middleware = require_ownership(get_owner)
        result = await middleware(event)

        assert result["authorized"] is True


class TestRoleHierarchy:
    def test_admin_has_all_permissions(self):
        """Admin should have all permissions"""
        admin_perms = get_user_permissions([Role.ADMIN])
        patient_perms = get_user_permissions([Role.PATIENT])
        provider_perms = get_user_permissions([Role.HEALTHCARE_PROVIDER])

        for perm in patient_perms:
            assert perm in admin_perms

        for perm in provider_perms:
            assert perm in admin_perms

    def test_provider_more_than_patient(self):
        """HealthcareProvider should have more permissions than Patient"""
        patient_perms = get_user_permissions([Role.PATIENT])
        provider_perms = get_user_permissions([Role.HEALTHCARE_PROVIDER])

        assert len(provider_perms) > len(patient_perms)
        assert Permission.RECORD_READ_ALL in provider_perms
        assert Permission.RECORD_READ_ALL not in patient_perms
