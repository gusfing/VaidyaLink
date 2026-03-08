import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface LambdaFunctionsConstructProps {
  environment: string;
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  scanJobsTable: dynamodb.Table;
  patientsTable: dynamodb.Table;
  voiceJobsTable: dynamodb.Table;
  documentsBucket: s3.Bucket;
  bedrockModelId: string;
  confidenceThreshold: number;
  memoryConfig: {
    documentProcessing: number;
    voiceProcessing: number;
    clinicalSummarizer: number;
    fhirTransformer: number;
    abdmConnector: number;
    hitlHandler: number;
  };
  timeoutConfig: {
    documentProcessing: number;
    voiceProcessing: number;
    clinicalSummarizer: number;
    fhirTransformer: number;
    abdmConnector: number;
    hitlHandler: number;
  };
}

export class LambdaFunctionsConstruct extends Construct {
  public readonly documentProcessingFunction: lambda.Function;
  public readonly voiceProcessingFunction: lambda.Function;
  public readonly clinicalSummarizerFunction: lambda.Function;
  public readonly fhirTransformerFunction: lambda.Function;
  public readonly abdmConnectorFunction: lambda.Function;
  public readonly hitlHandlerFunction: lambda.Function;
  public readonly hitlQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: LambdaFunctionsConstructProps) {
    super(scope, id);

    const {
      environment,
      vpc,
      securityGroup,
      scanJobsTable,
      patientsTable,
      voiceJobsTable,
      documentsBucket,
      bedrockModelId,
      confidenceThreshold,
      memoryConfig,
      timeoutConfig,
    } = props;

    // ========================================
    // SQS Queue for HITL
    // ========================================

    const hitlDLQ = new sqs.Queue(this, 'HITLDeadLetterQueue', {
      queueName: `vaidyalink-hitl-dlq-${environment}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    this.hitlQueue = new sqs.Queue(this, 'HITLQueue', {
      queueName: `vaidyalink-hitl-${environment}`,
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: hitlDLQ,
        maxReceiveCount: 3,
      },
    });

    // ========================================
    // Common Lambda Configuration
    // ========================================

    const commonEnvironment = {
      ENVIRONMENT: environment,
      SCANJOBS_TABLE: scanJobsTable.tableName,
      PATIENTS_TABLE: patientsTable.tableName,
      VOICEJOBS_TABLE: voiceJobsTable.tableName,
      DOCUMENTS_BUCKET: documentsBucket.bucketName,
      BEDROCK_MODEL_ID: bedrockModelId,
      CONFIDENCE_THRESHOLD: confidenceThreshold.toString(),
      HITL_QUEUE_URL: this.hitlQueue.queueUrl,
    };

    // ========================================
    // Document Processing Lambda
    // ========================================

    this.documentProcessingFunction = new lambda.Function(this, 'DocumentProcessing', {
      functionName: `vaidyalink-document-processing-${environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../backend/document-processing/src'),
      memorySize: memoryConfig.documentProcessing,
      timeout: cdk.Duration.seconds(timeoutConfig.documentProcessing),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment: {
        ...commonEnvironment,
        FHIR_TRANSFORMER_LAMBDA_ARN: '', // Will be set after FHIR transformer is created
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant permissions
    scanJobsTable.grantReadWriteData(this.documentProcessingFunction);
    documentsBucket.grantReadWrite(this.documentProcessingFunction);
    this.hitlQueue.grantSendMessages(this.documentProcessingFunction);

    // Bedrock permissions
    this.documentProcessingFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:*::foundation-model/${bedrockModelId}`],
      })
    );

    // ========================================
    // Voice Processing Lambda
    // ========================================

    this.voiceProcessingFunction = new lambda.Function(this, 'VoiceProcessing', {
      functionName: `vaidyalink-voice-processing-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas/voice-processing'),
      memorySize: memoryConfig.voiceProcessing,
      timeout: cdk.Duration.seconds(timeoutConfig.voiceProcessing),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment: commonEnvironment,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    voiceJobsTable.grantReadWriteData(this.voiceProcessingFunction);
    documentsBucket.grantReadWrite(this.voiceProcessingFunction);

    this.voiceProcessingFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:*::foundation-model/${bedrockModelId}`],
      })
    );

    // ========================================
    // Clinical Summarizer Lambda
    // ========================================

    this.clinicalSummarizerFunction = new lambda.Function(this, 'ClinicalSummarizer', {
      functionName: `vaidyalink-clinical-summarizer-${environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas/clinical-summarizer'),
      memorySize: memoryConfig.clinicalSummarizer,
      timeout: cdk.Duration.seconds(timeoutConfig.clinicalSummarizer),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment: commonEnvironment,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    patientsTable.grantReadData(this.clinicalSummarizerFunction);

    this.clinicalSummarizerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:*::foundation-model/${bedrockModelId}`],
      })
    );

    // HealthLake permissions
    this.clinicalSummarizerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'healthlake:ReadResource',
          'healthlake:SearchWithGet',
          'healthlake:SearchWithPost',
        ],
        resources: ['*'],
      })
    );

    // ========================================
    // FHIR Transformer Lambda
    // ========================================

    this.fhirTransformerFunction = new lambda.Function(this, 'FHIRTransformer', {
      functionName: `vaidyalink-fhir-transformer-${environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas/fhir-transformer'),
      memorySize: memoryConfig.fhirTransformer,
      timeout: cdk.Duration.seconds(timeoutConfig.fhirTransformer),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment: commonEnvironment,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    scanJobsTable.grantReadWriteData(this.fhirTransformerFunction);
    patientsTable.grantReadData(this.fhirTransformerFunction);
    documentsBucket.grantRead(this.fhirTransformerFunction);

    // HealthLake permissions
    this.fhirTransformerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'healthlake:CreateResource',
          'healthlake:UpdateResource',
          'healthlake:ReadResource',
        ],
        resources: ['*'],
      })
    );

    // ========================================
    // ABDM Connector Lambda
    // ========================================

    this.abdmConnectorFunction = new lambda.Function(this, 'ABDMConnector', {
      functionName: `vaidyalink-abdm-connector-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas/abdm-connector'),
      memorySize: memoryConfig.abdmConnector,
      timeout: cdk.Duration.seconds(timeoutConfig.abdmConnector),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment: commonEnvironment,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    patientsTable.grantReadWriteData(this.abdmConnectorFunction);

    // HealthLake permissions for ABDM data exchange
    this.abdmConnectorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'healthlake:CreateResource',
          'healthlake:ReadResource',
          'healthlake:SearchWithGet',
          'healthlake:SearchWithPost',
        ],
        resources: ['*'],
      })
    );

    // ========================================
    // HITL Handler Lambda
    // ========================================

    this.hitlHandlerFunction = new lambda.Function(this, 'HITLHandler', {
      functionName: `vaidyalink-hitl-handler-${environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas/hitl-handler'),
      memorySize: memoryConfig.hitlHandler,
      timeout: cdk.Duration.seconds(timeoutConfig.hitlHandler),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      environment: commonEnvironment,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    scanJobsTable.grantReadWriteData(this.hitlHandlerFunction);
    documentsBucket.grantRead(this.hitlHandlerFunction);
    this.hitlQueue.grantConsumeMessages(this.hitlHandlerFunction);

    // ========================================
    // Cross-Lambda Permissions
    // ========================================

    // Update Document Processing Lambda with FHIR Transformer ARN
    this.documentProcessingFunction.addEnvironment(
      'FHIR_TRANSFORMER_LAMBDA_ARN',
      this.fhirTransformerFunction.functionArn
    );

    // Grant Document Processing Lambda permission to invoke FHIR Transformer
    this.fhirTransformerFunction.grantInvoke(this.documentProcessingFunction);

    // Tags
    const lambdaFunctions = [
      this.documentProcessingFunction,
      this.voiceProcessingFunction,
      this.clinicalSummarizerFunction,
      this.fhirTransformerFunction,
      this.abdmConnectorFunction,
      this.hitlHandlerFunction,
    ];

    lambdaFunctions.forEach((fn) => {
      cdk.Tags.of(fn).add('Service', 'VaidyaLink');
      cdk.Tags.of(fn).add('Environment', environment);
      cdk.Tags.of(fn).add('Compliance', 'HIPAA');
    });
  }
}
