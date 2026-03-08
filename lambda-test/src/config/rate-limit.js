/**
 * Rate Limiting Configuration
 * Defines rate limits for the API Lambda
 */

/**
 * Rate limit configuration
 * - Uses existing rate-limit middleware from backend/shared/nodejs/middleware/rate-limit.js
 * - Implements token bucket algorithm with DynamoDB storage
 * - Rate limits are per user (based on userId from JWT token)
 * - Returns 429 status code when rate limit is exceeded
 */

const RATE_LIMIT_CONFIG = {
  // Requests per minute per user
  requestsPerMinute: 100,

  // Burst capacity (maximum requests in a single minute window)
  burstCapacity: 100,

  // DynamoDB table for rate limit tracking
  tableName: process.env.RATE_LIMIT_TABLE || 'vaidyalink-dev-rate-limits',

  // Window size in milliseconds (1 minute)
  windowSize: 60000,

  // TTL for rate limit records (2 minutes)
  ttl: 120,
};

/**
 * Rate limit response headers
 * - X-RateLimit-Limit: Maximum requests per minute
 * - X-RateLimit-Remaining: Remaining requests in current window
 * - X-RateLimit-Reset: Unix timestamp when the rate limit resets
 * - Retry-After: Seconds to wait before retrying (only when rate limited)
 */

/**
 * Rate limit error response format
 * {
 *   message: 'Rate limit exceeded',
 *   tier: 'Patient|HealthcareProvider|HITLVerifier|Admin',
 *   limit: 100,
 *   retryAfter: 30
 * }
 */

module.exports = RATE_LIMIT_CONFIG;
