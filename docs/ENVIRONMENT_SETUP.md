# VaidyaLink Environment Setup Guide

This guide provides comprehensive instructions for setting up staging and production environments for VaidyaLink.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Architecture](#environment-architecture)
- [Staging Environment Setup](#staging-environment-setup)
- [Production Environment Setup](#production-environment-setup)
- [Environment Configuration](#environment-configuration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Overview

VaidyaLink uses separate AWS accounts for staging and production env
main** | staging.vaidyalink.com | vaidyalink.com |
| **Lambda Memory** | Medium (1.5-3GB) | High (2-4GB) |
| **Multi-AZ** | No | Yes |
| **Backups** | Daily | Continuous |
| **CloudTrail** | Optional | Required |
| **Cost\*\* | ~$200-500/month | ~$1000-2000/month |

## Prerequisites

### Required Tools

1. **AWS CLI** (v2.x or higher)

   ```bash
   # Install on macOS
   brew install awscli

   # Install on Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install

   # Verify installation
   aws --version
   ```

2. **AWS CDK** (v2.x)

   ```bash
   npm install -g aws-cdk
   cdk --version
   ```

3. **Node.js** (v18 or higher)

   ```bash
   node --version
   npm --version
   ```

4. **jq** (JSON processor)

   ```bash
   # macOS
   brew install jq

   # Linux
   sudo apt-get install jq

   # Verify
   jq --version
   ```

5. **pnpm** (v8 or higher)
   ```bash
   npm install -g pnpm
   pnpm --version
   ```

### AWS Account Setup

1. **Create AWS Accounts**:
   - Staging account
   - Production account
   - (Optional) Separate accounts for security and logging

2. **Configure AWS Organizations** (Recommended):
   - Create organization in management account
   - Add staging and production as member accounts
   - Apply Service Control Policies (SCPs)

3. **Enable Required AWS Services**:
   - AWS Lambda
   - Amazon API Gateway
   - Amazon DynamoDB
   - Amazon S3
   - Amazon Cognito
   - AWS KMS
   - Amazon Bedrock (request access if needed)
   - AWS HealthLake (request access if needed)

### IAM Permissions

The deployment user/role needs these permissions:

- CloudFormation full access
- Lambda full access
- API Gateway full access
- DynamoDB full access
- S3 full access
- Cognito full access
- KMS full access
- IAM role creation and management
- CloudWatch Logs and Metrics
- EventBridge
- SNS and SQS

## Environment Architecture

### Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VPC (10.x.0.0/16)                        │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Public Subnet   │  │  Public Subnet   │                │
│  │   10.x.0.0/24    │  │   10.x.1.0/24    │                │
│  │   AZ-1           │  │   AZ-2           │                │
│  │                  │  │                  │                │
│  │  NAT Gateway     │  │  NAT Gateway     │                │
│  └──────────────────┘  └──────────────────┘                │
│           │                     │                           │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Private Subnet   │  │ Private Subnet   │                │
│  │  10.x.10.0/24    │  │  10.x.11.0/24    │                │
│  │   AZ-1           │  │   AZ-2           │                │
│  │                  │  │                  │                │
│  │  Lambda          │  │  Lambda          │                │
│  │  Functions       │  │  Functions       │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Resource Naming Convention

All resources follow this pattern:

```
vaidyalink-{environment}-{resource-type}-{name}
```

Examples:

- `vaidyalink-staging-lambda-document-processing`
- `vaidyalink-prod-dynamodb-patients`
- `vaidyalink-staging-s3-documents`

## Staging Environment Setup

### Step 1: Configure AWS Credentials

```bash
# Configure AWS CLI for staging account
aws configure --profile vaidyalink-staging

# Set as default profile for this session
export AWS_PROFILE=vaidyalink-staging

# Verify credentials
aws sts get-caller-identity
```

### Step 2: Update Configuration File

Edit `infrastructure/config/staging.json`:

```json
{
  "environment": "staging",
  "region": "ap-south-1",
  "account": "YOUR_STAGING_ACCOUNT_ID",
  "vpcCidr": "10.1.0.0/16",
  "domainName": "staging.vaidyalink.com"
}
```

Replace `YOUR_STAGING_ACCOUNT_ID` with your actual AWS account ID.

### Step 3: Run Setup Script

```bash
cd infrastructure

# Make script executable
chmod +x scripts/setup-environment.sh

# Run setup
./scripts/setup-environment.sh staging
```

The script will:

1. ✅ Verify AWS CLI and CDK installation
2. ✅ Load staging configuration
3. ✅ Verify AWS credentials
4. ✅ Bootstrap CDK in the account
5. ✅ Create S3 buckets with encryption
6. ✅ Create KMS encryption keys
7. ✅ Deploy CDK stacks
8. ✅ Configure CloudWatch alarms

### Step 4: Verify Deployment

```bash
# Check CDK stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE

# Check S3 buckets
aws s3 ls | grep vaidyalink-staging

# Check Lambda functions
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `vaidyalink-staging`)].FunctionName'

# Check DynamoDB tables
aws dynamodb list-tables --query 'TableNames[?starts_with(@, `vaidyalink-staging`)]'
```

### Step 5: Save Stack Outputs

```bash
# Stack outputs are saved to cdk-outputs-staging.json
cat infrastructure/cdk-outputs-staging.json

# Extract important values
API_ENDPOINT=$(jq -r '.VaidyaLinkApiStack.ApiEndpoint' infrastructure/cdk-outputs-staging.json)
WS_ENDPOINT=$(jq -r '.VaidyaLinkApiStack.WebSocketEndpoint' infrastructure/cdk-outputs-staging.json)

echo "API Endpoint: $API_ENDPOINT"
echo "WebSocket Endpoint: $WS_ENDPOINT"
```

## Production Environment Setup

### Step 1: Configure AWS Credentials

```bash
# Configure AWS CLI for production account
aws configure --profile vaidyalink-production

# Set as default profile
export AWS_PROFILE=vaidyalink-production

# Verify credentials
aws sts get-caller-identity
```

### Step 2: Update Configuration File

Edit `infrastructure/config/prod.json`:

```json
{
  "environment": "prod",
  "region": "ap-south-1",
  "account": "YOUR_PRODUCTION_ACCOUNT_ID",
  "vpcCidr": "10.2.0.0/16",
  "domainName": "vaidyalink.com",
  "enableBackup": true,
  "enableMultiAZ": true,
  "enableCloudTrail": true
}
```

### Step 3: Enable Additional Security Features

For production, ensure these are enabled:

1. **AWS CloudTrail**:
   - Logs all API calls
   - Required for HIPAA compliance
   - Automatically configured by setup script

2. **AWS Config**:

   ```bash
   aws configservice put-configuration-recorder \
     --configuration-recorder name=vaidyalink-prod-recorder,roleARN=arn:aws:iam::ACCOUNT_ID:role/aws-service-role/config.amazonaws.com/AWSServiceRoleForConfig \
     --recording-group allSupported=true,includeGlobalResourceTypes=true

   aws configservice put-delivery-channel \
     --delivery-channel name=vaidyalink-prod-channel,s3BucketName=vaidyalink-prod-config

   aws configservice start-configuration-recorder \
     --configuration-recorder-name vaidyalink-prod-recorder
   ```

3. **AWS GuardDuty**:
   ```bash
   aws guardduty create-detector --enable
   ```

### Step 4: Run Setup Script

```bash
cd infrastructure

# Run production setup
./scripts/setup-environment.sh prod
```

⚠️ **Important**: The script will ask for confirmation before proceeding with production setup.

### Step 5: Configure Backups

```bash
# Enable DynamoDB point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name vaidyalink-prod-ScanJobs \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

aws dynamodb update-continuous-backups \
  --table-name vaidyalink-prod-Patients \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

aws dynamodb update-continuous-backups \
  --table-name vaidyalink-prod-VoiceJobs \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

### Step 6: Set Up Monitoring

```bash
# Create SNS topic for alerts
aws sns create-topic --name vaidyalink-prod-alerts

# Subscribe email to topic
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-south-1:ACCOUNT_ID:vaidyalink-prod-alerts \
  --protocol email \
  --notification-endpoint devops@vaidyalink.com
```

## Environment Configuration

### Environment Variables

Each Lambda function needs these environment variables:

```bash
ENVIRONMENT=staging|prod
AWS_REGION=ap-south-1
LOG_LEVEL=debug|info|warn|error
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
CONFIDENCE_THRESHOLD=0.8
```

### Secrets Management

Store sensitive values in AWS Secrets Manager:

```bash
# Create secret for ABDM credentials
aws secretsmanager create-secret \
  --name vaidyalink/staging/abdm/credentials \
  --secret-string '{"clientId":"xxx","clientSecret":"xxx"}'

# Create secret for Bhashini API key
aws secretsmanager create-secret \
  --name vaidyalink/staging/bhashini/api-key \
  --secret-string '{"apiKey":"xxx"}'
```

### Parameter Store

Store configuration values in Parameter Store:

```bash
# Bedrock model ID
aws ssm put-parameter \
  --name /vaidyalink/staging/bedrock/model-id \
  --value "anthropic.claude-3-5-sonnet-20241022-v2:0" \
  --type String

# Confidence threshold
aws ssm put-parameter \
  --name /vaidyalink/staging/confidence/threshold \
  --value "0.8" \
  --type String
```

## Verification

### Health Check Endpoints

Test the deployed environment:

```bash
# API health check
curl https://api-staging.vaidyalink.com/health

# Expected response:
# {"status":"healthy","environment":"staging","timestamp":"2024-01-15T10:30:00Z"}
```

### Lambda Function Tests

```bash
# Invoke document processing Lambda
aws lambda invoke \
  --function-name vaidyalink-staging-document-processing \
  --payload '{"test":true}' \
  response.json

cat response.json
```

### DynamoDB Access

```bash
# Scan ScanJobs table (should be empty initially)
aws dynamodb scan \
  --table-name vaidyalink-staging-ScanJobs \
  --limit 10
```

### S3 Bucket Access

```bash
# List buckets
aws s3 ls | grep vaidyalink-staging

# Test upload
echo "test" > test.txt
aws s3 cp test.txt s3://vaidyalink-staging-documents/test/
aws s3 rm s3://vaidyalink-staging-documents/test/test.txt
rm test.txt
```

## Troubleshooting

### CDK Bootstrap Fails

**Error**: `This stack requires bootstrap stack version 'X', but during synthesis found version 'Y'`

**Solution**:

```bash
cdk bootstrap aws://ACCOUNT_ID/REGION --force
```

### S3 Bucket Creation Fails

**Error**: `BucketAlreadyExists` or `BucketAlreadyOwnedByYou`

**Solution**:

```bash
# Check if bucket exists
aws s3 ls s3://bucket-name

# If it exists in your account, the script will skip creation
# If it exists in another account, choose a different bucket name
```

### Lambda Deployment Fails

**Error**: `ResourceConflictException: Function already exists`

**Solution**:

```bash
# Delete existing function
aws lambda delete-function --function-name function-name

# Re-run CDK deploy
cdk deploy --context environment=staging
```

### KMS Key Creation Fails

**Error**: `LimitExceededException: You have exceeded the limit for customer master keys`

**Solution**:

```bash
# List existing keys
aws kms list-keys

# Delete unused keys or request limit increase
```

### CloudFormation Stack Stuck

**Error**: Stack is in `UPDATE_ROLLBACK_IN_PROGRESS` state

**Solution**:

```bash
# Wait for rollback to complete
aws cloudformation wait stack-rollback-complete --stack-name stack-name

# Then retry deployment
cdk deploy --context environment=staging
```

## Environment Teardown

⚠️ **Warning**: This will delete ALL resources and data!

### Staging Teardown

```bash
cd infrastructure
./scripts/teardown-environment.sh staging
```

### Production Teardown

```bash
cd infrastructure
./scripts/teardown-environment.sh prod
```

The script will:

1. Ask for confirmation (production requires typing "DELETE PRODUCTION")
2. Stop CloudTrail logging
3. Destroy all CDK stacks
4. Empty and delete S3 buckets
5. Schedule KMS key deletion (7-day waiting period)
6. Delete CloudWatch log groups

## Cost Optimization

### Staging Environment

- Use smaller Lambda memory allocations
- Disable Multi-AZ for DynamoDB
- Use S3 Intelligent-Tiering
- Set shorter log retention (7 days)
- Disable CloudTrail or use single-region

**Estimated Cost**: $200-500/month

### Production Environment

- Right-size Lambda memory based on metrics
- Enable DynamoDB auto-scaling
- Use S3 lifecycle policies
- Set appropriate log retention (90 days)
- Enable CloudTrail with S3 lifecycle

**Estimated Cost**: $1000-2000/month (scales with usage)

## Security Checklist

- [ ] Separate AWS accounts for staging and production
- [ ] IAM roles follow least privilege principle
- [ ] All S3 buckets have encryption enabled
- [ ] All S3 buckets block public access
- [ ] KMS customer-managed keys configured
- [ ] CloudTrail enabled (production)
- [ ] AWS Config enabled (production)
- [ ] GuardDuty enabled (production)
- [ ] VPC endpoints configured for AWS services
- [ ] Security groups restrict access appropriately
- [ ] Secrets stored in Secrets Manager
- [ ] CloudWatch alarms configured
- [ ] SNS alerts configured for critical events

## Next Steps

After environment setup:

1. ✅ Configure domain and SSL certificates (Task 2.7)
2. ✅ Deploy Lambda functions
3. ✅ Deploy frontend to Vercel
4. ✅ Configure GitHub Actions secrets
5. ✅ Run end-to-end tests
6. ✅ Set up monitoring dashboards
7. ✅ Configure backup verification
8. ✅ Document runbooks

## Support

For environment setup issues:

- **Documentation**: This guide and AWS documentation
- **Slack**: #vaidyalink-infrastructure
- **Email**: devops@vaidyalink.com

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [HIPAA on AWS](https://aws.amazon.com/compliance/hipaa-compliance/)
- [VaidyaLink Architecture](../design.md)
