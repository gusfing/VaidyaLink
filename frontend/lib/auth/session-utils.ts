import { sessionStorage, SessionStorageService } from './session-storage';
import { getTokenRefreshService } from './token-refresh';

/**
 * Session management utilities
 */

/**
 * Initialize session from Cognito authentication response
 */
export function initializeSession(authResult: {
  IdToken: string;
  AccessToken: string;
  RefreshToken: string;
  ExpiresIn?: number;
}): void {
  const expiresAt = Date.now() + (authResult.ExpiresIn || 3600) * 1000;

  sessionStorage.setTokens({
    idToken: authResult.IdToken,
    accessToken: authResult.AccessToken,
    refreshToken: authResult.RefreshToken,
    expiresAt,
  });

  // Extract and store user ID
  const userId = SessionStorageService.extractUserIdFromToken(authResult.IdToken);
  if (userId) {
    sessionStorage.setUserId(userId);
  }
}

/**
 * Check if session is valid and refresh if needed
 */
export async function ensureValidSession(): Promise<boolean> {
  if (!sessionStorage.isAuthenticated()) {
    return false;
  }

  if (sessionStorage.areTokensExpired(5)) {
    const tokenRefreshService = getTokenRefreshService();
    const result = await tokenRefreshService.refreshTokens();
    return result.success;
  }

  return true;
}

/**
 * Get current access token, refreshing if necessary
 */
export async function getAccessToken(): Promise<string | null> {
  const isValid = await ensureValidSession();
  if (!isValid) {
    return null;
  }

  const tokens = sessionStorage.getTokens();
  return tokens?.accessToken || null;
}

/**
 * Get current ID token, refreshing if necessary
 */
export async function getIdToken(): Promise<string | null> {
  const isValid = await ensureValidSession();
  if (!isValid) {
    return null;
  }

  const tokens = sessionStorage.getTokens();
  return tokens?.idToken || null;
}

/**
 * Terminate session and clear all data
 */
export function terminateSession(): void {
  sessionStorage.clearTokens();
}

/**
 * Get session expiration info
 */
export function getSessionExpirationInfo(): {
  isExpired: boolean;
  expiresAt: number | null;
  timeUntilExpiration: number | null;
} {
  const tokens = sessionStorage.getTokens();

  if (!tokens) {
    return {
      isExpired: true,
      expiresAt: null,
      timeUntilExpiration: null,
    };
  }

  return {
    isExpired: sessionStorage.areTokensExpired(),
    expiresAt: tokens.expiresAt,
    timeUntilExpiration: sessionStorage.getTimeUntilExpiration(),
  };
}

/**
 * Parse user information from ID token
 */
export function parseUserFromToken(idToken: string): {
  id: string;
  username?: string;
  email?: string;
  phone?: string;
  name?: string;
} | null {
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    return {
      id: payload.sub,
      username: payload['cognito:username'],
      email: payload.email,
      phone: payload.phone_number,
      name: payload.name,
    };
  } catch (error) {
    console.error('Failed to parse user from token:', error);
    return null;
  }
}

/**
 * Check if user has specific role
 */
export function hasRole(role: string): boolean {
  const tokens = sessionStorage.getTokens();
  if (!tokens?.idToken) {
    return false;
  }

  try {
    const payload = JSON.parse(atob(tokens.idToken.split('.')[1]));
    const roles = payload['cognito:groups'] || [];
    return roles.includes(role);
  } catch (error) {
    console.error('Failed to check user role:', error);
    return false;
  }
}

/**
 * Get user roles from token
 */
export function getUserRoles(): string[] {
  const tokens = sessionStorage.getTokens();
  if (!tokens?.idToken) {
    return [];
  }

  try {
    const payload = JSON.parse(atob(tokens.idToken.split('.')[1]));
    return payload['cognito:groups'] || [];
  } catch (error) {
    console.error('Failed to get user roles:', error);
    return [];
  }
}

/**
 * Session timeout handler
 * Call this to setup automatic logout on session timeout
 */
export function setupSessionTimeout(onTimeout: () => void): () => void {
  const checkInterval = 60000; // Check every minute

  const intervalId = setInterval(() => {
    const { isExpired } = getSessionExpirationInfo();
    if (isExpired) {
      onTimeout();
    }
  }, checkInterval);

  return () => clearInterval(intervalId);
}

/**
 * Get session duration in milliseconds
 */
export function getSessionDuration(): number | null {
  const tokens = sessionStorage.getTokens();
  if (!tokens) {
    return null;
  }

  const state = sessionStorage.getSessionState();
  if (!state.lastRefreshAt) {
    return null;
  }

  return Date.now() - state.lastRefreshAt;
}
