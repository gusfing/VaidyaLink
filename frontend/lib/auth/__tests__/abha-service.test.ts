import { ABHAService } from '../abha-service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({
    send: jest.fn(),
  })),
  GetUserCommand: jest.fn(),
  UpdateUserAttributesCommand: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

describe('ABHAService', () => {
  let abhaService: ABHAService;
  const mockConfig = {
    region: 'ap-south-1',
    apiEndpoint: 'https://api.example.com',
  };

  beforeEach(() => {
    abhaService = new ABHAService(mockConfig);
    jest.clearAllMocks();
  });

  describe('validateABHAId', () => {
    it('should validate correct ABHA ID format', () => {
      expect(abhaService.validateABHAId('12-3456-7890-1234')).toBe(true);
    });

    it('should reject invalid ABHA ID formats', () => {
      expect(abhaService.validateABHAId('123456789012')).toBe(false);
      expect(abhaService.validateABHAId('12-34-5678-9012')).toBe(false);
      expect(abhaService.validateABHAId('12-3456-7890-123')).toBe(false);
      expect(abhaService.validateABHAId('ab-cdef-ghij-klmn')).toBe(false);
    });
  });

  describe('requestOTP', () => {
    it('should request OTP for valid ABHA ID', async () => {
      const mockResponse = {
        txnId: 'test-txn-123',
        message: 'OTP sent successfully',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await abhaService.requestOTP('12-3456-7890-1234');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/abdm/request-otp',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ abhaId: '12-3456-7890-1234' }),
        })
      );
    });

    it('should throw error for invalid ABHA ID format', async () => {
      await expect(abhaService.requestOTP('invalid-id')).rejects.toThrow('Invalid ABHA ID format');
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'API Error' }),
      });

      await expect(abhaService.requestOTP('12-3456-7890-1234')).rejects.toThrow(
        'Failed to send OTP'
      );
    });
  });

  describe('verifyAndLink', () => {
    it('should verify OTP and link ABHA ID', async () => {
      const mockResponse = {
        success: true,
        abhaId: '12-3456-7890-1234',
        name: 'Test User',
        dateOfBirth: '1990-01-01',
        gender: 'M',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const mockClient = {
        send: jest.fn().mockResolvedValueOnce({}),
      };
      (abhaService as any).client = mockClient;

      const result = await abhaService.verifyAndLink(
        '12-3456-7890-1234',
        '123456',
        'test-txn-123',
        'test-access-token'
      );

      expect(result).toEqual(mockResponse);
      expect(mockClient.send).toHaveBeenCalled();
    });

    it('should throw error for invalid OTP format', async () => {
      await expect(
        abhaService.verifyAndLink('12-3456-7890-1234', '12345', 'txn-123', 'token')
      ).rejects.toThrow('Invalid OTP format');
    });

    it('should throw error for invalid ABHA ID', async () => {
      await expect(
        abhaService.verifyAndLink('invalid-id', '123456', 'txn-123', 'token')
      ).rejects.toThrow('Invalid ABHA ID format');
    });
  });

  describe('getLinkStatus', () => {
    it('should return linked status when ABHA ID exists', async () => {
      const mockClient = {
        send: jest.fn().mockResolvedValueOnce({
          UserAttributes: [
            { Name: 'custom:abhaId', Value: '12-3456-7890-1234' },
            { Name: 'custom:abhaLinkedAt', Value: '2024-01-15T10:00:00Z' },
          ],
        }),
      };
      (abhaService as any).client = mockClient;

      const result = await abhaService.getLinkStatus('test-access-token');

      expect(result).toEqual({
        linked: true,
        abhaId: '12-3456-7890-1234',
        linkedAt: '2024-01-15T10:00:00Z',
      });
    });

    it('should return not linked status when ABHA ID does not exist', async () => {
      const mockClient = {
        send: jest.fn().mockResolvedValueOnce({
          UserAttributes: [],
        }),
      };
      (abhaService as any).client = mockClient;

      const result = await abhaService.getLinkStatus('test-access-token');

      expect(result).toEqual({
        linked: false,
      });
    });
  });

  describe('unlinkABHA', () => {
    it('should unlink ABHA ID successfully', async () => {
      const mockClient = {
        send: jest.fn().mockResolvedValueOnce({}),
      };
      (abhaService as any).client = mockClient;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await abhaService.unlinkABHA('test-access-token');

      expect(mockClient.send).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/abdm/unlink',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('fetchABDMRecords', () => {
    it('should fetch ABDM records successfully', async () => {
      const mockRecords = {
        resourceType: 'Bundle',
        entry: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRecords,
      });

      const result = await abhaService.fetchABDMRecords('test-access-token');

      expect(result).toEqual(mockRecords);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/abdm/records',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        })
      );
    });

    it('should handle fetch errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Not found' }),
      });

      await expect(abhaService.fetchABDMRecords('test-access-token')).rejects.toThrow(
        'Failed to fetch health records'
      );
    });
  });
});
