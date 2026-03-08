import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { VaidyaLinkStack } from '../lib/vaidyalink-stack';

describe('VaidyaLinkStack', () => {
  let app: cdk.App;
  let stack: VaidyaLinkStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    const config = {
      environment: 'test',
      region: 'ap-south-1',
      bedrockModelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      confidenceThreshold: 0.8,
      lambdaMemory: {
        documentProcessing: 2048,
        voiceProcessing: 1024,
        clinicalSummarizer: 1024,
        fhirTransformer: 512,
        abdmConnector: 512,
        hitlHandler: 512,
      },
      lambdaTimeout: {
        documentProcessing: 300,
        voiceProcessing: 180,
        clinicalSummarizer: 60,
        fhirTransformer: 30,
        abdmConnector: 30,
        hitlHandler: 30,
      },
    };

    stack = new VaidyaLinkStack(app, 'TestStack', {
      config,
    });

    template = Template.fromStack(stack);
  });

  test('Stack is created', () => {
    expect(stack).toBeDefined();
  });

  test('Stack has correct outputs', () => {
    template.hasOutput('StackName', {});
    template.hasOutput('Environment', {});
  });

  test('CloudTrail is configured in the stack', () => {
    // Verify CloudTrail trail exists
    template.resourceCountIs('AWS::CloudTrail::Trail', 1);

    // Verify CloudTrail has correct configuration
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      IsLogging: true,
      IsMultiRegionTrail: true,
      IncludeGlobalServiceEvents: true,
      EnableLogFileValidation: true,
    });
  });

  test('CloudTrail audit logs bucket is created', () => {
    // Verify S3 bucket for audit logs exists
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
    });
  });

  test('CloudTrail CloudWatch Log Group is created', () => {
    // Verify CloudWatch Log Group exists
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/cloudtrail/vaidyalink-test',
      RetentionInDays: 3653, // 10 years
    });
  });

  test('CloudTrail outputs are present', () => {
    template.hasOutput('CloudTrailArn', {});
    template.hasOutput('AuditLogsBucketName', {});
    template.hasOutput('CloudTrailLogGroupName', {});
  });
});
