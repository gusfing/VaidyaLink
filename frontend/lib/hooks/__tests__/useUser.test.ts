import { renderHook, waitFor } from '@testing-library/react';
import { useUser, type UserRole } from '../useUser';
import { useSession } from '../useSession';

// Mock dependencies
jest.mock('../useSession');
jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({
      send: mockSend,
    })),
    GetUserCommand: jest.fn(),
    UpdateUserAttributesCommand: jest.fn(),
    __mockSend: mockSend,
  };
});

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

describe('useUser', () => {
  const mockTokens = {
    idToken: createMockIdToken({
      sub: 'user-123',
      'cognito:username': 'testuser',
      email: 'test@example.com',
      email_verified: true,
      phone_number: '+919876543210',
      phone_number_verified: true,
      name: 'Test User',
      'cognito:groups': ['Patient'],
      'custom:abha_id': '12-3456-7890-1234',
      'custom:preferred_language': 'hi',
    }),
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: Date.now() + 3600000,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for useSession
    mockUseSession.mockReturnValue({
      tokens: mockTokens,
      sessionState: { tokens: mockTokens, status: 'active' },
      isAuthenticated: true,
      isRefreshing: false,
      error: null,
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      setTokens: jest.fn(),
    });

    // Mock AWS SDK send function
    const { __mockSend } = require('@aws-sdk/client-cognito-identity-provider');
    __mockSend.mockResolvedValue({
      Username: 'testuser',
      UserAttributes: [
        { Name: 'sub', Value: 'user-123' },
        { Name: 'email', Value: 'test@example.com' },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'phone_number', Value: '+919876543210' },
        { Name: 'phone_number_verified', Value: 'true' },
        { Name: 'name', Value: 'Test User' },
        { Name: 'custom:abha_id', Value: '12-3456-7890-1234' },
        { Name: 'custom:preferred_language', Value: 'hi' },
      ],
      UserCreateDate: new Date('2024-01-01'),
      UserLastModifiedDate: new Date('2024-01-15'),
    });
  });

  describe('User Profile Loading', () => {
    it('should load user profile when authenticated', async () => {
      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      expect(result.current.user).toMatchObject({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        emailVerified: true,
        phone: '+919876543210',
        phoneVerified: true,
        name: 'Test User',
        roles: ['Patient'],
        abhaId: '12-3456-7890-1234',
        preferredLanguage: 'hi',
      });
    });

    it('should not load user when not authenticated', () => {
      mockUseSession.mockReturnValue({
        tokens: null,
        sessionState: { tokens: null, status: 'unauthenticated' },
        isAuthenticated: false,
        isRefreshing: false,
        error: null,
        refreshTokens: jest.fn(),
        logout: jest.fn(),
        setTokens: jest.fn(),
      });

      const { result } = renderHook(() => useUser());

      expect(result.current.user).toBeNull();
      expect(result.current.permissions).toBeNull();
    });
  });

  describe('Roles and Permissions', () => {
    it('should calculate permissions for Patient role', async () => {
      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.permissions).not.toBeNull();
      });

      expect(result.current.permissions).toMatchObject({
        canUploadScans: true,
        canReadOwnScans: true,
        canReadAllScans: false,
        canDeleteOwnScans: true,
        canDeleteAllScans: false,
        canManageUsers: false,
      });
    });

    it('should check if user has a specific role', async () => {
      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      expect(result.current.hasRole('Patient')).toBe(true);
      expect(result.current.hasRole('Admin')).toBe(false);
    });

    it('should check if user has a specific permission', async () => {
      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.permissions).not.toBeNull();
      });

      expect(result.current.hasPermission('canUploadScans')).toBe(true);
      expect(result.current.hasPermission('canManageUsers')).toBe(false);
    });

    it('should check if user has any of specified roles', async () => {
      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      expect(result.current.hasAnyRole(['Patient', 'Admin'])).toBe(true);
      expect(result.current.hasAnyRole(['Admin', 'HealthcareProvider'])).toBe(false);
    });

    it('should default to Patient role when no groups specified', async () => {
      const noRoleTokens = {
        ...mockTokens,
        idToken: createMockIdToken({
          sub: 'user-123',
          'cognito:username': 'testuser',
          email: 'test@example.com',
        }),
      };

      mockUseSession.mockReturnValue({
        tokens: noRoleTokens,
        sessionState: { tokens: noRoleTokens, status: 'active' },
        isAuthenticated: true,
        isRefreshing: false,
        error: null,
        refreshTokens: jest.fn(),
        logout: jest.fn(),
        setTokens: jest.fn(),
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      expect(result.current.user?.roles).toEqual(['Patient']);
    });
  });
});

/**
 * Helper to create mock ID token
 */
function createMockIdToken(payload: Record<string, any>): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = 'mock-signature';

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
