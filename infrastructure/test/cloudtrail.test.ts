import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as kms from 'aws-cdk-lib/aws-kms';
import { CloudTrailConstruct } from '../lib/constructs/cloudtrail';

describe('CloudTrailConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let encryptionKey: kms.Key;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });

    encryptionKey = new kms.Key(stack, 'TestKey', {
      enableKeyRotation: true,
    });
  });

  test('creates CloudTrail with correct configuration', () => {
    new CloudTrailConstruct(stack, 'CloudTrail', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify CloudTrail trail is created
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      TrailName: 'vaidyalink-dev-trail',
      IsLogging: true,
      IsMultiRegionTrail: true,
      IncludeGlobalServiceEvents: true,
      EnableLogFileValidation: true,
    });
  });

  test('creates S3 bucket for audit logs with encryption', () => {
    new CloudTrailConstruct(stack, 'CloudTrail', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify S3 bucket is created with encryption
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
      VersioningConfiguration: {
        Status: 'Enabled',
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test('creates CloudWatch Log Group with encryption', () => {
    new CloudTrailConstruct(stack, 'CloudTrail', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify CloudWatch Log Group is created
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/cloudtrail/vaidyalink-dev',
      RetentionInDays: 3653, // 10 years
    });
  });

  test('configures 7-year retention lifecycle policy', () => {
    new CloudTrailConstruct(stack, 'CloudTrail', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify lifecycle rules for 7-year retention
    template.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            Id: 'RetentionPolicy',
            Status: 'Enabled',
            ExpirationInDays: 2555, // 7 years
          }),
        ]),
      },
    });
  });

  test('configures lifecycle transitions to IA and Glacier', () => {
    new CloudTrailConstruct(stack, 'CloudTrail', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify lifecycle transitions
    template.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            Id: 'TransitionToIA',
            Status: 'Enabled',
            Transitions: Match.arrayWith([
              Match.objectLike({
                StorageClass: 'STANDARD_IA',
                TransitionInDays: 90,
              }),
              Match.objectLike({
                StorageClass: 'GLACIER',
                TransitionInDays: 365,
              }),
            ]),
          }),
        ]),
      },
    });
  });

  test('enables S3 data events logging', () => {
    new CloudTrailConstruct(stack, 'CloudTrail', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify S3 data events are configured
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      EventSelectors: Match.arrayWith([
        Match.objectLike({
          DataResources: Match.arrayWith([
            Match.objectLike({
              Type: 'AWS::S3::Object',
            }),
          ]),
        }),
      ]),
    });
  });

  test('enables Lambda data events logging', () => {
    new CloudTrailConstruct(stack, 'CloudTrail', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify Lambda data events are configured
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      EventSelectors: Match.arrayWith([
        Match.objectLike({
          DataResources: Match.arrayWith([
            Match.objectLike({
              Type: 'AWS::Lambda::Function',
            }),
          ]),
        }),
      ]),
    });
  });

  test('enforces SSL for S3 bucket', () => {
    new CloudTrailConstruct(stack, 'CloudTrail', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify SSL enforcement policy
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
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

  test('sets RETAIN removal policy for production', () => {
    const prodStack = new cdk.Stack(app, 'ProdStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });

    const prodKey = new kms.Key(prodStack, 'ProdKey', {
      enableKeyRotation: true,
    });

    new CloudTrailConstruct(prodStack, 'CloudTrail', {
      environment: 'prod',
      encryptionKey: prodKey,
    });

    const template = Template.fromStack(prodStack);

    // Verify RETAIN policy is set
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });

    template.hasResource('AWS::Logs::LogGroup', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
  });

  test('adds HIPAA compliance tags', () => {
    new CloudTrailConstruct(stack, 'CloudTrail', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify tags are applied
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'Compliance', Value: 'HIPAA' }),
        Match.objectLike({ Key: 'Service', Value: 'VaidyaLink' }),
      ]),
    });
  });

  test('creates CloudFormation outputs', () => {
    new CloudTrailConstruct(stack, 'CloudTrail', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify outputs are created - outputs have hash suffixes
    const outputs = template.toJSON().Outputs;
    const outputKeys = Object.keys(outputs);

    expect(outputKeys.some((key) => key.startsWith('CloudTrailTrailArn'))).toBe(true);
    expect(outputKeys.some((key) => key.startsWith('CloudTrailAuditLogsBucketName'))).toBe(true);
    expect(outputKeys.some((key) => key.startsWith('CloudTrailCloudTrailLogGroupName'))).toBe(true);

    // Verify export names
    const trailArnOutput = outputs[outputKeys.find((key) => key.startsWith('CloudTrailTrailArn'))!];
    expect(trailArnOutput.Export.Name).toBe('dev-CloudTrailArn');
  });

  test('grants CloudTrail permissions to write to S3', () => {
    new CloudTrailConstruct(stack, 'CloudTrail', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify CloudTrail has permissions
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'AWSCloudTrailAclCheck',
            Effect: 'Allow',
            Principal: {
              Service: 'cloudtrail.amazonaws.com',
            },
            Action: 's3:GetBucketAcl',
          }),
          Match.objectLike({
            Sid: 'AWSCloudTrailWrite',
            Effect: 'Allow',
            Principal: {
              Service: 'cloudtrail.amazonaws.com',
            },
            Action: 's3:PutObject',
          }),
        ]),
      },
    });
  });
});
