import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { sessionStorage, type CognitoTokens } from './session-storage';

interface TokenRefreshConfig {
  region: string;
  clientId: string;
  maxRetries?: number;
  baseDelayMs?: number;
}

interface RefreshResult {
  success: boolean;
  tokens?: CognitoTokens;
  error?: string;
}

/**
 * Token Refresh Service
 * Handles automatic token refresh with exponential backoff retry logic
 */
export class TokenRefreshService {
  private client: CognitoIdentityProviderClient;
  private config: TokenRefreshConfig;
  private refreshPromise: Promise<RefreshResult> | null = null;
  private isRefreshing = false;

  constructor(config: TokenRefreshConfig) {
    this.config = {
      maxRetries: 3,
      baseDelayMs: 1000,
      ...config,
    };
    this.client = new CognitoIdentityProviderClient({ region: config.region });
  }

  /**
   * Refresh authentication tokens using refresh token
   * Implements exponential backoff retry logic
   */
  async refreshTokens(): Promise<RefreshResult> {
    // If already refreshing, return the existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.executeRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Execute token refresh with retry logic
   */
  private async executeRefresh(): Promise<RefreshResult> {
    const currentTokens = sessionStorage.getTokens();

    if (!currentTokens?.refreshToken) {
      return {
        success: false,
        error: 'No refresh token available',
      };
    }

    // Update session state to refreshing
    sessionStorage.updateSessionState({ status: 'refreshing' });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      try {
        const command = new InitiateAuthCommand({
          AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
          ClientId: this.config.clientId,
          AuthParameters: {
            REFRESH_TOKEN: currentTokens.refreshToken,
          },
        });

        const response = await this.client.send(command);

        if (!response.AuthenticationResult) {
          throw new Error('No authentication result in refresh response');
        }

        const { IdToken, AccessToken, ExpiresIn } = response.AuthenticationResult;

        if (!IdToken || !AccessToken) {
          throw new Error('Missing tokens in refresh response');
        }

        // Calculate expiration time
        const expiresAt = Date.now() + (ExpiresIn || 3600) * 1000;

        const newTokens: CognitoTokens = {
          idToken: IdToken,
          accessToken: AccessToken,
          refreshToken: currentTokens.refreshToken, // Refresh token stays the same
          expiresAt,
        };

        // Store new tokens
        sessionStorage.setTokens(newTokens);

        return {
          success: true,
          tokens: newTokens,
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`Token refresh attempt ${attempt + 1} failed:`, error);

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.config.maxRetries!) {
          const delay = this.calculateBackoffDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    sessionStorage.updateSessionState({ status: 'expired' });

    return {
      success: false,
      error: lastError?.message || 'Token refresh failed after all retries',
    };
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    const nonRetryableErrors = [
      'NotAuthorizedException',
      'InvalidParameterException',
      'ResourceNotFoundException',
    ];

    const errorName = error?.name || error?.__type || '';
    return nonRetryableErrors.some((name) => errorName.includes(name));
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = this.config.baseDelayMs!;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if tokens need refresh and refresh if necessary
   * @param bufferMinutes - Minutes before expiration to trigger refresh
   */
  async refreshIfNeeded(bufferMinutes: number = 5): Promise<RefreshResult> {
    if (!sessionStorage.areTokensExpired(bufferMinutes)) {
      const tokens = sessionStorage.getTokens();
      return {
        success: true,
        tokens: tokens || undefined,
      };
    }

    return this.refreshTokens();
  }

  /**
   * Setup automatic token refresh
   * Returns cleanup function
   */
  setupAutoRefresh(bufferMinutes: number = 5): () => void {
    const checkInterval = 60000; // Check every minute

    const intervalId = setInterval(async () => {
      if (sessionStorage.areTokensExpired(bufferMinutes)) {
        await this.refreshTokens();
      }
    }, checkInterval);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }

  /**
   * Get current refresh status
   */
  isCurrentlyRefreshing(): boolean {
    return this.refreshPromise !== null;
  }
}

/**
 * Create token refresh service from environment variables
 */
export function createTokenRefreshService(): TokenRefreshService {
  const config: TokenRefreshConfig = {
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-south-1',
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
    maxRetries: 3,
    baseDelayMs: 1000,
  };

  if (!config.clientId) {
    throw new Error('Missing NEXT_PUBLIC_COGNITO_CLIENT_ID in environment variables');
  }

  return new TokenRefreshService(config);
}

// Export singleton instance
let tokenRefreshServiceInstance: TokenRefreshService | null = null;

export function getTokenRefreshService(): TokenRefreshService {
  if (!tokenRefreshServiceInstance) {
    tokenRefreshServiceInstance = createTokenRefreshService();
  }
  return tokenRefreshServiceInstance;
}
