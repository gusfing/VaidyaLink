# Domain and SSL Certificate Setup Guide

This guide provides step-by-step instructions for configuring custom domains and SSL certificates for VaidyaLink.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Domain Architecture](#domain-architecture)
- [Route53 Setup](#route53-setup)
- [SSL Certificate Setup](#ssl-certificate-setup)
- [Frontend Domain Configuration](#frontend-domain-configuration)
- [API Gateway Custom Domain](#api-gateway-custom-domain)
- [DNS Verification](#dns-verification)
- [Troubleshooting](#troubleshooting)

## Overview

VaidyaLink uses custom domains for both frontend and API endpoints:

### Staging Environment

- **Frontend**: `staging.vaidyalink.com`
- **API**: `api.staging.vaidyalink.com`
- **WebSocket**: `ws.staging.vaidyalink.com`

### Production Environment

- **Frontend**: `vaidyalink.com` and `www.vaidyalink.com`
- **API**: `api.vaidyalink.com`
- **WebSocket**: `ws.vaidyalink.com`

## Prerequisites

### Domain Registration

1. **Register domain** (if not already registered):
   - Recommended registrars: AWS Route53, Namecheap, GoDaddy
   - Domain: `vaidyalink.com` (or your chosen domain)

2. **Access to domain registrar**:
   - Ability to update nameservers
   - Access to DNS management

### AWS Services

- AWS Route53 (DNS management)
- AWS Certificate Manager (SSL certificates)
- AWS CloudFront (frontend CDN)
- AWS API Gateway (backend API)

### Tools

- AWS CLI configured
- jq (JSON processor)
- Access to domain registrar account

## Domain Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Domain: vaidyalink.com                    │
│
─────────────────────────────────┘ │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │  www.vaidyalink.com (CNAME)                  │ │    │
│  │  │  → vaidyalink.com                            │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │  api.vaidyalink.com (CNAME)                  │ │    │
│  │  │  → API Gateway Custom Domain                 │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────────────┐ │    │
│  │  │  ws.vaidyalink.com (CNAME)                   │ │    │
│  │  │  → API Gateway WebSocket                     │ │    │
│  │  └──────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Route53 Setup

### Option 1: Automated Setup (Recommended)

Use the provided setup script:

```bash
cd infrastructure

# For staging
./scripts/setup-domain.sh staging

# For production
./scripts/setup-domain.sh prod
```

The script will:

1. Create Route53 hosted zone
2. Display nameservers to configure
3. Request SSL certificates
4. Create DNS validation records
5. Wait for certificate validation

### Option 2: Manual Setup

#### Step 1: Create Hosted Zone

```bash
# Create hosted zone
aws route53 create-hosted-zone \
  --name vaidyalink.com \
  --caller-reference "vaidyalink-$(date +%s)" \
  --hosted-zone-config Comment="VaidyaLink production"

# Get hosted zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name vaidyalink.com \
  --query "HostedZones[0].Id" \
  --output text | cut -d'/' -f3)

echo "Hosted Zone ID: $HOSTED_ZONE_ID"
```

#### Step 2: Get Nameservers

```bash
# Get nameservers
aws route53 get-hosted-zone \
  --id $HOSTED_ZONE_ID \
  --query 'DelegationSet.NameServers' \
  --output table
```

Output example:

```
---------------------------------
|        NameServers            |
+-------------------------------+
|  ns-1234.awsdns-12.org        |
|  ns-5678.awsdns-34.com        |
|  ns-9012.awsdns-56.net        |
|  ns-3456.awsdns-78.co.uk      |
+-------------------------------+
```

#### Step 3: Update Domain Registrar

1. Log in to your domain registrar (e.g., Namecheap, GoDaddy)
2. Navigate to domain management
3. Find "Nameservers" or "DNS Settings"
4. Select "Custom Nameservers"
5. Enter the 4 nameservers from above
6. Save changes

⏱️ **DNS propagation can take up to 48 hours**

#### Step 4: Verify Nameserver Update

```bash
# Check nameservers (may take time to propagate)
dig NS vaidyalink.com +short

# Or use nslookup
nslookup -type=NS vaidyalink.com
```

## SSL Certificate Setup

### Certificate Requirements

VaidyaLink needs two types of certificates:

1. **CloudFront Certificate** (us-east-1 region):
   - For frontend (CloudFront/Vercel)
   - Must be in us-east-1 region
   - Covers: `vaidyalink.com`, `www.vaidyalink.com`

2. **Regional Certificate** (ap-south-1 region):
   - For API Gateway
   - Must be in same region as API Gateway
   - Covers: `api.vaidyalink.com`, `ws.vaidyalink.com`

### Automated Certificate Request

The setup script handles this automatically. If running manually:

#### CloudFront Certificate (us-east-1)

```bash
# Request certificate
CERT_ARN=$(aws acm request-certificate \
  --domain-name vaidyalink.com \
  --subject-alternative-names vaidyalink.com www.vaidyalink.com \
  --validation-method DNS \
  --region us-east-1 \
  --query 'CertificateArn' \
  --output text)

echo "Certificate ARN: $CERT_ARN"

# Wait for validation records
sleep 10

# Get validation records
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[].ResourceRecord'
```

#### Create DNS Validation Records

```bash
# Get validation record details
VALIDATION_NAME=$(aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Name' \
  --output text)

VALIDATION_VALUE=$(aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Value' \
  --output text)

# Create validation record in Route53
cat > change-batch.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "$VALIDATION_NAME",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "$VALIDATION_VALUE"}]
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://change-batch.json

# Wait for validation (can take 5-30 minutes)
aws acm wait certificate-validated \
  --certificate-arn $CERT_ARN \
  --region us-east-1

echo "✅ Certificate validated!"
```

#### Regional Certificate (ap-south-1)

```bash
# Request regional certificate for API Gateway
API_CERT_ARN=$(aws acm request-certificate \
  --domain-name api.vaidyalink.com \
  --subject-alternative-names api.vaidyalink.com ws.vaidyalink.com \
  --validation-method DNS \
  --region ap-south-1 \
  --query 'CertificateArn' \
  --output text)

# Repeat validation process for regional certificate
# (similar to CloudFront certificate above)
```

## Frontend Domain Configuration

### Vercel Configuration

1. **Add domain in Vercel dashboard**:
   - Go to Project Settings → Domains
   - Add `vaidyalink.com` and `www.vaidyalink.com`
   - Vercel will provide DNS records

2. **Create DNS records in Route53**:

```bash
# Get Vercel's CNAME target from dashboard
VERCEL_CNAME="cname.vercel-dns.com"

# Create A record for apex domain (using Vercel's IP)
cat > apex-record.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "vaidyalink.com",
      "Type": "A",
      "TTL": 300,
      "ResourceRecords": [{"Value": "76.76.21.21"}]
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://apex-record.json

# Create CNAME for www subdomain
cat > www-record.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "www.vaidyalink.com",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "$VERCEL_CNAME"}]
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://www-record.json
```

3. **Configure SSL in Vercel**:
   - Vercel automatically provisions SSL certificates
   - Or upload your ACM certificate (export from ACM)

### Alternative: CloudFront + S3

If using CloudFront instead of Vercel:

```bash
# Create CloudFront distribution (via CDK or console)
# Then create alias record

cat > cloudfront-alias.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "vaidyalink.com",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z2FDTNDATAQYW2",
        "DNSName": "d1234567890.cloudfront.net",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://cloudfront-alias.json
```

## API Gateway Custom Domain

### Step 1: Create Custom Domain in API Gateway

```bash
# Create custom domain
aws apigateway create-domain-name \
  --domain-name api.vaidyalink.com \
  --regional-certificate-arn $API_CERT_ARN \
  --endpoint-configuration types=REGIONAL \
  --region ap-south-1

# Get the regional domain name
REGIONAL_DOMAIN=$(aws apigateway get-domain-name \
  --domain-name api.vaidyalink.com \
  --region ap-south-1 \
  --query 'regionalDomainName' \
  --output text)

echo "Regional Domain: $REGIONAL_DOMAIN"
```

### Step 2: Create Base Path Mapping

```bash
# Get API Gateway ID
API_ID=$(aws apigateway get-rest-apis \
  --query "items[?name=='VaidyaLink-API'].id" \
  --output text)

# Create base path mapping
aws apigateway create-base-path-mapping \
  --domain-name api.vaidyalink.com \
  --rest-api-id $API_ID \
  --stage prod \
  --region ap-south-1
```

### Step 3: Create DNS Record

```bash
# Create CNAME record pointing to API Gateway
cat > api-record.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "api.vaidyalink.com",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "$REGIONAL_DOMAIN"}]
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://api-record.json
```

### WebSocket Custom Domain

```bash
# Create WebSocket custom domain
aws apigatewayv2 create-domain-name \
  --domain-name ws.vaidyalink.com \
  --domain-name-configurations CertificateArn=$API_CERT_ARN \
  --region ap-south-1

# Get WebSocket API ID
WS_API_ID=$(aws apigatewayv2 get-apis \
  --query "Items[?Name=='VaidyaLink-WebSocket'].ApiId" \
  --output text)

# Create API mapping
aws apigatewayv2 create-api-mapping \
  --domain-name ws.vaidyalink.com \
  --api-id $WS_API_ID \
  --stage prod \
  --region ap-south-1

# Get WebSocket domain name
WS_DOMAIN=$(aws apigatewayv2 get-domain-name \
  --domain-name ws.vaidyalink.com \
  --region ap-south-1 \
  --query 'DomainNameConfigurations[0].ApiGatewayDomainName' \
  --output text)

# Create DNS record
cat > ws-record.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "ws.vaidyalink.com",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "$WS_DOMAIN"}]
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://ws-record.json
```

## DNS Verification

### Check DNS Propagation

```bash
# Check A record
dig vaidyalink.com +short

# Check CNAME records
dig www.vaidyalink.com +short
dig api.vaidyalink.com +short
dig ws.vaidyalink.com +short

# Check from multiple locations
dig @8.8.8.8 vaidyalink.com +short  # Google DNS
dig @1.1.1.1 vaidyalink.com +short  # Cloudflare DNS
```

### Online DNS Checkers

- https://dnschecker.org
- https://www.whatsmydns.net
- https://mxtoolbox.com/SuperTool.aspx

### Test HTTPS Access

```bash
# Test frontend
curl -I https://vaidyalink.com
curl -I https://www.vaidyalink.com

# Test API
curl https://api.vaidyalink.com/health

# Test WebSocket (requires wscat)
npm install -g wscat
wscat -c wss://ws.vaidyalink.com
```

### Verify SSL Certificate

```bash
# Check certificate details
openssl s_client -connect vaidyalink.com:443 -servername vaidyalink.com < /dev/null

# Check certificate expiration
echo | openssl s_client -connect vaidyalink.com:443 -servername vaidyalink.com 2>/dev/null | openssl x509 -noout -dates
```

## Troubleshooting

### DNS Not Resolving

**Issue**: Domain doesn't resolve after updating nameservers

**Solutions**:

1. Wait for DNS propagation (up to 48 hours)
2. Verify nameservers at registrar match Route53
3. Clear local DNS cache:

   ```bash
   # Windows
   ipconfig /flushdns

   # macOS
   sudo dscacheutil -flushcache

   # Linux
   sudo systemd-resolve --flush-caches
   ```

### Certificate Validation Stuck

**Issue**: ACM certificate stuck in "Pending validation"

**Solutions**:

1. Verify DNS validation records exist in Route53
2. Check validation record values match exactly
3. Wait up to 30 minutes for validation
4. If stuck, delete and recreate certificate

### SSL Certificate Mismatch

**Issue**: Browser shows SSL error or wrong certificate

**Solutions**:

1. Verify certificate covers the domain (check SANs)
2. Ensure CloudFront uses us-east-1 certificate
3. Ensure API Gateway uses regional certificate
4. Clear browser cache and retry

### API Gateway 403 Forbidden

**Issue**: Custom domain returns 403 error

**Solutions**:

1. Verify base path mapping exists
2. Check API Gateway stage is deployed
3. Verify certificate is validated and attached
4. Check API Gateway resource policies

### Vercel Domain Not Verifying

**Issue**: Vercel shows "Domain not verified"

**Solutions**:

1. Verify DNS records match Vercel's requirements
2. Wait for DNS propagation
3. Use Vercel's DNS checker tool
4. Try removing and re-adding domain

## Certificate Renewal

### ACM Auto-Renewal

AWS Certificate Manager automatically renews certificates:

- Renewal attempted 60 days before expiration
- DNS validation records must remain in place
- Email notifications sent if renewal fails

### Monitor Certificate Expiration

```bash
# Create CloudWatch alarm for certificate expiration
aws cloudwatch put-metric-alarm \
  --alarm-name vaidyalink-cert-expiration \
  --alarm-description "Alert when SSL certificate expires soon" \
  --metric-name DaysToExpiry \
  --namespace AWS/CertificateManager \
  --statistic Minimum \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 30 \
  --comparison-operator LessThanThreshold \
  --dimensions Name=CertificateArn,Value=$CERT_ARN
```

## Security Best Practices

### DNS Security

- ✅ Enable DNSSEC in Route53
- ✅ Use Route53 health checks
- ✅ Implement CAA records
- ✅ Monitor DNS query logs

### SSL/TLS Security

- ✅ Use TLS 1.2 or higher only
- ✅ Enable HSTS headers
- ✅ Implement certificate pinning (mobile apps)
- ✅ Monitor certificate transparency logs

### Example: Add CAA Record

```bash
# Add CAA record to restrict certificate issuance
cat > caa-record.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "vaidyalink.com",
      "Type": "CAA",
      "TTL": 300,
      "ResourceRecords": [
        {"Value": "0 issue \"amazon.com\""},
        {"Value": "0 issuewild \"amazon.com\""}
      ]
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://caa-record.json
```

## Cost Considerations

### Route53 Costs

- Hosted zone: $0.50/month per zone
- DNS queries: $0.40 per million queries (first billion)
- Health checks: $0.50/month per health check

### ACM Costs

- Public SSL certificates: **FREE**
- Private certificates: $400/month per CA

### Estimated Monthly Cost

- Route53 hosted zone: $0.50
- DNS queries (1M/month): $0.40
- ACM certificates: $0.00
- **Total**: ~$1/month

## Next Steps

After domain and SSL setup:

1. ✅ Update frontend environment variables with custom domain
2. ✅ Update API Gateway endpoints in frontend
3. ✅ Configure CORS for custom domain
4. ✅ Test all endpoints with HTTPS
5. ✅ Set up monitoring for SSL expiration
6. ✅ Configure CDN caching rules
7. ✅ Implement security headers

## Support

For domain and SSL issues:

- **AWS Support**: Open support case
- **Slack**: #vaidyalink-infrastructure
- **Email**: devops@vaidyalink.com

## Additional Resources

- [Route53 Documentation](https://docs.aws.amazon.com/route53/)
- [ACM Documentation](https://docs.aws.amazon.com/acm/)
- [API Gateway Custom Domains](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains.html)
- [Vercel Custom Domains](https://vercel.com/docs/concepts/projects/custom-domains)
