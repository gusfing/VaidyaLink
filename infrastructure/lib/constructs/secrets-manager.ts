import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface SecretsManagerConstructProps {
  environment: string;
  encryptionKey: kms.IKey;
}

export interface SecretConfig {
  name: string;
  description: string;
  generateSecret?: boolean;
  rotationEnabled?: boolean;
  rotationDays?: number;
}

export class SecretsManagerConstruct extends Construct {
  public readonly abdmApiSecret: secretsmanager.Secret;
  public readonly bhashiniApiSecret: secretsmanager.Secret;
  public readonly bedrockConfigSecret: secretsmanager.Secret;
  public readonly databaseCredentials: secretsmanager.Secret;
  public readonly jwtSigningSecret: secretsmanager.Secret;
  public readonly secrets: Map<string, secretsmanager.Secret>;

  constructor(scope: Construct, id: string, props: SecretsManagerConstructProps) {
    super(scope, id);

    const { environment, encryptionKey } = props;
    this.secrets = new Map();

    // ========================================
    // ABDM API Credentials
    // ========================================

    this.abdmApiSecret = new secretsmanager.Secret(this, 'ABDMApiSecret', {
      secretName: `vaidyalink/${environment}/abdm/api-credentials`,
      description: 'ABDM (Ayushman Bharat Digital Mission) API credentials',
      encryptionKey,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      secretObjectValue: {
        clientId: cdk.SecretValue.unsafePlainText('PLACEHOLDER_CLIENT_ID'),
        clientSecret: cdk.SecretValue.unsafePlainText('PLACEHOLDER_CLIENT_SECRET'),
        apiBaseUrl: cdk.SecretValue.unsafePlainText('https://dev.abdm.gov.in'),
        facilityId: cdk.SecretValue.unsafePlainText('PLACEHOLDER_FACILITY_ID'),
      },
    });

    this.secrets.set('abdm', this.abdmApiSecret);

    // ========================================
    // Bhashini API Credentials
    // ========================================

    this.bhashiniApiSecret = new secretsmanager.Secret(this, 'BhashiniApiSecret', {
      secretName: `vaidyalink/${environment}/bhashini/api-credentials`,
      description: 'Bhashini multilingual AI API credentials',
      encryptionKey,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      secretObjectValue: {
        apiKey: cdk.SecretValue.unsafePlainText('PLACEHOLDER_API_KEY'),
        apiBaseUrl: cdk.SecretValue.unsafePlainText('https://api.bhashini.gov.in'),
        userId: cdk.SecretValue.unsafePlainText('PLACEHOLDER_USER_ID'),
      },
    });

    this.secrets.set('bhashini', this.bhashiniApiSecret);

    // ========================================
    // Amazon Bedrock Configuration
    // ========================================

    this.bedrockConfigSecret = new secretsmanager.Secret(this, 'BedrockConfigSecret', {
      secretName: `vaidyalink/${environment}/bedrock/config`,
      description: 'Amazon Bedrock model configuration and settings',
      encryptionKey,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      secretObjectValue: {
        modelId: cdk.SecretValue.unsafePlainText('anthropic.claude-3-5-sonnet-20240620-v1:0'),
        region: cdk.SecretValue.unsafePlainText(cdk.Stack.of(this).region),
        maxTokens: cdk.SecretValue.unsafePlainText('4096'),
        temperature: cdk.SecretValue.unsafePlainText('0.7'),
      },
    });

    this.secrets.set('bedrock', this.bedrockConfigSecret);

    // ========================================
    // Database Credentials (for future RDS if needed)
    // ========================================

    this.databaseCredentials = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      secretName: `vaidyalink/${environment}/database/credentials`,
      description: 'Database credentials for RDS instances',
      encryptionKey,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'vaidyalink_admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    this.secrets.set('database', this.databaseCredentials);

    // ========================================
    // JWT Signing Secret
    // ========================================

    this.jwtSigningSecret = new secretsmanager.Secret(this, 'JWTSigningSecret', {
      secretName: `vaidyalink/${environment}/jwt/signing-key`,
      description: 'JWT token signing secret for custom authentication',
      encryptionKey,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 64,
      },
    });

    this.secrets.set('jwt', this.jwtSigningSecret);

    // ========================================
    // Tags
    // ========================================

    const allSecrets = [
      this.abdmApiSecret,
      this.bhashiniApiSecret,
      this.bedrockConfigSecret,
      this.databaseCredentials,
      this.jwtSigningSecret,
    ];

    allSecrets.forEach((secret) => {
      cdk.Tags.of(secret).add('Service', 'VaidyaLink');
      cdk.Tags.of(secret).add('Environment', environment);
      cdk.Tags.of(secret).add('Compliance', 'HIPAA');
      cdk.Tags.of(secret).add('ManagedBy', 'CDK');
    });

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'ABDMSecretArn', {
      value: this.abdmApiSecret.secretArn,
      description: 'ABDM API Secret ARN',
      exportName: `${environment}-ABDMSecretArn`,
    });

    new cdk.CfnOutput(this, 'BhashiniSecretArn', {
      value: this.bhashiniApiSecret.secretArn,
      description: 'Bhashini API Secret ARN',
      exportName: `${environment}-BhashiniSecretArn`,
    });

    new cdk.CfnOutput(this, 'BedrockConfigArn', {
      value: this.bedrockConfigSecret.secretArn,
      description: 'Bedrock Config Secret ARN',
      exportName: `${environment}-BedrockConfigArn`,
    });

    new cdk.CfnOutput(this, 'DatabaseCredentialsArn', {
      value: this.databaseCredentials.secretArn,
      description: 'Database Credentials Secret ARN',
      exportName: `${environment}-DatabaseCredentialsArn`,
    });

    new cdk.CfnOutput(this, 'JWTSigningSecretArn', {
      value: this.jwtSigningSecret.secretArn,
      description: 'JWT Signing Secret ARN',
      exportName: `${environment}-JWTSigningSecretArn`,
    });
  }

  /**
   * Grant read access to a secret for a specific IAM principal
   */
  public grantRead(secretName: string, grantee: iam.IGrantable): void {
    const secret = this.secrets.get(secretName);
    if (!secret) {
      throw new Error(`Secret ${secretName} not found`);
    }
    secret.grantRead(grantee);
  }

  /**
   * Grant read access to multiple secrets for a specific IAM principal
   */
  public grantReadMultiple(secretNames: string[], grantee: iam.IGrantable): void {
    secretNames.forEach((name) => this.grantRead(name, grantee));
  }

  /**
   * Create a custom secret with specified configuration
   */
  public createCustomSecret(config: SecretConfig): secretsmanager.Secret {
    const { environment } = this.node.scope as any;
    const encryptionKey = (this.node.scope as any).encryptionKey;

    const secret = new secretsmanager.Secret(this, `CustomSecret-${config.name}`, {
      secretName: `vaidyalink/${environment}/custom/${config.name}`,
      description: config.description,
      encryptionKey,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      ...(config.generateSecret && {
        generateSecretString: {
          excludePunctuation: true,
          passwordLength: 32,
        },
      }),
    });

    this.secrets.set(config.name, secret);

    cdk.Tags.of(secret).add('Service', 'VaidyaLink');
    cdk.Tags.of(secret).add('Environment', environment);
    cdk.Tags.of(secret).add('Custom', 'true');

    return secret;
  }
}
