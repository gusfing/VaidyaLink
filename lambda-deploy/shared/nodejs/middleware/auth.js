const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

/**
 * JWT Token Validation Middleware for AWS Lambda
 * Validates Cognito JWT tokens from API Gateway requests
 */

class JWTValidator {
  constructor(config) {
    this.region = config.region || process.env.AWS_REGION || 'ap-south-1';
    this.userPoolId = config.userPoolId || process.env.COGNITO_USER_POOL_ID;
    this.clientId = config.clientId || process.env.COGNITO_CLIENT_ID;

    if (!this.userPoolId) {
      throw new Error('COGNITO_USER_POOL_ID is required');
    }

    // JWKS endpoint for Cognito
    const jwksUri = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}/.well-known/jwks.json`;

    this.jwksClient = jwksClient({
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
      jwksUri,
    });

    this.issuer = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`;
  }

  /**
   * Get signing key from JWKS
   */
  async getSigningKey(kid) {
    try {
      const key = await this.jwksClient.getSigningKey(kid);
      return key.getPublicKey();
    } catch (error) {
      throw new Error(`Failed to get signing key: ${error.message}`);
    }
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token) {
    try {
      // Decode token header to get kid
      const decoded = jwt.decode(token, { complete: true });

      if (!decoded || !decoded.header || !decoded.header.kid) {
        throw new Error('Invalid token structure');
      }

      // Get signing key
      const signingKey = await this.getSigningKey(decoded.header.kid);

      // Verify token
      const verifyOptions = {
        issuer: this.issuer,
        algorithms: ['RS256'],
      };

      // Add client_id verification if configured
      if (this.clientId) {
        verifyOptions.audience = this.clientId;
      }

      const payload = jwt.verify(token, signingKey, verifyOptions);

      // Additional validation
      if (payload.token_use !== 'access' && payload.token_use !== 'id') {
        throw new Error('Invalid token_use claim');
      }

      return payload;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error(`Invalid token: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractToken(authHeader) {
    if (!authHeader) {
      throw new Error('Authorization header is missing');
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new Error('Invalid Authorization header format. Expected: Bearer <token>');
    }

    return parts[1];
  }
}

/**
 * Middleware function for Lambda handlers
 * Validates JWT token and adds user context to event
 */
function createAuthMiddleware(config = {}) {
  const validator = new JWTValidator(config);

  return async (event) => {
    try {
      // Extract token from headers
      const authHeader =
        event.headers?.Authorization ||
        event.headers?.authorization ||
        event.headers?.['x-authorization'];

      const token = validator.extractToken(authHeader);

      // Verify token
      const payload = await validator.verifyToken(token);

      // Add user context to event
      event.user = {
        sub: payload.sub,
        username: payload['cognito:username'] || payload.username,
        email: payload.email,
        groups: payload['cognito:groups'] || [],
        tokenUse: payload.token_use,
        claims: payload,
      };

      // Enrich user with RBAC permissions and rate limits
      enrichUserWithRBAC(event.user);

      return { authorized: true, user: event.user };
    } catch (error) {
      console.error('Authentication failed:', error.message);
      return {
        authorized: false,
        error: error.message,
      };
    }
  };
}

/**
 * Lambda authorizer function for API Gateway
 * Returns IAM policy for API Gateway authorization
 */
function createLambdaAuthorizer(config = {}) {
  const validator = new JWTValidator(config);

  return async (event) => {
    try {
      const token = validator.extractToken(event.authorizationToken);
      const payload = await validator.verifyToken(token);

      // Generate IAM policy
      const policy = generatePolicy(payload.sub, 'Allow', event.methodArn, payload);

      return policy;
    } catch (error) {
      console.error('Authorization failed:', error.message);
      throw new Error('Unauthorized');
    }
  };
}

/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(principalId, effect, resource, context = {}) {
  const policy = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context: {
      sub: context.sub || '',
      username: context['cognito:username'] || context.username || '',
      email: context.email || '',
      groups: JSON.stringify(context['cognito:groups'] || []),
    },
  };

  return policy;
}

/**
 * Helper to check if user has required role/group
 */
function hasRole(user, requiredRoles) {
  if (!Array.isArray(requiredRoles)) {
    requiredRoles = [requiredRoles];
  }

  return requiredRoles.some((role) => user.groups.includes(role));
}

/**
 * Role-based access control middleware
 */
function requireRole(requiredRoles) {
  return (event) => {
    if (!event.user) {
      return {
        authorized: false,
        error: 'User context not found. Ensure auth middleware runs first.',
      };
    }

    if (!hasRole(event.user, requiredRoles)) {
      return {
        authorized: false,
        error: `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      };
    }

    return { authorized: true };
  };
}

/**
 * Extract user permissions from groups/roles
 */
function extractUserPermissions(user) {
  const rbac = require('./rbac');
  return rbac.getUserPermissions(user.groups || []);
}

/**
 * Add RBAC context to user object
 */
function enrichUserWithRBAC(user) {
  const rbac = require('./rbac');

  user.permissions = rbac.getUserPermissions(user.groups || []);
  user.rateLimit = rbac.getRateLimit(user.groups || []);

  return user;
}

module.exports = {
  JWTValidator,
  createAuthMiddleware,
  createLambdaAuthorizer,
  generatePolicy,
  hasRole,
  requireRole,
  extractUserPermissions,
  enrichUserWithRBAC,
};
