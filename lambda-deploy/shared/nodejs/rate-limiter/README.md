# Rate Limiter Lambda Authorizer

Lambda authorizer for API Gateway that implements tiered rate limiting based on user roles.

## Features

- **Tiered Rate Limiting**: Different limits for Patient, Provider, HITL, and Admin users
- **Token Bucket Algorithm**: Smooth rate limiting with burst capacity
- **DynamoDB Tracking**: Persistent request counting across Lambda invocations
- **Fail-Open Design**: Allows requests on errors to prevent service disruption
- **Automatic Cleanup**: TTL-based expiration of old rate limit records

## Rate Limits

| Tier                | Requests/Minute | Burst Capacity |
| ------------------- | --------------- | -------------- |
| Patient             | 100             | 200            |
| Healthcare Provider | 1,000           | 2,000          |
| HITL Verifier       | 500             | 1,000          |
| Admin               | 2,000           | 4,000          |

## Usage

### As Lambda Authorizer

Deploy as API Gateway Lambda authorizer:

```typescript
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

const authorizer = new apigateway.TokenAuthorizer(this, 'RateLimitAuthorizer', {
  handler: rateLimitAuthorizerFunction,
  identitySource: 'method.request.header.Authorization',
  resultsCacheTtl: cdk.Duration.seconds(0), // Disable caching for rate limiting
});

// Attach to API methods
api.root.addMethod('GET', handler, {
  authorizer,
});
```

### Environment Variables

- `RATE_LIMIT_TABLE`: DynamoDB table name for rate limit tracking (required)
- `ENVIRONMENT`: Deployment environment (dev/staging/prod)

## Algorithm

### Token Bucket Implementation

1. **Time Window**: 1-minute sliding windows aligned to minute boundaries
2. **Request Counting**: Each request increments counter in DynamoDB
3. **Burst Handling**: Allows burst up to burst capacity
4. **Window Reset**: New window starts every minute

```javascript
const windowStart = Math.floor(Date.now() / 60000) * 60000;
```

### Flow

```
1. Extract user ID and groups from Cognito claims
2. Determine tier from groups (Admin > Provider > HITL > Patient)
3. Query DynamoDB for current window's request count
4. If count >= burst capacity: DENY
5. If count < burst capacity: INCREMENT and ALLOW
6. Set TTL for automatic cleanup after 2 minutes
```

## DynamoDB Schema

```typescript
{
  userId: string; // Cognito sub (partition key)
  windowStart: number; // Unix timestamp in ms (sort key)
  requestCount: number; // Number of requests in window
  tier: string; // User's rate limit tier
  ttl: number; // Expiration timestamp
  lastRequest: number; // Last request timestamp
}
```

## Error Handling

### Fail-Open Strategy

The authorizer fails open (allows requests) in these scenarios:

- DynamoDB is unavailable
- Lambda execution error
- Invalid request context

This prevents rate limiting from causing service outages.

### Logging

All errors are logged to CloudWatch:

```javascript
console.error('Rate limit check failed:', error);
```

## Testing

### Run Unit Tests

```bash
npm test
```

### Test Coverage

- User tier detection from Cognito groups
- Rate limit enforcement per tier
- Request counting and incrementing
- Time window management
- Error handling and fail-open behavior

### Manual Testing

```bash
# Set environment variables
export RATE_LIMIT_TABLE=vaidyalink-dev-rate-limits

# Invoke locally
node -e "
const { handler } = require('./index');
handler({
  methodArn: 'arn:aws:execute-api:region:account:api/stage/GET/path',
  requestContext: {
    authorizer: {
      claims: {
        sub: 'user-123',
        'cognito:groups': '[\"patients\"]'
      }
    }
  }
}).then(console.log);
"
```

## Monitoring

### CloudWatch Metrics

Custom metrics emitted:

- `RateLimitExceeded`: Count of denied requests
- `RateLimitCheckLatency`: Authorizer execution time
- `DynamoDBErrors`: Database operation failures

### CloudWatch Logs

Log format:

```json
{
  "level": "info",
  "message": "Rate limit check",
  "userId": "user-123",
  "tier": "Patient",
  "requestCount": 95,
  "limit": 100,
  "allowed": true
}
```

## Performance

### Latency

- **Average**: 20-50ms
- **P99**: < 100ms
- **Cold Start**: 200-300ms

### Optimization Tips

1. **Increase Memory**: 256MB is optimal for most cases
2. **Provisioned Concurrency**: For high-traffic APIs
3. **DynamoDB On-Demand**: Handles traffic spikes automatically

## Security

### Best Practices

1. **Validate User ID**: Always from Cognito claims, never from request
2. **Group Verification**: Verify group membership is authentic
3. **Audit Logging**: Log all rate limit decisions
4. **Encryption**: DynamoDB table encrypted at rest

### IAM Permissions

Required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:Query", "dynamodb:PutItem"],
      "Resource": "arn:aws:dynamodb:*:*:table/vaidyalink-*-rate-limits"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "*"
    }
  ]
}
```

## Troubleshooting

### High Denial Rate

**Symptom**: Many users getting 429 errors

**Solutions**:

1. Check if legitimate traffic spike
2. Review tier assignments
3. Consider increasing limits
4. Investigate for abuse patterns

### DynamoDB Throttling

**Symptom**: `ProvisionedThroughputExceededException`

**Solutions**:

1. Verify table is on-demand mode
2. Check for hot partitions
3. Review access patterns
4. Add caching layer

### Authorizer Timeouts

**Symptom**: API Gateway 500 errors

**Solutions**:

1. Increase Lambda timeout (currently 10s)
2. Optimize DynamoDB queries
3. Check network connectivity
4. Review CloudWatch Logs

## Development

### Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Check coverage
npm test -- --coverage
```

### Deployment

Deployed automatically via CDK:

```bash
cd infrastructure
npm run deploy
```

## References

- [API Gateway Lambda Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
