# Cognito Configuration Issues Found

## Problems Identified

### 1. Self-Registration is Disabled ❌

**Issue**: The User Pool has `AllowAdminCreateUserOnly = True`
**Impact**: Users cannot register themselves through the app
**Fix**: Enable self-registration in Cognito console

### 2. App Client Has Client Secret ❌

**Issue**: The app client has a client secret: `rsc2l7ag5bnscjpjmfdbbk63drqe3vmmrie9roip743b3hlf8ug`
**Impact**: Public web apps should NOT use client secrets (security risk)
**Fix**: Create a new app client without a client secret

### 3. Missing ALLOW_USER_PASSWORD_AUTH Flow ❌

**Issue**: App client only has: `ALLOW_REFRESH_TOKEN_AUTH`, `ALLOW_USER_AUTH`, `ALLOW_USER_SRP_AUTH`
**Impact**: Username/password authentication won't work
**Fix**: Enable `ALLOW_USER_PASSWORD_AUTH` authentication flow

### 4. Strict Password Policy ⚠️

**Current**: 12 characters minimum + uppercase + lowercase + numbers + symbols
**Expected**: 8 characters minimum + uppercase + lowercase + numbers
**Impact**: Users need stronger passwords than expected
**Fix**: Adjust password policy or update UI to reflect requirements

## Quick Fix: Create New App Client

Since the current app client has a secret and wrong auth flows, create a new one:

### Steps:

1. Go to AWS Cognito Console: https://console.aws.amazon.com/cognito/v2/idp/user-pools?region=us-east-1

2. Select User Pool: `vaidyalink-users-dev` (us-east-1_iBVHMFnpa)

3. Go to **App integration** tab

4. Scroll to **App clients** section

5. Click **Create app client**

6. Configure:
   - **App client name**: `document-scan-web-client`
   - **Client secret**: Select **"Don't generate a client secret"** ✅
   - **Authentication flows**: Check these:
     - ✅ ALLOW_USER_PASSWORD_AUTH
     - ✅ ALLOW_REFRESH_TOKEN_AUTH
     - ✅ ALLOW_USER_SRP_AUTH

7. Click **Create app client**

8. Copy the new **Client ID**

9. Update `frontend/.env.local`:

   ```env
   NEXT_PUBLIC_COGNITO_CLIENT_ID=<new-client-id>
   ```

10. Restart frontend: `npm run dev`

## Enable Self-Registration

1. Go to User Pool: `vaidyalink-users-dev`

2. Go to **Sign-up experience** tab

3. Click **Edit** in the **Self-service sign-up** section

4. Enable **"Allow users to sign themselves up"**

5. Click **Save changes**

## Current Workaround

For immediate testing, authentication is bypassed:

- `NEXT_PUBLIC_SKIP_AUTH=true` in `frontend/.env.local`
- This allows testing document upload without authentication
- Backend Lambda is in MVP mode (no authentication required)

## Testing Without Authentication

1. Navigate to: http://localhost:3000/document-scan-demo
2. Upload a document directly (no login required)
3. Test the full document processing pipeline

## Re-enable Authentication Later

Once Cognito is properly configured:

1. Update `frontend/.env.local`:

   ```env
   NEXT_PUBLIC_SKIP_AUTH=false
   NEXT_PUBLIC_COGNITO_CLIENT_ID=<new-client-id-without-secret>
   ```

2. Update Lambda environment variable:

   ```bash
   aws lambda update-function-configuration \
     --function-name document-scan-api-dev \
     --environment "Variables={JOBS_TABLE=document-scan-jobs-dev,DOCUMENTS_BUCKET=document-scan-docs-dev-038208944386,NODE_ENV=dev,S3_DOCUMENTS_BUCKET=document-scan-docs-dev-038208944386,COGNITO_USER_POOL_ID=us-east-1_iBVHMFnpa,COGNITO_REGION=us-east-1}" \
     --region ap-south-1
   ```

3. Restart frontend and test registration/login

## Summary

**Current State**: Authentication bypassed for testing
**Next Steps**: Fix Cognito configuration when you have time
**Priority**: Test document upload functionality first (you have 2 hours left)
