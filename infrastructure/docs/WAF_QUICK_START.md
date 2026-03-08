# WAF Quick Start Guide

Get AWS WAF DDoS protection up and running in 5 minutes.

## Quick Setup

### 1. Import the Construct

```typescript
import { WafConstruct } from './constructs/waf';
```

### 2. Create WAF for API Gateway

```typescript
const waf = new WafConstruct(this, 'ApiWaf', {
  namePrefix: 'vaidyalink-api',
  environment: 'prod',
  scope: 'REGIONAL',
});

// Associate with API Gateway
const apiArn = `arn:aws:apigateway:${this.region}::/restapis/${api.restApiId}/stages/prod`;
waf.associateWithApiGateway(apiArn);
```

### 3. Deploy

```bash
cd infrastructure
npm run build
cdk deploy
```

## What You Get

✅ **Rate limiting**: 2000 requests per 5 minutes per IP
✅ **SQL injection protection**: Blocks SQL injection attempts
✅ **XSS protection**: Blocks cross-site scripting attacks
✅ **Bad IP blocking**: Blocks known malicious IPs
✅ **Anonymous IP blocking**: Blocks VPNs, proxies, and Tor
✅ **CloudWatch alarms**: Automatic alerts for attacks

## Common Configurations

### High-Traffic API

```typescript
new WafConstruct(this, 'Waf', {
  namePrefix: 'vaidyalink-api',
  environment: 'prod',
  scope: 'REGIONAL',
  rateLimit: 5000, // Higher limit
});
```

### Development Environment

```typescript
new WafConstruct(this, 'Waf', {
  namePrefix: 'vaidyalink-api',
  environment: 'dev',
  scope: 'REGIONAL',
  rateLimit: 10000,
  enableManagedRules: false, // Reduce costs
  enableMetrics: false, // Reduce costs
});
```

### With Geo-Blocking

```typescript
new WafConstruct(this, 'Waf', {
  namePrefix: 'vaidyalink-api',
  environment: 'prod',
  scope: 'REGIONAL',
  blockedCountries: ['CN', 'RU', 'KP'],
});
```

### CloudFront Distribution

```typescript
// Must be deployed in us-east-1 for CloudFront
const waf = new WafConstruct(this, 'CloudFrontWaf', {
  namePrefix: 'vaidyalink-cdn',
  environment: 'prod',
  scope: 'CLOUDFRONT',
});

waf.associateWithCloudFront(distribution.distributionArn);
```

## Testing

### Test Rate Limiting

```bash
# Send 2100 requests quickly
for i in {1..2100}; do curl https://api.vaidyalink.com/health & done
wait

# Should see 429 responses after 2000 requests
```

### Test SQL Injection Protection

```bash
curl "https://api.vaidyalink.com/api/v1/patients?id=1' OR '1'='1"
# Should receive 403 Forbidden
```

## Monitoring

### View Metrics

1. Go to AWS Console → CloudWatch → Metrics
2. Select `AWS/WAFV2` namespace
3. View `BlockedRequests` and `AllowedRequests`

### View Alarms

1. Go to AWS Console → CloudWatch → Alarms
2. Look for:
   - `vaidyalink-prod-BlockedRequests`
   - `vaidyalink-prod-RateLimit`

### View Blocked Requests

1. Go to AWS Console → WAF & Shield
2. Select your Web ACL
3. Click "Sampled requests" tab
4. Filter by "Blocked" action

## Cost Estimate

**Production (10M requests/month)**: ~$18/month

- Web ACL: $5
- 7 Rules: $7
- Requests: $6

**Development (1M requests/month)**: ~$13/month

- Web ACL: $5
- 1 Rule: $1
- Requests: $0.60

## Next Steps

- [Full WAF Setup Documentation](./WAF_SETUP.md)
- [Enable WAF Logging](./WAF_SETUP.md#viewing-waf-logs)
- [Customize Rules](./WAF_SETUP.md#troubleshooting)
- [Set Up Alerts](./WAF_SETUP.md#monitoring-and-alerts)

## Troubleshooting

**Legitimate traffic blocked?**
→ Check CloudWatch Logs and add rule exclusions

**Rate limit too strict?**
→ Increase `rateLimit` parameter

**High costs?**
→ Disable managed rules in dev: `enableManagedRules: false`

## Support

For issues or questions:

1. Check [WAF Setup Documentation](./WAF_SETUP.md)
2. Review CloudWatch Logs
3. Check AWS WAF console for sampled requests
