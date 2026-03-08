import * as cdk from 'aws-cdk-lib';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface CloudTrailConstructProps {
  environment: string;
  encryptionKey: kms.Key;
}

export class CloudTrailConstruct extends Construct {
  public readonly trail: cloudtrail.Trail;
  public readonly auditLogsBucket: s3.Bucket;
  public readonly cloudWatchLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: CloudTrailConstructProps) {
    super(scope, id);

    const { environment, encryptionKey } = props;
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // ========================================
    // S3 Bucket for CloudTrail Logs
    // ========================================

    this.auditLogsBucket = new s3.Bucket(this, 'AuditLogsBucket', {
      bucketName: `vaidyalink-audit-logs-${environment}-${accountId}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'TransitionToIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
        {
          id: 'RetentionPolicy',
          enabled: true,
          expiration: cdk.Duration.days(2555), // 7 years retention for HIPAA compliance
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    // Bucket policy for CloudTrail
    this.auditLogsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AWSCloudTrailAclCheck',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        actions: ['s3:GetBucketAcl'],
        resources: [this.auditLogsBucket.bucketArn],
      })
    );

    this.auditLogsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AWSCloudTrailWrite',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources: [`${this.auditLogsBucket.bucketArn}/AWSLogs/${accountId}/*`],
        conditions: {
          StringEquals: {
            's3:x-amz-acl': 'bucket-owner-full-control',
          },
        },
      })
    );

    // ========================================
    // CloudWatch Log Group for CloudTrail
    // ========================================

    this.cloudWatchLogGroup = new logs.LogGroup(this, 'CloudTrailLogGroup', {
      logGroupName: `/aws/cloudtrail/vaidyalink-${environment}`,
      retention: logs.RetentionDays.TEN_YEARS, // 10 years retention for audit logs
      // Note: Encryption key removed to avoid circular dependency during initial deployment
      // encryptionKey: encryptionKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // IAM role for CloudTrail to write to CloudWatch Logs
    const cloudTrailRole = new iam.Role(this, 'CloudTrailRole', {
      assumedBy: new iam.ServicePrincipal('cloudtrail.amazonaws.com'),
      description: 'Role for CloudTrail to write logs to CloudWatch',
    });

    this.cloudWatchLogGroup.grantWrite(cloudTrailRole);

    // ========================================
    // CloudTrail Configuration
    // ========================================

    this.trail = new cloudtrail.Trail(this, 'Trail', {
      trailName: `vaidyalink-${environment}-trail`,
      bucket: this.auditLogsBucket,
      encryptionKey: encryptionKey,
      cloudWatchLogGroup: this.cloudWatchLogGroup,
      cloudWatchLogsRetention: logs.RetentionDays.TEN_YEARS,
      sendToCloudWatchLogs: true,

      // Enable management events
      managementEvents: cloudtrail.ReadWriteType.ALL,

      // Enable data events for S3 and Lambda
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      isOrganizationTrail: false,

      // Enable log file validation for integrity
      enableFileValidation: true,

      // SNS notification (optional, can be added later)
      // snsTopic: notificationTopic,
    });

    // ========================================
    // Data Events Configuration
    // ========================================

    // Log all S3 data events for PHI access tracking
    this.trail.addEventSelector(cloudtrail.DataResourceType.S3_OBJECT, [
      `arn:aws:s3:::vaidyalink-documents-${environment}-${accountId}/*`,
    ]);

    // Log all Lambda invocations for audit trail
    this.trail.addEventSelector(cloudtrail.DataResourceType.LAMBDA_FUNCTION, [
      `arn:aws:lambda:${region}:${accountId}:function:vaidyalink-${environment}-*`,
    ]);

    // ========================================
    // Event Selectors for Specific Services
    // ========================================

    // Add insight selectors for anomaly detection
    this.trail.logAllS3DataEvents();
    this.trail.logAllLambdaDataEvents();

    // ========================================
    // Tags
    // ========================================

    cdk.Tags.of(this.auditLogsBucket).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.auditLogsBucket).add('Environment', environment);
    cdk.Tags.of(this.auditLogsBucket).add('Purpose', 'Audit Logs');
    cdk.Tags.of(this.auditLogsBucket).add('Compliance', 'HIPAA');
    cdk.Tags.of(this.auditLogsBucket).add('Retention', '7-years');

    cdk.Tags.of(this.cloudWatchLogGroup).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.cloudWatchLogGroup).add('Environment', environment);
    cdk.Tags.of(this.cloudWatchLogGroup).add('Purpose', 'CloudTrail Logs');
    cdk.Tags.of(this.cloudWatchLogGroup).add('Compliance', 'HIPAA');

    cdk.Tags.of(this.trail).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.trail).add('Environment', environment);
    cdk.Tags.of(this.trail).add('Compliance', 'HIPAA');

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'TrailArn', {
      value: this.trail.trailArn,
      description: 'CloudTrail Trail ARN',
      exportName: `${environment}-CloudTrailArn`,
    });

    new cdk.CfnOutput(this, 'AuditLogsBucketName', {
      value: this.auditLogsBucket.bucketName,
      description: 'S3 Bucket for CloudTrail Audit Logs',
      exportName: `${environment}-AuditLogsBucketName`,
    });

    new cdk.CfnOutput(this, 'CloudTrailLogGroupName', {
      value: this.cloudWatchLogGroup.logGroupName,
      description: 'CloudWatch Log Group for CloudTrail',
      exportName: `${environment}-CloudTrailLogGroupName`,
    });
  }
}
