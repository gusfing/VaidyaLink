# Requirements Document

## Introduction

This document specifies requirements for a 24-hour prototype demo of a medical document scanning system. The demo showcases an end-to-end flow where users upload medical documents (prescriptions, lab reports), which are processed via OCR, transformed into FHIR format, and displayed with structured results. The backend infrastructure (Lambda functions, API Gateway, S3, DynamoDB, Cognito) is already complete. This spec focuses exclusively on the frontend Next.js application needed to demonstrate the working system.

## Glossary

- **Upload_Interface**: The frontend component that handles file selection and upload to S3
- **Processing_Monitor**: The frontend component that displays real-time processing status
- **Results_Display**: The frontend component that shows extracted data and FHIR resources
- **API_Client**: The frontend service that communicates with the backend API Gateway
- **Auth_Wrapper**: The frontend component that handles Cognito authentication
- **Document**: A medical document image file (prescription, lab report, etc.)
- **OCR_Result**: The extracted text and structured data from document processing
- **FHIR_Resource**: The standardized healthcare data format output
- **Processing_Job**: A backend task that processes an uploaded document

## Requirements

### Requirement 1: User Authentication

**User Story:** As a demo user, I want to authenticate with the system, so that I can access the document scanning features.

#### Acceptance Criteria

1. WHEN the application loads, THE Auth_Wrapper SHALL check for valid authentication credentials
2. WHEN a user is not authenticated, THE Auth_Wrapper SHALL redirect to the login page
3. WHEN a user provides valid credentials, THE Auth_Wrapper SHALL store the authentication token
4. THE Auth_Wrapper SHALL include the authentication token in all API requests

### Requirement 2: Document Upload

**User Story:** As a demo user, I want to upload medical document images, so that they can be processed by the system.

#### Acceptance Criteria

1. THE Upload_Interface SHALL accept image files in PNG, JPG, and JPEG formats
2. WHEN a user selects a file, THE Upload_Interface SHALL display a preview of the image
3. THE Upload_Interface SHALL support drag-and-drop file selection
4. THE Upload_Interface SHALL support click-to-browse file selection
5. WHEN a user initiates upload, THE Upload_Interface SHALL request a pre-signed S3 URL from the API
6. WHEN a pre-signed URL is received, THE Upload_Interface SHALL upload the file directly to S3
7. WHEN upload completes, THE Upload_Interface SHALL trigger backend processing via the API
8. THE Upload_Interface SHALL display upload progress percentage

### Requirement 3: Processing Status Monitoring

**User Story:** As a demo user, I want to see real-time processing status, so that I know when my document results are ready.

#### Acceptance Criteria

1. WHEN a document upload completes, THE Processing_Monitor SHALL poll the API for job status
2. THE Processing_Monitor SHALL display current processing stage (uploading, processing, extracting, transforming, complete)
3. WHILE processing is in progress, THE Processing_Monitor SHALL show a visual progress indicator
4. WHEN processing completes successfully, THE Processing_Monitor SHALL navigate to the results display
5. IF processing fails, THEN THE Processing_Monitor SHALL display an error message with failure reason
6. THE Processing_Monitor SHALL poll status every 2 seconds during active processing

### Requirement 4: Results Display

**User Story:** As a demo user, I want to view extracted document data and FHIR resources, so that I can verify the system works correctly.

#### Acceptance Criteria

1. WHEN processing completes, THE Results_Display SHALL fetch the complete results from the API
2. THE Results_Display SHALL display the original document image
3. THE Results_Display SHALL display the extracted raw text from OCR
4. THE Results_Display SHALL display structured data including medications, conditions, and observations
5. THE Results_Display SHALL display confidence scores for extracted entities
6. THE Results_Display SHALL display the generated FHIR resource in formatted JSON
7. THE Results_Display SHALL provide a button to start a new document scan
8. WHERE structured data includes medications, THE Results_Display SHALL show medication name, dosage, and frequency
9. WHERE structured data includes lab results, THE Results_Display SHALL show test name, value, and unit

### Requirement 5: API Integration

**User Story:** As the frontend application, I want to communicate with the backend API, so that I can orchestrate the document processing workflow.

#### Acceptance Criteria

1. THE API_Client SHALL request pre-signed S3 upload URLs from the API Gateway
2. THE API_Client SHALL trigger document processing jobs via the API Gateway
3. THE API_Client SHALL poll job status via the API Gateway
4. THE API_Client SHALL retrieve processing results via the API Gateway
5. WHEN an API request fails, THE API_Client SHALL retry up to 3 times with exponential backoff
6. WHEN all retries fail, THE API_Client SHALL return a descriptive error message
7. THE API_Client SHALL include authentication headers in all requests
8. THE API_Client SHALL set request timeout to 30 seconds

### Requirement 6: Error Handling

**User Story:** As a demo user, I want clear error messages when something goes wrong, so that I understand what happened.

#### Acceptance Criteria

1. WHEN file upload fails, THE Upload_Interface SHALL display "Upload failed. Please try again."
2. WHEN an unsupported file type is selected, THE Upload_Interface SHALL display "Please select a PNG, JPG, or JPEG file."
3. WHEN a file exceeds 10MB, THE Upload_Interface SHALL display "File too large. Maximum size is 10MB."
4. WHEN API authentication fails, THE Auth_Wrapper SHALL redirect to login with message "Session expired. Please log in again."
5. WHEN processing times out after 5 minutes, THE Processing_Monitor SHALL display "Processing timed out. Please try again with a different document."
6. WHEN the API is unreachable, THE API_Client SHALL display "Unable to connect to server. Please check your connection."

### Requirement 7: Application Layout

**User Story:** As a demo user, I want a clean and simple interface, so that I can focus on the document scanning workflow.

#### Acceptance Criteria

1. THE Application SHALL display a navigation header with application title and user info
2. THE Application SHALL use a single-page workflow layout
3. THE Application SHALL display the current step in the workflow (Upload → Processing → Results)
4. THE Application SHALL use consistent spacing and typography throughout
5. THE Application SHALL be responsive and functional on desktop browsers
6. THE Application SHALL display a loading state during API calls

### Requirement 8: Demo Data Fallback

**User Story:** As a demo presenter, I want fallback mock data, so that I can demonstrate the interface even if the backend is unavailable.

#### Acceptance Criteria

1. WHERE a configuration flag enables demo mode, THE Application SHALL use mock API responses
2. WHERE demo mode is enabled, THE Upload_Interface SHALL simulate successful uploads after 2 seconds
3. WHERE demo mode is enabled, THE Processing_Monitor SHALL simulate processing stages over 8 seconds
4. WHERE demo mode is enabled, THE Results_Display SHALL display pre-defined sample results
5. THE Application SHALL provide a toggle to switch between live and demo mode

### Requirement 9: Deployment Configuration

**User Story:** As a developer, I want simple deployment configuration, so that I can deploy the demo quickly.

#### Acceptance Criteria

1. THE Application SHALL read API endpoint URL from environment variables
2. THE Application SHALL read Cognito configuration from environment variables
3. THE Application SHALL read S3 bucket name from environment variables
4. THE Application SHALL provide a sample .env.example file with all required variables
5. THE Application SHALL be deployable to Vercel with zero configuration changes
6. THE Application SHALL support local development with npm run dev

### Requirement 10: Document Processing Parser

**User Story:** As the frontend application, I want to parse API responses correctly, so that I can display processing results accurately.

#### Acceptance Criteria

1. WHEN the API returns OCR results, THE Results_Parser SHALL extract text content
2. WHEN the API returns structured data, THE Results_Parser SHALL extract entities by type
3. WHEN the API returns FHIR resources, THE Results_Parser SHALL parse JSON into displayable format
4. FOR ALL valid API responses, parsing then formatting then parsing SHALL produce equivalent data structures (round-trip property)
5. WHEN the API returns malformed JSON, THE Results_Parser SHALL return a descriptive error

