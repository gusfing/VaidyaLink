# VaidyaLink Disaster Recovery Runbook

## Purpose

This runbook provides step-by-step procedures for recovering VaidyaLink services during disaster scenarios. Follow these procedures during actual incidents.

## Emergency Contacts

| Role               | Contact        | Phone          | Email         |
| ------------------ | -------------- | -------------- | ------------- |
| Incident Commander | [Name]         | [Phone]        | [Email]       |
| Technical Lead     | [Name]         | [Phone]        | [Email]       |
| AWS Support        | AWS Enterprise | 1-800-XXX-XXXX | [Case Portal] |
| Security Team      | [Name]         | [Phone]        | [Email]       |

## Pre-Requisites

Before executing recovery procedures, ensure you have:

- [ ] AWS Console access with appropriate permissions
- [lover)

5. [DR-005: Ransomware Recovery](#dr-005-ransomware-recovery)

---

## DR-001: DynamoDB Table Recovery

### Scenario

A DynamoDB table has been accidentally deleted or corrupted.

### Impact Assessment

- **Severity**: High
- **Affected Users**: All users if primary table affected
- **RTO**: 1-2 hours
- **RPO**: 5 minutes

### Recovery Steps

#### Step 1: Assess the Situation (5 minutes)

```bash
# 1. Verify table status
aws dynamodb describe-table \
  --table-name vaidyalink-patients-prod \
  --region us-east-1

# 2. Check when table was last accessible
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=vaidyalink-patients-prod \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

#### Step 2: Determine Recovery Point (10 minutes)

```bash
# 1. Identify the last known good time
RECOVERY_TIME="2024-01-15T10:30:00Z"  # Replace with actual time

# 2. Verify PITR is available
aws dynamodb describe-continuous-backups \
  --table-name vaidyalink-patients-prod

# 3. If PITR not available, list backup recovery points
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name vaidyalink-backup-vault-prod \
  --by-resource-type DynamoDB \
  --query 'RecoveryPoints[?ResourceArn==`arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/vaidyalink-patients-prod`]'
```

#### Step 3: Execute Recovery (30-60 minutes)

**Option A: Point-in-Time Recovery (if within 35 days)**

```bash
# 1. Restore to new table
aws dynamodb restore-table-to-point-in-time \
  --source-table-name vaidyalink-patients-prod \
  --target-table-name vaidyalink-patients-prod-restored-$(date +%Y%m%d%H%M) \
  --restore-date-time $RECOVERY_TIME \
  --region us-east-1

# 2. Monitor restore progress
RESTORED_TABLE="vaidyalink-patients-prod-restored-$(date +%Y%m%d%H%M)"
aws dynamodb wait table-exists --table-name $RESTORED_TABLE

# 3. Check table status
aws dynamodb describe-table --table-name $RESTORED_TABLE
```

**Option B: AWS Backup Recovery (for older backups)**

```bash
# 1. Get recovery point ARN from Step 2
RECOVERY_POINT_ARN="arn:aws:backup:us-east-1:ACCOUNT_ID:recovery-point:..."

# 2. Get restore role ARN
RESTORE_ROLE_ARN=$(aws iam get-role --role-name VaidyaLinkBackupRestoreRole --query 'Role.Arn' --output text)

# 3. Start restore job
RESTORE_JOB_ID=$(aws backup start-restore-job \
  --recovery-point-arn $RECOVERY_POINT_ARN \
  --iam-role-arn $RESTORE_ROLE_ARN \
  --metadata targetTableName=$RESTORED_TABLE \
  --query 'RestoreJobId' --output text)

# 4. Monitor restore job
watch -n 30 "aws backup describe-restore-job --restore-job-id $RESTORE_JOB_ID"
```

#### Step 4: Verify Data Integrity (15 minutes)

```bash
# 1. Count items in restored table
RESTORED_COUNT=$(aws dynamodb scan \
  --table-name $RESTORED_TABLE \
  --select COUNT \
  --query 'Count' --output text)

echo "Restored table item count: $RESTORED_COUNT"

# 2. Sample data verification
aws dynamodb scan \
  --table-name $RESTORED_TABLE \
  --limit 10

# 3. Compare with expected count (if available)
# Check application logs or monitoring data for expected count
```

#### Step 5: Switch Application Traffic (20 minutes)

```bash
# 1. Update infrastructure code
cd infrastructure
# Edit lib/constructs/storage.ts to use restored table name

# 2. Deploy infrastructure update
cdk deploy VaidyaLinkStack-prod --require-approval never

# 3. Verify deployment
aws cloudformation describe-stacks \
  --stack-name VaidyaLinkStack-prod \
  --query 'Stacks[0].StackStatus'

# 4. Test application connectivity
curl -X GET https://api.vaidyalink.com/health
```

#### Step 6: Cleanup (10 minutes)

```bash
# 1. Verify application is using restored table
# Check CloudWatch metrics for the restored table

# 2. Backup the corrupted table (if it still exists)
aws dynamodb create-backup \
  --table-name vaidyalink-patients-prod \
  --backup-name vaidyalink-patients-prod-corrupted-$(date +%Y%m%d)

# 3. Delete corrupted table (after verification period)
# Wait 24-48 hours before deletion
# aws dynamodb delete-table --table-name vaidyalink-patients-prod
```

### Verification Checklist

- [ ] Restored table has expected item count
- [ ] Sample data looks correct
- [ ] Application can read from restored table
- [ ] Application can write to restored table
- [ ] No errors in application logs
- [ ] CloudWatch metrics show normal operation
- [ ] Users can access their data

### Rollback Plan

If recovery fails:

1. Keep original table (if still exists)
2. Try alternative recovery point
3. Contact AWS Support for assistance
4. Communicate status to users

---

## DR-002: S3 Bucket Recovery

### Scenario

S3 objects have been accidentally deleted or corrupted.

### Impact Assessment

- **Severity**: High
- **Affected Users**: Users whose documents are affected
- **RTO**: 30 minutes - 2 hours
- **RPO**: Immediate (versioning enabled)

### Recovery Steps

#### Step 1: Identify Affected Objects (10 minutes)

```bash
# 1. List recently deleted objects
aws s3api list-object-versions \
  --bucket vaidyalink-documents-prod \
  --prefix raw/ \
  --query 'DeleteMarkers[?LastModified>=`2024-01-15T00:00:00.000Z`]'

# 2. Check CloudTrail for deletion events
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::S3::Object \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --max-results 50
```

#### Step 2: Restore Individual Objects (5-10 minutes per object)

```bash
# 1. List versions of specific object
aws s3api list-object-versions \
  --bucket vaidyalink-documents-prod \
  --prefix raw/patient-123/job-456/original.jpg

# 2. Restore specific version (remove delete marker)
aws s3api delete-object \
  --bucket vaidyalink-documents-prod \
  --key raw/patient-123/job-456/original.jpg \
  --version-id <DELETE_MARKER_VERSION_ID>

# 3. Verify restoration
aws s3api head-object \
  --bucket vaidyalink-documents-prod \
  --key raw/patient-123/job-456/original.jpg
```

#### Step 3: Bulk Restore (for multiple objects)

```bash
# 1. Create restore script
cat > restore_objects.sh << 'EOF'
#!/bin/bash
BUCKET="vaidyalink-documents-prod"
PREFIX="raw/"

# List all delete markers
aws s3api list-object-versions \
  --bucket $BUCKET \
  --prefix $PREFIX \
  --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' \
  --output json > delete_markers.json

# Restore each object
jq -r '.[] | "\(.Key) \(.VersionId)"' delete_markers.json | while read key version; do
  echo "Restoring: $key"
  aws s3api delete-object \
    --bucket $BUCKET \
    --key "$key" \
    --version-id "$version"
done
EOF

chmod +x restore_objects.sh
./restore_objects.sh
```

#### Step 4: Restore Entire Bucket (if needed)

```bash
# 1. List available backup recovery points
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name vaidyalink-backup-vault-prod \
  --by-resource-type S3

# 2. Start restore job
RECOVERY_POINT_ARN="arn:aws:backup:us-east-1:ACCOUNT_ID:recovery-point:..."
RESTORE_ROLE_ARN=$(aws iam get-role --role-name VaidyaLinkBackupRestoreRole --query 'Role.Arn' --output text)

aws backup start-restore-job \
  --recovery-point-arn $RECOVERY_POINT_ARN \
  --iam-role-arn $RESTORE_ROLE_ARN \
  --metadata newBucketName=vaidyalink-documents-prod-restored-$(date +%Y%m%d)

# 3. Monitor restore progress
# Check AWS Backup console for restore job status
```

### Verification Checklist

- [ ] Restored objects are accessible
- [ ] Object metadata is intact
- [ ] Application can read restored objects
- [ ] Pre-signed URLs work correctly
- [ ] No errors in application logs

---

## DR-003: Complete System Recovery

### Scenario

Complete system failure requiring full recovery from backups.

### Impact Assessment

- **Severity**: Critical
- **Affected Users**: All users
- **RTO**: 4-8 hours
- **RPO**: 24 hours

### Recovery Steps

#### Phase 1: Infrastructure Deployment (2-3 hours)

```bash
# 1. Clone infrastructure repository
git clone https://github.com/vaidyalink/infrastructure.git
cd infrastructure

# 2. Install dependencies
npm install

# 3. Configure AWS credentials
aws configure

# 4. Bootstrap CDK (if needed)
cdk bootstrap aws://ACCOUNT_ID/us-east-1

# 5. Deploy infrastructure
cdk deploy VaidyaLinkStack-prod --all --require-approval never

# 6. Verify deployment
aws cloudformation describe-stacks --stack-name VaidyaLinkStack-prod
```

#### Phase 2: Data Recovery (2-4 hours)

```bash
# 1. Restore all DynamoDB tables
for table in scanjobs patients voicejobs migrations; do
  echo "Restoring table: vaidyalink-$table-prod"

  # Get latest recovery point
  RECOVERY_POINT=$(aws backup list-recovery-points-by-backup-vault \
    --backup-vault-name vaidyalink-backup-vault-prod \
    --by-resource-type DynamoDB \
    --query "RecoveryPoints[?contains(ResourceArn, '$table')] | [0].RecoveryPointArn" \
    --output text)

  # Start restore
  aws backup start-restore-job \
    --recovery-point-arn $RECOVERY_POINT \
    --iam-role-arn $RESTORE_ROLE_ARN \
    --metadata targetTableName=vaidyalink-$table-prod
done

# 2. Restore S3 bucket
RECOVERY_POINT=$(aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name vaidyalink-backup-vault-prod \
  --by-resource-type S3 \
  --query 'RecoveryPoints[0].RecoveryPointArn' \
  --output text)

aws backup start-restore-job \
  --recovery-point-arn $RECOVERY_POINT \
  --iam-role-arn $RESTORE_ROLE_ARN \
  --metadata newBucketName=vaidyalink-documents-prod

# 3. Monitor all restore jobs
aws backup list-restore-jobs --by-status RUNNING
```

#### Phase 3: Application Deployment (1 hour)

```bash
# 1. Deploy backend Lambda functions
cd backend
./deploy.sh prod

# 2. Deploy frontend
cd ../frontend
npm run build
npm run deploy:prod

# 3. Verify deployments
curl https://api.vaidyalink.com/health
curl https://app.vaidyalink.com
```

#### Phase 4: Verification (30 minutes)

```bash
# 1. Run smoke tests
npm run test:smoke:prod

# 2. Verify critical workflows
# - User login
# - Document upload
# - FHIR export
# - ABDM integration

# 3. Check monitoring dashboards
# - CloudWatch Dashboard
# - Application metrics
# - Error rates
```

### Verification Checklist

- [ ] All infrastructure deployed
- [ ] All tables restored
- [ ] S3 bucket restored
- [ ] Lambda functions deployed
- [ ] Frontend deployed
- [ ] API Gateway responding
- [ ] Authentication working
- [ ] Critical workflows functional
- [ ] Monitoring operational

---

## DR-004: Regional Failover

### Scenario

Primary AWS region is unavailable.

### Impact Assessment

- **Severity**: Critical
- **Affected Users**: All users
- **RTO**: 4-8 hours
- **RPO**: 24 hours

### Prerequisites

- Secondary region configured (e.g., us-west-2)
- Cross-region backup replication enabled
- DNS failover configured

### Recovery Steps

#### Step 1: Activate Secondary Region (30 minutes)

```bash
# 1. Deploy infrastructure in secondary region
export AWS_REGION=us-west-2
cd infrastructure
cdk deploy VaidyaLinkStack-prod --all --region us-west-2

# 2. Verify deployment
aws cloudformation describe-stacks \
  --stack-name VaidyaLinkStack-prod \
  --region us-west-2
```

#### Step 2: Restore Data in Secondary Region (2-4 hours)

```bash
# 1. Restore from cross-region backup vault
BACKUP_VAULT="vaidyalink-backup-vault-prod-us-west-2"

# 2. Restore all resources (similar to DR-003 Phase 2)
# Follow same restore procedures but in us-west-2 region
```

#### Step 3: Update DNS (15 minutes)

```bash
# 1. Update Route53 to point to secondary region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://dns-failover.json

# 2. Verify DNS propagation
dig api.vaidyalink.com
dig app.vaidyalink.com
```

#### Step 4: Verify and Monitor (30 minutes)

```bash
# 1. Test application in new region
curl https://api.vaidyalink.com/health

# 2. Monitor for errors
aws logs tail /aws/lambda/vaidyalink-document-processing-prod --follow

# 3. Check user access
# Verify users can login and access data
```

### Verification Checklist

- [ ] Secondary region infrastructure deployed
- [ ] Data restored in secondary region
- [ ] DNS updated to secondary region
- [ ] Application accessible
- [ ] Users can login
- [ ] Critical workflows functional
- [ ] Monitoring operational in new region

---

## DR-005: Ransomware Recovery

### Scenario

Ransomware attack has encrypted or corrupted data.

### Impact Assessment

- **Severity**: Critical
- **Affected Users**: Potentially all users
- **RTO**: 8-24 hours
- **RPO**: 24 hours

### Recovery Steps

#### Step 1: Immediate Response (15 minutes)

```bash
# 1. ISOLATE AFFECTED SYSTEMS IMMEDIATELY
# Disable all API access
aws apigateway update-rest-api \
  --rest-api-id <API_ID> \
  --patch-operations op=replace,path=/disableExecuteApiEndpoint,value=true

# 2. Revoke all active sessions
# Rotate Cognito user pool secrets
aws cognito-idp admin-user-global-sign-out --user-pool-id <POOL_ID> --username <USERNAME>

# 3. Notify security team
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:security-alerts \
  --subject "CRITICAL: Ransomware Attack Detected" \
  --message "Immediate action required. All systems isolated."
```

#### Step 2: Assessment (1-2 hours)

```bash
# 1. Identify attack timeline
aws cloudtrail lookup-events \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --lookup-attributes AttributeKey=EventName,AttributeValue=PutObject

# 2. Identify last known good backup
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name vaidyalink-backup-vault-prod \
  --query 'RecoveryPoints[?CreationDate<`2024-01-15T00:00:00.000Z`] | [0]'

# 3. Document affected resources
# Create incident report with timeline and affected resources
```

#### Step 3: Recovery (4-8 hours)

```bash
# 1. Deploy clean infrastructure in isolated environment
# Use separate AWS account or VPC

# 2. Restore from last known good backup
# Follow DR-003 procedures with pre-attack backup

# 3. Scan restored data for malware
# Use AWS GuardDuty and third-party security tools

# 4. Implement additional security controls
# - Enable MFA delete on S3
# - Add backup vault lock
# - Implement stricter IAM policies
```

#### Step 4: Security Hardening (2-4 hours)

```bash
# 1. Enable backup vault lock
aws backup put-backup-vault-lock-configuration \
  --backup-vault-name vaidyalink-backup-vault-prod \
  --min-retention-days 30

# 2. Enable MFA delete on S3
aws s3api put-bucket-versioning \
  --bucket vaidyalink-documents-prod \
  --versioning-configuration Status=Enabled,MFADelete=Enabled \
  --mfa "arn:aws:iam::ACCOUNT_ID:mfa/root-account-mfa-device XXXXXX"

# 3. Rotate all credentials
# - KMS keys
# - IAM access keys
# - Database passwords
# - API keys

# 4. Update security groups and NACLs
# Implement stricter network controls
```

### Verification Checklist

- [ ] Attack contained and isolated
- [ ] Clean backup identified
- [ ] Data restored from clean backup
- [ ] Malware scan completed
- [ ] Security controls enhanced
- [ ] All credentials rotated
- [ ] Incident documented
- [ ] Post-mortem scheduled

---

## Post-Recovery Actions

After any disaster recovery:

1. **Document the Incident**
   - Timeline of events
   - Root cause analysis
   - Actions taken
   - Lessons learned

2. **Update Runbooks**
   - Document any deviations from procedures
   - Add new procedures discovered
   - Update contact information

3. **Conduct Post-Mortem**
   - Schedule within 48 hours
   - Include all stakeholders
   - Create action items

4. **Test Improvements**
   - Update DR procedures
   - Schedule follow-up DR drill
   - Implement preventive measures

5. **Communicate**
   - Notify users of resolution
   - Update status page
   - Send incident report to stakeholders

## Appendix

### Useful Commands

```bash
# Check backup vault status
aws backup describe-backup-vault --backup-vault-name vaidyalink-backup-vault-prod

# List all recovery points
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name vaidyalink-backup-vault-prod

# Check restore job status
aws backup describe-restore-job --restore-job-id <JOB_ID>

# List all DynamoDB tables
aws dynamodb list-tables

# Check table PITR status
aws dynamodb describe-continuous-backups --table-name <TABLE_NAME>

# List S3 bucket versions
aws s3api list-object-versions --bucket <BUCKET_NAME> --prefix <PREFIX>
```

### Emergency Decision Tree

```
Is the system accessible?
├─ Yes → Is data corrupted?
│  ├─ Yes → DR-001 or DR-002
│  └─ No → Check monitoring, may be false alarm
└─ No → Is it a regional issue?
   ├─ Yes → DR-004 (Regional Failover)
   └─ No → Is it a security incident?
      ├─ Yes → DR-005 (Ransomware Recovery)
      └─ No → DR-003 (Complete System Recovery)
```
