# TLS 1.3 Quick Start Guide

## Overview

VaidyaLink implements TLS encryption for all API endpoints to meet **Requirement 7.2**: "THE VaidyaLink_System SHALL encrypt all data in transit using TLS 1.3".

## Quick Setup

### 1. Default Configuration (No Custom Domain)

The API Gateway is configured by default to use edge-optimized endpoints, which leverage CloudFront for TLS 1.3 support:

```typescript
// No additional configuration needed
// TLS 1.3 is automatically enabled via CloudFront
```

Your API will be available at:

```
https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/
```

### 2. Custom Domain Configuration (Optional)

To use a custom domain with TLS 1.3:

#### Step 1: Request ACM Certificate

```bash
# Request a certificate in ACM (must be in us-east-1 for edge-optimized endpoints)
aws acm request-certificate \
  --domain-name api.vaidyalink.com \
  --validation-method DNS \
  --region us-east-1
```

#### Step 2: Validate Certificate

Add the DNS validation records to your domain's DNS configuration.

#### Step 3: Update CDK Configuration

Add to your `cdk.json` or configuration file:

```json
{
  "domainName": "api.vaidyalink.com",
  "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/abc123..."
}
```

#### Step 4: Deploy

```bash
cd infrastructure
pnpm cdk deploy
```

#### Step 5: Configure DNS

Add a CNAME record pointing to the CloudFront distribution:

```
api.vaidyalink.com CNAME d1234567890.cloudfront.net
```

## Verification

### Test TLS Version

```bash
# Test with curl
curl -v https://api.vaidyalink.com/api/v1/health 2>&1 | grep "TLS"

# Expected output:
# * TLSv1.3 (OUT), TLS handshake, Client hello (1):
# * TLSv1.3 (IN), TLS handshake, Server hello (2):
```

### Test with OpenSSL

```bash
# Test TLS 1.3 support
openssl s_client -connect api.vaidyalink.com:443 -tls1_3

# Should show:
# Protocol  : TLSv1.3
# Cipher    : TLS_AES_128_GCM_SHA256
```

### Test with nmap

```bash
# Scan for supported TLS versions
nmap --script ssl-enum-ciphers -p 443 api.vaidyalink.com
```

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ TLS 1.3
       ▼
┌─────────────┐
│ CloudFront  │ ◄── Edge-optimized endpoint
│  (TLS 1.3)  │     Supports TLS 1.3 natively
└──────┬──────┘
       │ TLS 1.2+
       ▼
┌─────────────┐
│ API Gateway │
│   REST API  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Lambda    │
│  Functions  │
└─────────────┘
```

## Security Features

### Enabled by Default

- ✅ TLS 1.3 via CloudFront (edge-optimized endpoints)
- ✅ X-Ray tracing for security monitoring
- ✅ CloudWatch access logs for audit trail
- ✅ Request validation
- ✅ Rate limiting (1000 req/min, burst 200)
- ✅ Cognito authentication
- ✅ CORS configuration

### Cipher Suites (TLS 1.3)

CloudFront supports these TLS 1.3 cipher suites:

- TLS_AES_128_GCM_SHA256
- TLS_AES_256_GCM_SHA384
- TLS_CHACHA20_POLY1305_SHA256

## Monitoring

### CloudWatch Metrics

Monitor TLS connections:

```bash
# View API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=vaidyalink-api-prod \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### Access Logs

View TLS version in access logs:

```bash
# View API Gateway access logs
aws logs tail /aws/apigateway/vaidyalink-prod --follow
```

## Troubleshooting

### Issue: Certificate Not Found

**Error**: `Certificate not found`

**Solution**: Ensure the certificate is in `us-east-1` region for edge-optimized endpoints.

```bash
# List certificates in us-east-1
aws acm list-certificates --region us-east-1
```

### Issue: DNS Not Resolving

**Error**: `Could not resolve host`

**Solution**: Verify CNAME record is configured correctly.

```bash
# Check DNS resolution
dig api.vaidyalink.com

# Should show CNAME pointing to CloudFront
```

### Issue: TLS Handshake Failure

**Error**: `SSL handshake failed`

**Solution**: Check client TLS version support.

```bash
# Test with specific TLS version
curl --tlsv1.3 https://api.vaidyalink.com/api/v1/health
```

## Compliance

### HIPAA

- ✅ TLS 1.2+ required (TLS 1.3 exceeds requirement)
- ✅ Encryption in transit for all PHI data
- ✅ Audit logging enabled

### ABDM

- ✅ Meets ABDM security requirements
- ✅ Compatible with ABDM Health Information Exchange

## Next Steps

1. **Enable WAF**: Add AWS WAF for additional security
2. **Custom Cipher Suites**: Configure specific cipher suites if needed
3. **Certificate Rotation**: Set up automated certificate renewal
4. **Monitoring Alerts**: Configure CloudWatch alarms for TLS errors

## References

- [AWS API Gateway Security](https://docs.aws.amazon.com/apigateway/latest/developerguide/security.html)
- [CloudFront TLS Support](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/secure-connections-supported-viewer-protocols-ciphers.html)
- [TLS 1.3 Specification](https://tools.ietf.org/html/rfc8446)

## Support

For issues or questions:

- Check CloudWatch Logs: `/aws/apigateway/vaidyalink-{environment}`
- Review X-Ray traces for connection details
- Contact DevOps team for infrastructure support
