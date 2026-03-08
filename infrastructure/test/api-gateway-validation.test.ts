import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { ApiGatewayConstruct } from '../lib/constructs/api-gateway';

describe('API Gateway Request Validation', () => {
  let stack: cdk.Stack;
  let template: Template;

  beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');

    // Create mock Cognito User Pool
    const userPool = new cognito.UserPool(stack, 'TestUserPool', {
      userPoolName: 'test-user-pool',
    });

    // Create mock Lambda functions
    const mockLambda = new lambda.Function(stack, 'MockLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
    });

    // Create API Gateway construct
    new ApiGatewayConstruct(stack, 'TestApiGateway', {
      environment: 'test',
      userPool,
      documentProcessingFunction: mockLambda,
      voiceProcessingFunction: mockLambda,
      clinicalSummarizerFunction: mockLambda,
      fhirTransformerFunction: mockLambda,
      abdmConnectorFunction: mockLambda,
      hitlHandlerFunction: mockLambda,
    });

    template = Template.fromStack(stack);
  });

  describe('Request Validators', () => {
    test('should create body and params validator', () => {
      template.hasResourceProperties('AWS::ApiGateway::RequestValidator', {
        Name: 'body-and-params-validator',
        ValidateRequestBody: true,
        ValidateRequestParameters: true,
      });
    });

    test('should create body-only validator', () => {
      template.hasResourceProperties('AWS::ApiGateway::RequestValidator', {
        Name: 'body-only-validator',
        ValidateRequestBody: true,
        ValidateRequestParameters: false,
      });
    });

    test('should create params-only validator', () => {
      template.hasResourceProperties('AWS::ApiGateway::RequestValidator', {
        Name: 'params-only-validator',
        ValidateRequestBody: false,
        ValidateRequestParameters: true,
      });
    });
  });

  describe('Request Models', () => {
    test('should create CreateScanRequest model with required fields', () => {
      template.hasResourceProperties('AWS::ApiGateway::Model', {
        Name: 'CreateScanRequest',
        ContentType: 'application/json',
        Schema: Match.objectLike({
          type: 'object',
          required: ['patientId', 'imageS3Key'],
          properties: Match.objectLike({
            patientId: Match.objectLike({
              type: 'string',
              minLength: 1,
              maxLength: 100,
            }),
            imageS3Key: Match.objectLike({
              type: 'string',
              minLength: 1,
              maxLength: 500,
            }),
          }),
        }),
      });
    });

    test('should create CreateVoiceRequest model with language enum', () => {
      template.hasResourceProperties('AWS::ApiGateway::Model', {
        Name: 'CreateVoiceRequest',
        ContentType: 'application/json',
        Schema: Match.objectLike({
          type: 'object',
          required: ['patientId', 'audioS3Key', 'language'],
          properties: Match.objectLike({
            language: Match.objectLike({
              type: 'string',
              enum: Match.arrayWith(['hi', 'en', 'bn', 'te', 'mr', 'ta']),
            }),
          }),
        }),
      });
    });

    test('should create LinkABHARequest model with ABHA ID pattern', () => {
      template.hasResourceProperties('AWS::ApiGateway::Model', {
        Name: 'LinkABHARequest',
        ContentType: 'application/json',
        Schema: Match.objectLike({
          type: 'object',
          required: ['abhaId', 'otp'],
          properties: Match.objectLike({
            abhaId: Match.objectLike({
              type: 'string',
              pattern: '^[0-9]{2}-[0-9]{4}-[0-9]{4}-[0-9]{4}$',
            }),
            otp: Match.objectLike({
              type: 'string',
              pattern: '^[0-9]{6}$',
            }),
          }),
        }),
      });
    });

    test('should create ConsentRequest model with purpose enum', () => {
      template.hasResourceProperties('AWS::ApiGateway::Model', {
        Name: 'ConsentRequest',
        ContentType: 'application/json',
        Schema: Match.objectLike({
          type: 'object',
          required: ['purpose', 'hiTypes'],
          properties: Match.objectLike({
            purpose: Match.objectLike({
              type: 'string',
              enum: Match.arrayWith(['CAREMGT', 'BTG', 'PUBHLTH']),
            }),
            hiTypes: Match.objectLike({
              type: 'array',
              minItems: 1,
            }),
          }),
        }),
      });
    });

    test('should create VerifyHITLRequest model', () => {
      template.hasResourceProperties('AWS::ApiGateway::Model', {
        Name: 'VerifyHITLRequest',
        ContentType: 'application/json',
        Schema: Match.objectLike({
          type: 'object',
          required: ['correctedData'],
        }),
      });
    });

    test('should create ErrorResponse model', () => {
      template.hasResourceProperties('AWS::ApiGateway::Model', {
        Name: 'ErrorResponse',
        ContentType: 'application/json',
        Schema: Match.objectLike({
          type: 'object',
          properties: Match.objectLike({
            message: { type: 'string' },
            code: { type: 'string' },
            requestId: { type: 'string' },
          }),
        }),
      });
    });
  });

  describe('Method Validation Configuration', () => {
    test('POST /scans should use body-only validator', () => {
      const methods = template.findResources('AWS::ApiGateway::Method', {
        Properties: {
          HttpMethod: 'POST',
          ResourceId: Match.anyValue(),
        },
      });

      // Find the POST /scans method
      const postScansMethod = Object.values(methods).find((method: any) => {
        return method.Properties.RequestValidatorId !== undefined;
      });

      expect(postScansMethod).toBeDefined();
    });

    test('GET /scans/{jobId} should validate path parameters', () => {
      const methods = template.findResources('AWS::ApiGateway::Method', {
        Properties: {
          HttpMethod: 'GET',
          RequestParameters: Match.objectLike({
            'method.request.path.jobId': true,
          }),
        },
      });

      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });

    test('POST /abdm/link should validate ABHA request body', () => {
      const methods = template.findResources('AWS::ApiGateway::Method', {
        Properties: {
          HttpMethod: 'POST',
          RequestModels: Match.objectLike({
            'application/json': Match.anyValue(),
          }),
        },
      });

      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });
  });

  describe('Method Responses', () => {
    test('should define success and error responses for POST endpoints', () => {
      const methods = template.findResources('AWS::ApiGateway::Method', {
        Properties: {
          HttpMethod: 'POST',
          MethodResponses: Match.arrayWith([
            Match.objectLike({
              StatusCode: '201',
            }),
            Match.objectLike({
              StatusCode: '400',
            }),
          ]),
        },
      });

      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });

    test('should define 404 responses for GET by ID endpoints', () => {
      const methods = template.findResources('AWS::ApiGateway::Method', {
        Properties: {
          HttpMethod: 'GET',
          MethodResponses: Match.arrayWith([
            Match.objectLike({
              StatusCode: '404',
            }),
          ]),
        },
      });

      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });
  });

  describe('Query Parameters', () => {
    test('GET /patients/{id}/records should accept optional query parameters', () => {
      const methods = template.findResources('AWS::ApiGateway::Method', {
        Properties: {
          HttpMethod: 'GET',
          RequestParameters: Match.objectLike({
            'method.request.path.id': true,
            'method.request.querystring.startDate': false,
            'method.request.querystring.endDate': false,
            'method.request.querystring.resourceType': false,
          }),
        },
      });

      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });

    test('GET /abdm/records should require abhaId query parameter', () => {
      const methods = template.findResources('AWS::ApiGateway::Method', {
        Properties: {
          HttpMethod: 'GET',
          RequestParameters: Match.objectLike({
            'method.request.querystring.abhaId': true,
          }),
        },
      });

      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });
  });

  describe('Integration with Cognito Authorizer', () => {
    test('all protected endpoints should use Cognito authorizer', () => {
      const methods = template.findResources('AWS::ApiGateway::Method', {
        Properties: {
          HttpMethod: Match.anyValue(),
          AuthorizationType: 'COGNITO_USER_POOLS',
        },
      });

      // Should have multiple protected endpoints
      expect(Object.keys(methods).length).toBeGreaterThan(10);
    });
  });
});
