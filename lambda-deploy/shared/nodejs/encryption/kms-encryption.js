/**
 * AWS KMS Encryption Utility for VaidyaLink
 * Provides encryption/decryption using AWS KMS customer-managed keys
 * HIPAA-compliant encryption for PHI data
 */

const {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
  GenerateDataKeyCommand,
  ReEncryptCommand,
} = require('@aws-sdk/client-kms');

class KMSEncryption {
  /**
   * Initialize KMS encryption service
   *
   * @param {Object} config - Configuration options
   * @param {string} config.keyId - KMS key ID or alias (default: from env VAIDYALINK_KMS_KEY_ID)
   * @param {string} config.region - AWS region (default: from env AWS_REGION or ap-south-1)
   */
  constructor(config = {}) {
    this.region = config.region || process.env.AWS_REGION || 'ap-south-1';
    this.keyId = config.keyId || process.env.VAIDYALINK_KMS_KEY_ID;

    if (!this.keyId) {
      throw new Error('KMS key ID is required. Set VAIDYALINK_KMS_KEY_ID environment variable.');
    }

    // Initialize KMS client
    this.kmsClient = new KMSClient({ region: this.region });
  }

  /**
   * Encrypt plaintext using KMS
   *
   * @param {string} plaintext - The data to encrypt
   * @param {Object} encryptionContext - Optional key-value pairs for additional authenticated data
   *                                     Example: { patient_id: '123', data_type: 'medical_history' }
   * @returns {Promise<string>} Base64-encoded ciphertext
   * @throws {Error} If plaintext is empty or KMS operation fails
   */
  async encrypt(plaintext, encryptionContext = null) {
    if (!plaintext) {
      throw new Error('Plaintext cannot be empty');
    }

    try {
      // Convert string to buffer
      const plaintextBuffer = Buffer.from(plaintext, 'utf-8');

      // Prepare encryption parameters
      const params = {
        KeyId: this.keyId,
        Plaintext: plaintextBuffer,
      };

      // Add encryption context if provided
      if (encryptionContext) {
        params.EncryptionContext = encryptionContext;
      }

      // Encrypt using KMS
      const command = new EncryptCommand(params);
      const response = await this.kmsClient.send(command);

      // Return base64-encoded ciphertext
      return Buffer.from(response.CiphertextBlob).toString('base64');
    } catch (error) {
      throw new Error(`KMS encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt ciphertext using KMS
   *
   * @param {string} ciphertext - Base64-encoded encrypted data
   * @param {Object} encryptionContext - Must match the context used during encryption
   * @returns {Promise<string>} Decrypted plaintext string
   * @throws {Error} If ciphertext is empty, invalid, or KMS operation fails
   */
  async decrypt(ciphertext, encryptionContext = null) {
    if (!ciphertext) {
      throw new Error('Ciphertext cannot be empty');
    }

    try {
      // Decode base64 ciphertext
      const ciphertextBuffer = Buffer.from(ciphertext, 'base64');

      // Prepare decryption parameters
      const params = {
        CiphertextBlob: ciphertextBuffer,
      };

      // Add encryption context if provided
      if (encryptionContext) {
        params.EncryptionContext = encryptionContext;
      }

      // Decrypt using KMS
      const command = new DecryptCommand(params);
      const response = await this.kmsClient.send(command);

      // Return decrypted plaintext
      return Buffer.from(response.Plaintext).toString('utf-8');
    } catch (error) {
      if (error.message.includes('Invalid base64')) {
        throw new Error('Invalid base64-encoded ciphertext');
      }
      throw new Error(`KMS decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate a data encryption key for envelope encryption
   *
   * @param {string} keySpec - Key specification (AES_256 or AES_128)
   * @param {Object} encryptionContext - Optional context for the data key
   * @returns {Promise<Object>} Object with 'plaintext' and 'ciphertext' data keys
   *
   * Note: Use this for encrypting large amounts of data locally.
   *       Encrypt data with plaintext key, store encrypted data with ciphertext key.
   */
  async generateDataKey(keySpec = 'AES_256', encryptionContext = null) {
    try {
      const params = {
        KeyId: this.keyId,
        KeySpec: keySpec,
      };

      if (encryptionContext) {
        params.EncryptionContext = encryptionContext;
      }

      const command = new GenerateDataKeyCommand(params);
      const response = await this.kmsClient.send(command);

      return {
        plaintext: response.Plaintext,
        ciphertext: response.CiphertextBlob,
      };
    } catch (error) {
      throw new Error(`Data key generation failed: ${error.message}`);
    }
  }

  /**
   * Re-encrypt data with a different KMS key (for key rotation)
   *
   * @param {string} ciphertext - Base64-encoded data encrypted with old key
   * @param {string} destinationKeyId - New KMS key ID or alias
   * @param {Object} sourceEncryptionContext - Context used with original encryption
   * @param {Object} destinationEncryptionContext - Context for new encryption
   * @returns {Promise<string>} Base64-encoded ciphertext encrypted with new key
   */
  async reEncrypt(
    ciphertext,
    destinationKeyId,
    sourceEncryptionContext = null,
    destinationEncryptionContext = null
  ) {
    try {
      const ciphertextBuffer = Buffer.from(ciphertext, 'base64');

      const params = {
        CiphertextBlob: ciphertextBuffer,
        DestinationKeyId: destinationKeyId,
      };

      if (sourceEncryptionContext) {
        params.SourceEncryptionContext = sourceEncryptionContext;
      }
      if (destinationEncryptionContext) {
        params.DestinationEncryptionContext = destinationEncryptionContext;
      }

      const command = new ReEncryptCommand(params);
      const response = await this.kmsClient.send(command);

      return Buffer.from(response.CiphertextBlob).toString('base64');
    } catch (error) {
      throw new Error(`KMS re-encryption failed: ${error.message}`);
    }
  }
}

module.exports = { KMSEncryption };
