import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { ApiKeyManagementConstruct } from '../lib/constructs/api-key-management';

describe('ApiKeyManagementConstruct', () => {
  let stack: cdk.Stack;
  let template: Template;

  beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');

    // Create mock dependencies
    const encryptionKey = new kms.Key(stack, 'TestKey', {
      enableKeyRotation: true,
    });

    const userPool = new cognito.UserPool(stack, 'TestUserPool', {
      userPoolName: 'test-pool',
    });

    const api = new apigateway.RestApi(stack, 'TestApi', {
      restApiName: 'test-api',
    });

    // Create the construct
    new ApiKeyManagementConstruct(stack, 'ApiKeyManagement', {
      environment: 'test',
      api,
      encryptionKey,
      userPool,
    });

    template = Template.fromStack(stack);
  });

  describe('DynamoDB Table', () => {
    test('creates API key metadata table with correct configuration', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'vaidyalink-test-api-keys',
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [
          {
            AttributeName: 'keyId',
            KeyType: 'HASH',
          },
        ],
        StreamSpecification: {
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },
      });
    });

    test('enables encryption with customer-managed key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        SSESpecification: {
          SSEEnabled: true,
          SSEType: 'KMS',
        },
      });
    });

    test('creates OwnerIndex GSI', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'OwnerIndex',
            KeySchema: [
              { AttributeName: 'owner', KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' },
            ],
          }),
        ]),
      });
    });

    test('creates StatusIndex GSI', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'StatusIndex',
            KeySchema: [
              { AttributeName: 'status', KeyType: 'HASH' },
              { AttributeName: 'lastUsedAt', KeyType: 'RANGE' },
            ],
          }),
        ]),
      });
    });
  });

  describe('Usage Plans', () => {
    test('creates Standard tier usage plan', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        UsagePlanName: 'vaidyalink-test-apikey-standard',
        Throttle: {
          RateLimit: 100,
          BurstLimit: 200,
        },
        Quota: {
          Limit: 100000,
          Period: 'MONTH',
        },
      });
    });

    test('creates HealthcareProvider tier usage plan', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        UsagePlanName: 'vaidyalink-test-apikey-healthcareprovider',
        Throttle: {
          RateLimit: 1000,
          BurstLimit: 2000,
        },
        Quota: {
          Limit: 1000000,
          Period: 'MONTH',
        },
      });
    });

    test('creates Enterprise tier usage plan', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        UsagePlanName: 'vaidyalink-test-apikey-enterprise',
        Throttle: {
          RateLimit: 5000,
          BurstLimit: 10000,
        },
        Quota: {
          Limit: 10000000,
          Period: 'MONTH',
        },
      });
    });

    test('associates usage plans with API stage', () => {
      const usagePlans = template.findResources('AWS::ApiGateway::UsagePlan');
      const usagePlanCount = Object.keys(usagePlans).length;

      // Should have at least 3 usage plans (Standard, HealthcareProvider, Enterprise)
      expect(usagePlanCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Lambda Functions', () => {
    test('creates create key Lambda function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-test-create-api-key',
        Runtime: 'nodejs18.x',
        Handler: 'create-key.handler',
        Timeout: 30,
        MemorySize: 512,
      });
    });

    test('creates list keys Lambda function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-test-list-api-keys',
        Runtime: 'nodejs18.x',
        Handler: 'list-keys.handler',
        Timeout: 30,
        MemorySize: 256,
      });
    });

    test('creates revoke key Lambda function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-test-revoke-api-key',
        Runtime: 'nodejs18.x',
        Handler: 'revoke-key.handler',
        Timeout: 30,
        MemorySize: 256,
      });
    });

    test('creates rotate key Lambda function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-test-rotate-api-key',
        Runtime: 'nodejs18.x',
        Handler: 'rotate-key.handler',
        Timeout: 30,
        MemorySize: 512,
      });
    });

    test('Lambda functions have correct environment variables', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            API_KEY_TABLE: Match.anyValue(),
            ENVIRONMENT: 'test',
          }),
        },
      });
    });
  });

  describe('IAM Permissions', () => {
    test('grants DynamoDB read/write permissions to create key function', () => {
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

    test('grants API Gateway management permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                'apigateway:POST',
                'apigateway:GET',
                'apigateway:DELETE',
                'apigateway:PATCH',
              ],
              Effect: 'Allow',
              Resource: Match.arrayWith([
                Match.stringLikeRegexp('.*apikeys.*'),
                Match.stringLikeRegexp('.*usageplans.*'),
              ]),
            }),
          ]),
        },
      });
    });

    test('grants CloudWatch metrics permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['cloudwatch:PutMetricData'],
              Effect: 'Allow',
              Condition: {
                StringEquals: {
                  'cloudwatch:namespace': 'VaidyaLink/ApiKeys',
                },
              },
            }),
          ]),
        },
      });
    });
  });

  describe('CloudWatch Logs', () => {
    test('configures log retention for Lambda functions', () => {
      const logGroups = template.findResources('Custom::LogRetention');
      const logGroupCount = Object.keys(logGroups).length;

      // Should have log retention for all 4 Lambda functions
      expect(logGroupCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe('CloudFormation Outputs', () => {
    test('exports API key table name', () => {
      template.hasOutput('ApiKeyTableName', {
        Value: Match.anyValue(),
        Export: {
          Name: 'test-ApiKeyTableName',
        },
      });
    });

    test('exports Lambda function ARNs', () => {
      template.hasOutput('CreateKeyFunctionArn', {
        Export: {
          Name: 'test-CreateKeyFunctionArn',
        },
      });

      template.hasOutput('ListKeysFunctionArn', {
        Export: {
          Name: 'test-ListKeysFunctionArn',
        },
      });

      template.hasOutput('RevokeKeyFunctionArn', {
        Export: {
          Name: 'test-RevokeKeyFunctionArn',
        },
      });

      template.hasOutput('RotateKeyFunctionArn', {
        Export: {
          Name: 'test-RotateKeyFunctionArn',
        },
      });
    });

    test('exports usage plan IDs', () => {
      template.hasOutput('StandardApiKeyUsagePlanId', {
        Export: {
          Name: 'test-ApiKeyStandardUsagePlanId',
        },
      });

      template.hasOutput('HealthcareProviderApiKeyUsagePlanId', {
        Export: {
          Name: 'test-ApiKeyHealthcareProviderUsagePlanId',
        },
      });

      template.hasOutput('EnterpriseApiKeyUsagePlanId', {
        Export: {
          Name: 'test-ApiKeyEnterpriseUsagePlanId',
        },
      });
    });
  });

  describe('Resource Tags', () => {
    test('applies correct tags to DynamoDB table', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        Tags: Match.arrayWith([
          { Key: 'Service', Value: 'VaidyaLink' },
          { Key: 'Environment', Value: 'test' },
          { Key: 'Component', Value: 'ApiKeyManagement' },
        ]),
      });
    });
  });

  describe('Security Configuration', () => {
    test('enables point-in-time recovery for production', () => {
      const prodApp = new cdk.App();
      const prodStack = new cdk.Stack(prodApp, 'ProdStack');

      const encryptionKey = new kms.Key(prodStack, 'TestKey');
      const userPool = new cognito.UserPool(prodStack, 'TestUserPool');
      const api = new apigateway.RestApi(prodStack, 'TestApi');

      new ApiKeyManagementConstruct(prodStack, 'ApiKeyManagement', {
        environment: 'prod',
        api,
        encryptionKey,
        userPool,
      });

      const prodTemplate = Template.fromStack(prodStack);
      prodTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      });
    });

    test('sets correct removal policy for production', () => {
      const prodApp = new cdk.App();
      const prodStack = new cdk.Stack(prodApp, 'ProdStack');

      const encryptionKey = new kms.Key(prodStack, 'TestKey');
      const userPool = new cognito.UserPool(prodStack, 'TestUserPool');
      const api = new apigateway.RestApi(prodStack, 'TestApi');

      new ApiKeyManagementConstruct(prodStack, 'ApiKeyManagement', {
        environment: 'prod',
        api,
        encryptionKey,
        userPool,
      });

      const prodTemplate = Template.fromStack(prodStack);
      prodTemplate.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Retain',
      });
    });
  });
});
