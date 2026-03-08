/**
 * Authentication middleware wrapper for HITL Handler Lambda
 */

const { createAuthMiddleware, requireRole } = require('../../../shared/nodejs/middleware/auth');

const authMiddleware = createAuthMiddleware({
  region: process.env.AWS_REGION || 'ap-south-1',
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID,
});

// HITL operations require verifier or admin role
const requireVerifier = requireRole(['Verifier', 'Admin', 'SuperAdmin']);
const requireAdmin = requireRole(['Admin', 'SuperAdmin']);

async function authenticate(event) {
  return await authMiddleware(event);
}

function checkVerifierAccess(event) {
  return requireVerifier(event);
}

function checkAdminAccess(event) {
  return requireAdmin(event);
}

module.exports = {
  authenticate,
  checkVerifierAccess,
  checkAdminAccess,
};
