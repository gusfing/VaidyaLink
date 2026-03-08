import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as kms from 'aws-cdk-lib/aws-kms';
import { StorageConstruct } from '../lib/constructs/storage';

describe('StorageConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let template: Template;
  let encryptionKey: kms.Key;
  let s3EncryptionKey: kms.Key;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-south-1' },
    });

    // Create mock KMS keys
    encryptionKey = new kms.Key(stack, 'MockEncryptionKey', {
      description: 'Mock encryption key for testing',
      enableKeyRotation: true,
    });

    s3EncryptionKey = new kms.Key(stack, 'MockS3EncryptionKey', {
      description: 'Mock S3 encryption key for testing',
      enableKeyRotation: true,
    });
  });

  describe('S3 Bucket Encryption Configuration', () => {
    test('creates S3 bucket with KMS encryption', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'aws:kms',
                KMSMasterKeyID: Match.objectLike({
                  'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('MockS3EncryptionKey')]),
                }),
              },
              BucketKeyEnabled: true,
            },
          ],
        },
      });
    });

    test('enables S3 Bucket Keys to reduce KMS costs', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              BucketKeyEnabled: true,
            },
          ],
        },
      });
    });

    test('enables versioning for data protection', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    test('blocks all public access', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });
  });

  describe('S3 Bucket Encryption Enforcement Policies', () => {
    test('denies unencrypted object uploads', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::BucketPolicy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'DenyUnencryptedObjectUploads',
              Effect: 'Deny',
              Principal: { AWS: '*' },
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
    });

    test('denies uploads with incorrect KMS key', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::BucketPolicy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'DenyIncorrectEncryptionKey',
              Effect: 'Deny',
              Principal: { AWS: '*' },
              Action: 's3:PutObject',
              Condition: {
                StringNotEqualsIfExists: {
                  's3:x-amz-server-side-encryption-aws-kms-key-id': Match.objectLike({
                    'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('MockS3EncryptionKey')]),
                  }),
                },
              },
            }),
          ]),
        },
      });
    });

    test('denies insecure transport (enforces SSL/TLS)', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::BucketPolicy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Sid: 'DenyInsecureTransport',
              Effect: 'Deny',
              Principal: { AWS: '*' },
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

    test('bucket policy contains all three encryption enforcement rules', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      const bucketPolicies = template.findResources('AWS::S3::BucketPolicy');
      const policyStatements = Object.values(bucketPolicies)[0].Properties.PolicyDocument.Statement;

      // Verify we have at least 3 deny statements for encryption enforcement
      const denyStatements = policyStatements.filter((stmt: any) => stmt.Effect === 'Deny');
      expect(denyStatements.length).toBeGreaterThanOrEqual(3);

      // Verify specific SIDs exist
      const sids = policyStatements.map((stmt: any) => stmt.Sid);
      expect(sids).toContain('DenyUnencryptedObjectUploads');
      expect(sids).toContain('DenyIncorrectEncryptionKey');
      expect(sids).toContain('DenyInsecureTransport');
    });
  });

  describe('S3 Bucket Intelligent-Tiering Configuration', () => {
    test('applies Intelligent-Tiering lifecycle rule when enabled', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
        enableIntelligentTiering: true,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::Bucket', {
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              Id: 'IntelligentTieringRule',
              Status: 'Enabled',
              Transitions: Match.arrayWith([
                Match.objectLike({
                  StorageClass: 'INTELLIGENT_TIERING',
                  TransitionInDays: 0,
                }),
              ]),
            }),
          ]),
        },
      });
    });

    test('does not apply Intelligent-Tiering when disabled', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
        enableIntelligentTiering: false,
      });
      template = Template.fromStack(stack);

      const buckets = template.findResources('AWS::S3::Bucket');
      const bucket = Object.values(buckets)[0];
      expect(bucket.Properties.LifecycleConfiguration).toBeUndefined();
    });

    test('enables Intelligent-Tiering by default', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::Bucket', {
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              Id: 'IntelligentTieringRule',
              Status: 'Enabled',
              Transitions: Match.arrayWith([
                Match.objectLike({
                  StorageClass: 'INTELLIGENT_TIERING',
                }),
              ]),
            }),
          ]),
        },
      });
    });
  });

  describe('S3 Bucket CORS Configuration', () => {
    test('configures CORS for direct uploads', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::S3::Bucket', {
        CorsConfiguration: {
          CorsRules: [
            {
              AllowedMethods: ['GET', 'PUT', 'POST'],
              AllowedOrigins: ['*'],
              AllowedHeaders: ['*'],
              MaxAge: 3000,
            },
          ],
        },
      });
    });
  });

  describe('DynamoDB Tables Encryption', () => {
    test('creates ScanJobs table with customer-managed encryption', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'vaidyalink-scanjobs-test',
        SSESpecification: {
          SSEEnabled: true,
          SSEType: 'KMS',
          KMSMasterKeyId: Match.objectLike({
            'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('MockEncryptionKey')]),
          }),
        },
      });
    });

    test('creates Patients table with customer-managed encryption', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'vaidyalink-patients-test',
        SSESpecification: {
          SSEEnabled: true,
          SSEType: 'KMS',
        },
      });
    });

    test('creates VoiceJobs table with customer-managed encryption', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'vaidyalink-voicejobs-test',
        SSESpecification: {
          SSEEnabled: true,
          SSEType: 'KMS',
        },
      });
    });

    test('enables point-in-time recovery for all tables', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      const tables = template.findResources('AWS::DynamoDB::Table');
      Object.values(tables).forEach((table: any) => {
        expect(table.Properties.PointInTimeRecoverySpecification.PointInTimeRecoveryEnabled).toBe(
          true
        );
      });
    });
  });

  describe('Compliance and Tagging', () => {
    test('adds HIPAA compliance tags to S3 bucket', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      const buckets = template.findResources('AWS::S3::Bucket');
      const bucket = Object.values(buckets)[0];
      const tags = bucket.Properties.Tags;

      expect(tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ Key: 'Service', Value: 'VaidyaLink' }),
          expect.objectContaining({ Key: 'Environment', Value: 'test' }),
          expect.objectContaining({ Key: 'Compliance', Value: 'HIPAA' }),
        ])
      );
    });

    test('adds HIPAA compliance tags to all DynamoDB tables', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      const tables = template.findResources('AWS::DynamoDB::Table');
      Object.values(tables).forEach((table: any) => {
        const tags = table.Properties.Tags;
        expect(tags).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ Key: 'Service', Value: 'VaidyaLink' }),
            expect.objectContaining({ Key: 'Environment', Value: 'test' }),
            expect.objectContaining({ Key: 'Compliance', Value: 'HIPAA' }),
          ])
        );
      });
    });
  });

  describe('Resource Retention', () => {
    test('sets RETAIN removal policy for all resources', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      // Check S3 bucket
      const buckets = template.findResources('AWS::S3::Bucket');
      Object.values(buckets).forEach((bucket: any) => {
        expect(bucket.DeletionPolicy).toBe('Retain');
      });

      // Check DynamoDB tables
      const tables = template.findResources('AWS::DynamoDB::Table');
      Object.values(tables).forEach((table: any) => {
        expect(table.DeletionPolicy).toBe('Retain');
      });
    });
  });

  describe('Integration with Security Construct', () => {
    test('accepts separate encryption keys for S3 and DynamoDB', () => {
      const storage = new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });

      expect(storage.documentsBucket).toBeDefined();
      expect(storage.scanJobsTable).toBeDefined();
      expect(storage.patientsTable).toBeDefined();
      expect(storage.voiceJobsTable).toBeDefined();
    });

    test('exposes storage resources as public properties', () => {
      const storage = new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });

      expect(storage.documentsBucket.bucketName).toBeDefined();
      expect(storage.documentsBucket.bucketArn).toBeDefined();
      expect(storage.scanJobsTable.tableName).toBeDefined();
      expect(storage.patientsTable.tableName).toBeDefined();
      expect(storage.voiceJobsTable.tableName).toBeDefined();
    });
  });

  describe('Requirement 7 Validation - Security and Privacy', () => {
    test('validates all data at rest is encrypted using AWS KMS with customer-managed keys', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      // Verify S3 uses KMS encryption
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
      });

      // Verify all DynamoDB tables use KMS encryption
      const tables = template.findResources('AWS::DynamoDB::Table');
      Object.values(tables).forEach((table: any) => {
        expect(table.Properties.SSESpecification.SSEEnabled).toBe(true);
        expect(table.Properties.SSESpecification.SSEType).toBe('KMS');
      });
    });

    test('validates encryption is enforced (rejects unencrypted uploads)', () => {
      new StorageConstruct(stack, 'Storage', {
        environment: 'test',
        encryptionKey,
        s3EncryptionKey,
      });
      template = Template.fromStack(stack);

      // Verify bucket policy denies unencrypted uploads
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
    });
  });
});
