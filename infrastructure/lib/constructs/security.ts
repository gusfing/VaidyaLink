import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface SecurityConstructProps {
  environment: string;
}

export class SecurityConstruct extends Construct {
  public readonly encryptionKey: kms.Key;
  public readonly s3EncryptionKey: kms.Key;
  public readonly dynamoDbEncryptionKey: kms.Key;
  public readonly secretsEncryptionKey: kms.Key;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;

  constructor(scope: Construct, id: string, props: SecurityConstructProps) {
    super(scope, id);

    const { environment } = props;
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // ========================================
    // KMS Customer-Managed Keys
    // ========================================

    // Primary encryption key for general use
    this.encryptionKey = new kms.Key(this, 'EncryptionKey', {
      alias: `alias/vaidyalink-${environment}-primary`,
      description: `VaidyaLink ${environment} - Primary customer-managed encryption key`,
      enableKeyRotation: true,
      rotationPeriod: cdk.Duration.days(365),
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pendingWindow: cdk.Duration.days(30),
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
    });

    // Key policy for primary key
    this.encryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Enable IAM User Permissions',
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountRootPrincipal()],
        actions: ['kms:*'],
        resources: ['*'],
      })
    );

    this.encryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Allow CloudWatch Logs',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal(`logs.${region}.amazonaws.com`)],
        actions: [
          'kms:Encrypt',
          'kms:Decrypt',
          'kms:ReEncrypt*',
          'kms:GenerateDataKey*',
          'kms:CreateGrant',
          'kms:DescribeKey',
        ],
        resources: ['*'],
        conditions: {
          ArnLike: {
            'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/vaidyalink-${environment}-*`,
          },
        },
      })
    );

    // S3-specific encryption key
    this.s3EncryptionKey = new kms.Key(this, 'S3EncryptionKey', {
      alias: `alias/vaidyalink-${environment}-s3`,
      description: `VaidyaLink ${environment} - S3 bucket encryption key for medical documents`,
      enableKeyRotation: true,
      rotationPeriod: cdk.Duration.days(365),
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pendingWindow: cdk.Duration.days(30),
    });

    this.s3EncryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Enable IAM User Permissions',
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountRootPrincipal()],
        actions: ['kms:*'],
        resources: ['*'],
      })
    );

    this.s3EncryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Allow S3 Service',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('s3.amazonaws.com')],
        actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
        resources: ['*'],
      })
    );

    // DynamoDB-specific encryption key
    this.dynamoDbEncryptionKey = new kms.Key(this, 'DynamoDbEncryptionKey', {
      alias: `alias/vaidyalink-${environment}-dynamodb`,
      description: `VaidyaLink ${environment} - DynamoDB table encryption key`,
      enableKeyRotation: true,
      rotationPeriod: cdk.Duration.days(365),
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pendingWindow: cdk.Duration.days(30),
    });

    this.dynamoDbEncryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Enable IAM User Permissions',
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountRootPrincipal()],
        actions: ['kms:*'],
        resources: ['*'],
      })
    );

    this.dynamoDbEncryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Allow DynamoDB Service',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('dynamodb.amazonaws.com')],
        actions: [
          'kms:Decrypt',
          'kms:DescribeKey',
          'kms:Encrypt',
          'kms:ReEncrypt*',
          'kms:GenerateDataKey*',
          'kms:CreateGrant',
        ],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'kms:ViaService': `dynamodb.${region}.amazonaws.com`,
          },
        },
      })
    );

    // Secrets Manager encryption key
    this.secretsEncryptionKey = new kms.Key(this, 'SecretsEncryptionKey', {
      alias: `alias/vaidyalink-${environment}-secrets`,
      description: `VaidyaLink ${environment} - Secrets Manager encryption key`,
      enableKeyRotation: true,
      rotationPeriod: cdk.Duration.days(365),
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pendingWindow: cdk.Duration.days(30),
    });

    this.secretsEncryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Enable IAM User Permissions',
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountRootPrincipal()],
        actions: ['kms:*'],
        resources: ['*'],
      })
    );

    this.secretsEncryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Allow Secrets Manager',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('secretsmanager.amazonaws.com')],
        actions: ['kms:Decrypt', 'kms:GenerateDataKey', 'kms:CreateGrant'],
        resources: ['*'],
      })
    );

    // ========================================
    // Cognito User Pool
    // ========================================

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `vaidyalink-users-${environment}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        phone: true,
      },
      autoVerify: {
        email: true,
        phone: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        phoneNumber: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        abhaId: new cognito.StringAttribute({ mutable: true }),
        preferredLanguage: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // User Pool Client
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      userPoolClientName: `vaidyalink-client-${environment}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.PHONE,
        ],
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
    });

    // ========================================
    // Cognito Identity Pool
    // ========================================

    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `vaidyalink_identity_${environment}`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
      ],
    });

    // IAM roles for authenticated users
    const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // Attach identity pool roles
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

    // Tags
    cdk.Tags.of(this.encryptionKey).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.encryptionKey).add('Environment', environment);
    cdk.Tags.of(this.encryptionKey).add('Purpose', 'Primary Encryption');
    cdk.Tags.of(this.encryptionKey).add('Compliance', 'HIPAA');

    cdk.Tags.of(this.s3EncryptionKey).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.s3EncryptionKey).add('Environment', environment);
    cdk.Tags.of(this.s3EncryptionKey).add('Purpose', 'S3 Encryption');
    cdk.Tags.of(this.s3EncryptionKey).add('Compliance', 'HIPAA');

    cdk.Tags.of(this.dynamoDbEncryptionKey).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.dynamoDbEncryptionKey).add('Environment', environment);
    cdk.Tags.of(this.dynamoDbEncryptionKey).add('Purpose', 'DynamoDB Encryption');
    cdk.Tags.of(this.dynamoDbEncryptionKey).add('Compliance', 'HIPAA');

    cdk.Tags.of(this.secretsEncryptionKey).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.secretsEncryptionKey).add('Environment', environment);
    cdk.Tags.of(this.secretsEncryptionKey).add('Purpose', 'Secrets Encryption');
    cdk.Tags.of(this.secretsEncryptionKey).add('Compliance', 'HIPAA');

    cdk.Tags.of(this.userPool).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.userPool).add('Environment', environment);

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'PrimaryKeyId', {
      value: this.encryptionKey.keyId,
      description: 'Primary KMS Key ID',
      exportName: `${environment}-PrimaryKeyId`,
    });

    new cdk.CfnOutput(this, 'PrimaryKeyArn', {
      value: this.encryptionKey.keyArn,
      description: 'Primary KMS Key ARN',
      exportName: `${environment}-PrimaryKeyArn`,
    });

    new cdk.CfnOutput(this, 'S3KeyId', {
      value: this.s3EncryptionKey.keyId,
      description: 'S3 KMS Key ID',
      exportName: `${environment}-S3KeyId`,
    });

    new cdk.CfnOutput(this, 'S3KeyArn', {
      value: this.s3EncryptionKey.keyArn,
      description: 'S3 KMS Key ARN',
      exportName: `${environment}-S3KeyArn`,
    });

    new cdk.CfnOutput(this, 'DynamoDbKeyId', {
      value: this.dynamoDbEncryptionKey.keyId,
      description: 'DynamoDB KMS Key ID',
      exportName: `${environment}-DynamoDbKeyId`,
    });

    new cdk.CfnOutput(this, 'DynamoDbKeyArn', {
      value: this.dynamoDbEncryptionKey.keyArn,
      description: 'DynamoDB KMS Key ARN',
      exportName: `${environment}-DynamoDbKeyArn`,
    });

    new cdk.CfnOutput(this, 'SecretsKeyId', {
      value: this.secretsEncryptionKey.keyId,
      description: 'Secrets Manager KMS Key ID',
      exportName: `${environment}-SecretsKeyId`,
    });

    new cdk.CfnOutput(this, 'SecretsKeyArn', {
      value: this.secretsEncryptionKey.keyArn,
      description: 'Secrets Manager KMS Key ARN',
      exportName: `${environment}-SecretsKeyArn`,
    });
  }
}
