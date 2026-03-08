# AWS Cognito User Pool Setup Guide

This guide walks you through creating a Cognito User Pool for user authentication in the Document Scan Demo application.

## Step 1: Open AWS Cognito Console

1. Go to [AWS Console](https://console.aws.amazon.com/)
2. Sign in with your AWS account
3. In the search bar at the top, type "Cognito"
4. Click on "Amazon Cognito" from the results

## Step 2: Create User Pool

1. Click the **"Create user pool"** button
2. You'll see a step-by-step wizard

### Configure Sign-in Experience

**Step 1: Configure sign-in experience**

1. **Provider types**: Select **"Cognito user pool"**
2. **Cognito user pool sign-in options**: Check **"User name"** and **"Email"**
3. Click **"Next"**

### Configure Security Requirements

**Step 2: Configure security requirements**

1. **Password policy**:
   - Select **"Cognito defaults"** (or customize if needed)
   - Default requires: 8 characters minimum, uppercase, lowercase, numbers

2. **Multi-factor authentication (MFA)**:
   - Select **"No MFA"** (for simplicity in development)
   - You can enable this later for production

3. **User account recovery**:
   - Check **"Enable self-service account recovery"**
   - Select **"Email only"**

4. Click **"Next"**

### Configure Sign-up Experience

**Step 3: Configure sign-up experience**

1. **Self-service sign-up**:
   - Check **"Enable self-registration"**

2. **Attribute verification and user account confirmation**:
   - Check **"Allow Cognito to automatically send messages to verify and confirm"**
   - Select **"Send email message, verify email address"**

3. **Required attributes**:
   - Check **"email"** (should be pre-selected)

4. Click **"Next"**

### Configure Message Delivery

**Step 4: Configure message delivery**

1. **Email provider**:
   - Select **"Send email with Cognito"** (easiest for development)
   - For production, you can use Amazon SES

2. **FROM email address**: Leave as default (no-reply@verificationemail.com)

3. Click **"Next"**

### Integrate Your App

**Step 5: Integrate your app**

1. **User pool name**: Enter `document-scan-demo-users` (or your preferred name)

2. **Hosted authentication pages**:
   - Select **"Use the Cognito Hosted UI"** (optional, we're using custom pages)
   - Or select **"Don't use the Cognito Hosted UI"**

3. **Initial app client**:
   - **App client name**: Enter `document-scan-demo-client`
   - **Client secret**: Select **"Don't generate a client secret"** (important for public web apps)
   - **Authentication flows**: Check **"ALLOW_USER_PASSWORD_AUTH"** and **"ALLOW_REFRESH_TOKEN_AUTH"**

4. Click **"Next"**

### Review and Create

**Step 6: Review and create**

1. Review all your settings
2. Click **"Create user pool"**
3. Wait for the user pool to be created (takes a few seconds)

## Step 3: Get Your Configuration Values

After the user pool is created:

1. You'll be redirected to the user pool details page
2. **Copy the User Pool ID**:
   - It's displayed at the top of the page
   - Format: `ap-south-1_XXXXXXXXX`
   - Save this value

3. **Get the App Client ID**:
   - Click on the **"App integration"** tab
   - Scroll down to **"App clients and analytics"**
   - Click on your app client name (`document-scan-demo-client`)
   - **Copy the Client ID**
   - Format: `1234567890abcdefghijklmnop`
   - Save this value

## Step 4: Update Your Application Configuration

### Update Frontend Environment Variables

Edit `frontend/.env.local`:

```env
# AWS Real Data Integration - Development Environment
NEXT_PUBLIC_API_URL=https://ptln3qd359.execute-api.ap-south-1.amazonaws.com/prod
NEXT_PUBLIC_AWS_REGION=ap-south-1

# Demo mode: false = use real AWS backend
NEXT_PUBLIC_DEMO_MODE=false

# Cognito Configuration (REPLACE WITH YOUR VALUES)
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=1234567890abcdefghijklmnop

# Disable skip auth now that Cognito is configured
NEXT_PUBLIC_SKIP_AUTH=false
```

### Update Backend Lambda Environment Variables

The API Lambda needs the Cognito User Pool ID for JWT verification.

**Option 1: Update via AWS Console**

1. Go to AWS Lambda console
2. Find the function: `document-scan-api-dev`
3. Go to **Configuration** → **Environment variables**
4. Click **Edit**
5. Add new environment variable:
   - Key: `COGNITO_USER_POOL_ID`
   - Value: `ap-south-1_XXXXXXXXX` (your User Pool ID)
6. Add another environment variable:
   - Key: `AWS_REGION`
   - Value: `ap-south-1` (or your region)
7. Click **Save**

**Option 2: Update via AWS CLI**

```bash
aws lambda update-function-configuration \
  --function-name document-scan-api-dev \
  --environment "Variables={JOBS_TABLE=document-scan-jobs-dev,DOCUMENTS_BUCKET=document-scan-docs-dev-038208944386,NODE_ENV=dev,S3_DOCUMENTS_BUCKET=document-scan-docs-dev-038208944386,COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX,AWS_REGION=ap-south-1}" \
  --region ap-south-1
```

## Step 5: Test Your Setup

1. **Restart your frontend**:

   ```bash
   cd frontend
   npm run dev
   ```

2. **Navigate to registration page**:

   ```
   http://localhost:3000/document-scan-demo/register
   ```

3. **Register a new user**:
   - Enter username, email, password
   - Click "Create account"
   - Check your email for verification code
   - Enter the code to verify

4. **Login**:
   - Go to login page
   - Use your registered credentials
   - You should be redirected to the main app

## Troubleshooting

### Email Not Received

- Check your spam/junk folder
- Verify the email address is correct
- Wait a few minutes (emails can be delayed)
- Check Cognito console → User pool → Users to see if user was created

### "Invalid client id" Error

- Make sure you copied the Client ID correctly
- Verify `NEXT_PUBLIC_COGNITO_CLIENT_ID` in `.env.local`
- Restart your frontend after changing `.env.local`

### "User pool does not exist" Error

- Verify the User Pool ID is correct
- Check that you're using the correct AWS region
- Verify `NEXT_PUBLIC_AWS_REGION` matches your Cognito region

### Backend Returns 401 Unauthorized

- Make sure you added `COGNITO_USER_POOL_ID` to Lambda environment variables
- Verify the Lambda has the correct User Pool ID
- Check CloudWatch logs for detailed error messages:
  ```bash
  aws logs tail /aws/lambda/document-scan-api-dev --follow --region ap-south-1
  ```

## Production Considerations

For production deployment, consider:

1. **Enable MFA**: Add multi-factor authentication for security
2. **Use Amazon SES**: For better email deliverability
3. **Custom domain**: Use your own domain for emails
4. **Advanced security**: Enable advanced security features (risk-based authentication)
5. **Backup**: Enable user pool backup and recovery
6. **Monitoring**: Set up CloudWatch alarms for authentication failures

## Quick Reference

**AWS Console URLs**:

- Cognito: https://console.aws.amazon.com/cognito/
- Lambda: https://console.aws.amazon.com/lambda/
- CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/

**Environment Variables Summary**:

```
Frontend (.env.local):
- NEXT_PUBLIC_COGNITO_USER_POOL_ID
- NEXT_PUBLIC_COGNITO_CLIENT_ID
- NEXT_PUBLIC_AWS_REGION
- NEXT_PUBLIC_SKIP_AUTH=false

Backend Lambda:
- COGNITO_USER_POOL_ID
- AWS_REGION
```

## Next Steps

After setting up Cognito:

1. Test registration and login flows
2. Upload a document to test the full pipeline
3. Monitor CloudWatch logs for any issues
4. Consider adding password reset functionality
5. Add user profile management features
