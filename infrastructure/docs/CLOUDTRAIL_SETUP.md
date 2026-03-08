# CloudTrail Audit Logging Setup

## Overview

CloudTrail provides comprehensive audit logging for VaidyaLink to meet HIPAA compliance requirements. It logs all API calls, data access events, and security-related activities across the platform.

## Features

### 1. Comprehensive Logging

- **Management Events**: All AWS API calls (create, update, delete operations)
- **Data Events**: S3 object access and Lambda function invocations
- **Global Service Events**: IAM, CloudFront, and other global service activities
- **Multi-Region Trail**: Captures events from all AWS regions

### 2. Security & Compliance

- **Encryption at Rest**: All logs encrypted using AWS KMS customer-managed keys
- **Encryption in Transit**: TLS 1.3 for all data transfers
- **Log File Validation**: Cryptographic integrity checking enabled
- **7-Year Retention**: Meets HIPAA audit log retention requirements
- **Immutable Logs**: S3 versioning enabled to prevent tampering

### 3. Storage Optimization

- **Lifecycle Management**:
  - Day 0-90: Standard storage
  - Day 90-365: Infrequent Access (IA) storage
  - Day 365+: Glacier storage
  - Day 2555: Automatic deletion (7 years)

### 4. Real-Time Monitoring

- **CloudWatch Logs Integration**: Real-time log streaming
- **10-Year CloudWatch Retention**: Extended retention for critical audit events
- **Queryable Logs**: Use CloudWatch Insights for log analysis

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AWS Services                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │    S3    │  │  Lambda  │  │ DynamoDB │  │ Cognito  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    CloudTrail                                │
│  - Management Events (All API calls)                        │
│  - Data Events (S3 + Lambda)                                │
│  - Log File Validation                                      │
└─────────────────────────────────────────────────────────────┘
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
┌──────────────────────┐  ┌──────────────────────┐
│   S3 Audit Bucket    │  │  CloudWatch Logs     │
│  - KMS Encrypted     │  │  - KMS Encrypted     │
│  - 7-year retention  │  │  - 10-year retention │
│  - Versioned         │  │  - Real-time query   │
└──────────────────────┘  └──────────────────────┘
```

## What Gets Logged

### Management Events (All API Calls)

- IAM user/role actions
- Resource creation/modification/deletion
- Security group changes
- KMS key operations
- Cognito user pool modifications

### S3 Data Events

- `GetObject` - Document downloads
- `PutObject` - Document uploads
- `DeleteObject` - Document deletions
- Logged for: `vaidyalink-documents-{env}-{account}/*`

### Lambda Data Events

- Function invocations
- Execution results
- Logged for: `vaidyalink-{env}-*` functions

## Configuration

### CDK Integration

```typescript
import { CloudTrailConstruct } from './constructs/cloudtrail';

// In your stack
this.cloudTrail = new CloudTrailConstruct(this, 'CloudTrail', {
  environment: 'prod',
  encryptionKey: this.security.encryptionKey,
});
```

### Environment Variables

No environment variables required. CloudTrail is configured entirely through CDK.

## Accessing Audit Logs

### Via S3 Console

1. Navigate to S3 bucket: `vaidyalink-audit-logs-{env}-{account}`
2. Browse to: `AWSLogs/{account}/CloudTrail/{region}/{year}/{month}/{day}/`
3. Download and decompress `.gz` files

### Via CloudWatch Logs Insights

```sql
-- Find all S3 GetObject events for a specific patient
fields @timestamp, userIdentity.principalId, requestParameters.bucketName, requestParameters.key
| filter eventName = "GetObject"
| filter requestParameters.key like /patient-123/
| sort @timestamp desc
| limit 100

-- Find all Lambda invocations with errors
fields @timestamp, userIdentity.principalId, requestParameters.functionName, errorCode, errorMessage
| filter eventName = "Invoke" and errorCode exists
| sort @timestamp desc
| limit 50

-- Find all IAM policy changes
fields @timestamp, userIdentity.principalId, eventName, requestParameters
| filter eventSource = "iam.amazonaws.com"
| filter eventName like /Policy/
| sort @timestamp desc
```

### Via AWS CLI

```bash
# Search for events in the last hour
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=GetObject \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --max-results 50

# Get trail status
aws cloudtrail get-trail-status \
  --name vaidyalink-prod-trail

# Validate log file integrity
aws cloudtrail validate-logs \
  --trail-arn arn:aws:cloudtrail:us-east-1:123456789012:trail/vaidyalink-prod-trail \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-31T23:59:59Z
```

## HIPAA Compliance

### Audit Log Requirements

CloudTrail meets HIPAA Security Rule § 164.312(b) requirements:

✅ **Audit Controls**: Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use electronic protected health information.

### Specific Compliance Features

1. **Access Logging**: All PHI access logged (S3 GetObject events)
2. **Modification Tracking**: All data modifications logged (S3 PutObject, DeleteObject)
3. **User Attribution**: All actions tied to IAM principal
4. **Timestamp Accuracy**: AWS-managed NTP synchronization
5. **Log Integrity**: Cryptographic validation enabled
6. **Retention Period**: 7 years (exceeds 6-year HIPAA requirement)
7. **Encryption**: KMS encryption for logs at rest and in transit

## Monitoring & Alerts

### CloudWatch Alarms (Recommended)

Create alarms for suspicious activities:

```typescript
// Alarm for excessive failed API calls
new cloudwatch.Alarm(this, 'FailedApiCallsAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'CloudTrailMetrics',
    metricName: 'FailedApiCalls',
    statistic: 'Sum',
    period: cdk.Duration.minutes(5),
  }),
  threshold: 10,
  evaluationPeriods: 1,
});

// Alarm for unauthorized access attempts
new cloudwatch.Alarm(this, 'UnauthorizedAccessAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'CloudTrailMetrics',
    metricName: 'UnauthorizedAccessAttempts',
    statistic: 'Sum',
    period: cdk.Duration.minutes(5),
  }),
  threshold: 5,
  evaluationPeriods: 1,
});
```

### Metric Filters

Create CloudWatch metric filters for specific events:

```bash
# Filter for root account usage
aws logs put-metric-filter \
  --log-group-name /aws/cloudtrail/vaidyalink-prod \
  --filter-name RootAccountUsage \
  --filter-pattern '{ $.userIdentity.type = "Root" }' \
  --metric-transformations \
    metricName=RootAccountUsage,metricNamespace=CloudTrailMetrics,metricValue=1

# Filter for KMS key deletions
aws logs put-metric-filter \
  --log-group-name /aws/cloudtrail/vaidyalink-prod \
  --filter-name KMSKeyDeletion \
  --filter-pattern '{ $.eventName = "ScheduleKeyDeletion" }' \
  --metric-transformations \
    metricName=KMSKeyDeletion,metricNamespace=CloudTrailMetrics,metricValue=1
```

## Cost Optimization

### Estimated Costs (per month)

- **CloudTrail**: $2.00 per 100,000 management events
- **S3 Storage**:
  - Standard: $0.023/GB (first 90 days)
  - IA: $0.0125/GB (days 90-365)
  - Glacier: $0.004/GB (after 365 days)
- **CloudWatch Logs**: $0.50/GB ingested + $0.03/GB stored
- **Data Events**: $0.10 per 100,000 events

### Example Calculation (1000 scans/day)

```
Management Events: ~50,000/month = $1.00
S3 Data Events: ~60,000/month = $0.60
Lambda Data Events: ~30,000/month = $0.30
S3 Storage (10GB): $0.23
CloudWatch Logs (5GB): $2.50 + $0.15 = $2.65

Total: ~$4.78/month
```

## Troubleshooting

### CloudTrail Not Logging

```bash
# Check trail status
aws cloudtrail get-trail-status --name vaidyalink-prod-trail

# Verify trail configuration
aws cloudtrail describe-trails --trail-name-list vaidyalink-prod-trail

# Check S3 bucket policy
aws s3api get-bucket-policy --bucket vaidyalink-audit-logs-prod-123456789012
```

### Missing Data Events

Verify event selectors are configured:

```bash
aws cloudtrail get-event-selectors --trail-name vaidyalink-prod-trail
```

### CloudWatch Logs Not Appearing

Check IAM role permissions:

```bash
aws iam get-role --role-name CloudTrailRole
aws iam list-attached-role-policies --role-name CloudTrailRole
```

## Best Practices

1. **Enable Log File Validation**: Always verify log integrity
2. **Use Separate Audit Account**: Store logs in dedicated AWS account
3. **Restrict Bucket Access**: Only security team should access audit logs
4. **Regular Reviews**: Audit logs should be reviewed monthly
5. **Automated Alerts**: Set up CloudWatch alarms for suspicious activities
6. **Backup Logs**: Consider cross-region replication for disaster recovery
7. **Test Restoration**: Periodically test log retrieval and analysis

## Security Considerations

### Bucket Access Control

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUnencryptedObjectUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::vaidyalink-audit-logs-*/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "aws:kms"
        }
      }
    },
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::vaidyalink-audit-logs-*",
        "arn:aws:s3:::vaidyalink-audit-logs-*/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

### KMS Key Policy

Ensure CloudTrail has permissions to use KMS key:

```json
{
  "Sid": "Allow CloudTrail to encrypt logs",
  "Effect": "Allow",
  "Principal": {
    "Service": "cloudtrail.amazonaws.com"
  },
  "Action": ["kms:GenerateDataKey", "kms:Decrypt"],
  "Resource": "*",
  "Condition": {
    "StringLike": {
      "kms:EncryptionContext:aws:cloudtrail:arn": "arn:aws:cloudtrail:*:123456789012:trail/*"
    }
  }
}
```

## References

- [AWS CloudTrail Documentation](https://docs.aws.amazon.com/cloudtrail/)
- [HIPAA Security Rule § 164.312(b)](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
- [CloudTrail Log File Validation](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html)
- [CloudWatch Logs Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
