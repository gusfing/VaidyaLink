# Session Management and Token Refresh

This document describes the session management and token refresh implementation for VaidyaLink.

## Overview

The session management system provides:

1. **Secure Token Storage**: Encrypted storage of Cognito JWT tokens
2. **Automatic Token Refresh**: Proactive token refresh before expiration
3. **Retry Logic**: Exponential backoff for failed refresh attempts
4. **Concurrent Request Handling**: Queue requests during token refresh
5. **Session State Management**: Track session status and lifecycle
6. **React Hooks**: Easy integration with React components

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Components                         │
│                  (useAuth, useSession hooks)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Session Management                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Session    │  │    Token     │  │   Session    │      │
│  │   Storage    │  │   Refresh    │  │   Utils      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Client                              │
│              (Axios with Interceptors)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS Cognito                               │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Session Storage Service

**File**: `session-storage.ts`

Handles secure storage and retrieval of authentication tokens.

**Features**:

- Encrypted token storage using XOR cipher and Base64 encoding
- Session state tracking (active, expired, refreshing, unauthenticated)
- Token expiration validation
- User ID management
- Singleton pattern for consistent state

**Usage**:

```typescript
import { sessionStorage } from '@/lib/auth';

// Store tokens
sessionStorage.setTokens({
  idToken: 'xxx',
  accessToken: 'xxx',
  refreshToken: 'xxx',
  expiresAt: Date.now() + 3600000,
});

// Check if authenticated
const isAuth = sessionStorage.isAuthenticated();

// Check if tokens are expired
const isExpired = sessionStorage.areTokensExpired(5); // 5 min buffer

// Get tokens
const tokens = sessionStorage.getTokens();

// Clear session
sessionStorage.clearTokens();
```

### 2. Token Refresh Service

**File**: `token-refresh.ts`

Handles automatic token refresh with retry logic.

**Features**:

- Exponential backoff retry (up to 3 attempts by default)
- Concurrent refresh request deduplication
- Non-retryable error detection
- Automatic session state updates
- Configurable retry parameters

**Usage**:

```typescript
import { getTokenRefreshService } from '@/lib/auth';

const service = getTokenRefreshService();

// Manual refresh
const result = await service.refreshTokens();
if (result.success) {
  console.log('Tokens refreshed:', result.tokens);
}

// Refresh if needed (with 5-minute buffer)
await service.refreshIfNeeded(5);

// Setup automatic refresh
const cleanup = service.setupAutoRefresh(5);
// Call cleanup() when done
```

### 3. React Hooks

#### useSession Hook

**File**: `hooks/useSession.ts`

Provides session state and token management in React components.

**Usage**:

```typescript
import { useSession } from '@/lib/auth';

function MyComponent() {
  const {
    tokens,
    sessionState,
    isAuthenticated,
    isRefreshing,
    error,
    refreshTokens,
    logout,
    setTokens,
  } = useSession({
    autoRefresh: true,
    refreshBufferMinutes: 5,
  });

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return <Dashboard />;
}
```

#### useAuth Hook

**File**: `hooks/useAuth.ts`

Comprehensive authentication hook with login, signup, and password reset.

**Usage**:

```typescript
import { useAuth } from '@/lib/auth';

function LoginPage() {
  const {
    isAuthenticated,
    isLoading,
    error,
    user,
    mfaChallenge,
    login,
    logout,
    respondToMFAChallenge,
  } = useAuth();

  const handleLogin = async () => {
    try {
      await login({ username: 'user@example.com', password: 'password' });

      // Check if MFA is required
      if (mfaChallenge) {
        // Show MFA input
      }
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      {/* Login form */}
    </form>
  );
}
```

### 4. API Client Integration

**File**: `lib/api/client.ts`

Axios client with automatic token injection and refresh.

**Features**:

- Automatic token injection in request headers
- Request queuing during token refresh
- Automatic retry on 401 with token refresh
- Redirect to login on refresh failure

**Request Flow**:

```
1. Request initiated
2. Check if token is expired (5-min buffer)
3. If expired:
   a. Refresh token
   b. Queue concurrent requests
   c. Process queue after refresh
4. Add token to Authorization header
5. Send request
6. If 401 response:
   a. Attempt token refresh
   b. Retry original request
   c. If refresh fails, logout and redirect
```

## Token Refresh Strategy

### Proactive Refresh

Tokens are refreshed **before** they expire to prevent API request failures:

- Default buffer: 5 minutes before expiration
- Configurable per use case
- Automatic refresh in background

### Retry Logic

Failed refresh attempts use exponential backoff:

```
Attempt 1: Immediate
Attempt 2: 1-2 seconds delay
Attempt 3: 2-4 seconds delay
Attempt 4: 4-8 seconds delay
Max delay: 30 seconds
```

### Non-Retryable Errors

The following errors are not retried:

- `NotAuthorizedException`: Invalid refresh token
- `InvalidParameterException`: Invalid request
- `ResourceNotFoundException`: User pool not found

## Security Considerations

### Token Storage

1. **Encryption**: Tokens are encrypted before storage using XOR cipher
2. **localStorage**: Used for persistence across page reloads
3. **Production**: Consider using Web Crypto API for stronger encryption

### Token Transmission

1. **HTTPS Only**: All API requests use HTTPS (TLS 1.3)
2. **Authorization Header**: Tokens sent in `Authorization: Bearer <token>`
3. **No URL Parameters**: Tokens never included in URLs

### Session Timeout

1. **Automatic Logout**: Session expires when tokens cannot be refreshed
2. **Configurable Timeout**: Can setup custom timeout handlers
3. **Cleanup**: All session data cleared on logout

## Testing

### Unit Tests

Run tests:

```bash
npm test -- session-storage.test.ts
npm test -- token-refresh.test.ts
```

### Test Coverage

- Session storage: encryption, expiration, state management
- Token refresh: retry logic, concurrent requests, error handling
- Integration: API client interceptors, request queuing

## Configuration

### Environment Variables

Required:

```env
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=ap-south-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Optional:

```env
NEXT_PUBLIC_ENCRYPTION_KEY=your-encryption-key-here
```

### Token Refresh Configuration

```typescript
const service = new TokenRefreshService({
  region: 'ap-south-1',
  clientId: 'xxx',
  maxRetries: 3, // Number of retry attempts
  baseDelayMs: 1000, // Base delay for exponential backoff
});
```

## Best Practices

### 1. Use Hooks in Components

```typescript
// ✅ Good
function MyComponent() {
  const { isAuthenticated } = useSession();
  // ...
}

// ❌ Bad - Direct storage access in components
function MyComponent() {
  const tokens = sessionStorage.getTokens();
  // ...
}
```

### 2. Handle Loading States

```typescript
function MyComponent() {
  const { isAuthenticated, isRefreshing } = useSession();

  if (isRefreshing) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return <Content />;
}
```

### 3. Error Handling

```typescript
function MyComponent() {
  const { error, refreshTokens } = useSession();

  useEffect(() => {
    if (error) {
      console.error('Session error:', error);
      // Show error notification
    }
  }, [error]);
}
```

### 4. Cleanup on Unmount

```typescript
function MyComponent() {
  const { logout } = useSession();

  useEffect(() => {
    return () => {
      // Cleanup if needed
    };
  }, []);
}
```

## Troubleshooting

### Tokens Not Refreshing

1. Check environment variables are set correctly
2. Verify Cognito User Pool allows refresh token flow
3. Check browser console for errors
4. Verify refresh token hasn't expired (default: 30 days)

### Infinite Refresh Loop

1. Check token expiration calculation
2. Verify system clock is correct
3. Check for concurrent refresh requests

### 401 Errors After Refresh

1. Verify new tokens are being stored correctly
2. Check API Gateway authentication configuration
3. Verify token is being added to request headers

## Migration Guide

### From Legacy Auth

If migrating from the old `auth_token` localStorage approach:

1. The new system automatically clears legacy tokens
2. Users will need to login again
3. Update all components to use new hooks
4. Remove direct localStorage access

### Example Migration

```typescript
// Before
const token = localStorage.getItem('auth_token');
axios.get('/api/data', {
  headers: { Authorization: `Bearer ${token}` },
});

// After
import apiClient from '@/lib/api/client';
const response = await apiClient.get('/api/data');
// Token automatically added by interceptor
```

## Future Enhancements

1. **Web Crypto API**: Stronger encryption for token storage
2. **Biometric Auth**: Support for fingerprint/face recognition
3. **Session Analytics**: Track session duration and refresh patterns
4. **Multi-Tab Sync**: Synchronize session across browser tabs
5. **Offline Support**: Handle token refresh when offline

## References

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
