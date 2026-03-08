const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE;

// Rate limit configurations by tier (requests per minute)
const RATE_LIMITS = {
  Patient: {
    requestsPerMinute: 100,
    burstCapacity: 200,
  },
  HealthcareProvider: {
    requestsPerMinute: 1000,
    burstCapacity: 2000,
  },
  HITLVerifier: {
    requestsPerMinute: 500,
    burstCapacity: 1000,
  },
  Admin: {
    requestsPerMinute: 2000,
    burstCapacity: 4000,
  },
};

/**
 * Lambda authorizer for rate limiting
 * Implements token bucket algorithm with DynamoDB
 */
exports.handler = async (event) => {
  console.log('Rate limit authorizer invoked', JSON.stringify(event, null, 2));

  try {
    // Extract user information from request context
    const userId = event.requestContext?.authorizer?.claims?.sub;
    const userGroups = event.requestContext?.authorizer?.claims?.['cognito:groups'];

    if (!userId) {
      console.error('No user ID found in request context');
      return generatePolicy('user', 'Deny', event.methodArn, {
        error: 'Unauthorized',
      });
    }

    // Determine user tier from groups
    const tier = getUserTier(userGroups);
    const rateLimit = RATE_LIMITS[tier];

    console.log(`User ${userId} has tier ${tier}`, rateLimit);

    // Check rate limit
    const allowed = await checkRateLimit(userId, tier, rateLimit);

    if (!allowed) {
      console.warn(`Rate limit exceeded for user ${userId}`);
      return generatePolicy(userId, 'Deny', event.methodArn, {
        error: 'Rate limit exceeded',
        tier,
        limit: rateLimit.requestsPerMinute,
      });
    }

    // Allow request
    return generatePolicy(userId, 'Allow', event.methodArn, {
      tier,
      limit: rateLimit.requestsPerMinute,
    });
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request on error to prevent service disruption
    return generatePolicy('user', 'Allow', event.methodArn, {
      error: 'Rate limit check failed',
    });
  }
};

/**
 * Determine user tier from Cognito groups
 */
function getUserTier(userGroups) {
  if (!userGroups) {
    return 'Patient'; // Default tier
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
 * Check rate limit using token bucket algorithm
 */
async function checkRateLimit(userId, tier, rateLimit) {
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
      return false;
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

    return true;
  } catch (error) {
    console.error('DynamoDB operation failed:', error);
    // Fail open on database errors
    return true;
  }
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
      ...context,
      // Convert objects to strings for API Gateway context
      ...(typeof context === 'object'
        ? Object.fromEntries(Object.entries(context).map(([k, v]) => [k, String(v)]))
        : {}),
    },
  };

  return policy;
}
