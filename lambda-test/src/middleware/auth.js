/**
 * Authentication Middleware for API Lambda
 * Verifies AWS Cognito JWT tokens
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Initialize JWKS client for Cognito public keys
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
});

/**
 * Get signing key from JWKS
 */
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
      },
      (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      }
    );
  });
}

/**
 * Authentication middleware
 * Extracts and verifies JWT token from Authorization header
 * Attaches user identity to req.user
 *
 * MVP MODE: If COGNITO_USER_POOL_ID is not set, bypass authentication
 */
async function authenticateRequest(req, res, next) {
  try {
    // MVP MODE: Bypass authentication if Cognito is not configured
    if (!process.env.COGNITO_USER_POOL_ID) {
      console.log('MVP MODE: Authentication bypassed (Cognito not configured)');
      req.user = {
        userId: 'mvp-user',
        email: 'mvp@example.com',
        username: 'mvp-user',
        groups: [],
      };
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Missing authentication token',
        code: 'MISSING_TOKEN',
        details: 'Authorization header is required',
        requestId: req.id,
      });
    }

    // Check Bearer format
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Invalid authorization format',
        code: 'INVALID_FORMAT',
        details: 'Authorization header must use Bearer scheme',
        requestId: req.id,
      });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Missing authentication token',
        code: 'MISSING_TOKEN',
        details: 'Token not provided in Authorization header',
        requestId: req.id,
      });
    }

    // Verify token
    const decoded = await verifyToken(token);

    // Extract user identity from token claims
    req.user = {
      userId: decoded.sub,
      email: decoded.email,
      username: decoded['cognito:username'] || decoded.username,
      groups: decoded['cognito:groups'] || [],
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        details: 'Authentication token has expired',
        requestId: req.id,
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
        details: error.message,
        requestId: req.id,
      });
    }

    // Generic authentication failure
    return res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED',
      details: 'Unable to verify authentication token',
      requestId: req.id,
    });
  }
}

module.exports = {
  authenticateRequest,
  verifyToken,
};
