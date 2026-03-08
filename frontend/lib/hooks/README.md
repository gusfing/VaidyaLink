# Authentication Hooks

This directory contains React hooks for authentication and user management in VaidyaLink.

## Available Hooks

### `useAuth`

Main authentication hook providing login, signup, password reset, and MFA functionality.

**Features:**

- Login with username/password
- User signup with email verification
- Password reset flow
- MFA challenge handling (SMS and TOTP)
- Session refresh
- Logout

**Usage:**

```typescript
import { useAuth } from '@/lib/hooks/useAuth';

function LoginComponent() {
  const {
    isAuthenticated,
    isLoading,
    error,
    user,
    mfaChallenge,
    login,
    logout,
  } = useAuth();

  const handleLogin = async () => {
    try {
      await login({
        username: 'user@example.com',
        password: 'password123',
      });
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div>
      {isAuthenticated ? (
        <button onClick={logout}>Logout</button>
      ) : (
        <button onClick={handleLogin} disabled={isLoading}>
          Login
        </button>
      )}
      {error && <p>{error}</p>}
    </div>
  );
}
```

**API:**

```typescript
interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: any | null;
  mfaChallenge: MFAChallenge | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  confirmSignUp: (username: string, code: string) => Promise<void>;
  logout: () => void;
  forgotPassword: (username: string) => Promise<void>;
  resetPassword: (username: string, code: string, newPassword: string) => Promise<void>;
  respondToMFAChallenge: (code: string) => Promise<void>;
  refreshSession: () => Promise<boolean>;
}
```

### `useUser`

Hook for accessing and managing current user information, roles, and permissions.

**Features:**

- User profile information
- Role-based access control (RBAC)
- Permission checking
- Profile updates
- ABHA ID integration

**Usage:**

```typescript
import { useUser } from '@/lib/hooks/useUser';

function UserProfile() {
  const {
    user,
    permissions,
    isLoading,
    updateProfile,
    hasRole,
    hasPermission,
  } = useUser();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Not authenticated</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>Email: {user.email}</p>
      <p>Roles: {user.roles.join(', ')}</p>

      {hasRole('Patient') && <p>You are a patient</p>}
      {hasPermission('canUploadScans') && (
        <button>Upload Scan</button>
      )}
    </div>
  );
}
```

**API:**

```typescript
interface UseUserReturn {
  user: UserProfile | null;
  permissions: UserPermissions | null;
  isLoading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  updateProfile: (data: UserUpdateData) => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasPermission: (permission: keyof UserPermissions) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasAllRoles: (roles: UserRole[]) => boolean;
}

interface UserProfile {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  name?: string;
  roles: UserRole[];
  abhaId?: string;
  preferredLanguage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserRole = 'Patient' | 'HealthcareProvider' | 'Admin' | 'HITLVerifier';
```

### `useSession`

Low-level hook for session management and token handling.

**Features:**

- Token storage and retrieval
- Automatic token refresh
- Session state management
- Token expiration checking

**Usage:**

```typescript
import { useSession } from '@/lib/hooks/useSession';

function SessionInfo() {
  const {
    tokens,
    isAuthenticated,
    isRefreshing,
    refreshTokens,
  } = useSession();

  return (
    <div>
      <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
      <p>Refreshing: {isRefreshing ? 'Yes' : 'No'}</p>
      {tokens && (
        <p>Token expires: {new Date(tokens.expiresAt).toLocaleString()}</p>
      )}
    </div>
  );
}
```

### `useMFA`

Hook for managing multi-factor authentication.

**Features:**

- TOTP (Authenticator App) setup
- SMS MFA setup
- MFA preference management
- MFA status checking

**Usage:**

```typescript
import { useMFA } from '@/lib/hooks/useMFA';
import { useSession } from '@/lib/hooks/useSession';

function MFASetup() {
  const { tokens } = useSession();
  const {
    mfaStatus,
    loading,
    setupTOTP,
    verifyTOTP,
    setMFAPreference,
  } = useMFA({ accessToken: tokens?.accessToken || null });

  const handleSetupTOTP = async () => {
    const { secretCode, qrCodeUrl } = await setupTOTP();
    // Display QR code to user
  };

  const handleVerify = async (code: string) => {
    await verifyTOTP(code);
    await setMFAPreference('TOTP');
  };

  return (
    <div>
      {mfaStatus?.totpEnabled ? (
        <p>TOTP is enabled</p>
      ) : (
        <button onClick={handleSetupTOTP}>Setup Authenticator</button>
      )}
    </div>
  );
}
```

## Role-Based Access Control (RBAC)

The `useUser` hook integrates with the VaidyaLink RBAC system, providing four roles:

### Roles

1. **Patient** - End users who upload and manage their own medical records
2. **HealthcareProvider** - Doctors and medical staff who can access patient records
3. **Admin** - System administrators with full access
4. **HITLVerifier** - Human-in-the-loop verifiers for low-confidence scans

### Permissions

The `permissions` object from `useUser` provides boolean flags for all available permissions:

**Scan Permissions:**

- `canUploadScans` - Upload medical document scans
- `canReadOwnScans` - Read own scan results
- `canReadAllScans` - Read all users' scans
- `canDeleteOwnScans` - Delete own scans
- `canDeleteAllScans` - Delete any scans

**Voice Permissions:**

- `canUploadVoice` - Upload voice recordings

**Record Permissions:**

- `canReadOwnRecords` - Read own medical records
- `canReadAllRecords` - Read all medical records
- `canWriteOwnRecords` - Update own records
- `canWriteAllRecords` - Update any records
- `canExportRecords` - Export records to FHIR

**ABDM Permissions:**

- `canLinkABDM` - Link ABHA ID
- `canFetchABDM` - Fetch records from ABDM
- `canPushABDM` - Push records to ABDM
- `canManageConsent` - Manage consent artifacts

**HITL Permissions:**

- `canViewHITLQueue` - View verification queue
- `canVerifyHITL` - Verify low-confidence scans
- `canAssignHITL` - Assign verification tasks

**Admin Permissions:**

- `canManageUsers` - Manage user accounts
- `canViewAudit` - View audit logs
- `canConfigureSystem` - Configure system settings

### Permission Checking Examples

```typescript
const { user, permissions, hasRole, hasPermission, hasAnyRole } = useUser();

// Check single role
if (hasRole('Admin')) {
  // Show admin panel
}

// Check multiple roles
if (hasAnyRole(['Admin', 'HealthcareProvider'])) {
  // Show provider features
}

// Check permission
if (hasPermission('canUploadScans')) {
  // Show upload button
}

// Direct permission check
if (permissions?.canManageUsers) {
  // Show user management
}
```

## Integration with AWS Cognito

All hooks integrate with AWS Cognito for authentication:

- **User Pools** - User authentication and management
- **Identity Pools** - Federated access to AWS services
- **JWT Tokens** - Secure token-based authentication
- **MFA** - Multi-factor authentication support
- **Groups** - Role-based access via Cognito groups

### Environment Variables

Required environment variables:

```env
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-south-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_ENCRYPTION_KEY=your-encryption-key-here
```

## Session Management

Sessions are managed automatically with:

- **Secure Storage** - Tokens encrypted in localStorage
- **Auto Refresh** - Tokens refreshed before expiration
- **Expiration Handling** - Automatic logout on token expiration
- **Retry Logic** - Exponential backoff for failed refreshes

## Testing

Tests are located in `__tests__/` directory:

```bash
# Run all auth hook tests
npm test -- --testPathPattern="useAuth|useUser|useSession|useMFA"

# Run specific hook tests
npm test -- --testPathPattern="useUser"
```

## Best Practices

1. **Use `useAuth` for authentication operations** - Login, signup, logout
2. **Use `useUser` for user information and permissions** - Profile, roles, RBAC
3. **Use `useSession` for low-level token management** - Usually not needed directly
4. **Use `useMFA` for MFA setup and management** - TOTP, SMS MFA

5. **Always check authentication state before accessing user data:**

   ```typescript
   const { isAuthenticated, user } = useAuth();

   if (!isAuthenticated || !user) {
     return <LoginPage />;
   }
   ```

6. **Use permission checks for conditional rendering:**

   ```typescript
   const { hasPermission } = useUser();

   return (
     <>
       {hasPermission('canUploadScans') && <UploadButton />}
       {hasPermission('canManageUsers') && <AdminPanel />}
     </>
   );
   ```

7. **Handle errors gracefully:**

   ```typescript
   const { login, error } = useAuth();

   try {
     await login(credentials);
   } catch (err) {
     // Error is also available in the error state
     console.error('Login failed:', error);
   }
   ```

## Related Documentation

- [Session Management](../auth/SESSION_MANAGEMENT.md)
- [MFA Implementation](../../../docs/MFA_IMPLEMENTATION.md)
- [RBAC Guide](../../../backend/shared/RBAC_GUIDE.md)
- [Cognito Identity Pool](../../../docs/COGNITO_IDENTITY_POOL.md)
