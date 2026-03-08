/**
 * Error Handling Middleware
 * Provides consistent error response format across all endpoints
 */

/**
 * Error response structure:
 * {
 *   error: string,        // Human-readable error message
 *   code: string,         // Machine-readable error code
 *   details: string|array, // Additional error details
 *   requestId: string     // Request ID for tracing
 * }
 */

/**
 * Create standardized error response
 */
function createErrorResponse(statusCode, error, code, details, requestId) {
  return {
    statusCode,
    body: {
      error,
      code,
      details,
      requestId,
    },
  };
}

/**
 * Handle authentication errors (401)
 */
function handleAuthError(error, requestId) {
  const errorMap = {
    MISSING_TOKEN: {
      error: 'Missing authentication token',
      details: 'Authorization header is required',
    },
    INVALID_FORMAT: {
      error: 'Invalid authorization format',
      details: 'Authorization header must use Bearer scheme',
    },
    TOKEN_EXPIRED: {
      error: 'Token expired',
      details: 'Authentication token has expired',
    },
    INVALID_TOKEN: {
      error: 'Invalid token',
      details: 'Authentication token is invalid',
    },
    AUTH_FAILED: {
      error: 'Authentication failed',
      details: 'Unable to verify authentication token',
    },
  };

  const errorInfo = errorMap[error.code] || errorMap.AUTH_FAILED;

  return createErrorResponse(
    401,
    errorInfo.error,
    error.code || 'AUTH_FAILED',
    errorInfo.details,
    requestId
  );
}

/**
 * Handle validation errors (400)
 */
function handleValidationError(error, requestId) {
  return createErrorResponse(
    400,
    'Validation error',
    'VALIDATION_ERROR',
    error.details || 'Request validation failed',
    requestId
  );
}

/**
 * Handle not found errors (404)
 */
function handleNotFoundError(resource, requestId) {
  return createErrorResponse(404, 'Not found', 'NOT_FOUND', `${resource} not found`, requestId);
}

/**
 * Handle server errors (500)
 */
function handleServerError(error, requestId, includeDetails = false) {
  return createErrorResponse(
    500,
    'Internal server error',
    'INTERNAL_ERROR',
    includeDetails ? error.message : 'An unexpected error occurred',
    requestId
  );
}

/**
 * Express error handling middleware
 * Catches all errors and returns consistent JSON responses
 */
function errorHandler(err, req, res, next) {
  console.error('Error handler caught:', {
    error: err,
    stack: err.stack,
    requestId: req.id,
    path: req.path,
    method: req.method,
  });

  // Handle specific error types
  if (err.statusCode === 401 || err.code?.includes('AUTH')) {
    const response = handleAuthError(err, req.id);
    return res.status(response.statusCode).json(response.body);
  }

  if (err.statusCode === 400 || err.code === 'VALIDATION_ERROR') {
    const response = handleValidationError(err, req.id);
    return res.status(response.statusCode).json(response.body);
  }

  if (err.statusCode === 404 || err.code === 'NOT_FOUND') {
    const response = handleNotFoundError(err.resource || 'Resource', req.id);
    return res.status(response.statusCode).json(response.body);
  }

  // Default to server error
  const includeDetails = process.env.NODE_ENV === 'development';
  const response = handleServerError(err, req.id, includeDetails);
  res.status(response.statusCode).json(response.body);
}

/**
 * 404 handler for undefined routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not found',
    code: 'NOT_FOUND',
    details: `Endpoint ${req.method} ${req.path} not found`,
    requestId: req.id,
  });
}

/**
 * Async route wrapper to catch promise rejections
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createErrorResponse,
  handleAuthError,
  handleValidationError,
  handleNotFoundError,
  handleServerError,
};
