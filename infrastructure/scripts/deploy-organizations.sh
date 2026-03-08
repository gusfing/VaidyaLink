#!/bin/bash

# VaidyaLink AWS Organizations Deployment Script
# This script helps deploy AWS Organizations infrastructure

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

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi

    # Check if CDK is installed
    if ! command -v cdk &> /dev/null; then
        print_error "AWS CDK is not installed. Please install it first: npm install -g aws-cdk"
        exit 1
    fi

    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed. So
 for environment: ${env}"

    if [ ! -f "$config_file" ]; then
        print_error "Configuration file not found: ${config_file}"
        exit 1
    fi

    # Check if organizations is enabled
    local org_enabled=$(jq -r '.organizations.enabled' "$config_file" 2>/dev/null || echo "false")

    if [ "$org_enabled" != "true" ]; then
        print_warning "AWS Organizations is not enabled in ${config_file}"
        print_warning "Set 'organizations.enabled' to true to enable Organizations"
        exit 0
    fi

    # Validate email addresses
    local emails=$(jq -r '.organizations.accountEmails | to_entries[] | .value' "$config_file" 2>/dev/null)

    if [ -z "$emails" ]; then
        print_error "No account email addresses configured in ${config_file}"
        exit 1
    fi

    print_info "Configuration validation passed!"
}

# Function to display deployment plan
show_deployment_plan() {
    local env=$1
    local config_file="config/${env}.json"

    print_info "Deployment Plan for ${env} environment:"
    echo ""
    echo "AWS Organization Structure:"
    echo "  Root"
    echo "  ├── Workloads OU"

    local dev_email=$(jq -r '.organizations.accountEmails.dev // empty' "$config_file")
    local staging_email=$(jq -r '.organizations.accountEmails.staging // empty' "$config_file")
    local prod_email=$(jq -r '.organizations.accountEmails.prod // empty' "$config_file")

    [ -n "$dev_email" ] && echo "  │   ├── VaidyaLink-Dev ($dev_email)"
    [ -n "$staging_email" ] && echo "  │   ├── VaidyaLink-Staging ($staging_email)"
    [ -n "$prod_email" ] && echo "  │   └── VaidyaLink-Prod ($prod_email)"

    echo "  └── Security OU"

    local security_email=$(jq -r '.organizations.accountEmails.security // empty' "$config_file")
    local logging_email=$(jq -r '.organizations.accountEmails.logging // empty' "$config_file")

    [ -n "$security_email" ] && echo "      ├── VaidyaLink-Security ($security_email)"
    [ -n "$logging_email" ] && echo "      └── VaidyaLink-Logging ($logging_email)"

    echo ""
    echo "Service Control Policies:"
    echo "  - Base SCP (applied to all accounts)"
    echo "  - HIPAA Compliance SCP (applied to staging and prod)"
    echo ""
}

# Function to deploy Organizations
deploy_organizations() {
    local env=$1

    print_info "Deploying AWS Organizations for ${env} environment..."

    # Bootstrap if needed
    print_info "Checking CDK bootstrap status..."
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local region=$(jq -r '.region' "config/${env}.json")

    if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region "$region" &> /dev/null; then
        print_info "Bootstrapping CDK in account ${account_id} region ${region}..."
        cdk bootstrap "aws://${account_id}/${region}"
    else
        print_info "CDK already bootstrapped"
    fi

    # Deploy the stack
    print_info "Deploying VaidyaLink-${env} stack..."
    cdk deploy "VaidyaLink-${env}" --context env="${env}" --require-approval never

    print_info "Deployment completed successfully!"
}

# Function to show post-deployment steps
show_post_deployment() {
    print_info "Post-Deployment Steps:"
    echo ""
    echo "1. Check your email for account invitation emails"
    echo "2. Accept the invitations for each member account"
    echo "3. Enable required AWS services in each account:"
    echo "   - GuardDuty"
    echo "   - Security Hub"
    echo "   - AWS Config"
    echo ""
    echo "4. Configure cross-account access for CI/CD"
    echo "5. Set up billing alerts in the management account"
    echo ""
    echo "For detailed instructions, see: docs/ORGANIZATIONS_SETUP.md"
    echo ""
}

# Main script
main() {
    echo "=========================================="
    echo "VaidyaLink AWS Organizations Deployment"
    echo "=========================================="
    echo ""

    # Get environment from argument or prompt
    local env=${1:-}

    if [ -z "$env" ]; then
        echo "Usage: $0 <environment>"
        echo "Example: $0 prod"
        echo ""
        echo "Available environments: dev, staging, prod"
        exit 1
    fi

    # Validate environment
    if [[ ! "$env" =~ ^(dev|staging|prod)$ ]]; then
        print_error "Invalid environment: ${env}"
        echo "Valid environments: dev, staging, prod"
        exit 1
    fi

    # Run checks
    check_prerequisites
    validate_config "$env"

    # Show deployment plan
    show_deployment_plan "$env"

    # Confirm deployment
    print_warning "This will create AWS Organizations and member accounts."
    print_warning "This action cannot be easily undone."
    echo ""
    read -p "Do you want to proceed? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        print_info "Deployment cancelled."
        exit 0
    fi

    # Deploy
    deploy_organizations "$env"

    # Show next steps
    show_post_deployment
}

# Run main function
main "$@"
