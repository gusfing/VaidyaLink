import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface AuthConstructProps {
  environment: string;
  domainPrefix: string;
}

export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly authenticatedRole: iam.Role;
  public readonly unauthenticatedRole: iam.Role;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    // Create User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `vaidyalink-${props.environment}-users`,
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
          required: false,
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
        abhaId: new cognito.StringAttribute({ minLen: 14, maxLen: 17, mutable: true }),
        patientId: new cognito.StringAttribute({ minLen: 1, maxLen: 50, mutable: false }),
        preferredLanguage: new cognito.StringAttribute({ minLen: 2, maxLen: 5, mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: true,
      },
      removalPolicy:
        props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add domain for hosted UI
    this.userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: props.domainPrefix,
      },
    });

    // Create User Pool Client
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      userPoolClientName: `vaidyalink-${props.environment}-client`,
      generateSecret: false,
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
        callbackUrls: [
          `https://${props.environment === 'prod' ? '' : `${props.environment}.`}vaidyalink.com/auth/callback`,
          'http://localhost:3000/auth/callback',
        ],
        logoutUrls: [
          `https://${props.environment === 'prod' ? '' : `${props.environment}.`}vaidyalink.com`,
          'http://localhost:3000',
        ],
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
    });

    // Create Identity Pool
    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `vaidyalink_${props.environment}_identity`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
          serverSideTokenCheck: true,
        },
      ],
      // Support for ABDM federated identity (future integration)
      supportedLoginProviders: {
        // Placeholder for ABDM OIDC provider
        // 'abdm.gov.in': 'ABDM_CLIENT_ID',
      },
    });

    // Create IAM role for authenticated users
    this.authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      roleName: `vaidyalink-${props.environment}-authenticated-role`,
      description: 'IAM role for authenticated Cognito users',
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

    // Add policies for authenticated users
    this.authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [
          `arn:aws:s3:::vaidyalink-${props.environment}-documents/raw/\${cognito-identity.amazonaws.com:sub}/*`,
          `arn:aws:s3:::vaidyalink-${props.environment}-documents/audio/\${cognito-identity.amazonaws.com:sub}/*`,
          `arn:aws:s3:::vaidyalink-${props.environment}-documents/exports/\${cognito-identity.amazonaws.com:sub}/*`,
        ],
      })
    );

    this.authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:ListBucket'],
        resources: [`arn:aws:s3:::vaidyalink-${props.environment}-documents`],
        conditions: {
          StringLike: {
            's3:prefix': [
              'raw/${cognito-identity.amazonaws.com:sub}/*',
              'audio/${cognito-identity.amazonaws.com:sub}/*',
              'exports/${cognito-identity.amazonaws.com:sub}/*',
            ],
          },
        },
      })
    );

    // Allow authenticated users to invoke API Gateway
    this.authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: [
          `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*/${props.environment}/*`,
        ],
      })
    );

    // Create IAM role for unauthenticated users (limited access)
    this.unauthenticatedRole = new iam.Role(this, 'UnauthenticatedRole', {
      roleName: `vaidyalink-${props.environment}-unauthenticated-role`,
      description: 'IAM role for unauthenticated Cognito users',
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // Minimal permissions for unauthenticated users (e.g., public health info)
    this.unauthenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: [
          `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*/*/GET/api/v1/public/*`,
        ],
      })
    );

    // Attach roles to Identity Pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: this.authenticatedRole.roleArn,
        unauthenticated: this.unauthenticatedRole.roleArn,
      },
      roleMappings: {
        cognitoProvider: {
          type: 'Token',
          ambiguousRoleResolution: 'AuthenticatedRole',
          identityProvider: `${this.userPool.userPoolProviderName}:${this.userPoolClient.userPoolClientId}`,
        },
      },
    });

    // Create groups
    new cognito.CfnUserPoolGroup(this, 'PatientsGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'patients',
      description: 'Regular patients',
      precedence: 10,
    });

    new cognito.CfnUserPoolGroup(this, 'ProvidersGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'providers',
      description: 'Healthcare providers',
      precedence: 5,
    });

    new cognito.CfnUserPoolGroup(this, 'AdminsGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'admins',
      description: 'System administrators',
      precedence: 1,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${props.environment}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${props.environment}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: `${props.environment}-IdentityPoolId`,
    });

    new cdk.CfnOutput(this, 'AuthenticatedRoleArn', {
      value: this.authenticatedRole.roleArn,
      description: 'IAM Role ARN for authenticated users',
      exportName: `${props.environment}-AuthenticatedRoleArn`,
    });

    new cdk.CfnOutput(this, 'UnauthenticatedRoleArn', {
      value: this.unauthenticatedRole.roleArn,
      description: 'IAM Role ARN for unauthenticated users',
      exportName: `${props.environment}-UnauthenticatedRoleArn`,
    });
  }
}
