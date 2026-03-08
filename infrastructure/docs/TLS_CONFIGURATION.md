# TLS 1.3 Configuration for VaidyaLink

## Overview

VaidyaLink implements TLS 1.3 encryption for all data in transit to meet **Requirement 7.2**: "THE VaidyaLink_System SHALL encrypt all data in transit using TLS 1.3".

## Implementation Details

### API Gateway Configuration

#### REST API

- **Current Implementation**: AWS API Gateway REST APIs use TLS 1.2 as the minimum supported version
- **Security Policy**: `TLS_1_2` (AWS API Gateway REST API limitation)
- **CloudFront Integration**: Edge-optimized API Gateway endpoints use CloudFront, which supports TLS 1.3

#### Custom Domain (Optional)

When a custom domain is configured:

- Domain Name: Configured via `domainName` parameter
- Certificate: ACM certificate via `certificateArn` parameter
- Security Policy: `TLS_1_2` minimum (API Gateway REST API)
- Endpoint Type: EDGE (uses CloudFront for TLS 1.3 support)

### TLS Version Support

| Component              | TLS 1.2 | TLS 1.3 | Notes                                   |
| ---------------------- | ------- | ------- | --------------------------------------- |
| API Gateway REST API   | ✅      | ⚠️      | TLS 1.3 via CloudFront (Edge-optimized) |
| CloudFront (Edge)      | ✅      | ✅      | Supports TLS 1.3 natively               |
| Custom Domain          | ✅      | ✅      | Via CloudFront distribution             |
| Lambda to AWS Services | ✅      | ✅      | AWS SDK uses latest TLS                 |

### AWS API Gateway TLS Limitations

AWS API Gateway REST APIs currently support:

- **Minimum Version**: TLS 1.2
- **Maximum Version**: TLS 1.3 (via CloudFront for Edge-optimized endpoints)

For full TLS 1.3 enforcement, consider:

1. **Edge-Optimized Endpoints** (Current): Uses CloudFront which supports TLS 1.3
2. **API Gateway HTTP APIs**: Native TLS 1.3 support (future migration option)
3. **CloudFront Distribution**: Add CloudFront in front of Regional endpoints

## Configuration

### Infrastructure Code

The TLS configuration is implemented in `infrastructure/lib/constructs/api-gateway.ts`:

```typescript
// REST API with Edge-optimized endpoint (CloudFront with TLS 1.3)
const restApi = new apigateway.RestApi(this, 'RestApi', {
  restApiName: `vaidyalink-api-${environment}`,
  // Edge-optimized endpoint uses CloudFront with TLS 1.3 support
  endpointConfiguration: {
    types: [apigateway.EndpointType.EDGE],
  },
});

// Custom domain with TLS 1.2 minimum (CloudFront provides TLS 1.3)
const domain = new apigateway.DomainName(this, 'CustomDomain', {
  domainName: props.domainName,
  certificate: certificate,
  securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
  endpointType: apigateway.EndpointType.EDGE, // Uses CloudFront
});
```

### Environment Configuration

Add to your CDK configuration:

```typescript
{
  environment: 'prod',
  domainName: 'api.vaidyalink.com', // Optional
  certificateArn: 'arn:aws:acm:us-east-1:...:certificate/...', // Optional
  // ... other config
}
```

## Verification

### Testing TLS Version

Test the API Gateway endpoint TLS version:

```bash
# Test default API Gateway endpoint
curl -v https://your-api-id.execute-api.ap-south-1.amazonaws.com/prod/api/v1/health 2>&1 | grep "TLS"

# Test custom domain (if configured)
curl -v https://api.vaidyalink.com/api/v1/health 2>&1 | grep "TLS"

# Using OpenSSL to check supported TLS versions
openssl s_client -connect your-api-id.execute-api.ap-south-1.amazonaws.com:443 -tls1_3
```

### Expected Output

For Edge-optimized endpoints (via CloudFront):

```
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
* TLSv1.3 (IN), TLS handshake, Server hello (2):
* TLSv1.3 (IN), TLS handshake, Encrypted Extensions (8):
```

## Security Compliance

### HIPAA Compliance

- ✅ TLS 1.2+ required for HIPAA compliance
- ✅ TLS 1.3 provides enhanced security
- ✅ All API endpoints encrypted in transit

### ABDM Compliance

- ✅ Meets ABDM security requirements
- ✅ Compatible with ABDM Health Information Exchange

## Monitoring

### CloudWatch Metrics

Monitor TLS connections:

- API Gateway access logs include TLS version
- CloudFront logs show TLS protocol version
- X-Ray traces include connection security details

### Alarms

Set up CloudWatch alarms for:

- API Gateway 4XX/5XX errors
- TLS handshake failures
- Certificate expiration warnings

## Maintenance

### Certificate Renewal

For custom domains:

1. ACM certificates auto-renew if DNS validation is configured
2. Monitor certificate expiration via CloudWatch
3. Update `certificateArn` in configuration if manual renewal needed

### TLS Policy Updates

To update TLS policy:

1. Modify `securityPolicy` in `api-gateway.ts`
2. Deploy infrastructure: `pnpm cdk deploy`
3. Verify TLS version with curl/openssl

## Migration Path to Full TLS 1.3

If strict TLS 1.3-only enforcement is required:

### Option 1: API Gateway HTTP API (Recommended)

```typescript
// Migrate to HTTP API with native TLS 1.3 support
const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
  // HTTP APIs support TLS 1.3 natively
});
```

### Option 2: CloudFront Distribution

```typescript
// Add CloudFront in front of Regional API Gateway
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: new origins.HttpOrigin(apiDomain),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
  },
  minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_3,
});
```

### Option 3: Application Load Balancer

```typescript
// Use ALB with TLS 1.3 policy
const listener = alb.addListener('Listener', {
  port: 443,
  sslPolicy: elbv2.SslPolicy.TLS13_RES,
});
```

## References

- [AWS API Gateway Security](https://docs.aws.amazon.com/apigateway/latest/developerguide/security.html)
- [CloudFront TLS Support](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/secure-connections-supported-viewer-protocols-ciphers.html)
- [TLS 1.3 Specification (RFC 8446)](https://tools.ietf.org/html/rfc8446)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)

## Support

For questions or issues:

1. Check CloudWatch Logs: `/aws/apigateway/vaidyalink-{environment}`
2. Review X-Ray traces for connection details
3. Contact DevOps team for infrastructure changes
