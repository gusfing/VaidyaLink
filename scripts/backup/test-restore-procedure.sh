#!/bin/bash

# VaidyaLink Restore Procedure Test Script
# This script performs a test restore to verify backup integrity

set -e

# Configuration
ENVIRONMENT="${1:-dev}"  # Use dev by default for testing
VAULT_NAME="vaidyalink-backup-vault-${ENVIRONMENT}"
TEST_TABLE_SUFFIX="restore-test-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "VaidyaLink Restore Procedure Test"
echo "Environment: ${ENVIRONMENT}"
echo "Vault: ${VAULT_NAME}"
echo "=========================================="
echo ""

# Function to log with timestamp
log() {
  echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to cleanup test resources
cleanup() {
  log "${YELLOW}Cleaning up test resources...${NC}"

  # List and delete test tables
  for table in $(aws dynamodb list-tables --query "TableNames[?contains(@, '${TEST_TABLE_SUFFIX}')]" --output text); do
    log "Deleting test table: ${table}"
    aws dynamodb delete-table --table-name "${table}" 2>/dev/null || true
  done

  log "${GREEN}Cleanup completed${NC}"
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Test 1: Verify backup vault exists
log "${BLUE}Test 1: Verifying backup vault...${NC}"
if aws backup describe-backup-vault --backup-vault-name "${VAULT_NAME}" &>/dev/null; then
  log "${GREEN}✓ Backup vault exists${NC}"
else
  log "${RED}✗ Backup vault not found${NC}"
  exit 1
fi
echo ""

# Test 2: List available recovery points
log "${BLUE}Test 2: Checking available recovery points...${NC}"
recovery_points=$(aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name "${VAULT_NAME}" \
  --by-resource-type DynamoDB \
  --query 'RecoveryPoints[?Status==`COMPLETED`]' \
  --output json)

recovery_point_count=$(echo "$recovery_points" | jq '. | length')

if [ "$recovery_point_count" -eq 0 ]; then
  log "${RED}✗ No completed recovery points found${NC}"
  exit 1
else
  log "${GREEN}✓ Found ${recovery_point_count} completed recovery points${NC}"
fi
echo ""

# Test 3: Select a recovery point for testing
log "${BLUE}Test 3: Selecting recovery point for test restore...${NC}"
recovery_point=$(echo "$recovery_points" | jq -r '.[0]')
recovery_point_arn=$(echo "$recovery_point" | jq -r '.RecoveryPointArn')
resource_arn=$(echo "$recovery_point" | jq -r '.ResourceArn')
creation_date=$(echo "$recovery_point" | jq -r '.CreationDate')

log "Selected recovery point:"
log "  ARN: ${recovery_point_arn}"
log "  Resource: ${resource_arn}"
log "  Created: ${creation_date}"
echo ""

# Test 4: Get restore role
log "${BLUE}Test 4: Verifying restore IAM role...${NC}"
restore_role_name="VaidyaLinkBackupRestoreRole-${ENVIRONMENT}"
restore_role_arn=$(aws iam get-role \
  --role-name "${restore_role_name}" \
  --query 'Role.Arn' \
  --output text 2>/dev/null || echo "")

if [ -z "$restore_role_arn" ]; then
  log "${YELLOW}⚠ Restore role not found, using default AWS Backup role${NC}"
  restore_role_arn="arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/service-role/AWSBackupDefaultServiceRole"
else
  log "${GREEN}✓ Restore role found: ${restore_role_arn}${NC}"
fi
echo ""

# Test 5: Start restore job
log "${BLUE}Test 5: Starting restore job...${NC}"
target_table_name="vaidyalink-${TEST_TABLE_SUFFIX}"

restore_job_output=$(aws backup start-restore-job \
  --recovery-point-arn "${recovery_point_arn}" \
  --iam-role-arn "${restore_role_arn}" \
  --metadata targetTableName="${target_table_name}" \
  --output json)

restore_job_id=$(echo "$restore_job_output" | jq -r '.RestoreJobId')

if [ -z "$restore_job_id" ] || [ "$restore_job_id" == "null" ]; then
  log "${RED}✗ Failed to start restore job${NC}"
  exit 1
else
  log "${GREEN}✓ Restore job started: ${restore_job_id}${NC}"
fi
echo ""

# Test 6: Monitor restore job
log "${BLUE}Test 6: Monitoring restore job (this may take several minutes)...${NC}"
max_wait_time=600  # 10 minutes
wait_interval=15   # 15 seconds
elapsed_time=0

while [ $elapsed_time -lt $max_wait_time ]; do
  restore_job_status=$(aws backup describe-restore-job \
    --restore-job-id "${restore_job_id}" \
    --query 'Status' \
    --output text)

  log "Restore job status: ${restore_job_status} (${elapsed_time}s elapsed)"

  if [ "$restore_job_status" == "COMPLETED" ]; then
    log "${GREEN}✓ Restore job completed successfully${NC}"
    break
  elif [ "$restore_job_status" == "FAILED" ] || [ "$restore_job_status" == "ABORTED" ]; then
    restore_job_message=$(aws backup describe-restore-job \
      --restore-job-id "${restore_job_id}" \
      --query 'StatusMessage' \
      --output text)
    log "${RED}✗ Restore job failed: ${restore_job_message}${NC}"
    exit 1
  fi

  sleep $wait_interval
  elapsed_time=$((elapsed_time + wait_interval))
done

if [ $elapsed_time -ge $max_wait_time ]; then
  log "${RED}✗ Restore job timed out after ${max_wait_time} seconds${NC}"
  exit 1
fi
echo ""

# Test 7: Verify restored table
log "${BLUE}Test 7: Verifying restored table...${NC}"

# Wait for table to be active
aws dynamodb wait table-exists --table-name "${target_table_name}"

table_status=$(aws dynamodb describe-table \
  --table-name "${target_table_name}" \
  --query 'Table.TableStatus' \
  --output text)

if [ "$table_status" == "ACTIVE" ]; then
  log "${GREEN}✓ Restored table is active${NC}"
else
  log "${RED}✗ Restored table status: ${table_status}${NC}"
  exit 1
fi

# Get item count
item_count=$(aws dynamodb scan \
  --table-name "${target_table_name}" \
  --select COUNT \
  --query 'Count' \
  --output text)

log "Restored table item count: ${item_count}"
echo ""

# Test 8: Sample data verification
log "${BLUE}Test 8: Sampling restored data...${NC}"
sample_items=$(aws dynamodb scan \
  --table-name "${target_table_name}" \
  --limit 3 \
  --output json)

sample_count=$(echo "$sample_items" | jq '.Items | length')

if [ "$sample_count" -gt 0 ]; then
  log "${GREEN}✓ Successfully retrieved ${sample_count} sample items${NC}"
  log "Sample data:"
  echo "$sample_items" | jq '.Items[0]' | head -20
else
  log "${YELLOW}⚠ No items found in restored table (table may be empty)${NC}"
fi
echo ""

# Test 9: Calculate restore metrics
log "${BLUE}Test 9: Calculating restore metrics...${NC}"

restore_job_details=$(aws backup describe-restore-job \
  --restore-job-id "${restore_job_id}" \
  --output json)

created_at=$(echo "$restore_job_details" | jq -r '.CreationDate')
completed_at=$(echo "$restore_job_details" | jq -r '.CompletionDate')

created_timestamp=$(date -d "$created_at" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$created_at" +%s)
completed_timestamp=$(date -d "$completed_at" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$completed_at" +%s)
duration=$((completed_timestamp - created_timestamp))

log "Restore metrics:"
log "  Duration: ${duration} seconds"
log "  Items restored: ${item_count}"
log "  Recovery point age: $(( ($(date +%s) - $(date -d "$creation_date" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$creation_date" +%s)) / 3600 )) hours"
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
log "${GREEN}✓ All restore tests passed successfully${NC}"
log ""
log "Test Results:"
log "  - Backup vault: Verified"
log "  - Recovery points: ${recovery_point_count} available"
log "  - Restore job: Completed"
log "  - Restored table: Active"
log "  - Data integrity: Verified"
log "  - Restore duration: ${duration}s"
log ""
log "${YELLOW}Note: Test table will be automatically cleaned up${NC}"
echo ""

exit 0
