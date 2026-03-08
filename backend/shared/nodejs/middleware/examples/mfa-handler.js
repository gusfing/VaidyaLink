/**
 * Example Lambda handler demonstrating MFA integration
 * This shows how to handle MFA challenges in authentication flows
 */

const { createAuthMiddleware } = require('../auth');

/**
 * Example: Protected endpoint requiring MFA-authenticated users
 */
exports.protectedHandler = async (event, context) => {
  // Apply authentication middleware
  const authMiddleware = createAuthMiddleware();
  const authResult = await authMiddleware(event);

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

  // Access user information
  const user = event.user;

  // Check if user has MFA enabled (optional additional check)
  const hasMFA = user.claims['cognito:mfa_enabled'] === 'true';

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Access granted',
      user: {
        username: user.username,
        email: user.email,
        mfaEnabled: hasMFA,
      },
    }),
  };
};

/**
 * Example: Endpoint to check MFA status
 */
exports.mfaStatusHandler = async (event, context) => {
  const authMiddleware = createAuthMiddleware();
  const authResult = await authMiddleware(event);

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

  const user = event.user;

  // Extract MFA information from Cognito claims
  const mfaEnabled = user.claims['cognito:mfa_enabled'] === 'true';
  const preferredMfa = user.claims['cognito:preferred_mfa'];

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      mfaEnabled,
      preferredMfa: preferredMfa || 'NONE',
      username: user.username,
    }),
  };
};

/**
 * Example: Custom authentication flow with MFA handling
 * This demonstrates how to handle MFA challenges in a custom auth flow
 */
exports.customAuthHandler = async (event, context) => {
  const {
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
    RespondToAuthChallengeCommand,
  } = require('@aws-sdk/client-cognito-identity-provider');

  const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'ap-south-1',
  });

  try {
    const body = JSON.parse(event.body || '{}');
    const { username, password, mfaCode, session, challengeName } = body;

    // If MFA code is provided, respond to MFA challenge
    if (mfaCode && session && challengeName) {
      const command = new RespondToAuthChallengeCommand({
        ClientId: process.env.COGNITO_CLIENT_ID,
        ChallengeName: challengeName, // 'SMS_MFA' or 'SOFTWARE_TOKEN_MFA'
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          [challengeName === 'SMS_MFA' ? 'SMS_MFA_CODE' : 'SOFTWARE_TOKEN_MFA_CODE']: mfaCode,
        },
      });

      const response = await client.send(command);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          authenticationResult: response.AuthenticationResult,
        }),
      };
    }

    // Initial authentication
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });

    const response = await client.send(command);

    // Check if MFA challenge is required
    if (response.ChallengeName === 'SMS_MFA' || response.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          mfaRequired: true,
          challengeName: response.ChallengeName,
          session: response.Session,
          message:
            response.ChallengeName === 'SMS_MFA'
              ? 'MFA code sent to your phone'
              : 'Enter code from your authenticator app',
        }),
      };
    }

    // Authentication successful without MFA
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        authenticationResult: response.AuthenticationResult,
      }),
    };
  } catch (error) {
    console.error('Authentication error:', error);

    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Authentication failed',
        message: error.message,
      }),
    };
  }
};

/**
 * Example: Require MFA for sensitive operations
 */
exports.sensitiveOperationHandler = async (event, context) => {
  const authMiddleware = createAuthMiddleware();
  const authResult = await authMiddleware(event);

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

  const user = event.user;
  const mfaEnabled = user.claims['cognito:mfa_enabled'] === 'true';

  // Require MFA for sensitive operations
  if (!mfaEnabled) {
    return {
      statusCode: 403,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'MFA Required',
        message: 'This operation requires multi-factor authentication to be enabled',
      }),
    };
  }

  // Perform sensitive operation
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Sensitive operation completed successfully',
    }),
  };
};
