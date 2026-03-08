import {
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,
} from '@aws-sdk/client-cognito-identity';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';

interface CognitoConfig {
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
}

interface IdentityCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration?: Date;
}

/**
 * Cognito Identity Pool integration for federated access
 * Provides AWS credentials for authenticated users to access AWS services directly
 */
export class CognitoIdentityService {
  private client: CognitoIdentityClient;
  private config: CognitoConfig;

  constructor(config: CognitoConfig) {
    this.config = config;
    this.client = new CognitoIdentityClient({ region: config.region });
  }

  /**
   * Get AWS credentials for authenticated Cognito user
   * @param idToken - JWT ID token from Cognito User Pool
   * @returns AWS credentials for temporary access
   */
  async getCredentialsForUser(idToken: string): Promise<IdentityCredentials> {
    const providerName = `cognito-idp.${this.config.region}.amazonaws.com/${this.config.userPoolId}`;

    // Get Identity ID
    const getIdCommand = new GetIdCommand({
      IdentityPoolId: this.config.identityPoolId,
      Logins: {
        [providerName]: idToken,
      },
    });

    const identityResponse = await this.client.send(getIdCommand);

    if (!identityResponse.IdentityId) {
      throw new Error('Failed to get Identity ID from Cognito Identity Pool');
    }

    // Get credentials for the identity
    const getCredentialsCommand = new GetCredentialsForIdentityCommand({
      IdentityId: identityResponse.IdentityId,
      Logins: {
        [providerName]: idToken,
      },
    });

    const credentialsResponse = await this.client.send(getCredentialsCommand);

    if (!credentialsResponse.Credentials) {
      throw new Error('Failed to get credentials from Cognito Identity Pool');
    }

    return {
      accessKeyId: credentialsResponse.Credentials.AccessKeyId!,
      secretAccessKey: credentialsResponse.Credentials.SecretKey!,
      sessionToken: credentialsResponse.Credentials.SessionToken!,
      expiration: credentialsResponse.Credentials.Expiration,
    };
  }

  /**
   * Create AWS SDK credential provider for use with AWS services
   * @param idToken - JWT ID token from Cognito User Pool
   * @returns Credential provider for AWS SDK v3
   */
  createCredentialProvider(idToken: string) {
    const providerName = `cognito-idp.${this.config.region}.amazonaws.com/${this.config.userPoolId}`;

    return fromCognitoIdentityPool({
      clientConfig: { region: this.config.region },
      identityPoolId: this.config.identityPoolId,
      logins: {
        [providerName]: idToken,
      },
    });
  }

  /**
   * Get Identity ID for the current user
   * Useful for constructing S3 paths with user-specific prefixes
   * @param idToken - JWT ID token from Cognito User Pool
   * @returns Cognito Identity ID
   */
  async getIdentityId(idToken: string): Promise<string> {
    const providerName = `cognito-idp.${this.config.region}.amazonaws.com/${this.config.userPoolId}`;

    const getIdCommand = new GetIdCommand({
      IdentityPoolId: this.config.identityPoolId,
      Logins: {
        [providerName]: idToken,
      },
    });

    const response = await this.client.send(getIdCommand);

    if (!response.IdentityId) {
      throw new Error('Failed to get Identity ID');
    }

    return response.IdentityId;
  }
}

/**
 * Initialize Cognito Identity Service from environment variables
 */
export function createCognitoIdentityService(): CognitoIdentityService {
  const config: CognitoConfig = {
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-south-1',
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
    userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
    identityPoolId: process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID!,
  };

  if (!config.userPoolId || !config.userPoolClientId || !config.identityPoolId) {
    throw new Error('Missing required Cognito configuration in environment variables');
  }

  return new CognitoIdentityService(config);
}
