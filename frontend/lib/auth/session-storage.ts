/**
 * Session Storage Service
 * Handles secure storage and retrieval of Cognito authentication tokens
 */

export interface CognitoTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

export interface SessionState {
  tokens: CognitoTokens | null;
  status: 'active' | 'expired' | 'refreshing' | 'unauthenticated';
  userId?: string;
  lastRefreshAt?: number;
}

const STORAGE_KEYS = {
  TOKENS: 'vaidyalink_auth_tokens',
  SESSION_STATE: 'vaidyalink_session_state',
  USER_ID: 'vaidyalink_user_id',
} as const;

/**
 * Session Storage Service
 * Provides secure storage for authentication tokens with encryption support
 */
export class SessionStorageService {
  private static instance: SessionStorageService;

  private constructor() {}

  static getInstance(): SessionStorageService {
    if (!SessionStorageService.instance) {
      SessionStorageService.instance = new SessionStorageService();
    }
    return SessionStorageService.instance;
  }

  /**
   * Store authentication tokens securely
   */
  setTokens(tokens: CognitoTokens): void {
    try {
      const encryptedTokens = this.encryptData(JSON.stringify(tokens));
      localStorage.setItem(STORAGE_KEYS.TOKENS, encryptedTokens);

      // Update session state
      this.updateSessionState({
        tokens,
        status: 'active',
        lastRefreshAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  /**
   * Retrieve stored authentication tokens
   */
  getTokens(): CognitoTokens | null {
    try {
      const encryptedTokens = localStorage.getItem(STORAGE_KEYS.TOKENS);
      if (!encryptedTokens) {
        return null;
      }

      const decryptedTokens = this.decryptData(encryptedTokens);
      const tokens = JSON.parse(decryptedTokens) as CognitoTokens;

      // Validate token structure
      if (!this.isValidTokenStructure(tokens)) {
        this.clearTokens();
        return null;
      }

      return tokens;
    } catch (error) {
      console.error('Failed to retrieve tokens:', error);
      this.clearTokens();
      return null;
    }
  }

  /**
   * Check if tokens are expired or about to expire
   * @param bufferMinutes - Minutes before expiration to consider token as expired (default: 5)
   */
  areTokensExpired(bufferMinutes: number = 5): boolean {
    const tokens = this.getTokens();
    if (!tokens) {
      return true;
    }

    const bufferMs = bufferMinutes * 60 * 1000;
    const now = Date.now();
    return now >= tokens.expiresAt - bufferMs;
  }

  /**
   * Get time until token expiration in milliseconds
   */
  getTimeUntilExpiration(): number | null {
    const tokens = this.getTokens();
    if (!tokens) {
      return null;
    }

    return Math.max(0, tokens.expiresAt - Date.now());
  }

  /**
   * Update session state
   */
  updateSessionState(state: Partial<SessionState>): void {
    try {
      const currentState = this.getSessionState();
      const newState = { ...currentState, ...state };
      localStorage.setItem(STORAGE_KEYS.SESSION_STATE, JSON.stringify(newState));
    } catch (error) {
      console.error('Failed to update session state:', error);
    }
  }

  /**
   * Get current session state
   */
  getSessionState(): SessionState {
    try {
      const stateStr = localStorage.getItem(STORAGE_KEYS.SESSION_STATE);
      if (!stateStr) {
        return { tokens: null, status: 'unauthenticated' };
      }
      return JSON.parse(stateStr) as SessionState;
    } catch (error) {
      console.error('Failed to get session state:', error);
      return { tokens: null, status: 'unauthenticated' };
    }
  }

  /**
   * Set user ID
   */
  setUserId(userId: string): void {
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    this.updateSessionState({ userId });
  }

  /**
   * Get user ID
   */
  getUserId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.USER_ID);
  }

  /**
   * Clear all stored tokens and session data
   */
  clearTokens(): void {
    localStorage.removeItem(STORAGE_KEYS.TOKENS);
    localStorage.removeItem(STORAGE_KEYS.SESSION_STATE);
    localStorage.removeItem(STORAGE_KEYS.USER_ID);
    // Keep legacy token for backward compatibility cleanup
    localStorage.removeItem('auth_token');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const tokens = this.getTokens();
    return tokens !== null && !this.areTokensExpired();
  }

  /**
   * Simple encryption for token storage
   * Note: This is basic obfuscation. For production, consider using Web Crypto API
   */
  private encryptData(data: string): string {
    // Base64 encoding with simple XOR cipher
    const key = this.getEncryptionKey();
    const encrypted = data
      .split('')
      .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
      .join('');
    return btoa(encrypted);
  }

  /**
   * Simple decryption for token storage
   */
  private decryptData(encryptedData: string): string {
    const key = this.getEncryptionKey();
    const decoded = atob(encryptedData);
    return decoded
      .split('')
      .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
      .join('');
  }

  /**
   * Get encryption key from environment or generate one
   */
  private getEncryptionKey(): string {
    // In production, this should come from environment variable
    return process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'vaidyalink-default-key-change-in-prod';
  }

  /**
   * Validate token structure
   */
  private isValidTokenStructure(tokens: any): tokens is CognitoTokens {
    return (
      tokens &&
      typeof tokens.idToken === 'string' &&
      typeof tokens.accessToken === 'string' &&
      typeof tokens.refreshToken === 'string' &&
      typeof tokens.expiresAt === 'number'
    );
  }

  /**
   * Parse JWT token to extract expiration time
   */
  static parseTokenExpiration(token: string): number {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000; // Convert to milliseconds
    } catch (error) {
      console.error('Failed to parse token expiration:', error);
      return Date.now(); // Return current time to trigger refresh
    }
  }

  /**
   * Extract user ID from ID token
   */
  static extractUserIdFromToken(idToken: string): string | null {
    try {
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      return payload.sub || payload['cognito:username'] || null;
    } catch (error) {
      console.error('Failed to extract user ID from token:', error);
      return null;
    }
  }
}

// Export singleton instance
export const sessionStorage = SessionStorageService.getInstance();
