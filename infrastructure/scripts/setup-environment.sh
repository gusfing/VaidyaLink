#!/bin/bash

# VaidyaLink Environment Setup Script
# This script sets up staging or production AWS environments

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

# Function to check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    print_info "AWS
q --version)"
}

# Function to validate environment parameter
validate_environment() {
    local env=$1
    if [[ "$env" != "staging" && "$env" != "prod" ]]; then
        print_error "Invalid environment. Must be 'staging' or 'prod'"
        exit 1
    fi
}

# Function to load configuration
load_config() {
    local env=$1
    local config_file="config/${env}.json"

    if [ ! -f "$config_file" ]; then
        print_error "Configuration file not found: $config_file"
        exit 1
    fi

    print_info "Loading configuration from $config_file"

    # Export configuration variables
    export AWS_ACCOUNT_ID=$(jq -r '.account' "$config_file")
    export AWS_REGION=$(jq -r '.region' "$config_file")
    export ENVIRONMENT=$(jq -r '.environment' "$config_file")
    export DOMAIN_NAME=$(jq -r '.domainName' "$config_file")

    print_info "Environment: $ENVIRONMENT"
    print_info "AWS Account: $AWS_ACCOUNT_ID"
    print_info "AWS Region: $AWS_REGION"
    print_info "Domain: $DOMAIN_NAME"
}

# Function to verify AWS credentials
verify_aws_credentials() {
    print_info "Verifying AWS credentials..."

    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials are not configured or invalid"
        exit 1
    fi

    local caller_identity=$(aws sts get-caller-identity)
    local account_id=$(echo "$caller_identity" | jq -r '.Account')
    local user_arn=$(echo "$caller_identity" | jq -r '.Arn')

    print_info "Authenticated as: $user_arn"
    print_info "Account ID: $account_id"

    if [ "$account_id" != "$AWS_ACCOUNT_ID" ]; then
        print_warning "Current AWS account ($account_id) does not match config ($AWS_ACCOUNT_ID)"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Function to bootstrap CDK
bootstrap_cdk() {
    print_info "Bootstrapping AWS CDK..."

    cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION \
        --context environment=$ENVIRONMENT \
        --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess

    print_info "CDK bootstrap completed"
}

# Function to create S3 buckets
create_s3_buckets() {
    print_info "Creating S3 buckets..."

    local buckets=(
        "vaidyalink-$ENVIRONMENT-documents"
        "vaidyalink-$ENVIRONMENT-audio"
        "vaidyalink-$ENVIRONMENT-exports"
        "vaidyalink-$ENVIRONMENT-logs"
    )

    for bucket in "${buckets[@]}"; do
        if aws s3 ls "s3://$bucket" 2>&1 | grep -q 'NoSuchBucket'; then
            print_info "Creating bucket: $bucket"
            aws s3 mb "s3://$bucket" --region $AWS_REGION

            # Enable versioning
            aws s3api put-bucket-versioning \
                --bucket "$bucket" \
                --versioning-configuration Status=Enabled

            # Enable encryption
            aws s3api put-bucket-encryption \
                --bucket "$bucket" \
                --server-side-encryption-configuration '{
                    "Rules": [{
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256"
                        }
                    }]
                }'

            # Block public access
            aws s3api put-public-access-block \
                --bucket "$bucket" \
                --public-access-block-configuration \
                "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

            print_info "Bucket created and configured: $bucket"
        else
            print_info "Bucket already exists: $bucket"
        fi
    done
}

# Function to create DynamoDB tables
create_dynamodb_tables() {
    print_info "Creating DynamoDB tables..."

    # This will be handled by CDK, but we can create basic tables here if needed
    print_info "DynamoDB tables will be created by CDK deployment"
}

# Function to create KMS keys
create_kms_keys() {
    print_info "Creating KMS keys..."

    local key_alias="alias/vaidyalink-$ENVIRONMENT"

    # Check if key already exists
    if aws kms describe-key --key-id "$key_alias" &> /dev/null; then
        print_info "KMS key already exists: $key_alias"
    else
        print_info "Creating KMS key: $key_alias"

        local key_id=$(aws kms create-key \
            --description "VaidyaLink $ENVIRONMENT encryption key" \
            --key-policy '{
                "Version": "2012-10-17",
                "Statement": [{
                    "Sid": "Enable IAM User Permissions",
                    "Effect": "Allow",
                    "Principal": {"AWS": "arn:aws:iam::'$AWS_ACCOUNT_ID':root"},
                    "Action": "kms:*",
                    "Resource": "*"
                }]
            }' \
            --query 'KeyMetadata.KeyId' \
            --output text)

        # Create alias
        aws kms create-alias \
            --alias-name "$key_alias" \
            --target-key-id "$key_id"

        print_info "KMS key created: $key_alias"
    fi
}

# Function to deploy CDK stacks
deploy_cdk_stacks() {
    print_info "Deploying CDK stacks..."

    # Build the CDK app
    print_info "Building CDK app..."
    npm run build

    # Synthesize CloudFormation templates
    print_info "Synthesizing CloudFormation templates..."
    cdk synth --context environment=$ENVIRONMENT

    # Deploy all stacks
    print_info "Deploying all stacks..."
    cdk deploy --all \
        --context environment=$ENVIRONMENT \
        --require-approval never \
        --outputs-file cdk-outputs-$ENVIRONMENT.json

    print_info "CDK deployment completed"

    # Display outputs
    if [ -f "cdk-outputs-$ENVIRONMENT.json" ]; then
        print_info "Stack outputs:"
        cat "cdk-outputs-$ENVIRONMENT.json" | jq '.'
    fi
}

# Function to configure CloudWatch alarms
configure_cloudwatch_alarms() {
    print_info "Configuring CloudWatch alarms..."

    # This will be handled by CDK monitoring construct
    print_info "CloudWatch alarms will be configured by CDK deployment"
}

# Function to setup CloudTrail
setup_cloudtrail() {
    if [ "$ENVIRONMENT" != "prod" ]; then
        print_info "Skipping CloudTrail setup for non-production environment"
        return
    fi

    print_info "Setting up CloudTrail..."

    local trail_name="vaidyalink-$ENVIRONMENT-trail"
    local bucket_name="vaidyalink-$ENVIRONMENT-cloudtrail"

    # Create CloudTrail bucket
    if aws s3 ls "s3://$bucket_name" 2>&1 | grep -q 'NoSuchBucket'; then
        aws s3 mb "s3://$bucket_name" --region $AWS_REGION

        # Apply bucket policy for CloudTrail
        aws s3api put-bucket-policy \
            --bucket "$bucket_name" \
            --policy '{
                "Version": "2012-10-17",
                "Statement": [{
                    "Sid": "AWSCloudTrailAclCheck",
                    "Effect": "Allow",
                    "Principal": {"Service": "cloudtrail.amazonaws.com"},
                    "Action": "s3:GetBucketAcl",
                    "Resource": "arn:aws:s3:::'$bucket_name'"
                }, {
                    "Sid": "AWSCloudTrailWrite",
                    "Effect": "Allow",
                    "Principal": {"Service": "cloudtrail.amazonaws.com"},
                    "Action": "s3:PutObject",
                    "Resource": "arn:aws:s3:::'$bucket_name'/AWSLogs/'$AWS_ACCOUNT_ID'/*",
                    "Condition": {
                        "StringEquals": {"s3:x-amz-acl": "bucket-owner-full-control"}
                    }
                }]
            }'
    fi

    # Create trail
    if ! aws cloudtrail describe-trails --trail-name-list "$trail_name" | grep -q "$trail_name"; then
        aws cloudtrail create-trail \
            --name "$trail_name" \
            --s3-bucket-name "$bucket_name" \
            --is-multi-region-trail \
            --enable-log-file-validation

        aws cloudtrail start-logging --name "$trail_name"

        print_info "CloudTrail configured: $trail_name"
    else
        print_info "CloudTrail already exists: $trail_name"
    fi
}

# Function to create parameter store values
create_parameter_store() {
    print_info "Creating Parameter Store values..."

    local params=(
        "/vaidyalink/$ENVIRONMENT/bedrock/model-id"
        "/vaidyalink/$ENVIRONMENT/confidence/threshold"
    )

    # These will be created by CDK, but we can set initial values here
    print_info "Parameter Store values will be managed by CDK"
}

# Function to display summary
display_summary() {
    print_info "========================================="
    print_info "Environment Setup Complete!"
    print_info "========================================="
    print_info "Environment: $ENVIRONMENT"
    print_info "AWS Account: $AWS_ACCOUNT_ID"
    print_info "AWS Region: $AWS_REGION"
    print_info "Domain: $DOMAIN_NAME"
    print_info "========================================="
    print_info "Next steps:"
    print_info "1. Configure domain and SSL certificates (Task 2.7)"
    print_info "2. Deploy Lambda functions"
    print_info "3. Deploy frontend to Vercel"
    print_info "4. Configure GitHub Actions secrets"
    print_info "========================================="
}

# Main execution
main() {
    echo "========================================="
    echo "VaidyaLink Environment Setup"
    echo "========================================="

    # Check if environment parameter is provided
    if [ $# -eq 0 ]; then
        print_error "Usage: $0 <staging|prod>"
        exit 1
    fi

    local environment=$1
    validate_environment "$environment"

    # Change to infrastructure directory
    cd "$(dirname "$0")/.."

    # Run checks
    check_aws_cli
    check_cdk
    check_jq

    # Load configuration
    load_config "$environment"

    # Verify AWS credentials
    verify_aws_credentials

    # Confirm before proceeding
    print_warning "This will set up the $ENVIRONMENT environment in AWS account $AWS_ACCOUNT_ID"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Setup cancelled"
        exit 0
    fi

    # Execute setup steps
    bootstrap_cdk
    create_s3_buckets
    create_kms_keys
    setup_cloudtrail
    deploy_cdk_stacks

    # Display summary
    display_summary
}

# Run main function
main "$@"
