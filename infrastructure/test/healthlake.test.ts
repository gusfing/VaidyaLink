import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as kms from 'aws-cdk-lib/aws-kms';
import { HealthLakeConstruct } from '../lib/constructs/healthlake';

describe('HealthLakeConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let template: Template;
  let encryptionKey: kms.Key;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-south-1' },
    });

    // Create mock KMS key
    encryptionKey = new kms.Key(stack, 'MockEncryptionKey', {
      description: 'Mock encryption key for testing',
      enableKeyRotation: true,
    });
  });

  describe('FHIR Datastore Configuration', () => {
    test('creates HealthLake FHIR R4 datastore', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::HealthLake::FHIRDatastore', {
        DatastoreName: 'vaidyalink-fhir-test',
        DatastoreTypeVersion: 'R4',
      });
    });

    test('configures customer-managed KMS encryption', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::HealthLake::FHIRDatastore', {
        SseConfiguration: {
          KmsEncryptionConfig: {
            CmkType: 'CUSTOMER_MANAGED_KMS_KEY',
            KmsKeyId: Match.objectLike({
              'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('MockEncryptionKey')]),
            }),
          },
        },
      });
    });

    test('includes SYNTHEA preload data configuration', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::HealthLake::FHIRDatastore', {
        PreloadDataConfig: {
          PreloadDataType: 'SYNTHEA',
        },
      });
    });

    test('adds compliance and service tags', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      const datastores = template.findResources('AWS::HealthLake::FHIRDatastore');
      const datastore = Object.values(datastores)[0];
      const tags = datastore.Properties.Tags;

      expect(tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ Key: 'Service', Value: 'VaidyaLink' }),
          expect.objectContaining({ Key: 'Environment', Value: 'test' }),
          expect.objectContaining({ Key: 'Compliance', Value: 'HIPAA' }),
          expect.objectContaining({ Key: 'DataType', Value: 'FHIR-R4' }),
        ])
      );
    });
  });

  describe('CloudWatch Logging Configuration', () => {
    test('creates CloudWatch log group for HealthLake', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/healthlake/vaidyalink-test',
        RetentionInDays: 365,
      });
    });

    test('encrypts log group with KMS', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        KmsKeyId: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('MockEncryptionKey')]),
        }),
      });
    });

    test('sets appropriate retention policy for production', () => {
      const prodStack = new cdk.Stack(app, 'ProdStack', {
        env: { account: '123456789012', region: 'ap-south-1' },
      });
      const prodKey = new kms.Key(prodStack, 'ProdKey');

      new HealthLakeConstruct(prodStack, 'HealthLake', {
        environment: 'prod',
        encryptionKey: prodKey,
      });
      const prodTemplate = Template.fromStack(prodStack);

      const logGroups = prodTemplate.findResources('AWS::Logs::LogGroup');
      const logGroup = Object.values(logGroups)[0];
      expect(logGroup.DeletionPolicy).toBe('Retain');
    });
  });

  describe('IAM Role for Lambda Access', () => {
    test('creates IAM role for Lambda functions', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'vaidyalink-healthlake-lambda-test',
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
              Action: 'sts:AssumeRole',
            },
          ],
        },
      });
    });

    test('grants HealthLake read/write permissions', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'HealthLakeReadWrite',
              Effect: 'Allow',
              Action: Match.arrayWith([
                'healthlake:CreateResource',
                'healthlake:ReadResource',
                'healthlake:UpdateResource',
                'healthlake:DeleteResource',
                'healthlake:SearchWithGet',
                'healthlake:SearchWithPost',
                'healthlake:GetCapabilities',
              ]),
            }),
          ]),
        },
      });
    });

    test('grants KMS encryption/decryption permissions', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
              Action: Match.arrayWith(['kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey*']),
            }),
          ]),
        },
      });
    });

    test('grants CloudWatch Logs permissions', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'CloudWatchLogsAccess',
              Effect: 'Allow',
              Action: Match.arrayWith([
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ]),
            }),
          ]),
        },
      });
    });

    test('attaches AWS Lambda basic execution role', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::IAM::Role', {
        ManagedPolicyArns: Match.arrayWith([
          {
            'Fn::Join': [
              '',
              [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
              ],
            ],
          },
        ]),
      });
    });
  });

  describe('KMS Key Policy Updates', () => {
    test('adds HealthLake service principal to KMS key policy', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::KMS::Key', {
        KeyPolicy: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'AllowHealthLakeService',
              Effect: 'Allow',
              Principal: {
                Service: 'healthlake.amazonaws.com',
              },
              Action: Match.arrayWith([
                'kms:Decrypt',
                'kms:Encrypt',
                'kms:GenerateDataKey*',
                'kms:CreateGrant',
              ]),
            }),
          ]),
        },
      });
    });

    test('restricts HealthLake KMS access via service', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::KMS::Key', {
        KeyPolicy: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'AllowHealthLakeService',
              Condition: {
                StringEquals: {
                  'kms:ViaService': 'healthlake.ap-south-1.amazonaws.com',
                },
              },
            }),
          ]),
        },
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    test('exports datastore ID', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasOutput('*', {
        Export: {
          Name: 'test-HealthLakeDatastoreId',
        },
      });
    });

    test('exports datastore ARN', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasOutput('*', {
        Export: {
          Name: 'test-HealthLakeDatastoreArn',
        },
      });
    });

    test('exports datastore endpoint', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasOutput('*', {
        Export: {
          Name: 'test-HealthLakeDatastoreEndpoint',
        },
      });
    });

    test('exports Lambda access role ARN', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasOutput('*', {
        Export: {
          Name: 'test-HealthLakeLambdaRoleArn',
        },
      });
    });
  });

  describe('Integration with Security Construct', () => {
    test('accepts encryption key from security construct', () => {
      const healthlake = new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });

      expect(healthlake.datastore).toBeDefined();
      expect(healthlake.datastoreId).toBeDefined();
      expect(healthlake.datastoreArn).toBeDefined();
      expect(healthlake.datastoreEndpoint).toBeDefined();
      expect(healthlake.lambdaAccessRole).toBeDefined();
    });

    test('exposes datastore properties as public attributes', () => {
      const healthlake = new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });

      expect(typeof healthlake.datastoreId).toBe('string');
      expect(typeof healthlake.datastoreArn).toBe('string');
      expect(typeof healthlake.datastoreEndpoint).toBe('string');
      expect(healthlake.lambdaAccessRole.roleArn).toBeDefined();
    });
  });

  describe('Requirement 4 Validation - HL7 FHIR Export', () => {
    test('validates FHIR R4 standard compliance', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::HealthLake::FHIRDatastore', {
        DatastoreTypeVersion: 'R4',
      });
    });

    test('validates datastore is configured for queryable access', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      // Verify Lambda role has search permissions
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['healthlake:SearchWithGet', 'healthlake:SearchWithPost']),
            }),
          ]),
        },
      });
    });
  });

  describe('Requirement 7 Validation - Security and Privacy', () => {
    test('validates encryption at rest using customer-managed KMS keys', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::HealthLake::FHIRDatastore', {
        SseConfiguration: {
          KmsEncryptionConfig: {
            CmkType: 'CUSTOMER_MANAGED_KMS_KEY',
          },
        },
      });
    });

    test('validates CloudWatch audit logging is enabled', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      // Verify log group exists
      template.resourceCountIs('AWS::Logs::LogGroup', 1);

      // Verify log group has appropriate retention
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 365,
      });
    });

    test('validates role-based access control with minimum privilege', () => {
      new HealthLakeConstruct(stack, 'HealthLake', {
        environment: 'test',
        encryptionKey,
      });
      template = Template.fromStack(stack);

      // Verify Lambda role only has necessary HealthLake permissions
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'HealthLakeReadWrite',
              Effect: 'Allow',
              // Should not have wildcard actions
              Action: Match.not(Match.arrayWith(['healthlake:*'])),
            }),
          ]),
        },
      });
    });
  });
});
