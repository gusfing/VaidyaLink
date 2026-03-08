import {
  CognitoIdentityProviderClient,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  SetUserMFAPreferenceCommand,
  GetUserCommand,
  RespondToAuthChallengeCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

interface MFAConfig {
  region: string;
  userPoolId: string;
  clientId: string;
}

export type MFAMethod = 'SMS' | 'TOTP' | 'NONE';

export interface MFAStatus {
  smsEnabled: boolean;
  totpEnabled: boolean;
  preferredMethod: MFAMethod;
}

export interface TOTPSetupResponse {
  secretCode: string;
  qrCodeUrl: string;
  session?: string;
}

/**
 * MFA Service for managing multi-factor authentication
 * Supports both SMS and TOTP (Time-based One-Time Password) methods
 */
export class MFAService {
  private client: CognitoIdentityProviderClient;
  private config: MFAConfig;

  constructor(config: MFAConfig) {
    this.config = config;
    this.client = new CognitoIdentityProviderClient({ region: config.region });
  }

  /**
   * Get current MFA status for user
   * @param accessToken - User's access token
   */
  async getMFAStatus(accessToken: string): Promise<MFAStatus> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.client.send(command);

      const smsEnabled = response.UserMFASettingList?.includes('SMS_MFA') || false;
      const totpEnabled = response.UserMFASettingList?.includes('SOFTWARE_TOKEN_MFA') || false;

      let preferredMethod: MFAMethod = 'NONE';
      if (response.PreferredMfaSetting === 'SMS_MFA') {
        preferredMethod = 'SMS';
      } else if (response.PreferredMfaSetting === 'SOFTWARE_TOKEN_MFA') {
        preferredMethod = 'TOTP';
      }

      return {
        smsEnabled,
        totpEnabled,
        preferredMethod,
      };
    } catch (error) {
      console.error('Failed to get MFA status:', error);
      throw new Error('Failed to retrieve MFA status');
    }
  }

  /**
   * Setup TOTP (Authenticator App) MFA
   * @param accessToken - User's access token
   * @returns Secret code and QR code URL for authenticator app
   */
  async setupTOTP(accessToken: string): Promise<TOTPSetupResponse> {
    try {
      const command = new AssociateSoftwareTokenCommand({
        AccessToken: accessToken,
      });

      const response = await this.client.send(command);

      if (!response.SecretCode) {
        throw new Error('Failed to generate TOTP secret');
      }

      // Generate QR code URL for authenticator apps
      const username = await this.getUsernameFromToken(accessToken);
      const issuer = 'VaidyaLink';
      const qrCodeUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${response.SecretCode}&issuer=${encodeURIComponent(issuer)}`;

      return {
        secretCode: response.SecretCode,
        qrCodeUrl,
        session: response.Session,
      };
    } catch (error) {
      console.error('Failed to setup TOTP:', error);
      throw new Error('Failed to setup authenticator app');
    }
  }

  /**
   * Verify TOTP code and enable TOTP MFA
   * @param accessToken - User's access token
   * @param totpCode - 6-digit code from authenticator app
   * @param session - Optional session from setupTOTP
   */
  async verifyTOTP(accessToken: string, totpCode: string, session?: string): Promise<void> {
    try {
      const command = new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: totpCode,
        Session: session,
        FriendlyDeviceName: 'Authenticator App',
      });

      const response = await this.client.send(command);

      if (response.Status !== 'SUCCESS') {
        throw new Error('Invalid verification code');
      }
    } catch (error) {
      console.error('Failed to verify TOTP:', error);
      throw new Error('Invalid verification code. Please try again.');
    }
  }

  /**
   * Set user's MFA preference
   * @param accessToken - User's access token
   * @param method - Preferred MFA method
   */
  async setMFAPreference(accessToken: string, method: MFAMethod): Promise<void> {
    try {
      const command = new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SMSMfaSettings:
          method === 'SMS'
            ? {
                Enabled: true,
                PreferredMfa: true,
              }
            : undefined,
        SoftwareTokenMfaSettings:
          method === 'TOTP'
            ? {
                Enabled: true,
                PreferredMfa: true,
              }
            : method === 'NONE'
              ? {
                  Enabled: false,
                  PreferredMfa: false,
                }
              : undefined,
      });

      await this.client.send(command);
    } catch (error) {
      console.error('Failed to set MFA preference:', error);
      throw new Error('Failed to update MFA preference');
    }
  }

  /**
   * Respond to MFA challenge during authentication
   * @param challengeName - Type of MFA challenge (SMS_MFA or SOFTWARE_TOKEN_MFA)
   * @param session - Session from authentication challenge
   * @param mfaCode - MFA code from user
   * @param username - Username
   */
  async respondToMFAChallenge(
    challengeName: 'SMS_MFA' | 'SOFTWARE_TOKEN_MFA',
    session: string,
    mfaCode: string,
    username: string
  ): Promise<any> {
    try {
      const command = new RespondToAuthChallengeCommand({
        ClientId: this.config.clientId,
        ChallengeName: challengeName,
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          [challengeName === 'SMS_MFA' ? 'SMS_MFA_CODE' : 'SOFTWARE_TOKEN_MFA_CODE']: mfaCode,
        },
      });

      const response = await this.client.send(command);
      return response;
    } catch (error) {
      console.error('Failed to respond to MFA challenge:', error);
      throw new Error('Invalid MFA code. Please try again.');
    }
  }

  /**
   * Disable MFA for user
   * @param accessToken - User's access token
   */
  async disableMFA(accessToken: string): Promise<void> {
    try {
      const command = new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SMSMfaSettings: {
          Enabled: false,
          PreferredMfa: false,
        },
        SoftwareTokenMfaSettings: {
          Enabled: false,
          PreferredMfa: false,
        },
      });

      await this.client.send(command);
    } catch (error) {
      console.error('Failed to disable MFA:', error);
      throw new Error('Failed to disable MFA');
    }
  }

  /**
   * Extract username from access token
   * @param accessToken - User's access token
   */
  private async getUsernameFromToken(accessToken: string): Promise<string> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.client.send(command);
      return response.Username || 'user';
    } catch (error) {
      console.error('Failed to get username:', error);
      return 'user';
    }
  }

  /**
   * Enable SMS MFA for user
   * Requires phone number to be verified in Cognito
   * @param accessToken - User's access token
   */
  async enableSMSMFA(accessToken: string): Promise<void> {
    try {
      const command = new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SMSMfaSettings: {
          Enabled: true,
          PreferredMfa: true,
        },
      });

      await this.client.send(command);
    } catch (error) {
      console.error('Failed to enable SMS MFA:', error);
      throw new Error('Failed to enable SMS MFA. Ensure phone number is verified.');
    }
  }
}

/**
 * Initialize MFA Service from environment variables
 */
export function createMFAService(): MFAService {
  const config: MFAConfig = {
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-south-1',
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
  };

  if (!config.userPoolId || !config.clientId) {
    throw new Error('Missing required Cognito configuration in environment variables');
  }

  return new MFAService(config);
}
