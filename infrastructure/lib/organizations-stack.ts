import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { OrganizationsConstruct } from './constructs/organizations';

export interface OrganizationsStackProps extends cdk.StackProps {
  config: {
    environment: string;
    organizations: {
      enabled: boolean;
      accountEmails: {
        dev?: string;
        staging?: string;
        prod?: string;
        security?: string;
        logging?: string;
      };
    };
  };
}

/**
 * AWS Organizations Stack
 *
 * This stack should be deployed FIRST in the management account
 * before deploying workload stacks to member accounts.
 *
 * It creates:
 * - AWS Organization with all features enabled
 * - Organizational Units (Workloads, Security)
 * - Member accounts (Dev, Staging, Prod, Security, Logging)
 * - Service Control Policies for security guardrails
 * - Cross-account deployment roles
 *
 * Deployment:
 * ```
 * cdk deploy VaidyaLink-Organizations --context env=prod
 * ```
 */
export class OrganizationsStack extends cdk.Stack {
  public readonly organizations: OrganizationsConstruct;

  constructor(scope: Construct, id: string, props: OrganizationsStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create AWS Organizations structure
    this.organizations = new OrganizationsConstruct(this, 'Organizations', {
      environment: config.environment,
      accountEmails: config.organizations.accountEmails,
      enableOrganizations: config.organizations.enabled,
    });

    // Stack outputs
    new cdk.CfnOutput(this, 'StackDescription', {
      value: 'AWS Organizations structure for VaidyaLink multi-account setup',
      description: 'Stack Description',
    });
  }
}
