#!/bin/bash

# Script to attach Service Control Policies to OUs and Accounts
# Run this after deploying the Organizations stack

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get stack outputs
get_stack_output() {
    local stack_name=$1
    local output_key=$2
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text
}

# Main script
main() {
    local env=${1:-prod}
    local stack_name="vaidyalink-${env}"

    print_info "Attaching Service Control Policies for ${env} environment..."

    # Get policy and OU IDs from stack outputs
    print_info "Retrieving stack outputs..."

    BASE_SCP_ID=$(get_stack_output "$stack_name" "BaseSCPId")
    HIPAA_SCP_ID=$(get_stack_output "$stack_name" "HIPAASCPId")
    WORKLOADS_OU_ID=$(get_stack_output "$stack_name" "WorkloadsOUId")
    SECURITY_OU_ID=$(get_stack_output "$stack_name" "SecurityOUId")

    if [ -z "$BASE_SCP_ID" ] || [ -z "$HIPAA_SCP_ID" ]; then
        print_error "Could not retrieve policy IDs from stack outputs"
        print_error "Make sure the Organizations stack is deployed"
        exit 1
    fi

    print_info "Base SCP ID: $BASE_SCP_ID"
    print_info "HIPAA SCP ID: $HIPAA_SCP_ID"
    print_info "Workloads OU ID: $WORKLOADS_OU_ID"
    print_info "Security OU ID: $SECURITY_OU_ID"

    # Attach Base SCP to Workloads OU
    print_info "Attaching Base SCP to Workloads OU..."
    if aws organizations attach-policy \
        --policy-id "$BASE_SCP_ID" \
        --target-id "$WORKLOADS_OU_ID" 2>/dev/null; then
        print_info "✓ Base SCP attached to Workloads OU"
    else
        print_warning "Base SCP may already be attached to Workloads OU"
    fi

    # Attach Base SCP to Security OU
    print_info "Attaching Base SCP to Security OU..."
    if aws organizations attach-policy \
        --policy-id "$BASE_SCP_ID" \
        --target-id "$SECURITY_OU_ID" 2>/dev/null; then
        print_info "✓ Base SCP attached to Security OU"
    else
        print_warning "Base SCP may already be attached to Security OU"
    fi

    # Get account IDs
    STAGING_ACCOUNT_ID=$(get_stack_output "$stack_name" "StagingAccountId")
    PROD_ACCOUNT_ID=$(get_stack_output "$stack_name" "ProdAccountId")

    # Attach HIPAA SCP to Staging Account
    if [ -n "$STAGING_ACCOUNT_ID" ]; then
        print_info "Attaching HIPAA SCP to Staging Account ($STAGING_ACCOUNT_ID)..."
        if aws organizations attach-policy \
            --policy-id "$HIPAA_SCP_ID" \
            --target-id "$STAGING_ACCOUNT_ID" 2>/dev/null; then
            print_info "✓ HIPAA SCP attached to Staging Account"
        else
            print_warning "HIPAA SCP may already be attached to Staging Account"
        fi
    fi

    # Attach HIPAA SCP to Production Account
    if [ -n "$PROD_ACCOUNT_ID" ]; then
        print_info "Attaching HIPAA SCP to Production Account ($PROD_ACCOUNT_ID)..."
        if aws organizations attach-policy \
            --policy-id "$HIPAA_SCP_ID" \
            --target-id "$PROD_ACCOUNT_ID" 2>/dev/null; then
            print_info "✓ HIPAA SCP attached to Production Account"
        else
            print_warning "HIPAA SCP may already be attached to Production Account"
        fi
    fi

    print_info "SCP attachment completed!"
    echo ""
    print_info "To verify attachments, run:"
    echo "  aws organizations list-policies-for-target --target-id $WORKLOADS_OU_ID --filter SERVICE_CONTROL_POLICY"
}

# Run main function
main "$@"
