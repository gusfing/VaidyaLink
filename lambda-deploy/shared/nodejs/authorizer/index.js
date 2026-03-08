/**
 * Lambda Authorizer for API Gateway
 * Validates Cognito JWT tokens and returns IAM policy
 */

const { createLambdaAuthorizer } = require('../middleware/auth');

// Initialize authorizer
const authorizer = createLambdaAuthorizer({
  region: process.env.AWS_REGION || 'ap-south-1',
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID,
});

/**
 * Lambda handler for API Gateway authorizer
 *
 * Event format:
 * {
 *   type: 'TOKEN',
 *   authorizationToken: 'Bearer <token>',
 *   methodArn: 'arn:aws:execute-api:region:account:api-id/stage/method/resource'
 * }
 */
exports.handler = async (event) => {
  console.log('Authorizer invoked for:', event.methodArn);

  try {
    const policy = await authorizer(event);
    console.log('Authorization successful for user:', policy.principalId);
    return policy;
  } catch (error) {
    console.error('Authorization failed:', error.message);

    // Return 401 Unauthorized
    throw new Error('Unauthorized');
  }
};
