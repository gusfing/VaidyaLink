import * as cdk from 'aws-cdk-lib';
import * as organizations from 'aws-cdk-lib/aws-organizations';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface OrganizationsConstructProps {
  /**
   * Environment name (dev, staging, prod)
   */
  environment: string;

  /**
   * Email addresses for account creation
   */
  accountEmails: {
    dev?: string;
    staging?: string;
    prod?: string;
    security?: string;
    logging?: string;
  };

  /**
   * Whether to enable AWS Organizations features
   * Set to false for single-account deployments
   */
  enableOrganizations?: boolean;
}

/**
 * AWS Organizations Construct
 *
 * Sets up AWS Organizations with proper account structure for:
 * - Development, Staging, and Production environments
 * - Security and compliance isolation (Requirement 7)
 * - HIPAA compliance organizational controls
 * - Service Control Policies (SCPs) for security guardrails
 * - Cross-account IAM roles for deployment
 */
export class OrganizationsConstruct extends Construct {
  public readonly organization?: organizations.CfnOrganization;
  public readonly rootOu?: organizations.CfnOrganizationalUnit;
  public readonly workloadsOu?: organizations.CfnOrganizationalUnit;
  public readonly securityOu?: organizations.CfnOrganizationalUnit;
  public readonly devAccount?: organizations.CfnAccount;
  public readonly stagingAccount?: organizations.CfnAccount;
  public readonly prodAccount?: organizations.CfnAccount;
  public readonly securityAccount?: organizations.CfnAccount;
  public readonly loggingAccount?: organizations.CfnAccount;
  public readonly deploymentRole?: iam.Role;

  constructor(scope: Construct, id: string, props: OrganizationsConstructProps) {
    super(scope, id);

    // Skip organization setup if disabled (for single-account deployments)
    if (props.enableOrganizations === false) {
      return;
    }

    // ========================================
    // AWS Organization
    // ========================================
    this.organization = new organizations.CfnOrganization(this, 'Organization', {
      featureSet: 'ALL', // Enable all features including SCPs
    });

    // ========================================
    // Organizational Units (OUs)
    // ========================================

    // Workloads OU - Contains application environments
    this.workloadsOu = new organizations.CfnOrganizationalUnit(this, 'WorkloadsOU', {
      name: 'Workloads',
      parentId: this.organization.attrRootId,
    });

    // Security OU - Contains security and logging accounts
    this.securityOu = new organizations.CfnOrganizationalUnit(this, 'SecurityOU', {
      name: 'Security',
      parentId: this.organization.attrRootId,
    });

    // ========================================
    // Member Accounts
    // ========================================

    // Development Account
    if (props.accountEmails.dev) {
      this.devAccount = new organizations.CfnAccount(this, 'DevAccount', {
        accountName: 'VaidyaLink-Dev',
        email: props.accountEmails.dev,
        parentIds: [this.workloadsOu.attrId],
        roleName: 'OrganizationAccountAccessRole',
        tags: [
          { key: 'Environment', value: 'dev' },
          { key: 'Project', value: 'VaidyaLink' },
          { key: 'ManagedBy', value: 'CDK' },
        ],
      });
    }

    // Staging Account
    if (props.accountEmails.staging) {
      this.stagingAccount = new organizations.CfnAccount(this, 'StagingAccount', {
        accountName: 'VaidyaLink-Staging',
        email: props.accountEmails.staging,
        parentIds: [this.workloadsOu.attrId],
        roleName: 'OrganizationAccountAccessRole',
        tags: [
          { key: 'Environment', value: 'staging' },
          { key: 'Project', value: 'VaidyaLink' },
          { key: 'ManagedBy', value: 'CDK' },
          { key: 'Compliance', value: 'HIPAA' },
        ],
      });
    }

    // Production Account
    if (props.accountEmails.prod) {
      this.prodAccount = new organizations.CfnAccount(this, 'ProdAccount', {
        accountName: 'VaidyaLink-Prod',
        email: props.accountEmails.prod,
        parentIds: [this.workloadsOu.attrId],
        roleName: 'OrganizationAccountAccessRole',
        tags: [
          { key: 'Environment', value: 'prod' },
          { key: 'Project', value: 'VaidyaLink' },
          { key: 'ManagedBy', value: 'CDK' },
          { key: 'Compliance', value: 'HIPAA' },
          { key: 'DataClassification', value: 'PHI' },
        ],
      });
    }

    // Security Account - Centralized security monitoring
    if (props.accountEmails.security) {
      this.securityAccount = new organizations.CfnAccount(this, 'SecurityAccount', {
        accountName: 'VaidyaLink-Security',
        email: props.accountEmails.security,
        parentIds: [this.securityOu.attrId],
        roleName: 'OrganizationAccountAccessRole',
        tags: [
          { key: 'Purpose', value: 'Security' },
          { key: 'Project', value: 'VaidyaLink' },
          { key: 'ManagedBy', value: 'CDK' },
        ],
      });
    }

    // Logging Account - Centralized logging and audit trails
    if (props.accountEmails.logging) {
      this.loggingAccount = new organizations.CfnAccount(this, 'LoggingAccount', {
        accountName: 'VaidyaLink-Logging',
        email: props.accountEmails.logging,
        parentIds: [this.securityOu.attrId],
        roleName: 'OrganizationAccountAccessRole',
        tags: [
          { key: 'Purpose', value: 'Logging' },
          { key: 'Project', value: 'VaidyaLink' },
          { key: 'ManagedBy', value: 'CDK' },
          { key: 'Compliance', value: 'HIPAA' },
        ],
      });
    }

    // ========================================
    // Service Control Policies (SCPs)
    // ========================================

    // Base SCP - Deny dangerous actions across all accounts
    const baseScp = new organizations.CfnPolicy(this, 'BaseSCP', {
      name: 'VaidyaLink-Base-SCP',
      description: 'Base security guardrails for all VaidyaLink accounts',
      type: 'SERVICE_CONTROL_POLICY',
      content: {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'DenyLeavingOrganization',
            Effect: 'Deny',
            Action: ['organizations:LeaveOrganization'],
            Resource: '*',
          },
          {
            Sid: 'DenyDisablingCloudTrail',
            Effect: 'Deny',
            Action: ['cloudtrail:StopLogging', 'cloudtrail:DeleteTrail', 'cloudtrail:UpdateTrail'],
            Resource: '*',
          },
          {
            Sid: 'DenyDisablingGuardDuty',
            Effect: 'Deny',
            Action: [
              'guardduty:DeleteDetector',
              'guardduty:DisassociateFromMasterAccount',
              'guardduty:StopMonitoringMembers',
            ],
            Resource: '*',
          },
          {
            Sid: 'DenyRootAccountUsage',
            Effect: 'Deny',
            Action: '*',
            Resource: '*',
            Condition: {
              StringLike: {
                'aws:PrincipalArn': 'arn:aws:iam::*:root',
              },
            },
          },
          {
            Sid: 'RequireEncryptedStorage',
            Effect: 'Deny',
            Action: ['s3:PutObject', 'dynamodb:CreateTable', 'rds:CreateDBInstance'],
            Resource: '*',
            Condition: {
              StringNotEquals: {
                's3:x-amz-server-side-encryption': ['AES256', 'aws:kms'],
              },
            },
          },
        ],
      },
    });

    // HIPAA Compliance SCP - Additional controls for production
    const hipaaComplianceScp = new organizations.CfnPolicy(this, 'HIPAAComplianceSCP', {
      name: 'VaidyaLink-HIPAA-Compliance-SCP',
      description: 'HIPAA compliance controls for production workloads',
      type: 'SERVICE_CONTROL_POLICY',
      content: {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'RequireMFAForSensitiveActions',
            Effect: 'Deny',
            Action: [
              's3:DeleteBucket',
              's3:DeleteObject',
              'dynamodb:DeleteTable',
              'kms:ScheduleKeyDeletion',
              'kms:DeleteAlias',
            ],
            Resource: '*',
            Condition: {
              BoolIfExists: {
                'aws:MultiFactorAuthPresent': 'false',
              },
            },
          },
          {
            Sid: 'DenyUnencryptedDataTransfer',
            Effect: 'Deny',
            Action: ['s3:*'],
            Resource: '*',
            Condition: {
              Bool: {
                'aws:SecureTransport': 'false',
              },
            },
          },
          {
            Sid: 'RequireKMSEncryption',
            Effect: 'Deny',
            Action: ['s3:PutObject', 'dynamodb:CreateTable'],
            Resource: '*',
            Condition: {
              StringNotEquals: {
                's3:x-amz-server-side-encryption': 'aws:kms',
              },
            },
          },
          {
            Sid: 'DenyPublicAccess',
            Effect: 'Deny',
            Action: ['s3:PutBucketPublicAccessBlock', 's3:PutAccountPublicAccessBlock'],
            Resource: '*',
            Condition: {
              StringNotEquals: {
                's3:x-amz-acl': 'private',
              },
            },
          },
        ],
      },
    });

    // Attach Base SCP to Workloads OU
    // Note: Policy attachments must be done via AWS CLI or Console after stack deployment
    // CDK does not currently support CfnPolicyAttachment
    // Run: aws organizations attach-policy --policy-id <policy-id> --target-id <ou-id>

    // Attach HIPAA SCP to Production and Staging Accounts
    // Run after deployment:
    // aws organizations attach-policy --policy-id <hipaa-policy-id> --target-id <prod-account-id>
    // aws organizations attach-policy --policy-id <hipaa-policy-id> --target-id <staging-account-id>

    // ========================================
    // Cross-Account Deployment Role
    // ========================================

    // Create IAM role for cross-account deployments
    // This role will be assumed by CI/CD pipeline to deploy to member accounts
    this.deploymentRole = new iam.Role(this, 'CrossAccountDeploymentRole', {
      roleName: 'VaidyaLink-CrossAccountDeployment',
      description: 'Role for deploying VaidyaLink infrastructure across accounts',
      assumedBy: new iam.CompositePrincipal(
        // Allow assumption from management account
        new iam.AccountPrincipal(cdk.Stack.of(this).account),
        // Allow assumption from GitHub Actions (OIDC)
        new iam.FederatedPrincipal(
          `arn:aws:iam::${cdk.Stack.of(this).account}:oidc-provider/token.actions.githubusercontent.com`,
          {
            StringEquals: {
              'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            },
            StringLike: {
              // Scope to VaidyaLink GitHub repository
              'token.actions.githubusercontent.com:sub': 'repo:gusfing/VaidyaLink:*',
            },
          },
          'sts:AssumeRoleWithWebIdentity'
        )
      ),
      maxSessionDuration: cdk.Duration.hours(2),
    });

    // Grant deployment permissions
    this.deploymentRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole', 'organizations:DescribeAccount', 'organizations:ListAccounts'],
        resources: ['*'],
      })
    );

    // Grant CloudFormation permissions for CDK deployments
    this.deploymentRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudformation:*',
          'iam:PassRole',
          'iam:GetRole',
          'iam:CreateRole',
          'iam:DeleteRole',
          'iam:AttachRolePolicy',
          'iam:DetachRolePolicy',
          'iam:PutRolePolicy',
          'iam:DeleteRolePolicy',
        ],
        resources: ['*'],
      })
    );

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'OrganizationId', {
      value: this.organization.attrId,
      description: 'AWS Organization ID',
      exportName: 'VaidyaLink-OrganizationId',
    });

    new cdk.CfnOutput(this, 'BaseSCPId', {
      value: baseScp.attrId,
      description: 'Base SCP Policy ID - Attach to OUs manually',
      exportName: 'VaidyaLink-BaseSCPId',
    });

    new cdk.CfnOutput(this, 'HIPAASCPId', {
      value: hipaaComplianceScp.attrId,
      description: 'HIPAA Compliance SCP Policy ID - Attach to production accounts manually',
      exportName: 'VaidyaLink-HIPAASCPId',
    });

    new cdk.CfnOutput(this, 'WorkloadsOUId', {
      value: this.workloadsOu.attrId,
      description: 'Workloads Organizational Unit ID',
      exportName: 'VaidyaLink-WorkloadsOUId',
    });

    new cdk.CfnOutput(this, 'SecurityOUId', {
      value: this.securityOu.attrId,
      description: 'Security Organizational Unit ID',
      exportName: 'VaidyaLink-SecurityOUId',
    });

    if (this.devAccount) {
      new cdk.CfnOutput(this, 'DevAccountId', {
        value: this.devAccount.ref,
        description: 'Development Account ID',
        exportName: 'VaidyaLink-DevAccountId',
      });
    }

    if (this.stagingAccount) {
      new cdk.CfnOutput(this, 'StagingAccountId', {
        value: this.stagingAccount.ref,
        description: 'Staging Account ID',
        exportName: 'VaidyaLink-StagingAccountId',
      });
    }

    if (this.prodAccount) {
      new cdk.CfnOutput(this, 'ProdAccountId', {
        value: this.prodAccount.ref,
        description: 'Production Account ID',
        exportName: 'VaidyaLink-ProdAccountId',
      });
    }

    if (this.securityAccount) {
      new cdk.CfnOutput(this, 'SecurityAccountId', {
        value: this.securityAccount.ref,
        description: 'Security Account ID',
        exportName: 'VaidyaLink-SecurityAccountId',
      });
    }

    if (this.loggingAccount) {
      new cdk.CfnOutput(this, 'LoggingAccountId', {
        value: this.loggingAccount.ref,
        description: 'Logging Account ID',
        exportName: 'VaidyaLink-LoggingAccountId',
      });
    }

    new cdk.CfnOutput(this, 'DeploymentRoleArn', {
      value: this.deploymentRole.roleArn,
      description: 'Cross-Account Deployment Role ARN',
      exportName: 'VaidyaLink-DeploymentRoleArn',
    });
  }
}
