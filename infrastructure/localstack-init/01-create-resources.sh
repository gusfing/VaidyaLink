#!/bin/bash

# LocalStack initialization script
# This script creates all necessary AWS resources for local development

set -e

echo "Initializing LocalStack resources for VaidyaLink..."

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
sleep 10

# Set AWS endpoint
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_REGION=ap-south-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

# =============================================================================
# S3 Buckets
# =============================================================================
echo "Creating S3 buckets..."

buckets=(
    "vaidyalink-local-documents"
    "vaidyalink-local-audio"
    "vaidyalink-local-exports"
    "vaidyalink-local-logs"
)

for bucket in "${buckets[@]}"; do
    awslocal s3 mb "s3://$bucket" 2>/dev/null || echo "Bucket $bucket already exists"
    echo "✓ Created bucket: $bucket"
done

# =============================================================================
# DynamoDB Tables
# =============================================================================
echo "Creating DynamoDB tables..."

# ScanJobs table
awslocal dynamodb create-table \
    --table-name vaidyalink-local-ScanJobs \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
ts=5 \
    2>/dev/null || echo "Table ScanJobs already exists"

echo "✓ Created table: ScanJobs"

# Patients table
awslocal dynamodb create-table \
    --table-name vaidyalink-local-Patients \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=abhaId,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
        "IndexName=AbhaIdIndex,KeySchema=[{AttributeName=abhaId,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}" \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    2>/dev/null || echo "Table Patients already exists"

echo "✓ Created table: Patients"

# VoiceJobs table
awslocal dynamodb create-table \
    --table-name vaidyalink-local-VoiceJobs \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=patientId,AttributeType=S \
        AttributeName=createdAt,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
        "IndexName=PatientIndex,KeySchema=[{AttributeName=patientId,KeyType=HASH},{AttributeName=createdAt,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}" \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    2>/dev/null || echo "Table VoiceJobs already exists"

echo "✓ Created table: VoiceJobs"

# =============================================================================
# SQS Queues
# =============================================================================
echo "Creating SQS queues..."

queues=(
    "vaidyalink-local-hitl-queue"
    "vaidyalink-local-hitl-dlq"
    "vaidyalink-local-processing-queue"
)

for queue in "${queues[@]}"; do
    awslocal sqs create-queue --queue-name "$queue" 2>/dev/null || echo "Queue $queue already exists"
    echo "✓ Created queue: $queue"
done

# =============================================================================
# SNS Topics
# =============================================================================
echo "Creating SNS topics..."

topics=(
    "vaidyalink-local-notifications"
    "vaidyalink-local-alerts"
)

for topic in "${topics[@]}"; do
    awslocal sns create-topic --name "$topic" 2>/dev/null || echo "Topic $topic already exists"
    echo "✓ Created topic: $topic"
done

# =============================================================================
# Cognito User Pool
# =============================================================================
echo "Creating Cognito user pool..."

awslocal cognito-idp create-user-pool \
    --pool-name vaidyalink-local-users \
    --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
    --auto-verified-attributes email \
    --username-attributes email \
    2>/dev/null || echo "User pool already exists"

echo "✓ Created Cognito user pool"

# =============================================================================
# KMS Keys
# =============================================================================
echo "Creating KMS keys..."

awslocal kms create-key \
    --description "VaidyaLink local encryption key" \
    --key-usage ENCRYPT_DECRYPT \
    2>/dev/null || echo "KMS key already exists"

echo "✓ Created KMS key"

# =============================================================================
# Secrets Manager
# =============================================================================
echo "Creating secrets..."

awslocal secretsmanager create-secret \
    --name vaidyalink/local/abdm/credentials \
    --secret-string '{"clientId":"test-client-id","clientSecret":"test-client-secret"}' \
    2>/dev/null || echo "Secret abdm/credentials already exists"

awslocal secretsmanager create-secret \
    --name vaidyalink/local/bhashini/api-key \
    --secret-string '{"apiKey":"test-api-key"}' \
    2>/dev/null || echo "Secret bhashini/api-key already exists"

echo "✓ Created secrets"

# =============================================================================
# EventBridge Rules
# =============================================================================
echo "Creating EventBridge rules..."

awslocal events put-rule \
    --name vaidyalink-local-s3-upload \
    --event-pattern '{"source":["aws.s3"],"detail-type":["Object Created"]}' \
    2>/dev/null || echo "EventBridge rule already exists"

echo "✓ Created EventBridge rules"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "========================================="
echo "LocalStack initialization complete!"
echo "========================================="
echo "Resources created:"
echo "  - S3 buckets: ${#buckets[@]}"
echo "  - DynamoDB tables: 3"
echo "  - SQS queues: ${#queues[@]}"
echo "  - SNS topics: ${#topics[@]}"
echo "  - Cognito user pool: 1"
echo "  - KMS keys: 1"
echo "  - Secrets: 2"
echo "========================================="
echo ""
echo "Access LocalStack services at: http://localhost:4566"
echo "DynamoDB Admin UI: http://localhost:8001"
echo "Mailhog UI: http://localhost:8025"
echo ""
