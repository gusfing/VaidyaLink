import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface MinimalDocumentScanStackProps extends cdk.StackProps {
  config: {
    environment: string;
    region: string;
    account: string;
  };
}

export class MinimalDocumentScanStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MinimalDocumentScanStackProps) {
    super(scope, id, props);

    const { environment, account } = props.config;

    // ========================================
    // S3 Bucket for Documents
    // ========================================
    const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `document-scan-docs-${environment}-${account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(90),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ========================================
    // DynamoDB Table for Jobs
    // ========================================
    const jobsTable = new dynamodb.Table(this, 'JobsTable', {
      tableName: `document-scan-jobs-${environment}`,
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for user queries
    jobsTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // ========================================
    // Document Processor Lambda
    // ========================================
    const documentProcessor = new lambda.Function(this, 'DocumentProcessor', {
      functionName: `document-scan-processor-${environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../backend/document-processor/src'),
      timeout: cdk.Duration.seconds(300),
      memorySize: 3008,
      environment: {
        JOBS_TABLE: jobsTable.tableName,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      },
    });

    // Grant permissions
    documentsBucket.grantRead(documentProcessor);
    jobsTable.grantReadWriteData(documentProcessor);

    // Grant Bedrock permissions
    documentProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: ['*'],
      })
    );

    // S3 trigger
    documentsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(documentProcessor),
      { prefix: 'uploads/' }
    );

    // ========================================
    // API Lambda
    // ========================================
    const apiLambda = new lambda.Function(this, 'ApiLambda', {
      functionName: `document-scan-api-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'src/index.handler',
      code: lambda.Code.fromAsset('../backend/api-handler'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        JOBS_TABLE: jobsTable.tableName,
        S3_DOCUMENTS_BUCKET: documentsBucket.bucketName,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        NODE_ENV: environment,
        COGNITO_USER_POOL_ID: 'us-east-1_iBVHMFnpa',
        COGNITO_REGION: 'us-east-1',
      },
    });

    // Grant permissions
    documentsBucket.grantReadWrite(apiLambda);
    jobsTable.grantReadWriteData(apiLambda);

    // ========================================
    // API Gateway
    // ========================================
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: `document-scan-api-${environment}`,
      description: 'Document Scan API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['*'],
      },
    });

    const integration = new apigateway.LambdaIntegration(apiLambda);
    api.root.addProxy({
      defaultIntegration: integration,
      anyMethod: true,
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: `DocumentScan-${environment}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: documentsBucket.bucketName,
      description: 'Documents S3 Bucket',
      exportName: `DocumentScan-${environment}-DocumentsBucket`,
    });

    new cdk.CfnOutput(this, 'JobsTableName', {
      value: jobsTable.tableName,
      description: 'Jobs DynamoDB Table',
      exportName: `DocumentScan-${environment}-JobsTable`,
    });
  }
}
