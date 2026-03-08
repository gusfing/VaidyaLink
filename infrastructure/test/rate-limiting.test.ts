import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { RateLimitingConstruct } from '../lib/constructs/rate-limiting';

describe('RateLimitingConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let api: apigateway.RestApi;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { region: 'ap-south-1', account: '123456789012' },
    });

    // Create mock API Gateway
    api = new apigateway.RestApi(stack, 'TestApi', {
      restApiName: 'test-api',
      deployOptions: {
        stageName: 'test',
      },
    });
  });

  test('creates DynamoDB table for rate limit tracking', () => {
    new RateLimitingConstruct(stack, 'RateLimiting', {
      environment: 'dev',
      api,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'vaidyalink-dev-rate-limits',
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'windowStart', AttributeType: 'N' },
      ],
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'windowStart', KeyType: 'RANGE' },
      ],
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true,
      },
    });
  });

  test('creates GSI for window queries', () => {
    new RateLimitingConstruct(stack, 'RateLimiting', {
      environment: 'dev',
      api,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: [
        {
          IndexName: 'WindowStartIndex',
          KeySchema: [{ AttributeName: 'windowStart', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'KEYS_ONLY' },
        },
      ],
    });
  });

  test('creates usage plans for all tiers', () => {
    new RateLimitingConstruct(stack, 'RateLimiting', {
      environment: 'dev',
      api,
    });

    const template = Template.fromStack(stack);

    // Patient tier
    template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
      UsagePlanName: 'vaidyalink-dev-patient',
      Throttle: {
        RateLimit: 100,
        BurstLimit: 200,
      },
      Quota: {
        Limit: 100000,
        Period: 'MONTH',
      },
    });

    // Healthcare Provider tier
    template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
      UsagePlanName: 'vaidyalink-dev-healthcareprovider',
      Throttle: {
        RateLimit: 1000,
        BurstLimit: 2000,
      },
      Quota: {
        Limit: 1000000,
        Period: 'MONTH',
      },
    });

    // HITL Verifier tier
    template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
      UsagePlanName: 'vaidyalink-dev-hitlverifier',
      Throttle: {
        RateLimit: 500,
        BurstLimit: 1000,
      },
      Quota: {
        Limit: 500000,
        Period: 'MONTH',
      },
    });

    // Admin tier
    template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
      UsagePlanName: 'vaidyalink-dev-admin',
      Throttle: {
        RateLimit: 2000,
        BurstLimit: 4000,
      },
      Quota: {
        Limit: 2000000,
        Period: 'MONTH',
      },
    });
  });

  test('creates rate limit authorizer Lambda', () => {
    new RateLimitingConstruct(stack, 'RateLimiting', {
      environment: 'dev',
      api,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'vaidyalink-dev-rate-limit-authorizer',
      Runtime: 'nodejs18.x',
      Handler: 'index.handler',
      Timeout: 10,
      MemorySize: 256,
      Environment: {
        Variables: {
          RATE_LIMIT_TABLE: Match.anyValue(),
          ENVIRONMENT: 'dev',
        },
      },
    });
  });

  test('grants DynamoDB permissions to authorizer', () => {
    new RateLimitingConstruct(stack, 'RateLimiting', {
      environment: 'dev',
      api,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'dynamodb:BatchGetItem',
              'dynamodb:GetRecords',
              'dynamodb:GetShardIterator',
              'dynamodb:Query',
              'dynamodb:GetItem',
              'dynamodb:Scan',
              'dynamodb:ConditionCheckItem',
              'dynamodb:BatchWriteItem',
              'dynamodb:PutItem',
              'dynamodb:UpdateItem',
              'dynamodb:DeleteItem',
            ]),
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  test('associates usage plans with API stage', () => {
    new RateLimitingConstruct(stack, 'RateLimiting', {
      environment: 'dev',
      api,
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::ApiGateway::UsagePlanKey', 4);
  });

  test('retains resources in production', () => {
    new RateLimitingConstruct(stack, 'RateLimiting', {
      environment: 'prod',
      api,
    });

    const template = Template.fromStack(stack);

    template.hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
  });

  test('enables point-in-time recovery in production', () => {
    new RateLimitingConstruct(stack, 'RateLimiting', {
      environment: 'prod',
      api,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
    });
  });

  test('exports CloudFormation outputs', () => {
    new RateLimitingConstruct(stack, 'RateLimiting', {
      environment: 'dev',
      api,
    });

    const template = Template.fromStack(stack);

    template.hasOutput('RateLimitTableName', {
      Export: { Name: 'dev-RateLimitTableName' },
    });

    template.hasOutput('RateLimitAuthorizerArn', {
      Export: { Name: 'dev-RateLimitAuthorizerArn' },
    });

    template.hasOutput('PatientUsagePlanId', {
      Export: { Name: 'dev-PatientUsagePlanId' },
    });

    template.hasOutput('HealthcareProviderUsagePlanId', {
      Export: { Name: 'dev-HealthcareProviderUsagePlanId' },
    });
  });

  test('can create API key for user', () => {
    const construct = new RateLimitingConstruct(stack, 'RateLimiting', {
      environment: 'dev',
      api,
    });

    const apiKey = construct.createApiKey('user-123', 'Patient', 'Test user API key');

    expect(apiKey).toBeDefined();

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ApiGateway::ApiKey', {
      Name: 'vaidyalink-user-123',
      Description: 'Test user API key',
      Enabled: true,
    });
  });

  test('throws error for invalid tier', () => {
    const construct = new RateLimitingConstruct(stack, 'RateLimiting', {
      environment: 'dev',
      api,
    });

    expect(() => {
      construct.createApiKey('user-123', 'InvalidTier');
    }).toThrow('Invalid tier: InvalidTier');
  });
});
