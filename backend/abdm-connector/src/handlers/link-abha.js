/**
 * ABDM ABHA ID Linking Handler
 * Demonstrates JWT authentication middleware usage
 */

const { authenticate, checkPatientAccess } = require('../middleware/auth');

/**
 * Link ABHA ID to user account
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
    const { abhaId, otp } = body;

    if (!abhaId || !otp) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'abhaId and otp are required',
        }),
      };
    }

    // Get authenticated user info
    const userId = event.user.sub;
    const username = event.user.username;

    console.log(`User ${username} (${userId}) linking ABHA ID: ${abhaId}`);

    // TODO: Implement ABDM API integration
    // 1. Verify OTP with ABDM
    // 2. Link ABHA ID to user account
    // 3. Store mapping in DynamoDB
    // 4. Fetch existing health records from ABDM

    // Mock response for now
    const response = {
      success: true,
      message: 'ABHA ID linked successfully',
      data: {
        userId,
        abhaId,
        linkedAt: new Date().toISOString(),
      },
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
    console.error('Error linking ABHA ID:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
      }),
    };
  }
};
