# Rate Limiting Implementation Guide

## Overview

VaidyaLink implements tiered rate limiting based on user roles to ensure fair resource allocation and protect the API from abuse. The system uses AWS API Gateway Usage Plans combined with a custom Lambda authorizer for fine-grained control.

## Rate Limit Tiers

| Tier                    | Requests/Minute | Burst Capacity | Monthly Quota | User Groups      |
| ----------------------- | --------------- | -------------- | ------------- | ---------------- |
| **Patient**             | 100             | 200            | 100,000       | `patients`       |
| **Healthcare Provider** | 1,000           | 2,000          | 1,000,000     | `providers`      |
| **HITL Verifier**       | 500             | 1,000          | 500,000       | `hitl_verifiers` |
| **Admin**               | 2,000           | 4,000          | 2,000,000     | `admins`         |

### Tier Selection Logic

Users are assigned to tiers based on their Cognito groups with the following priority:

1. **Admin** (highest priority)
2. **Healthcare Provider**
3. **HITL Verifier**
4. **Patient** (default)

If a user belongs to multiple groups, they receive the highest tier available.

## Architecture

### Components

1. **API Gateway Usage Plans**: Define throttle and quota limits per tier
2. **DynamoDB Rate Limit Table**: Tracks request counts per user per time window
3. **Lambda Authorizer**: Validates requests against rate limits before execution
4. **Token Bucket Algorithm**: Implements smooth rate limiting with burst capacity

### Data Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. API Request with JWT
       ▼
┌─────────────────────┐
│   API Gateway       │
│   (Cognito Auth)    │
└──────┬──────────────┘
       │ 2. Extract user & groups
       ▼
┌─────────────────────┐
│ Rate Limit          │
│ Authorizer Lambda   │
└──────┬──────────────┘
       │ 3. Check DynamoDB
       ▼
┌─────────────────────┐
│   DynamoDB          │
│   Rate Limit Table  │
└──────┬──────────────┘
       │ 4. Allow/Deny
       ▼
┌─────────────────────┐
│   Backend Lambda    │
│   (if allowed)      │
└─────────────────────┘
```

## DynamoDB Schema

### Rate Limit Table

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

### Indexes

- **Primary Key**: `userId` (HASH) + `windowStart` (RANGE)
- **GSI**: `WindowStartIndex` on `windowStart` for cleanup queries

## Implementation

### Infrastructure Setup

```typescript
import { RateLimitingConstruct } from './constructs/rate-limiting';

// In your CDK stack
const rateLimiting = new RateLimitingConstruct(this, 'RateLimiting', {
  environment: 'prod',
  api: restApi,
});

// Create API key for a user (optional)
const apiKey = rateLimiting.createApiKey('user-123', 'HealthcareProvider', 'API key for Dr. Smith');
```

### Lambda Authorizer Integration

The rate limit authorizer is automatically invoked by API Gateway before each request. It:

1. Extracts user ID and groups from Cognito claims
2. Determines the user's tier
3. Checks current request count in DynamoDB
4. Allows or denies the request based on limits
5. Increments the counter if allowed

### Token Bucket Algorithm

The implementation uses a sliding window token bucket:

- **Window Size**: 1 minute (60,000 ms)
- **Bucket Capacity**: Burst limit for the tier
- **Refill Rate**: Requests per minute for the tier
- **Window Alignment**: Aligned to minute boundaries

```javascript
const windowStart = Math.floor(Date.now() / 60000) * 60000;
```

## Error Handling

### Fail-Open Strategy

The rate limiter implements a fail-open strategy to prevent service disruption:

- If DynamoDB is unavailable, requests are **allowed**
- If the authorizer crashes, requests are **allowed**
- Errors are logged to CloudWatch for monitoring

### Rate Limit Exceeded Response

When a user exceeds their rate limit, API Gateway returns:

```json
{
  "message": "Rate limit exceeded",
  "tier": "Patient",
  "limit": 100,
  "retryAfter": 60
}
```

HTTP Status: `429 Too Many Requests`

## Monitoring

### CloudWatch Metrics

The rate limiter emits custom metrics:

- `RateLimitExceeded`: Count of denied requests per tier
- `RateLimitCheckLatency`: Time to check rate limits
- `RateLimitDynamoDBErrors`: DynamoDB operation failures

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

### Alarms

Recommended CloudWatch alarms:

1. **High Rate Limit Denials**: Alert when > 5% of requests are denied
2. **DynamoDB Throttling**: Alert on throttled reads/writes
3. **Authorizer Errors**: Alert on Lambda errors > 1%

## Testing

### Unit Tests

```bash
cd backend/shared/nodejs/rate-limiter
npm test
```

### Integration Tests

```bash
cd infrastructure
npm test -- rate-limiting.test.ts
```

### Load Testing

Use the provided k6 script to test rate limits:

```bash
k6 run tests/load/rate-limit-test.js
```

## Configuration

### Environment Variables

The rate limit authorizer uses:

- `RATE_LIMIT_TABLE`: DynamoDB table name
- `ENVIRONMENT`: Deployment environment (dev/staging/prod)

### Adjusting Limits

To modify rate limits, update `RATE_LIMITS` in:

1. `backend/shared/nodejs/rate-limiter/index.js`
2. `backend/shared/nodejs/middleware/rbac.js`
3. `infrastructure/lib/constructs/rate-limiting.ts`

Then redeploy:

```bash
npm run deploy
```

## Best Practices

### For API Consumers

1. **Implement Exponential Backoff**: Retry with increasing delays when rate limited
2. **Cache Responses**: Reduce unnecessary API calls
3. **Batch Requests**: Combine multiple operations when possible
4. **Monitor Usage**: Track your request patterns

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

1. Verify Lambda authorizer is attached to API Gateway
2. Check DynamoDB table exists and has correct permissions
3. Review CloudWatch Logs for authorizer errors
4. Ensure Cognito groups are correctly configured

### DynamoDB Throttling

1. Check table's read/write capacity (should be on-demand)
2. Review access patterns for hot partitions
3. Consider adding caching layer for high-traffic users
4. Monitor GSI usage and optimize queries

## Security Considerations

1. **User ID Validation**: Always validate user ID from Cognito claims
2. **Group Verification**: Verify group membership before tier assignment
3. **Audit Logging**: Log all rate limit decisions for compliance
4. **Fail-Open Risks**: Monitor for DynamoDB outages that bypass limits
5. **API Key Protection**: Treat API keys as secrets, rotate regularly

## Cost Optimization

### DynamoDB Costs

- **On-Demand Billing**: Pay only for actual reads/writes
- **TTL**: Automatic cleanup reduces storage costs
- **GSI**: Minimal cost due to KEYS_ONLY projection

### Lambda Costs

- **Short Execution**: Authorizer runs < 100ms typically
- **Memory**: 256MB is sufficient for most cases
- **Invocations**: One per API request (cached by API Gateway)

### Estimated Monthly Costs

| Tier                | Requests/Month | DynamoDB Cost | Lambda Cost | Total   |
| ------------------- | -------------- | ------------- | ----------- | ------- |
| 100 users (Patient) | 10M            | $2.50         | $2.00       | $4.50   |
| 1000 users (Mixed)  | 100M           | $25.00        | $20.00      | $45.00  |
| 10000 users (Mixed) | 1B             | $250.00       | $200.00     | $450.00 |

## Migration Guide

### From No Rate Limiting

1. Deploy rate limiting infrastructure
2. Set all users to highest tier initially
3. Monitor usage patterns for 1 week
4. Gradually assign users to appropriate tiers
5. Enable enforcement after validation

### From API Gateway Throttling Only

1. Deploy DynamoDB table and Lambda authorizer
2. Keep existing API Gateway throttling as backup
3. Enable Lambda authorizer on non-critical endpoints first
4. Monitor for issues
5. Roll out to all endpoints
6. Remove API Gateway throttling after validation

## References

- [AWS API Gateway Usage Plans](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html)
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Lambda Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)
