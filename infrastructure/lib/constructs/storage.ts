import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface StorageConstructProps {
  environment: string;
  encryptionKey: kms.Key;
  s3EncryptionKey: kms.Key;
  enableIntelligentTiering?: boolean;
}

export class StorageConstruct extends Construct {
  public readonly scanJobsTable: dynamodb.Table;
  public readonly patientsTable: dynamodb.Table;
  public readonly voiceJobsTable: dynamodb.Table;
  public readonly migrationsTable: dynamodb.Table;
  public readonly documentsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageConstructProps) {
    super(scope, id);

    const { environment, encryptionKey, s3EncryptionKey, enableIntelligentTiering = true } = props;

    // ========================================
    // DynamoDB Tables
    // ========================================

    // ScanJobs Table - Tracks document processing jobs
    this.scanJobsTable = new dynamodb.Table(this, 'ScanJobsTable', {
      tableName: `vaidyalink-scanjobs-${environment}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: encryptionKey,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for querying by patient
    this.scanJobsTable.addGlobalSecondaryIndex({
      indexName: 'PatientIndex',
      partitionKey: { name: 'patientId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for querying by status
    this.scanJobsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Patients Table - Stores patient demographics
    this.patientsTable = new dynamodb.Table(this, 'PatientsTable', {
      tableName: `vaidyalink-patients-${environment}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: encryptionKey,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for ABHA ID lookup
    this.patientsTable.addGlobalSecondaryIndex({
      indexName: 'ABHAIndex',
      partitionKey: { name: 'abhaId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // VoiceJobs Table - Tracks voice transcription jobs
    this.voiceJobsTable = new dynamodb.Table(this, 'VoiceJobsTable', {
      tableName: `vaidyalink-voicejobs-${environment}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: encryptionKey,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for querying by patient
    this.voiceJobsTable.addGlobalSecondaryIndex({
      indexName: 'PatientIndex',
      partitionKey: { name: 'patientId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Migrations Table - Tracks migration history
    this.migrationsTable = new dynamodb.Table(this, 'MigrationsTable', {
      tableName: `vaidyalink-migrations-${environment}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: encryptionKey,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // S3 Buckets
    // ========================================

    // Documents Bucket - Stores medical documents and audio files
    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `vaidyalink-documents-${environment}-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: s3EncryptionKey,
      bucketKeyEnabled: true, // Use S3 Bucket Keys to reduce KMS costs
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: enableIntelligentTiering
        ? [
            {
              id: 'IntelligentTieringRule',
              enabled: true,
              transitions: [
                {
                  storageClass: s3.StorageClass.INTELLIGENT_TIERING,
                  transitionAfter: cdk.Duration.days(0), // Immediate transition
                },
              ],
            },
          ]
        : undefined,
    });

    // Add CORS configuration for direct uploads
    this.documentsBucket.addCorsRule({
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
      allowedOrigins: ['*'], // Should be restricted in production
      allowedHeaders: ['*'],
      maxAge: 3000,
    });

    // Enforce encryption at rest - deny unencrypted object uploads
    this.documentsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyUnencryptedObjectUploads',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:PutObject'],
        resources: [this.documentsBucket.arnForObjects('*')],
        conditions: {
          StringNotEquals: {
            's3:x-amz-server-side-encryption': 'aws:kms',
          },
        },
      })
    );

    // Enforce correct KMS key usage
    this.documentsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyIncorrectEncryptionKey',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:PutObject'],
        resources: [this.documentsBucket.arnForObjects('*')],
        conditions: {
          StringNotEqualsIfExists: {
            's3:x-amz-server-side-encryption-aws-kms-key-id': s3EncryptionKey.keyArn,
          },
        },
      })
    );

    // Deny unencrypted transport (enforce SSL/TLS)
    this.documentsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyInsecureTransport',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:*'],
        resources: [this.documentsBucket.bucketArn, this.documentsBucket.arnForObjects('*')],
        conditions: {
          Bool: {
            'aws:SecureTransport': 'false',
          },
        },
      })
    );

    // Tags for compliance and cost tracking
    cdk.Tags.of(this.scanJobsTable).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.scanJobsTable).add('Environment', environment);
    cdk.Tags.of(this.scanJobsTable).add('Compliance', 'HIPAA');

    cdk.Tags.of(this.patientsTable).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.patientsTable).add('Environment', environment);
    cdk.Tags.of(this.patientsTable).add('Compliance', 'HIPAA');

    cdk.Tags.of(this.voiceJobsTable).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.voiceJobsTable).add('Environment', environment);
    cdk.Tags.of(this.voiceJobsTable).add('Compliance', 'HIPAA');

    cdk.Tags.of(this.migrationsTable).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.migrationsTable).add('Environment', environment);
    cdk.Tags.of(this.migrationsTable).add('Purpose', 'Migration Tracking');

    cdk.Tags.of(this.documentsBucket).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.documentsBucket).add('Environment', environment);
    cdk.Tags.of(this.documentsBucket).add('Compliance', 'HIPAA');
  }
}
