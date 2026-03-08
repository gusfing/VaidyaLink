# Cognito Identity Pool Configuration

## Overview

VaidyaLink uses AWS Cognito Identity Pools to provide federated access to AWS services directly from the browser. This enables secure, direct uploads to S3 without routing through API Gateway, reducing latency and costs.

## Architecture

```
┌─────────────────┐
│   Web Browser   │
│   (Next.js)     │
└────────┬────────┘
         │
         │ 1. Authenticate with User Pool
         ▼
┌─────────────────┐
│  Cognito User   │
│      Pool       │
└────────┬────────┘
         │
         │ 2. Get ID Token
         ▼
┌─────────────────┐
│   Cognito       │
│  Identity Pool  │
└────────┬────────┘
         │
         │ 3. Exchange for AWS Credentials
         ▼
┌─────────────────┐
│  AWS Services   │
│  (S3, etc.)     │
└─────────────────┘
```

## IAM Roles

### Authenticated Role

The authenticated role is assumed by users who have successfully authenticated with Cognito User Pool. It provides:

**S3 Permissions:**

- Read/Write access to user-specific S3 prefixes
- Pattern: `s3://bucket/folder/${cognito-identity.amazonaws.com:sub}/*`
- Folders: `raw/`, `audio/`, `exports/`

**API Gateway Permissions:**

- Invoke API Gateway endpoints for the environment
- Full access to authenticated API routes

**Security Features:**

- Scoped to user's own data using IAM policy variables
- Cannot access other users' files
- Temporary credentials (1 hour expiration)

### Unauthenticated Role

The unauthenticated role provides minimal access for public endpoints:

**API Gateway Permissions:**

- Read-only access to public health information endpoints
- Pattern: `GET /api/v1/public/*`

**Security Features:**

- No S3 access
- No access to user data
- Limited to public information only

## Frontend Integration

### 1. Environment Configuration

Add to `.env.local`:

```bash
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=ap-south-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_S3_DOCUMENTS_BUCKET=vaidyalink-documents-prod
```

### 2. Using the Cognito Identity Service

```typescript
import { createCognitoIdentityService } from '@/lib/auth/cognito-identity';

// Initialize service
const identityService = createCognitoIdentityService();

// Get AWS credentials for authenticated user
const credentials = await identityService.getCredentialsForUser(idToken);

// Get Identity ID (for S3 path construction)
const identityId = await identityService.getIdentityId(idToken);
```

### 3. Direct S3 Uploads

```typescript
import { useFederatedS3 } from '@/lib/hooks/useFederatedS3';

function DocumentUpload() {
  const { uploadFile, uploading, uploadProgress } = useFederatedS3();
  const { idToken } = useAuth(); // Your auth hook

  const handleUpload = async (file: File) => {
    try {
      const s3Key = await uploadFile(file, 'raw', idToken);
      console.log('Uploaded to:', s3Key);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {uploading && <p>Progress: {uploadProgress?.percentage}%</p>}
    </div>
  );
}
```

### 4. Using with AWS SDK

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createCognitoIdentityService } from '@/lib/auth/cognito-identity';

const identityService = createCognitoIdentityService();
const credentials = identityService.createCredentialProvider(idToken);

const s3Client = new S3Client({
  region: 'ap-south-1',
  credentials,
});

// Now use s3Client for any S3 operations
```

## Security Considerations

### 1. IAM Policy Variables

The authenticated role uses IAM policy variables to scope access:

```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject"],
  "Resource": "arn:aws:s3:::bucket/raw/${cognito-identity.amazonaws.com:sub}/*"
}
```

The `${cognito-identity.amazonaws.com:sub}` variable is automatically replaced with the user's Identity ID, ensuring users can only access their own files.

### 2. Credential Expiration

- Temporary credentials expire after 1 hour
- Frontend should refresh credentials before expiration
- Use the credential provider which handles refresh automatically

### 3. Token Validation

- Identity Pool validates ID tokens with User Pool
- `serverSideTokenCheck: true` ensures tokens are verified server-side
- Invalid or expired tokens are rejected

### 4. Role Mapping

- Token-based role mapping ensures correct role assignment
- `ambiguousRoleResolution: 'AuthenticatedRole'` defaults to authenticated role
- Prevents privilege escalation

## Deployment

### 1. Deploy Infrastructure

```bash
cd infrastructure
pnpm install
pnpm cdk deploy --all
```

### 2. Get Output Values

After deployment, note the CloudFormation outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name vaidyalink-dev-auth \
  --query 'Stacks[0].Outputs'
```

### 3. Update Frontend Environment

Copy the output values to `frontend/.env.local`:

- `UserPoolId` → `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `UserPoolClientId` → `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- `IdentityPoolId` → `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID`

## Testing

### 1. Test Authentication Flow

```typescript
import { createCognitoIdentityService } from '@/lib/auth/cognito-identity';

async function testIdentityPool(idToken: string) {
  const service = createCognitoIdentityService();

  // Test getting Identity ID
  const identityId = await service.getIdentityId(idToken);
  console.log('Identity ID:', identityId);

  // Test getting credentials
  const credentials = await service.getCredentialsForUser(idToken);
  console.log('Access Key:', credentials.accessKeyId);
  console.log('Expires:', credentials.expiration);
}
```

### 2. Test S3 Upload

```typescript
import { FederatedS3Client } from '@/lib/aws/s3-client';

async function testS3Upload(idToken: string) {
  const identityService = createCognitoIdentityService();
  const s3Client = new FederatedS3Client(identityService);

  const testFile = new Blob(['test content'], { type: 'text/plain' });
  const key = await s3Client.generateUserKey(idToken, 'raw', 'test.txt');

  await s3Client.uploadFile(idToken, {
    bucket: process.env.NEXT_PUBLIC_S3_DOCUMENTS_BUCKET!,
    key,
    file: testFile,
  });

  console.log('Upload successful:', key);
}
```

### 3. Verify IAM Permissions

Test that users can only access their own files:

```bash
# Should succeed (own file)
aws s3 cp test.txt s3://bucket/raw/${IDENTITY_ID}/test.txt

# Should fail (other user's file)
aws s3 cp test.txt s3://bucket/raw/OTHER_IDENTITY_ID/test.txt
```

## Troubleshooting

### Error: "NotAuthorizedException: Invalid login token"

**Cause:** ID token is expired or invalid

**Solution:** Refresh the ID token using Cognito User Pool refresh token

### Error: "AccessDenied: Access Denied"

**Cause:** IAM role doesn't have permission for the operation

**Solution:**

1. Verify the S3 key matches the pattern in IAM policy
2. Check that the Identity ID is correctly embedded in the path
3. Ensure the authenticated role is attached to the Identity Pool

### Error: "ResourceNotFoundException: Identity pool not found"

**Cause:** Identity Pool ID is incorrect or not deployed

**Solution:**

1. Verify `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID` in `.env.local`
2. Check CloudFormation outputs for correct Identity Pool ID
3. Ensure infrastructure is deployed

## ABDM Integration (Future)

The Identity Pool is configured to support federated identity providers. To integrate ABDM OIDC:

1. Add ABDM as a supported login provider in `auth.ts`:

```typescript
supportedLoginProviders: {
  'abdm.gov.in': process.env.ABDM_CLIENT_ID,
}
```

2. Update role mapping to include ABDM provider:

```typescript
roleMappings: {
  abdmProvider: {
    type: 'Token',
    ambiguousRoleResolution: 'AuthenticatedRole',
    identityProvider: 'abdm.gov.in',
  },
}
```

3. Frontend integration:

```typescript
const credentials = await identityService.getCredentialsForUser(abdmIdToken, 'abdm.gov.in');
```

## References

- [AWS Cognito Identity Pools Documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-identity.html)
- [IAM Policy Variables](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_variables.html)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
