# Infrastructure Scripts

This directory contains helper scripts for managing AWS infrastructure for the document-scan-demo application.

## Available Scripts

### set-sarvam-api-key.sh (Linux/macOS)

Bash script to set the Sarvam API key in AWS Secrets Manager.

**Usage**:

```bash
# Make executable (first time only)
chmod +x set-sarvam-api-key.sh

# Set API key
./set-sarvam-api-key.sh <environment> <api-key>

# Example
./set-sarvam-api-key.sh dev sk_sarvam_abc123xyz
```

**Parameters**:

- `environment`: Target environment (dev, staging, prod)
- `api-key`: Your Sarvam API key

**Environment Variables**:

- `AWS_REGION`: AWS region (default: us-east-1)

### set-sarvam-api-key.ps1 (Windows)

PowerShell script to set the Sarvam API key in AWS Secrets Manager.

**Usage**:

```powershell
# Set API key
.\set-sarvam-api-key.ps1 -Environment <env> -ApiKey <key>

# Example
.\set-sarvam-api-key.ps1 -Environment dev -ApiKey sk_sarvam_abc123xyz

# With custom region
.\set-sarvam-api-key.ps1 -Environment dev -ApiKey sk_sarvam_abc123xyz -Region us-west-2
```

**Parameters**:

- `-Environment`: Target environment (dev, staging, prod)
- `-ApiKey`: Your Sarvam API key
- `-Region`: AWS region (optional, default: us-east-1)

## Prerequisites

- AWS CLI installed and configured
- IAM permissions:
  - `secretsmanager:UpdateSecret`
  - `secretsmanager:DescribeSecret`
- Infrastructure deployed (secret must exist)

## Security Notes

1. **Never commit API keys to version control**
2. Use different API keys for each environment
3. Rotate keys regularly
4. Monitor secret access via CloudTrail
5. Use environment variables or secure vaults for CI/CD

## Troubleshooting

### Script Permission Denied (Linux/macOS)

```bash
chmod +x set-sarvam-api-key.sh
```

### AWS CLI Not Found

Install AWS CLI:

- Linux/macOS: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
- Windows: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

### Access Denied Error

Ensure your AWS credentials have the required permissions:

```bash
aws iam get-user
aws sts get-caller-identity
```

### Secret Not Found

Deploy infrastructure first:

```bash
cd infrastructure
npm run deploy:dev
```

## Related Documentation

- [SARVAM_API_KEY_SETUP.md](../docs/SARVAM_API_KEY_SETUP.md) - Detailed setup guide
- [DOCUMENT_SCAN_DEMO_QUICK_START.md](../docs/DOCUMENT_SCAN_DEMO_QUICK_START.md) - Quick start guide
- [DOCUMENT_SCAN_DEMO_INFRASTRUCTURE.md](../docs/DOCUMENT_SCAN_DEMO_INFRASTRUCTURE.md) - Full infrastructure documentation
