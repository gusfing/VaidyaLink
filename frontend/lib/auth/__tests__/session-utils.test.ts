import {
  initializeSession,
  getSessionExpirationInfo,
  parseUserFromToken,
  hasRole,
  getUserRoles,
  getSessionDuration,
} from '../session-utils';
import { sessionStorage } from '../session-storage';

describe('Session Utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initializeSession', () => {
    it('should initialize session with auth result', () => {
      const authResult = {
        IdToken: 'mock-id-token',
        AccessToken: 'mock-access-token',
        RefreshToken: 'mock-refresh-token',
        ExpiresIn: 3600,
      };

      initializeSession(authResult);

      const tokens = sessionStorage.getTokens();
      expect(tokens).toBeDefined();
      expect(tokens?.idToken).toBe(authResult.IdToken);
      expect(tokens?.accessToken).toBe(authResult.AccessToken);
      expect(tokens?.refreshToken).toBe(authResult.RefreshToken);
    });

    it('should use default expiration if not provided', () => {
      const authResult = {
        IdToken: 'mock-id-token',
        AccessToken: 'mock-access-token',
        RefreshToken: 'mock-refresh-token',
      };

      initializeSession(authResult);

      const tokens = sessionStorage.getTokens();
      expect(tokens).toBeDefined();
      expect(tokens?.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('getSessionExpirationInfo', () => {
    it('should return expiration info for valid session', () => {
      const expiresAt = Date.now() + 3600000;
      sessionStorage.setTokens({
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt,
      });

      const info = getSessionExpirationInfo();

      expect(info.isExpired).toBe(false);
      expect(info.expiresAt).toBe(expiresAt);
      expect(info.timeUntilExpiration).toBeGreaterThan(0);
    });

    it('should return expired info for expired session', () => {
      const expiresAt = Date.now() - 1000;
      sessionStorage.setTokens({
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt,
      });

      const info = getSessionExpirationInfo();

      expect(info.isExpired).toBe(true);
      expect(info.expiresAt).toBe(expiresAt);
      expect(info.timeUntilExpiration).toBe(0);
    });

    it('should return null values when no session exists', () => {
      const info = getSessionExpirationInfo();

      expect(info.isExpired).toBe(true);
      expect(info.expiresAt).toBeNull();
      expect(info.timeUntilExpiration).toBeNull();
    });
  });

  describe('parseUserFromToken', () => {
    it('should parse user information from valid token', () => {
      const payload = {
        sub: 'user-123',
        'cognito:username': 'testuser',
        email: 'test@example.com',
        phone_number: '+1234567890',
        name: 'Test User',
      };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      const user = parseUserFromToken(token);

      expect(user).toBeDefined();
      expect(user?.id).toBe('user-123');
      expect(user?.username).toBe('testuser');
      expect(user?.email).toBe('test@example.com');
      expect(user?.phone).toBe('+1234567890');
      expect(user?.name).toBe('Test User');
    });

    it('should return null for invalid token', () => {
      const user = parseUserFromToken('invalid-token');
      expect(user).toBeNull();
    });
  });

  describe('hasRole', () => {
    it('should return true if user has role', () => {
      const payload = {
        sub: 'user-123',
        'cognito:groups': ['admin', 'doctor'],
      };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      sessionStorage.setTokens({
        idToken: token,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: Date.now() + 3600000,
      });

      expect(hasRole('admin')).toBe(true);
      expect(hasRole('doctor')).toBe(true);
      expect(hasRole('patient')).toBe(false);
    });

    it('should return false when no session exists', () => {
      expect(hasRole('admin')).toBe(false);
    });

    it('should return false when user has no roles', () => {
      const payload = {
        sub: 'user-123',
      };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      sessionStorage.setTokens({
        idToken: token,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: Date.now() + 3600000,
      });

      expect(hasRole('admin')).toBe(false);
    });
  });

  describe('getUserRoles', () => {
    it('should return user roles from token', () => {
      const payload = {
        sub: 'user-123',
        'cognito:groups': ['admin', 'doctor', 'verifier'],
      };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      sessionStorage.setTokens({
        idToken: token,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: Date.now() + 3600000,
      });

      const roles = getUserRoles();

      expect(roles).toEqual(['admin', 'doctor', 'verifier']);
    });

    it('should return empty array when no session exists', () => {
      const roles = getUserRoles();
      expect(roles).toEqual([]);
    });

    it('should return empty array when user has no roles', () => {
      const payload = {
        sub: 'user-123',
      };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      sessionStorage.setTokens({
        idToken: token,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: Date.now() + 3600000,
      });

      const roles = getUserRoles();
      expect(roles).toEqual([]);
    });
  });

  describe('getSessionDuration', () => {
    it('should return session duration', () => {
      const lastRefreshAt = Date.now() - 60000; // 1 minute ago

      sessionStorage.setTokens({
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: Date.now() + 3600000,
      });

      sessionStorage.updateSessionState({ lastRefreshAt });

      const duration = getSessionDuration();

      expect(duration).toBeGreaterThanOrEqual(60000);
      expect(duration).toBeLessThan(70000); // Allow some margin
    });

    it('should return null when no session exists', () => {
      const duration = getSessionDuration();
      expect(duration).toBeNull();
    });

    it('should return null when no lastRefreshAt exists', () => {
      sessionStorage.setTokens({
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: Date.now() + 3600000,
      });

      // Clear lastRefreshAt
      sessionStorage.updateSessionState({ lastRefreshAt: undefined });

      const duration = getSessionDuration();
      expect(duration).toBeNull();
    });
  });
});
