/**
 * Example Lambda handler demonstrating Secrets Manager usage
 */

const { getInstance } = require('../secrets-manager');

/**
 * Example: ABDM Connector Lambda using secrets
 */
exports.abdmHandler = async (event) => {
  const secretsManager = getInstance();

  try {
    // Get ABDM credentials
    const abdmCreds = await secretsManager.getABDMCredentials();

    console.log('ABDM API Base URL:', abdmCreds.apiBaseUrl);

    // Use credentials to make API call
    const response = await fetch(`${abdmCreds.apiBaseUrl}/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: abdmCreds.clientId,
        clientSecret: abdmCreds.clientSecret,
      }),
    });

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully authenticated with ABDM',
        token: data.token,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to authenticate with ABDM',
        message: error.message,
      }),
    };
  }
};

/**
 * Example: Voice Processing Lambda using Bhashini credentials
 */
exports.voiceHandler = async (event) => {
  const secretsManager = getInstance();

  try {
    // Get Bhashini credentials
    const bhashiniCreds = await secretsManager.getBhashiniCredentials();

    const audioData = event.audioData;
    const language = event.language || 'hi';

    // Use credentials to call Bhashini API
    const response = await fetch(`${bhashiniCreds.apiBaseUrl}/v1/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bhashiniCreds.apiKey}`,
        'User-Id': bhashiniCreds.userId,
      },
      body: JSON.stringify({
        audio: audioData,
        sourceLanguage: language,
        targetLanguage: 'en',
      }),
    });

    const transcription = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        transcription: transcription.text,
        confidence: transcription.confidence,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to transcribe audio',
        message: error.message,
      }),
    };
  }
};

/**
 * Example: Batch loading multiple secrets
 */
exports.batchSecretsHandler = async (event) => {
  const secretsManager = getInstance();

  try {
    // Load multiple secrets at once
    const secrets = await secretsManager.getSecrets([
      'vaidyalink/dev/abdm/api-credentials',
      'vaidyalink/dev/bhashini/api-credentials',
      'vaidyalink/dev/bedrock/config',
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully loaded all secrets',
        secretsLoaded: Object.keys(secrets).length,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to load secrets',
        message: error.message,
      }),
    };
  }
};

/**
 * Example: Using JWT signing secret
 */
exports.jwtHandler = async (event) => {
  const secretsManager = getInstance();
  const jwt = require('jsonwebtoken');

  try {
    // Get JWT signing secret
    const signingSecret = await secretsManager.getJWTSigningSecret();

    // Create a JWT token
    const token = jwt.sign(
      {
        userId: event.userId,
        role: event.role,
      },
      signingSecret,
      {
        expiresIn: '1h',
        issuer: 'vaidyalink',
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        token,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to generate JWT',
        message: error.message,
      }),
    };
  }
};

/**
 * Example: Force refresh secret (useful for rotation)
 */
exports.refreshSecretHandler = async (event) => {
  const secretsManager = getInstance();

  try {
    // Force refresh from AWS (bypass cache)
    const abdmCreds = await secretsManager.getABDMCredentials();

    // Clear cache for specific secret
    secretsManager.clearCache('vaidyalink/dev/abdm/api-credentials');

    // Or clear all cache
    // secretsManager.clearCache();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Secret refreshed successfully',
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to refresh secret',
        message: error.message,
      }),
    };
  }
};
