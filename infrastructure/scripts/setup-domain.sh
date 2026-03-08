#!/bin/bash

# VaidyaLink Domain and SSL Certificate Setup Script
# This script configures Route53 domains and ACM certificates

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
        print_error "Invalid environment. Must be 'staging' or 'prod'"
        exit 1
    fi
}

# Function to load configuration
load_config() {
    local env=$1
    local config_file
{
    print_info "Checking for existing hosted zone..."

    local hosted_zone_id=$(aws route53 list-hosted-zones-by-name \
        --dns-name "$DOMAIN_NAME" \
        --query "HostedZones[?Name=='${DOMAIN_NAME}.'].Id" \
        --output text | cut -d'/' -f3)

    if [ -z "$hosted_zone_id" ]; then
        print_info "No existing hosted zone found for $DOMAIN_NAME"
        echo ""
    else
        print_info "Found existing hosted zone: $hosted_zone_id"
        echo "$hosted_zone_id"
    fi
}

# Function to create hosted zone
create_hosted_zone() {
    print_info "Creating Route53 hosted zone for $DOMAIN_NAME..."

    local caller_reference="vaidyalink-$ENVIRONMENT-$(date +%s)"

    local hosted_zone_id=$(aws route53 create-hosted-zone \
        --name "$DOMAIN_NAME" \
        --caller-reference "$caller_reference" \
        --hosted-zone-config Comment="VaidyaLink $ENVIRONMENT environment" \
        --query 'HostedZone.Id' \
        --output text | cut -d'/' -f3)

    print_info "Hosted zone created: $hosted_zone_id"

    # Get nameservers
    local nameservers=$(aws route53 get-hosted-zone \
        --id "$hosted_zone_id" \
        --query 'DelegationSet.NameServers' \
        --output json)

    print_info "Nameservers for $DOMAIN_NAME:"
    echo "$nameservers" | jq -r '.[]' | while read ns; do
        echo "  - $ns"
    done

    print_warning "⚠️  Update your domain registrar with these nameservers!"

    echo "$hosted_zone_id"
}

# Function to request ACM certificate
request_certificate() {
    local hosted_zone_id=$1

    print_info "Requesting ACM certificate for $DOMAIN_NAME..."

    # Determine domain names based on environment
    local domain_names="$DOMAIN_NAME"
    if [ "$ENVIRONMENT" == "prod" ]; then
        domain_names="$DOMAIN_NAME,www.$DOMAIN_NAME,api.$DOMAIN_NAME"
    else
        domain_names="$DOMAIN_NAME,api.$DOMAIN_NAME"
    fi

    # Request certificate
    local cert_arn=$(aws acm request-certificate \
        --domain-name "$DOMAIN_NAME" \
        --subject-alternative-names $(echo $domain_names | tr ',' ' ') \
        --validation-method DNS \
        --region us-east-1 \
        --query 'CertificateArn' \
        --output text)

    print_info "Certificate requested: $cert_arn"

    # Wait for certificate to be issued (DNS validation records)
    print_info "Waiting for DNS validation records..."
    sleep 10

    # Get validation records
    local validation_records=$(aws acm describe-certificate \
        --certificate-arn "$cert_arn" \
        --region us-east-1 \
        --query 'Certificate.DomainValidationOptions[].ResourceRecord' \
        --output json)

    print_info "DNS validation records:"
    echo "$validation_records" | jq -r '.[] | "  Name: \(.Name)\n  Type: \(.Type)\n  Value: \(.Value)\n"'

    # Create validation records in Route53
    print_info "Creating DNS validation records in Route53..."

    echo "$validation_records" | jq -c '.[]' | while read record; do
        local name=$(echo "$record" | jq -r '.Name')
        local type=$(echo "$record" | jq -r '.Type')
        local value=$(echo "$record" | jq -r '.Value')

        # Create change batch
        local change_batch=$(cat <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "$name",
      "Type": "$type",
      "TTL": 300,
      "ResourceRecords": [{"Value": "$value"}]
    }
  }]
}
EOF
)

        aws route53 change-resource-record-sets \
            --hosted-zone-id "$hosted_zone_id" \
            --change-batch "$change_batch" > /dev/null

        print_info "Created validation record: $name"
    done

    print_info "Waiting for certificate validation (this may take several minutes)..."
    aws acm wait certificate-validated \
        --certificate-arn "$cert_arn" \
        --region us-east-1

    print_info "Certificate validated and issued!"

    echo "$cert_arn"
}

# Function to request regional certificate for API Gateway
request_regional_certificate() {
    local hosted_zone_id=$1

    print_info "Requesting regional ACM certificate for API Gateway..."

    local api_domain="api.$DOMAIN_NAME"

    # Request certificate in the same region as API Gateway
    local cert_arn=$(aws acm request-certificate \
        --domain-name "$api_domain" \
        --validation-method DNS \
        --region "$AWS_REGION" \
        --query 'CertificateArn' \
        --output text)

    print_info "Regional certificate requested: $cert_arn"

    # Wait for validation records
    sleep 10

    # Get validation records
    local validation_records=$(aws acm describe-certificate \
        --certificate-arn "$cert_arn" \
        --region "$AWS_REGION" \
        --query 'Certificate.DomainValidationOptions[].ResourceRecord' \
        --output json)

    # Create validation records
    echo "$validation_records" | jq -c '.[]' | while read record; do
        local name=$(echo "$record" | jq -r '.Name')
        local type=$(echo "$record" | jq -r '.Type')
        local value=$(echo "$record" | jq -r '.Value')

        local change_batch=$(cat <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "$name",
      "Type": "$type",
      "TTL": 300,
      "ResourceRecords": [{"Value": "$value"}]
    }
  }]
}
EOF
)

        aws route53 change-resource-record-sets \
            --hosted-zone-id "$hosted_zone_id" \
            --change-batch "$change_batch" > /dev/null
    done

    print_info "Waiting for regional certificate validation..."
    aws acm wait certificate-validated \
        --certificate-arn "$cert_arn" \
        --region "$AWS_REGION"

    print_info "Regional certificate validated!"

    echo "$cert_arn"
}

# Function to create DNS records for API Gateway
create_api_dns_records() {
    local hosted_zone_id=$1
    local api_endpoint=$2

    print_info "Creating DNS record for API Gateway..."

    local api_domain="api.$DOMAIN_NAME"

    # Extract API Gateway domain from endpoint
    local api_gateway_domain=$(echo "$api_endpoint" | sed 's|https://||' | sed 's|/.*||')

    # Create CNAME record
    local change_batch=$(cat <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "$api_domain",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "$api_gateway_domain"}]
    }
  }]
}
EOF
)

    aws route53 change-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --change-batch "$change_batch"

    print_info "DNS record created: $api_domain -> $api_gateway_domain"
}

# Function to save certificate ARNs
save_certificate_arns() {
    local cloudfront_cert=$1
    local regional_cert=$2

    local output_file="certificate-arns-$ENVIRONMENT.json"

    cat > "$output_file" <<EOF
{
  "environment": "$ENVIRONMENT",
  "domain": "$DOMAIN_NAME",
  "certificates": {
    "cloudfront": "$cloudfront_cert",
    "apiGateway": "$regional_cert"
  },
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

    print_info "Certificate ARNs saved to $output_file"
}

# Function to display summary
display_summary() {
    local hosted_zone_id=$1
    local cloudfront_cert=$2
    local regional_cert=$3

    print_info "========================================="
    print_info "Domain and SSL Setup Complete!"
    print_info "========================================="
    print_info "Environment: $ENVIRONMENT"
    print_info "Domain: $DOMAIN_NAME"
    print_info "Hosted Zone ID: $hosted_zone_id"
    print_info "CloudFront Certificate: $cloudfront_cert"
    print_info "API Gateway Certificate: $regional_cert"
    print_info "========================================="
    print_info "Next steps:"
    print_info "1. Verify nameservers are updated at domain registrar"
    print_info "2. Wait for DNS propagation (up to 48 hours)"
    print_info "3. Deploy frontend with custom domain"
    print_info "4. Configure API Gateway custom domain"
    print_info "5. Test HTTPS access"
    print_info "========================================="
}

# Main execution
main() {
    echo "========================================="
    echo "VaidyaLink Domain and SSL Setup"
    echo "========================================="

    if [ $# -eq 0 ]; then
        print_error "Usage: $0 <staging|prod> [api-endpoint]"
        print_info "Example: $0 staging https://abc123.execute-api.ap-south-1.amazonaws.com/staging"
        exit 1
    fi

    local environment=$1
    local api_endpoint=$2

    validate_environment "$environment"

    # Change to infrastructure directory
    cd "$(dirname "$0")/.."

    # Load configuration
    load_config "$environment"

    # Check for existing hosted zone
    local hosted_zone_id=$(check_hosted_zone)

    if [ -z "$hosted_zone_id" ]; then
        # Create new hosted zone
        hosted_zone_id=$(create_hosted_zone)

        print_warning "Please update your domain registrar with the nameservers shown above"
        read -p "Press Enter after updating nameservers to continue..."
    fi

    # Request CloudFront certificate (us-east-1)
    local cloudfront_cert=$(request_certificate "$hosted_zone_id")

    # Request regional certificate for API Gateway
    local regional_cert=$(request_regional_certificate "$hosted_zone_id")

    # Create API DNS records if endpoint provided
    if [ -n "$api_endpoint" ]; then
        create_api_dns_records "$hosted_zone_id" "$api_endpoint"
    else
        print_warning "API endpoint not provided. Skipping API DNS record creation."
        print_info "Run this script again with API endpoint after deployment:"
        print_info "  $0 $environment <api-endpoint>"
    fi

    # Save certificate ARNs
    save_certificate_arns "$cloudfront_cert" "$regional_cert"

    # Display summary
    display_summary "$hosted_zone_id" "$cloudfront_cert" "$regional_cert"
}

# Run main function
main "$@"
