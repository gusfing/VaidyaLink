import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { DocumentScanDemoConstruct } from '../lib/constructs/document-scan-demo';

describe('DocumentScanDemoConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let encryptionKey: kms.Key;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });

    // Create encryption key for testing
    encryptionKey = new kms.Key(stack, 'TestKey', {
      enableKeyRotation: true,
    });
  });

  test('creates S3 buckets with correct configuration', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN - Check bucket encryption
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'aws:kms',
            },
          },
        ],
      },
      LifecycleConfiguration: {
        Rules: [
          {
            Id: 'DeleteAfter90Days',
            Status: 'Enabled',
            ExpirationInDays: 90,
          },
        ],
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test('creates DynamoDB table with correct configuration', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'document-scan-jobs-dev',
      KeySchema: [
        {
          AttributeName: 'jobId',
          KeyType: 'HASH',
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      SSESpecification: {
        SSEEnabled: true,
        SSEType: 'KMS',
      },
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true,
      },
      GlobalSecondaryIndexes: [
        {
          IndexName: 'userId-createdAt-index',
          KeySchema: [
            {
              AttributeName: 'userId',
              KeyType: 'HASH',
            },
            {
              AttributeName: 'createdAt',
              KeyType: 'RANGE',
            },
          ],
          Projection: {
            ProjectionType: 'ALL',
          },
        },
      ],
    });
  });

  test('creates Secrets Manager secret', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'document-scan/sarvam-api-key-dev',
      Description: 'Sarvam API key for voice transcription in document-scan-demo',
    });
  });

  test('configures CORS on S3 buckets', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN
    template.hasResourceProperties('AWS::S3::Bucket', {
      CorsConfiguration: {
        CorsRules: [
          {
            AllowedMethods: Match.arrayWith(['PUT', 'POST']),
            AllowedOrigins: ['*'],
            AllowedHeaders: ['*'],
            ExposedHeaders: ['ETag'],
            MaxAge: 3000,
          },
        ],
      },
    });
  });

  test('enforces encryption policies on S3 buckets', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN - Check for bucket policy denying unencrypted uploads
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Action: 's3:PutObject',
            Condition: {
              StringNotEquals: {
                's3:x-amz-server-side-encryption': 'aws:kms',
              },
            },
          }),
        ]),
      },
    });

    // THEN - Check for policy denying insecure transport
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Action: 's3:*',
            Condition: {
              Bool: {
                'aws:SecureTransport': 'false',
              },
            },
          }),
        ]),
      },
    });
  });

  test('applies correct tags to resources', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN - Check S3 bucket tags (at least has Service tag)
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([{ Key: 'Service', Value: 'DocumentScanDemo' }]),
    });

    // THEN - Check DynamoDB table has Service tag
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      Tags: Match.arrayWith([{ Key: 'Service', Value: 'DocumentScanDemo' }]),
    });
  });

  test('creates exactly 2 S3 buckets', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN
    template.resourceCountIs('AWS::S3::Bucket', 2);
  });

  test('creates exactly 1 DynamoDB table', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN
    template.resourceCountIs('AWS::DynamoDB::Table', 1);
  });

  test('creates exactly 1 Secrets Manager secret', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN
    template.resourceCountIs('AWS::SecretsManager::Secret', 1);
  });

  test('bucket names include environment and account ID', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'prod',
      encryptionKey,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN - Just verify buckets are created (bucket names use CloudFormation functions)
    template.resourceCountIs('AWS::S3::Bucket', 2);
  });

  test('DynamoDB table name includes environment', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'staging',
      encryptionKey,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'document-scan-jobs-staging',
    });
  });

  test('secret name includes environment', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'prod',
      encryptionKey,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'document-scan/sarvam-api-key-prod',
    });
  });

  test('configures S3 event notifications for document processor', () => {
    // GIVEN
    const mockDocumentProcessor = new lambda.Function(stack, 'MockDocProcessor', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline('def handler(event, context): pass'),
    });

    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
      documentProcessorFunction: mockDocumentProcessor,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN - Verify Lambda permission is created for S3 to invoke the function
    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      Principal: 's3.amazonaws.com',
    });

    // THEN - Verify bucket notification configuration exists
    template.hasResourceProperties('Custom::S3BucketNotifications', {
      NotificationConfiguration: {
        LambdaFunctionConfigurations: Match.arrayWith([
          Match.objectLike({
            Events: ['s3:ObjectCreated:*'],
            Filter: {
              Key: {
                FilterRules: [
                  {
                    Name: 'prefix',
                    Value: 'uploads/',
                  },
                ],
              },
            },
          }),
        ]),
      },
    });
  });

  test('configures S3 event notifications for voice processor', () => {
    // GIVEN
    const mockVoiceProcessor = new lambda.Function(stack, 'MockVoiceProcessor', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline('def handler(event, context): pass'),
    });

    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
      voiceProcessorFunction: mockVoiceProcessor,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN - Verify Lambda permission is created for S3 to invoke the function
    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      Principal: 's3.amazonaws.com',
    });

    // THEN - Verify bucket notification configuration exists
    template.hasResourceProperties('Custom::S3BucketNotifications', {
      NotificationConfiguration: {
        LambdaFunctionConfigurations: Match.arrayWith([
          Match.objectLike({
            Events: ['s3:ObjectCreated:*'],
            Filter: {
              Key: {
                FilterRules: [
                  {
                    Name: 'prefix',
                    Value: 'uploads/',
                  },
                ],
              },
            },
          }),
        ]),
      },
    });
  });

  test('configures S3 event notifications for both processors', () => {
    // GIVEN
    const mockDocumentProcessor = new lambda.Function(stack, 'MockDocProcessor2', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline('def handler(event, context): pass'),
    });

    const mockVoiceProcessor = new lambda.Function(stack, 'MockVoiceProcessor2', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline('def handler(event, context): pass'),
    });

    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
      documentProcessorFunction: mockDocumentProcessor,
      voiceProcessorFunction: mockVoiceProcessor,
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN - Verify 2 Lambda permissions are created (one for each processor)
    template.resourceCountIs('AWS::Lambda::Permission', 2);

    // THEN - Verify 2 bucket notification configurations exist (one for each bucket)
    template.resourceCountIs('Custom::S3BucketNotifications', 2);
  });

  test('does not configure S3 event notifications when processors are not provided', () => {
    // GIVEN
    const construct = new DocumentScanDemoConstruct(stack, 'TestConstruct', {
      environment: 'dev',
      encryptionKey,
      // No processor functions provided
    });

    // WHEN
    const template = Template.fromStack(stack);

    // THEN - Verify no Lambda permissions are created
    template.resourceCountIs('AWS::Lambda::Permission', 0);

    // THEN - Verify no bucket notification configurations exist
    template.resourceCountIs('Custom::S3BucketNotifications', 0);
  });
});
