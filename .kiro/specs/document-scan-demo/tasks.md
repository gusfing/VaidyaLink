# Implementation Plan: Document Scan Demo

## Overview

This plan implements a Next.js 14 frontend application for a medical document scanning demo. The backend infrastructure (Lambda, API Gateway, S3, DynamoDB, Cognito) is already complete. This implementation focuses on creating a streamlined workflow: authenticate → upload document → monitor processing → view results. The goal is a working demo deployable to Vercel within 24 hours.

## Tasks

- [x] 1. Initialize Next.js project with dependencies
  - Create Next.js 14 app with TypeScript and App Router
  - Install dependencies: aws-amplify, @tanstack/react-query, axios, axios-retry, react-dropzone, react-syntax-highlighter, tailwindcss
  - Configure Tailwind CSS with default theme
  - Create .env.example with required environment variables (API_URL, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, AWS_REGION)
  - Set up basic folder structure (app/, components/, lib/, utils/)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_

- [x] 2. Set up TypeScript interfaces and types
  - Create src/lib/types.ts with all interfaces (CognitoUser, PresignedUrlResponse, ProcessingStage, JobStatusResponse, Entity, Medication, LabResult, ProcessingResults, DemoConfig)
  - Export all types for use throughout the application
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 3. Configure AWS Amplify authentication
  - [x] 3.1 Create Amplify auth configuration
    - Create src/lib/auth.ts with Amplify.configure() for Cognito
    - Read configuration from environment variables
    - Export configured Amplify instance
    - _Requirements: 1.1, 9.2_

  - [x] 3.2 Create AuthWrapper component
    - Implement authentication state management with React Context
    - Check for valid Cognito session on mount using getCurrentUser()
    - Redirect to /login if unauthenticated
    - Provide signIn(), signOut(), and user to children via context
    - Handle automatic token refresh via Amplify
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.3 Write property test for auth token inclusion
    - **Property 3: All API requests include authentication**
    - **Validates: Requirements 1.4, 5.7**

- [x] 4. Implement API client with interceptors
  - [x] 4.1 Create Axios instance with configuration
    - Create src/lib/api-client.ts with Axios instance
    - Set baseURL from environment variable, timeout to 30 seconds
    - Add request interceptor to include Authorization header from Amplify session
    - Add response interceptor to handle 401 errors (redirect to login)
    - Configure axios-retry with 3 retries and exponential backoff
    - _Requirements: 1.4, 5.5, 5.7, 5.8, 6.4, 6.6_

  - [x] 4.2 Implement API client methods
    - Create getPresignedUrl(filename: string) method
    - Create triggerProcessing(s3Key: string) method
    - Create getJobStatus(jobId: string) method
    - Create getResults(jobId: string) method
    - All methods return typed promises
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [-] 4.3 Write property test for retry logic
    - **Property 19: Failed requests trigger retry with backoff**
    - **Validates: Requirements 5.5**

  - [ ]* 4.4 Write property test for error messages
    - **Property 20: Exhausted retries return descriptive error**
    - **Validates: Requirements 5.6**

- [x] 5. Create results parser utility
  - [x] 5.1 Implement parsing functions
    - Create src/utils/results-parser.ts
    - Implement parseResults() to extract OCR text, entities, medications, conditions, lab results, and FHIR resources
    - Implement formatResults() for display formatting
    - Handle malformed JSON gracefully with descriptive errors
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

  - [x] 5.2 Write property test for round-trip consistency
    - **Property 32: Parser round-trip preserves data**
    - **Validates: Requirements 10.4**

  - [x] 5.3 Write property test for malformed JSON handling
    - **Property 33: Malformed JSON returns error**
    - **Validates: Requirements 10.5**

- [x] 6. Build upload interface component
  - [x] 6.1 Create UploadInterface component
    - Create src/components/UploadInterface.tsx
    - Integrate react-dropzone for drag-and-drop and click-to-browse
    - Implement file validation (PNG, JPG, JPEG only, max 10MB)
    - Display image preview using FileReader API
    - Show upload progress percentage (0-100)
    - Display error messages for invalid files
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.8, 6.2, 6.3_

  - [x] 6.2 Implement upload workflow
    - Request pre-signed URL from API when user initiates upload
    - Upload file directly to S3 with progress tracking
    - Trigger backend processing via API after upload completes
    - Call onUploadComplete callback with jobId
    - Handle upload failures with error messages
    - _Requirements: 2.5, 2.6, 2.7, 6.1_

  - [x] 6.3 Write property test for file validation
    - **Property 4: Valid image formats are accepted**
    - **Property 22: Unsupported file types are rejected**
    - **Property 23: Oversized files are rejected**
    - **Validates: Requirements 2.1, 6.2, 6.3**

  - [x] 6.4 Write property test for preview generation
    - **Property 5: File selection triggers preview**
    - **Validates: Requirements 2.2**

- [x] 7. Build processing monitor component
  - [x] 7.1 Create ProcessingMonitor component
    - Create src/components/ProcessingMonitor.tsx
    - Implement status polling using React Query with 2-second interval
    - Display current processing stage (uploading, processing, extracting, transforming, complete)
    - Show visual progress indicator with percentage
    - Track elapsed time and timeout after 5 minutes
    - Display error messages for failed processing
    - Navigate to results page on completion
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.5_

  - [x] 7.2 Create React Query hook for status polling
    - Create src/lib/queries.ts with useJobStatus hook
    - Configure refetchInterval to 2000ms
    - Stop polling when status is terminal (complete/failed)
    - _Requirements: 3.1, 3.6_

  - [x] 7.3 Write property test for polling behavior
    - **Property 10: Upload completion starts polling**
    - **Property 11: Processing stage is displayed**
    - **Validates: Requirements 3.1, 3.2**

- [x] 8. Build results display component
  - [x] 8.1 Create ResultsDisplay component
    - Create src/components/ResultsDisplay.tsx
    - Fetch complete results from API on mount using React Query
    - Display original document image
    - Create tabbed interface (Overview, OCR, Structured, FHIR)
    - Show OCR text in dedicated tab
    - Display structured data with confidence scores (color-coded badges)
    - Show medications with name, dosage, frequency
    - Show lab results with test name, value, unit
    - Display FHIR resource JSON with syntax highlighting using react-syntax-highlighter
    - Provide "New Scan" button to return to upload
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 8.2 Write property test for results completeness
    - **Property 16: Results display is complete**
    - **Property 17: Medication data includes required fields**
    - **Property 18: Lab result data includes required fields**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 4.9**

- [x] 9. Create application layout and navigation
  - [x] 9.1 Create Header component
    - Create src/components/Header.tsx
    - Display application title and user info
    - Show current workflow step (Upload → Processing → Results)
    - Include logout button
    - _Requirements: 7.1, 7.3_

  - [x] 9.2 Create root layout
    - Create src/app/layout.tsx
    - Wrap app with QueryClientProvider for React Query
    - Wrap app with AuthWrapper for authentication
    - Include Header component
    - Apply consistent Tailwind styling
    - _Requirements: 7.2, 7.4, 7.6_

  - [x] 9.3 Create login page
    - Create src/app/login/page.tsx
    - Implement Amplify sign-in form
    - Display error messages for invalid credentials
    - Redirect to main page after successful login
    - _Requirements: 1.2, 6.4_

  - [x] 9.4 Create main workflow page
    - Create src/app/page.tsx
    - Orchestrate workflow: show UploadInterface → ProcessingMonitor → navigate to results
    - Manage state transitions between workflow steps
    - Display loading states during API calls
    - _Requirements: 7.2, 7.6_

  - [x] 9.5 Create results page with dynamic routing
    - Create src/app/results/[jobId]/page.tsx
    - Extract jobId from URL params
    - Render ResultsDisplay component with jobId
    - _Requirements: 4.1_

- [x] 10. Implement demo mode with mock data
  - [x] 10.1 Create mock data utility
    - Create src/utils/mock-data.ts
    - Define sample processing results with realistic medical data
    - Create mock responses for all API endpoints
    - _Requirements: 8.4_

  - [x] 10.2 Add demo mode configuration
    - Add NEXT_PUBLIC_DEMO_MODE environment variable
    - Create demo mode toggle in UI
    - Modify API client to use mock responses when demo mode enabled
    - Simulate upload delay (2 seconds) and processing duration (8 seconds)
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [x] 10.3 Write property test for demo mode
    - **Property 28: Demo mode uses mock responses**
    - **Validates: Requirements 8.1**

- [x] 11. Add error handling and loading states
  - Implement toast notification component for user-facing errors
  - Add loading spinners for all async operations
  - Ensure all error messages are user-friendly
  - Log detailed errors to console for debugging
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.6_

- [x] 12. Style application with Tailwind CSS
  - Apply responsive layout (desktop-focused)
  - Style all components with consistent spacing and typography
  - Add hover states and transitions for interactive elements
  - Implement color-coded confidence score badges (green >90%, yellow 70-90%, red <70%)
  - Ensure visual progress indicators are clear and animated
  - _Requirements: 7.4, 7.5_

- [x] 13. Checkpoint - Test complete workflow locally
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Configure deployment for Vercel
  - [ ] 14.1 Create Vercel configuration
    - Create vercel.json if needed for custom configuration
    - Ensure environment variables are documented in .env.example
    - Verify build command and output directory
    - _Requirements: 9.5_

  - [ ] 14.2 Add sample documents
    - Add sample medical document images to public/sample-documents/
    - Include prescription and lab report examples
    - _Requirements: 8.4_

  - [ ] 14.3 Create deployment documentation
    - Document environment variables required for deployment
    - Add instructions for connecting to backend API
    - Include demo mode setup instructions
    - _Requirements: 9.4, 9.5_

- [ ] 15. Final checkpoint - Verify deployment readiness
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties using fast-check
- Unit tests (not listed) should be added for specific examples and edge cases
- The application prioritizes speed of implementation - focus on working demo over perfect code
- Demo mode provides fallback for presentations when backend is unavailable
