/**
 * Authentication middleware wrapper for Voice Processing Lambda
 */

const { createAuthMiddleware, requireRole } = require('../../../shared/nodejs/middleware/auth');

const authMiddleware = createAuthMiddleware({
  region: process.env.AWS_REGION || 'ap-south-1',
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID,
});

const requirePatient = requireRole(['Patient', 'VerifiedUser', 'HealthcareProvider']);

async function authenticate(event) {
  return await authMiddleware(event);
}

function checkPatientAccess(event) {
  return requirePatient(event);
}

module.exports = {
  authenticate,
  checkPatientAccess,
};
