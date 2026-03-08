# GitHub Secrets Setup Guide

This guide provides step-by-step instructions for configuring all required GitHub secrets for the VaidyaLink CI/CD pipeline.

## Table of Contents

- [Prerequisites](#prerequisites)
- [AWS Credentials Setup](#aws-credentials-setup)
- [Vercel Setup](#vercel-setup)
- [Notification Setup](#notification-setup)
- [Optional Services](#optional-services)
- [Verification](#verification)

## Prerequisites

Before setting up secrets, ensure you have:

- Admin access to the VaidyaLink GitHub repository
- AWS accounts for staging and production
- Vercel account with projects created
- Slack workspace with webhook access

## AWS Credentials Setup

### Step 1: Create IAM Deployment Roles

For both staging and p
"dynamodb:_",
"s3:_",
"cognito-idp:_",
"iam:_",
"kms:_",
"logs:_",
"events:_",
"sns:_",
"sqs:_",
"healthlake:_",
"bedrock:_"
],
"Resource": "_"
}
]
}

````

4. **Name the role**: `VaidyaLinkGitHubActionsRole`

5. **Copy the Role ARN**: You'll need this for GitHub secrets

### Step 2: Create IAM User for GitHub Actions

1. **Create IAM user**:
- Navigate to IAM → Users → Create user
- Username: `github-actions-vaidyalink`
- Access type: Programmatic access

2. **Attach policy to assume the deployment role**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/VaidyaLinkGitHubActionsRole"
    }
  ]
}
````

3. **Save credentials**:
   - Access Key ID
   - Secret Access Key

### Step 3: Add AWS Secrets to GitHub

Navigate to GitHub repository → Settings → Secrets and variables → Actions

#### Staging Secrets

Click "New repository secret" for each:

| Secret Name                     | Value                                                        | Description                |
| ------------------------------- | ------------------------------------------------------------ | -------------------------- |
| `AWS_ACCESS_KEY_ID_STAGING`     | `AKIA...`                                                    | IAM user access key ID     |
| `AWS_SECRET_ACCESS_KEY_STAGING` | `wJalr...`                                                   | IAM user secret access key |
| `AWS_DEPLOY_ROLE_ARN_STAGING`   | `arn:aws:iam::123456789012:role/VaidyaLinkGitHubActionsRole` | Deployment role ARN        |
| `AWS_ACCOUNT_ID_STAGING`        | `123456789012`                                               | AWS account ID             |

#### Production Secrets

| Secret Name                        | Value                                                        | Description                |
| ---------------------------------- | ------------------------------------------------------------ | -------------------------- |
| `AWS_ACCESS_KEY_ID_PRODUCTION`     | `AKIA...`                                                    | IAM user access key ID     |
| `AWS_SECRET_ACCESS_KEY_PRODUCTION` | `wJalr...`                                                   | IAM user secret access key |
| `AWS_DEPLOY_ROLE_ARN_PRODUCTION`   | `arn:aws:iam::987654321098:role/VaidyaLinkGitHubActionsRole` | Deployment role ARN        |
| `AWS_ACCOUNT_ID_PRODUCTION`        | `987654321098`                                               | AWS account ID             |

## Vercel Setup

### Step 1: Get Vercel Token

1. **Log in to Vercel**: https://vercel.com

2. **Navigate to Settings**:
   - Click your profile → Settings
   - Go to "Tokens" section

3. **Create new token**:
   - Name: `VaidyaLink GitHub Actions`
   - Scope: Full Account
   - Expiration: No expiration (or set appropriate expiration)

4. **Copy the token**: Save it securely

### Step 2: Get Organization and Project IDs

1. **Get Organization ID**:
   - Go to your team/organization settings
   - Copy the "Organization ID" from the URL or settings page
   - Format: `team_xxxxxxxxxxxxx`

2. **Get Project IDs**:

   **For Staging Project**:
   - Navigate to your staging project
   - Go to Settings → General
   - Copy "Project ID"
   - Format: `prj_xxxxxxxxxxxxx`

   **For Production Project**:
   - Navigate to your production project
   - Go to Settings → General
   - Copy "Project ID"

### Step 3: Add Vercel Secrets to GitHub

| Secret Name                    | Value                  | Description            |
| ------------------------------ | ---------------------- | ---------------------- |
| `VERCEL_TOKEN`                 | `vercel_token_xxxxx`   | Vercel API token       |
| `VERCEL_ORG_ID`                | `team_xxxxxxxxxxxxx`   | Vercel organization ID |
| `VERCEL_PROJECT_ID_STAGING`    | `prj_staging_xxxxx`    | Staging project ID     |
| `VERCEL_PROJECT_ID_PRODUCTION` | `prj_production_xxxxx` | Production project ID  |

## API Endpoints Setup

These are used for rollback workflows when CDK outputs aren't available.

### Step 1: Get API Endpoints

After initial deployment, get endpoints from:

1. **AWS Console**:
   - Navigate to API Gateway
   - Copy REST API endpoint
   - Copy WebSocket API endpoint

2. **Or from CDK outputs**:
   ```bash
   cd infrastructure
   npx cdk deploy --outputs-file outputs.json
   cat outputs.json
   ```

### Step 2: Add Endpoint Secrets

| Secret Name               | Value                                                         | Example                  |
| ------------------------- | ------------------------------------------------------------- | ------------------------ |
| `STAGING_API_ENDPOINT`    | `https://api-id.execute-api.ap-south-1.amazonaws.com/staging` | Staging REST API URL     |
| `STAGING_WS_ENDPOINT`     | `wss://ws-id.execute-api.ap-south-1.amazonaws.com/staging`    | Staging WebSocket URL    |
| `PRODUCTION_API_ENDPOINT` | `https://api-id.execute-api.ap-south-1.amazonaws.com/prod`    | Production REST API URL  |
| `PRODUCTION_WS_ENDPOINT`  | `wss://ws-id.execute-api.ap-south-1.amazonaws.com/prod`       | Production WebSocket URL |

## Notification Setup

### Slack Webhook

1. **Create Slack App**:
   - Go to https://api.slack.com/apps
   - Click "Create New App"
   - Choose "From scratch"
   - Name: `VaidyaLink CI/CD`
   - Select your workspace

2. **Enable Incoming Webhooks**:
   - Go to "Incoming Webhooks"
   - Toggle "Activate Incoming Webhooks" to On
   - Click "Add New Webhook to Workspace"
   - Select channel (e.g., `#deployments`)
   - Copy the webhook URL

3. **Add to GitHub**:

| Secret Name         | Value                                                                       | Example           |
| ------------------- | --------------------------------------------------------------------------- | ----------------- |
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX` | Slack webhook URL |

### Email Notifications

For critical production alerts:

1. **Set up SMTP credentials**:
   - Use Gmail, SendGrid, or your email provider
   - For Gmail: Enable "App Passwords" in Google Account settings

2. **Add to GitHub**:

| Secret Name      | Value                   | Example                 |
| ---------------- | ----------------------- | ----------------------- |
| `EMAIL_USERNAME` | `alerts@vaidyalink.com` | SMTP username           |
| `EMAIL_PASSWORD` | `app_password_here`     | SMTP password           |
| `ALERT_EMAIL`    | `devops@vaidyalink.com` | Email to receive alerts |

## Optional Services

### Snyk Security Scanning

1. **Create Snyk account**: https://snyk.io

2. **Get API token**:
   - Go to Account Settings
   - Copy your API token

3. **Add to GitHub**:

| Secret Name  | Value                                  |
| ------------ | -------------------------------------- |
| `SNYK_TOKEN` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

### Codecov Coverage Reporting

1. **Create Codecov account**: https://codecov.io

2. **Add repository** to Codecov

3. **Get upload token**:
   - Go to repository settings
   - Copy the upload token

4. **Add to GitHub**:

| Secret Name     | Value                                  |
| --------------- | -------------------------------------- |
| `CODECOV_TOKEN` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

## Verification

### Step 1: Verify Secrets Are Set

1. Go to GitHub repository → Settings → Secrets and variables → Actions

2. Verify all required secrets are listed:
   - ✅ 4 AWS staging secrets
   - ✅ 4 AWS production secrets
   - ✅ 4 Vercel secrets
   - ✅ 4 API endpoint secrets
   - ✅ 3 notification secrets

### Step 2: Test with Dry Run

Create a test branch and trigger CI:

```bash
git checkout -b test/secrets-verification
git commit --allow-empty -m "test: verify secrets configuration"
git push origin test/secrets-verification
```

Check GitHub Actions to ensure:

- ✅ CI workflow runs successfully
- ✅ No authentication errors
- ✅ All jobs complete

### Step 3: Test Staging Deployment

Merge a small change to `develop` branch and verify:

- ✅ Staging deployment workflow triggers
- ✅ AWS authentication succeeds
- ✅ CDK deployment completes
- ✅ Vercel deployment succeeds
- ✅ Slack notification received

## Security Best Practices

### Rotate Secrets Regularly

- **AWS credentials**: Rotate every 90 days
- **Vercel token**: Rotate every 180 days
- **Slack webhook**: Regenerate if compromised

### Audit Secret Access

- Review GitHub Actions logs regularly
- Monitor AWS CloudTrail for deployment role usage
- Check Vercel deployment logs

### Least Privilege Principle

- Grant minimum required permissions
- Use separate AWS accounts for staging/production
- Limit IAM role permissions to necessary services

### Secret Management

- Never commit secrets to repository
- Use GitHub environment secrets for additional protection
- Enable secret scanning in GitHub repository settings

## Troubleshooting

### AWS Authentication Fails

**Error**: `Unable to locate credentials`

**Solution**:

1. Verify `AWS_ACCESS_KEY_ID_*` and `AWS_SECRET_ACCESS_KEY_*` are set
2. Check IAM user has permission to assume deployment role
3. Verify role ARN is correct

### Vercel Deployment Fails

**Error**: `Invalid token`

**Solution**:

1. Regenerate Vercel token
2. Ensure token has full account scope
3. Verify project IDs are correct

### Slack Notifications Not Received

**Error**: `Webhook URL invalid`

**Solution**:

1. Test webhook URL with curl:
   ```bash
   curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"Test message"}' \
     YOUR_WEBHOOK_URL
   ```
2. Regenerate webhook if needed
3. Verify channel still exists

## Support

For issues with secrets setup:

- **Documentation**: Check this guide
- **GitHub Issues**: Create issue with `deployment` label
- **Slack**: #vaidyalink-devops
- **Email**: devops@vaidyalink.com

## Checklist

Use this checklist when setting up secrets:

- [ ] AWS staging credentials configured
- [ ] AWS production credentials configured
- [ ] Vercel token and project IDs configured
- [ ] API endpoints configured
- [ ] Slack webhook configured
- [ ] Email notifications configured
- [ ] Optional services configured (Snyk, Codecov)
- [ ] Secrets verified with test deployment
- [ ] Documentation updated with any custom configurations
- [ ] Team notified of deployment pipeline availability
