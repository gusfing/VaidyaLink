/**
 * ABDM ABHA ID Unlinking Handler
 * Removes ABHA ID link from user account
 */

const { authenticate, checkPatientAccess } = require('../middleware/auth');

/**
 * Unlink ABHA ID from user account
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

    // Get authenticated user info
    const userId = event.user.sub;
    const username = event.user.username;

    console.log(`User ${username} (${userId}) unlinking ABHA ID`);

    // TODO: Remove ABHA ID mapping from DynamoDB
    // Table: ABHALinks
    // Delete item with PK: userId, SK: 'ABHA'

    // TODO: Revoke consent with ABDM
    // POST https://abhasbx.abdm.gov.in/abha/api/v3/consent/revoke
    // Headers: { 'X-Token': 'Bearer <abdm_token>' }

    const response = {
      success: true,
      message: 'ABHA ID unlinked successfully',
      unlinkedAt: new Date().toISOString(),
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
    console.error('Error unlinking ABHA ID:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to unlink ABHA ID. Please try again.',
      }),
    };
  }
};
