#!/bin/bash

# Script to set Sarvam API key in AWS Secrets Manager
# Usage: ./set-sarvam-api-key.sh <environment> <api-key>

set -e

# Check arguments
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <environment> <api-key>"
    echo "Example: $0 dev sk_sarvam_abc123xyz"
    exit 1
fi

ENVIRONMENT=$1
API_KEY=$2

SECRET_NAME="document-scan/sarvam-api-key-${ENVIRONMENT}"

echo "Setting Sarvam API key for environment: ${ENVIRONMENT}"
echo "Secret name: ${SECRET_NAME}"

# Create JSON payload
SECRET_VALUE=$(cat <<EOF
{
  "apiKey": "${API_KEY}"
}
EOF
)

# Update the secret
aws secretsmanager update-secret \
    --secret-id "${SECRET_NAME}" \
    --secret-string "${SECRET_VALUE}" \
    --region "${AWS_REGION:-us-east-1}"

if [ $? -eq 0 ]; then
    echo "✓ Successfully updated Sarvam API key in Secrets Manager"
    echo "Secret ARN: $(aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --query 'ARN' --output text --region "${AWS_REGION:-us-east-1}")"
else
    echo "✗ Failed to update secret"
    exit 1
fi
