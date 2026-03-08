# VaidyaLink Backup & Recovery - Quick Start Guide

## Overview

This guide provides quick reference for common backup and recovery operations in VaidyaLink.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Access to VaidyaLink AWS account
- Backup vault name: `vaidyalink-backup-vault-{environment}`

## Quick Reference

### Check Backup Status

```bash
# List recent backups
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name vaidyalink-backup-vault-prod \
  --max-results 10

# Check backup job status
aws backup list-backup-jobs \
  --by-backup-vault-name vaidyalink-backup-vault-prod \
  --by-state COMPLETED \
  --max-results 5
```

### Verify PITR Status

```bash
# Check if PITR is enabled for a table
aws dynamodb describe-continuous-backups \
  --table-name vaidyalink-patients-prod

# Expected output should show:
# "PointInTimeRecoveryStatus": "ENABLED"
```

### Restore a DynamoDB Table

```bash
# Restore to a specific point in time (within last 35 days)
aws dynamodb restore-table-to-point-in-time \
  --source-table-name vaidyalink-patients-prod \
  --target-table-name vaidyalink-patients-prod-restored \
  --restore-date-time "2024-01-15T10:30:00Z"

# Monitor restore progress
aws dynamodb describe-table \
  --table-name vaidyalink-patients-prod-restored \
  --query 'Table.TableStatus'
```

### Restore an S3 Object

```bash
# List versions of an object
aws s3api list-object-versions \
  --bucket vaidyalink-documents-prod \
  --prefix raw/patient-123/job-456/original.jpg

# Restore by removing delete marker
aws s3api delete-object \
  --bucket vaidyalink-documents-prod \
  --key raw/patient-123/job-456/original.jpg \
  --version-id <DELETE_MARKER_VERSION_ID>
```

### Run Backup Verification

```bash
# Trigger backup verification Lambda
aws lambda invoke \
  --function-name vaidyalink-verify-backups-prod \
  --log-type Tail \
  response.json

# View results
cat response.json | jq
```

### Test Restore Procedure

```bash
# Trigger restore test Lambda
aws lambda invoke \
  --function-name vaidyalink-test-restore-prod \
  --payload '{"resourceType":"DynamoDB","testTableSuffix":"restore-test"}' \
  response.json

# View results
cat response.json | jq
```

## Common Scenarios

### Scenario 1: User Accidentally Deleted Their Data

**Problem**: User reports their patient record is missing.

**Solution**:

```bash
# 1. Find the patient's last known data
PATIENT_ID="patient-123"

# 2. Restore table to 1 hour ago
RECOVERY_TIME=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)

aws dynamodb restore-table-to-point-in-time \
  --source-table-name vaidyalink-patients-prod \
  --target-table-name vaidyalink-patients-prod-temp \
  --restore-date-time $RECOVERY_TIME

# 3. Export the specific patient record
aws dynamodb get-item \
  --table-name vaidyalink-patients-prod-temp \
  --key "{\"PK\":{\"S\":\"PATIENT#$PATIENT_ID\"},\"SK\":{\"S\":\"PROFILE\"}}" \
  > patient_backup.json

# 4. Restore to production table
aws dynamodb put-item \
  --table-name vaidyalink-patients-prod \
  --item file://patient_backup.json

# 5. Cleanup temp table
aws dynamodb delete-table --table-name vaidyalink-patients-prod-temp
```

### Scenario 2: Document Image Accidentally Deleted

**Problem**: Medical document image is missing from S3.

**Solution**:

```bash
# 1. Find the object key
OBJECT_KEY="raw/patient-123/job-456/original.jpg"

# 2. List all versions
aws s3api list-object-versions \
  --bucket vaidyalink-documents-prod \
  --prefix $OBJECT_KEY

# 3. Restore the latest non-delete-marker version
# If there's a delete marker, remove it:
aws s3api delete-object \
  --bucket vaidyalink-documents-prod \
  --key $OBJECT_KEY \
  --version-id <DELETE_MARKER_VERSION_ID>

# 4. Verify restoration
aws s3api head-object \
  --bucket vaidyalink-documents-prod \
  --key $OBJECT_KEY
```

### Scenario 3: Need to Restore from Weekly Backup

**Problem**: Need to restore data from last week's backup.

**Solution**:

```bash
# 1. List recovery points from last week
START_DATE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S)
END_DATE=$(date -u -d '6 days ago' +%Y-%m-%dT%H:%M:%S)

aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name vaidyalink-backup-vault-prod \
  --by-resource-type DynamoDB \
  --by-created-after $START_DATE \
  --by-created-before $END_DATE

# 2. Get the recovery point ARN from output
RECOVERY_POINT_ARN="arn:aws:backup:us-east-1:ACCOUNT_ID:recovery-point:..."

# 3. Get restore role ARN
RESTORE_ROLE_ARN=$(aws iam get-role \
  --role-name VaidyaLinkBackupRestoreRole \
  --query 'Role.Arn' \
  --output text)

# 4. Start restore job
aws backup start-restore-job \
  --recovery-point-arn $RECOVERY_POINT_ARN \
  --iam-role-arn $RESTORE_ROLE_ARN \
  --metadata targetTableName=vaidyalink-patients-prod-restored

# 5. Monitor restore job
RESTORE_JOB_ID="<from previous command output>"
aws backup describe-restore-job --restore-job-id $RESTORE_JOB_ID
```

## Monitoring

### Check Backup Health

```bash
# View CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace VaidyaLink/Backup \
  --metric-name BackupHealthStatus \
  --dimensions Name=Environment,Value=prod \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average

# Check for failed backups
aws backup list-backup-jobs \
  --by-backup-vault-name vaidyalink-backup-vault-prod \
  --by-state FAILED \
  --max-results 10
```

### View Backup Notifications

```bash
# List recent SNS messages
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:vaidyalink-alarms-prod

# Check CloudWatch Logs for backup verification
aws logs tail /aws/lambda/vaidyalink-verify-backups-prod --follow
```

## Troubleshooting

### Backup Job Failed

```bash
# 1. Get backup job details
aws backup describe-backup-job --backup-job-id <JOB_ID>

# 2. Check CloudWatch Logs
aws logs filter-log-events \
  --log-group-name /aws/backup/job-logs \
  --filter-pattern "ERROR"

# 3. Common issues:
# - IAM permissions: Check backup service role
# - KMS permissions: Verify key policy
# - Resource not found: Ensure resource exists
```

### Restore Job Failed

```bash
# 1. Get restore job details
aws backup describe-restore-job --restore-job-id <JOB_ID>

# 2. Common issues:
# - Target resource already exists: Use different name
# - IAM permissions: Check restore role
# - Insufficient capacity: Check service quotas
```

### PITR Not Available

```bash
# 1. Check if PITR is enabled
aws dynamodb describe-continuous-backups \
  --table-name vaidyalink-patients-prod

# 2. If disabled, enable it
aws dynamodb update-continuous-backups \
  --table-name vaidyalink-patients-prod \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# 3. Note: PITR takes a few minutes to activate
```

## Best Practices

1. **Regular Testing**: Run restore tests monthly
2. **Monitor Alerts**: Subscribe to backup failure notifications
3. **Document Changes**: Update runbooks when procedures change
4. **Verify Backups**: Check backup verification Lambda results daily
5. **Retention Compliance**: Ensure 7-year retention for HIPAA compliance

## Emergency Contacts

For backup/recovery emergencies:

1. Check monitoring dashboard first
2. Review CloudWatch Logs
3. Follow disaster recovery runbook: `docs/runbooks/DISASTER_RECOVERY_RUNBOOK.md`
4. Contact AWS Support if needed (Enterprise Support)

## Additional Resources

- [Full Backup & Recovery Guide](./BACKUP_AND_RECOVERY.md)
- [Disaster Recovery Runbook](./runbooks/DISASTER_RECOVERY_RUNBOOK.md)
- [AWS Backup Documentation](https://docs.aws.amazon.com/backup/)
- [DynamoDB PITR Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/PointInTimeRecovery.html)

## Useful Scripts

### Backup All Tables Script

```bash
#!/bin/bash
# backup-all-tables.sh

ENVIRONMENT="prod"
TABLES=("scanjobs" "patients" "voicejobs" "migrations")

for table in "${TABLES[@]}"; do
  TABLE_NAME="vaidyalink-$table-$ENVIRONMENT"
  BACKUP_NAME="$TABLE_NAME-manual-$(date +%Y%m%d-%H%M%S)"

  echo "Creating backup for $TABLE_NAME..."
  aws dynamodb create-backup \
    --table-name $TABLE_NAME \
    --backup-name $BACKUP_NAME
done

echo "All backups initiated"
```

### Check All PITR Status Script

```bash
#!/bin/bash
# check-pitr-status.sh

ENVIRONMENT="prod"
TABLES=("scanjobs" "patients" "voicejobs" "migrations")

echo "Checking PITR status for all tables..."
echo "========================================"

for table in "${TABLES[@]}"; do
  TABLE_NAME="vaidyalink-$table-$ENVIRONMENT"
  STATUS=$(aws dynamodb describe-continuous-backups \
    --table-name $TABLE_NAME \
    --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' \
    --output text)

  echo "$TABLE_NAME: $STATUS"
done
```

### Verify Backup Coverage Script

```bash
#!/bin/bash
# verify-backup-coverage.sh

VAULT_NAME="vaidyalink-backup-vault-prod"

echo "Checking backup coverage..."
echo "==========================="

# Get all recovery points
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name $VAULT_NAME \
  --query 'RecoveryPoints[].{Resource:ResourceArn,Type:ResourceType,Created:CreationDate}' \
  --output table

# Count by resource type
echo ""
echo "Recovery Points by Resource Type:"
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name $VAULT_NAME \
  --query 'RecoveryPoints[].ResourceType' \
  --output text | tr '\t' '\n' | sort | uniq -c
```

Save these scripts to `scripts/backup/` directory and make them executable:

```bash
chmod +x scripts/backup/*.sh
```
