import { MFAService } from '../mfa-service';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  SetUserMFAPreferenceCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// Mock AWS SDK
jest.mock('@aws-sdk/client-cognito-identity-provider');

describe('MFAService', () => {
  let mfaService: MFAService;
  const mockConfig = {
    region: 'ap-south-1',
    userPoolId: 'ap-south-1_test123',
    clientId: 'test-client-id',
  };
  const mockAccessToken = 'mock-access-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mfaService = new MFAService(mockConfig);
  });

  describe('getMFAStatus', () => {
    it('should return MFA status with both methods enabled', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        UserMFASettingList: ['SMS_MFA', 'SOFTWARE_TOKEN_MFA'],
        PreferredMfaSetting: 'SOFTWARE_TOKEN_MFA',
      });

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      const status = await mfaService.getMFAStatus(mockAccessToken);

      expect(status).toEqual({
        smsEnabled: true,
        totpEnabled: true,
        preferredMethod: 'TOTP',
      });

      expect(mockSend).toHaveBeenCalledWith(expect.any(GetUserCommand));
    });

    it('should return MFA status with only SMS enabled', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        UserMFASettingList: ['SMS_MFA'],
        PreferredMfaSetting: 'SMS_MFA',
      });

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      const status = await mfaService.getMFAStatus(mockAccessToken);

      expect(status).toEqual({
        smsEnabled: true,
        totpEnabled: false,
        preferredMethod: 'SMS',
      });
    });

    it('should return MFA status with no methods enabled', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        UserMFASettingList: [],
        PreferredMfaSetting: undefined,
      });

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      const status = await mfaService.getMFAStatus(mockAccessToken);

      expect(status).toEqual({
        smsEnabled: false,
        totpEnabled: false,
        preferredMethod: 'NONE',
      });
    });

    it('should throw error on failure', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Network error'));

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await expect(mfaService.getMFAStatus(mockAccessToken)).rejects.toThrow(
        'Failed to retrieve MFA status'
      );
    });
  });

  describe('setupTOTP', () => {
    it('should return secret code and QR code URL', async () => {
      const mockSecretCode = 'JBSWY3DPEHPK3PXP';
      const mockSend = jest
        .fn()
        .mockResolvedValueOnce({
          SecretCode: mockSecretCode,
          Session: 'mock-session',
        })
        .mockResolvedValueOnce({
          Username: 'testuser',
        });

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      const result = await mfaService.setupTOTP(mockAccessToken);

      expect(result.secretCode).toBe(mockSecretCode);
      expect(result.qrCodeUrl).toContain('otpauth://totp/');
      expect(result.qrCodeUrl).toContain(mockSecretCode);
      expect(result.qrCodeUrl).toContain('VaidyaLink');
      expect(result.session).toBe('mock-session');

      expect(mockSend).toHaveBeenCalledWith(expect.any(AssociateSoftwareTokenCommand));
    });

    it('should throw error if secret code is not generated', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        SecretCode: undefined,
      });

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await expect(mfaService.setupTOTP(mockAccessToken)).rejects.toThrow(
        'Failed to setup authenticator app'
      );
    });
  });

  describe('verifyTOTP', () => {
    it('should verify TOTP code successfully', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        Status: 'SUCCESS',
      });

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await expect(mfaService.verifyTOTP(mockAccessToken, '123456')).resolves.not.toThrow();

      expect(mockSend).toHaveBeenCalledWith(expect.any(VerifySoftwareTokenCommand));
    });

    it('should throw error for invalid code', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        Status: 'FAILED',
      });

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await expect(mfaService.verifyTOTP(mockAccessToken, '000000')).rejects.toThrow(
        'Invalid verification code'
      );
    });

    it('should include session if provided', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        Status: 'SUCCESS',
      });

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await mfaService.verifyTOTP(mockAccessToken, '123456', 'test-session');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Session: 'test-session',
          }),
        })
      );
    });
  });

  describe('setMFAPreference', () => {
    it('should set TOTP as preferred method', async () => {
      const mockSend = jest.fn().mockResolvedValue({});

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await mfaService.setMFAPreference(mockAccessToken, 'TOTP');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            SoftwareTokenMfaSettings: {
              Enabled: true,
              PreferredMfa: true,
            },
          }),
        })
      );
    });

    it('should set SMS as preferred method', async () => {
      const mockSend = jest.fn().mockResolvedValue({});

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await mfaService.setMFAPreference(mockAccessToken, 'SMS');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            SMSMfaSettings: {
              Enabled: true,
              PreferredMfa: true,
            },
          }),
        })
      );
    });

    it('should disable MFA when set to NONE', async () => {
      const mockSend = jest.fn().mockResolvedValue({});

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await mfaService.setMFAPreference(mockAccessToken, 'NONE');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            SoftwareTokenMfaSettings: {
              Enabled: false,
              PreferredMfa: false,
            },
          }),
        })
      );
    });
  });

  describe('respondToMFAChallenge', () => {
    it('should respond to SMS MFA challenge', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        AuthenticationResult: {
          AccessToken: 'new-access-token',
          IdToken: 'new-id-token',
          RefreshToken: 'new-refresh-token',
        },
      });

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      const result = await mfaService.respondToMFAChallenge(
        'SMS_MFA',
        'test-session',
        '123456',
        'testuser'
      );

      expect(result.AuthenticationResult).toBeDefined();
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ChallengeName: 'SMS_MFA',
            ChallengeResponses: {
              USERNAME: 'testuser',
              SMS_MFA_CODE: '123456',
            },
          }),
        })
      );
    });

    it('should respond to TOTP MFA challenge', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        AuthenticationResult: {
          AccessToken: 'new-access-token',
        },
      });

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await mfaService.respondToMFAChallenge(
        'SOFTWARE_TOKEN_MFA',
        'test-session',
        '654321',
        'testuser'
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ChallengeName: 'SOFTWARE_TOKEN_MFA',
            ChallengeResponses: {
              USERNAME: 'testuser',
              SOFTWARE_TOKEN_MFA_CODE: '654321',
            },
          }),
        })
      );
    });

    it('should throw error for invalid MFA code', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Invalid code'));

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await expect(
        mfaService.respondToMFAChallenge('SMS_MFA', 'test-session', '000000', 'testuser')
      ).rejects.toThrow('Invalid MFA code');
    });
  });

  describe('enableSMSMFA', () => {
    it('should enable SMS MFA successfully', async () => {
      const mockSend = jest.fn().mockResolvedValue({});

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await mfaService.enableSMSMFA(mockAccessToken);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            SMSMfaSettings: {
              Enabled: true,
              PreferredMfa: true,
            },
          }),
        })
      );
    });

    it('should throw error if phone number not verified', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Phone number not verified'));

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await expect(mfaService.enableSMSMFA(mockAccessToken)).rejects.toThrow(
        'Failed to enable SMS MFA'
      );
    });
  });

  describe('disableMFA', () => {
    it('should disable all MFA methods', async () => {
      const mockSend = jest.fn().mockResolvedValue({});

      (CognitoIdentityProviderClient.prototype.send as jest.Mock) = mockSend;

      await mfaService.disableMFA(mockAccessToken);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            SMSMfaSettings: {
              Enabled: false,
              PreferredMfa: false,
            },
            SoftwareTokenMfaSettings: {
              Enabled: false,
              PreferredMfa: false,
            },
          }),
        })
      );
    });
  });
});
