/**
 * Security Headers Middleware Examples
 * Demonstrates various usage patterns for the security headers middleware
 */

const {
  createSecurityHeadersMiddleware,
  withSecurityHeaders,
  getPreset,
} = require('../security-headers');

// ============================================================================
// Example 1: Basic Usage with Manual Application
// ============================================================================

const applyHeaders = createSecurityHeadersMiddleware();

exports.basicHandler = async (event) => {
  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Hello from VaidyaLink',
      timestamp: new Date().toISOString(),
    }),
  };

  // Manually apply security headers
  return applyHeaders(response);
};

// ============================================================================
// Example 2: Using Decorator Pattern (Recommended)
// ============================================================================

exports.decoratedHandler = withSecurityHeaders(async (event) => {
  // Your business logic here
  const userId = event.user?.sub;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Security headers applied automatically',
      userId,
    }),
  };
});

// ============================================================================
// Example 3: Custom Headers Configuration
// ============================================================================

exports.customHeadersHandler = withSecurityHeaders(
  async (event) => {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Custom security configuration',
      }),
    };
  },
  {
    headers: {
      // Override default CSP for specific needs
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' https://cdn.vaidyalink.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.vaidyalink.com",
      ].join('; '),
      // Add custom header
      'X-VaidyaLink-Version': '1.0.0',
    },
  }
);

// ============================================================================
// Example 4: Using Strict Preset for HIPAA Compliance
// ============================================================================

exports.hipaaCompliantHandler = withSecurityHeaders(
  async (event) => {
    // Handle sensitive PHI data
    const patientData = {
      id: event.pathParameters?.patientId,
      records: [], // Fetch from HealthLake
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
      body: JSON.stringify(patientData),
    };
  },
  getPreset('strict') // Use strict preset for healthcare data
);

// ============================================================================
// Example 5: API-Only Preset for REST Endpoints
// ============================================================================

exports.apiHandler = withSecurityHeaders(
  async (event) => {
    const body = JSON.parse(event.body || '{}');

    // Process API request
    const result = {
      success: true,
      data: body,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    };
  },
  getPreset('api') // Simplified headers for API responses
);

// ============================================================================
// Example 6: Combining with Authentication Middleware
// ============================================================================

const { createAuthMiddleware } = require('../auth');

const authMiddleware = createAuthMiddleware();

exports.secureAuthenticatedHandler = withSecurityHeaders(async (event) => {
  // First, authenticate the request
  const authResult = await authMiddleware(event);

  if (!authResult.authorized) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Unauthorized',
        message: authResult.error,
      }),
    };
  }

  // Process authenticated request
  const user = event.user;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Authenticated and secured',
      username: user.username,
    }),
  };
});

// ============================================================================
// Example 7: Document Upload Handler with Security Headers
// ============================================================================

const AWS = require('aws-sdk');
const s3 = new AWS.S3();

exports.documentUploadHandler = withSecurityHeaders(async (event) => {
  const { patientId, documentType } = JSON.parse(event.body || '{}');

  // Generate pre-signed URL for secure upload
  const key = `raw/${patientId}/${Date.now()}-${documentType}.jpg`;
  const uploadUrl = s3.getSignedUrl('putObject', {
    Bucket: process.env.DOCUMENTS_BUCKET,
    Key: key,
    Expires: 300, // 5 minutes
    ContentType: 'image/jpeg',
  });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uploadUrl,
      key,
      expiresIn: 300,
    }),
  };
}, getPreset('strict'));

// ============================================================================
// Example 8: FHIR Export Handler with Custom Headers
// ============================================================================

exports.fhirExportHandler = withSecurityHeaders(
  async (event) => {
    const patientId = event.pathParameters?.patientId;
    const format = event.queryStringParameters?.format || 'json';

    // Fetch FHIR bundle from HealthLake
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [],
    };

    const contentType = format === 'xml' ? 'application/fhir+xml' : 'application/fhir+json';
    const body = format === 'xml' ? convertToXML(fhirBundle) : JSON.stringify(fhirBundle);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="patient-${patientId}.${format}"`,
      },
      body,
    };
  },
  {
    headers: {
      ...getPreset('strict').headers,
      // Additional headers for file downloads
      'X-Content-Type-Options': 'nosniff',
      'X-Download-Options': 'noopen',
    },
  }
);

// ============================================================================
// Example 9: Error Handler with Security Headers
// ============================================================================

exports.errorProneHandler = withSecurityHeaders(async (event) => {
  try {
    // Simulate operation that might fail
    const data = await riskyOperation();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data }),
    };
  } catch (error) {
    console.error('Operation failed:', error);

    // Return error response (headers will be applied automatically)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
      }),
    };
  }
});

// ============================================================================
// Example 10: WebSocket Connection Handler
// ============================================================================

exports.websocketHandler = withSecurityHeaders(async (event) => {
  const connectionId = event.requestContext?.connectionId;
  const routeKey = event.requestContext?.routeKey;

  if (routeKey === '$connect') {
    // Handle WebSocket connection
    return {
      statusCode: 200,
      body: 'Connected',
    };
  }

  if (routeKey === '$disconnect') {
    // Handle WebSocket disconnection
    return {
      statusCode: 200,
      body: 'Disconnected',
    };
  }

  return {
    statusCode: 200,
    body: 'Message received',
  };
}, getPreset('api'));

// Helper function (not exported)
function riskyOperation() {
  return Promise.resolve({ result: 'success' });
}

function convertToXML(data) {
  // Simplified XML conversion
  return `<?xml version="1.0" encoding="UTF-8"?><Bundle>${JSON.stringify(data)}</Bundle>`;
}
