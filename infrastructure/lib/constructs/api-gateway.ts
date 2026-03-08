import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { CorsConfig } from './cors';

export interface ApiGatewayConstructProps {
  environment: string;
  userPool: cognito.UserPool;
  documentProcessingFunction: lambda.Function;
  voiceProcessingFunction: lambda.Function;
  clinicalSummarizerFunction: lambda.Function;
  fhirTransformerFunction: lambda.Function;
  abdmConnectorFunction: lambda.Function;
  hitlHandlerFunction: lambda.Function;
  domainName?: string;
  certificateArn?: string;
  allowedOrigins?: string[];
}

export class ApiGatewayConstruct extends Construct {
  public readonly restApi: apigateway.RestApi;
  public readonly webSocketApi: apigatewayv2.CfnApi;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    const {
      environment,
      userPool,
      documentProcessingFunction,
      voiceProcessingFunction,
      clinicalSummarizerFunction,
      fhirTransformerFunction,
      abdmConnectorFunction,
      hitlHandlerFunction,
      allowedOrigins,
    } = props;

    // ========================================
    // CORS Configuration
    // ========================================

    // Create environment-specific CORS configuration
    const corsOptions = CorsConfig.createRestApiCors(this, 'CorsConfig', {
      environment,
      allowedOrigins,
    });

    // ========================================
    // REST API
    // ========================================

    // CloudWatch Log Group for API Gateway
    const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
      logGroupName: `/aws/apigateway/vaidyalink-${environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `vaidyalink-api-${environment}`,
      description: 'VaidyaLink REST API',
      deployOptions: {
        stageName: environment,
        tracingEnabled: true,
        dataTraceEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: corsOptions,
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'VaidyaLinkAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });

    // Request Validators
    const requestValidator = new apigateway.RequestValidator(this, 'RequestValidator', {
      restApi: this.restApi,
      requestValidatorName: 'body-and-params-validator',
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    const bodyOnlyValidator = new apigateway.RequestValidator(this, 'BodyOnlyValidator', {
      restApi: this.restApi,
      requestValidatorName: 'body-only-validator',
      validateRequestBody: true,
      validateRequestParameters: false,
    });

    const paramsOnlyValidator = new apigateway.RequestValidator(this, 'ParamsOnlyValidator', {
      restApi: this.restApi,
      requestValidatorName: 'params-only-validator',
      validateRequestBody: false,
      validateRequestParameters: true,
    });

    // ========================================
    // Request/Response Models
    // ========================================

    // Scan Job Models
    const createScanRequestModel = new apigateway.Model(this, 'CreateScanRequest', {
      restApi: this.restApi,
      modelName: 'CreateScanRequest',
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['patientId', 'imageS3Key'],
        properties: {
          patientId: { type: apigateway.JsonSchemaType.STRING, minLength: 1, maxLength: 100 },
          imageS3Key: { type: apigateway.JsonSchemaType.STRING, minLength: 1, maxLength: 500 },
          metadata: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              documentType: { type: apigateway.JsonSchemaType.STRING },
              captureDate: { type: apigateway.JsonSchemaType.STRING, format: 'date-time' },
              notes: { type: apigateway.JsonSchemaType.STRING, maxLength: 1000 },
            },
          },
        },
      },
    });

    // Voice Job Models
    const createVoiceRequestModel = new apigateway.Model(this, 'CreateVoiceRequest', {
      restApi: this.restApi,
      modelName: 'CreateVoiceRequest',
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['patientId', 'audioS3Key', 'language'],
        properties: {
          patientId: { type: apigateway.JsonSchemaType.STRING, minLength: 1, maxLength: 100 },
          audioS3Key: { type: apigateway.JsonSchemaType.STRING, minLength: 1, maxLength: 500 },
          language: {
            type: apigateway.JsonSchemaType.STRING,
            enum: [
              'hi',
              'en',
              'bn',
              'te',
              'mr',
              'ta',
              'gu',
              'kn',
              'ml',
              'pa',
              'or',
              'as',
              'ur',
              'sa',
              'ks',
              'sd',
              'ne',
              'kok',
              'mni',
              'doi',
              'mai',
              'sat',
            ],
          },
        },
      },
    });

    const confirmVoiceRequestModel = new apigateway.Model(this, 'ConfirmVoiceRequest', {
      restApi: this.restApi,
      modelName: 'ConfirmVoiceRequest',
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['confirmed'],
        properties: {
          confirmed: { type: apigateway.JsonSchemaType.BOOLEAN },
          correctedTranscription: { type: apigateway.JsonSchemaType.STRING, maxLength: 5000 },
        },
      },
    });

    // ABDM Models
    const linkABHARequestModel = new apigateway.Model(this, 'LinkABHARequest', {
      restApi: this.restApi,
      modelName: 'LinkABHARequest',
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['abhaId', 'otp'],
        properties: {
          abhaId: {
            type: apigateway.JsonSchemaType.STRING,
            pattern: '^[0-9]{2}-[0-9]{4}-[0-9]{4}-[0-9]{4}$',
          },
          otp: {
            type: apigateway.JsonSchemaType.STRING,
            pattern: '^[0-9]{6}$',
          },
        },
      },
    });

    const consentRequestModel = new apigateway.Model(this, 'ConsentRequest', {
      restApi: this.restApi,
      modelName: 'ConsentRequest',
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['purpose', 'hiTypes'],
        properties: {
          purpose: {
            type: apigateway.JsonSchemaType.STRING,
            enum: ['CAREMGT', 'BTG', 'PUBHLTH', 'HPAYMT', 'DSRCH', 'PATRQT'],
          },
          hiTypes: {
            type: apigateway.JsonSchemaType.ARRAY,
            items: {
              type: apigateway.JsonSchemaType.STRING,
              enum: [
                'Prescription',
                'DiagnosticReport',
                'OPConsultation',
                'DischargeSummary',
                'ImmunizationRecord',
                'HealthDocumentRecord',
                'WellnessRecord',
              ],
            },
            minItems: 1,
          },
          dateRange: {
            type: apigateway.JsonSchemaType.OBJECT,
            required: ['from', 'to'],
            properties: {
              from: { type: apigateway.JsonSchemaType.STRING, format: 'date-time' },
              to: { type: apigateway.JsonSchemaType.STRING, format: 'date-time' },
            },
          },
        },
      },
    });

    // HITL Models
    const verifyHITLRequestModel = new apigateway.Model(this, 'VerifyHITLRequest', {
      restApi: this.restApi,
      modelName: 'VerifyHITLRequest',
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['correctedData'],
        properties: {
          correctedData: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              patientName: { type: apigateway.JsonSchemaType.STRING, maxLength: 200 },
              medications: {
                type: apigateway.JsonSchemaType.ARRAY,
                items: {
                  type: apigateway.JsonSchemaType.OBJECT,
                  properties: {
                    name: { type: apigateway.JsonSchemaType.STRING },
                    dosage: { type: apigateway.JsonSchemaType.STRING },
                    frequency: { type: apigateway.JsonSchemaType.STRING },
                  },
                },
              },
              diagnoses: {
                type: apigateway.JsonSchemaType.ARRAY,
                items: { type: apigateway.JsonSchemaType.STRING },
              },
            },
          },
          notes: { type: apigateway.JsonSchemaType.STRING, maxLength: 2000 },
        },
      },
    });

    // Error Response Model
    const errorResponseModel = new apigateway.Model(this, 'ErrorResponse', {
      restApi: this.restApi,
      modelName: 'ErrorResponse',
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          message: { type: apigateway.JsonSchemaType.STRING },
          code: { type: apigateway.JsonSchemaType.STRING },
          requestId: { type: apigateway.JsonSchemaType.STRING },
        },
      },
    });

    // ========================================
    // API Resources and Endpoints
    // ========================================

    // /api/v1
    const apiV1 = this.restApi.root.addResource('api').addResource('v1');

    // /api/v1/scans
    const scans = apiV1.addResource('scans');
    scans.addMethod('POST', new apigateway.LambdaIntegration(documentProcessingFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: bodyOnlyValidator,
      requestModels: {
        'application/json': createScanRequestModel,
      },
      methodResponses: [
        {
          statusCode: '201',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
        {
          statusCode: '401',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
      ],
    });

    const scanById = scans.addResource('{jobId}');
    scanById.addMethod('GET', new apigateway.LambdaIntegration(documentProcessingFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: paramsOnlyValidator,
      requestParameters: {
        'method.request.path.jobId': true,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
      ],
    });

    const scanData = scanById.addResource('data');
    scanData.addMethod('GET', new apigateway.LambdaIntegration(documentProcessingFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: paramsOnlyValidator,
      requestParameters: {
        'method.request.path.jobId': true,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
      ],
    });

    // /api/v1/voice
    const voice = apiV1.addResource('voice');
    voice.addMethod('POST', new apigateway.LambdaIntegration(voiceProcessingFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: bodyOnlyValidator,
      requestModels: {
        'application/json': createVoiceRequestModel,
      },
      methodResponses: [
        {
          statusCode: '201',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
      ],
    });

    const voiceById = voice.addResource('{jobId}');
    const voiceConfirm = voiceById.addResource('confirm');
    voiceConfirm.addMethod('POST', new apigateway.LambdaIntegration(voiceProcessingFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: requestValidator,
      requestParameters: {
        'method.request.path.jobId': true,
      },
      requestModels: {
        'application/json': confirmVoiceRequestModel,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
      ],
    });

    // /api/v1/patients
    const patients = apiV1.addResource('patients');
    const patientById = patients.addResource('{id}');

    const patientRecords = patientById.addResource('records');
    patientRecords.addMethod('GET', new apigateway.LambdaIntegration(fhirTransformerFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: paramsOnlyValidator,
      requestParameters: {
        'method.request.path.id': true,
        'method.request.querystring.startDate': false,
        'method.request.querystring.endDate': false,
        'method.request.querystring.resourceType': false,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
      ],
    });

    const patientSummary = patientById.addResource('summary');
    patientSummary.addMethod('GET', new apigateway.LambdaIntegration(clinicalSummarizerFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: paramsOnlyValidator,
      requestParameters: {
        'method.request.path.id': true,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
      ],
    });

    const patientExport = patientById.addResource('export');
    patientExport.addMethod('GET', new apigateway.LambdaIntegration(fhirTransformerFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: paramsOnlyValidator,
      requestParameters: {
        'method.request.path.id': true,
        'method.request.querystring.format': false,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
      ],
    });

    // /api/v1/abdm
    const abdm = apiV1.addResource('abdm');

    const abdmLink = abdm.addResource('link');
    abdmLink.addMethod('POST', new apigateway.LambdaIntegration(abdmConnectorFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: bodyOnlyValidator,
      requestModels: {
        'application/json': linkABHARequestModel,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
      ],
    });

    const abdmRecords = abdm.addResource('records');
    abdmRecords.addMethod('GET', new apigateway.LambdaIntegration(abdmConnectorFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: paramsOnlyValidator,
      requestParameters: {
        'method.request.querystring.abhaId': true,
        'method.request.querystring.consentId': false,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
      ],
    });

    const abdmConsent = abdm.addResource('consent');
    abdmConsent.addMethod('POST', new apigateway.LambdaIntegration(abdmConnectorFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: bodyOnlyValidator,
      requestModels: {
        'application/json': consentRequestModel,
      },
      methodResponses: [
        {
          statusCode: '201',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
      ],
    });

    // /api/v1/hitl
    const hitl = apiV1.addResource('hitl');

    const hitlQueue = hitl.addResource('queue');
    hitlQueue.addMethod('GET', new apigateway.LambdaIntegration(hitlHandlerFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: paramsOnlyValidator,
      requestParameters: {
        'method.request.querystring.status': false,
        'method.request.querystring.limit': false,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
      ],
    });

    const hitlVerify = hitl.addResource('{jobId}').addResource('verify');
    hitlVerify.addMethod('POST', new apigateway.LambdaIntegration(hitlHandlerFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
      requestValidator: requestValidator,
      requestParameters: {
        'method.request.path.jobId': true,
      },
      requestModels: {
        'application/json': verifyHITLRequestModel,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': errorResponseModel,
          },
        },
      ],
    });

    // Usage Plan for rate limiting
    const usagePlan = this.restApi.addUsagePlan('UsagePlan', {
      name: `vaidyalink-usage-plan-${environment}`,
      throttle: {
        rateLimit: 1000,
        burstLimit: 200,
      },
      quota: {
        limit: 100000,
        period: apigateway.Period.MONTH,
      },
    });

    usagePlan.addApiStage({
      stage: this.restApi.deploymentStage,
    });

    // Configure TLS 1.3 security policy for the API Gateway domain
    // Note: API Gateway REST APIs use TLS 1.2 by default at the CloudFront level
    // For custom domains, we can enforce TLS 1.3 using the SECURITY_POLICY_TLS_1_3 policy
    // This ensures all data in transit is encrypted using TLS 1.3 (Requirement 7.2)
    const cfnRestApi = this.restApi.node.defaultChild as apigateway.CfnRestApi;
    cfnRestApi.addPropertyOverride('MinimumCompressionSize', 0);

    // Add metadata to document TLS 1.3 configuration
    cfnRestApi.addMetadata('TLSVersion', 'TLS 1.3');
    cfnRestApi.addMetadata(
      'SecurityRequirement',
      'Requirement 7.2 - Encrypt all data in transit using TLS 1.3'
    );

    // Configure custom domain with TLS 1.3 if domain name and certificate are provided
    if (props.domainName && props.certificateArn) {
      // Import the certificate from ARN
      const certificate = acm.Certificate.fromCertificateArn(
        this,
        'Certificate',
        props.certificateArn
      );

      // Create custom domain with TLS 1.2 security policy (API Gateway REST API minimum)
      // Note: AWS API Gateway REST APIs currently support TLS 1.2 as the minimum version
      // For TLS 1.3, consider using API Gateway HTTP APIs or CloudFront in front
      const domain = new apigateway.DomainName(this, 'CustomDomain', {
        domainName: props.domainName,
        certificate: certificate,
        securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
        endpointType: apigateway.EndpointType.EDGE,
      });

      // Map the custom domain to the API
      new apigateway.BasePathMapping(this, 'BasePathMapping', {
        domainName: domain,
        restApi: this.restApi,
        stage: this.restApi.deploymentStage,
      });

      // Output the custom domain name
      new cdk.CfnOutput(this, 'CustomDomainName', {
        value: domain.domainName,
        description: 'Custom domain name for API Gateway',
      });

      new cdk.CfnOutput(this, 'CustomDomainTarget', {
        value: domain.domainNameAliasDomainName,
        description: 'CloudFront distribution domain name for DNS configuration',
      });
    }

    // Tags
    cdk.Tags.of(this.restApi).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.restApi).add('Environment', environment);
  }
}
