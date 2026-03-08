import { useState, useEffect, useCallback, useRef } from 'react';
import {
  sessionStorage,
  SessionStorageService,
  type CognitoTokens,
  type SessionState,
} from '@/lib/auth/session-storage';
import { getTokenRefreshService } from '@/lib/auth/token-refresh';

interface UseSessionOptions {
  autoRefresh?: boolean;
  refreshBufferMinutes?: number;
}

interface UseSessionReturn {
  tokens: CognitoTokens | null;
  sessionState: SessionState;
  isAuthenticated: boolean;
  isRefreshing: boolean;
  error: string | null;
  refreshTokens: () => Promise<boolean>;
  logout: () => void;
  setTokens: (tokens: CognitoTokens) => void;
}

/**
 * React hook for session management
 * Provides access to authentication tokens and automatic refresh functionality
 */
export function useSession(options: UseSessionOptions = {}): UseSessionReturn {
  const { autoRefresh = true, refreshBufferMinutes = 5 } = options;

  const [tokens, setTokensState] = useState<CognitoTokens | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>({
    tokens: null,
    status: 'unauthenticated',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenRefreshService = useRef(getTokenRefreshService());
  const autoRefreshCleanup = useRef<(() => void) | null>(null);

  /**
   * Load session from storage
   */
  const loadSession = useCallback(() => {
    const storedTokens = sessionStorage.getTokens();
    const storedState = sessionStorage.getSessionState();

    setTokensState(storedTokens);
    setSessionState(storedState);
  }, []);

  /**
   * Initialize session on mount
   */
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  /**
   * Setup automatic token refresh
   */
  useEffect(() => {
    if (!autoRefresh || !tokens) {
      return;
    }

    // Setup auto-refresh
    autoRefreshCleanup.current = tokenRefreshService.current.setupAutoRefresh(refreshBufferMinutes);

    // Cleanup on unmount
    return () => {
      if (autoRefreshCleanup.current) {
        autoRefreshCleanup.current();
        autoRefreshCleanup.current = null;
      }
    };
  }, [autoRefresh, tokens, refreshBufferMinutes]);

  /**
   * Refresh tokens manually
   */
  const refreshTokens = useCallback(async (): Promise<boolean> => {
    try {
      setIsRefreshing(true);
      setError(null);

      const result = await tokenRefreshService.current.refreshTokens();

      if (result.success && result.tokens) {
        setTokensState(result.tokens);
        setSessionState(sessionStorage.getSessionState());
        return true;
      } else {
        setError(result.error || 'Token refresh failed');
        return false;
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error during token refresh';
      setError(errorMessage);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  /**
   * Set new tokens
   */
  const setTokens = useCallback(
    (newTokens: CognitoTokens) => {
      sessionStorage.setTokens(newTokens);

      // Extract and store user ID
      const userId = SessionStorageService.extractUserIdFromToken(newTokens.idToken);
      if (userId) {
        sessionStorage.setUserId(userId);
      }

      loadSession();
    },
    [loadSession]
  );

  /**
   * Logout and clear session
   */
  const logout = useCallback(() => {
    sessionStorage.clearTokens();
    setTokensState(null);
    setSessionState({ tokens: null, status: 'unauthenticated' });
    setError(null);

    // Cleanup auto-refresh
    if (autoRefreshCleanup.current) {
      autoRefreshCleanup.current();
      autoRefreshCleanup.current = null;
    }
  }, []);

  /**
   * Check if user is authenticated
   */
  const isAuthenticated = tokens !== null && !sessionStorage.areTokensExpired();

  return {
    tokens,
    sessionState,
    isAuthenticated,
    isRefreshing,
    error,
    refreshTokens,
    logout,
    setTokens,
  };
}
