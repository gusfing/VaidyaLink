import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as kms from 'aws-cdk-lib/aws-kms';
import { SecretsManagerConstruct } from '../lib/constructs/secrets-manager';

describe('SecretsManagerConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let encryptionKey: kms.Key;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-south-1' },
    });

    encryptionKey = new kms.Key(stack, 'TestKey', {
      enableKeyRotation: true,
    });
  });

  test('creates all required secrets', () => {
    new SecretsManagerConstruct(stack, 'SecretsManager', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify ABDM secret
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'vaidyalink/dev/abdm/api-credentials',
      Description: 'ABDM (Ayushman Bharat Digital Mission) API credentials',
    });

    // Verify Bhashini secret
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'vaidyalink/dev/bhashini/api-credentials',
      Description: 'Bhashini multilingual AI API credentials',
    });

    // Verify Bedrock secret
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'vaidyalink/dev/bedrock/config',
      Description: 'Amazon Bedrock model configuration and settings',
    });

    // Verify Database secret
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'vaidyalink/dev/database/credentials',
      Description: 'Database credentials for RDS instances',
    });

    // Verify JWT secret
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'vaidyalink/dev/jwt/signing-key',
      Description: 'JWT token signing secret for custom authentication',
    });
  });

  test('uses provided KMS key for encryption', () => {
    new SecretsManagerConstruct(stack, 'SecretsManager', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // All secrets should reference the KMS key
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      KmsKeyId: Match.objectLike({
        'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('TestKey.*')]),
      }),
    });
  });

  test('applies correct tags to all secrets', () => {
    new SecretsManagerConstruct(stack, 'SecretsManager', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Check tags on secrets
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Tags: Match.arrayWith([
        { Key: 'Service', Value: 'VaidyaLink' },
        { Key: 'Environment', Value: 'dev' },
        { Key: 'Compliance', Value: 'HIPAA' },
        { Key: 'ManagedBy', Value: 'CDK' },
      ]),
    });
  });

  test('creates CloudFormation outputs', () => {
    new SecretsManagerConstruct(stack, 'SecretsManager', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Verify outputs exist
    template.hasOutput('ABDMSecretArn', {
      Description: 'ABDM API Secret ARN',
      Export: { Name: 'dev-ABDMSecretArn' },
    });

    template.hasOutput('BhashiniSecretArn', {
      Description: 'Bhashini API Secret ARN',
      Export: { Name: 'dev-BhashiniSecretArn' },
    });

    template.hasOutput('BedrockConfigArn', {
      Description: 'Bedrock Config Secret ARN',
      Export: { Name: 'dev-BedrockConfigArn' },
    });

    template.hasOutput('DatabaseCredentialsArn', {
      Description: 'Database Credentials Secret ARN',
      Export: { Name: 'dev-DatabaseCredentialsArn' },
    });

    template.hasOutput('JWTSigningSecretArn', {
      Description: 'JWT Signing Secret ARN',
      Export: { Name: 'dev-JWTSigningSecretArn' },
    });
  });

  test('uses RETAIN removal policy for production', () => {
    new SecretsManagerConstruct(stack, 'SecretsManager', {
      environment: 'prod',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Production secrets should have RETAIN policy
    template.hasResource('AWS::SecretsManager::Secret', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
  });

  test('uses DESTROY removal policy for non-production', () => {
    new SecretsManagerConstruct(stack, 'SecretsManager', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Dev secrets should have DESTROY policy
    template.hasResource('AWS::SecretsManager::Secret', {
      DeletionPolicy: 'Delete',
      UpdateReplacePolicy: 'Delete',
    });
  });

  test('database secret has auto-generated password', () => {
    new SecretsManagerConstruct(stack, 'SecretsManager', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Database secret should have GenerateSecretString
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'vaidyalink/dev/database/credentials',
      GenerateSecretString: {
        SecretStringTemplate: Match.stringLikeRegexp('.*username.*vaidyalink_admin.*'),
        GenerateStringKey: 'password',
        ExcludePunctuation: true,
        PasswordLength: 32,
      },
    });
  });

  test('JWT secret has auto-generated value', () => {
    new SecretsManagerConstruct(stack, 'SecretsManager', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // JWT secret should have GenerateSecretString
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'vaidyalink/dev/jwt/signing-key',
      GenerateSecretString: {
        ExcludePunctuation: true,
        PasswordLength: 64,
      },
    });
  });

  test('ABDM secret has correct structure', () => {
    new SecretsManagerConstruct(stack, 'SecretsManager', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // ABDM secret should have placeholder values
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'vaidyalink/dev/abdm/api-credentials',
      SecretString: Match.serializedJson({
        clientId: 'PLACEHOLDER_CLIENT_ID',
        clientSecret: 'PLACEHOLDER_CLIENT_SECRET',
        apiBaseUrl: 'https://dev.abdm.gov.in',
        facilityId: 'PLACEHOLDER_FACILITY_ID',
      }),
    });
  });

  test('Bhashini secret has correct structure', () => {
    new SecretsManagerConstruct(stack, 'SecretsManager', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Bhashini secret should have placeholder values
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'vaidyalink/dev/bhashini/api-credentials',
      SecretString: Match.serializedJson({
        apiKey: 'PLACEHOLDER_API_KEY',
        apiBaseUrl: 'https://api.bhashini.gov.in',
        userId: 'PLACEHOLDER_USER_ID',
      }),
    });
  });

  test('Bedrock secret has correct structure', () => {
    new SecretsManagerConstruct(stack, 'SecretsManager', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Bedrock secret should have config values
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'vaidyalink/dev/bedrock/config',
      SecretString: Match.serializedJson({
        modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        region: 'ap-south-1',
        maxTokens: '4096',
        temperature: '0.7',
      }),
    });
  });

  test('creates exactly 5 secrets', () => {
    new SecretsManagerConstruct(stack, 'SecretsManager', {
      environment: 'dev',
      encryptionKey,
    });

    const template = Template.fromStack(stack);

    // Should have exactly 5 secrets (excluding the test key)
    const secrets = template.findResources('AWS::SecretsManager::Secret');
    expect(Object.keys(secrets).length).toBe(5);
  });
});
