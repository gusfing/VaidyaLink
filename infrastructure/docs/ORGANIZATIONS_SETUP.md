# AWS Organizations Setup Guide

This guide explains how to set up AWS Organizations for VaidyaLink's multi-account architecture.

## Overview

VaidyaLink uses AWS Organizations to provide:

- **Account Isolation**: Separate AWS accounts for dev, staging, and production environments
- **Security Guardrails**: Service Control Policies (SCPs) to enforce security best practices
- **HIPAA Compliance**: Organizational controls required for HIPAA compliance (Requirement 7)
- **Centralized Management**: Consolidated billing and centralized security monitoring
- **Cross-Account Deployment**: IAM roles for autom
  | Pre-production testing | staging |
  | **VaidyaLink-Prod** | Production workloads | prod |
  | **VaidyaLink-Security** | Security monitoring (GuardDuty, Security Hub) | N/A |
  | **VaidyaLink-Logging** | Centralized logging (CloudTrail, CloudWatch) | N/A |

## Prerequisites

1. **AWS Account**: You need an AWS account that will become the management account
2. **Email Addresses**: Unique email addresses for each member account (e.g., aws-dev@vaidyalink.in)
3. **Permissions**: Administrator access to the management account
4. **AWS CLI**: Configured with credentials for the management account

## Configuration

### Step 1: Update Email Addresses

Edit the configuration files to use your actual email addresses:

**infrastructure/config/prod.json**:

```json
{
  "organizations": {
    "enabled": true,
    "accountEmails": {
      "dev": "your-dev-email@example.com",
      "staging": "your-staging-email@example.com",
      "prod": "your-prod-email@example.com",
      "security": "your-security-email@example.com",
      "logging": "your-logging-email@example.com"
    }
  }
}
```

**Important**: Each email address must be unique and not already associated with an AWS account.

### Step 2: Enable Organizations (Production Only)

For development and staging, Organizations is disabled by default to allow single-account deployments:

```json
// dev.json and staging.json
{
  "organizations": {
    "enabled": false
  }
}
```

For production, enable Organizations:

```json
// prod.json
{
  "organizations": {
    "enabled": true
  }
}
```

## Deployment

### Option 1: Deploy Organizations with Main Stack

Deploy the main VaidyaLink stack which includes Organizations:

```bash
# Deploy to production (Organizations enabled)
cd infrastructure
cdk deploy VaidyaLink-prod --context env=prod

# Deploy to dev (Organizations disabled)
cdk deploy VaidyaLink-dev --context env=dev
```

### Option 2: Deploy Organizations Separately

For better control, deploy Organizations as a separate stack first:

```bash
cd infrastructure

# Bootstrap the management account
cdk bootstrap aws://ACCOUNT-ID/ap-south-1

# Deploy Organizations stack
cdk deploy VaidyaLink-Organizations --context env=prod

# Wait for accounts to be created (can take 5-10 minutes)

# Then deploy workload stacks to member accounts
cdk deploy VaidyaLink-prod --context env=prod
```

## Post-Deployment Steps

### 1. Accept Account Invitations

Each member account will receive an email invitation. Accept these invitations to complete account setup.

### 2. Enable AWS Services

In each member account, enable required AWS services:

```bash
# Enable GuardDuty
aws guardduty create-detector --enable

# Enable Security Hub
aws securityhub enable-security-hub

# Enable AWS Config
aws configservice put-configuration-recorder --configuration-recorder name=default,roleARN=arn:aws:iam::ACCOUNT-ID:role/aws-service-role/config.amazonaws.com/AWSServiceRoleForConfig
```

### 3. Configure Cross-Account Access

The deployment role is automatically created. To use it from CI/CD:

```bash
# Assume the deployment role
aws sts assume-role \
  --role-arn arn:aws:iam::MANAGEMENT-ACCOUNT-ID:role/VaidyaLink-CrossAccountDeployment \
  --role-session-name deployment-session
```

### 4. Attach Service Control Policies

After the stack is deployed, attach the SCPs to OUs and accounts:

**Linux/Mac**:

```bash
cd infrastructure
./scripts/attach-scps.sh prod
```

**Windows**:

```powershell
cd infrastructure
.\scripts\attach-scps.ps1 -Environment prod
```

This script will:

- Attach Base SCP to Workloads and Security OUs
- Attach HIPAA Compliance SCP to Staging and Production accounts

### 5. Set Up Consolidated Billing

Consolidated billing is automatically enabled. To view billing:

1. Go to AWS Billing Console in the management account
2. Navigate to "Consolidated Billing"
3. View costs by account

## Service Control Policies (SCPs)

### Base SCP

Applied to all accounts in the Workloads and Security OUs:

- **Deny leaving organization**: Prevents accounts from leaving the organization
- **Deny disabling CloudTrail**: Ensures audit logging cannot be disabled
- **Deny disabling GuardDuty**: Maintains security monitoring
- **Deny root account usage**: Enforces IAM user/role usage
- **Require encrypted storage**: Enforces encryption for S3, DynamoDB, RDS

### HIPAA Compliance SCP

Applied to Staging and Production accounts:

- **Require MFA for sensitive actions**: Deletion operations require MFA
- **Deny unencrypted data transfer**: All S3 operations must use TLS
- **Require KMS encryption**: S3 and DynamoDB must use KMS encryption
- **Deny public access**: Prevents making resources publicly accessible

## Security Best Practices

### 1. Management Account

- **Do not deploy workloads** in the management account
- **Enable MFA** for all IAM users
- **Use IAM roles** instead of IAM users where possible
- **Enable CloudTrail** for all regions
- **Set up billing alerts**

### 2. Member Accounts

- **Use IAM roles** for cross-account access
- **Enable GuardDuty** in all accounts
- **Enable Security Hub** for compliance monitoring
- **Configure AWS Config** for resource tracking
- **Set up CloudWatch alarms** for security events

### 3. Deployment

- **Use CI/CD pipelines** for deployments (GitHub Actions)
- **Never use long-term credentials** in CI/CD
- **Use OIDC** for GitHub Actions authentication
- **Implement approval gates** for production deployments
- **Test in dev/staging** before production

## Troubleshooting

### Account Creation Fails

**Error**: "Email address already in use"

**Solution**: Each account requires a unique email address. Use email aliases (e.g., aws+dev@example.com) if your email provider supports them.

### SCP Denies Required Action

**Error**: "Access denied by service control policy"

**Solution**: Review the SCP and either:

1. Modify the SCP to allow the action
2. Use a different approach that complies with the SCP

### Cross-Account Deployment Fails

**Error**: "Access denied when assuming role"

**Solution**:

1. Verify the role exists in the target account
2. Check the trust policy allows assumption from your account
3. Ensure the role has necessary permissions

## Cost Considerations

### AWS Organizations Costs

- **AWS Organizations**: Free
- **Member Accounts**: No additional cost
- **SCPs**: Free
- **Consolidated Billing**: Free

### Savings Opportunities

- **Volume Discounts**: Consolidated billing aggregates usage for volume discounts
- **Reserved Instances**: Can be shared across accounts
- **Savings Plans**: Apply across all accounts in the organization

## Compliance

### HIPAA Compliance

The Organizations setup supports HIPAA compliance through:

1. **Account Isolation**: PHI data isolated in production account
2. **SCPs**: Enforce encryption and access controls
3. **Audit Logging**: CloudTrail logs all API calls
4. **Access Controls**: Cross-account roles with least privilege

### ABDM Compliance

The setup supports ABDM integration requirements:

1. **Data Residency**: All accounts in ap-south-1 (Mumbai) region
2. **Security Controls**: SCPs enforce security best practices
3. **Audit Trails**: CloudTrail provides complete audit history

## Maintenance

### Adding New Accounts

To add a new account:

1. Update the configuration file with the new account email
2. Update the Organizations construct to create the new account
3. Deploy the stack
4. Accept the invitation email
5. Configure the new account

### Modifying SCPs

To modify SCPs:

1. Update the SCP policy in `infrastructure/lib/constructs/organizations.ts`
2. Deploy the stack
3. Test the changes in a non-production account first

### Removing Accounts

To remove an account:

1. Move all resources out of the account
2. Remove the account from the organization via AWS Console
3. Close the account if no longer needed

## References

- [AWS Organizations Documentation](https://docs.aws.amazon.com/organizations/)
- [Service Control Policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)
- [HIPAA on AWS](https://aws.amazon.com/compliance/hipaa-compliance/)
- [AWS Multi-Account Strategy](https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-your-aws-environment.html)

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review AWS Organizations documentation
3. Contact the VaidyaLink infrastructure team
