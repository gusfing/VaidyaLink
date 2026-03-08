/**
 * Authentication middleware wrapper for ABDM Connector Lambda
 * Re-exports shared middleware with ABDM-specific configuration
 */

const { createAuthMiddleware, requireRole } = require('../../../shared/nodejs/middleware/auth');

// Initialize auth middleware with environment config
const authMiddleware = createAuthMiddleware({
  region: process.env.AWS_REGION || 'ap-south-1',
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID,
});

// Role definitions for ABDM operations
const requirePatient = requireRole(['Patient', 'VerifiedUser']);
const requireProvider = requireRole(['HealthcareProvider', 'Admin']);
const requireAdmin = requireRole(['Admin', 'SuperAdmin']);

/**
 * Authenticate request and add user context
 */
async function authenticate(event) {
  return await authMiddleware(event);
}

/**
 * Check if user has patient access
 */
function checkPatientAccess(event) {
  return requirePatient(event);
}

/**
 * Check if user has provider access
 */
function checkProviderAccess(event) {
  return requireProvider(event);
}

/**
 * Check if user has admin access
 */
function checkAdminAccess(event) {
  return requireAdmin(event);
}

/**
 * Verify user owns the resource (patient ID matches)
 */
function verifyResourceOwnership(event, resourcePatientId) {
  if (!event.user) {
    return {
      authorized: false,
      error: 'User context not found',
    };
  }

  // Admins can access any resource
  if (event.user.groups.includes('Admin') || event.user.groups.includes('SuperAdmin')) {
    return { authorized: true };
  }

  // Check if user's patient ID matches resource
  const userPatientId = event.user.claims['custom:patientId'] || event.user.sub;

  if (userPatientId !== resourcePatientId) {
    return {
      authorized: false,
      error: 'Access denied: You can only access your own records',
    };
  }

  return { authorized: true };
}

module.exports = {
  authenticate,
  checkPatientAccess,
  checkProviderAccess,
  checkAdminAccess,
  verifyResourceOwnership,
};
