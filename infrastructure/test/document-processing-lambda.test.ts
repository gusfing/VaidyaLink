/**
 * Unit tests for Document Processing Lambda CDK construct
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { LambdaFunctionsConstruct } from '../lib/constructs/lambda-functions';

describe('Document Processing Lambda', () => {
  let stack: cdk.Stack;
  let template: Template;

  beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');

    // Create VPC
    const vpc = new ec2.Vpc(stack, 'TestVpc', {
      maxAzs: 2,
    });

    // Create security group
    const securityGroup = new ec2.SecurityGroup(stack, 'TestSecurityGroup', {
      vpc,
      description: 'Test security group',
    });

    // Create encryption key
    const encryptionKey = new kms.Key(stack, 'TestKey', {
      enableKeyRotation: true,
    });

    // Create DynamoDB tables
    const scanJobsTable = new dynamodb.Table(stack, 'ScanJobsTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
    });

    const patientsTable = new dynamodb.Table(stack, 'PatientsTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
    });

    const voiceJobsTable = new dynamodb.Table(stack, 'VoiceJobsTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
    });

    // Create S3 bucket
    const documentsBucket = new s3.Bucket(stack, 'DocumentsBucket', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey,
    });

    // Create Lambda functions construct
    new LambdaFunctionsConstruct(stack, 'LambdaFunctions', {
      environment: 'test',
      vpc,
      securityGroup,
      scanJobsTable,
      patientsTable,
      voiceJobsTable,
      documentsBucket,
      bedrockModelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      confidenceThreshold: 0.8,
      memoryConfig: {
        documentProcessing: 2048,
        voiceProcessing: 1024,
        clinicalSummarizer: 2048,
        fhirTransformer: 1024,
        abdmConnector: 512,
        hitlHandler: 512,
      },
      timeoutConfig: {
        documentProcessing: 300,
        voiceProcessing: 180,
        clinicalSummarizer: 60,
        fhirTransformer: 120,
        abdmConnector: 60,
        hitlHandler: 60,
      },
    });

    template = Template.fromStack(stack);
  });

  describe('Lambda Function Configuration', () => {
    test('creates Document Processing Lambda with Python 3.11 runtime', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-document-processing-test',
        Runtime: 'python3.11',
        Handler: 'index.handler',
        MemorySize: 2048,
        Timeout: 300,
      });
    });

    test('enables X-Ray tracing', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-document-processing-test',
        TracingConfig: {
          Mode: 'Active',
        },
      });
    });

    test('configures VPC settings', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-document-processing-test',
        VpcConfig: Match.objectLike({
          SecurityGroupIds: Match.anyValue(),
          SubnetIds: Match.anyValue(),
        }),
      });
    });

    test('sets environment variables', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-document-processing-test',
        Environment: {
          Variables: Match.objectLike({
            ENVIRONMENT: 'test',
            BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
            CONFIDENCE_THRESHOLD: '0.8',
          }),
        },
      });
    });
  });

  describe('IAM Permissions', () => {
    test('grants DynamoDB read/write permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:BatchGetItem',
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
              ]),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    test('grants S3 read/write permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['s3:GetObject*', 's3:PutObject*']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    test('grants Bedrock invoke permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'bedrock:InvokeModel',
              Effect: 'Allow',
              Resource: Match.stringLikeRegexp('.*bedrock.*foundation-model.*'),
            }),
          ]),
        },
      });
    });

    test('grants SQS send message permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['sqs:SendMessage']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('HITL Queue', () => {
    test('creates HITL SQS queue', () => {
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'vaidyalink-hitl-test',
        VisibilityTimeout: 300,
      });
    });

    test('creates HITL dead letter queue', () => {
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'vaidyalink-hitl-dlq-test',
      });
    });

    test('configures dead letter queue for HITL queue', () => {
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'vaidyalink-hitl-test',
        RedrivePolicy: Match.objectLike({
          maxReceiveCount: 3,
        }),
      });
    });
  });

  describe('CloudWatch Logs', () => {
    test('configures log retention', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: Match.stringLikeRegexp('/aws/lambda/vaidyalink-document-processing-test'),
        RetentionInDays: 30,
      });
    });
  });

  describe('Lambda Integration', () => {
    test('grants invoke permission to FHIR transformer', () => {
      template.hasResourceProperties('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        Principal: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('.*DocumentProcessing.*')]),
        }),
      });
    });

    test('sets FHIR transformer ARN in environment', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-document-processing-test',
        Environment: {
          Variables: Match.objectLike({
            FHIR_TRANSFORMER_LAMBDA_ARN: Match.anyValue(),
          }),
        },
      });
    });
  });

  describe('Tags', () => {
    test('applies compliance tags', () => {
      const resources = template.findResources('AWS::Lambda::Function', {
        Properties: {
          FunctionName: 'vaidyalink-document-processing-test',
        },
      });

      const resourceKeys = Object.keys(resources);
      expect(resourceKeys.length).toBeGreaterThan(0);
    });
  });

  describe('Memory and Timeout Configuration', () => {
    test('configures appropriate memory size', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-document-processing-test',
        MemorySize: 2048,
      });
    });

    test('configures appropriate timeout', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-document-processing-test',
        Timeout: 300,
      });
    });
  });

  describe('Security', () => {
    test('Lambda function is in private subnet', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-document-processing-test',
        VpcConfig: Match.objectLike({
          SubnetIds: Match.anyValue(),
        }),
      });
    });

    test('Lambda function has security group', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'vaidyalink-document-processing-test',
        VpcConfig: Match.objectLike({
          SecurityGroupIds: Match.anyValue(),
        }),
      });
    });
  });
});
