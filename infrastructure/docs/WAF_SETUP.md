# AWS WAF Setup for DDoS Protection

This document describes the AWS WAF (Web Application Firewall) configuration for VaidyaLink, providing DDoS protection and security rules for API Gateway and CloudFront distributions.

## Overview

The WAF construct provides comprehensive protection against:

- **DDoS attacks**: Rate-based rules to block excessive requests from single IPs
- **Common web exploits**: SQL injection, XSS, and other OWASP Top 10 vulnerabilities
- **Malicious IPs**: Blocks known bad actors and anonymous proxies
- **Geographic threats**: Optional geo-blocking for specific countries

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Requests                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS WAF Web ACL                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Rule 1: Rate Limiting (2000 req/5min per IP)        │  │
│  │  Rule 2: AWS Managed - Common Rule Set               │  │
│  │  Rule 3: AWS Managed - Known Bad Inputs              │  │
│  │  Rule 4: AWS Managed - SQL Injection Protection      │  │
│  │  Rule 5: Geo-Blocking (Optional)                     │  │
│  │  Rule 6: AWS Managed - IP Reputation List            │  │
│  │  Rule 7: AWS Managed - Anonymous IP List             │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│                   ┌────────┴────────┐                        │
│                   │                 │                        │
│              ┌────▼────┐      ┌────▼────┐                   │
│              │  Allow  │      │  Block  │                   │
│              └────┬────┘      └────┬────┘                   │
└───────────────────┼─────────────────┼──────────────────────┘
                    │                 │
                    ▼                 ▼
         ┌──────────────────┐  ┌──────────────────┐
         │   API Gateway    │  │  Custom Response │
         │   CloudFront     │  │  (429 or 403)    │
         └──────────────────┘  └──────────────────┘
```

## Features

### 1. Rate-Based DDoS Protection

Blocks IPs that exceed the configured request threshold within a 5-minute window.

**Default Configuration:**

- Limit: 2000 requests per 5 minutes per IP
- Response: HTTP 429 (Too Many Requests)
- Custom response body with error message

**Customization:**

```typescript
new WafConstruct(stack, 'Waf', {
  namePrefix: 'vaidyalink',
  environment: 'prod',
  scope: 'REGIONAL',
  rateLimit: 5000, // Custom limit
});
```

### 2. AWS Managed Rule Sets

Pre-configured rule sets maintained by AWS security experts:

#### Common Rule Set (CRS)

Protects against common web vulnerabilities including:

- Cross-site scripting (XSS)
- Local file inclusion (LFI)
- Remote file inclusion (RFI)
- Command injection
- Path traversal

#### Known Bad Inputs

Blocks requests with patterns known to be malicious, including:

- Invalid or malformed requests
- Requests with suspicious patterns
- Known exploit attempts

#### SQL Injection Protection

Detects and blocks SQL injection attempts in:

- Query strings
- Request bodies
- Headers
- Cookies

#### IP Reputation List

Blocks requests from IPs with poor reputation based on:

- Historical malicious activity
- Botnet participation
- Known attack sources

#### Anonymous IP List

Blocks requests from:

- VPN services
- Proxy servers
- Tor exit nodes
- Hosting providers commonly used for attacks

### 3. Geo-Blocking (Optional)

Block traffic from specific countries if needed:

```typescript
new WafConstruct(stack, 'Waf', {
  namePrefix: 'vaidyalink',
  environment: 'prod',
  scope: 'REGIONAL',
  blockedCountries: ['CN', 'RU', 'KP'], // ISO 3166-1 alpha-2 codes
});
```

### 4. CloudWatch Monitoring

Automatic CloudWatch alarms for:

- **Blocked Requests**: Alerts when blocks exceed 100 in 5 minutes
- **Rate Limit Violations**: Alerts when rate limiting triggers 50+ times in 5 minutes

All rules emit metrics for:

- Request counts
- Blocked requests
- Allowed requests
- Sampled requests for analysis

## Usage

### For API Gateway (Regional)

```typescript
import { WafConstruct } from './constructs/waf';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

// Create API Gateway
const api = new apigateway.RestApi(this, 'Api', {
  restApiName: 'vaidyalink-api',
});

// Create WAF
const waf = new WafConstruct(this, 'ApiWaf', {
  namePrefix: 'vaidyalink-api',
  environment: 'prod',
  scope: 'REGIONAL',
  rateLimit: 2000,
  enableManagedRules: true,
  enableMetrics: true,
});

// Associate WAF with API Gateway
const apiArn = `arn:aws:apigateway:${this.region}::/restapis/${api.restApiId}/stages/${api.deploymentStage.stageName}`;
waf.associateWithApiGateway(apiArn);
```

### For CloudFront Distribution

```typescript
import { WafConstruct } from './constructs/waf';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';

// Create CloudFront distribution
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: /* your origin */,
  },
});

// Create WAF (must be in us-east-1 for CloudFront)
const waf = new WafConstruct(this, 'CloudFrontWaf', {
  namePrefix: 'vaidyalink-cdn',
  environment: 'prod',
  scope: 'CLOUDFRONT',
  rateLimit: 5000,
  enableManagedRules: true,
});

// Associate WAF with CloudFront
waf.associateWithCloudFront(distribution.distributionArn);
```

## Configuration Options

| Property             | Type     | Default   | Description                                             |
| -------------------- | -------- | --------- | ------------------------------------------------------- |
| `namePrefix`         | string   | Required  | Prefix for WAF resource names                           |
| `environment`        | string   | Required  | Environment (dev, staging, prod)                        |
| `scope`              | string   | Required  | 'REGIONAL' for API Gateway, 'CLOUDFRONT' for CloudFront |
| `rateLimit`          | number   | 2000      | Requests per 5 minutes per IP before blocking           |
| `enableManagedRules` | boolean  | true      | Enable AWS managed rule sets                            |
| `blockedCountries`   | string[] | undefined | ISO country codes to block                              |
| `enableMetrics`      | boolean  | true      | Enable CloudWatch metrics and alarms                    |

## Cost Considerations

### WAF Pricing (as of 2024)

- **Web ACL**: $5.00 per month
- **Rules**: $1.00 per rule per month
- **Requests**: $0.60 per million requests

### Example Monthly Cost

For a production deployment with:

- 1 Web ACL
- 7 rules (rate limit + 6 managed rules)
- 10 million requests/month

**Total**: $5 + ($1 × 7) + ($0.60 × 10) = $18/month

### Cost Optimization

1. **Disable unused rules**: Set `enableManagedRules: false` if not needed
2. **Adjust rate limits**: Higher limits = fewer blocks = lower processing
3. **Use geo-blocking sparingly**: Only block countries with no legitimate traffic
4. **Monitor metrics**: Disable `enableMetrics: false` in dev environments

## Monitoring and Alerts

### CloudWatch Metrics

Available metrics in the `AWS/WAFV2` namespace:

- `AllowedRequests`: Requests that passed all rules
- `BlockedRequests`: Requests blocked by any rule
- `CountedRequests`: Requests counted but not blocked
- `SampledRequests`: Sample of requests for analysis

### CloudWatch Alarms

Two alarms are automatically created:

1. **BlockedRequestsAlarm**
   - Threshold: 100 blocked requests in 5 minutes
   - Indicates potential attack or misconfiguration

2. **RateLimitAlarm**
   - Threshold: 50 rate limit violations in 5 minutes
   - Indicates aggressive client behavior or DDoS attempt

### Viewing WAF Logs

Enable WAF logging to S3 or CloudWatch Logs:

```typescript
import * as logs from 'aws-cdk-lib/aws-logs';

const logGroup = new logs.LogGroup(this, 'WafLogs', {
  logGroupName: '/aws/waf/vaidyalink',
  retention: logs.RetentionDays.ONE_MONTH,
});

// Add logging configuration to Web ACL
const loggingConfiguration = new wafv2.CfnLoggingConfiguration(this, 'WafLogging', {
  resourceArn: waf.webAclArn,
  logDestinationConfigs: [logGroup.logGroupArn],
});
```

## Testing

### Unit Tests

Run the test suite:

```bash
cd infrastructure
npm test -- waf.test.ts
```

### Manual Testing

1. **Test rate limiting**:

```bash
# Send 2100 requests in quick succession
for i in {1..2100}; do
  curl https://api.vaidyalink.com/health &
done
wait

# Should receive 429 responses after 2000 requests
```

2. **Test SQL injection protection**:

```bash
# Should be blocked by WAF
curl "https://api.vaidyalink.com/api/v1/patients?id=1' OR '1'='1"
```

3. **Test XSS protection**:

```bash
# Should be blocked by WAF
curl -X POST https://api.vaidyalink.com/api/v1/scans \
  -d '{"name":"<script>alert(1)</script>"}'
```

## Troubleshooting

### Issue: Legitimate traffic being blocked

**Solution**: Review CloudWatch Logs to identify the blocking rule, then:

1. Check sampled requests in WAF console
2. Identify the specific rule causing blocks
3. Add exclusions to the rule:

```typescript
rules.push({
  name: 'AWSManagedRulesCommonRuleSet',
  statement: {
    managedRuleGroupStatement: {
      vendorName: 'AWS',
      name: 'AWSManagedRulesCommonRuleSet',
      excludedRules: [
        { name: 'SizeRestrictions_BODY' }, // Example exclusion
      ],
    },
  },
});
```

### Issue: Rate limit too restrictive

**Solution**: Increase the rate limit:

```typescript
new WafConstruct(stack, 'Waf', {
  rateLimit: 5000, // Increased from 2000
});
```

### Issue: High WAF costs

**Solution**:

1. Disable managed rules in non-production environments
2. Reduce sampling rate
3. Use CloudFront caching to reduce requests reaching WAF

## Security Best Practices

1. **Always enable WAF in production**: Never deploy public APIs without WAF protection
2. **Monitor blocked requests**: Set up alerts for unusual blocking patterns
3. **Regular rule updates**: AWS managed rules are automatically updated
4. **Test before deploying**: Use staging environment to test rule changes
5. **Document exclusions**: Keep track of any rules you exclude and why
6. **Enable logging**: Essential for security incident investigation
7. **Review metrics weekly**: Identify trends and potential threats

## Compliance

### HIPAA Compliance

WAF helps meet HIPAA requirements by:

- Protecting against unauthorized access attempts
- Logging all blocked requests for audit trails
- Preventing common attack vectors

### ABDM Compliance

WAF supports ABDM security requirements by:

- Rate limiting to prevent abuse
- Blocking malicious traffic
- Providing audit logs for security events

## References

- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [AWS Managed Rules](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups.html)
- [WAF Best Practices](https://docs.aws.amazon.com/waf/latest/developerguide/waf-chapter.html)
- [Rate-Based Rules](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html)
