/**
 * Security Headers Middleware for AWS Lambda
 * Adds essential security headers to all HTTP responses
 *
 * Implements OWASP security best practices and HIPAA compliance requirements
 */

/**
 * Default security headers configuration
 */
const DEFAULT_HEADERS = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',

  // Enable XSS protection (legacy browsers)
  'X-XSS-Protection': '1; mode=block',

  // Enforce HTTPS with HSTS (1 year)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Content Security Policy - restrictive by default
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),

  // Permissions Policy (formerly Feature Policy)
  'Permissions-Policy': [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
  ].join(', '),
};

/**
 * Security headers middleware class
 */
class SecurityHeadersMiddleware {
  constructor(config = {}) {
    this.headers = { ...DEFAULT_HEADERS, ...config.headers };
    this.overwrite = config.overwrite !== false; // Default to true
  }

  /**
   * Apply security headers to Lambda response
   * @param {Object} response - Lambda response object
   * @returns {Object} Response with security headers added
   */
  apply(response) {
    if (!response) {
      throw new Error('Response object is required');
    }

    // Ensure headers object exists
    if (!response.headers) {
      response.headers = {};
    }

    // Apply security headers
    for (const [key, value] of Object.entries(this.headers)) {
      // Only add header if it doesn't exist or overwrite is enabled
      if (this.overwrite || !response.headers[key]) {
        response.headers[key] = value;
      }
    }

    return response;
  }

  /**
   * Update specific header
   * @param {string} name - Header name
   * @param {string} value - Header value
   */
  setHeader(name, value) {
    this.headers[name] = value;
  }

  /**
   * Remove specific header
   * @param {string} name - Header name
   */
  removeHeader(name) {
    delete this.headers[name];
  }

  /**
   * Get current headers configuration
   * @returns {Object} Current headers
   */
  getHeaders() {
    return { ...this.headers };
  }
}

/**
 * Create security headers middleware
 * @param {Object} config - Configuration options
 * @param {Object} config.headers - Custom headers to add/override
 * @param {boolean} config.overwrite - Whether to overwrite existing headers (default: true)
 * @returns {Function} Middleware function
 */
function createSecurityHeadersMiddleware(config = {}) {
  const middleware = new SecurityHeadersMiddleware(config);

  return (response) => {
    return middleware.apply(response);
  };
}

/**
 * Wrapper function for Lambda handlers
 * Automatically applies security headers to response
 * @param {Function} handler - Original Lambda handler
 * @param {Object} config - Security headers configuration
 * @returns {Function} Wrapped handler
 */
function withSecurityHeaders(handler, config = {}) {
  const applyHeaders = createSecurityHeadersMiddleware(config);

  return async (event, context) => {
    try {
      // Call original handler
      const response = await handler(event, context);

      // Apply security headers
      return applyHeaders(response);
    } catch (error) {
      // Apply headers even to error responses
      const errorResponse = {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: error.message,
        }),
      };

      return applyHeaders(errorResponse);
    }
  };
}

/**
 * Preset configurations for common scenarios
 */
const PRESETS = {
  /**
   * Strict configuration for healthcare/HIPAA compliance
   */
  strict: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': [
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self'",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ].join('; '),
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
    },
  },

  /**
   * API-only configuration (no CSP for HTML)
   */
  api: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    },
  },

  /**
   * Relaxed configuration for development
   */
  development: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
};

/**
 * Get preset configuration
 * @param {string} presetName - Name of preset (strict, api, development)
 * @returns {Object} Preset configuration
 */
function getPreset(presetName) {
  if (!PRESETS[presetName]) {
    throw new Error(`Unknown preset: ${presetName}. Available: ${Object.keys(PRESETS).join(', ')}`);
  }
  return PRESETS[presetName];
}

module.exports = {
  SecurityHeadersMiddleware,
  createSecurityHeadersMiddleware,
  withSecurityHeaders,
  DEFAULT_HEADERS,
  PRESETS,
  getPreset,
};
