import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface RateLimitingConstructProps {
  environment: string;
  api: apigateway.RestApi;
}

/**
 * Rate Limiting Construct for VaidyaLink API Gateway
 *
 * Implements tiered rate limiting based on user roles:
 * - Patient: 100 req/min, burst 200
 * - Healthcare Provider: 1000 req/min, burst 2000
 * - HITL Verifier: 500 req/min, burst 1000
 * - Admin: 2000 req/min, burst 4000
 */
export class RateLimitingConstruct extends Construct {
  public readonly usagePlans: Map<string, apigateway.UsagePlan>;
  public readonly rateLimitTable: dynamodb.Table;
  public readonly rateLimitAuthorizer: lambda.Function;

  constructor(scope: Construct, id: string, props: RateLimitingConstructProps) {
    super(scope, id);

    this.usagePlans = new Map();

    // Create DynamoDB table for tracking rate limits
    this.rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {
      tableName: `vaidyalink-${props.environment}-rate-limits`,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'windowStart',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecovery: props.environment === 'prod',
      removalPolicy:
        props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for cleanup queries
    this.rateLimitTable.addGlobalSecondaryIndex({
      indexName: 'WindowStartIndex',
      partitionKey: {
        name: 'windowStart',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // Create usage plans for each tier
    this.createUsagePlans(props);

    // Create rate limit authorizer Lambda
    this.rateLimitAuthorizer = this.createRateLimitAuthorizer(props);

    // Outputs
    new cdk.CfnOutput(this, 'RateLimitTableName', {
      value: this.rateLimitTable.tableName,
      description: 'DynamoDB table for rate limit tracking',
      exportName: `${props.environment}-RateLimitTableName`,
    });

    new cdk.CfnOutput(this, 'RateLimitAuthorizerArn', {
      value: this.rateLimitAuthorizer.functionArn,
      description: 'Lambda authorizer for rate limiting',
      exportName: `${props.environment}-RateLimitAuthorizerArn`,
    });
  }

  private createUsagePlans(props: RateLimitingConstructProps): void {
    const tiers = [
      {
        name: 'Patient',
        description: 'Rate limit tier for regular patients',
        throttle: { rateLimit: 100, burstLimit: 200 },
        quota: { limit: 100000, period: apigateway.Period.MONTH },
      },
      {
        name: 'HealthcareProvider',
        description: 'Rate limit tier for healthcare providers',
        throttle: { rateLimit: 1000, burstLimit: 2000 },
        quota: { limit: 1000000, period: apigateway.Period.MONTH },
      },
      {
        name: 'HITLVerifier',
        description: 'Rate limit tier for HITL verifiers',
        throttle: { rateLimit: 500, burstLimit: 1000 },
        quota: { limit: 500000, period: apigateway.Period.MONTH },
      },
      {
        name: 'Admin',
        description: 'Rate limit tier for system administrators',
        throttle: { rateLimit: 2000, burstLimit: 4000 },
        quota: { limit: 2000000, period: apigateway.Period.MONTH },
      },
    ];

    tiers.forEach((tier) => {
      const usagePlan = new apigateway.UsagePlan(this, `${tier.name}UsagePlan`, {
        name: `vaidyalink-${props.environment}-${tier.name.toLowerCase()}`,
        description: tier.description,
        throttle: tier.throttle,
        quota: tier.quota,
      });

      // Associate with API stage
      usagePlan.addApiStage({
        stage: props.api.deploymentStage,
      });

      this.usagePlans.set(tier.name, usagePlan);

      // Output usage plan ID
      new cdk.CfnOutput(this, `${tier.name}UsagePlanId`, {
        value: usagePlan.usagePlanId,
        description: `Usage Plan ID for ${tier.name} tier`,
        exportName: `${props.environment}-${tier.name}UsagePlanId`,
      });
    });
  }

  private createRateLimitAuthorizer(props: RateLimitingConstructProps): lambda.Function {
    const authorizerFn = new lambda.Function(this, 'RateLimitAuthorizer', {
      functionName: `vaidyalink-${props.environment}-rate-limit-authorizer`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../backend/shared/nodejs/rate-limiter'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        RATE_LIMIT_TABLE: this.rateLimitTable.tableName,
        ENVIRONMENT: props.environment,
      },
      description: 'Lambda authorizer for API Gateway rate limiting',
    });

    // Grant DynamoDB permissions
    this.rateLimitTable.grantReadWriteData(authorizerFn);

    // Grant CloudWatch Logs permissions
    authorizerFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: ['*'],
      })
    );

    return authorizerFn;
  }

  /**
   * Create API key for a user with specific tier
   */
  public createApiKey(userId: string, tier: string, description?: string): apigateway.ApiKey {
    const usagePlan = this.usagePlans.get(tier);
    if (!usagePlan) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    const apiKey = new apigateway.ApiKey(this, `ApiKey-${userId}`, {
      apiKeyName: `vaidyalink-${userId}`,
      description: description || `API key for user ${userId} (${tier} tier)`,
      enabled: true,
    });

    usagePlan.addApiKey(apiKey);

    return apiKey;
  }
}
