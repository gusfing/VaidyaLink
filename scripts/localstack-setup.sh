#!/bin/bash

# LocalStack Setup and Testing Script
# This script helps set up and verify LocalStack for VaidyaLink development

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if LocalStack is running
check_localstack() {
    print_info "Checking if LocalStack is running..."

    if curl -s http://localhost:4566/_localstack/health > /dev/null 2>&1; then
        print_info "✓ LocalStack is running"
        return 0
    else
        print_error "✗ LocalStack is not running"
        print_info "Start LocalStack with: docker-compose up localstack"
        return 1
    fi
}

# Wait for LocalStack to be ready
wait_for_localstack() {
    print_info "Waiting for LocalStack to be ready..."

    max_attempts=30
    attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:4566/_localstack/health > /dev/null 2>&1; then
            print_info "✓ LocalStack is ready"
            return 0
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    print_error "✗ LocalStack failed to start within 60 seconds"
    return 1
}

# Test S3
test_s3() {
    print_info "Testing S3..."

    # List buckets
    buckets=$(awslocal s3 ls | wc -l)
    print_info "Found $buckets S3 buckets"

    # Test upload
    echo "test" > /tmp/test-file.txt
    awslocal s3 cp /tmp/test-file.txt s3://vaidyalink-local-documents/test/

    # Test download
    awslocal s3 cp s3://vaidyalink-loca

        --table-name vaidyalink-local-ScanJobs \
        --item '{
            "PK": {"S": "TEST#123"},
            "SK": {"S": "METADATA"},
            "jobId": {"S": "test-123"},
            "status": {"S": "pending"}
        }'

    # Test read
    awslocal dynamodb get-item \
        --table-name vaidyalink-local-ScanJobs \
        --key '{"PK": {"S": "TEST#123"}, "SK": {"S": "METADATA"}}' \
        > /dev/null

    # Cleanup
    awslocal dynamodb delete-item \
        --table-name vaidyalink-local-ScanJobs \
        --key '{"PK": {"S": "TEST#123"}, "SK": {"S": "METADATA"}}'

    print_info "✓ DynamoDB test passed"
}

# Test SQS
test_sqs() {
    print_info "Testing SQS..."

    # Get queue URL
    queue_url=$(awslocal sqs get-queue-url \
        --queue-name vaidyalink-local-hitl-queue \
        --query 'QueueUrl' --output text)

    # Send message
    awslocal sqs send-message \
        --queue-url "$queue_url" \
        --message-body "Test message" \
        > /dev/null

    # Receive message
    awslocal sqs receive-message \
        --queue-url "$queue_url" \
        --max-number-of-messages 1 \
        > /dev/null

    print_info "✓ SQS test passed"
}

# Test SNS
test_sns() {
    print_info "Testing SNS..."

    # Get topic ARN
    topic_arn=$(awslocal sns list-topics \
        --query 'Topics[?contains(TopicArn, `vaidyalink-local-notifications`)].TopicArn' \
        --output text)

    # Publish message
    awslocal sns publish \
        --topic-arn "$topic_arn" \
        --message "Test notification" \
        > /dev/null

    print_info "✓ SNS test passed"
}

# Test Secrets Manager
test_secrets() {
    print_info "Testing Secrets Manager..."

    # Get secret
    awslocal secretsmanager get-secret-value \
        --secret-id vaidyalink/local/abdm/credentials \
        > /dev/null

    print_info "✓ Secrets Manager test passed"
}

# Display resource summary
show_resources() {
    print_info "========================================="
    print_info "LocalStack Resources Summary"
    print_info "========================================="

    # S3 Buckets
    print_info "S3 Buckets:"
    awslocal s3 ls | awk '{print "  - " $3}'

    # DynamoDB Tables
    print_info "\nDynamoDB Tables:"
    awslocal dynamodb list-tables --query 'TableNames[]' --output text | tr '\t' '\n' | awk '{print "  - " $1}'

    # SQS Queues
    print_info "\nSQS Queues:"
    awslocal sqs list-queues --query 'QueueUrls[]' --output text | tr '\t' '\n' | awk -F'/' '{print "  - " $NF}'

    # SNS Topics
    print_info "\nSNS Topics:"
    awslocal sns list-topics --query 'Topics[].TopicArn' --output text | tr '\t' '\n' | awk -F':' '{print "  - " $NF}'

    # Secrets
    print_info "\nSecrets:"
    awslocal secretsmanager list-secrets --query 'SecretList[].Name' --output text | tr '\t' '\n' | awk '{print "  - " $1}'

    print_info "========================================="
}

# Main menu
show_menu() {
    echo ""
    echo "LocalStack Setup Menu"
    echo "====================="
    echo "1. Check LocalStack status"
    echo "2. Wait for LocalStack to be ready"
    echo "3. Run all tests"
    echo "4. Test S3"
    echo "5. Test DynamoDB"
    echo "6. Test SQS"
    echo "7. Test SNS"
    echo "8. Test Secrets Manager"
    echo "9. Show resources"
    echo "0. Exit"
    echo ""
}

# Main execution
main() {
    # Check if awslocal is installed
    if ! command -v awslocal &> /dev/null; then
        print_error "awslocal is not installed"
        print_info "Install with: pip install awscli-local"
        exit 1
    fi

    if [ $# -eq 0 ]; then
        # Interactive mode
        while true; do
            show_menu
            read -p "Select option: " choice

            case $choice in
                1) check_localstack ;;
                2) wait_for_localstack ;;
                3)
                    check_localstack && \
                    test_s3 && \
                    test_dynamodb && \
                    test_sqs && \
                    test_sns && \
                    test_secrets && \
                    print_info "✓ All tests passed!"
                    ;;
                4) test_s3 ;;
                5) test_dynamodb ;;
                6) test_sqs ;;
                7) test_sns ;;
                8) test_secrets ;;
                9) show_resources ;;
                0) exit 0 ;;
                *) print_error "Invalid option" ;;
            esac
        done
    else
        # Command line mode
        case $1 in
            check) check_localstack ;;
            wait) wait_for_localstack ;;
            test)
                check_localstack && \
                test_s3 && \
                test_dynamodb && \
                test_sqs && \
                test_sns && \
                test_secrets && \
                print_info "✓ All tests passed!"
                ;;
            resources) show_resources ;;
            *)
                print_error "Unknown command: $1"
                print_info "Usage: $0 [check|wait|test|resources]"
                exit 1
                ;;
        esac
    fi
}

main "$@"
