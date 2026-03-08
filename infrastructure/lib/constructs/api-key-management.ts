import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface ApiKeyManagementConstructProps {
  environment: string;
  api: apigateway.RestApi;
  encryptionKey: kms.Key;
  userPool: any; // cognito.UserPool
}

/**
 * API Key Management Construct for VaidyaLink
 *
 * Implements API key management for external integrations with:
 * - API Gateway API Keys and Usage Plans
 * - DynamoDB table for metadata tracking
 * - Lambda functions for CRUD operations
 * - Automatic key rotation mechanism
 * - CloudWatch metrics for usage monitoring
 */
export class ApiKeyManagementConstruct extends Construct {
  public readonly apiKeyTable: dynamodb.Table;
  public readonly usagePlans: Map<string, apigateway.UsagePlan>;
  public readonly createKeyFunction: lambda.Function;
  public readonly listKeysFunction: lambda.Function;
  public readonly revokeKeyFunction: lambda.Function;
  public readonly rotateKeyFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiKeyManagementConstructProps) {
    super(scope, id);

    const { environment, api, encryptionKey } = props;

    // ========================================
    // DynamoDB Table for API Key Metadata
    // ========================================

    this.apiKeyTable = new dynamodb.Table(this, 'ApiKeyTable', {
      tableName: `vaidyalink-${environment}-api-keys`,
      partitionKey: {
        name: 'keyId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: encryptionKey,
      pointInTimeRecovery: environment === 'prod',
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for querying by owner
    this.apiKeyTable.addGlobalSecondaryIndex({
      indexName: 'OwnerIndex',
      partitionKey: {
        name: 'owner',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for querying by status
    this.apiKeyTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'lastUsedAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================
    // Usage Plans for Different Tiers
    // ========================================

    this.usagePlans = new Map();

    const tiers = [
      {
        name: 'Standard',
        description: 'Standard tier for external integrations',
        throttle: { rateLimit: 100, burstLimit: 200 },
        quota: { limit: 100000, period: apigateway.Period.MONTH },
      },
      {
        name: 'HealthcareProvider',
        description: 'Healthcare provider tier with higher limits',
        throttle: { rateLimit: 1000, burstLimit: 2000 },
        quota: { limit: 1000000, period: apigateway.Period.MONTH },
      },
      {
        name: 'Enterprise',
        description: 'Enterprise tier for large-scale integrations',
        throttle: { rateLimit: 5000, burstLimit: 10000 },
        quota: { limit: 10000000, period: apigateway.Period.MONTH },
      },
    ];

    tiers.forEach((tier) => {
      const usagePlan = new apigateway.UsagePlan(this, `${tier.name}ApiKeyUsagePlan`, {
        name: `vaidyalink-${environment}-apikey-${tier.name.toLowerCase()}`,
        description: tier.description,
        throttle: tier.throttle,
        quota: tier.quota,
      });

      usagePlan.addApiStage({
        stage: api.deploymentStage,
      });

      this.usagePlans.set(tier.name, usagePlan);

      new cdk.CfnOutput(this, `${tier.name}ApiKeyUsagePlanId`, {
        value: usagePlan.usagePlanId,
        description: `Usage Plan ID for ${tier.name} API key tier`,
        exportName: `${environment}-ApiKey${tier.name}UsagePlanId`,
      });
    });

    // ========================================
    // Lambda Functions
    // ========================================

    // Create API Key Handler
    this.createKeyFunction = new lambda.Function(this, 'CreateKeyFunction', {
      functionName: `vaidyalink-${environment}-create-api-key`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'create-key.handler',
      code: lambda.Code.fromAsset('backend/api-key-management/dist'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        API_KEY_TABLE: this.apiKeyTable.tableName,
        ENVIRONMENT: environment,
        STANDARD_USAGE_PLAN_ID: this.usagePlans.get('Standard')!.usagePlanId,
        HEALTHCARE_USAGE_PLAN_ID: this.usagePlans.get('HealthcareProvider')!.usagePlanId,
        ENTERPRISE_USAGE_PLAN_ID: this.usagePlans.get('Enterprise')!.usagePlanId,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // List API Keys Handler
    this.listKeysFunction = new lambda.Function(this, 'ListKeysFunction', {
      functionName: `vaidyalink-${environment}-list-api-keys`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'list-keys.handler',
      code: lambda.Code.fromAsset('backend/api-key-management/dist'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        API_KEY_TABLE: this.apiKeyTable.tableName,
        ENVIRONMENT: environment,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Revoke API Key Handler
    this.revokeKeyFunction = new lambda.Function(this, 'RevokeKeyFunction', {
      functionName: `vaidyalink-${environment}-revoke-api-key`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'revoke-key.handler',
      code: lambda.Code.fromAsset('backend/api-key-management/dist'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        API_KEY_TABLE: this.apiKeyTable.tableName,
        ENVIRONMENT: environment,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Rotate API Key Handler
    this.rotateKeyFunction = new lambda.Function(this, 'RotateKeyFunction', {
      functionName: `vaidyalink-${environment}-rotate-api-key`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'rotate-key.handler',
      code: lambda.Code.fromAsset('backend/api-key-management/dist'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        API_KEY_TABLE: this.apiKeyTable.tableName,
        ENVIRONMENT: environment,
        STANDARD_USAGE_PLAN_ID: this.usagePlans.get('Standard')!.usagePlanId,
        HEALTHCARE_USAGE_PLAN_ID: this.usagePlans.get('HealthcareProvider')!.usagePlanId,
        ENTERPRISE_USAGE_PLAN_ID: this.usagePlans.get('Enterprise')!.usagePlanId,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // ========================================
    // IAM Permissions
    // ========================================

    // DynamoDB permissions
    this.apiKeyTable.grantReadWriteData(this.createKeyFunction);
    this.apiKeyTable.grantReadData(this.listKeysFunction);
    this.apiKeyTable.grantReadWriteData(this.revokeKeyFunction);
    this.apiKeyTable.grantReadWriteData(this.rotateKeyFunction);

    // API Gateway permissions for managing API keys
    const apiKeyManagementPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['apigateway:POST', 'apigateway:GET', 'apigateway:DELETE', 'apigateway:PATCH'],
      resources: [
        `arn:aws:apigateway:${cdk.Stack.of(this).region}::/apikeys`,
        `arn:aws:apigateway:${cdk.Stack.of(this).region}::/apikeys/*`,
        `arn:aws:apigateway:${cdk.Stack.of(this).region}::/usageplans/*/keys`,
        `arn:aws:apigateway:${cdk.Stack.of(this).region}::/usageplans/*/keys/*`,
      ],
    });

    this.createKeyFunction.addToRolePolicy(apiKeyManagementPolicy);
    this.revokeKeyFunction.addToRolePolicy(apiKeyManagementPolicy);
    this.rotateKeyFunction.addToRolePolicy(apiKeyManagementPolicy);

    // CloudWatch metrics permissions
    const metricsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'cloudwatch:namespace': 'VaidyaLink/ApiKeys',
        },
      },
    });

    [
      this.createKeyFunction,
      this.listKeysFunction,
      this.revokeKeyFunction,
      this.rotateKeyFunction,
    ].forEach((fn) => fn.addToRolePolicy(metricsPolicy));

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'ApiKeyTableName', {
      value: this.apiKeyTable.tableName,
      description: 'DynamoDB table for API key metadata',
      exportName: `${environment}-ApiKeyTableName`,
    });

    new cdk.CfnOutput(this, 'CreateKeyFunctionArn', {
      value: this.createKeyFunction.functionArn,
      description: 'Lambda function for creating API keys',
      exportName: `${environment}-CreateKeyFunctionArn`,
    });

    new cdk.CfnOutput(this, 'ListKeysFunctionArn', {
      value: this.listKeysFunction.functionArn,
      description: 'Lambda function for listing API keys',
      exportName: `${environment}-ListKeysFunctionArn`,
    });

    new cdk.CfnOutput(this, 'RevokeKeyFunctionArn', {
      value: this.revokeKeyFunction.functionArn,
      description: 'Lambda function for revoking API keys',
      exportName: `${environment}-RevokeKeyFunctionArn`,
    });

    new cdk.CfnOutput(this, 'RotateKeyFunctionArn', {
      value: this.rotateKeyFunction.functionArn,
      description: 'Lambda function for rotating API keys',
      exportName: `${environment}-RotateKeyFunctionArn`,
    });

    // Tags
    cdk.Tags.of(this.apiKeyTable).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.apiKeyTable).add('Environment', environment);
    cdk.Tags.of(this.apiKeyTable).add('Component', 'ApiKeyManagement');
  }
}
