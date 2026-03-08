# Rate Limiting Middleware

## Overview

The rate limiting middleware implements tiered rate limiting based on user roles using a token bucket algorithm with DynamoDB for state management.

## Rate Limit Tiers

| Tier                    | Requests/Minute | Burst Capacity | User Groups      |
| ----------------------- | --------------- | -------------- | ---------------- |
| **Patient**             | 100             | 200            | `patients`       |
| **Healthcare Provider** | 1,000           | 2,000          | `providers`      |
| **HITL Verifier**       | 500             | 1,000          | `hitl_verifiers` |
| **Admin**               | 2,000           | 4,000          | `admins`         |

## Architecture

### Token Bucket Algorithm

The implementation uses a sliding window token bucket approach:

- **Window Size**: 1 minute (60,000 ms)
- **Bucket Capacity**: Burst limit for the tier
- **Refill Rate**: Requests per minute for the tier
- **Window Alignment**: Aligned to minute boundaries

### DynamoDB Schema

```typescript
{
  userId: string; // Partition key: Cognito sub
  windowStart: number; // Sort key: Unix timestamp (minute boundary)
  requestCount: number; // Number of requests in this window
  tier: string; // User's rate limit tier
  ttl: number; // Expiration timestamp (2 minutes after window)
  lastRequest: number; // Timestamp of last request
}
```

## Usage

### Node.js Lambda Functions

```javascript
const { checkRateLimit, createRateLimitResponse } = require('./middleware/rate-limit');

exports.handler = async (event) => {
  // After authentication (user context must be in event.user or event.requestContext.authorizer.claims)
  const rateLimitResult = await checkRateLimit(event);

  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult);
  }

  // Continue with request processing
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  };
};
```

### Python Lambda Functions

```python
from middleware.rate_limit import check_rate_limit, create_rate_limit_response

def lambda_handler(event, context):
    # After authentication
    rate_limit_result = check_rate_limit(event)

    if not rate_limit_result['allowed']:
        return create_rate_limit_response(rate_limit_result)

    # Continue with request processing
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Success'})
    }
```

### With Authentication Middleware

```javascript
const { createAuthMiddleware } = require('./middleware/auth');
const { checkRateLimit, createRateLimitResponse } = require('./middleware/rate-limit');

const authMiddleware = createAuthMiddleware();

exports.handler = async (event) => {
  // 1. Authenticate
  const authResult = await authMiddleware(event);
  if (!authResult.authorized) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: authResult.error }),
    };
  }

  // 2. Check rate limit
  const rateLimitResult = await checkRateLimit(event);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult);
  }

  // 3. Process request
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  };
};
```

## Environment Variables

```bash
RATE_LIMIT_TABLE=vaidyalink-dev-rate-limits  # DynamoDB table name
```

## Response Headers

The middleware adds standard rate limit headers to responses:

```
X-RateLimit-Limit: 100           # Requests per minute for user's tier
X-RateLimit-Remaining: 50        # Remaining requests in current window
X-RateLimit-Reset: 1704067200    # Unix timestamp when limit resets
Retry-After: 30                  # Seconds to wait before retrying (only when rate limited)
```

## Error Handling

### Fail-Open Strategy

The rate limiter implements a fail-open strategy to prevent service disruption:

- If DynamoDB is unavailable, requests are **allowed**
- If no user context is found, requests are **allowed**
- If the rate limit check crashes, requests are **allowed**
- All errors are logged to CloudWatch for monitoring

### Rate Limit Exceeded Response

When a user exceeds their rate limit:

```json
{
  "statusCode": 429,
  "headers": {
    "Content-Type": "application/json",
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": "1704067200",
    "Retry-After": "30"
  },
  "body": {
    "message": "Rate limit exceeded",
    "tier": "Patient",
    "limit": 100,
    "retryAfter": 30
  }
}
```

## Tier Selection Logic

Users are assigned to tiers based on their Cognito groups with the following priority:

1. **Admin** (highest priority)
2. **Healthcare Provider**
3. **HITL Verifier**
4. **Patient** (default)

If a user belongs to multiple groups, they receive the highest tier available.

## Testing

### Unit Tests

```bash
cd backend/shared/nodejs/middleware
npm test -- rate-limit.test.js
```

### Integration Testing

```javascript
// Test rate limiting with mock user
const event = {
  user: {
    sub: 'user-123',
    groups: ['Patient'],
  },
};

const result = await checkRateLimit(event);
console.log(result);
// { allowed: true, tier: 'Patient', limit: 100, remaining: 199, retryAfter: 0 }
```

### Load Testing

Use the provided k6 script to test rate limits:

```bash
k6 run tests/load/rate-limit-test.js
```

## Monitoring

### CloudWatch Metrics

Monitor rate limiting with custom metrics:

```javascript
const { CloudWatch } = require('@aws-sdk/client-cloudwatch');
const cloudwatch = new CloudWatch();

// After rate limit check
if (!rateLimitResult.allowed) {
  await cloudwatch.putMetricData({
    Namespace: 'VaidyaLink/RateLimit',
    MetricData: [
      {
        MetricName: 'RateLimitExceeded',
        Value: 1,
        Unit: 'Count',
        Dimensions: [{ Name: 'Tier', Value: rateLimitResult.tier }],
      },
    ],
  });
}
```

### CloudWatch Logs

All rate limit decisions are logged:

```json
{
  "userId": "user-123",
  "tier": "Patient",
  "requestCount": 95,
  "limit": 100,
  "allowed": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Best Practices

### For API Consumers

1. **Implement Exponential Backoff**: Retry with increasing delays when rate limited
2. **Cache Responses**: Reduce unnecessary API calls
3. **Batch Requests**: Combine multiple operations when possible
4. **Monitor Usage**: Track your request patterns
5. **Handle 429 Responses**: Check `Retry-After` header

### For Administrators

1. **Monitor Tier Distribution**: Ensure users are in correct tiers
2. **Review Denied Requests**: Identify legitimate users hitting limits
3. **Adjust Limits Gradually**: Increase limits based on usage patterns
4. **Set Up Alerts**: Get notified of unusual rate limit patterns

## Troubleshooting

### User Consistently Hitting Limits

1. Check user's tier assignment in Cognito groups
2. Review user's request patterns in CloudWatch Logs
3. Consider upgrading user to higher tier if legitimate
4. Investigate for potential abuse or misconfiguration

### Rate Limiter Not Working

1. Verify DynamoDB table exists and has correct permissions
2. Check Lambda has `RATE_LIMIT_TABLE` environment variable
3. Review CloudWatch Logs for errors
4. Ensure Cognito groups are correctly configured
5. Verify user context is being passed to middleware

### DynamoDB Throttling

1. Check table's read/write capacity (should be on-demand)
2. Review access patterns for hot partitions
3. Consider adding caching layer for high-traffic users
4. Monitor GSI usage and optimize queries

## Performance

### Latency

- First request: ~10-20ms (DynamoDB query + put)
- Subsequent requests: ~10-20ms (consistent)
- DynamoDB on-demand scaling handles traffic spikes

### Cost

- **DynamoDB**: ~$0.25 per million requests (on-demand)
- **Lambda**: Included in function execution time (~10ms overhead)

### Optimization Tips

1. Use DynamoDB on-demand billing for variable traffic
2. Enable TTL for automatic cleanup (reduces storage costs)
3. Consider caching rate limit status in Lambda memory for very high traffic
4. Use batch operations for multiple users if needed

## Security Considerations

1. **User ID Validation**: Always validate user ID from Cognito claims
2. **Group Verification**: Verify group membership before tier assignment
3. **Audit Logging**: Log all rate limit decisions for compliance
4. **Fail-Open Risks**: Monitor for DynamoDB outages that bypass limits
5. **DDoS Protection**: Rate limiting is one layer; use WAF for additional protection

## Migration Guide

### Adding to Existing Lambda

1. Install dependencies:

   ```bash
   npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
   ```

2. Add environment variable:

   ```typescript
   environment: {
     RATE_LIMIT_TABLE: rateLimiting.rateLimitTable.tableName,
   }
   ```

3. Grant DynamoDB permissions:

   ```typescript
   rateLimiting.rateLimitTable.grantReadWriteData(lambdaFunction);
   ```

4. Add middleware to handler:

   ```javascript
   const { checkRateLimit, createRateLimitResponse } = require('./middleware/rate-limit');

   exports.handler = async (event) => {
     const rateLimitResult = await checkRateLimit(event);
     if (!rateLimitResult.allowed) {
       return createRateLimitResponse(rateLimitResult);
     }
     // ... existing code
   };
   ```

## References

- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [API Gateway Rate Limiting](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html)
