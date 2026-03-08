import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { SecurityConstruct } from '../lib/constructs/security';

describe('SecurityConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-south-1' },
    });
  });

  describe('KMS Customer-Managed Keys', () => {
    test('creates primary encryption key with correct configuration', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::KMS::Key', {
        Description: 'VaidyaLink test - Primary customer-managed encryption key',
        EnableKeyRotation: true,
        KeySpec: 'SYMMETRIC_DEFAULT',
        KeyUsage: 'ENCRYPT_DECRYPT',
        PendingWindowInDays: 30,
      });
    });

    test('creates S3-specific encryption key', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::KMS::Key', {
        Description: 'VaidyaLink test - S3 bucket encryption key for medical documents',
        EnableKeyRotation: true,
      });
    });

    test('creates DynamoDB-specific encryption key', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::KMS::Key', {
        Description: 'VaidyaLink test - DynamoDB table encryption key',
        EnableKeyRotation: true,
      });
    });

    test('creates Secrets Manager encryption key', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::KMS::Key', {
        Description: 'VaidyaLink test - Secrets Manager encryption key',
        EnableKeyRotation: true,
      });
    });

    test('creates exactly 4 KMS keys', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.resourceCountIs('AWS::KMS::Key', 4);
    });

    test('creates key aliases for all keys', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::KMS::Alias', {
        AliasName: 'alias/vaidyalink-test-primary',
      });

      template.hasResourceProperties('AWS::KMS::Alias', {
        AliasName: 'alias/vaidyalink-test-s3',
      });

      template.hasResourceProperties('AWS::KMS::Alias', {
        AliasName: 'alias/vaidyalink-test-dynamodb',
      });

      template.hasResourceProperties('AWS::KMS::Alias', {
        AliasName: 'alias/vaidyalink-test-secrets',
      });
    });

    test('sets RETAIN removal policy for production keys', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'prod' });
      template = Template.fromStack(stack);

      // All keys should have DeletionPolicy: Retain in production
      const keys = template.findResources('AWS::KMS::Key');
      Object.values(keys).forEach((key: any) => {
        expect(key.DeletionPolicy).toBe('Retain');
      });
    });

    test('sets DESTROY removal policy for non-production keys', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'dev' });
      template = Template.fromStack(stack);

      // All keys should have DeletionPolicy: Delete in dev
      const keys = template.findResources('AWS::KMS::Key');
      Object.values(keys).forEach((key: any) => {
        expect(key.DeletionPolicy).toBe('Delete');
      });
    });
  });

  describe('KMS Key Policies', () => {
    test('primary key allows root account full access', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::KMS::Key', {
        KeyPolicy: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'Enable IAM User Permissions',
              Effect: 'Allow',
              Principal: { AWS: Match.objectLike({ 'Fn::Join': Match.anyValue() }) },
              Action: 'kms:*',
              Resource: '*',
            }),
          ]),
        }),
      });
    });

    test('primary key allows CloudWatch Logs service', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::KMS::Key', {
        KeyPolicy: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'Allow CloudWatch Logs',
              Effect: 'Allow',
              Principal: { Service: Match.stringLikeRegexp('logs\\..*\\.amazonaws\\.com') },
              Action: Match.arrayWith(['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey*']),
            }),
          ]),
        }),
      });
    });

    test('S3 key allows S3 service', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::KMS::Key', {
        Description: Match.stringLikeRegexp('S3 bucket encryption'),
        KeyPolicy: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'Allow S3 Service',
              Effect: 'Allow',
              Principal: { Service: 's3.amazonaws.com' },
              Action: Match.arrayWith(['kms:Decrypt', 'kms:GenerateDataKey']),
            }),
          ]),
        }),
      });
    });

    test('DynamoDB key allows DynamoDB service with ViaService condition', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::KMS::Key', {
        Description: Match.stringLikeRegexp('DynamoDB table encryption'),
        KeyPolicy: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'Allow DynamoDB Service',
              Effect: 'Allow',
              Principal: { Service: 'dynamodb.amazonaws.com' },
              Action: Match.arrayWith(['kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey*']),
              Condition: {
                StringEquals: {
                  'kms:ViaService': Match.stringLikeRegexp('dynamodb\\..*\\.amazonaws\\.com'),
                },
              },
            }),
          ]),
        }),
      });
    });

    test('Secrets Manager key allows Secrets Manager service', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::KMS::Key', {
        Description: Match.stringLikeRegexp('Secrets Manager encryption'),
        KeyPolicy: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'Allow Secrets Manager',
              Effect: 'Allow',
              Principal: { Service: 'secretsmanager.amazonaws.com' },
              Action: Match.arrayWith(['kms:Decrypt', 'kms:GenerateDataKey']),
            }),
          ]),
        }),
      });
    });
  });

  describe('KMS Key Rotation', () => {
    test('enables automatic key rotation for all keys', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      const keys = template.findResources('AWS::KMS::Key');
      Object.values(keys).forEach((key: any) => {
        expect(key.Properties.EnableKeyRotation).toBe(true);
      });
    });
  });

  describe('KMS Key Tags', () => {
    test('adds compliance tags to all keys', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      // Check that keys have Service and Environment tags (order may vary)
      const keys = template.findResources('AWS::KMS::Key');
      Object.values(keys).forEach((key: any) => {
        const tags = key.Properties.Tags;
        expect(tags).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ Key: 'Service', Value: 'VaidyaLink' }),
            expect.objectContaining({ Key: 'Environment', Value: 'test' }),
          ])
        );
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    test('construct exposes key properties for stack outputs', () => {
      const security = new SecurityConstruct(stack, 'Security', { environment: 'test' });

      // Verify that the construct exposes key IDs and ARNs that can be used for outputs
      expect(security.encryptionKey.keyId).toBeDefined();
      expect(security.encryptionKey.keyArn).toBeDefined();
      expect(security.s3EncryptionKey.keyId).toBeDefined();
      expect(security.s3EncryptionKey.keyArn).toBeDefined();
      expect(security.dynamoDbEncryptionKey.keyId).toBeDefined();
      expect(security.dynamoDbEncryptionKey.keyArn).toBeDefined();
      expect(security.secretsEncryptionKey.keyId).toBeDefined();
      expect(security.secretsEncryptionKey.keyArn).toBeDefined();
    });
  });

  describe('Integration with other constructs', () => {
    test('exposes encryption keys as public properties', () => {
      const security = new SecurityConstruct(stack, 'Security', { environment: 'test' });

      expect(security.encryptionKey).toBeDefined();
      expect(security.s3EncryptionKey).toBeDefined();
      expect(security.dynamoDbEncryptionKey).toBeDefined();
      expect(security.secretsEncryptionKey).toBeDefined();
    });

    test('keys can be referenced by other constructs', () => {
      const security = new SecurityConstruct(stack, 'Security', { environment: 'test' });

      // Verify keys have the expected properties
      expect(security.encryptionKey.keyId).toBeDefined();
      expect(security.encryptionKey.keyArn).toBeDefined();
      expect(security.s3EncryptionKey.keyId).toBeDefined();
      expect(security.dynamoDbEncryptionKey.keyId).toBeDefined();
      expect(security.secretsEncryptionKey.keyId).toBeDefined();
    });
  });

  describe('Cognito Integration', () => {
    test('creates Cognito User Pool', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: 'vaidyalink-users-test',
        MfaConfiguration: 'OPTIONAL',
      });
    });

    test('creates Cognito Identity Pool', () => {
      new SecurityConstruct(stack, 'Security', { environment: 'test' });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Cognito::IdentityPool', {
        IdentityPoolName: 'vaidyalink_identity_test',
        AllowUnauthenticatedIdentities: false,
      });
    });
  });
});
