import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { OrganizationsConstruct } from './constructs/organizations';
import { SecurityConstruct } from './constructs/security';
import { StorageConstruct } from './constructs/storage';
import { LambdaFunctionsConstruct } from './constructs/lambda-functions';
import { ApiGatewayConstruct } from './constructs/api-gateway';
import { MonitoringConstruct } from './constructs/monitoring';
import { EventsConstruct } from './constructs/events';
import { CloudTrailConstruct } from './constructs/cloudtrail';
import { RateLimitingConstruct } from './constructs/rate-limiting';

export interface VaidyaLinkStackProps extends cdk.StackProps {
  config: {
    environment: string;
    region: string;
    domainName?: string;
    certificateArn?: string;
    bedrockModelId: string;
    confidenceThreshold: number;
    organizations?: {
      enabled: boolean;
      accountEmails: {
        dev?: string;
        staging?: string;
        prod?: string;
        security?: string;
        logging?: string;
      };
    };
    lambdaMemory: {
      documentProcessing: number;
      voiceProcessing: number;
      clinicalSummarizer: number;
      fhirTransformer: number;
      abdmConnector: number;
      hitlHandler: number;
    };
    lambdaTimeout: {
      documentProcessing: number;
      voiceProcessing: number;
      clinicalSummarizer: number;
      fhirTransformer: number;
      abdmConnector: number;
      hitlHandler: number;
    };
    enableIntelligentTiering?: boolean;
    [key: string]: any;
  };
}

export class VaidyaLinkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly vpcEndpointsSecurityGroup: ec2.SecurityGroup;
  public readonly organizations?: OrganizationsConstruct;
  public readonly security: SecurityConstruct;
  public readonly storage: StorageConstruct;
  public readonly lambdaFunctions: LambdaFunctionsConstruct;
  public readonly apiGateway: ApiGatewayConstruct;
  public readonly monitoring: MonitoringConstruct;
  public readonly events: EventsConstruct;
  public readonly cloudTrail: CloudTrailConstruct;
  public readonly rateLimiting: RateLimitingConstruct;

  constructor(scope: Construct, id: string, props: VaidyaLinkStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ========================================
    // AWS Organizations Setup
    // ========================================
    // Set up AWS Organizations with multi-account structure
    // This provides account isolation for security and compliance (Requirement 7)
    if (config.organizations) {
      this.organizations = new OrganizationsConstruct(this, 'Organizations', {
        environment: config.environment,
        accountEmails: config.organizations.accountEmails,
        enableOrganizations: config.organizations.enabled,
      });
    }

    // ========================================
    // VPC Configuration
    // ========================================
    // Create VPC with multi-AZ support for high availability (99.9% uptime requirement)
    // Using 2 AZs for cost optimization while meeting reliability requirements
    this.vpc = new ec2.Vpc(this, 'VaidyaLinkVPC', {
      vpcName: 'vaidyalink-vpc',
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2, // Multi-AZ deployment for 99.9% uptime (Requirement 11)

      // Subnet configuration
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          mapPublicIpOnLaunch: true,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],

      // NAT Gateway configuration
      // Using one NAT Gateway per AZ for high availability
      natGateways: 2,

      // Enable DNS support for VPC endpoints
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // Tag VPC for resource management and compliance
    cdk.Tags.of(this.vpc).add('Project', 'VaidyaLink');
    cdk.Tags.of(this.vpc).add('Environment', config.region);
    cdk.Tags.of(this.vpc).add('Compliance', 'HIPAA');

    // ========================================
    // VPC Endpoints for Cost Optimization
    // ========================================
    // Security group for VPC endpoints
    this.vpcEndpointsSecurityGroup = new ec2.SecurityGroup(this, 'VPCEndpointsSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for VPC endpoints',
      allowAllOutbound: false,
    });

    // Allow HTTPS traffic from Lambda security group (will be created below)
    this.vpcEndpointsSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      'Allow HTTPS from VPC'
    );

    // S3 Gateway Endpoint (no cost, no data transfer charges)
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [
        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // DynamoDB Gateway Endpoint (no cost, no data transfer charges)
    this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      subnets: [
        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // KMS endpoint (for encryption operations)
    this.vpc.addInterfaceEndpoint('KMSEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.KMS,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.vpcEndpointsSecurityGroup],
    });

    // CloudWatch Logs endpoint (for Lambda logging)
    this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.vpcEndpointsSecurityGroup],
    });

    // STS endpoint (for IAM role assumption)
    this.vpc.addInterfaceEndpoint('STSEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.STS,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.vpcEndpointsSecurityGroup],
    });

    // ========================================
    // Security Groups
    // ========================================

    // Lambda Security Group
    // Used by all Lambda functions for consistent network access control
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true, // Allow outbound for external API calls (Bhashini, ABDM)
    });

    // Tag security group for compliance
    cdk.Tags.of(this.lambdaSecurityGroup).add('Purpose', 'Lambda-Functions');
    cdk.Tags.of(this.lambdaSecurityGroup).add('Compliance', 'HIPAA');

    // Allow Lambda functions to communicate with VPC endpoints
    this.lambdaSecurityGroup.addEgressRule(
      this.vpcEndpointsSecurityGroup,
      ec2.Port.tcp(443),
      'Allow HTTPS to VPC endpoints'
    );

    // ========================================
    // Security Stack (KMS, Cognito)
    // ========================================

    this.security = new SecurityConstruct(this, 'Security', {
      environment: config.environment,
    });

    // ========================================
    // Storage Stack (DynamoDB, S3, HealthLake)
    // ========================================

    this.storage = new StorageConstruct(this, 'Storage', {
      environment: config.environment,
      encryptionKey: this.security.dynamoDbEncryptionKey,
      s3EncryptionKey: this.security.s3EncryptionKey,
      enableIntelligentTiering: config.enableIntelligentTiering ?? true,
    });

    // ========================================
    // Lambda Functions Stack
    // ========================================

    this.lambdaFunctions = new LambdaFunctionsConstruct(this, 'LambdaFunctions', {
      environment: config.environment,
      vpc: this.vpc,
      securityGroup: this.lambdaSecurityGroup,
      scanJobsTable: this.storage.scanJobsTable,
      patientsTable: this.storage.patientsTable,
      voiceJobsTable: this.storage.voiceJobsTable,
      documentsBucket: this.storage.documentsBucket,
      bedrockModelId: config.bedrockModelId,
      confidenceThreshold: config.confidenceThreshold,
      memoryConfig: config.lambdaMemory,
      timeoutConfig: config.lambdaTimeout,
    });

    // ========================================
    // API Gateway Stack
    // ========================================

    this.apiGateway = new ApiGatewayConstruct(this, 'ApiGateway', {
      environment: config.environment,
      userPool: this.security.userPool,
      documentProcessingFunction: this.lambdaFunctions.documentProcessingFunction,
      voiceProcessingFunction: this.lambdaFunctions.voiceProcessingFunction,
      clinicalSummarizerFunction: this.lambdaFunctions.clinicalSummarizerFunction,
      fhirTransformerFunction: this.lambdaFunctions.fhirTransformerFunction,
      abdmConnectorFunction: this.lambdaFunctions.abdmConnectorFunction,
      hitlHandlerFunction: this.lambdaFunctions.hitlHandlerFunction,
      domainName: config.domainName,
      certificateArn: config.certificateArn,
    });

    // ========================================
    // Monitoring Stack
    // ========================================

    this.monitoring = new MonitoringConstruct(this, 'Monitoring', {
      environment: config.environment,
      restApi: this.apiGateway.restApi,
      lambdaFunctions: [
        this.lambdaFunctions.documentProcessingFunction,
        this.lambdaFunctions.voiceProcessingFunction,
        this.lambdaFunctions.clinicalSummarizerFunction,
        this.lambdaFunctions.fhirTransformerFunction,
        this.lambdaFunctions.abdmConnectorFunction,
        this.lambdaFunctions.hitlHandlerFunction,
      ],
    });

    // ========================================
    // Event-Driven Architecture Stack
    // ========================================

    this.events = new EventsConstruct(this, 'Events', {
      environment: config.environment,
      documentsBucket: this.storage.documentsBucket,
      documentProcessingFunction: this.lambdaFunctions.documentProcessingFunction,
      fhirTransformerFunction: this.lambdaFunctions.fhirTransformerFunction,
      notificationTopic: this.monitoring.alarmTopic,
    });

    // ========================================
    // CloudTrail for Audit Logging
    // ========================================
    // CloudTrail provides comprehensive audit logging for HIPAA compliance (Requirement 7.8)
    // Logs all API calls, data access events, and security-related activities
    this.cloudTrail = new CloudTrailConstruct(this, 'CloudTrail', {
      environment: config.environment,
      encryptionKey: this.security.encryptionKey,
    });

    // ========================================
    // Rate Limiting
    // ========================================
    // Implement tiered rate limiting based on user roles (Task 6.2)
    // Protects API from abuse and ensures fair resource allocation
    this.rateLimiting = new RateLimitingConstruct(this, 'RateLimiting', {
      environment: config.environment,
      api: this.apiGateway.restApi,
    });

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'StackName', {
      value: this.stackName,
      description: 'VaidyaLink Stack Name',
    });

    new cdk.CfnOutput(this, 'Environment', {
      value: config.region,
      description: 'Deployment Region',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${this.stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'VpcCidr', {
      value: this.vpc.vpcCidrBlock,
      description: 'VPC CIDR Block',
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.vpc.privateSubnets.map((subnet) => subnet.subnetId).join(','),
      description: 'Private Subnet IDs for Lambda functions',
      exportName: `${this.stackName}-PrivateSubnetIds`,
    });

    new cdk.CfnOutput(this, 'IsolatedSubnetIds', {
      value: this.vpc.isolatedSubnets.map((subnet) => subnet.subnetId).join(','),
      description: 'Isolated Subnet IDs for sensitive resources',
      exportName: `${this.stackName}-IsolatedSubnetIds`,
    });

    new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
      value: this.lambdaSecurityGroup.securityGroupId,
      description: 'Security Group ID for Lambda functions',
      exportName: `${this.stackName}-LambdaSecurityGroupId`,
    });

    new cdk.CfnOutput(this, 'AvailabilityZones', {
      value: this.vpc.availabilityZones.join(','),
      description: 'Availability Zones used by VPC',
    });

    // Security Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.security.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${this.stackName}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.security.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${this.stackName}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.security.identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: `${this.stackName}-IdentityPoolId`,
    });

    new cdk.CfnOutput(this, 'EncryptionKeyId', {
      value: this.security.encryptionKey.keyId,
      description: 'KMS Encryption Key ID',
      exportName: `${this.stackName}-EncryptionKeyId`,
    });

    // Storage Outputs
    new cdk.CfnOutput(this, 'ScanJobsTableName', {
      value: this.storage.scanJobsTable.tableName,
      description: 'DynamoDB ScanJobs Table Name',
      exportName: `${this.stackName}-ScanJobsTableName`,
    });

    new cdk.CfnOutput(this, 'PatientsTableName', {
      value: this.storage.patientsTable.tableName,
      description: 'DynamoDB Patients Table Name',
      exportName: `${this.stackName}-PatientsTableName`,
    });

    new cdk.CfnOutput(this, 'VoiceJobsTableName', {
      value: this.storage.voiceJobsTable.tableName,
      description: 'DynamoDB VoiceJobs Table Name',
      exportName: `${this.stackName}-VoiceJobsTableName`,
    });

    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: this.storage.documentsBucket.bucketName,
      description: 'S3 Documents Bucket Name',
      exportName: `${this.stackName}-DocumentsBucketName`,
    });

    // API Gateway Outputs
    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: this.apiGateway.restApi.url,
      description: 'REST API Gateway URL',
      exportName: `${this.stackName}-RestApiUrl`,
    });

    new cdk.CfnOutput(this, 'RestApiId', {
      value: this.apiGateway.restApi.restApiId,
      description: 'REST API Gateway ID',
      exportName: `${this.stackName}-RestApiId`,
    });

    // Lambda Outputs
    new cdk.CfnOutput(this, 'DocumentProcessingFunctionArn', {
      value: this.lambdaFunctions.documentProcessingFunction.functionArn,
      description: 'Document Processing Lambda ARN',
    });

    new cdk.CfnOutput(this, 'VoiceProcessingFunctionArn', {
      value: this.lambdaFunctions.voiceProcessingFunction.functionArn,
      description: 'Voice Processing Lambda ARN',
    });

    new cdk.CfnOutput(this, 'ClinicalSummarizerFunctionArn', {
      value: this.lambdaFunctions.clinicalSummarizerFunction.functionArn,
      description: 'Clinical Summarizer Lambda ARN',
    });

    new cdk.CfnOutput(this, 'FHIRTransformerFunctionArn', {
      value: this.lambdaFunctions.fhirTransformerFunction.functionArn,
      description: 'FHIR Transformer Lambda ARN',
    });

    new cdk.CfnOutput(this, 'ABDMConnectorFunctionArn', {
      value: this.lambdaFunctions.abdmConnectorFunction.functionArn,
      description: 'ABDM Connector Lambda ARN',
    });

    new cdk.CfnOutput(this, 'HITLHandlerFunctionArn', {
      value: this.lambdaFunctions.hitlHandlerFunction.functionArn,
      description: 'HITL Handler Lambda ARN',
    });

    // Monitoring Outputs
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.monitoring.alarmTopic.topicArn,
      description: 'SNS Alarm Topic ARN',
      exportName: `${this.stackName}-AlarmTopicArn`,
    });

    new cdk.CfnOutput(this, 'DashboardName', {
      value: this.monitoring.dashboard.dashboardName,
      description: 'CloudWatch Dashboard Name',
    });

    // Events Outputs
    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.events.eventBus.eventBusName,
      description: 'EventBridge Event Bus Name',
      exportName: `${this.stackName}-EventBusName`,
    });

    // CloudTrail Outputs
    new cdk.CfnOutput(this, 'CloudTrailArn', {
      value: this.cloudTrail.trail.trailArn,
      description: 'CloudTrail Trail ARN',
      exportName: `${this.stackName}-CloudTrailArn`,
    });

    new cdk.CfnOutput(this, 'AuditLogsBucketName', {
      value: this.cloudTrail.auditLogsBucket.bucketName,
      description: 'S3 Bucket for CloudTrail Audit Logs',
      exportName: `${this.stackName}-AuditLogsBucketName`,
    });

    new cdk.CfnOutput(this, 'CloudTrailLogGroupName', {
      value: this.cloudTrail.cloudWatchLogGroup.logGroupName,
      description: 'CloudWatch Log Group for CloudTrail',
      exportName: `${this.stackName}-CloudTrailLogGroupName`,
    });

    // Rate Limiting Outputs
    new cdk.CfnOutput(this, 'RateLimitTableName', {
      value: this.rateLimiting.rateLimitTable.tableName,
      description: 'DynamoDB table for rate limit tracking',
      exportName: `${this.stackName}-RateLimitTableName`,
    });

    new cdk.CfnOutput(this, 'RateLimitAuthorizerArn', {
      value: this.rateLimiting.rateLimitAuthorizer.functionArn,
      description: 'Lambda authorizer for rate limiting',
      exportName: `${this.stackName}-RateLimitAuthorizerArn`,
    });
  }
}
