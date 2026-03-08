/**
 * AWS Secrets Manager utility for Node.js Lambda functions
 * Provides caching and easy access to secrets stored in AWS Secrets Manager
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

class SecretsManager {
  constructor(options = {}) {
    this.client = new SecretsManagerClient({
      region: options.region || process.env.AWS_REGION || 'ap-south-1',
    });
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes default
    this.cacheTimestamps = new Map();
  }

  /**
   * Get a secret value from AWS Secrets Manager
   * @param {string} secretName - The name or ARN of the secret
   * @param {boolean} forceRefresh - Force refresh from AWS (bypass cache)
   * @returns {Promise<Object|string>} The secret value (parsed JSON or string)
   */
  async getSecret(secretName, forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && this.isCacheValid(secretName)) {
      return this.cache.get(secretName);
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response = await this.client.send(command);

      let secretValue;
      if (response.SecretString) {
        try {
          secretValue = JSON.parse(response.SecretString);
        } catch {
          secretValue = response.SecretString;
        }
      } else if (response.SecretBinary) {
        secretValue = Buffer.from(response.SecretBinary, 'base64').toString('utf-8');
      }

      // Cache the secret
      this.cache.set(secretName, secretValue);
      this.cacheTimestamps.set(secretName, Date.now());

      return secretValue;
    } catch (error) {
      console.error(`Error retrieving secret ${secretName}:`, error);
      throw new Error(`Failed to retrieve secret: ${error.message}`);
    }
  }

  /**
   * Get ABDM API credentials
   * @returns {Promise<Object>} ABDM credentials object
   */
  async getABDMCredentials() {
    const environment = process.env.ENVIRONMENT || 'dev';
    return this.getSecret(`vaidyalink/${environment}/abdm/api-credentials`);
  }

  /**
   * Get Bhashini API credentials
   * @returns {Promise<Object>} Bhashini credentials object
   */
  async getBhashiniCredentials() {
    const environment = process.env.ENVIRONMENT || 'dev';
    return this.getSecret(`vaidyalink/${environment}/bhashini/api-credentials`);
  }

  /**
   * Get Bedrock configuration
   * @returns {Promise<Object>} Bedrock config object
   */
  async getBedrockConfig() {
    const environment = process.env.ENVIRONMENT || 'dev';
    return this.getSecret(`vaidyalink/${environment}/bedrock/config`);
  }

  /**
   * Get database credentials
   * @returns {Promise<Object>} Database credentials object
   */
  async getDatabaseCredentials() {
    const environment = process.env.ENVIRONMENT || 'dev';
    return this.getSecret(`vaidyalink/${environment}/database/credentials`);
  }

  /**
   * Get JWT signing secret
   * @returns {Promise<string>} JWT signing secret
   */
  async getJWTSigningSecret() {
    const environment = process.env.ENVIRONMENT || 'dev';
    return this.getSecret(`vaidyalink/${environment}/jwt/signing-key`);
  }

  /**
   * Check if cached secret is still valid
   * @param {string} secretName - The name of the secret
   * @returns {boolean} True if cache is valid
   */
  isCacheValid(secretName) {
    if (!this.cache.has(secretName)) {
      return false;
    }

    const timestamp = this.cacheTimestamps.get(secretName);
    return Date.now() - timestamp < this.cacheTTL;
  }

  /**
   * Clear the cache for a specific secret or all secrets
   * @param {string} secretName - Optional secret name to clear
   */
  clearCache(secretName = null) {
    if (secretName) {
      this.cache.delete(secretName);
      this.cacheTimestamps.delete(secretName);
    } else {
      this.cache.clear();
      this.cacheTimestamps.clear();
    }
  }

  /**
   * Batch get multiple secrets
   * @param {string[]} secretNames - Array of secret names
   * @returns {Promise<Object>} Object with secret names as keys
   */
  async getSecrets(secretNames) {
    const promises = secretNames.map((name) =>
      this.getSecret(name).then((value) => ({ name, value }))
    );

    const results = await Promise.all(promises);
    return results.reduce((acc, { name, value }) => {
      acc[name] = value;
      return acc;
    }, {});
  }
}

// Singleton instance for Lambda container reuse
let instance = null;

/**
 * Get singleton instance of SecretsManager
 * @param {Object} options - Configuration options
 * @returns {SecretsManager} SecretsManager instance
 */
function getInstance(options = {}) {
  if (!instance) {
    instance = new SecretsManager(options);
  }
  return instance;
}

module.exports = {
  SecretsManager,
  getInstance,
};
