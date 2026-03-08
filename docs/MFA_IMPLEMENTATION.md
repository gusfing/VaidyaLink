# Multi-Factor Authentication (MFA) Implementation Guide

## Overview

VaidyaLink implements multi-factor authentication (MFA) using AWS Cognito to meet security requirements specified in Requirement 7.3: "WHEN a user accesses their records, THE VaidyaLink_System SHALL authenticate using multi-factor authentication."

This implementation supports two MFA methods:

- **TOTP (Time-based One-Time Password)**: Authenticator apps like Google Authenticator, Authy, Microsoft Authenticator
- **SMS**: Text message verification codes

## Architecture

### Infrastructure Layer

The MFA configuration is defined in `infrastructure/lib/constructs/auth.ts`:

```typescript
mfa: cognito.Mfa.REQUIRED,
mfaSecondFactor: {
  sms: true,
  otp: true,
},
```

**Key Features:**

- MFA is REQUIRED for all users (enforced at Cognito level)
- Both SMS and TOTP methods are enabled
- SMS delivery via AWS SNS with dedicated IAM role
- Device tracking enabled for trusted devices

### Frontend Layer

#### MFA Service (`frontend/lib/auth/mfa-service.ts`)

Core service for MFA operations:

```typescript
import { createMFAService } from '@/lib/auth/mfa-service';

const mfaService = createMFAService();

// Get MFA status
const status = await mfaService.getMFAStatus(accessToken);

// Setup TOTP
const { secretCode, qrCodeUrl } = await mfaService.setupTOTP(accessToken);

// Verify TOTP
await mfaService.verifyTOTP(accessToken, code);

// Enable SMS MFA
await mfaService.enableSMSMFA(accessToken);

// Set preference
await mfaService.setMFAPreference(accessToken, 'TOTP');
```

#### React Components

**MFASetup Component** (`frontend/components/auth/MFASetup.tsx`)

- Main MFA management interface
- Shows current MFA status
- Allows users to enable/disable MFA methods
- Manages MFA preferences

**TOTPSetup Component** (`frontend/components/auth/TOTPSetup.tsx`)

- Guides users through TOTP setup
- Displays QR code for scanning
- Provides manual secret code entry
- Verifies TOTP codes

**SMSSetup Component** (`frontend/components/auth/SMSSetup.tsx`)

- Enables SMS MFA
- Validates phone number verification
- Provides setup instructions

**MFAVerification Component** (`frontend/components/auth/MFAVerification.tsx`)

- Handles MFA challenges during login
- Supports both SMS and TOTP verification
- Provides user-friendly error messages

#### React Hook

**useMFA Hook** (`frontend/lib/hooks/useMFA.ts`)

Simplifies MFA operations in React components:

```typescript
import { useMFA } from '@/lib/hooks/useMFA';

function MyComponent() {
  const {
    mfaStatus,
    loading,
    error,
    setupTOTP,
    verifyTOTP,
    enableSMSMFA,
    setMFAPreference,
    disableMFA,
  } = useMFA({ accessToken });

  // Use MFA operations
}
```

### Backend Layer

#### Middleware Integration

Both Node.js and Python middleware automatically handle MFA-authenticated users:

**Node.js Example:**

```javascript
const { createAuthMiddleware } = require('./middleware/auth');

exports.handler = async (event, context) => {
  const authMiddleware = createAuthMiddleware();
  const authResult = await authMiddleware(event);

  if (!authResult.authorized) {
    return { statusCode: 401, body: JSON.stringify({ error: authResult.error }) };
  }

  // User is authenticated with MFA
  const user = event.user;
  const mfaEnabled = user.claims['cognito:mfa_enabled'] === 'true';
};
```

**Python Example:**

```python
from middleware.auth import create_auth_middleware

def handler(event, context):
    auth_middleware = create_auth_middleware()
    auth_result = auth_middleware(event)

    if not auth_result['authorized']:
        return {'statusCode': 401, 'body': json.dumps({'error': auth_result['error']})}

    # User is authenticated with MFA
    user = event['user']
    mfa_enabled = user['claims'].get('cognito:mfa_enabled') == 'true'
```

## User Flows

### 1. Initial MFA Setup Flow

1. User logs in with username/password
2. System prompts for MFA setup (required)
3. User chooses MFA method (TOTP or SMS)
4. **For TOTP:**
   - System generates secret and QR code
   - User scans QR code with authenticator app
   - User enters 6-digit code to verify
   - TOTP is enabled and set as preferred method
5. **For SMS:**
   - System verifies phone number is confirmed
   - User enables SMS MFA
   - SMS is set as preferred method

### 2. Login with MFA Flow

1. User enters username/password
2. Cognito validates credentials
3. Cognito sends MFA challenge:
   - **SMS_MFA**: Sends code via SMS
   - **SOFTWARE_TOKEN_MFA**: Prompts for authenticator code
4. User enters MFA code
5. System verifies code
6. Authentication complete, tokens issued

### 3. MFA Management Flow

1. User navigates to security settings
2. System displays current MFA status
3. User can:
   - Add new MFA method
   - Change preferred method
   - Disable MFA (with confirmation)
4. Changes take effect immediately

## API Integration

### Authentication Flow with MFA

```typescript
// Initial authentication
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username, password }),
});

const data = await response.json();

if (data.mfaRequired) {
  // MFA challenge received
  const { challengeName, session } = data;

  // Prompt user for MFA code
  const mfaCode = await promptUserForCode();

  // Respond to MFA challenge
  const mfaResponse = await fetch('/api/auth/verify-mfa', {
    method: 'POST',
    body: JSON.stringify({
      username,
      mfaCode,
      session,
      challengeName,
    }),
  });

  const authResult = await mfaResponse.json();
  // Store tokens
}
```

### MFA Management API

```typescript
// Get MFA status
GET / api / auth / mfa / status;
Authorization: Bearer<access_token>;

// Setup TOTP
POST / api / auth / mfa / totp / setup;
Authorization: Bearer<access_token>;

// Verify TOTP
POST / api / auth / mfa / totp / verify;
Authorization: Bearer<access_token>;
Body: {
  code: '123456';
}

// Enable SMS MFA
POST / api / auth / mfa / sms / enable;
Authorization: Bearer<access_token>;

// Set MFA preference
PUT / api / auth / mfa / preference;
Authorization: Bearer<access_token>;
Body: {
  method: 'TOTP' | 'SMS';
}

// Disable MFA
DELETE / api / auth / mfa;
Authorization: Bearer<access_token>;
```

## Security Considerations

### TOTP (Recommended)

**Advantages:**

- More secure than SMS (not vulnerable to SIM swapping)
- Works offline
- No carrier costs
- Industry standard

**Implementation:**

- Uses RFC 6238 TOTP algorithm
- 30-second time window
- 6-digit codes
- Secret stored securely in Cognito

### SMS

**Advantages:**

- User-friendly (no app required)
- Familiar to most users

**Considerations:**

- Vulnerable to SIM swapping attacks
- Requires cellular reception
- May incur SMS costs
- Less secure than TOTP

**Best Practice:** Recommend TOTP to users, but provide SMS as fallback option.

### Device Tracking

Cognito device tracking is enabled:

```typescript
deviceTracking: {
  challengeRequiredOnNewDevice: true,
  deviceOnlyRememberedOnUserPrompt: true,
}
```

This allows users to mark trusted devices and reduce MFA prompts.

## Testing

### Unit Tests

Test MFA service methods:

```typescript
import { MFAService } from '@/lib/auth/mfa-service';

describe('MFAService', () => {
  it('should setup TOTP successfully', async () => {
    const service = new MFAService(config);
    const result = await service.setupTOTP(accessToken);
    expect(result.secretCode).toBeDefined();
    expect(result.qrCodeUrl).toContain('otpauth://');
  });

  it('should verify TOTP code', async () => {
    const service = new MFAService(config);
    await expect(service.verifyTOTP(accessToken, '123456')).resolves.not.toThrow();
  });
});
```

### Integration Tests

Test complete MFA flows:

```typescript
describe('MFA Integration', () => {
  it('should complete TOTP setup flow', async () => {
    // 1. Setup TOTP
    const setup = await mfaService.setupTOTP(accessToken);

    // 2. Generate code from secret
    const code = generateTOTPCode(setup.secretCode);

    // 3. Verify code
    await mfaService.verifyTOTP(accessToken, code);

    // 4. Check status
    const status = await mfaService.getMFAStatus(accessToken);
    expect(status.totpEnabled).toBe(true);
  });
});
```

### Manual Testing

1. **TOTP Setup:**
   - Use Google Authenticator or Authy
   - Scan QR code
   - Verify code works

2. **SMS Setup:**
   - Ensure phone number is verified
   - Enable SMS MFA
   - Receive and verify SMS code

3. **Login Flow:**
   - Log out completely
   - Log in with username/password
   - Complete MFA challenge
   - Verify successful authentication

## Troubleshooting

### Common Issues

**Issue: "Failed to setup TOTP"**

- Ensure access token is valid
- Check AWS credentials
- Verify Cognito configuration

**Issue: "Invalid verification code"**

- Check device time synchronization
- Ensure 6-digit code
- Try next code (30-second window)

**Issue: "Failed to enable SMS MFA"**

- Verify phone number is confirmed in Cognito
- Check SNS permissions
- Verify SMS configuration in Cognito

**Issue: "MFA not required during login"**

- Check Cognito MFA setting (should be REQUIRED)
- Verify user has MFA enabled
- Check authentication flow configuration

### Debugging

Enable debug logging:

```typescript
// Frontend
localStorage.setItem('DEBUG', 'mfa:*');

// Backend
process.env.DEBUG = 'mfa:*';
```

Check CloudWatch logs for MFA-related events:

```
Filter pattern: [MFA] OR [SOFTWARE_TOKEN] OR [SMS_MFA]
```

## Deployment

### Infrastructure Deployment

```bash
# Deploy Cognito with MFA configuration
cd infrastructure
npm run deploy -- --all

# Verify MFA settings
aws cognito-idp describe-user-pool --user-pool-id <pool-id>
```

### Environment Variables

Required environment variables:

```bash
# Frontend (.env.local)
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-south-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=ap-south-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Backend (Lambda environment)
AWS_REGION=ap-south-1
COGNITO_USER_POOL_ID=ap-south-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Post-Deployment Verification

1. **Test TOTP Setup:**

   ```bash
   # Use AWS CLI to test
   aws cognito-idp associate-software-token --access-token <token>
   ```

2. **Test SMS Delivery:**

   ```bash
   # Verify SNS can send SMS
   aws sns publish --phone-number +919876543210 --message "Test"
   ```

3. **Test Authentication Flow:**
   - Create test user
   - Enable MFA
   - Test login with MFA

## Compliance

This MFA implementation satisfies:

- **Requirement 7.3**: Multi-factor authentication for user access
- **HIPAA Security Rule**: Technical safeguards for authentication
- **ABDM Guidelines**: Strong authentication for health data access

## References

- [AWS Cognito MFA Documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html)
- [RFC 6238 - TOTP Algorithm](https://tools.ietf.org/html/rfc6238)
- [NIST SP 800-63B - Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
