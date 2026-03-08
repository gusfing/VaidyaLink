# CloudTrail Quick Start Guide

## What is CloudTrail?

CloudTrail is AWS's audit logging service that records all API calls and data access events in your VaidyaLink infrastructure. It's essential for HIPAA compliance and security monitoring.

## Quick Setup

### 1. Deploy CloudTrail (Already Configured)

CloudTrail is automatically deployed when you deploy the VaidyaLink stack:

```bash
cd infrastructure
npm run deploy
```

### 2. Verify CloudTrail is Active

```bash
# Check trail status
aws cloudtrail get-trail-status --name vaidyalink-dev-trail

# Expected output:
# {
#   "IsLogging": true,
#   "LatestDeliveryTime": "2024-01-15T10:30:00Z",
#   "LatestDigestDeliveryTime": "2024-01-15T10:30:00Z"
# }
```

### 3. View Recent Events

```bash
# View last 10 events
aws cloudtrail lookup-events --max-results 10

# View S3 access events
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=GetObject \
  --max-results 20
```

### 4. Query Logs in CloudWatch

1. Go to CloudWatch Console
2. Navigate to "Logs Insights"
3. Select log group: `/aws/cloudtrail/vaidyalink-dev`
4. Run a query:

```sql
fields @timestamp, eventName, userIdentity.principalId, sourceIPAddress
| sort @timestamp desc
| limit 20
```

## Common Use Cases

### Find Who Accessed a Patient's Record

```sql
fields @timestamp, userIdentity.principalId, requestParameters.key
| filter eventName = "GetObject"
| filter requestParameters.key like /patient-123/
| sort @timestamp desc
```

### Find All Failed Login Attempts

```sql
fields @timestamp, userIdentity.principalId, errorCode, errorMessage
| filter eventSource = "cognito-idp.amazonaws.com"
| filter errorCode exists
| sort @timestamp desc
```

### Find All Data Deletions

```sql
fields @timestamp, userIdentity.principalId, eventName, requestParameters
| filter eventName = "DeleteObject"
| sort @timestamp desc
```

### Find All KMS Key Usage

```sql
fields @timestamp, userIdentity.principalId, eventName, requestParameters.keyId
| filter eventSource = "kms.amazonaws.com"
| sort @timestamp desc
```

## What Gets Logged?

✅ **All API Calls**: Every AWS service interaction
✅ **S3 Access**: All document uploads/downloads/deletions
✅ **Lambda Invocations**: All function executions
✅ **IAM Changes**: User/role/policy modifications
✅ **KMS Operations**: Encryption key usage
✅ **Cognito Events**: User authentication activities

## Storage & Retention

- **S3 Bucket**: `vaidyalink-audit-logs-{env}-{account}`
- **CloudWatch Logs**: `/aws/cloudtrail/vaidyalink-{env}`
- **Retention**: 7 years (HIPAA compliant)
- **Encryption**: KMS customer-managed keys

## Cost Estimate

For a typical VaidyaLink deployment with 1000 scans/day:

- **CloudTrail**: ~$2/month
- **S3 Storage**: ~$0.50/month (with lifecycle policies)
- **CloudWatch Logs**: ~$3/month

**Total: ~$5.50/month**

## Troubleshooting

### No logs appearing?

```bash
# Check if trail is logging
aws cloudtrail get-trail-status --name vaidyalink-dev-trail

# If IsLogging is false, start logging
aws cloudtrail start-logging --name vaidyalink-dev-trail
```

### Can't access S3 bucket?

Check your IAM permissions. You need:

- `s3:GetObject` on `arn:aws:s3:::vaidyalink-audit-logs-*/*`
- `s3:ListBucket` on `arn:aws:s3:::vaidyalink-audit-logs-*`

### CloudWatch Logs not showing?

Verify the CloudWatch Logs role has permissions:

```bash
aws iam get-role --role-name CloudTrailRole
```

## Next Steps

- [Full CloudTrail Setup Guide](./CLOUDTRAIL_SETUP.md)
- [HIPAA Compliance Documentation](./HIPAA_COMPLIANCE.md)
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md)

## Support

For issues or questions:

1. Check CloudTrail status: `aws cloudtrail get-trail-status`
2. Review CloudWatch Logs: `/aws/cloudtrail/vaidyalink-{env}`
3. Contact DevOps team
