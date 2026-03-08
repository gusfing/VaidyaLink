import { TokenRefreshService } from '../token-refresh';
import { sessionStorage, CognitoTokens } from '../session-storage';

// Mock AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  InitiateAuthCommand: jest.fn(),
  AuthFlowType: {
    REFRESH_TOKEN_AUTH: 'REFRESH_TOKEN_AUTH',
  },
}));

describe('TokenRefreshService', () => {
  let service: TokenRefreshService;
  let mockTokens: CognitoTokens;

  beforeEach(() => {
    localStorage.clear();
    mockSend.mockClear();

    mockTokens = {
      idToken: 'mock-id-token',
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + 3600000,
    };

    service = new TokenRefreshService({
      region: 'ap-south-1',
      clientId: 'test-client-id',
      maxRetries: 3,
      baseDelayMs: 100,
    });
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('refreshTokens', () => {
    it('should successfully refresh tokens', async () => {
      sessionStorage.setTokens(mockTokens);

      const newIdToken = 'new-id-token';
      const newAccessToken = 'new-access-token';

      mockSend.mockResolvedValueOnce({
        AuthenticationResult: {
          IdToken: newIdToken,
          AccessToken: newAccessToken,
          ExpiresIn: 3600,
        },
      });

      const result = await service.refreshTokens();

      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.tokens?.idToken).toBe(newIdToken);
      expect(result.tokens?.accessToken).toBe(newAccessToken);
      expect(result.tokens?.refreshToken).toBe(mockTokens.refreshToken);
    });

    it('should return error when no refresh token exists', async () => {
      const result = await service.refreshTokens();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No refresh token available');
    });

    it('should retry on transient errors', async () => {
      sessionStorage.setTokens(mockTokens);

      // First two attempts fail, third succeeds
      mockSend
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          AuthenticationResult: {
            IdToken: 'new-id-token',
            AccessToken: 'new-access-token',
            ExpiresIn: 3600,
          },
        });

      const result = await service.refreshTokens();

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      sessionStorage.setTokens(mockTokens);

      const notAuthError = new Error('NotAuthorizedException');
      notAuthError.name = 'NotAuthorizedException';
      mockSend.mockRejectedValueOnce(notAuthError);

      const result = await service.refreshTokens();

      expect(result.success).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      sessionStorage.setTokens(mockTokens);

      mockSend.mockRejectedValue(new Error('Network error'));

      const result = await service.refreshTokens();

      expect(result.success).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should update session state during refresh', async () => {
      sessionStorage.setTokens(mockTokens);

      mockSend.mockResolvedValueOnce({
        AuthenticationResult: {
          IdToken: 'new-id-token',
          AccessToken: 'new-access-token',
          ExpiresIn: 3600,
        },
      });

      await service.refreshTokens();

      const state = sessionStorage.getSessionState();
      expect(state.status).toBe('active');
    });

    it('should handle concurrent refresh requests', async () => {
      sessionStorage.setTokens(mockTokens);

      mockSend.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  AuthenticationResult: {
                    IdToken: 'new-id-token',
                    AccessToken: 'new-access-token',
                    ExpiresIn: 3600,
                  },
                }),
              100
            )
          )
      );

      // Start multiple refresh requests concurrently
      const results = await Promise.all([
        service.refreshTokens(),
        service.refreshTokens(),
        service.refreshTokens(),
      ]);

      // Should only call the API once
      expect(mockSend).toHaveBeenCalledTimes(1);

      // All results should be successful
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('refreshIfNeeded', () => {
    it('should not refresh if tokens are still valid', async () => {
      sessionStorage.setTokens(mockTokens);

      const result = await service.refreshIfNeeded(5);

      expect(result.success).toBe(true);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should refresh if tokens are about to expire', async () => {
      const soonToExpireTokens = {
        ...mockTokens,
        expiresAt: Date.now() + 4 * 60 * 1000, // 4 minutes
      };
      sessionStorage.setTokens(soonToExpireTokens);

      mockSend.mockResolvedValueOnce({
        AuthenticationResult: {
          IdToken: 'new-id-token',
          AccessToken: 'new-access-token',
          ExpiresIn: 3600,
        },
      });

      const result = await service.refreshIfNeeded(5);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('setupAutoRefresh', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should setup automatic refresh interval', () => {
      const cleanup = service.setupAutoRefresh(5);

      expect(cleanup).toBeInstanceOf(Function);
      cleanup();
    });

    it('should trigger refresh when tokens expire', async () => {
      const soonToExpireTokens = {
        ...mockTokens,
        expiresAt: Date.now() + 4 * 60 * 1000,
      };
      sessionStorage.setTokens(soonToExpireTokens);

      mockSend.mockResolvedValue({
        AuthenticationResult: {
          IdToken: 'new-id-token',
          AccessToken: 'new-access-token',
          ExpiresIn: 3600,
        },
      });

      const cleanup = service.setupAutoRefresh(5);

      // Fast-forward time by 1 minute
      jest.advanceTimersByTime(60000);

      // Wait for async operations
      await Promise.resolve();

      expect(mockSend).toHaveBeenCalled();
      cleanup();
    });
  });

  describe('isCurrentlyRefreshing', () => {
    it('should return false when not refreshing', () => {
      expect(service.isCurrentlyRefreshing()).toBe(false);
    });

    it('should return true during refresh', async () => {
      sessionStorage.setTokens(mockTokens);

      mockSend.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  AuthenticationResult: {
                    IdToken: 'new-id-token',
                    AccessToken: 'new-access-token',
                    ExpiresIn: 3600,
                  },
                }),
              100
            )
          )
      );

      const refreshPromise = service.refreshTokens();

      expect(service.isCurrentlyRefreshing()).toBe(true);

      await refreshPromise;

      expect(service.isCurrentlyRefreshing()).toBe(false);
    });
  });
});
