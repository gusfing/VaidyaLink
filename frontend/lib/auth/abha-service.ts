import {
  CognitoIdentityProviderClient,
  UpdateUserAttributesCommand,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

interface ABHAConfig {
  region: string;
  apiEndpoint: string;
}

export interface ABHALinkStatus {
  linked: boolean;
  abhaId?: string;
  linkedAt?: string;
}

export interface ABHAOTPResponse {
  txnId: string;
  message: string;
}

export interface ABHAVerificationResponse {
  success: boolean;
  abhaId: string;
  name: string;
  dateOfBirth: string;
  gender: string;
}

/**
 * ABHA ID Service for managing Ayushman Bharat Health Account integration
 * Handles ABHA ID linking, OTP verification, and authentication
 */
export class ABHAService {
  private client: CognitoIdentityProviderClient;
  private config: ABHAConfig;

  constructor(config: ABHAConfig) {
    this.config = config;
    this.client = new CognitoIdentityProviderClient({ region: config.region });
  }

  /**
   * Validate ABHA ID format
   * Format: 12-3456-7890-1234 (14 digits with hyphens)
   */
  validateABHAId(abhaId: string): boolean {
    const abhaRegex = /^\d{2}-\d{4}-\d{4}-\d{4}$/;
    return abhaRegex.test(abhaId);
  }

  /**
   * Request OTP for ABHA ID verification
   * @param abhaId - ABHA ID in format 12-3456-7890-1234
   */
  async requestOTP(abhaId: string): Promise<ABHAOTPResponse> {
    if (!this.validateABHAId(abhaId)) {
      throw new Error('Invalid ABHA ID format. Expected format: 12-3456-7890-1234');
    }

    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/v1/abdm/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ abhaId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to request OTP');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to request OTP:', error);
      throw new Error('Failed to send OTP. Please try again.');
    }
  }

  /**
   * Verify OTP and link ABHA ID to user account
   * @param abhaId - ABHA ID
   * @param otp - 6-digit OTP
   * @param txnId - Transaction ID from requestOTP
   * @param accessToken - User's Cognito access token
   */
  async verifyAndLink(
    abhaId: string,
    otp: string,
    txnId: string,
    accessToken: string
  ): Promise<ABHAVerificationResponse> {
    if (!this.validateABHAId(abhaId)) {
      throw new Error('Invalid ABHA ID format');
    }

    if (!/^\d{6}$/.test(otp)) {
      throw new Error('Invalid OTP format. Expected 6 digits.');
    }

    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/v1/abdm/verify-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ abhaId, otp, txnId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to verify OTP');
      }

      const data = await response.json();

      // Update Cognito user attribute with ABHA ID
      await this.updateCognitoABHAId(accessToken, abhaId);

      return data;
    } catch (error) {
      console.error('Failed to verify and link ABHA ID:', error);
      throw new Error('Invalid OTP or verification failed. Please try again.');
    }
  }

  /**
   * Get current ABHA ID link status
   * @param accessToken - User's Cognito access token
   */
  async getLinkStatus(accessToken: string): Promise<ABHALinkStatus> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.client.send(command);

      const abhaIdAttr = response.UserAttributes?.find((attr) => attr.Name === 'custom:abhaId');

      const linkedAtAttr = response.UserAttributes?.find(
        (attr) => attr.Name === 'custom:abhaLinkedAt'
      );

      if (abhaIdAttr?.Value) {
        return {
          linked: true,
          abhaId: abhaIdAttr.Value,
          linkedAt: linkedAtAttr?.Value,
        };
      }

      return {
        linked: false,
      };
    } catch (error) {
      console.error('Failed to get ABHA link status:', error);
      throw new Error('Failed to retrieve ABHA ID status');
    }
  }

  /**
   * Unlink ABHA ID from user account
   * @param accessToken - User's Cognito access token
   */
  async unlinkABHA(accessToken: string): Promise<void> {
    try {
      // Remove ABHA ID from Cognito attributes
      const command = new UpdateUserAttributesCommand({
        AccessToken: accessToken,
        UserAttributes: [
          {
            Name: 'custom:abhaId',
            Value: '',
          },
          {
            Name: 'custom:abhaLinkedAt',
            Value: '',
          },
        ],
      });

      await this.client.send(command);

      // Notify backend to remove ABDM integration
      await fetch(`${this.config.apiEndpoint}/api/v1/abdm/unlink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.error('Failed to unlink ABHA ID:', error);
      throw new Error('Failed to unlink ABHA ID');
    }
  }

  /**
   * Fetch health records from ABDM
   * @param accessToken - User's Cognito access token
   */
  async fetchABDMRecords(accessToken: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/v1/abdm/records`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch ABDM records');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch ABDM records:', error);
      throw new Error('Failed to fetch health records from ABDM');
    }
  }

  /**
   * Update Cognito user attribute with ABHA ID
   * @param accessToken - User's Cognito access token
   * @param abhaId - ABHA ID to store
   */
  private async updateCognitoABHAId(accessToken: string, abhaId: string): Promise<void> {
    try {
      const command = new UpdateUserAttributesCommand({
        AccessToken: accessToken,
        UserAttributes: [
          {
            Name: 'custom:abhaId',
            Value: abhaId,
          },
          {
            Name: 'custom:abhaLinkedAt',
            Value: new Date().toISOString(),
          },
        ],
      });

      await this.client.send(command);
    } catch (error) {
      console.error('Failed to update Cognito ABHA ID:', error);
      throw new Error('Failed to save ABHA ID to user profile');
    }
  }
}

/**
 * Initialize ABHA Service from environment variables
 */
export function createABHAService(): ABHAService {
  const config: ABHAConfig = {
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-south-1',
    apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT || '',
  };

  if (!config.apiEndpoint) {
    throw new Error('Missing NEXT_PUBLIC_API_ENDPOINT in environment variables');
  }

  return new ABHAService(config);
}
