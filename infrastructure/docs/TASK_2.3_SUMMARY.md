# Task 2.3: AWS Organizations Setup - Implementation Summary

## Overview

This task implements AWS Organizations infrastructure for VaidyaLink's multi-account architecture, providing account isolation, security guardrails, and HIPAA compliance controls.

## What Was Implemented

### 1. Organizations Construct (`lib/constructs/organizations.ts`)

A reusable CDK construct that creates:

- **AWS Organization** with all features enabled
- **Organizational Units (OUs)**:
  - Workloads OU (for dev, staging, prod accounts)
  - Security OU (for security and logging accounts)
- **Member Accounts**:
  - VaidyaLink-Dev
  - VaidyaLink-Staging
  - VaidyaLink-Prod
  - VaidyaLink-Security
  - VaidyaLink-Logging
- **Service Control Policies (SCPs)**:
  - Base SCP with security guardrails
  - HIPAA Compliance SCP for production workloads
- **Cross-Account Deployment Role** for CI/CD

### 2. Organizations Stack (`lib/organizations-stack.ts`)

A standalone stack that can be deployed independently for Organizations setup.

### 3. Configuration Updates

Updated all environment configuration files (`config/*.json`) to include:

```json
{
  "organizations": {
    "enabled": true/false,
    "accountEmails": {
      "dev": "aws-dev@vaidyalink.in",
      "staging": "aws-staging@vaidyalink.in",
      "prod": "aws-prod@vaidyalink.in",
      "security": "aws-security@vaidyalink.in",
      "logging": "aws-logging@vaidyalink.in"
    }
  }
}
```

- **Dev/Staging**: Organizations disabled (single-account deployment)
- **Production**: Organizations enabled (multi-account deployment)

### 4. Deployment Scripts

Created automated deployment scripts:

- `scripts/deploy-organizations.sh` (Bash for Linux/Mac)
- `scripts/deploy-organizations.ps1` (PowerShell for Windows)

Features:

- Prerequisites checking
- Configuration validation
- Deployment plan visualization
- Confirmation prompts
- Post-deployment instructions

### 5. SCP Attachment Scripts

Created scripts to attach Service Control Policies after deployment:

- `scripts/attach-scps.sh` (Bash)
- `scripts/attach-scps.ps1` (PowerShell)

These scripts:

- Retrieve policy and OU IDs from stack outputs
- Attach Base SCP to all OUs
- Attach HIPAA SCP to staging and production accounts
- Handle errors gracefully

### 6. Documentation

Created comprehensive documentation:

- **`docs/ORGANIZATIONS_SETUP.md`**: Complete setup guide including:
  - Architecture overview
  - Account structure
  - Prerequisites
  - Configuration steps
  - Deployment instructions
  - Post-deployment steps
  - SCP details
  - Security best practices
  - Troubleshooting
  - Cost considerations
  - Compliance information

- **Updated `README.md`**: Added Organizations section with quick start instructions

## Architecture

```
AWS Organization (Root)
├── Workloads OU
│   ├── VaidyaLink-Dev Account
│   ├── VaidyaLink-Staging Account
│   └── VaidyaLink-Prod Account
└── Security OU
    ├── VaidyaLink-Security Account
    └── VaidyaLink-Logging Account
```

## Service Control Policies

### Base SCP (Applied to All Accounts)

Enforces:

- Cannot leave organization
- Cannot disable CloudTrail
- Cannot disable GuardDuty
- Cannot use root account
- Must use encrypted storage

### HIPAA Compliance SCP (Applied to Staging/Prod)

Enforces:

- MFA required for sensitive operations
- TLS required for all data transfer
- KMS encryption required
- Public access denied

## Security Features

1. **Account Isolation**: Separate AWS accounts for each environment
2. **Least Privilege**: SCPs enforce minimum security standards
3. **Audit Logging**: CloudTrail cannot be disabled
4. **Encryption**: All storage must be encrypted
5. **MFA**: Required for sensitive operations in production
6. **Cross-Account Roles**: Secure deployment access

## Compliance

### HIPAA Compliance (Requirement 7)

- Account isolation for PHI data
- Encryption at rest and in transit enforced by SCPs
- Audit logging mandatory
- MFA for sensitive operations
- Cryptographic erasure support

### ABDM Compliance

- Data residency in ap-south-1 (Mumbai)
- Security controls via SCPs
- Complete audit trails

## Usage

### Deploy Organizations (Production)

```bash
# Linux/Mac
cd infrastructure
./scripts/deploy-organizations.sh prod

# Windows
cd infrastructure
.\scripts\deploy-organizations.ps1 -Environment prod
```

### Attach Service Control Policies

```bash
# Linux/Mac
./scripts/attach-scps.sh prod

# Windows
.\scripts\attach-scps.ps1 -Environment prod
```

### Deploy to Member Accounts

After Organizations setup:

```bash
# Deploy to production account
cdk deploy VaidyaLink-prod
uild  # ✓ Success
npm test       # ✓ All tests pass
```

## Files Created/Modified

### Created Files

1. `lib/constructs/organizations.ts` - Organizations construct
2. `lib/organizations-stack.ts` - Standalone Organizations stack
3. `docs/ORGANIZATIONS_SETUP.md` - Complete setup guide
4. `docs/TASK_2.3_SUMMARY.md` - This summary
5. `scripts/deploy-organizations.sh` - Bash deployment script
6. `scripts/deploy-organizations.ps1` - PowerShell deployment script
7. `scripts/attach-scps.sh` - Bash SCP attachment script
8. `scripts/attach-scps.ps1` - PowerShell SCP attachment script

### Modified Files

1. `lib/vaidyalink-stack.ts` - Added Organizations integration
2. `config/dev.json` - Added Organizations configuration
3. `config/staging.json` - Added Organizations configuration
4. `config/prod.json` - Added Organizations configuration
5. `README.md` - Added Organizations documentation

## Next Steps

After deploying Organizations:

1. Accept account invitation emails
2. Run SCP attachment script
3. Enable AWS services in member accounts:
   - GuardDuty
   - Security Hub
   - AWS Config
4. Configure cross-account access for CI/CD
5. Set up billing alerts
6. Deploy workload stacks to member accounts

## Cost Considerations

- **AWS Organizations**: Free
- **Member Accounts**: No additional cost
- **SCPs**: Free
- **Consolidated Billing**: Free (provides volume discounts)

## References

- [AWS Organizations Documentation](https://docs.aws.amazon.com/organizations/)
- [Service Control Policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)
- [HIPAA on AWS](https://aws.amazon.com/compliance/hipaa-compliance/)
- [Multi-Account Strategy](https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/)

## Requirements Addressed

- **Requirement 7**: Security and Privacy - Account isolation and encryption enforcement
- **Requirement 11**: Scalability and Reliability - Multi-environment support
- **HIPAA Compliance**: Organizational controls and security guardrails
- **Design Principle**: Security-first architecture with proper isolation
