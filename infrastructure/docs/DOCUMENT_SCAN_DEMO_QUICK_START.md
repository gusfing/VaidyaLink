# Document Scan Demo Infrastructure - Quick Start

This guide helps you quickly set up the AWS infrastructure for document-scan-demo.

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS CDK installed: `npm install -g aws-cdk`
- Node.js 18+ installed

## Quick Setup (5 minutes)

### Step 1: Install Dependencies

```bash
cd infrastructure
npm install
```

### Step 2: Bootstrap CDK (First Time Only)

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Step 3: Deploy Infrastructure

```bash
# For development environment
cdk deploy VaidyaLink-dev

# The deployment will create:
# - S3 bucket: document-scan-documents-dev-{accountId}
# - S3 bucket: document-scan-audio-dev-{accountId}
# - DynamoDB table: document-scan-jobs-dev
# - Secret: document-scan/sarvam-api-key-dev
```

### Step 4: Configure Sarvam API Key

See [SARVAM_API_KEY_SETUP.md](./SARVAM_API_KEY_SETUP.md) for detailed instructions.

**Quick method**:

```bash
# Using helper script (Linux/macOS)
cd infrastructure/scripts
./set-sarvam-api-key.sh dev your-sarvam-api-key-here

# Using helper script (Windows PowerShell)
cd infrastructure\scripts
.\set-sarvam-api-key.ps1 -Environment dev -ApiKey your-sarvam-api-key-here

# Or using AWS CLI directly
aws secretsmanager update-secret \
  --secret-id document-scan/sarvam-api-key-dev \
  --secret-string '{"apiKey":"your-sarvam-api-key-here"}'
```

### Step 5: Get Output Values

```bash
# Get the stack outputs
aws cloudformation describe-stacks \
  --stack-name VaidyaLink-dev \
  --query 'Stacks[0].Outputs'
```

### Step 6: Update Frontend Configuration

Create or update `frontend/.env.local`:

```env
# API Configuration
NEXT_PUBLIC_API_URL=https://your-api-gateway-url

# AWS Configuration
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_DOCUMENT_BUCKET=document-scan-documents-dev-{accountId}
NEXT_PUBLIC_AUDIO_BUCKET=document-scan-audio-dev-{accountId}

# Demo Mode (set to false for real AWS integration)
NEXT_PUBLIC_DEMO_MODE=false
```

## Verify Deployment

### Test S3 Buckets

```bash
# List documents bucket
aws s3 ls s3://document-scan-documents-dev-{accountId}/

# List audio bucket
aws s3 ls s3://document-scan-audio-dev-{accountId}/
```

### Test DynamoDB Table

```bash
# Describe the jobs table
aws dynamodb describe-table \
  --table-name document-scan-jobs-dev
```

### Test Secrets Manager

```bash
# Retrieve the Sarvam API key
aws secretsmanager get-secret-value \
  --secret-id document-scan/sarvam-api-key-dev
```

## Local Development with LocalStack

For local development without AWS costs:

### Step 1: Start LocalStack

```bash
# From project root
docker-compose up -d localstack
```

### Step 2: Deploy to LocalStack

```bash
cd infrastructure
AWS_ENDPOINT_URL=http://localhost:4566 \
  cdk deploy VaidyaLink-dev --require-approval never
```

### Step 3: Configure Frontend for LocalStack

```env
NEXT_PUBLIC_AWS_ENDPOINT=http://localhost:4566
NEXT_PUBLIC_AWS_REGION=us-east-1
```

## Common Commands

```bash
# View infrastructure changes before deploying
cdk diff

# Deploy with auto-approval
cdk deploy --require-approval never

# Destroy infrastructure (careful!)
cdk destroy

# View CloudFormation template
cdk synth

# List all stacks
cdk list
```

## Testing the Integration

### 1. Test Document Upload

```bash
# Generate a presigned URL (via API)
curl -X POST https://your-api/upload/presigned-url \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg"}'

# Upload file using presigned URL
curl -X PUT "PRESIGNED_URL" \
  --upload-file test.jpg
```

### 2. Test Job Status Polling

```bash
# Check job status
curl https://your-api/jobs/JOB_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Test Results Retrieval

```bash
# Get processing results
curl https://your-api/jobs/JOB_ID/results \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Issue: CDK Deploy Fails

**Error**: "Unable to resolve AWS account"

```bash
# Solution: Configure AWS credentials
aws configure
```

**Error**: "Stack already exists"

```bash
# Solution: Update existing stack
cdk deploy --force
```

### Issue: S3 Bucket Name Conflict

**Error**: "Bucket name already exists"

```bash
# Solution: Bucket names include account ID, ensure you're using correct account
aws sts get-caller-identity
```

### Issue: Lambda Not Triggered

**Check S3 event configuration**:

```bash
aws s3api get-bucket-notification-configuration \
  --bucket document-scan-documents-dev-{accountId}
```

**Check Lambda permissions**:

```bash
aws lambda get-policy \
  --function-name document-processor-dev
```

## Next Steps

1. **Set up Lambda Functions**: Deploy document processor and voice processor Lambda functions
2. **Configure API Gateway**: Set up REST API endpoints for presigned URLs and job management
3. **Set up Monitoring**: Configure CloudWatch alarms and dashboards
4. **Test End-to-End**: Upload a document and verify processing pipeline

## Cost Estimation

For development environment with moderate usage:

- **S3**: ~$0.50/month (assuming 10GB storage)
- **DynamoDB**: ~$1.00/month (on-demand pricing)
- **KMS**: ~$1.00/month (customer-managed key)
- **Secrets Manager**: ~$0.40/month (1 secret)
- **Total**: ~$3/month

## Security Checklist

- [ ] Sarvam API key stored in Secrets Manager
- [ ] S3 buckets have encryption enabled
- [ ] DynamoDB table has encryption enabled
- [ ] S3 CORS restricted to frontend domain (production)
- [ ] IAM roles follow least privilege principle
- [ ] CloudTrail enabled for audit logging
- [ ] Point-in-time recovery enabled for DynamoDB

## Support

For issues or questions:

1. Check the [full documentation](./DOCUMENT_SCAN_DEMO_INFRASTRUCTURE.md)
2. Review CloudWatch logs for Lambda functions
3. Check AWS CloudFormation events for deployment issues
4. Verify IAM permissions for all resources

## Clean Up

To remove all infrastructure:

```bash
# WARNING: This will delete all data!
cdk destroy VaidyaLink-dev

# Manually delete S3 buckets if they contain objects
aws s3 rm s3://document-scan-documents-dev-{accountId} --recursive
aws s3 rb s3://document-scan-documents-dev-{accountId}

aws s3 rm s3://document-scan-audio-dev-{accountId} --recursive
aws s3 rb s3://document-scan-audio-dev-{accountId}
```
