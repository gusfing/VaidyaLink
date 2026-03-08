import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface DocumentScanDemoConstructProps {
  environment: string;
  encryptionKey: kms.Key;
  documentProcessorFunction?: lambda.IFunction;
  voiceProcessorFunction?: lambda.IFunction;
}

/**
 * Infrastructure construct for document-scan-demo AWS integration
 *
 * This construct creates:
 * - S3 buckets for documents and audio with encryption and lifecycle policies
 * - DynamoDB table for job tracking with TTL
 * - Secrets Manager secret for Sarvam API key
 * - S3 event notifications for Lambda triggers
 */
export class DocumentScanDemoConstruct extends Construct {
  public readonly documentsBucket: s3.Bucket;
  public readonly audioBucket: s3.Bucket;
  public readonly jobsTable: dynamodb.Table;
  public readonly sarvamApiKeySecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DocumentScanDemoConstructProps) {
    super(scope, id);

    const { environment, encryptionKey, documentProcessorFunction, voiceProcessorFunction } = props;

    // ========================================
    // S3 Bucket for Documents
    // ========================================
    // Requirements: 1.5, 12.1, 12.2
    this.documentsBucket = new s3.Bucket(this, 'DocumentScanDocumentsBucket', {
      bucketName: `document-scan-documents-${environment}-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: encryptionKey,
      bucketKeyEnabled: true, // Reduce KMS costs
      versioned: false, // Not needed for this use case
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,

      // Lifecycle policy: delete objects after 90 days (Requirement 12.1)
      lifecycleRules: [
        {
          id: 'DeleteAfter90Days',
          enabled: true,
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    // CORS configuration for presigned URL uploads (Requirement 1.5)
    this.documentsBucket.addCorsRule({
      allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
      allowedOrigins: ['*'], // Should be restricted to frontend domain in production
      allowedHeaders: ['*'],
      exposedHeaders: ['ETag'],
      maxAge: 3000,
    });

    // Enforce encryption at rest
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

    // ========================================
    // S3 Bucket for Audio
    // ========================================
    // Requirements: 1.5, 12.2
    this.audioBucket = new s3.Bucket(this, 'DocumentScanAudioBucket', {
      bucketName: `document-scan-audio-${environment}-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: encryptionKey,
      bucketKeyEnabled: true,
      versioned: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,

      // Lifecycle policy: delete objects after 90 days (Requirement 12.2)
      lifecycleRules: [
        {
          id: 'DeleteAfter90Days',
          enabled: true,
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    // CORS configuration for presigned URL uploads
    this.audioBucket.addCorsRule({
      allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
      allowedOrigins: ['*'], // Should be restricted to frontend domain in production
      allowedHeaders: ['*'],
      exposedHeaders: ['ETag'],
      maxAge: 3000,
    });

    // Enforce encryption at rest
    this.audioBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyUnencryptedObjectUploads',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:PutObject'],
        resources: [this.audioBucket.arnForObjects('*')],
        conditions: {
          StringNotEquals: {
            's3:x-amz-server-side-encryption': 'aws:kms',
          },
        },
      })
    );

    // Deny unencrypted transport
    this.audioBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyInsecureTransport',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:*'],
        resources: [this.audioBucket.bucketArn, this.audioBucket.arnForObjects('*')],
        conditions: {
          Bool: {
            'aws:SecureTransport': 'false',
          },
        },
      })
    );

    // ========================================
    // DynamoDB Table for Job Tracking
    // ========================================
    // Requirements: 2.9, 12.3
    this.jobsTable = new dynamodb.Table(this, 'DocumentScanJobsTable', {
      tableName: `document-scan-jobs-${environment}`,
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: encryptionKey,

      // Enable point-in-time recovery (Requirement 12.3)
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },

      // Enable TTL for automatic deletion after 90 days (Requirement 12.3)
      timeToLiveAttribute: 'ttl',

      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for querying user's jobs (Requirement 2.9)
    this.jobsTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================
    // Secrets Manager for Sarvam API Key
    // ========================================
    // Requirement: 10.6
    this.sarvamApiKeySecret = new secretsmanager.Secret(this, 'SarvamApiKeySecret', {
      secretName: `document-scan/sarvam-api-key-${environment}`,
      description: 'Sarvam API key for voice transcription in document-scan-demo',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ apiKey: '' }),
        generateStringKey: 'generatedKey',
      },
    });

    // ========================================
    // S3 Event Notifications
    // ========================================
    // Requirement: 1.4

    // Set up event notification for document uploads
    if (documentProcessorFunction) {
      this.documentsBucket.addEventNotification(
        s3.EventType.OBJECT_CREATED,
        new s3n.LambdaDestination(documentProcessorFunction),
        {
          prefix: 'uploads/', // Only trigger for uploads/ prefix
        }
      );
    }

    // Set up event notification for audio uploads
    if (voiceProcessorFunction) {
      this.audioBucket.addEventNotification(
        s3.EventType.OBJECT_CREATED,
        new s3n.LambdaDestination(voiceProcessorFunction),
        {
          prefix: 'uploads/', // Only trigger for uploads/ prefix
        }
      );
    }

    // ========================================
    // Tags for Resource Management
    // ========================================
    cdk.Tags.of(this.documentsBucket).add('Service', 'DocumentScanDemo');
    cdk.Tags.of(this.documentsBucket).add('Environment', environment);
    cdk.Tags.of(this.documentsBucket).add('Purpose', 'Document Storage');

    cdk.Tags.of(this.audioBucket).add('Service', 'DocumentScanDemo');
    cdk.Tags.of(this.audioBucket).add('Environment', environment);
    cdk.Tags.of(this.audioBucket).add('Purpose', 'Audio Storage');

    cdk.Tags.of(this.jobsTable).add('Service', 'DocumentScanDemo');
    cdk.Tags.of(this.jobsTable).add('Environment', environment);
    cdk.Tags.of(this.jobsTable).add('Purpose', 'Job Tracking');

    cdk.Tags.of(this.sarvamApiKeySecret).add('Service', 'DocumentScanDemo');
    cdk.Tags.of(this.sarvamApiKeySecret).add('Environment', environment);
    cdk.Tags.of(this.sarvamApiKeySecret).add('Purpose', 'API Key Storage');
  }
}
