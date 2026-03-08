# Requirements Document

## Introduction

This document specifies requirements for transforming the document-scan-demo application from using mock data to real AWS service integration with Sarvam API for voice capabilities. The system will maintain the existing UI/UX flow while replacing mock data with actual cloud services for document processing, storage, and voice interaction.

## Glossary

- **Document_Scan_Demo**: The frontend application that allows users to upload and process medical documents
- **API_Client**: The frontend HTTP client that communicates with backend services
- **Demo_Mode**: A configuration flag that switches between mock data and real AWS integration
- **S3_Service**: Amazon S3 cloud storage service for document and audio files
- **Lambda_Service**: AWS Lambda serverless compute service for document and voice processing
- **Document_Processor**: Backend Lambda function that performs OCR and entity extraction
- **Voice_Processor**: Backend Lambda function that handles voice transcription via Sarvam API
- **Sarvam_API**: Third-party API service for Indian language voice transcription
- **Presigned_URL**: Time-limited URL for secure direct upload to S3
- **Job_Status**: Current state of a processing job (uploading, processing, extracting, transforming, complete, failed)
- **Processing_Results**: Complete output from document processing including OCR text, entities, medications, lab results, and FHIR resources
- **FHIR_Resource**: HL7 FHIR-compliant healthcare data structure
- **Upload_Interface**: Frontend component for file selection and upload
- **Results_Display**: Frontend component showing processed document results
- **Processing_Monitor**: Frontend component displaying real-time job status
- **Auth_Wrapper**: Frontend component managing authentication state
- **Error_Handler**: System component that manages error states and user feedback

## Requirements

### Requirement 1: S3 Document Storage Integration

**User Story:** As a healthcare provider, I want uploaded documents to be securely stored in AWS S3, so that they can be processed by backend services and retrieved later.

#### Acceptance Criteria

1. WHEN a user selects a document for upload, THE API_Client SHALL request a Presigned_URL from the backend
2. THE backend SHALL generate a Presigned_URL with 3600 second expiration for S3 upload
3. THE API_Client SHALL upload the document directly to S3 using the Presigned_URL
4. WHEN the upload completes, THE S3_Service SHALL trigger the Document_Processor Lambda via S3 event notification
5. THE S3_Service SHALL encrypt documents at rest using AWS KMS
6. THE S3_Service SHALL enforce a maximum file size of 10 MB
7. THE S3_Service SHALL accept image formats: JPEG, PNG, PDF
8. IF upload fails, THEN THE Error_Handler SHALL display a descriptive error message to the user

### Requirement 2: Document Processing Pipeline

**User Story:** As a healthcare provider, I want documents to be automatically processed after upload, so that I can view extracted medical information without manual intervention.

#### Acceptance Criteria

1. WHEN a document is uploaded to S3, THE Document_Processor SHALL receive an S3 event notification
2. THE Document_Processor SHALL extract text using PaddleOCR
3. THE Document_Processor SHALL structure clinical data using Amazon Bedrock (Claude 3.5 Sonnet)
4. THE Document_Processor SHALL extract medications with name, dosage, and frequency
5. THE Document_Processor SHALL extract lab results with test name, value, and unit
6. THE Document_Processor SHALL extract medical conditions
7. THE Document_Processor SHALL calculate confidence scores for each extracted entity
8. THE Document_Processor SHALL transform extracted data to FHIR_Resource format
9. THE Document_Processor SHALL store Processing_Results in DynamoDB with jobId as primary key
10. IF processing fails, THEN THE Document_Processor SHALL update Job_Status to 'failed' with error details

### Requirement 3: Real-Time Job Status Polling

**User Story:** As a healthcare provider, I want to see real-time progress of document processing, so that I know when results are ready.

#### Acceptance Criteria

1. WHEN upload completes, THE API_Client SHALL receive a jobId from the backend
2. THE Processing_Monitor SHALL poll Job_Status every 2 seconds using the jobId
3. THE Processing_Monitor SHALL display current processing stage: uploading, processing, extracting, transforming, complete, or failed
4. WHEN Job_Status is 'complete', THE Processing_Monitor SHALL stop polling
5. WHEN Job_Status is 'complete', THE API_Client SHALL fetch Processing_Results
6. WHEN Job_Status is 'failed', THE Processing_Monitor SHALL stop polling and display error message
7. THE Processing_Monitor SHALL implement exponential backoff if polling requests fail
8. THE Processing_Monitor SHALL timeout after 60 seconds and display timeout error

### Requirement 4: Demo Mode Toggle

**User Story:** As a developer or demo user, I want to toggle between real AWS integration and mock data, so that I can test the application without incurring AWS costs or demonstrate functionality offline.

#### Acceptance Criteria

1. THE Document_Scan_Demo SHALL provide a Demo_Mode toggle in the user interface
2. WHEN Demo_Mode is enabled, THE API_Client SHALL use mock data responses
3. WHEN Demo_Mode is disabled, THE API_Client SHALL use real AWS service endpoints
4. THE Demo_Mode state SHALL persist in browser localStorage
5. WHEN Demo_Mode changes, THE Document_Scan_Demo SHALL display a notification to the user
6. WHERE Demo_Mode is enabled, THE API_Client SHALL simulate network delays (500ms for API calls, 2000ms for uploads)
7. WHERE Demo_Mode is enabled, THE Processing_Monitor SHALL simulate processing stages over 8 seconds
8. THE Demo_Mode toggle SHALL be accessible from the application header

### Requirement 5: Sarvam API Voice Integration

**User Story:** As a healthcare provider, I want to capture patient medical history via voice in Indian languages, so that non-literate patients can provide information easily.

#### Acceptance Criteria

1. THE Document_Scan_Demo SHALL provide a voice recording interface
2. THE voice recording interface SHALL support audio capture in WAV format at 16 kHz sampling rate
3. WHEN a user starts recording, THE Document_Scan_Demo SHALL capture audio from the device microphone
4. THE Document_Scan_Demo SHALL enforce a maximum recording duration of 2 minutes
5. WHEN recording completes, THE API_Client SHALL request a Presigned_URL for audio upload
6. THE API_Client SHALL upload audio directly to S3 using the Presigned_URL
7. WHEN audio upload completes, THE S3_Service SHALL trigger the Voice_Processor Lambda
8. THE Voice_Processor SHALL transcribe audio using Sarvam_API
9. THE Voice_Processor SHALL support Hindi, English, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, and Gujarati languages
10. THE Voice_Processor SHALL calculate transcription confidence scores
11. WHEN transcription confidence is below 0.75, THE Voice_Processor SHALL flag for user confirmation
12. THE Voice_Processor SHALL extract medical entities from transcribed text using Amazon Bedrock
13. THE Voice_Processor SHALL store transcription results in DynamoDB with jobId as primary key
14. IF transcription fails, THEN THE Voice_Processor SHALL update Job_Status to 'failed' with error details

### Requirement 6: Voice Results Display

**User Story:** As a healthcare provider, I want to view transcribed voice data alongside extracted medical entities, so that I can verify accuracy and use the information for patient care.

#### Acceptance Criteria

1. WHEN voice transcription completes, THE Results_Display SHALL show the transcribed text
2. THE Results_Display SHALL display the detected language
3. THE Results_Display SHALL show transcription confidence score
4. WHEN confidence is below 0.75, THE Results_Display SHALL display a warning indicator
5. THE Results_Display SHALL show extracted medical entities with confidence scores
6. THE Results_Display SHALL provide an audio playback control for the original recording
7. THE Results_Display SHALL allow users to edit transcribed text
8. WHEN user edits transcription, THE API_Client SHALL submit corrections to the backend
9. THE Results_Display SHALL display FHIR_Resource representation of voice data

### Requirement 7: Error Handling and User Feedback

**User Story:** As a healthcare provider, I want clear error messages when processing fails, so that I can understand what went wrong and take corrective action.

#### Acceptance Criteria

1. WHEN network connection fails, THE Error_Handler SHALL display "Unable to connect to server. Please check your connection."
2. WHEN authentication token expires, THE Error_Handler SHALL redirect to login with session expired message
3. WHEN file size exceeds 10 MB, THE Error_Handler SHALL display "File too large. Maximum size is 10 MB."
4. WHEN file format is unsupported, THE Error_Handler SHALL display "Unsupported file format. Please upload JPEG, PNG, or PDF."
5. WHEN S3 upload fails, THE Error_Handler SHALL display "Upload failed. Please try again."
6. WHEN processing timeout occurs, THE Error_Handler SHALL display "Processing is taking longer than expected. Please check back later."
7. WHEN backend returns 500 error, THE Error_Handler SHALL display "Server error. Please try again later."
8. WHEN rate limit is exceeded, THE Error_Handler SHALL display "Too many requests. Please wait a moment and try again."
9. THE Error_Handler SHALL log all errors to browser console with detailed context
10. THE Error_Handler SHALL implement retry logic with exponential backoff for transient failures

### Requirement 8: Authentication and Authorization

**User Story:** As a system administrator, I want all API requests to be authenticated, so that only authorized users can access document processing services.

#### Acceptance Criteria

1. THE API_Client SHALL include AWS Cognito JWT token in Authorization header for all requests
2. WHEN token is missing or invalid, THE backend SHALL return 401 Unauthorized
3. WHEN token expires, THE Auth_Wrapper SHALL refresh the token automatically
4. IF token refresh fails, THEN THE Auth_Wrapper SHALL redirect to login page
5. THE backend SHALL validate token signature using Cognito public keys
6. THE backend SHALL verify token expiration timestamp
7. THE backend SHALL extract user identity from token claims
8. THE backend SHALL enforce rate limits per user identity

### Requirement 9: Backend API Endpoints

**User Story:** As a frontend developer, I want well-defined API endpoints for document and voice processing, so that I can integrate the frontend with backend services.

#### Acceptance Criteria

1. THE backend SHALL provide POST /upload/presigned-url endpoint for document upload URLs
2. THE backend SHALL provide POST /upload/audio-presigned-url endpoint for audio upload URLs
3. THE backend SHALL provide POST /jobs/process endpoint to trigger document processing
4. THE backend SHALL provide POST /jobs/transcribe endpoint to trigger voice transcription
5. THE backend SHALL provide GET /jobs/:jobId/status endpoint to check processing status
6. THE backend SHALL provide GET /jobs/:jobId/results endpoint to retrieve processing results
7. THE backend SHALL provide PATCH /jobs/:jobId/transcription endpoint to submit transcription corrections
8. THE backend SHALL return JSON responses with consistent error format
9. THE backend SHALL implement request validation using JSON schemas
10. THE backend SHALL return appropriate HTTP status codes: 200 (success), 400 (bad request), 401 (unauthorized), 404 (not found), 429 (rate limit), 500 (server error)

### Requirement 10: Configuration Management

**User Story:** As a DevOps engineer, I want environment-specific configuration for AWS services, so that I can deploy to development, staging, and production environments.

#### Acceptance Criteria

1. THE Document_Scan_Demo SHALL read API base URL from NEXT_PUBLIC_API_URL environment variable
2. THE Document_Scan_Demo SHALL read Demo_Mode flag from NEXT_PUBLIC_DEMO_MODE environment variable
3. THE Document_Scan_Demo SHALL read AWS region from NEXT_PUBLIC_AWS_REGION environment variable
4. THE backend SHALL read S3 bucket name from S3_BUCKET environment variable
5. THE backend SHALL read DynamoDB table name from JOBS_TABLE environment variable
6. THE backend SHALL read Sarvam API key from AWS Secrets Manager
7. THE backend SHALL read Sarvam API URL from SARVAM_API_URL environment variable
8. THE backend SHALL read confidence threshold from CONFIDENCE_THRESHOLD environment variable (default: 0.75)
9. THE backend SHALL validate all required environment variables at startup
10. IF required environment variables are missing, THEN THE backend SHALL fail to start with descriptive error message

### Requirement 11: Monitoring and Observability

**User Story:** As a DevOps engineer, I want comprehensive logging and metrics for document and voice processing, so that I can monitor system health and troubleshoot issues.

#### Acceptance Criteria

1. THE Document_Processor SHALL log processing start, completion, and failure events to CloudWatch
2. THE Voice_Processor SHALL log transcription start, completion, and failure events to CloudWatch
3. THE backend SHALL emit custom CloudWatch metrics for processing duration
4. THE backend SHALL emit custom CloudWatch metrics for API latency
5. THE backend SHALL emit custom CloudWatch metrics for error rates
6. THE backend SHALL emit custom CloudWatch metrics for Sarvam API latency
7. THE backend SHALL enable AWS X-Ray tracing for all Lambda functions
8. THE backend SHALL include jobId in all log entries for correlation
9. THE backend SHALL log confidence scores for quality monitoring
10. THE backend SHALL create CloudWatch alarms for error rate thresholds

### Requirement 12: Data Retention and Cleanup

**User Story:** As a compliance officer, I want automatic deletion of processed documents and audio files, so that we comply with data retention policies.

#### Acceptance Criteria

1. THE S3_Service SHALL configure lifecycle policy to delete documents after 90 days
2. THE S3_Service SHALL configure lifecycle policy to delete audio files after 90 days
3. THE backend SHALL configure DynamoDB TTL to delete job records after 90 days
4. THE backend SHALL provide API endpoint to manually delete a job and associated files
5. WHEN a job is deleted, THE backend SHALL delete the S3 document, audio file, and DynamoDB record
6. THE backend SHALL log all deletion operations for audit trail
7. THE backend SHALL prevent deletion of jobs less than 24 hours old
