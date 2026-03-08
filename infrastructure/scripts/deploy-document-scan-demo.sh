#!/bin/bash

# Deploy Document Scan Demo Infrastructure
# This script deploys the AWS infrastructure for document-scan-demo

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
SARVAM_API_KEY=""
AUTO_APPROVE=false

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Document Scan Demo infrastructure to AWS

OPTIONS:
    -e, --environment ENV       Environment to deploy (dev, staging, prod). Default: dev
    -k, --api-key KEY          Sarvam API key to store in Secrets Manager
    -y, --yes                  Auto-approve deployment without confirmation
    -h, --help                 Display this help message

EXAMPLES:
    # Deploy to development
    $0 -e dev -k "your-api-key"

    # Deploy to production with auto-approval
    $0 -e prod -k "your-api-key" -y

    # Deploy without setting API key (can be set later)
    $0 -e dev

EOF
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -k|--api-key)
            SARVAM_API_KEY="$2"
            shift 2
            ;;
        -y|--yes)
            AUTO_APPROVE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod."
    exit 1
fi

print_info "Starting deployment for environment: $ENVIRONMENT"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    print_error "AWS CDK is not installed. Please install it: npm install -g aws-cdk"
    exit 1
fi

# Check AWS credentials
print_info "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Please run 'aws configure'"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

print_info "AWS Account: $ACCOUNT_ID"
print_info "AWS Region: $REGION"

# Navigate to infrastructure directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Install dependencies
print_info "Installing dependencies..."
npm install

# Bootstrap CDK if needed
print_info "Checking CDK bootstrap status..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
    print_warning "CDK not bootstrapped. Bootstrapping now..."
    cdk bootstrap aws://$ACCOUNT_ID/$REGION
fi

# Deploy the stack
print_info "Deploying infrastructure..."
if [ "$AUTO_APPROVE" = true ]; then
    cdk deploy VaidyaLink-$ENVIRONMENT --require-approval never
else
    cdk deploy VaidyaLink-$ENVIRONMENT
fi

# Store Sarvam API key if provided
if [ -n "$SARVAM_API_KEY" ]; then
    print_info "Storing Sarvam API key in Secrets Manager..."

    SECRET_NAME="document-scan/sarvam-api-key-$ENVIRONMENT"

    # Check if secret exists
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" &> /dev/null; then
        # Update existing secret
        aws secretsmanager update-secret \
            --secret-id "$SECRET_NAME" \
            --secret-string "{\"apiKey\":\"$SARVAM_API_KEY\"}"
        print_info "Updated existing secret: $SECRET_NAME"
    else
        # Create new secret
        aws secretsmanager create-secret \
            --name "$SECRET_NAME" \
            --description "Sarvam API key for document-scan-demo" \
            --secret-string "{\"apiKey\":\"$SARVAM_API_KEY\"}"
        print_info "Created new secret: $SECRET_NAME"
    fi
else
    print_warning "No Sarvam API key provided. You can set it later with:"
    print_warning "  aws secretsmanager update-secret --secret-id document-scan/sarvam-api-key-$ENVIRONMENT --secret-string '{\"apiKey\":\"YOUR_KEY\"}'"
fi

# Get stack outputs
print_info "Retrieving stack outputs..."
OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name VaidyaLink-$ENVIRONMENT \
    --query 'Stacks[0].Outputs' \
    --output json)

# Extract important values
DOCUMENT_BUCKET=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="DocumentScanDocumentsBucketName") | .OutputValue')
AUDIO_BUCKET=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="DocumentScanAudioBucketName") | .OutputValue')
JOBS_TABLE=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="DocumentScanJobsTableName") | .OutputValue')
API_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="RestApiUrl") | .OutputValue')

# Display deployment summary
print_info "=========================================="
print_info "Deployment Complete!"
print_info "=========================================="
echo ""
print_info "Environment: $ENVIRONMENT"
print_info "Region: $REGION"
echo ""
print_info "Resources Created:"
print_info "  Documents Bucket: $DOCUMENT_BUCKET"
print_info "  Audio Bucket: $AUDIO_BUCKET"
print_info "  Jobs Table: $JOBS_TABLE"
print_info "  API URL: $API_URL"
echo ""
print_info "Next Steps:"
print_info "  1. Update frontend .env.local with these values"
print_info "  2. Deploy Lambda functions for document and voice processing"
print_info "  3. Test the integration with a sample upload"
echo ""
print_info "Frontend Configuration:"
echo "NEXT_PUBLIC_API_URL=$API_URL"
echo "NEXT_PUBLIC_AWS_REGION=$REGION"
echo "NEXT_PUBLIC_DOCUMENT_BUCKET=$DOCUMENT_BUCKET"
echo "NEXT_PUBLIC_AUDIO_BUCKET=$AUDIO_BUCKET"
echo "NEXT_PUBLIC_DEMO_MODE=false"
echo ""
print_info "=========================================="
