# VaidyaLink Infrastructure

AWS CDK infrastructure as code for the VaidyaLink platform.

## Overview

This directory contains AWS CDK code to provision and manage all infrastructure resources for VaidyaLink.

## Structure

```
infrastructure/
├── bin/                    # CDK app entry point
│   └── vaidyalink.ts      # Main CDK app
├── lib/                    # CDK stack definitions
│   ├── vaidyalink-stack.ts # Main stack
│   ├── organizations-stack.ts # AWS Organizations stack
│   ├── constructs/        # Reusable CDK constructs
│   │   └── organizations.ts # AWS Organizations construct
│   ├── networking/        # VPC, subnets, security groups (future)
│   ├── storage/           # S3, DynamoDB, HealthLake (future)
│   ├── compute/           # Lambda functions (future)
│   ├── api/               # API Gateway (REST + WebSocket) (future)
│   ├── security/          # Cognito, KMS, IAM (future)
│   └── monitoring/        # CloudWatch, X-Ray (future)
├── config/                # Environment-specific configurations
│   ├── dev.json
│   ├── staging.json
│   └── prod.json
├── docs/                  # Documentation
│   └── ORGANIZATIONS_SETUP.md # AWS Organizations setup guide
├── scripts/               # Deployment and utility scripts
│   ├── deploy-organizations.sh # Bash deployment script
│   └── deploy-organizations.ps1 # PowerShell deployment script
├── test/                  # Unit tests
│   └── vaidyalink-stack.test.ts
├── cdk.json               # CDK configuration
├── jest.config.js         # Jest test configuration
├── package.json           # Dependencies
└── tsconfig.json          # TypeScript configuration
```

## Prerequisites

- Node.js 18+
- AWS CLI configured with appropriate credentials
- AWS CDK CLI: `npm install -g aws-cdk`

## Setup

```bash
cd infrastructure
npm install
```

## Configuration

Update the environment-specific configuration files in `config/`:

- `dev.json` - Development environment settings
- `staging.json` - Staging environment settings
- `prod.json` - Production environment settings

Replace `REPLACE_WITH_AWS_ACCOUNT_ID` with your actual AWS account ID.

### AWS Organizations Configuration

For multi-account deployments, configure AWS Organizations in the config files:

```json
{
  "organizations": {
    "enabled": true,
    "accountEmails": {
      "dev": "aws-dev@example.com",
      "staging": "aws-staging@example.com",
      "prod": "aws-prod@example.com",
      "security": "aws-security@example.com",
      "logging": "aws-logging@example.com"
    }
  }
}
```

**Note**: Organizations is enabled by default only in production. For development and staging, it's disabled to allow single-account deployments.

See [docs/ORGANIZATIONS_SETUP.md](docs/ORGANIZATIONS_SETUP.md) for detailed setup instructions.

## Deployment

### AWS Organizations Setup (Production Only)

For production deployments with multi-account architecture:

**Linux/Mac**:

```bash
cd infrastructure
./scripts/deploy-organizations.sh prod
```

**Windows**:

```powershell
cd infrastructure
.\scripts\deploy-organizations.ps1 -Environment prod
```

This will create:

- AWS Organization with all features enabled
- Organizational Units (Workloads, Security)
- Member accounts (Dev, Staging, Prod, Security, Logging)
- Service Control Policies for security guardrails
- Cross-account deployment roles

See [docs/ORGANIZATIONS_SETUP.md](docs/ORGANIZATIONS_SETUP.md) for detailed instructions.

### Bootstrap CDK (first time only)

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Development Environment

```bash
npm run deploy:dev
```

### Staging Environment

```bash
npm run deploy:staging
```

### Production Environment

```bash
npm run deploy:prod
```

## Testing

Run unit tests:

```bash
npm test
```

## Stacks

### VaidyaLinkStack (Main Stack)

The main stack contains all infrastructure resources organized into logical constructs:

- **OrganizationsConstruct** - AWS Organizations with multi-account structure, SCPs, and cross-account roles
- **NetworkingStack** - VPC with public and private subnets, NAT Gateway, Security groups
- **StorageStack** - S3 buckets for documents and audio, DynamoDB tables, AWS HealthLake
- **ComputeStack** - Lambda functions for all backend services, Lambda layers
- **ApiStack** - API Gateway REST API, WebSocket API, Request validation
- **SecurityStack** - Cognito user pools, KMS keys, IAM roles and policies
- **MonitoringStack** - CloudWatch log groups, metrics, alarms, X-Ray tracing

### OrganizationsStack (Separate Stack)

Optional separate stack for AWS Organizations that can be deployed independently:

```bash
cdk deploy VaidyaLink-Organizations --context env=prod
```

This stack creates the multi-account structure before deploying workload stacks.

## Cost Estimation

Run cost estimation before deployment:

```bash
cdk diff --context env=prod
```

## Useful Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile
- `npm test` - Run unit tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run synth` - Synthesize CloudFormation templates
- `npm run diff` - Compare deployed stack with current state
- `cdk deploy` - Deploy stacks to AWS
- `cdk destroy` - Remove stacks from AWS

## Environment Variables

Create a `.env` file in the infrastructure directory (optional):

```
CDK_DEFAULT_ACCOUNT=your-account-id
CDK_DEFAULT_REGION=ap-south-1
```

See `.env.example` for reference.
