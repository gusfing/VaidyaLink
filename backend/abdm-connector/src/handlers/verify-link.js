/**
 * ABDM ABHA ID Verification and Linking Handler
 * Verifies OTP and links ABHA ID to user account
 */

const { authenticate, checkPatientAccess } = require('../middleware/auth');
const { getOTPTransaction, markOTPVerified } = require('./request-otp');

/**
 * Validate OTP format
 */
function validateOTP(otp) {
  return /^\d{6}$/.test(otp);
}

/**
 * Verify OTP and link ABHA ID to user account
 * Protected endpoint requiring patient authentication
 */
exports.handler = async (event) => {
  try {
    // Authenticate user
    const authResult = await authenticate(event);

    if (!authResult.authorized) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: authResult.error,
        }),
      };
    }

    // Check patient role
    const roleResult = checkPatientAccess(event);

    if (!roleResult.authorized) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Forbidden',
          message: roleResult.error,
        }),
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { abhaId, otp, txnId } = body;

    if (!abhaId || !otp || !txnId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'abhaId, otp, and txnId are required',
        }),
      };
    }

    // Validate OTP format
    if (!validateOTP(otp)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid OTP format. Expected 6 digits.',
        }),
      };
    }

    // Get OTP transaction
    const transaction = getOTPTransaction(txnId);

    if (!transaction) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid or expired transaction ID',
        }),
      };
    }

    // Check if transaction expired
    if (transaction.expiresAt < Date.now()) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'OTP has expired. Please request a new one.',
        }),
      };
    }

    // Check if ABHA ID matches
    if (transaction.abhaId !== abhaId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'ABHA ID does not match the transaction',
        }),
      };
    }

    // Get authenticated user info
    const userId = event.user.sub;
    const username = event.user.username;

    console.log(`User ${username} (${userId}) verifying ABHA ID: ${abhaId}`);

    // TODO: Integrate with ABDM API to verify OTP
    // For now, simulate OTP verification
    // In production, call ABDM authentication API:
    // POST https://abhasbx.abdm.gov.in/abha/api/v3/enrollment/auth/byAbdm
    // Headers: { 'X-Token': 'Bearer <token>' }
    // Body: { authData: { otp }, txnId }

    // Simulate OTP verification (accept any 6-digit OTP for demo)
    const otpValid = true; // In production, verify with ABDM API

    if (!otpValid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid OTP. Please try again.',
        }),
      };
    }

    // Mark OTP as verified
    markOTPVerified(txnId);

    // TODO: Store ABHA ID mapping in DynamoDB
    // Table: ABHALinks
    // PK: userId
    // SK: 'ABHA'
    // abhaId: string
    // linkedAt: ISO timestamp
    // abdmToken: string (from ABDM API response)

    // TODO: Fetch user profile from ABDM
    // GET https://abhasbx.abdm.gov.in/abha/api/v3/profile/account
    // Headers: { 'X-Token': 'Bearer <abdm_token>' }

    // Mock ABDM profile data
    const abdmProfile = {
      name: 'Rajesh Kumar',
      dateOfBirth: '1985-06-15',
      gender: 'M',
      mobile: '+91-9876543210',
      email: 'rajesh.kumar@example.com',
    };

    const response = {
      success: true,
      abhaId,
      name: abdmProfile.name,
      dateOfBirth: abdmProfile.dateOfBirth,
      gender: abdmProfile.gender,
      linkedAt: new Date().toISOString(),
      message: 'ABHA ID linked successfully',
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
    console.error('Error verifying and linking ABHA ID:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to verify and link ABHA ID. Please try again.',
      }),
    };
  }
};
