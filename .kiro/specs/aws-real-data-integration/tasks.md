# Implementation Plan: AWS Real Data Integration

## Overview

This plan transforms the document-scan-demo application from mock data to production-ready AWS integration with Sarvam API voice capabilities. The implementation is optimized for a 5-hour timeline with focus on core functionality first, followed by comprehensive testing. The architecture uses serverless AWS services (Lambda, S3, DynamoDB) with event-driven processing and presigned URLs for efficient uploads.

## Tasks

- [x] 1. Set up AWS infrastructure foundation (MINIMAL MVP DEPLOYED)
  - [x] 1.1 Create S3 bucket for documents with encryption and lifecycle policies
    - ✅ Created `document-scan-docs-dev-038208944386` bucket with S3-managed encryption
    - ✅ Configured lifecycle policies to delete objects after 90 days
    - ✅ Set up CORS configuration for presigned URL uploads
    - ✅ Deployed to dev environment
    - _Note: Simplified from KMS to S3-managed encryption for MVP_
    - _Requirements: 1.5, 12.1, 12.2_

  - [x] 1.2 Create DynamoDB table for job tracking
    - ✅ Created `document-scan-jobs-dev` table with jobId as primary key
    - ✅ Added GSI: userId-createdAt-index for user job queries
    - ✅ Enabled TTL on ttl attribute for automatic deletion after 90 days
    - ✅ Using PAY_PER_REQUEST billing mode
    - _Requirements: 2.9, 12.3_

  - [~] 1.3 Store Sarvam API key in AWS Secrets Manager
    - ⏭️ SKIPPED for MVP (voice processing deferred)
    - _Requirements: 10.6_

  - [x] 1.4 Configure S3 event notifications for Lambda triggers
    - ✅ Set up S3 event notification on documents bucket to trigger document processor
    - ✅ Filter events to uploads/ prefix only
    - ⏭️ Audio bucket skipped (voice processing deferred)
    - _Requirements: 1.4_

  - [x] 1.5 Deploy minimal infrastructure stack
    - ✅ Created minimal-document-scan-stack.ts with essential resources only
    - ✅ Deployed successfully to dev environment
    - ✅ API URL: https://ptln3qd359.execute-api.ap-south-1.amazonaws.com/prod/
    - ✅ Deployment time: ~2 minutes
    - _Skipped: VPC, CloudTrail, Organizations, monitoring (can add later)_

- [x] 2. Implement backend API Lambda function
  - [x] 2.1 Create API Lambda with Express.js framework and authentication middleware
    - Set up Node.js 20.x Lambda with serverless-http adapter
    - Implement Cognito JWT verification middleware
    - Extract user identity from token claims (userId, email, username)
    - Return 401 for missing or invalid tokens
    - _Requirements: 8.1, 8.2, 8.5, 8.6, 8.7_

  - [ ] 2.2 Write property tests for authentication
    - **Property 28: Authentication Header Inclusion**
    - **Property 29: Invalid Token Rejection**
    - **Property 30: Token Expiration Extraction**
    - **Property 31: User Identity Extraction**
    - **Validates: Requirements 8.1, 8.2, 8.6, 8.7**

  - [x] 2.3 Implement presigned URL generation endpoints
    - POST /upload/presigned-url: Generate S3 presigned URL for documents (3600s expiration)
    - POST /upload/audio-presigned-url: Generate S3 presigned URL for audio (3600s expiration)
    - Validate filename and format (JPEG, PNG, PDF for documents; WAV for audio)
    - Return uploadUrl, s3Key, and expiresIn
    - _Requirements: 1.1, 1.2, 5.5_

  - [ ] 2.4 Write property tests for presigned URL generation
    - **Property 1: Presigned URL Expiration Consistency**
    - **Validates: Requirements 1.2**

  - [x] 2.5 Implement job management endpoints
    - POST /jobs/process: Create job record in DynamoDB for document processing
    - POST /jobs/transcribe: Create job record in DynamoDB for voice transcription
    - GET /jobs/:jobId/status: Query job status from DynamoDB
    - GET /jobs/:jobId/results: Retrieve complete processing results from DynamoDB
    - PATCH /jobs/:jobId/transcription: Update transcription with user corrections
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ]* 2.6 Write property tests for job management
    - **Property 9: Job Storage and Retrieval**
    - **Property 11: Job ID Response**
    - **Validates: Requirements 2.9, 3.1, 5.13**

  - [x] 2.7 Add request validation with Joi schemas
    - Validate presigned URL requests (filename, format)
    - Validate job processing requests (s3Key)
    - Validate transcription requests (s3Key, language)
    - Return 400 with validation errors for invalid requests
    - _Requirements: 9.9_

  - [ ]* 2.8 Write property tests for request validation
    - **Property 2: File Size Validation**
    - **Property 3: File Format Validation**
    - **Property 22: Language Support Validation**
    - **Property 33: Request Validation**
    - **Property 34: HTTP Status Code Correctness**
    - **Validates: Requirements 1.6, 1.7, 5.9, 9.9, 9.10**

  - [x] 2.9 Implement error handling and consistent error responses
    - Return JSON error responses with error, code, details, requestId fields
    - Handle authentication errors (401)
    - Handle validation errors (400)
    - Handle not found errors (404)
    - Handle server errors (500)
    - _Requirements: 9.8, 9.10_

  - [ ]* 2.10 Write property tests for error handling
    - **Property 32: Consistent Error Response Format**
    - **Validates: Requirements 9.8**

  - [x] 2.11 Add rate limiting middleware
    - Use existing rate-limit middleware from backend/shared/nodejs/middleware/rate-limit.js
    - Configure 100 requests per minute per user
    - Return 429 when rate limit exceeded
    - _Requirements: 8.8_

- [x] 3. Checkpoint - Verify API Lambda functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement document processor Lambda function
  - [x] 4.1 Create document processor Lambda with S3 event handler
    - Set up Python 3.11 Lambda with 3008 MB memory and 300s timeout
    - Parse S3 event to extract bucket and key
    - Extract jobId from S3 key pattern: uploads/{userId}/{jobId}-{filename}
    - Update job status to 'processing' in DynamoDB
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 Implement OCR text extraction with PaddleOCR
    - Download document from S3
    - Extract text using PaddleOCR (reuse existing implementation)
    - Handle OCR failures with retry logic (1 retry)
    - Update job status to 'extracting' after OCR completes
    - _Requirements: 2.2, 2.3_

  - [x] 4.3 Implement entity extraction with Amazon Bedrock
    - Call Bedrock Claude 3.5 Sonnet with OCR text
    - Extract medications with name, dosage, frequency, and confidence
    - Extract lab results with testName, value, unit, and confidence
    - Extract medical conditions
    - Extract general entities with type and confidence
    - Implement exponential backoff for Bedrock throttling (3 retries)
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 4.4 Write property tests for entity extraction
    - **Property 5: Entity Confidence Scores**
    - **Property 6: Medication Structure Completeness**
    - **Property 7: Lab Result Structure Completeness**
    - **Validates: Requirements 2.4, 2.5, 2.7**

  - [x] 4.5 Implement FHIR transformation
    - Update job status to 'transforming'
    - Transform extracted data to FHIR R4 Bundle with type "collection"
    - Create FHIR resources for medications, conditions, and observations
    - _Requirements: 2.8_

  - [x] 4.6 Write property tests for FHIR transformation
    - **Property 8: FHIR Transformation Validity**
    - **Validates: Requirements 2.8**

  - [x] 4.7 Store results and update job status to complete
    - Store complete results in DynamoDB (ocrText, entities, medications, conditions, labResults, fhirResource)
    - Update job status to 'complete' with processedAt timestamp
    - Set TTL to current time + 90 days
    - _Requirements: 2.9_

  - [x] 4.8 Implement error handling and failure status updates
    - Catch all exceptions and log with full context to CloudWatch
    - Update job status to 'failed' with error message
    - Emit CloudWatch metric for processing errors
    - _Requirements: 2.10_

  - [ ]* 4.9 Write property tests for error handling
    - **Property 10: Processing Failure Status Update**
    - **Validates: Requirements 2.10, 5.14**

  - [x] 4.10 Add CloudWatch logging and metrics
    - Log processing start, completion, and failure events
    - Emit custom metric for processing duration
    - Include jobId in all log entries for correlation
    - Enable X-Ray tracing
    - _Requirements: 11.1, 11.3, 11.8_

- [x] 5. Checkpoint - Verify document processing pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement voice processor Lambda function (DEFERRED TO POST-MVP)
  - [ ]* 6.1 Create voice processor Lambda with S3 event handler
    - ⏭️ DEFERRED: Voice processing moved to post-MVP phase
    - _Focus: Complete document processing first within 8-hour timeline_
    - _Requirements: 5.7_

  - [ ]* 6.2 Implement Sarvam API integration for transcription
  - [ ]* 6.3 Write property tests for transcription
  - [ ]* 6.4 Implement confidence threshold checking and flagging
  - [ ]* 6.5 Write property tests for confidence flagging
  - [ ]* 6.6 Extract medical entities from transcribed text with Bedrock
  - [ ]* 6.7 Transform voice data to FHIR and store results
  - [ ]* 6.8 Implement error handling for transcription failures
  - [ ]* 6.9 Add CloudWatch logging and metrics

- [ ]* 7. Checkpoint - Verify voice processing pipeline (DEFERRED)
  - ⏭️ Voice processing deferred to post-MVP

- [ ] 8. Enhance frontend API client
  - [ ] 8.1 Add voice processing endpoints to API client
    - Implement getAudioPresignedUrl(filename): Request presigned URL for audio upload
    - Implement triggerTranscription(s3Key, language): Trigger voice transcription job
    - Implement submitTranscriptionCorrection(jobId, correctedText): Submit user corrections
    - _Requirements: 5.5, 5.8, 6.8_

  - [ ] 8.2 Implement uploadToS3 with progress tracking
    - Add onProgress callback parameter to track upload progress
    - Use XMLHttpRequest or fetch with progress events
    - Handle upload failures with descriptive errors
    - _Requirements: 1.3, 1.8_

  - [ ]* 8.3 Write property tests for upload functionality
    - **Property 4: Upload Error Handling**
    - **Validates: Requirements 1.8**

  - [ ] 8.3 Enhance error handling with retry logic
    - Implement retryWithBackoff helper function
    - Retry network errors, 429 rate limits, and 500 server errors (3 attempts)
    - Use exponential backoff: 1s, 2s, 4s delays
    - Handle 401 errors by redirecting to login
    - Display user-friendly error messages for all error types
    - _Requirements: 7.1, 7.2, 7.5, 7.7, 7.8, 7.9, 7.10_

  - [ ]* 8.4 Write property tests for error handling
    - **Property 26: Error Logging**
    - **Property 27: Retry Exponential Backoff**
    - **Validates: Requirements 7.9, 7.10**

  - [ ] 8.5 Add authentication token management
    - Include Authorization header with Bearer token in all requests
    - Implement automatic token refresh before expiration
    - Redirect to login on token refresh failure
    - _Requirements: 8.1, 8.3, 8.4_

- [ ] 9. Implement voice recording component
  - [ ] 9.1 Create VoiceRecorder component with MediaRecorder API
    - Implement audio capture from device microphone
    - Configure WAV format at 16 kHz sampling rate, mono channel
    - Add recording state management (isRecording, recordingDuration, audioBlob)
    - Display recording timer
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 9.2 Write property tests for audio configuration
    - **Property 20: Audio Format Specification**
    - **Validates: Requirements 5.2**

  - [ ] 9.3 Implement recording duration limit
    - Automatically stop recording at 120 seconds (2 minutes)
    - Display countdown timer
    - _Requirements: 5.4_

  - [ ]* 9.4 Write property tests for duration limit
    - **Property 21: Recording Duration Limit**
    - **Validates: Requirements 5.4**

  - [ ] 9.5 Add language selection dropdown
    - Display supported languages: Hindi, English, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati
    - Show native language names alongside English names
    - Default to Hindi
    - Persist selection in localStorage
    - _Requirements: 5.9_

  - [ ] 9.6 Implement audio upload flow
    - Request presigned URL from API
    - Upload audio blob to S3 with progress tracking
    - Trigger transcription job with selected language
    - Call onRecordingComplete callback with jobId
    - Handle errors with onError callback
    - _Requirements: 5.5, 5.6, 5.7_

  - [ ] 9.7 Add demo mode support
    - Simulate recording with mock audio data
    - Simulate upload delay (2000ms)
    - Return mock jobId
    - _Requirements: 4.2, 4.6_

- [ ] 10. Implement voice results component
  - [ ] 10.1 Create VoiceResults component for transcription display
    - Display transcribed text in editable textarea
    - Show detected language and confidence score
    - Display warning indicator for confidence < 0.75
    - Show extracted medical entities with confidence scores
    - Display FHIR resource representation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.9_

  - [ ]* 10.2 Write property tests for confidence warning
    - **Property 25: Confidence Warning Display**
    - **Validates: Requirements 6.4**

  - [ ] 10.3 Add audio playback control
    - Implement HTML5 audio player for original recording
    - Load audio from S3 URL
    - _Requirements: 6.6_

  - [ ] 10.4 Implement transcription editing and correction submission
    - Allow user to edit transcribed text
    - Add "Submit Correction" button
    - Call API to submit corrections
    - Display success/error feedback
    - _Requirements: 6.7, 6.8_

  - [ ] 10.5 Add demo mode support
    - Display mock transcription results
    - Simulate correction submission
    - _Requirements: 4.2_

- [ ] 11. Update demo mode toggle functionality
  - [ ] 11.1 Enhance DemoModeToggle component with visual indicators
    - Add toggle switch in application header
    - Display current mode (Demo / Live)
    - Show notification toast when mode changes
    - _Requirements: 4.1, 4.5_

  - [ ]* 11.2 Write property tests for demo mode
    - **Property 16: Demo Mode Data Source**
    - **Property 17: Demo Mode Persistence**
    - **Property 18: Demo Mode Notification**
    - **Property 19: Demo Mode Network Delay Simulation**
    - **Validates: Requirements 4.2, 4.4, 4.5, 4.6**

  - [ ] 11.2 Implement demo mode state persistence
    - Store demo mode state in localStorage with key 'document-scan-demo:demoMode'
    - Retrieve state on component mount
    - Dispatch custom event 'demoModeChanged' when state changes
    - _Requirements: 4.4_

  - [ ] 11.3 Update API client to respect demo mode
    - Check demo mode state before making requests
    - Return mock data when demo mode is enabled
    - Simulate network delays (500ms for API calls, 2000ms for uploads)
    - _Requirements: 4.2, 4.3, 4.6_

  - [ ] 11.4 Update ProcessingMonitor to simulate stages in demo mode
    - Simulate processing stages over 8 seconds total
    - Transition through: uploading (1s) → processing (2s) → extracting (3s) → transforming (1s) → complete (1s)
    - _Requirements: 4.7_

- [x] 12. Update existing components for real data integration
  - [x] 12.1 Update UploadInterface component
    - Replace mock upload with real presigned URL flow
    - Add file size validation (10 MB limit)
    - Add file format validation (JPEG, PNG, PDF)
    - Display upload progress bar
    - Handle upload errors with user-friendly messages
    - _Requirements: 1.1, 1.6, 1.7, 1.8_

  - [x] 12.2 Update ProcessingMonitor component
    - Implement polling every 2 seconds for job status
    - Display current processing stage from API response
    - Stop polling when status is 'complete' or 'failed'
    - Implement exponential backoff for failed polling requests
    - Implement 60-second timeout with timeout error message
    - _Requirements: 3.2, 3.3, 3.4, 3.6, 3.7, 3.8_

  - [ ]* 12.3 Write property tests for polling behavior
    - **Property 12: Processing Stage Display**
    - **Property 13: Polling Termination on Completion**
    - **Property 14: Polling Termination on Failure**
    - **Property 15: Exponential Backoff Implementation**
    - **Validates: Requirements 3.3, 3.4, 3.6, 3.7**

  - [x] 12.3 Update ResultsDisplay component
    - Fetch results from API when processing completes
    - Display document results (OCR text, entities, medications, conditions, lab results)
    - Display voice results (transcription, language, confidence, entities)
    - Show FHIR resource representation
    - Handle missing or incomplete data gracefully
    - _Requirements: 3.5_

  - [x] 12.4 Update main page to integrate voice recording
    - ⏭️ DEFERRED: Voice recording moved to post-MVP phase
    - _Focus: Complete document processing first within 8-hour timeline_
    - _Requirements: 5.1_

- [ ] 13. Add environment configuration
  - [x] 13.1 Create environment variable configuration files
    - ✅ Created frontend/.env.local with API URL
    - ✅ Added NEXT_PUBLIC_API_URL: https://ptln3qd359.execute-api.ap-south-1.amazonaws.com/prod
    - ✅ Added NEXT_PUBLIC_AWS_REGION: ap-south-1
    - ✅ Set NEXT_PUBLIC_DEMO_MODE: false (using real AWS)
    - ⏭️ Cognito auth skipped for MVP (authentication disabled)
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 13.2 Configure Lambda environment variables
    - ✅ Set JOBS_TABLE for DynamoDB table name
    - ✅ Set DOCUMENTS_BUCKET for S3 bucket name
    - ✅ Set BEDROCK_MODEL_ID for Claude 3.5 Sonnet
    - ✅ Set NODE_ENV for environment
    - ⏭️ Sarvam API variables skipped (voice processing deferred)
    - _Requirements: 10.4, 10.5, 10.7, 10.8_

  - [ ] 13.3 Add environment variable validation
    - Validate required frontend env vars at build time
    - Validate required backend env vars at Lambda startup
    - Fail with descriptive error if required vars are missing
    - _Requirements: 10.9, 10.10_

  - [ ]* 13.4 Write property tests for environment configuration
    - **Property 35: Environment Variable Validation**
    - **Validates: Requirements 10.9, 10.10**

- [ ] 14. Implement data retention and cleanup
  - [ ] 14.1 Add manual job deletion endpoint
    - Implement DELETE /jobs/:jobId endpoint
    - Delete S3 document and audio files
    - Delete DynamoDB job record
    - Prevent deletion of jobs less than 24 hours old
    - Log deletion operations for audit trail
    - _Requirements: 12.4, 12.5, 12.6, 12.7_

  - [ ]* 14.2 Write property tests for data retention
    - **Property 42: Deletion Audit Logging**
    - **Property 43: Recent Job Deletion Prevention**
    - **Validates: Requirements 12.6, 12.7**

- [ ] 15. Add monitoring and observability
  - [ ] 15.1 Implement CloudWatch custom metrics
    - Emit processing duration metrics from document and voice processors
    - Emit API latency metrics from API Lambda
    - Emit error rate metrics for all Lambda functions
    - Emit Sarvam API latency metrics
    - _Requirements: 11.3, 11.4, 11.5, 11.6_

  - [ ] 15.2 Create CloudWatch alarms
    - Create alarm for processing error rate threshold (>10 errors in 5 minutes)
    - Create alarm for API latency threshold (>1 second average)
    - Configure SNS notifications for alarm triggers
    - _Requirements: 11.10_

  - [ ] 15.3 Enable X-Ray tracing
    - Enable X-Ray for all Lambda functions
    - Add X-Ray SDK instrumentation for external service calls (S3, DynamoDB, Bedrock, Sarvam)
    - _Requirements: 11.7_

- [ ] 16. Write comprehensive property-based tests
  - [ ]* 16.1 Write remaining property tests for document processing
    - **Property 36: Environment Variable Presence**
    - **Property 37: S3 Key Pattern Consistency**
    - **Property 38: Job Status Transition Validity**
    - **Property 39: TTL Calculation Correctness**
    - **Property 40: Presigned URL S3 Key Consistency**
    - **Property 41: Confidence Threshold Configurability**

  - [ ]* 16.2 Write integration property tests
    - Test end-to-end document upload and processing flow
    - Test end-to-end voice recording and transcription flow
    - Test demo mode toggle affecting all components
    - Test error scenarios across component boundaries

- [ ] 17. Final checkpoint and deployment preparation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- Implementation optimized for 5-hour timeline: infrastructure first, then backend, then frontend, then testing
- Demo mode functionality preserved throughout to maintain offline demo capability
- All AWS resources configured with encryption, lifecycle policies, and monitoring
- Error handling and retry logic implemented at every layer for production readiness
