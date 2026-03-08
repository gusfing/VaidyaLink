#!/bin/bash

# VaidyaLink Backup Coverage Verification Script
# This script verifies that all critical resources have recent backups

set -e

# Configuration
ENVIRONMENT="${1:-prod}"
VAULT_NAME="vaidyalink-backup-vault-${ENVIRONMENT}"
HOURS_THRESHOLD=48  # Alert if no backup in last 48 hours

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Expected resources
EXPECTED_TABLES=(
  "vaidyalink-scanjobs-${ENVIRONMENT}"
  "vaidyalink-patients-${ENVIRONMENT}"
  "vaidyalink-voicejobs-${ENVIRONMENT}"
  "vaidyalink-migrations-${ENVIRONMENT}"
)

EXPECTED_BUCKETS=(
  "vaidyalink-documents-${ENVIRONMENT}"
)

echo "=========================================="
echo "VaidyaLink Backup Coverage Verification"
echo "Environment: ${ENVIRONMENT}"
echo "Vault: ${VAULT_NAME}"
echo "=========================================="
echo ""

# Function to check if backup exists for resource
check_resource_backup() {
  local resource_arn=$1
  local resource_name=$2
  local resource_type=$3

  # Get most recent backup for this resource
  local latest_backup=$(aws backup list-recovery-points-by-backup-vault \
    --backup-vault-name "${VAULT_NAME}" \
    --by-resource-arn "${resource_arn}" \
    --query 'RecoveryPoints | sort_by(@, &CreationDate) | [-1].{Created:CreationDate,Status:Status}' \
    --output json 2>/dev/null)

  if [ -z "$latest_backup" ] || [ "$latest_backup" == "null" ]; then
    echo -e "${RED}✗${NC} ${resource_name}: No backups found"
    return 1
  fi

  local created_date=$(echo "$latest_backup" | jq -r '.Created')
  local status=$(echo "$latest_backup" | jq -r '.Status')

  # Calculate hours since backup
  local created_timestamp=$(date -d "$created_date" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$created_date" +%s)
  local current_timestamp=$(date +%s)
  local hours_ago=$(( (current_timestamp - created_timestamp) / 3600 ))

  if [ "$status" != "COMPLETED" ]; then
    echo -e "${YELLOW}⚠${NC} ${resource_name}: Latest backup status is ${status}"
    return 1
  elif [ $hours_ago -gt $HOURS_THRESHOLD ]; then
    echo -e "${YELLOW}⚠${NC} ${resource_name}: Latest backup is ${hours_ago} hours old (threshold: ${HOURS_THRESHOLD}h)"
    return 1
  else
    echo -e "${GREEN}✓${NC} ${resource_name}: Latest backup ${hours_ago}h ago (${status})"
    return 0
  fi
}

# Function to check PITR status
check_pitr_status() {
  local table_name=$1

  local pitr_status=$(aws dynamodb describe-continuous-backups \
    --table-name "${table_name}" \
    --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' \
    --output text 2>/dev/null)

  if [ "$pitr_status" == "ENABLED" ]; then
    echo -e "${GREEN}✓${NC} ${table_name}: PITR enabled"
    return 0
  else
    echo -e "${RED}✗${NC} ${table_name}: PITR not enabled (status: ${pitr_status})"
    return 1
  fi
}

# Check DynamoDB tables
echo "Checking DynamoDB Tables:"
echo "-------------------------"
table_backup_count=0
table_pitr_count=0

for table in "${EXPECTED_TABLES[@]}"; do
  # Get table ARN
  table_arn=$(aws dynamodb describe-table \
    --table-name "${table}" \
    --query 'Table.TableArn' \
    --output text 2>/dev/null)

  if [ -z "$table_arn" ]; then
    echo -e "${RED}✗${NC} ${table}: Table not found"
    continue
  fi

  # Check backup
  if check_resource_backup "$table_arn" "$table" "DynamoDB"; then
    ((table_backup_count++))
  fi

  # Check PITR
  if check_pitr_status "$table"; then
    ((table_pitr_count++))
  fi

  echo ""
done

# Check S3 buckets
echo "Checking S3 Buckets:"
echo "--------------------"
bucket_backup_count=0
bucket_versioning_count=0

for bucket in "${EXPECTED_BUCKETS[@]}"; do
  # Get bucket ARN
  bucket_arn="arn:aws:s3:::${bucket}"

  # Check if bucket exists
  if ! aws s3api head-bucket --bucket "${bucket}" 2>/dev/null; then
    echo -e "${RED}✗${NC} ${bucket}: Bucket not found"
    continue
  fi

  # Check backup
  if check_resource_backup "$bucket_arn" "$bucket" "S3"; then
    ((bucket_backup_count++))
  fi

  # Check versioning
  versioning_status=$(aws s3api get-bucket-versioning \
    --bucket "${bucket}" \
    --query 'Status' \
    --output text 2>/dev/null)

  if [ "$versioning_status" == "Enabled" ]; then
    echo -e "${GREEN}✓${NC} ${bucket}: Versioning enabled"
    ((bucket_versioning_count++))
  else
    echo -e "${RED}✗${NC} ${bucket}: Versioning not enabled (status: ${versioning_status})"
  fi

  echo ""
done

# Summary
echo "=========================================="
echo "Summary:"
echo "=========================================="
echo "DynamoDB Tables:"
echo "  - Backups: ${table_backup_count}/${#EXPECTED_TABLES[@]}"
echo "  - PITR: ${table_pitr_count}/${#EXPECTED_TABLES[@]}"
echo ""
echo "S3 Buckets:"
echo "  - Backups: ${bucket_backup_count}/${#EXPECTED_BUCKETS[@]}"
echo "  - Versioning: ${bucket_versioning_count}/${#EXPECTED_BUCKETS[@]}"
echo ""

# Check overall status
total_expected=$((${#EXPECTED_TABLES[@]} + ${#EXPECTED_BUCKETS[@]}))
total_backed_up=$((table_backup_count + bucket_backup_count))
total_protected=$((table_pitr_count + bucket_versioning_count))

if [ $total_backed_up -eq $total_expected ] && [ $total_protected -eq $total_expected ]; then
  echo -e "${GREEN}✓ All resources are properly backed up and protected${NC}"
  exit 0
else
  echo -e "${RED}✗ Some resources are missing backups or protection${NC}"
  exit 1
fi
