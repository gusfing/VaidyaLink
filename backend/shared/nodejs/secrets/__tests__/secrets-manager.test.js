/**
 * Tests for Secrets Manager utility
 */

const { SecretsManager } = require('../secrets-manager');

// Mock AWS SDK
jest.mock('@aws-sdk/client-secrets-manager', () => {
  return {
    SecretsManagerClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    GetSecretValueCommand: jest.fn(),
  };
});

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

describe('SecretsManager', () => {
  let secretsManager;
  let mockSend;

  beforeEach(() => {
    jest.clearAllMocks();
    secretsManager = new SecretsManager({ region: 'ap-south-1' });
    mockSend = SecretsManagerClient.mock.results[0].value.send;
  });

  describe('getSecret', () => {
    it('should retrieve and parse JSON secret', async () => {
      const mockSecret = { clientId: 'test-id', clientSecret: 'test-secret' };
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify(mockSecret),
      });

      const result = await secretsManager.getSecret('test-secret');

      expect(result).toEqual(mockSecret);
      expect(GetSecretValueCommand).toHaveBeenCalledWith({
        SecretId: 'test-secret',
      });
    });

    it('should retrieve plain text secret', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: 'plain-text-secret',
      });

      const result = await secretsManager.getSecret('test-secret');

      expect(result).toBe('plain-text-secret');
    });

    it('should retrieve binary secret', async () => {
      const binaryData = Buffer.from('binary-secret').toString('base64');
      mockSend.mockResolvedValueOnce({
        SecretBinary: binaryData,
      });

      const result = await secretsManager.getSecret('test-secret');

      expect(result).toBe('binary-secret');
    });

    it('should cache secrets', async () => {
      const mockSecret = { key: 'value' };
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify(mockSecret),
      });

      // First call
      await secretsManager.getSecret('test-secret');

      // Second call should use cache
      const result = await secretsManager.getSecret('test-secret');

      expect(result).toEqual(mockSecret);
      expect(mockSend).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should force refresh when requested', async () => {
      const mockSecret = { key: 'value' };
      mockSend.mockResolvedValue({
        SecretString: JSON.stringify(mockSecret),
      });

      // First call
      await secretsManager.getSecret('test-secret');

      // Force refresh
      await secretsManager.getSecret('test-secret', true);

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should throw error on failure', async () => {
      mockSend.mockRejectedValueOnce(new Error('Access denied'));

      await expect(secretsManager.getSecret('test-secret')).rejects.toThrow(
        'Failed to retrieve secret'
      );
    });
  });

  describe('getABDMCredentials', () => {
    it('should retrieve ABDM credentials', async () => {
      process.env.ENVIRONMENT = 'dev';
      const mockCreds = {
        clientId: 'abdm-id',
        clientSecret: 'abdm-secret',
        apiBaseUrl: 'https://dev.abdm.gov.in',
      };
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify(mockCreds),
      });

      const result = await secretsManager.getABDMCredentials();

      expect(result).toEqual(mockCreds);
      expect(GetSecretValueCommand).toHaveBeenCalledWith({
        SecretId: 'vaidyalink/dev/abdm/api-credentials',
      });
    });
  });

  describe('getBhashiniCredentials', () => {
    it('should retrieve Bhashini credentials', async () => {
      process.env.ENVIRONMENT = 'dev';
      const mockCreds = {
        apiKey: 'bhashini-key',
        apiBaseUrl: 'https://api.bhashini.gov.in',
      };
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify(mockCreds),
      });

      const result = await secretsManager.getBhashiniCredentials();

      expect(result).toEqual(mockCreds);
      expect(GetSecretValueCommand).toHaveBeenCalledWith({
        SecretId: 'vaidyalink/dev/bhashini/api-credentials',
      });
    });
  });

  describe('getBedrockConfig', () => {
    it('should retrieve Bedrock config', async () => {
      process.env.ENVIRONMENT = 'dev';
      const mockConfig = {
        modelId: 'anthropic.claude-3-5-sonnet',
        region: 'ap-south-1',
      };
      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify(mockConfig),
      });

      const result = await secretsManager.getBedrockConfig();

      expect(result).toEqual(mockConfig);
      expect(GetSecretValueCommand).toHaveBeenCalledWith({
        SecretId: 'vaidyalink/dev/bedrock/config',
      });
    });
  });

  describe('cache management', () => {
    it('should check cache validity', () => {
      secretsManager.cache.set('test-secret', 'value');
      secretsManager.cacheTimestamps.set('test-secret', Date.now());

      expect(secretsManager.isCacheValid('test-secret')).toBe(true);
    });

    it('should invalidate expired cache', () => {
      secretsManager.cache.set('test-secret', 'value');
      secretsManager.cacheTimestamps.set('test-secret', Date.now() - 400000); // 6+ minutes ago

      expect(secretsManager.isCacheValid('test-secret')).toBe(false);
    });

    it('should clear specific secret cache', () => {
      secretsManager.cache.set('secret1', 'value1');
      secretsManager.cache.set('secret2', 'value2');

      secretsManager.clearCache('secret1');

      expect(secretsManager.cache.has('secret1')).toBe(false);
      expect(secretsManager.cache.has('secret2')).toBe(true);
    });

    it('should clear all cache', () => {
      secretsManager.cache.set('secret1', 'value1');
      secretsManager.cache.set('secret2', 'value2');

      secretsManager.clearCache();

      expect(secretsManager.cache.size).toBe(0);
    });
  });

  describe('getSecrets', () => {
    it('should batch retrieve multiple secrets', async () => {
      mockSend
        .mockResolvedValueOnce({ SecretString: JSON.stringify({ key1: 'value1' }) })
        .mockResolvedValueOnce({ SecretString: JSON.stringify({ key2: 'value2' }) });

      const result = await secretsManager.getSecrets(['secret1', 'secret2']);

      expect(result).toEqual({
        secret1: { key1: 'value1' },
        secret2: { key2: 'value2' },
      });
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});
