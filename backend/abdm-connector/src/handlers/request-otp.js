/**
 * ABDM ABHA ID OTP Request Handler
 * Requests OTP for ABHA ID verification
 */

const crypto = require('crypto');

// In-memory store for OTP transactions (use DynamoDB in production)
const otpStore = new Map();

// OTP expiry time: 10 minutes
const OTP_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Validate ABHA ID format
 * Format: 12-3456-7890-1234 (14 digits with hyphens)
 */
function validateABHAId(abhaId) {
  const abhaRegex = /^\d{2}-\d{4}-\d{4}-\d{4}$/;
  return abhaRegex.test(abhaId);
}

/**
 * Request OTP for ABHA ID verification
 * Public endpoint (no authentication required)
 */
exports.handler = async (event) => {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { abhaId } = body;

    if (!abhaId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'abhaId is required',
        }),
      };
    }

    // Validate ABHA ID format
    if (!validateABHAId(abhaId)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid ABHA ID format. Expected format: 12-3456-7890-1234',
        }),
      };
    }

    console.log(`OTP requested for ABHA ID: ${abhaId}`);

    // Generate transaction ID
    const txnId = crypto.randomBytes(16).toString('hex');

    // TODO: Integrate with ABDM API to request OTP
    // For now, simulate OTP request
    // In production, call ABDM authentication API:
    // POST https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/request/otp
    // Headers: { 'X-Token': 'Bearer <token>' }
    // Body: { healthId: abhaId }

    // Store transaction details (use DynamoDB in production)
    otpStore.set(txnId, {
      abhaId,
      createdAt: Date.now(),
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      verified: false,
    });

    // Clean up expired OTPs
    cleanupExpiredOTPs();

    const response = {
      success: true,
      txnId,
      message: 'OTP sent successfully to registered mobile number',
      expiresIn: 600, // 10 minutes in seconds
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error requesting OTP:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to request OTP. Please try again.',
      }),
    };
  }
};

/**
 * Clean up expired OTP transactions
 */
function cleanupExpiredOTPs() {
  const now = Date.now();
  for (const [txnId, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(txnId);
    }
  }
}

/**
 * Get OTP transaction (exported for use in verify handler)
 */
exports.getOTPTransaction = (txnId) => {
  return otpStore.get(txnId);
};

/**
 * Mark OTP as verified (exported for use in verify handler)
 */
exports.markOTPVerified = (txnId) => {
  const transaction = otpStore.get(txnId);
  if (transaction) {
    transaction.verified = true;
    otpStore.set(txnId, transaction);
  }
};
