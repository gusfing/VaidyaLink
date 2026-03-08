/**
 * Request Signing Utilities for VaidyaLink
 *
 * Implements HMAC-SHA256 request signing for sensitive operations
 * to prevent replay attacks and ensure request integrity.
 */

const crypto = require('crypto');

/**
 * Generate HMAC-SHA256 signature for request
 * @param {Object} params - Signing parameters
 * @param {string} params.method - HTTP method (GET, POST, etc.)
 * @param {string} params.path - Request path
 * @param {Object} params.headers - Request headers
 * @param {string|Object} params.body - Request body
 * @param {string} params.secret - Signing secret
 * @param {number} params.timestamp - Unix timestamp in seconds
 * @returns {string} HMAC-SHA256 signature
 */
function generateSignature({ method, path, headers, body, secret, timestamp }) {
  // Normalize body
  const normalizedBody = typeof body === 'string' ? body : JSON.stringify(body || {});

  // Create canonical string
  const canonicalString = [method.toUpperCase(), path, timestamp.toString(), normalizedBody].join(
    '\n'
  );

  // Generate HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(canonicalString);
  return hmac.digest('hex');
}

/**
 * Verify request signature
 * @param {Object} params - Verification parameters
 * @param {string} params.method - HTTP method
 * @param {string} params.path - Request path
 * @param {Object} params.headers - Request headers
 * @param {string|Object} params.body - Request body
 * @param {string} params.secret - Signing secret
 * @param {string} params.providedSignature - Signature from request
 * @param {number} params.providedTimestamp - Timestamp from request
 * @param {number} [params.maxAgeSeconds=300] - Maximum age of request in seconds
 * @returns {Object} Verification result
 */
function verifySignature({
  method,
  path,
  headers,
  body,
  secret,
  providedSignature,
  providedTimestamp,
  maxAgeSeconds = 300,
}) {
  // Check timestamp validity
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const age = currentTimestamp - providedTimestamp;

  if (age > maxAgeSeconds) {
    return {
      valid: false,
      error: 'REQUEST_EXPIRED',
      message: `Request expired. Age: ${age}s, Max: ${maxAgeSeconds}s`,
    };
  }

  if (age < -60) {
    return {
      valid: false,
      error: 'TIMESTAMP_FUTURE',
      message: 'Request timestamp is in the future',
    };
  }

  // Generate expected signature
  const expectedSignature = generateSignature({
    method,
    path,
    headers,
    body,
    secret,
    timestamp: providedTimestamp,
  });

  // Check signature length first
  if (expectedSignature.length !== providedSignature.length) {
    return {
      valid: false,
      error: 'INVALID_SIGNATURE',
      message: 'Signature verification failed',
    };
  }

  // Constant-time comparison to prevent timing attacks
  const valid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(providedSignature)
  );

  if (!valid) {
    return {
      valid: false,
      error: 'INVALID_SIGNATURE',
      message: 'Signature verification failed',
    };
  }

  return { valid: true };
}

/**
 * Middleware for API Gateway Lambda to verify request signatures
 * @param {Object} options - Middleware options
 * @param {Function} options.getSecret - Function to retrieve signing secret
 * @param {number} [options.maxAgeSeconds=300] - Maximum request age
 * @param {string[]} [options.sensitiveOperations] - List of operations requiring signing
 * @returns {Function} Middleware function
 */
function createSignatureMiddleware(options = {}) {
  const { getSecret, maxAgeSeconds = 300, sensitiveOperations = [] } = options;

  if (!getSecret || typeof getSecret !== 'function') {
    throw new Error('getSecret function is required');
  }

  return async (event) => {
    const { httpMethod, path, headers, body } = event;

    // Check if operation requires signing
    const requiresSigning =
      sensitiveOperations.length === 0 || sensitiveOperations.some((op) => path.includes(op));

    if (!requiresSigning) {
      return { verified: true, skipped: true };
    }

    // Extract signature and timestamp from headers
    const signature = headers['X-VaidyaLink-Signature'] || headers['x-vaidyalink-signature'];
    const timestamp = headers['X-VaidyaLink-Timestamp'] || headers['x-vaidyalink-timestamp'];

    if (!signature || !timestamp) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: 'MISSING_SIGNATURE',
          message: 'Request signature and timestamp are required',
        }),
      };
    }

    // Get signing secret
    let secret;
    try {
      secret = await getSecret(event);
    } catch (error) {
      console.error('Failed to retrieve signing secret:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'INTERNAL_ERROR',
          message: 'Failed to verify request signature',
        }),
      };
    }

    // Verify signature
    const verification = verifySignature({
      method: httpMethod,
      path,
      headers,
      body,
      secret,
      providedSignature: signature,
      providedTimestamp: parseInt(timestamp, 10),
      maxAgeSeconds,
    });

    if (!verification.valid) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: verification.error,
          message: verification.message,
        }),
      };
    }

    return { verified: true };
  };
}

module.exports = {
  generateSignature,
  verifySignature,
  createSignatureMiddleware,
};
