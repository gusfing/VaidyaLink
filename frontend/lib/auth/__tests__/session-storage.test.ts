import { SessionStorageService, CognitoTokens } from '../session-storage';

describe('SessionStorageService', () => {
  let service: SessionStorageService;
  let mockTokens: CognitoTokens;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    service = SessionStorageService.getInstance();

    mockTokens = {
      idToken: 'mock-id-token',
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + 3600000, // 1 hour from now
    };
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('setTokens and getTokens', () => {
    it('should store and retrieve tokens', () => {
      service.setTokens(mockTokens);
      const retrieved = service.getTokens();

      expect(retrieved).toEqual(mockTokens);
    });

    it('should encrypt tokens in storage', () => {
      service.setTokens(mockTokens);
      const rawStorage = localStorage.getItem('vaidyalink_auth_tokens');

      expect(rawStorage).toBeTruthy();
      expect(rawStorage).not.toContain('mock-id-token');
      expect(rawStorage).not.toContain('mock-access-token');
    });

    it('should return null when no tokens are stored', () => {
      const retrieved = service.getTokens();
      expect(retrieved).toBeNull();
    });

    it('should return null and clear storage on corrupted data', () => {
      localStorage.setItem('vaidyalink_auth_tokens', 'corrupted-data');
      const retrieved = service.getTokens();

      expect(retrieved).toBeNull();
      expect(localStorage.getItem('vaidyalink_auth_tokens')).toBeNull();
    });
  });

  describe('areTokensExpired', () => {
    it('should return false for valid tokens', () => {
      service.setTokens(mockTokens);
      expect(service.areTokensExpired()).toBe(false);
    });

    it('should return true for expired tokens', () => {
      const expiredTokens = {
        ...mockTokens,
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      };
      service.setTokens(expiredTokens);

      expect(service.areTokensExpired()).toBe(true);
    });

    it('should return true when tokens are about to expire within buffer', () => {
      const soonToExpireTokens = {
        ...mockTokens,
        expiresAt: Date.now() + 4 * 60 * 1000, // 4 minutes from now
      };
      service.setTokens(soonToExpireTokens);

      // Default buffer is 5 minutes
      expect(service.areTokensExpired(5)).toBe(true);
      expect(service.areTokensExpired(3)).toBe(false);
    });

    it('should return true when no tokens exist', () => {
      expect(service.areTokensExpired()).toBe(true);
    });
  });

  describe('getTimeUntilExpiration', () => {
    it('should return correct time until expiration', () => {
      const expiresIn = 3600000; // 1 hour
      const tokensWithExpiry = {
        ...mockTokens,
        expiresAt: Date.now() + expiresIn,
      };
      service.setTokens(tokensWithExpiry);

      const timeUntil = service.getTimeUntilExpiration();
      expect(timeUntil).toBeGreaterThan(expiresIn - 1000);
      expect(timeUntil).toBeLessThanOrEqual(expiresIn);
    });

    it('should return 0 for expired tokens', () => {
      const expiredTokens = {
        ...mockTokens,
        expiresAt: Date.now() - 1000,
      };
      service.setTokens(expiredTokens);

      expect(service.getTimeUntilExpiration()).toBe(0);
    });

    it('should return null when no tokens exist', () => {
      expect(service.getTimeUntilExpiration()).toBeNull();
    });
  });

  describe('session state management', () => {
    it('should update and retrieve session state', () => {
      service.updateSessionState({
        status: 'active',
        userId: 'user-123',
      });

      const state = service.getSessionState();
      expect(state.status).toBe('active');
      expect(state.userId).toBe('user-123');
    });

    it('should merge session state updates', () => {
      service.updateSessionState({ status: 'active' });
      service.updateSessionState({ userId: 'user-456' });

      const state = service.getSessionState();
      expect(state.status).toBe('active');
      expect(state.userId).toBe('user-456');
    });

    it('should return default state when no state is stored', () => {
      const state = service.getSessionState();
      expect(state).toEqual({
        tokens: null,
        status: 'unauthenticated',
      });
    });
  });

  describe('user ID management', () => {
    it('should set and get user ID', () => {
      service.setUserId('user-789');
      expect(service.getUserId()).toBe('user-789');
    });

    it('should return null when no user ID is set', () => {
      expect(service.getUserId()).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('should clear all stored data', () => {
      service.setTokens(mockTokens);
      service.setUserId('user-123');
      service.updateSessionState({ status: 'active' });

      service.clearTokens();

      expect(service.getTokens()).toBeNull();
      expect(service.getUserId()).toBeNull();
      expect(service.getSessionState()).toEqual({
        tokens: null,
        status: 'unauthenticated',
      });
    });
  });

  describe('isAuthenticated', () => {
    it('should return true for valid tokens', () => {
      service.setTokens(mockTokens);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false for expired tokens', () => {
      const expiredTokens = {
        ...mockTokens,
        expiresAt: Date.now() - 1000,
      };
      service.setTokens(expiredTokens);

      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return false when no tokens exist', () => {
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('static methods', () => {
    it('should parse token expiration correctly', () => {
      // Create a mock JWT token with expiration
      const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = { exp, sub: 'user-123' };
      const encodedPayload = btoa(JSON.stringify(payload));
      const mockToken = `header.${encodedPayload}.signature`;

      const expiresAt = SessionStorageService.parseTokenExpiration(mockToken);
      expect(expiresAt).toBe(exp * 1000);
    });

    it('should extract user ID from token', () => {
      const payload = { sub: 'user-456', 'cognito:username': 'testuser' };
      const encodedPayload = btoa(JSON.stringify(payload));
      const mockToken = `header.${encodedPayload}.signature`;

      const userId = SessionStorageService.extractUserIdFromToken(mockToken);
      expect(userId).toBe('user-456');
    });

    it('should return null for invalid token', () => {
      const userId = SessionStorageService.extractUserIdFromToken('invalid-token');
      expect(userId).toBeNull();
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SessionStorageService.getInstance();
      const instance2 = SessionStorageService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
