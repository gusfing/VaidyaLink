# VaidyaLink Backup and Recovery Guide

## Overview

VaidyaLink implements a comprehensive backup and disaster recovery strategy to ensure data durability, HIPAA compliance, and business continuity. This document covers backup architecture, recovery procedures, and disaster recovery scenarios.

## Table of Contents

1. [Backup Architecture](#backup-architecture)
2. [Backup Schedule](#backup-schedule)
3. [Point-in-Time Recovery](#point-in-time-recovery)
4. [Recovery Procedures](#recovery-procedures)
5. [Disaster Recovery Scenarios](#disaster-recovery-scenarios)
6. [Monitoring and Alerts](#monitoring-and-alerts)
7. [Testing and Validation](#testing-and-validation)
8. [Compliance](#compliance)

## Backup Architecture

### Components

VaidyaLink uses AWS Backup as the centralized backup service for all data resources:

- **AWS Backup Vault**: Encrypted vault storing all backup recovery points
- **Backup Plans**: Automated backup schedules with retention policies
- **DynamoDB Tables**: All tables have continuous backups enabled
- **S3 Buckets**: Versioning enabled with lifecycle policies
- **Encryption**: All backups encrypted with AWS KMS customer-managed keys

### Resources Backed Up

1. **DynamoDB Tables**:
   - `vaidyalink-scanjobs-{env}` - Document processing jobs
   - `vaidyalink-patients-{env}` - Patient demographics
   - `vaidyalink-voicejobs-{env}` - Voice transcription jobs
   - `vaidyalink-migrations-{env}` - Migration history

2. **S3 Buckets**:
   - `vaidyalink-documents-{env}` - Medical documents and audio files

### Backup Vault

- **Name**: `vaidyalink-backup-vault-{environment}`
- **Encryption**: AWS KMS customer-managed key
- **Access Control**: IAM policies restrict access to authorized personnel only
- **Retention**: Vault configured with RETAIN removal policy

## Backup Schedule

### Daily Backups

- **Schedule**: Every day at 2:00 AM UTC
- **Retention**: 35 days
- **Features**:
  - Continuous backup enabled for DynamoDB (PITR)
  - Start window: 1 hour
  - Completion window: 2 hours

### Weekly Backups

- **Schedule**: Every Sunday at 3:00 AM UTC
- **Retention**: 90 days
- **Purpose**: Medium-term recovery points

### Monthly Backups

- **Schedule**: 1st day of each month at 4:00 AM UTC
- **Retention**: 7 years (2,555 days)
- **Cold Storage**: Moved to cold storage after 90 days
- **Purpose**: Long-term compliance (HIPAA requires 7-year retention)

## Point-in-Time Recovery

### DynamoDB PITR

All DynamoDB tables have Point-in-Time Recovery (PITR) enabled:

- **Recovery Window**: Last 35 days
- **Granularity**: Any second within the recovery window
- **RPO**: 5 minutes (AWS managed)
- **RTO**: Minutes to hours depending on table size

### Enabling PITR

PITR is automatically enabled via CDK infrastructure:

```typescript
pointInTimeRecoverySpecification: {
  pointInTimeRecoveryEnabled: true,
}
```

### S3 Versioning

S3 buckets have versioning enabled:

- **Retention**: All versions retained
- **Recovery**: Can restore any previous version of an object
- **Lifecycle**: Intelligent-Tiering for cost optimization

## Recovery Procedures

### DynamoDB Table Recovery

#### Option 1: Point-in-Time Recovery (Recent Data Loss)

For data loss within the last 35 days:

```bash
# 1. Determine the recovery time
RECOVERY_TIME="2024-01-15T10:30:00Z"

# 2. Restore to a new table
aws dynamodb restore-table-to-point-in-time \
  --source-table-name vaidyalink-patients-prod \
  --target-table-name vaidyalink-patients-prod-restored \
  --restore-date-time $RECOVERY_TIME

# 3. Wait for restore to complete
aws dynamodb wait table-exists \
  --table-name vaidyalink-patients-prod-restored

# 4. Verify data integrity
aws dynamodb scan \
  --table-name vaidyalink-patients-prod-restored \
  --select COUNT

# 5. Update application to use restored table
# (Requires infrastructure update and deployment)
```

#### Option 2: AWS Backup Recovery (Older Backups)

For recovery from scheduled backups:

```bash
# 1. List available recovery points
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name vaidyalink-backup-vault-prod \
  --by-resource-type DynamoDB

# 2. Start restore job
aws backup start-restore-job \
  --recovery-point-arn <RECOVERY_POINT_ARN> \
  --iam-role-arn <RESTORE_ROLE_ARN> \
  --metadata targetTableName=vaidyalink-patients-prod-restored

# 3. Monitor restore job
aws backup describe-restore-job \
  --restore-job-id <RESTORE_JOB_ID>
```

### S3 Object Recovery

#### Restore Deleted Object

```bash
# 1. List object versions
aws s3api list-object-versions \
  --bucket vaidyalink-documents-prod \
  --prefix raw/patient-123/job-456/

# 2. Restore specific version
aws s3api copy-object \
  --bucket vaidyalink-documents-prod \
  --copy-source vaidyalink-documents-prod/raw/patient-123/job-456/original.jpg?versionId=<VERSION_ID> \
  --key raw/patient-123/job-456/original.jpg
```

#### Restore Entire Bucket

```bash
# Use AWS Backup to restore entire bucket
aws backup start-restore-job \
  --recovery-point-arn <S3_RECOVERY_POINT_ARN> \
  --iam-role-arn <RESTORE_ROLE_ARN> \
  --metadata newBucketName=vaidyalink-documents-prod-restored
```

### AWS HealthLake Recovery

AWS HealthLake data is backed up automatically by AWS:

- **Backup Frequency**: Continuous
- **Retention**: 35 days
- **Recovery**: Contact AWS Support for HealthLake data recovery

## Disaster Recovery Scenarios

### Scenario 1: Accidental Data Deletion

**Impact**: Single table or small dataset deleted

**Recovery Steps**:

1. Identify the deletion time
2. Use PITR to restore to just before deletion
3. Restore to new table name
4. Verify data integrity
5. Update application configuration
6. Switch traffic to restored table
7. Delete corrupted table

**RTO**: 1-2 hours
**RPO**: 5 minutes

### Scenario 2: Data Corruption

**Impact**: Data corrupted by application bug

**Recovery Steps**:

1. Identify when corruption started
2. Stop application to prevent further corruption
3. Use PITR or backup to restore clean data
4. Fix application bug
5. Deploy fixed application
6. Verify data integrity
7. Resume operations

**RTO**: 2-4 hours
**RPO**: 5 minutes to 24 hours (depending on detection time)

### Scenario 3: Regional Failure

**Impact**: Entire AWS region unavailable

**Recovery Steps**:

1. Activate disaster recovery plan
2. Deploy infrastructure in alternate region
3. Restore latest backups to new region
4. Update DNS to point to new region
5. Verify all services operational
6. Communicate with users

**RTO**: 4-8 hours
**RPO**: 24 hours (last daily backup)

**Note**: Cross-region backup replication should be implemented for production to reduce RPO.

### Scenario 4: Ransomware Attack

**Impact**: Data encrypted by malicious actor

**Recovery Steps**:

1. Isolate affected systems immediately
2. Identify last known good backup before attack
3. Restore from immutable backup vault
4. Scan restored data for malware
5. Implement additional security controls
6. Conduct security audit
7. Resume operations

**RTO**: 8-24 hours
**RPO**: 24 hours

## Monitoring and Alerts

### CloudWatch Alarms

1. **Backup Failure Alarm**
   - Metric: `NumberOfBackupJobsFailed`
   - Threshold: ≥ 1 failure in 24 hours
   - Action: SNS notification to operations team

2. **Restore Failure Alarm**
   - Metric: `NumberOfRestoreJobsFailed`
   - Threshold: ≥ 1 failure
   - Action: SNS notification to operations team

### EventBridge Rules

Automated notifications for:

- Backup job completion
- Backup job failure
- Restore job completion
- Restore job failure

### Custom Metrics

Lambda function publishes custom metrics:

- `TotalRecoveryPoints` - Total backups available
- `RecentBackups` - Backups created in last 24 hours
- `FailedBackups` - Failed backups in last 7 days
- `BackupHealthStatus` - Overall health score (0-1)

### Verification Lambda

Runs daily to verify backup health:

- Checks for recent backups
- Validates recovery point availability
- Detects failed backup jobs
- Sends alerts for issues

## Testing and Validation

### Monthly Restore Tests

Automated restore testing runs monthly:

```bash
# Trigger restore test Lambda
aws lambda invoke \
  --function-name vaidyalink-test-restore-prod \
  --payload '{"resourceType":"DynamoDB","testTableSuffix":"restore-test"}' \
  response.json
```

### Quarterly DR Drills

Full disaster recovery drills every quarter:

1. **Week 1**: Plan and schedule drill
2. **Week 2**: Execute recovery in test environment
3. **Week 3**: Document findings and improvements
4. **Week 4**: Update runbooks and procedures

### Validation Checklist

- [ ] All tables have PITR enabled
- [ ] Backup jobs completing successfully
- [ ] Recovery points available for all resources
- [ ] Restore tests passing
- [ ] Monitoring and alerts functional
- [ ] Documentation up to date
- [ ] Team trained on procedures

## Compliance

### HIPAA Requirements

VaidyaLink backup strategy meets HIPAA requirements:

- ✅ **Encryption**: All backups encrypted at rest and in transit
- ✅ **Access Control**: IAM policies restrict backup access
- ✅ **Audit Logging**: CloudTrail logs all backup operations
- ✅ **Retention**: 7-year retention for compliance
- ✅ **Integrity**: Backup verification ensures data integrity
- ✅ **Availability**: Multiple backup copies ensure availability

### Audit Trail

All backup and restore operations logged in CloudTrail:

- Backup job creation
- Restore job execution
- Backup deletion
- Access to backup vault
- Configuration changes

### Data Retention Policy

| Backup Type | Retention Period | Purpose                           |
| ----------- | ---------------- | --------------------------------- |
| Daily       | 35 days          | Short-term recovery               |
| Weekly      | 90 days          | Medium-term recovery              |
| Monthly     | 7 years          | Compliance and long-term recovery |
| PITR        | 35 days          | Granular point-in-time recovery   |

## Best Practices

1. **Regular Testing**: Test restore procedures monthly
2. **Documentation**: Keep runbooks updated
3. **Monitoring**: Review backup health daily
4. **Automation**: Automate backup verification
5. **Training**: Train team on recovery procedures
6. **Encryption**: Always use encrypted backups
7. **Immutability**: Use backup vault lock for critical backups
8. **Cross-Region**: Implement cross-region replication for production

## Troubleshooting

### Backup Job Failing

1. Check IAM permissions for AWS Backup service role
2. Verify KMS key permissions
3. Check resource availability
4. Review CloudWatch Logs for error details

### Restore Job Failing

1. Verify IAM restore role permissions
2. Check target resource name conflicts
3. Ensure sufficient capacity in target region
4. Review restore job error message

### PITR Not Available

1. Verify PITR is enabled on table
2. Check if table was created within last 35 days
3. Ensure table hasn't been deleted and recreated

## Support and Escalation

For backup and recovery issues:

1. **Level 1**: Check monitoring dashboard and alerts
2. **Level 2**: Review CloudWatch Logs and AWS Backup console
3. **Level 3**: Contact AWS Support (Enterprise Support plan)
4. **Emergency**: Follow disaster recovery runbook

## Additional Resources

- [AWS Backup Documentation](https://docs.aws.amazon.com/backup/)
- [DynamoDB PITR Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/PointInTimeRecovery.html)
- [S3 Versioning Documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)
- [VaidyaLink Infrastructure Code](../infrastructure/lib/constructs/backup.ts)
