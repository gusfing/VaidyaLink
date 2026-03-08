#!/bin/bash

# VaidyaLink Environment Teardown Script
# This script tears down staging or production AWS environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to validate environment parameter
validate_environment() {
    local env=$1
    if [[ "$env" != "staging" && "$env" != "prod" ]]; then
        print_error "Invalid environment. Must be
load configuration
load_config() {
    local env=$1
    local config_file="config/${env}.json"

    if [ ! -f "$config_file" ]; then
        print_error "Configuration file not found: $config_file"
        exit 1
    fi

    export AWS_ACCOUNT_ID=$(jq -r '.account' "$config_file")
    export AWS_REGION=$(jq -r '.region' "$config_file")
    export ENVIRONMENT=$(jq -r '.environment' "$config_file")

    print_info "Environment: $ENVIRONMENT"
    print_info "AWS Account: $AWS_ACCOUNT_ID"
    print_info "AWS Region: $AWS_REGION"
}

# Function to empty and delete S3 buckets
delete_s3_buckets() {
    print_info "Deleting S3 buckets..."

    local buckets=(
        "vaidyalink-$ENVIRONMENT-documents"
        "vaidyalink-$ENVIRONMENT-audio"
        "vaidyalink-$ENVIRONMENT-exports"
        "vaidyalink-$ENVIRONMENT-logs"
        "vaidyalink-$ENVIRONMENT-cloudtrail"
    )

    for bucket in "${buckets[@]}"; do
        if aws s3 ls "s3://$bucket" 2>&1 | grep -q -v 'NoSuchBucket'; then
            print_info "Emptying and deleting bucket: $bucket"

            # Empty bucket (including all versions)
            aws s3 rm "s3://$bucket" --recursive

            # Delete all versions
            aws s3api delete-objects \
                --bucket "$bucket" \
                --delete "$(aws s3api list-object-versions \
                    --bucket "$bucket" \
                    --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
                    --max-items 1000)" 2>/dev/null || true

            # Delete bucket
            aws s3 rb "s3://$bucket" --force

            print_info "Bucket deleted: $bucket"
        else
            print_info "Bucket does not exist: $bucket"
        fi
    done
}

# Function to destroy CDK stacks
destroy_cdk_stacks() {
    print_info "Destroying CDK stacks..."

    cdk destroy --all \
        --context environment=$ENVIRONMENT \
        --force

    print_info "CDK stacks destroyed"
}

# Function to delete CloudTrail
delete_cloudtrail() {
    print_info "Deleting CloudTrail..."

    local trail_name="vaidyalink-$ENVIRONMENT-trail"

    if aws cloudtrail describe-trails --trail-name-list "$trail_name" | grep -q "$trail_name"; then
        aws cloudtrail stop-logging --name "$trail_name"
        aws cloudtrail delete-trail --name "$trail_name"
        print_info "CloudTrail deleted: $trail_name"
    else
        print_info "CloudTrail does not exist: $trail_name"
    fi
}

# Function to delete KMS keys
delete_kms_keys() {
    print_info "Scheduling KMS key deletion..."

    local key_alias="alias/vaidyalink-$ENVIRONMENT"

    if aws kms describe-key --key-id "$key_alias" &> /dev/null; then
        local key_id=$(aws kms describe-key --key-id "$key_alias" --query 'KeyMetadata.KeyId' --output text)

        # Schedule key deletion (minimum 7 days)
        aws kms schedule-key-deletion \
            --key-id "$key_id" \
            --pending-window-in-days 7

        print_info "KMS key scheduled for deletion in 7 days: $key_alias"
    else
        print_info "KMS key does not exist: $key_alias"
    fi
}

# Function to delete CloudWatch log groups
delete_cloudwatch_logs() {
    print_info "Deleting CloudWatch log groups..."

    local log_groups=$(aws logs describe-log-groups \
        --log-group-name-prefix "/aws/lambda/vaidyalink-$ENVIRONMENT" \
        --query 'logGroups[].logGroupName' \
        --output text)

    for log_group in $log_groups; do
        print_info "Deleting log group: $log_group"
        aws logs delete-log-group --log-group-name "$log_group"
    done
}

# Function to display summary
display_summary() {
    print_info "========================================="
    print_info "Environment Teardown Complete!"
    print_info "========================================="
    print_info "Environment: $ENVIRONMENT"
    print_info "All resources have been deleted"
    print_info "========================================="
    print_warning "Note: KMS keys are scheduled for deletion in 7 days"
    print_warning "You can cancel the deletion within this period if needed"
    print_info "========================================="
}

# Main execution
main() {
    echo "========================================="
    echo "VaidyaLink Environment Teardown"
    echo "========================================="

    if [ $# -eq 0 ]; then
        print_error "Usage: $0 <staging|prod>"
        exit 1
    fi

    local environment=$1
    validate_environment "$environment"

    # Change to infrastructure directory
    cd "$(dirname "$0")/.."

    # Load configuration
    load_config "$environment"

    # Final confirmation
    print_warning "This will DELETE ALL resources in the $ENVIRONMENT environment"
    read -p "Are you absolutely sure? (yes/no) " -r
    echo
    if [[ ! $REPLY =~ ^yes$ ]]; then
        print_info "Teardown cancelled"
        exit 0
    fi

    # Execute teardown steps
    delete_cloudtrail
    destroy_cdk_stacks
    delete_s3_buckets
    delete_kms_keys
    delete_cloudwatch_logs

    # Display summary
    display_summary
}

# Run main function
main "$@"
