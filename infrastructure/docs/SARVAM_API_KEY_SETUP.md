# Sarvam API Key Setup Guide

This guide explains how to configure the Sarvam API key in AWS Secrets Manager for voice transcription in VaidyaLink.

## Overview

The Sarvam API key is stored securely in AWS Secrets Manager and accessed by the voice processing Lambda function during transcription operations. The secret is created automatically during infrastructure deployment but requires manual configuration of the actual API key value.

## Getting a Sarvam API Key

1. Visit [Sarvam AI](https://www.sarvam.ai/)
2. Sign up for an account
3. Navigate to the API Keys section in your dashboard
4. Generate a new API key
5. Copy the API key (it will look like `sk_sarvam_...`)

## Secret Details

- **Secret Name**: `vaidyalink/voice-processing/sarvam-api-key-{env}`
- **Format**: JSON with `apiKey` field
- **Purpose**: Authenticate requests to Sarvam API for voice transcription
- **Access**: Voice processor Lambda function only

**Secret Structure**:

```json
{
  "apiKey": "sk_sarvam_your_api_key_here"
}
```

## Prerequisites

1. AWS CLI installed and configured with appropriate credentials
2. Sarvam API key obtained from Sarvam AI
3. Infrastructure deployed (secret created but empty)
4. IAM permissions: `secretsmanager:UpdateSecret` and `secretsmanager:DescribeSecret`

## Setup Methods

### Method 1: Using the Helper Script (Recommended)

#### On Linux/macOS:

```bash
# Navigate to infrastructure directory
cd infrastructure/scripts

# Make script executable
chmod +x set-sarvam-api-key.sh

# Set the API key
./set-sarvam-api-key.sh dev sk_sarvam_abc123xyz

# For different environments
./set-sarvam-api-key.sh staging sk_sarvam_staging_key
./set-sarvam-api-key.sh prod sk_sarvam_prod_key
```

#### On Windows (PowerShell):

```powershell
# Navigate to infrastructure directory
cd infrastructure\scripts

# Set the API key
.\set-sarvam-api-key.ps1 -Environment dev -ApiKey sk_sarvam_abc123xyz

# For different environments
.\set-sarvam-api-key.ps1 -Environment staging -ApiKey sk_sarvam_staging_key
.\set-sarvam-api-key.ps1 -Environment prod -ApiKey sk_sarvam_prod_key

# Specify custom region
.\set-sarvam-api-key.ps1 -Environment dev -ApiKey sk_sarvam_abc123xyz -Region us-west-2
```

### Method 2: Using AWS CLI Directly

```bash
# Set for development environment
aws secretsmanager update-secret \
  --secret-id document-scan/sarvam-api-key-dev \
  --secret-string '{"apiKey":"sk_sarvam_abc123xyz"}' \
  --region us-east-1

# Set for staging environment
aws secretsmanager update-secret \
  --secret-id document-scan/sarvam-api-key-staging \
  --secret-string '{"apiKey":"sk_sarvam_staging_key"}' \
  --region us-east-1

# Set for production environment
aws secretsmanager update-secret \
  --secret-id document-scan/sarvam-api-key-prod \
  --secret-string '{"apiKey":"sk_sarvam_prod_key"}' \
  --region us-east-1
```

### Method 3: Using AWS Console

1. Navigate to AWS Secrets Manager in the AWS Console
2. Search for `document-scan/sarvam-api-key-{env}`
3. Click on the secret name
4. Click "Retrieve secret value"
5. Click "Edit"
6. Replace the secret value with:
   ```json
   {
     "apiKey": "your-actual-sarvam-api-key"
   }
   ```
7. Click "Save"

## Verification

### Verify Secret is Set

```bash
# Check secret exists and has a value
aws secretsmanager describe-secret \
  --secret-id document-scan/sarvam-api-key-dev \
  --region us-east-1

# Retrieve secret value (be careful with this in production!)
aws secretsmanager get-secret-value \
  --secret-id document-scan/sarvam-api-key-dev \
  --query 'SecretString' \
  --output text \
  --region us-east-1
```

### Test Lambda Access

The voice processor Lambda function should have the following IAM permission:

```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue"],
  "Resource": "arn:aws:secretsmanager:*:*:secret:document-scan/sarvam-api-key-*"
}
```

## Security Best Practices

### 1. Use Different Keys per Environment

- **Development**: Use a test API key with limited quota
- **Staging**: Use a separate key for staging testing
- **Production**: Use a production key with appropriate rate limits

### 2. Rotate Keys Regularly

```bash
# Update the key when rotating
./set-sarvam-api-key.sh prod new_rotated_key_here
```

### 3. Restrict Access

- Only grant `secretsmanager:GetSecretValue` to Lambda functions that need it
- Use resource-based policies to limit access to specific secrets
- Enable CloudTrail logging for secret access auditing

### 4. Monitor Usage

Set up CloudWatch alarms for:

- Unauthorized access attempts
- Unusual access patterns
- Secret retrieval failures

## Troubleshooting

### Error: Secret not found

**Cause**: Infrastructure not deployed or wrong environment name

**Solution**:

```bash
# List all secrets to verify
aws secretsmanager list-secrets --region us-east-1 | grep sarvam

# Deploy infrastructure first
cd infrastructure
npm run deploy:dev
```

### Error: Access Denied

**Cause**: Insufficient IAM permissions

**Solution**: Ensure your AWS credentials have `secretsmanager:UpdateSecret` permission:

```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:UpdateSecret", "secretsmanager:DescribeSecret"],
  "Resource": "arn:aws:secretsmanager:*:*:secret:document-scan/sarvam-api-key-*"
}
```

### Error: Invalid JSON format

**Cause**: Malformed JSON in secret value

**Solution**: Ensure the secret value is valid JSON with `apiKey` field:

```json
{
  "apiKey": "your-key-here"
}
```

### Lambda Cannot Read Secret

**Cause**: Lambda execution role missing permissions

**Solution**: Add the following policy to the Lambda execution role:

```json
{
  "Effect": "Allow",
  "Action": "secretsmanager:GetSecretValue",
  "Resource": "arn:aws:secretsmanager:*:*:secret:document-scan/sarvam-api-key-*"
}
```

## Cost Considerations

- **Storage**: $0.40 per secret per month
- **API Calls**: $0.05 per 10,000 API calls
- **Optimization**: Cache the secret value in Lambda to reduce API calls

## Lambda Integration Example

The voice processor Lambda retrieves the secret like this:

```python
import boto3
import json
import os

# Initialize Secrets Manager client (outside handler for caching)
secrets_client = boto3.client('secretsmanager')
_cached_api_key = None

def get_sarvam_api_key():
    """Retrieve Sarvam API key from Secrets Manager with caching"""
    global _cached_api_key

    if _cached_api_key:
        return _cached_api_key

    secret_name = f"document-scan/sarvam-api-key-{os.environ['ENVIRONMENT']}"

    try:
        response = secrets_client.get_secret_value(SecretId=secret_name)
        secret_data = json.loads(response['SecretString'])
        _cached_api_key = secret_data['apiKey']
        return _cached_api_key
    except Exception as e:
        logger.error(f"Failed to retrieve Sarvam API key: {str(e)}")
        raise
```

## References

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [Sarvam AI Documentation](https://docs.sarvam.ai/)
- [AWS CLI Secrets Manager Commands](https://docs.aws.amazon.com/cli/latest/reference/secretsmanager/)
- [Lambda Environment Variables vs Secrets Manager](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html)

## Next Steps

After setting up the Sarvam API key:

1. Deploy the voice processor Lambda function
2. Test voice transcription with a sample audio file
3. Monitor CloudWatch logs for successful API calls
4. Set up CloudWatch alarms for API errors
5. Configure automatic key rotation (optional)
