# Rate Limiting Quick Start Guide

## 5-Minute Setup

### 1. Deploy Infrastructure

```bash
# Install dependencies
cd infrastructure
npm install

# Deploy rate limiting stack
npm run deploy -- --context environment=dev
```

### 2. Verify Deployment

Check that these resources were created:

- ✅ DynamoDB table: `vaidyalink-dev-rate-limits`
- ✅ Lambda function: `vaidyalink-dev-rate-limit-authorizer`
- ✅ 4 API Gateway Usage Plans (Patient, Provider, HITL, Admin)

### 3. Assign User to Tier

Add user to Cognito group:

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <USER_POOL_ID> \
  --username user@example.com \
  --group-name providers
```

### 4. Test Rate Limiting

```bash
# Make requests until rate limited
for i in {1..150}; do
  curl -H "Authorization: Bearer $JWT_TOKEN" \
    https://api.vaidyalink.com/api/v1/scans
done
```

Expected: First 100 requests succeed, then 429 errors.

## Rate Limit Tiers

| Tier     | Requests/Min | Cognito Group    |
| -------- | ------------ | ---------------- |
| Patient  | 100          | `patients`       |
| Provider | 1,000        | `providers`      |
| HITL     | 500          | `hitl_verifiers` |
| Admin    | 2,000        | `admins`         |

## Common Tasks

### Check User's Current Tier

```bash
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id <USER_POOL_ID> \
  --username user@example.com
```

### View Rate Limit Usage

```bash
aws dynamodb query \
  --table-name vaidyalink-dev-rate-limits \
  --key-condition-expression "userId = :uid" \
  --expression-attribute-values '{":uid":{"S":"<USER_ID>"}}'
```

### Monitor Rate Limit Denials

```bash
aws logs tail /aws/lambda/vaidyalink-dev-rate-limit-authorizer \
  --follow \
  --filter-pattern "Rate limit exceeded"
```

## Troubleshooting

### User Getting 429 Errors

1. Check their tier: `aws cognito-idp admin-list-groups-for-user ...`
2. Verify they're in correct group
3. Check if legitimate usage exceeds tier limits
4. Consider upgrading to higher tier

### Rate Limiter Not Working

1. Check Lambda logs: `aws logs tail /aws/lambda/vaidyalink-dev-rate-limit-authorizer`
2. Verify DynamoDB table exists
3. Check API Gateway has authorizer attached
4. Ensure Cognito groups are configured

## Next Steps

- Read full documentation: [RATE_LIMITING.md](./RATE_LIMITING.md)
- Set up monitoring: [MONITORING.md](./MONITORING.md)
- Configure alarms: [ALARMS.md](./ALARMS.md)
