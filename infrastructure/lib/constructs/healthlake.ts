import * as cdk from 'aws-cdk-lib';
import * as healthlake from 'aws-cdk-lib/aws-healthlake';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface HealthLakeConstructProps {
  environment: string;
  encryptionKey: kms.Key;
}

export class HealthLakeConstruct extends Construct {
  public readonly datastore: healthlake.CfnFHIRDatastore;
  public readonly datastoreId: string;
  public readonly datastoreArn: string;
  public readonly datastoreEndpoint: string;
  public readonly lambdaAccessRole: iam.Role;

  constructor(scope: Construct, id: string, props: HealthLakeConstructProps) {
    super(scope, id);

    const { environment, encryptionKey } = props;
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // ========================================
    // CloudWatch Log Group for HealthLake
    // ========================================

    const logGroup = new logs.LogGroup(this, 'HealthLakeLogGroup', {
      logGroupName: `/aws/healthlake/vaidyalink-${environment}`,
      retention: logs.RetentionDays.ONE_YEAR,
      encryptionKey: encryptionKey,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ========================================
    // HealthLake FHIR R4 Data Store
    // ========================================

    this.datastore = new healthlake.CfnFHIRDatastore(this, 'FHIRDatastore', {
      datastoreName: `vaidyalink-fhir-${environment}`,
      datastoreTypeVersion: 'R4',
      preloadDataConfig: {
        preloadDataType: 'SYNTHEA',
      },
      sseConfiguration: {
        kmsEncryptionConfig: {
          cmkType: 'CUSTOMER_MANAGED_KMS_KEY',
          kmsKeyId: encryptionKey.keyArn,
        },
      },
      tags: [
        { key: 'Service', value: 'VaidyaLink' },
        { key: 'Environment', value: environment },
        { key: 'Compliance', value: 'HIPAA' },
        { key: 'DataType', value: 'FHIR-R4' },
      ],
    });

    // Extract datastore properties
    this.datastoreId = this.datastore.attrDatastoreId;
    this.datastoreArn = this.datastore.attrDatastoreArn;
    this.datastoreEndpoint = this.datastore.attrDatastoreEndpoint;

    // ========================================
    // IAM Role for Lambda Access
    // ========================================

    this.lambdaAccessRole = new iam.Role(this, 'LambdaAccessRole', {
      roleName: `vaidyalink-healthlake-lambda-${environment}`,
      description: `Role for Lambda functions to access HealthLake FHIR datastore in ${environment}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant HealthLake permissions to Lambda role
    this.lambdaAccessRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'HealthLakeReadWrite',
        effect: iam.Effect.ALLOW,
        actions: [
          'healthlake:CreateResource',
          'healthlake:ReadResource',
          'healthlake:UpdateResource',
          'healthlake:DeleteResource',
          'healthlake:SearchWithGet',
          'healthlake:SearchWithPost',
          'healthlake:GetCapabilities',
          'healthlake:DescribeFHIRDatastore',
          'healthlake:DescribeFHIRImportJob',
          'healthlake:DescribeFHIRExportJob',
          'healthlake:ListFHIRDatastores',
        ],
        resources: [this.datastoreArn],
      })
    );

    // Grant KMS permissions for HealthLake encryption
    encryptionKey.grantEncryptDecrypt(this.lambdaAccessRole);

    // Grant CloudWatch Logs permissions
    this.lambdaAccessRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchLogsAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogStreams',
        ],
        resources: [logGroup.logGroupArn, `${logGroup.logGroupArn}:*`],
      })
    );

    // ========================================
    // Update KMS Key Policy for HealthLake
    // ========================================

    encryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowHealthLakeService',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('healthlake.amazonaws.com')],
        actions: [
          'kms:Decrypt',
          'kms:Encrypt',
          'kms:ReEncrypt*',
          'kms:GenerateDataKey*',
          'kms:CreateGrant',
          'kms:DescribeKey',
        ],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'kms:ViaService': `healthlake.${region}.amazonaws.com`,
          },
        },
      })
    );

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'DatastoreId', {
      value: this.datastoreId,
      description: 'HealthLake FHIR Datastore ID',
      exportName: `${environment}-HealthLakeDatastoreId`,
    });

    new cdk.CfnOutput(this, 'DatastoreArn', {
      value: this.datastoreArn,
      description: 'HealthLake FHIR Datastore ARN',
      exportName: `${environment}-HealthLakeDatastoreArn`,
    });

    new cdk.CfnOutput(this, 'DatastoreEndpoint', {
      value: this.datastoreEndpoint,
      description: 'HealthLake FHIR Datastore Endpoint',
      exportName: `${environment}-HealthLakeDatastoreEndpoint`,
    });

    new cdk.CfnOutput(this, 'LambdaAccessRoleArn', {
      value: this.lambdaAccessRole.roleArn,
      description: 'IAM Role ARN for Lambda functions to access HealthLake',
      exportName: `${environment}-HealthLakeLambdaRoleArn`,
    });
  }
}
