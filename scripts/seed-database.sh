#!/bin/bash

# Database Seeding Script for VaidyaLink Local Development
# This script populates LocalStack DynamoDB with test data

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if LocalStack is running
if ! curl -s http://localhost:4566/_localstack/health > /dev/null 2>&1; then
    print_warning "LocalStack is not running. Start it with: docker-compose up localstack"
    exit 1
fi

print_info "Seeding database with test data..."

# =============================================================================
# Seed Patients
# =============================================================================
print_info "Seeding Patients table..."

# Patient 1
awslocal dynamodb put-item \
    --table-name vaidyalink-local-Patients \
    --item '{
        "PK": {"S": "PATIENT#patient-001"},
        "SK": {"S": "PROFILE"},
        "patientId": {"S": "patient-001"},
        "abhaId": {"S": "12-3456-7890-1234"},
        "name": {"S": "Rajesh Kumar"},
        "dateOfBirth": {"S": "1985-06-15"},
        "gender": {"S": "male"},
        "phone": {"S": "+91-9876543210"},
        "email": {"S": "rajesh.kumar@example.com"},
        "preferredLanguage": {"S": "hi"},
        "createdAt": {"S": "2024-01-01T00:00:00Z"},
        "updatedAt": {"S": "2024-01-01T00:00:00Z"},
        "fhirPatientId": {"S": "fhir-patient-001"}
    }'

# Patient 2
awslocal dynamodb put-item \
    --table-name vaidyalink-local-Patients \
    --item '{
        "PK": {"S": "PATIENT#patient-002"},
        "SK": {"S": "PROFILE"},
        "patientId": {"S": "patient-002"},
        "abhaId": {"S": "98-7654-3210-5678"},
        "name": {"S": "Priya Sharma"},
        "dateOfBirth": {"S": "1990-03-22"},
        "gender": {"S": "female"},
        "phone": {"S": "+91-9123456789"},
        "email": {"S": "priya.sharma@example.com"},
        "preferredLanguage": {"S": "en"},
        "createdAt": {"S": "2024-01-02T00:00:00Z"},
        "updatedAt": {"S": "2024-01-02T00:00:00Z"},
        "fhirPatientId": {"S": "fhir-patient-002"}
    }'

# Patient 3
awslocal dynamodb put-item \
    --table-name vaidyalink-local-Patients \
    --item '{
        "PK": {"S": "PATIENT#patient-003"},
        "SK": {"S": "PROFILE"},
        "patientId": {"S": "patient-003"},
        "name": {"S": "Mohammed Ali"},
        "dateOfBirth": {"S": "1978-11-08"},
        "gender": {"S": "male"},
        "phone": {"S": "+91-9988776655"},
        "preferredLanguage": {"S": "ur"},
        "createdAt": {"S": "2024-01-03T00:00:00Z"},
        "updatedAt": {"S": "2024-01-03T00:00:00Z"},
        "fhirPatientId": {"S": "fhir-patient-003"}
    }'

print_info "✓ Seeded 3 patients"

# =============================================================================
# Seed Scan Jobs
# =============================================================================
print_info "Seeding ScanJobs table..."

# Completed scan job
awslocal dynamodb put-item \
    --table-name vaidyalink-local-ScanJobs \
    --item '{
        "PK": {"S": "JOB#scan-001"},
        "SK": {"S": "METADATA"},
        "jobId": {"S": "scan-001"},
        "patientId": {"S": "patient-001"},
        "status": {"S": "completed"},
        "imageS3Key": {"S": "raw/patient-001/scan-001/original.jpg"},
        "imageS3Bucket": {"S": "vaidyalink-local-documents"},
        "createdAt": {"S": "2024-01-15T10:30:00Z"},
        "updatedAt": {"S": "2024-01-15T10:35:00Z"},
        "processingStartedAt": {"S": "2024-01-15T10:30:05Z"},
        "processingCompletedAt": {"S": "2024-01-15T10:35:00Z"},
        "extractedDataS3Key": {"S": "processed/patient-001/scan-001/extracted.json"},
        "fhirResourceIds": {"L": [
            {"S": "MedicationStatement/med-001"},
            {"S": "Observation/obs-001"}
        ]},
        "confidenceScores": {"M": {
            "patientName": {"N": "0.95"},
            "medications": {"N": "0.92"},
            "dosage": {"N": "0.88"}
        }}
    }'

# Pending scan job
awslocal dynamodb put-item \
    --table-name vaidyalink-local-ScanJobs \
    --item '{
        "PK": {"S": "JOB#scan-002"},
        "SK": {"S": "METADATA"},
        "jobId": {"S": "scan-002"},
        "patientId": {"S": "patient-002"},
        "status": {"S": "pending"},
        "imageS3Key": {"S": "raw/patient-002/scan-002/original.jpg"},
        "imageS3Bucket": {"S": "vaidyalink-local-documents"},
        "createdAt": {"S": "2024-01-16T14:20:00Z"},
        "updatedAt": {"S": "2024-01-16T14:20:00Z"}
    }'

# HITL required scan job
awslocal dynamodb put-item \
    --table-name vaidyalink-local-ScanJobs \
    --item '{
        "PK": {"S": "JOB#scan-003"},
        "SK": {"S": "METADATA"},
        "jobId": {"S": "scan-003"},
        "patientId": {"S": "patient-001"},
        "status": {"S": "hitl_required"},
        "imageS3Key": {"S": "raw/patient-001/scan-003/original.jpg"},
        "imageS3Bucket": {"S": "vaidyalink-local-documents"},
        "createdAt": {"S": "2024-01-17T09:15:00Z"},
        "updatedAt": {"S": "2024-01-17T09:20:00Z"},
        "processingStartedAt": {"S": "2024-01-17T09:15:05Z"},
        "confidenceScores": {"M": {
            "patientName": {"N": "0.95"},
            "medications": {"N": "0.65"},
            "dosage": {"N": "0.55"}
        }},
        "hitlAssignedTo": {"S": "verifier-001"}
    }'

print_info "✓ Seeded 3 scan jobs"

# =============================================================================
# Seed Voice Jobs
# =============================================================================
print_info "Seeding VoiceJobs table..."

# Completed voice job
awslocal dynamodb put-item \
    --table-name vaidyalink-local-VoiceJobs \
    --item '{
        "PK": {"S": "VOICE#voice-001"},
        "SK": {"S": "METADATA"},
        "jobId": {"S": "voice-001"},
        "patientId": {"S": "patient-003"},
        "status": {"S": "completed"},
        "audioS3Key": {"S": "audio/patient-003/voice-001/recording.wav"},
        "language": {"S": "ur"},
        "transcription": {"S": "میرے سر میں درد ہے اور بخار ہے"},
        "transcriptionConfidence": {"N": "0.91"},
        "confirmed": {"BOOL": true},
        "createdAt": {"S": "2024-01-18T11:00:00Z"},
        "updatedAt": {"S": "2024-01-18T11:05:00Z"},
        "fhirResourceIds": {"L": [
            {"S": "Observation/voice-obs-001"}
        ]}
    }'

# Pending confirmation voice job
awslocal dynamodb put-item \
    --table-name vaidyalink-local-VoiceJobs \
    --item '{
        "PK": {"S": "VOICE#voice-002"},
        "SK": {"S": "METADATA"},
        "jobId": {"S": "voice-002"},
        "patientId": {"S": "patient-002"},
        "status": {"S": "confirming"},
        "audioS3Key": {"S": "audio/patient-002/voice-002/recording.wav"},
        "language": {"S": "en"},
        "transcription": {"S": "I have been experiencing chest pain for the last two days"},
        "transcriptionConfidence": {"N": "0.94"},
        "confirmed": {"BOOL": false},
        "createdAt": {"S": "2024-01-19T15:30:00Z"},
        "updatedAt": {"S": "2024-01-19T15:32:00Z"}
    }'

print_info "✓ Seeded 2 voice jobs"

# =============================================================================
# Upload Sample Files to S3
# =============================================================================
print_info "Uploading sample files to S3..."

# Create sample prescription image
cat > /tmp/sample-prescription.txt <<EOF
Dr. Amit Patel
MBBS, MD (Medicine)
Reg. No: MH-12345

Date: 15-Jan-2024

Patient: Rajesh Kumar
Age: 38 years

Rx:
1. Tab. Omeprazole 20mg - 1-0-0 (Before breakfast) - 30 days
2. Tab. Paracetamol 500mg - 1-1-1 (After meals) - 5 days
3. Syp. Cough Relief 10ml - 1-1-1 (After meals) - 7 days

Advice:
- Avoid spicy food
- Drink plenty of water
- Rest for 3 days

Next visit: 22-Jan-2024

Dr. Amit Patel
Signature
EOF

awslocal s3 cp /tmp/sample-prescription.txt s3://vaidyalink-local-documents/raw/patient-001/scan-001/original.jpg
rm /tmp/sample-prescription.txt

print_info "✓ Uploaded sample files"

# =============================================================================
# Summary
# =============================================================================
print_info "========================================="
print_info "Database seeding complete!"
print_info "========================================="
print_info "Seeded data:"
print_info "  - Patients: 3"
print_info "  - Scan Jobs: 3"
print_info "  - Voice Jobs: 2"
print_info "  - Sample Files: 1"
print_info "========================================="
print_info ""
print_info "Test credentials:"
print_info "  Patient 1: rajesh.kumar@example.com (ABHA: 12-3456-7890-1234)"
print_info "  Patient 2: priya.sharma@example.com (ABHA: 98-7654-3210-5678)"
print_info "  Patient 3: mohammed.ali@example.com (No ABHA)"
print_info "========================================="
