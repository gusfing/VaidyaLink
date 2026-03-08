# VaidyaLink Deployment Guide

This document provides comprehensive information about the VaidyaLink deployment pipeline, including CI/CD workflows, environment setup, and operational procedures.

## Table of Contents

- [Overview](#overview)
- [Environments](#environments)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Required Secrets](#required-secrets)
- [Deployment Process](#deployment-process)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring and Alerts](#monitoring-and-alerts)
- [Troubleshooting](#troubleshooting)

## Overview

VaidyaLink uses a fully automated CI/CD pipeline built with GitHub Actions. The pipeline includes:

- **Continuous Integration (CI)**: Automated testing, linting, and build verification on every pull request
- **Continuous Deployment (CD)**: Automated deployment to staging and production environments
- **Canary Deployments**: Gradual rollout of Lambda functions with automatic rollback on errors
- **Manual Approval Gates**: Production deployments require manual approval
- **Rollback Workflows**: One-click rollback to previous versions

## Environments

### Staging Environment

- **Purpose**: Pre-production testing and validation
- **Deployment Trigger**: Automatic on push to `develop` branch
- **URL**: https://staging.vaidyalink.com
- **AWS Account**: Staging account (separate from production)
- **Approval Required**: No

### Production Environment

- **Purpose**: Live production system serving real users
- **Deployment Trigger**:
  - Automatic on push to `main` branch
  - Manual via workflow dispatch
  - Automatic on version tags (`v*.*.*`)
- **URL**: https://vaidyalink.com
- **AWS Account**: Production account (isolated from staging)
- **Approval Required**: Yes (manual approval gate)

## GitHub Actions Workflows

### 1. Continuous Integration (`ci.yml`)

**Trigger**: Pull requests and pushes to `main` and `develop` branches

**Jobs**:

- **Lint**: ESLint, Prettier, Python linting (black, flake8)
- **Test Frontend**: Jest tests with coverage reporting
- **Test Backend**: Pytest (Python) and Jest (Node.js) tests for all Lambda functions
- **Test Infrastructure**: CDK infrastructure tests
- **Build**: Frontend and infrastructure build verification
- **Security Scan**: npm audit and secret detection (TruffleHog)
- **Status Check**: Summary of all checks

**Duration**: ~15-20 minutes

### 2. Branch Protection (`branch-protection.yml`)

**Trigger**: Pull requests to `main` and `develop` branches

**Jobs**:

- All CI jobs plus:
- **E2E Tests**: Playwright end-to-end tests (main branch only)
- **Commit Lint**: Conventional commit message validation
- **PR Title Lint**: Semantic PR title validation
- **Coverage Check**: Code coverage threshold validation

**Duration**: ~25-35 minutes (with E2E tests)

### 3. Deploy to Staging (`cd-staging.yml`)

**Trigger**: Push to `develop` branch or manual dispatch

**Jobs**:

1. **Pre-deployment Tests**: Full test suite execution
2. **Deploy Infrastructure**: CDK stack deployment
3. **Deploy Lambdas**: All Lambda functions deployed in parallel
4. **Deploy Frontend**: Vercel deployment
5. **Post-deployment Tests**: Smoke tests and health checks
6. **Notify**: Slack notification with deployment status

**Duration**: ~20-30 minutes

**Features**:

- Automatic deployment on merge to `develop`
- Can skip tests with manual dispatch
- Outputs API and WebSocket endpoints for frontend

### 4. Deploy to Production (`cd-production.yml`)

**Trigger**: Push to `main` branch, version tags, or manual dispatch

**Jobs**:

1. **Pre-deployment Validation**: Full test suite + security audit
2. **Manual Approval Gate**: Requires approval in GitHub UI
3. **Backup**: DynamoDB backups and Lambda version snapshots
4. **Deploy Infrastructure**: CDK stack deployment (optional)
5. **Deploy Lambdas**: Canary deployment with automatic rollback
6. **Deploy Frontend**: Vercel production deployment
7. **Post-deployment Tests**: Comprehensive validation
8. **Create Release**: GitHub release creation (for version tags)
9. **Notify**: Slack and email notifications

**Duration**: ~45-60 minutes (including approval wait time)

**Features**:

- **Canary Deployments**: Lambda functions deployed with 10% traffic for 5 minutes
- **Automatic Rollback**: Rolls back if error rate exceeds threshold
- **Selective Deployment**: Deploy only infrastructure, lambdas, or frontend
- **Backup Before Deploy**: Automatic backups of databases and Lambda versions

### 5. Rollback (`rollback.yml`)

**Trigger**: Manual workflow dispatch only

**Inputs**:

- **Environment**: staging or production
- **Component**: all, infrastructure, lambdas, or frontend
- **Version**: Specific version/commit (optional, defaults to previous version)

**Jobs**:

1. \*\*Con
   ESS_KEY_ID_STAGING
   AWS_SECRET_ACCESS_KEY_STAGING
   AWS_DEPLOY_ROLE_ARN_STAGING
   AWS_ACCOUNT_ID_STAGING

```

#### Production
```

AWS_ACCESS_KEY_ID_PRODUCTION
AWS_SECRET_ACCESS_KEY_PRODUCTION
AWS_DEPLOY_ROLE_ARN_PRODUCTION
AWS_ACCOUNT_ID_PRODUCTION

```

### Vercel Deployment
```

VERCEL_TOKEN # Vercel API token
VERCEL_ORG_ID # Vercel organization ID
VERCEL_PROJECT_ID_STAGING # Staging project ID
VERCEL_PROJECT_ID_PRODUCTION # Production project ID

```

### API Endpoints (for rollback)
```

STAGING_API_ENDPOINT # Staging API Gateway URL
STAGING_WS_ENDPOINT # Staging WebSocket URL
PRODUCTION_API_ENDPOINT # Production API Gateway URL
PRODUCTION_WS_ENDPOINT # Production WebSocket URL

```

### Notifications
```

SLACK_WEBHOOK_URL # Slack incoming webhook URL
EMAIL_USERNAME # SMTP username for email alerts
EMAIL_PASSWORD # SMTP password
ALERT_EMAIL # Email address for critical alerts

```

### Optional
```

SNYK_TOKEN # Snyk security scanning token
CODECOV_TOKEN # Codecov coverage reporting token

````

## Deployment Process

### Deploying to Staging

1. **Create a feature branch** from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
````

2. **Make changes and commit**:

   ```bash
   git add .
   git commit -m "feat(component): add new feature"
   ```

3. **Push and create PR**:

   ```bash
   git push origin feature/my-feature
   ```

   Create a pull request to `develop` branch

4. **CI checks run automatically**:
   - Linting
   - Tests
   - Build verification
   - Security scans

5. **Merge PR** after approval and passing checks

6. **Automatic deployment to staging**:
   - Triggered on merge to `develop`
   - Monitor progress in Actions tab
   - Check Slack for deployment notification

### Deploying to Production

1. **Create a release PR** from `develop` to `main`:

   ```bash
   git checkout main
   git pull origin main
   git checkout -b release/v1.2.0
   git merge develop
   git push origin release/v1.2.0
   ```

2. **Create PR to `main`**:
   - All branch protection checks run
   - E2E tests execute
   - Security scans run

3. **Merge PR** after approval

4. **Deployment workflow starts**:
   - Pre-deployment validation runs
   - **Manual approval required** - check GitHub Actions UI
   - Approve deployment in the UI

5. **Deployment proceeds**:
   - Backups created automatically
   - Infrastructure deployed (if changed)
   - Lambda functions deployed with canary strategy
   - Frontend deployed to production
   - Post-deployment tests run

6. **Monitor deployment**:
   - Check Slack notifications
   - Monitor CloudWatch metrics
   - Verify health endpoints

### Creating a Release

For version-tagged releases:

```bash
git checkout main
git pull origin main
git tag -a v1.2.0 -m "Release version 1.2.0"
git push origin v1.2.0
```

This triggers:

- Production deployment workflow
- GitHub release creation with changelog

## Rollback Procedures

### When to Rollback

Rollback immediately if:

- Critical bugs discovered in production
- High error rates in CloudWatch metrics
- Performance degradation
- Security vulnerabilities detected

### How to Rollback

1. **Navigate to Actions tab** in GitHub

2. **Select "Rollback Deployment" workflow**

3. **Click "Run workflow"**

4. **Configure rollback**:
   - **Environment**: Select `production` or `staging`
   - **Component**: Select what to rollback:
     - `all`: Complete rollback
     - `lambdas`: Only Lambda functions
     - `infrastructure`: Only CDK stacks
     - `frontend`: Only frontend deployment
   - **Version**: (Optional) Specific commit/version to rollback to

5. **Approve rollback** in the UI

6. **Monitor rollback progress**:
   - Check Actions tab for progress
   - Verify health checks pass
   - Check Slack notification

### Rollback Lambda Functions Only

For quick Lambda rollback without full deployment:

```bash
# Using AWS CLI
aws lambda update-alias \
  --function-name vaidyalink-production-document-processing \
  --name live \
  --function-version <previous-version>
```

### Emergency Rollback

If GitHub Actions is unavailable:

1. **Lambda Functions**:

   ```bash
   # List versions
   aws lambda list-versions-by-function \
     --function-name vaidyalink-production-<service>

   # Rollback alias
   aws lambda update-alias \
     --function-name vaidyalink-production-<service> \
     --name live \
     --function-version <previous-version>
   ```

2. **Frontend** (Vercel):
   - Go to Vercel dashboard
   - Select VaidyaLink project
   - Navigate to Deployments
   - Click on previous deployment
   - Click "Promote to Production"

3. **Infrastructure**:
   ```bash
   cd infrastructure
   git checkout <previous-commit>
   npx cdk deploy --all --context environment=production
   ```

## Monitoring and Alerts

### CloudWatch Dashboards

- **API Gateway Metrics**: Request count, latency, errors
- **Lambda Metrics**: Invocations, duration, errors, throttles
- **DynamoDB Metrics**: Read/write capacity, throttles
- **Custom Metrics**: OCR accuracy, processing latency

### CloudWatch Alarms

Alarms trigger on:

- Lambda error rate > 5% (5-minute window)
- API Gateway 5xx errors > 10 (5-minute window)
- Lambda duration > 25 seconds (p99)
- DynamoDB throttled requests > 0

### Slack Notifications

Automatic notifications sent for:

- ✅ Successful deployments
- ❌ Failed deployments
- 🔄 Rollback completions
- 🚨 CloudWatch alarms

### Email Alerts

Critical alerts sent via email for:

- Production deployment failures
- High error rates
- Security incidents

## Troubleshooting

### Deployment Fails at Infrastructure Stage

**Symptoms**: CDK deployment fails

**Solutions**:

1. Check CDK diff output in workflow logs
2. Verify AWS credentials are valid
3. Check for resource limits in AWS account
4. Review CloudFormation stack events in AWS Console

### Lambda Deployment Fails

**Symptoms**: Lambda update-function-code fails

**Solutions**:

1. Check Lambda function exists in AWS
2. Verify IAM permissions for deployment role
3. Check Lambda package size (< 50MB zipped)
4. Review Lambda function logs in CloudWatch

### Canary Deployment Triggers Rollback

**Symptoms**: Lambda canary automatically rolls back

**Solutions**:

1. Check CloudWatch Logs for Lambda errors
2. Review error metrics in CloudWatch
3. Test Lambda function locally
4. Check environment variables and configuration

### Frontend Deployment Fails

**Symptoms**: Vercel deployment fails

**Solutions**:

1. Verify Vercel token is valid
2. Check build logs in workflow
3. Verify environment variables are set
4. Test build locally: `cd frontend && pnpm build`

### Health Checks Fail After Deployment

**Symptoms**: Post-deployment tests fail

**Solutions**:

1. Check API Gateway endpoint is accessible
2. Verify Lambda functions are deployed
3. Check CloudWatch Logs for errors
4. Test endpoints manually with curl
5. Verify environment variables are correct

### GitHub Actions Workflow Stuck

**Symptoms**: Workflow doesn't progress

**Solutions**:

1. Check for pending approvals in UI
2. Cancel and re-run workflow
3. Check GitHub Actions status page
4. Verify secrets are configured correctly

## Best Practices

### Before Deploying

- ✅ Run tests locally: `pnpm test`
- ✅ Run linting: `pnpm lint`
- ✅ Test build: `pnpm build`
- ✅ Review changes in staging first
- ✅ Check for breaking changes
- ✅ Update documentation if needed

### During Deployment

- ✅ Monitor Slack notifications
- ✅ Watch CloudWatch metrics
- ✅ Keep rollback workflow ready
- ✅ Have team available for support
- ✅ Avoid deploying during peak hours

### After Deployment

- ✅ Verify health endpoints
- ✅ Check error rates in CloudWatch
- ✅ Test critical user flows
- ✅ Monitor for 30 minutes
- ✅ Update release notes

## Support

For deployment issues:

- **Slack**: #vaidyalink-deployments
- **Email**: devops@vaidyalink.com
- **On-call**: Check PagerDuty rotation

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel Deployment Documentation](https://vercel.com/docs)
- [VaidyaLink Architecture](../design.md)
