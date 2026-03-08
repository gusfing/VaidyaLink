# MFA Quick Start Guide

## For Developers

### 1. Frontend Integration

#### Add MFA Setup to User Profile

```tsx
import { MFASetup } from '@/components/auth/MFASetup';

function UserProfilePage() {
  const { accessToken } = useAuth(); // Your auth hook

  return (
    <div>
      <h1>Security Settings</h1>
      <MFASetup
        accessToken={accessToken}
        onComplete={() => {
          console.log('MFA setup completed');
          // Refresh user data, show success message, etc.
        }}
      />
    </div>
  );
}
```

#### Add MFA Verification to Login Flow

```tsx
import { MFAVerification } from '@/components/auth/MFAVerification';

function LoginPage() {
  const [mfaChallenge, setMFAChallenge] = useState(null);

  const handleLogin = async (username, password) => {
    const response = await authenticateUser(username, password);

    if (response.mfaRequired) {
      setMFAChallenge({
        challengeName: response.challengeName,
        session: response.session,
        username: username,
      });
    } else {
      // Login successful
      handleLoginSuccess(response);
    }
  };

  if (mfaChallenge) {
    return (
      <MFAVerification
        challengeName={mfaChallenge.challengeName}
        session={mfaChallenge.session}
        username={mfaChallenge.username}
        onSuccess={(response) => {
          handleLoginSuccess(response);
        }}
        onCancel={() => setMFAChallenge(null)}
      />
    );
  }

  return <LoginForm onSubmit={handleLogin} />;
}
```

#### Use MFA Hook

```tsx
import { useMFA } from '@/lib/hooks/useMFA';

function SecuritySettings() {
  const { accessToken } = useAuth();
  const { mfaStatus, loading, error, setupTOTP, enableSMSMFA, setMFAPreference } = useMFA({
    accessToken,
  });

  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;

  return (
    <div>
      <h2>MFA Status</h2>
      <p>TOTP: {mfaStatus?.totpEnabled ? 'Enabled' : 'Disabled'}</p>
      <p>SMS: {mfaStatus?.smsEnabled ? 'Enabled' : 'Disabled'}</p>
      <p>Preferred: {mfaStatus?.preferredMethod}</p>

      <button onClick={() => setupTOTP()}>Setup Authenticator App</button>
      <button onClick={() => enableSMSMFA()}>Enable SMS</button>
    </div>
  );
}
```

### 2. Backend Integration

#### Node.js Lambda Handler

```javascript
const { createAuthMiddleware } = require('./middleware/auth');

exports.handler = async (event, context) => {
  // Authenticate user
  const authMiddleware = createAuthMiddleware();
  const authResult = await authMiddleware(event);

  if (!authResult.authorized) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error }),
    };
  }

  // Access user with MFA info
  const user = event.user;
  console.log('User authenticated with MFA:', user.claims['cognito:mfa_enabled']);

  // Your business logic here
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  };
};
```

#### Python Lambda Handler

```python
from middleware.auth import create_auth_middleware

def handler(event, context):
    # Authenticate user
    auth_middleware = create_auth_middleware()
    auth_result = auth_middleware(event)

    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'body': json.dumps({'error': auth_result['error']})
        }

    # Access user with MFA info
    user = event['user']
    print(f"User authenticated with MFA: {user['claims'].get('cognito:mfa_enabled')}")

    # Your business logic here
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Success'})
    }
```

#### Require MFA for Sensitive Operations

```javascript
exports.sensitiveHandler = async (event, context) => {
  const authMiddleware = createAuthMiddleware();
  const authResult = await authMiddleware(event);

  if (!authResult.authorized) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // Check if MFA is enabled
  const mfaEnabled = event.user.claims['cognito:mfa_enabled'] === 'true';

  if (!mfaEnabled) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: 'MFA Required',
        message: 'This operation requires MFA to be enabled',
      }),
    };
  }

  // Perform sensitive operation
  return { statusCode: 200, body: JSON.stringify({ message: 'Success' }) };
};
```

### 3. Testing MFA Locally

#### Setup Local Environment

```bash
# Install dependencies
cd frontend
npm install

# Set environment variables
cp .env.example .env.local

# Add Cognito configuration
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your-pool-id
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=your-identity-pool-id
```

#### Test TOTP Setup

```bash
# 1. Start development server
npm run dev

# 2. Navigate to MFA setup page
# http://localhost:3000/profile/security

# 3. Click "Setup Authenticator App"

# 4. Scan QR code with Google Authenticator or Authy

# 5. Enter 6-digit code to verify
```

#### Test SMS Setup

```bash
# 1. Ensure phone number is verified in Cognito
aws cognito-idp admin-update-user-attributes \
  --user-pool-id your-pool-id \
  --username testuser \
  --user-attributes Name=phone_number,Value=+919876543210 Name=phone_number_verified,Value=true

# 2. Navigate to MFA setup page

# 3. Click "Enable SMS MFA"

# 4. Test login to receive SMS code
```

#### Test Login Flow

```bash
# 1. Enable MFA for test user

# 2. Log out completely

# 3. Log in with username/password

# 4. Enter MFA code when prompted

# 5. Verify successful authentication
```

### 4. Common Patterns

#### Check MFA Status Before Sensitive Actions

```typescript
async function performSensitiveAction() {
  const mfaService = createMFAService();
  const status = await mfaService.getMFAStatus(accessToken);

  if (!status.totpEnabled && !status.smsEnabled) {
    // Prompt user to enable MFA
    showMFASetupModal();
    return;
  }

  // Proceed with action
  await executeSensitiveAction();
}
```

#### Force MFA Setup on First Login

```typescript
function useRequireMFA() {
  const { user, accessToken } = useAuth();
  const { mfaStatus } = useMFA({ accessToken });
  const router = useRouter();

  useEffect(() => {
    if (user && mfaStatus && !mfaStatus.totpEnabled && !mfaStatus.smsEnabled) {
      // Redirect to MFA setup
      router.push('/setup-mfa');
    }
  }, [user, mfaStatus]);
}
```

#### Remember Device Option

```typescript
// After successful MFA verification
async function handleMFASuccess(response) {
  const rememberDevice = confirm('Remember this device for 30 days?');

  if (rememberDevice) {
    // Cognito automatically handles device tracking
    // Device will be remembered based on device key
  }

  // Complete login
  storeTokens(response.AuthenticationResult);
  router.push('/dashboard');
}
```

### 5. Troubleshooting

#### Issue: QR Code Not Displaying

```typescript
// Check if QR code URL is valid
console.log('QR Code URL:', qrCodeUrl);

// Verify it starts with 'otpauth://totp/'
if (!qrCodeUrl.startsWith('otpauth://totp/')) {
  console.error('Invalid QR code URL format');
}
```

#### Issue: TOTP Codes Not Working

```bash
# Check device time synchronization
# TOTP requires accurate time

# On Mac/Linux
ntpdate -u time.apple.com

# On Windows
w32tm /resync
```

#### Issue: SMS Not Received

```bash
# Check SNS permissions
aws sns get-sms-attributes

# Test SMS delivery
aws sns publish --phone-number +919876543210 --message "Test"

# Check CloudWatch logs for errors
aws logs tail /aws/lambda/cognito-sms --follow
```

### 6. Best Practices

1. **Always recommend TOTP over SMS** for better security
2. **Provide backup codes** for account recovery
3. **Test MFA flows** in staging before production
4. **Monitor MFA adoption rates** via CloudWatch metrics
5. **Educate users** about MFA benefits
6. **Handle errors gracefully** with clear messages
7. **Log MFA events** for security auditing

### 7. Resources

- [Full MFA Implementation Guide](./MFA_IMPLEMENTATION.md)
- [AWS Cognito MFA Docs](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html)
- [TOTP RFC 6238](https://tools.ietf.org/html/rfc6238)
- [Example Handlers](../backend/shared/nodejs/middleware/examples/mfa-handler.js)
