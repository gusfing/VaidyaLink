/**
 * Rate Limiting Middleware for Lambda Functions
 * Implements token bucket algorithm with DynamoDB
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { getRateLimit } = require('./rbac');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE || 'vaidyalink-dev-rate-limits';

/**
 * Rate limiting middleware
 * Checks if user has exceeded their rate limit based on their tier
 *
 * Usage:
 * const { checkRateLimit } = require('./middleware/rate-limit');
 *
 * exports.handler = async (event) => {
 *   // After authentication
 *   const rateLimitResult = await checkRateLimit(event);
 *   if (!rateLimitResult.allowed) {
 *     return {
 *       statusCode: 429,
 *       body: JSON.stringify({
 *         message: 'Rate limit exceeded',
 *         ...rateLimitResult
 *       })
 *     };
 *   }
 *   // Continue with request processing
 * };
 */

/**
 * Check if user has exceeded rate limit
 * @param {Object} event - Lambda event object with user context
 * @returns {Promise<Object>} - { allowed: boolean, tier: string, limit: number, remaining: number, retryAfter: number }
 */
async function checkRateLimit(event) {
  try {
    // Extract user information from event
    const user = event.user || event.requestContext?.authorizer?.claims;

    if (!user) {
      console.warn('No user context found for rate limiting');
      // Fail open - allow request if no user context
      return {
        allowed: true,
        tier: 'Unknown',
        limit: 0,
        remaining: 0,
        retryAfter: 0,
      };
    }

    const userId = user.sub || user.userId;
    const userGroups = user.groups || user['cognito:groups'] || [];

    // Get rate limit for user's tier
    const rateLimit = getRateLimit(userGroups);
    const tier = getUserTier(userGroups);

    // Check rate limit in DynamoDB
    const result = await checkRateLimitInDb(userId, tier, rateLimit);

    return result;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request on error to prevent service disruption
    return {
      allowed: true,
      tier: 'Unknown',
      limit: 0,
      remaining: 0,
      retryAfter: 0,
      error: error.message,
    };
  }
}

/**
 * Check rate limit in DynamoDB using token bucket algorithm
 */
async function checkRateLimitInDb(userId, tier, rateLimit) {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000; // 1-minute window
  const ttl = Math.floor((windowStart + 120000) / 1000); // Expire after 2 minutes

  try {
    // Query current window
    const queryResult = await docClient.send(
      new QueryCommand({
        TableName: RATE_LIMIT_TABLE,
        KeyConditionExpression: 'userId = :userId AND windowStart = :windowStart',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':windowStart': windowStart,
        },
      })
    );

    let currentCount = 0;
    if (queryResult.Items && queryResult.Items.length > 0) {
      currentCount = queryResult.Items[0].requestCount || 0;
    }

    // Check against burst capacity
    if (currentCount >= rateLimit.burstCapacity) {
      const retryAfter = Math.ceil((windowStart + 60000 - now) / 1000);
      return {
        allowed: false,
        tier,
        limit: rateLimit.requestsPerMinute,
        remaining: 0,
        retryAfter,
      };
    }

    // Increment counter
    await docClient.send(
      new PutCommand({
        TableName: RATE_LIMIT_TABLE,
        Item: {
          userId,
          windowStart,
          requestCount: currentCount + 1,
          tier,
          ttl,
          lastRequest: now,
        },
      })
    );

    return {
      allowed: true,
      tier,
      limit: rateLimit.requestsPerMinute,
      remaining: rateLimit.burstCapacity - currentCount - 1,
      retryAfter: 0,
    };
  } catch (error) {
    console.error('DynamoDB operation failed:', error);
    // Fail open on database errors
    return {
      allowed: true,
      tier,
      limit: rateLimit.requestsPerMinute,
      remaining: 0,
      retryAfter: 0,
      error: error.message,
    };
  }
}

/**
 * Determine user tier from Cognito groups
 */
function getUserTier(userGroups) {
  if (!userGroups) {
    return 'Patient';
  }

  // Parse groups if it's a JSON string
  let groups = userGroups;
  if (typeof userGroups === 'string') {
    try {
      groups = JSON.parse(userGroups);
    } catch (e) {
      groups = [userGroups];
    }
  }

  if (!Array.isArray(groups)) {
    groups = [groups];
  }

  // Priority order: Admin > HealthcareProvider > HITLVerifier > Patient
  if (groups.includes('admins') || groups.includes('Admin')) {
    return 'Admin';
  }
  if (groups.includes('providers') || groups.includes('HealthcareProvider')) {
    return 'HealthcareProvider';
  }
  if (groups.includes('hitl_verifiers') || groups.includes('HITLVerifier')) {
    return 'HITLVerifier';
  }

  return 'Patient';
}

/**
 * Create rate limit response headers
 * @param {Object} rateLimitResult - Result from checkRateLimit
 * @returns {Object} - Headers object
 */
function getRateLimitHeaders(rateLimitResult) {
  return {
    'X-RateLimit-Limit': String(rateLimitResult.limit),
    'X-RateLimit-Remaining': String(rateLimitResult.remaining),
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + rateLimitResult.retryAfter),
    ...(rateLimitResult.retryAfter > 0 && { 'Retry-After': String(rateLimitResult.retryAfter) }),
  };
}

/**
 * Create rate limit exceeded response
 * @param {Object} rateLimitResult - Result from checkRateLimit
 * @returns {Object} - Lambda response object
 */
function createRateLimitResponse(rateLimitResult) {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      ...getRateLimitHeaders(rateLimitResult),
    },
    body: JSON.stringify({
      message: 'Rate limit exceeded',
      tier: rateLimitResult.tier,
      limit: rateLimitResult.limit,
      retryAfter: rateLimitResult.retryAfter,
    }),
  };
}

module.exports = {
  checkRateLimit,
  getRateLimitHeaders,
  createRateLimitResponse,
};
