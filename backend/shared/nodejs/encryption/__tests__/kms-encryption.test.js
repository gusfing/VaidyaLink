/**
 * Unit tests for KMS encryption utilities
 */

const { KMSEncryption } = require('../kms-encryption');
const {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
  GenerateDataKeyCommand,
  ReEncryptCommand,
} = require('@aws-sdk/client-kms');

// Mock AWS SDK
jest.mock('@aws-sdk/client-kms');

describe('KMSEncryption', () => {
  let mockKMSClient;
  let originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = process.env;
    process.env = { ...originalEnv, VAIDYALINK_KMS_KEY_ID: 'test-key-id' };

    // Reset mocks
    jest.clearAllMocks();

    // Mock KMS client
    mockKMSClient = {
      send: jest.fn(),
    };
    KMSClient.mockImplementation(() => mockKMSClient);
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;
  });

  describe('Initialization', () => {
    test('should initialize with provided config', () => {
      const config = {
        keyId: 'custom-key-id',
        region: 'us-east-1',
      };
      const kms = new KMSEncryption(config);

      expect(kms.keyId).toBe('custom-key-id');
      expect(kms.region).toBe('us-east-1');
    });

    test('should initialize with environment variables', () => {
      process.env.VAIDYALINK_KMS_KEY_ID = 'env-key-id';
      process.env.AWS_REGION = 'ap-south-1';

      const kms = new KMSEncryption();

      expect(kms.keyId).toBe('env-key-id');
      expect(kms.region).toBe('ap-south-1');
    });

    test('should throw error if key ID is not provided', () => {
      delete process.env.VAIDYALINK_KMS_KEY_ID;

      expect(() => new KMSEncryption()).toThrow('KMS key ID is required');
    });

    test('should default to ap-south-1 region', () => {
      delete process.env.AWS_REGION;

      const kms = new KMSEncryption();

      expect(kms.region).toBe('ap-south-1');
    });
  });

  describe('encrypt', () => {
    let kms;

    beforeEach(() => {
      kms = new KMSEncryption();
    });

    test('should encrypt plaintext successfully', async () => {
      const mockCiphertext = Buffer.from('encrypted_data');
      mockKMSClient.send.mockResolvedValue({
        CiphertextBlob: mockCiphertext,
      });

      const result = await kms.encrypt('sensitive data');

      expect(mockKMSClient.send).toHaveBeenCalledTimes(1);
      expect(mockKMSClient.send).toHaveBeenCalledWith(expect.any(EncryptCommand));

      // Verify result is base64 encoded
      expect(result).toBe(mockCiphertext.toString('base64'));
    });

    test('should encrypt with encryption context', async () => {
      mockKMSClient.send.mockResolvedValue({
        CiphertextBlob: Buffer.from('encrypted'),
      });

      const context = { patient_id: '123', data_type: 'medical_history' };
      await kms.encrypt('data', context);

      const command = mockKMSClient.send.mock.calls[0][0];
      expect(command.input.EncryptionContext).toEqual(context);
    });

    test('should throw error for empty plaintext', async () => {
      await expect(kms.encrypt('')).rejects.toThrow('Plaintext cannot be empty');
    });

    test('should handle KMS errors', async () => {
      mockKMSClient.send.mockRejectedValue(new Error('Access denied'));

      await expect(kms.encrypt('data')).rejects.toThrow('KMS encryption failed');
    });
  });

  describe('decrypt', () => {
    let kms;

    beforeEach(() => {
      kms = new KMSEncryption();
    });

    test('should decrypt ciphertext successfully', async () => {
      const mockPlaintext = Buffer.from('decrypted data');
      mockKMSClient.send.mockResolvedValue({
        Plaintext: mockPlaintext,
      });

      const ciphertext = Buffer.from('encrypted_data').toString('base64');
      const result = await kms.decrypt(ciphertext);

      expect(mockKMSClient.send).toHaveBeenCalledTimes(1);
      expect(mockKMSClient.send).toHaveBeenCalledWith(expect.any(DecryptCommand));
      expect(result).toBe('decrypted data');
    });

    test('should decrypt with encryption context', async () => {
      mockKMSClient.send.mockResolvedValue({
        Plaintext: Buffer.from('decrypted'),
      });

      const context = { patient_id: '123' };
      const ciphertext = Buffer.from('encrypted').toString('base64');
      await kms.decrypt(ciphertext, context);

      const command = mockKMSClient.send.mock.calls[0][0];
      expect(command.input.EncryptionContext).toEqual(context);
    });

    test('should throw error for empty ciphertext', async () => {
      await expect(kms.decrypt('')).rejects.toThrow('Ciphertext cannot be empty');
    });

    test('should handle invalid base64', async () => {
      await expect(kms.decrypt('not-valid-base64!!!')).rejects.toThrow();
    });

    test('should handle KMS errors', async () => {
      mockKMSClient.send.mockRejectedValue(new Error('Invalid ciphertext'));

      const ciphertext = Buffer.from('data').toString('base64');
      await expect(kms.decrypt(ciphertext)).rejects.toThrow('KMS decryption failed');
    });
  });

  describe('generateDataKey', () => {
    let kms;

    beforeEach(() => {
      kms = new KMSEncryption();
    });

    test('should generate data key successfully', async () => {
      mockKMSClient.send.mockResolvedValue({
        Plaintext: Buffer.from('plaintext_key'),
        CiphertextBlob: Buffer.from('encrypted_key'),
      });

      const result = await kms.generateDataKey();

      expect(mockKMSClient.send).toHaveBeenCalledWith(expect.any(GenerateDataKeyCommand));
      expect(result.plaintext).toEqual(Buffer.from('plaintext_key'));
      expect(result.ciphertext).toEqual(Buffer.from('encrypted_key'));
    });

    test('should generate data key with custom spec', async () => {
      mockKMSClient.send.mockResolvedValue({
        Plaintext: Buffer.from('key'),
        CiphertextBlob: Buffer.from('encrypted_key'),
      });

      await kms.generateDataKey('AES_128');

      const command = mockKMSClient.send.mock.calls[0][0];
      expect(command.input.KeySpec).toBe('AES_128');
    });

    test('should generate data key with encryption context', async () => {
      mockKMSClient.send.mockResolvedValue({
        Plaintext: Buffer.from('key'),
        CiphertextBlob: Buffer.from('encrypted_key'),
      });

      const context = { purpose: 'file_encryption' };
      await kms.generateDataKey('AES_256', context);

      const command = mockKMSClient.send.mock.calls[0][0];
      expect(command.input.EncryptionContext).toEqual(context);
    });
  });

  describe('reEncrypt', () => {
    let kms;

    beforeEach(() => {
      kms = new KMSEncryption();
    });

    test('should re-encrypt with new key', async () => {
      mockKMSClient.send.mockResolvedValue({
        CiphertextBlob: Buffer.from('new_encrypted_data'),
      });

      const ciphertext = Buffer.from('old_encrypted').toString('base64');
      const result = await kms.reEncrypt(ciphertext, 'new-key-id');

      expect(mockKMSClient.send).toHaveBeenCalledWith(expect.any(ReEncryptCommand));
      const command = mockKMSClient.send.mock.calls[0][0];
      expect(command.input.DestinationKeyId).toBe('new-key-id');

      expect(result).toBe(Buffer.from('new_encrypted_data').toString('base64'));
    });

    test('should re-encrypt with contexts', async () => {
      mockKMSClient.send.mockResolvedValue({
        CiphertextBlob: Buffer.from('new_encrypted'),
      });

      const ciphertext = Buffer.from('data').toString('base64');
      const sourceCtx = { old: 'context' };
      const destCtx = { new: 'context' };

      await kms.reEncrypt(ciphertext, 'new-key', sourceCtx, destCtx);

      const command = mockKMSClient.send.mock.calls[0][0];
      expect(command.input.SourceEncryptionContext).toEqual(sourceCtx);
      expect(command.input.DestinationEncryptionContext).toEqual(destCtx);
    });
  });

  describe('Integration', () => {
    test('should successfully encrypt and decrypt data', async () => {
      const kms = new KMSEncryption();
      const plaintext = 'sensitive patient data';

      // Mock encrypt
      mockKMSClient.send.mockResolvedValueOnce({
        CiphertextBlob: Buffer.from('encrypted_blob'),
      });

      // Mock decrypt
      mockKMSClient.send.mockResolvedValueOnce({
        Plaintext: Buffer.from(plaintext),
      });

      // Encrypt
      const ciphertext = await kms.encrypt(plaintext);

      // Decrypt
      const decrypted = await kms.decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });

    test('should encrypt and decrypt with matching context', async () => {
      const kms = new KMSEncryption();
      const plaintext = 'medical history';
      const context = { patient_id: '123', field: 'history' };

      mockKMSClient.send.mockResolvedValueOnce({
        CiphertextBlob: Buffer.from('encrypted'),
      });

      mockKMSClient.send.mockResolvedValueOnce({
        Plaintext: Buffer.from(plaintext),
      });

      const ciphertext = await kms.encrypt(plaintext, context);
      const decrypted = await kms.decrypt(ciphertext, context);

      expect(decrypted).toBe(plaintext);
    });
  });
});
