/**
 * Authentication and Session Management
 *
 * This module provides comprehensive authentication and session management
 * functionality for VaidyaLink, including:
 *
 * - Secure token storage with encryption
 * - Automatic token refresh with exponential backoff
 * - Session state management
 * - React hooks for authentication and session access
 * - Utility functions for session operations
 */

// Session Storage
export {
  SessionStorageService,
  sessionStorage,
  type CognitoTokens,
  type SessionState,
} from './session-storage';

// Token Refresh
export {
  TokenRefreshService,
  createTokenRefreshService,
  getTokenRefreshService,
} from './token-refresh';

// Session Utilities
export {
  initializeSession,
  ensureValidSession,
  getAccessToken,
  getIdToken,
  terminateSession,
  getSessionExpirationInfo,
  parseUserFromToken,
  hasRole,
  getUserRoles,
  setupSessionTimeout,
  getSessionDuration,
} from './session-utils';

// MFA Service
export {
  MFAService,
  createMFAService,
  type MFAMethod,
  type MFAStatus,
  type TOTPSetupResponse,
} from './mfa-service';

// Cognito Identity
export { CognitoIdentityService, createCognitoIdentityService } from './cognito-identity';

// React Hooks
export { useSession } from '../hooks/useSession';
export { useAuth } from '../hooks/useAuth';
export { useMFA } from '../hooks/useMFA';
