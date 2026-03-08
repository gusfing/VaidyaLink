# VaidyaLink Backup Monitoring Lambda Functions

## Overview

This package contains Lambda functions for automated backup verification and restore testing in the VaidyaLink system.

## Functions

### 1. Verify Backups (`verify-backups.ts`)

Runs daily to verify backup health and completeness.

**Features**:

- Checks for recent backups (last 24 hours)
- Validates recovery point availability
- Detects failed backup jobs
- Verifies backup coverage for all resource types
- Publishes custom CloudWatch metrics
- Sends alerts for issues

**Triggers**: CloudWatch Events (daily at 6:00 AM UTC)

**Environment Variables**:

- `BACKUP_VAULT_NAME` - Name of the backup vault
- `ALARM_TOPIC_ARN` - SNS topic for alerts
- `ENVIRONMENT` - Environment name (dev/staging/prod)
- `AWS_REGION` - AWS region

**Metrics Published**:

- `TotalRecoveryPoints` - Total backups available
- `RecentBackups` - Backups created in last 24 hours
- `FailedBackups` - Failed backups in last 7 days
- `BackupHealthStatus` - Overall health score (0-1)

**Status Levels**:

- `HEALTHY` - All checks pass
- `WARNING` - Some issues detected (old backups, failed jobs)
- `CRITICAL` - Critical issues (no backups, no recent backups)

### 2. Test Restore (`test-restore.ts`)

Performs monthly restore tests to verify backup integrity.

**Features**:

- Selects recent recovery point
- Performs test restore to temporary resource
- Validates data integrity
- Measures restore performance
- Cleans up test resources
- Sends test results notification

**Triggers**: CloudWatch Events (monthly on 1st at 2:00 AM UTC)

**Environment Variables**:

- `BACKUP_VAULT_NAME` - Name of the backup vault
- `ALARM_TOPIC_ARN` - SNS topic for notifications
- `ENVIRONMENT` - Environment name
- `RESTORE_ROLE_ARN` - IAM role for restore operations
- `AWS_REGION` - AWS region

**Test Process**:

1. Find recent completed recovery point
2. Start restore job to temporary table
3. Wait for restore completion (10 min timeout)
4. Verify restored table is active
5. Sample data for integrity check
6. Calculate restore metrics
7. Clean up test resources
8. Send notification with results

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Testing

```bash
npm test
```

## Deployment

### Using AWS CDK

Add to your CDK stack:

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';

// Verify Backups Lambda
const verifyBackupsFunction = new lambda.Function(this, 'VerifyBackups', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'verify-backups.handler',
  code: lambda.Code.fromAsset('backend/backup-monitoring/dist'),
  timeout: cdk.Duration.minutes(5),
  environment: {
    BACKUP_VAULT_NAME: backupVault.backupVaultName,
    ALARM_TOPIC_ARN: alarmTopic.topicArn,
    ENVIRONMENT: environment,
  },
});

// Grant permissions
backupVault.grantRead(verifyBackupsFunction);
alarmTopic.grantPublish(verifyBackupsFunction);

// Schedule daily execution
new events.Rule(this, 'VerifyBackupsSchedule', {
  schedule: events.Schedule.cron({ hour: '6', minute: '0' }),
  targets: [new events_targets.LambdaFunction(verifyBackupsFunction)],
});

// Test Restore Lambda
const testRestoreFunction = new lambda.Function(this, 'TestRestore', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'test-restore.handler',
  code: lambda.Code.fromAsset('backend/backup-monitoring/dist'),
  timeout: cdk.Duration.minutes(15),
  environment: {
    BACKUP_VAULT_NAME: backupVault.backupVaultName,
    ALARM_TOPIC_ARN: alarmTopic.topicArn,
    ENVIRONMENT: environment,
    RESTORE_ROLE_ARN: restoreRole.roleArn,
  },
});

// Grant permissions
backupVault.grantRead(testRestoreFunction);
// Add restore permissions
testRestoreFunction.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['backup:StartRestoreJob', 'backup:DescribeRestoreJob'],
    resources: ['*'],
  })
);

// Schedule monthly execution
new events.Rule(this, 'TestRestoreSchedule', {
  schedule: events.Schedule.cron({ day: '1', hour: '2', minute: '0' }),
  targets: [new events_targets.LambdaFunction(testRestoreFunction)],
});
```

### Manual Deployment

```bash
# Build
npm run build

# Package
zip -r function.zip dist/ node_modules/

# Deploy
aws lambda update-function-code \
  --function-name vaidyalink-verify-backups-prod \
  --zip-file fileb://function.zip
```

## Manual Invocation

### Verify Backups

```bash
aws lambda invoke \
  --function-name vaidyalink-verify-backups-prod \
  --log-type Tail \
  response.json

cat response.json | jq
```

### Test Restore

```bash
aws lambda invoke \
  --function-name vaidyalink-test-restore-prod \
  --payload '{"resourceType":"DynamoDB","testTableSuffix":"restore-test"}' \
  response.json

cat response.json | jq
```

## Monitoring

### CloudWatch Logs

View function logs:

```bash
# Verify Backups logs
aws logs tail /aws/lambda/vaidyalink-verify-backups-prod --follow

# Test Restore logs
aws logs tail /aws/lambda/vaidyalink-test-restore-prod --follow
```

### CloudWatch Metrics

View custom metrics:

```bash
aws cloudwatch get-metric-statistics \
  --namespace VaidyaLink/Backup \
  --metric-name BackupHealthStatus \
  --dimensions Name=Environment,Value=prod \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average
```

### SNS Notifications

Subscribe to backup alerts:

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:vaidyalink-alarms-prod \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## Troubleshooting

### Function Timeout

If restore tests timeout:

- Increase Lambda timeout (max 15 minutes)
- Check restore job status in AWS Backup console
- Verify IAM permissions for restore operations

### Permission Errors

Ensure Lambda execution role has:

- `backup:ListRecoveryPointsByBackupVault`
- `backup:ListBackupJobs`
- `backup:DescribeBackupJob`
- `backup:StartRestoreJob`
- `backup:DescribeRestoreJob`
- `dynamodb:DescribeContinuousBackups`
- `dynamodb:DescribeTable`
- `cloudwatch:PutMetricData`
- `sns:Publish`

### No Recovery Points Found

Check:

- Backup vault name is correct
- Backup plan is active
- Backup jobs are completing successfully
- Resources are included in backup selection

## Best Practices

1. **Monitor Daily**: Review verification results every day
2. **Test Monthly**: Run restore tests at least monthly
3. **Alert Subscriptions**: Subscribe to SNS topic for alerts
4. **Log Retention**: Keep CloudWatch Logs for at least 30 days
5. **Metric Dashboards**: Create CloudWatch dashboard for metrics
6. **Runbook Updates**: Update procedures based on test results

## Related Documentation

- [Backup & Recovery Guide](../../docs/BACKUP_AND_RECOVERY.md)
- [Quick Start Guide](../../docs/BACKUP_QUICK_START.md)
- [DR Runbook](../../docs/runbooks/DISASTER_RECOVERY_RUNBOOK.md)
- [Implementation Summary](../../docs/BACKUP_IMPLEMENTATION_SUMMARY.md)

## Support

For issues or questions:

1. Check CloudWatch Logs for error details
2. Review AWS Backup console for job status
3. Consult disaster recovery runbook
4. Contact AWS Support if needed
