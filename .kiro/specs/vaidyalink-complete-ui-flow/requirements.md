# Requirements Document

## Introduction

VaidyaLink Complete UI Flow implements a comprehensive healthcare platform interface based on provided HTML mockups. The system integrates six core screens: Health Passport Profile, Records Library, Doctor's Insight View, Voice Dashboard, AI Document Scanner, and Health Timeline & Export. The implementation builds upon existing document scanning and voice processing capabilities while adding new patient management, clinical summary, and FHIR export features.

## Glossary

- **Health_Passport**: Patient profile interface displaying ABHA ID, critical health information, and authorized providers
- **Records_Library**: Document management interface for organizing medical records with search and filtering
- **Doctor_Insight_View**: Clinical dashboard for healthcare providers showing AI-generated summaries and patient data
- **Voice_Dashboard**: Main interface with voice input capability for bilingual (English/Hindi) interaction
- **AI_Scanner**: Live camera interface for scanning and structuring medical documents
- **Health_Timeline**: Chronological view of medical events with FHIR export capability
- **ABHA_ID**: Ayushman Bharat Health Account identifier with QR code
- **Privacy_Mode**: Feature to hide sensitive patient information
- **AI_Clinical_Summary**: Automated summary of patient's chief complaint, recent context, and critical flags
- **FHIR**: Fast Healthcare Interoperability Resources standard for health data exchange
- **Verification_Badge**: Visual indicator showing document or profile verification status
- **Magic_Metric**: AI efficiency indicator showing time saved by automation
- **Bottom_Navigation**: Mobile navigation bar with primary app sections
- **Floating_Action_Button**: Primary action button for adding records or initiating scans
- **Trend_Chart**: Visual representation of health metrics over time
- **Medication_Ledger**: Current medications list with dosage and frequency
- **AR_Overlay**: Augmented reality text detection visualization during scanning
- **Bilingual_Interface**: UI supporting both English and Hindi text
- **Quick_Filter**: Preset filter options for rapid data filtering
- **Record_Card**: Visual card component displaying document thumbnail and metadata
- **Patient_Snapshot**: Condensed patient information card for quick reference
- **Action_Toolbar**: Provider action buttons for prescriptions, lab requests, and consultations

## Requirements

### Requirement 1: Health Passport Profile Display

**User Story:** As a patient, I want to view my health passport profile, so that I can access my ABHA ID and critical health information

#### Acceptance Criteria

1. THE Health_Passport SHALL display the patient profile photo with Verification_Badge
2. THE Health_Passport SHALL render the ABHA_ID card with QR code
3. THE Health_Passport SHALL display critical information including allergies and emergency contacts
4. THE Health_Passport SHALL list all authorized doctors with their specializations
5. WHEN Privacy_Mode is toggled, THE Health_Passport SHALL hide sensitive patient information
6. THE Health_Passport SHALL use primary color #007f80 for branding elements
7. THE Health_Passport SHALL use Inter font family for all text
8. THE Health_Passport SHALL support dark mode theme switching

### Requirement 2: Records Library Management

**User Story:** As a patient, I want to manage my medical records library, so that I can organize and access my health documents

#### Acceptance Criteria

1. THE Records_Library SHALL provide a search bar for filtering records by text
2. THE Records_Library SHALL display tabs for All, Prescriptions, Lab Reports, and Scans categories
3. THE Records_Library SHALL provide Quick_Filter options for Latest and All Dates
4. THE Records_Library SHALL render Record_Card components with thumbnails and verification status
5. THE Records_Library SHALL display a Floating_Action_Button for adding new records
6. WHEN a Record_Card is selected, THE Records_Library SHALL navigate to the document detail view
7. WHEN the search query changes, THE Records_Library SHALL filter records in real-time
8. WHEN a tab is selected, THE Records_Library SHALL display only records matching that category

### Requirement 3: Doctor's Insight View

**User Story:** As a healthcare provider, I want to view AI-generated clinical insights, so that I can make informed treatment decisions efficiently

#### Acceptance Criteria

1. THE Doctor_Insight_View SHALL display a Patient_Snapshot card with key demographics
2. THE Doctor_Insight_View SHALL show the Magic_Metric indicating AI time savings
3. THE Doctor_Insight_View SHALL render AI_Clinical_Summary with chief complaint, recent context, and critical flags
4. THE Doctor_Insight_View SHALL display Trend_Chart for relevant health metrics over time
5. THE Doctor_Insight_View SHALL show the Medication_Ledger with current medications
6. THE Doctor_Insight_View SHALL display recent vitals with timestamps
7. THE Doctor_Insight_View SHALL provide Action_Toolbar with Update Prescription, Add Lab Request, and End Consultation buttons
8. WHEN the provider selects an action button, THE Doctor_Insight_View SHALL navigate to the corresponding workflow
9. THE Doctor_Insight_View SHALL integrate with existing clinical summarizer backend service

### Requirement 4: Voice Dashboard Interface

**User Story:** As a user, I want to interact with the system using voice commands, so that I can access features hands-free in both English and Hindi

#### Acceptance Criteria

1. THE Voice_Dashboard SHALL display a large circular microphone button as the primary interaction element
2. THE Voice_Dashboard SHALL show Bilingual_Interface text in both English and Hindi
3. THE Voice_Dashboard SHALL display the Magic_Metric card showing AI efficiency
4. THE Voice_Dashboard SHALL render a health summary grid with Active Patients and Critical Alerts
5. THE Voice_Dashboard SHALL list recent scans with thumbnails
6. WHEN the microphone button is pressed, THE Voice_Dashboard SHALL initiate voice recording
7. WHEN voice input is received, THE Voice_Dashboard SHALL send audio to Sarvam API for processing
8. WHEN voice processing completes, THE Voice_Dashboard SHALL display results and execute recognized commands
9. THE Voice_Dashboard SHALL integrate with existing voice processing backend service

### Requirement 5: AI Document Scanner

**User Story:** As a user, I want to scan medical documents using my camera, so that I can digitize and structure paper records

#### Acceptance Criteria

1. THE AI_Scanner SHALL display a live camera viewfinder with scanning frame overlay
2. THE AI_Scanner SHALL show AR_Overlay highlighting detected text regions in real-time
3. THE AI_Scanner SHALL display a real-time progress indicator during scanning
4. THE AI_Scanner SHALL render structured data preview after text detection
5. THE AI_Scanner SHALL provide a Confirm & Structure button to finalize the scan
6. WHEN the camera detects a document, THE AI_Scanner SHALL highlight text regions with AR_Overlay
7. WHEN Confirm & Structure is pressed, THE AI_Scanner SHALL send the image to Bedrock for OCR processing
8. WHEN OCR processing completes, THE AI_Scanner SHALL extract structured medical entities
9. THE AI_Scanner SHALL integrate with existing document processor backend service

### Requirement 6: Health Timeline and FHIR Export

**User Story:** As a user, I want to view my health timeline and export data in FHIR format, so that I can share my medical history with other systems

#### Acceptance Criteria

1. THE Health_Timeline SHALL display an Export to HL7 FHIR button at the top
2. THE Health_Timeline SHALL render events chronologically including doctor visits, lab reports, and prescriptions
3. THE Health_Timeline SHALL show structured data extraction for each event
4. THE Health_Timeline SHALL provide a Floating_Action_Button for adding new events
5. WHEN Export to HL7 FHIR is pressed, THE Health_Timeline SHALL generate FHIR-compliant JSON
6. WHEN FHIR export completes, THE Health_Timeline SHALL provide download or share options
7. THE Health_Timeline SHALL integrate with existing FHIR transformation backend service
8. THE Health_Timeline SHALL display event details when a timeline item is selected

### Requirement 7: Bottom Navigation

**User Story:** As a user, I want to navigate between main sections easily, so that I can access different features quickly

#### Acceptance Criteria

1. THE Bottom_Navigation SHALL display icons for Health Passport, Records Library, Voice Dashboard, and Doctor's Insight View
2. THE Bottom_Navigation SHALL highlight the currently active section
3. THE Bottom_Navigation SHALL use Material Symbols icons
4. WHEN a navigation icon is pressed, THE Bottom_Navigation SHALL navigate to the corresponding section
5. THE Bottom_Navigation SHALL remain fixed at the bottom of the screen during scrolling
6. THE Bottom_Navigation SHALL use primary color #007f80 for active state

### Requirement 8: Responsive Mobile-First Design

**User Story:** As a user, I want the interface to work seamlessly on mobile devices, so that I can access the system on my smartphone

#### Acceptance Criteria

1. THE UI_Components SHALL use mobile-first responsive design principles
2. THE UI_Components SHALL adapt layouts for screen widths from 320px to 1920px
3. THE UI_Components SHALL use touch-friendly tap targets with minimum 44px dimensions
4. THE UI_Components SHALL optimize images and assets for mobile network conditions
5. THE UI_Components SHALL support both portrait and landscape orientations
6. THE UI_Components SHALL use CSS Grid and Flexbox for flexible layouts

### Requirement 9: Dark Mode Support

**User Story:** As a user, I want to switch between light and dark themes, so that I can use the app comfortably in different lighting conditions

#### Acceptance Criteria

1. THE Theme_System SHALL provide light and dark color schemes
2. THE Theme_System SHALL persist user theme preference in local storage
3. THE Theme_System SHALL apply theme colors to all UI_Components consistently
4. WHEN the system theme changes, THE Theme_System SHALL update the app theme automatically
5. THE Theme_System SHALL ensure sufficient contrast ratios for accessibility in both themes

### Requirement 10: Integration with Existing Services

**User Story:** As a developer, I want to integrate with existing backend services, so that I can leverage current functionality

#### Acceptance Criteria

1. THE Frontend_Application SHALL integrate with the document processor Lambda for OCR
2. THE Frontend_Application SHALL integrate with the voice processing Lambda for speech recognition
3. THE Frontend_Application SHALL integrate with the clinical summarizer Lambda for AI summaries
4. THE Frontend_Application SHALL use existing API Gateway endpoints for all backend communication
5. THE Frontend_Application SHALL handle authentication using existing Cognito integration
6. THE Frontend_Application SHALL reuse existing API client utilities from document-scan-demo
7. THE Frontend_Application SHALL maintain compatibility with existing S3 bucket structure for document storage

### Requirement 11: Parser and Pretty Printer for Medical Documents

**User Story:** As a developer, I want to parse and format medical documents consistently, so that I can ensure data integrity

#### Acceptance Criteria

1. WHEN a medical document is uploaded, THE Document_Parser SHALL parse it into a structured MedicalDocument object
2. WHEN an invalid document is provided, THE Document_Parser SHALL return a descriptive error message
3. THE Document_Pretty_Printer SHALL format MedicalDocument objects back into human-readable text
4. FOR ALL valid MedicalDocument objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)
5. THE Document_Parser SHALL extract entities including medications, diagnoses, vitals, and dates
6. THE Document_Pretty_Printer SHALL maintain consistent formatting for dates, measurements, and medical terminology

### Requirement 12: Parser and Pretty Printer for FHIR Resources

**User Story:** As a developer, I want to parse and format FHIR resources correctly, so that I can ensure interoperability

#### Acceptance Criteria

1. WHEN a FHIR resource is received, THE FHIR_Parser SHALL parse it into typed resource objects
2. WHEN an invalid FHIR resource is provided, THE FHIR_Parser SHALL return validation errors
3. THE FHIR_Pretty_Printer SHALL format resource objects back into valid FHIR JSON
4. FOR ALL valid FHIR resources, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)
5. THE FHIR_Parser SHALL support Patient, Observation, MedicationRequest, and DiagnosticReport resource types
6. THE FHIR_Pretty_Printer SHALL follow HL7 FHIR R4 specification formatting rules
