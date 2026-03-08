sta# Implementation Plan: VaidyaLink Complete UI Flow

## Overview

This implementation plan focuses on rapid visual completion using mock data and maximum component reuse. The approach prioritizes getting all 6 screens visually complete within a few hours by reusing existing components (VoiceRecorder, VoiceResults, Toast, Header, ResultsDisplay) and creating only minimal new components. Backend integration is deferred to later phases.

**Implementation Strategy:**
- Start with shared infrastructure (layout, navigation, mock data)
- Build screens incrementally with mock data
- Reuse existing components wherever possible
- Focus on visual completeness over backend integration
- Use TypeScript for type safety
- Mobile-first responsive design

## Tasks

- [-] 1. Set up VaidyaLink infrastructure and shared components
  - [x] 1.1 Create VaidyaLink route structure and shared layout
    - Create `/app/vaidyalink/layout.tsx` with shared layout wrapper
    - Set up route folders: `/health-passport`, `/records`, `/doctor-portal`, `/voice`, `/scanner`, `/timeline`
    - Configure primary color (#007f80) and Inter font in layout
    - _Requirements: 7.1, 8.1_

  - [x] 1.2 Create mock data provider and TypeScript interfaces
    - Create `/lib/vaidyalink/types.ts` with all TypeScript interfaces (PatientProfile, MedicalRecord, ClinicalSummary, TimelineEvent)
    - Create `/lib/vaidyalink/mock-data.ts` with comprehensive mock data matching design document examples
    - Include mock patient profile, medical records, clinical summary, timeline events
    - _Requirements: 1.1, 2.1, 3.1, 6.1_

  - [x] 1.3 Create BottomNavigation component
    - Create `/components/vaidyalink/BottomNavigation.tsx` with 4 navigation items
    - Use Material Symbols icons for Health Passport, Records, Voice, Doctor Portal
    - Implement active state highlighting with primary color
    - Add navigation using Next.js router
    - Make it fixed at bottom with proper z-index
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 1.4 Write unit tests for BottomNavigation
    - Test navigation item rendering
    - Test active state highlighting
    - Test click navigation behavior
    - _Requirements: 7.1, 7.2, 7.4_

- [-] 2. Implement Health Passport Profile screen
  - [x] 2.1 Create HealthPassportCard and supporting components
    - Create `/components/vaidyalink/HealthPassportCard.tsx` for ABHA ID display with QR code
    - Add verification badge overlay
    - Implement QR code generation using qrcode library or similar
    - Add copy-to-clipboard functionality
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Create Health Passport page with profile display
    - Create `/app/vaidyalink/health-passport/page.tsx`
    - Display patient photo with verification badge
    - Render HealthPassportCard with ABHA ID and QR code
    - Display critical information section (allergies, blood type, chronic conditions)
    - Display emergency contacts list
    - Display authorized doctors list with specializations
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.3 Add privacy mode toggle functionality
    - Add privacy mode toggle button in header
    - Implement state management for privacy mode
    - Hide/mask sensitive information when privacy mode is enabled
    - Apply masking to allergies, emergency contacts, ABHA ID
    - _Requirements: 1.5_

  - [x] 2.4 Add dark mode support to Health Passport
    - Apply dark theme colors when dark mode is enabled
    - Ensure sufficient contrast for all text elements
    - Test theme switching functionality
    - _Requirements: 1.8, 9.1, 9.3, 9.4_

  - [ ]* 2.5 Write property test for privacy mode
    - **Property 1: Privacy Mode Hides Sensitive Data**
    - **Validates: Requirements 1.5**

- [-] 3. Implement Records Library screen
  - [x] 3.1 Create RecordCard component
    - Create `/components/vaidyalink/RecordCard.tsx` with thumbnail display
    - Show document title, category, and date
    - Add verification badge indicator
    - Add category tag styling
    - Make card clickable with hover effects
    - _Requirements: 2.4_

  - [x] 3.2 Create Records Library page with search and filtering
    - Create `/app/vaidyalink/records/page.tsx`
    - Add search bar at top for text filtering
    - Add tabs for All, Prescriptions, Lab Reports, Scans
    - Add quick filter buttons for Latest and All Dates
    - Implement real-time search filtering logic
    - Implement tab-based category filtering
    - Display filtered RecordCard components in grid layout
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8_

  - [x] 3.3 Add floating action button for adding records
    - Add FAB in bottom-right corner (above bottom navigation)
    - Use Material Symbols "add" icon
    - Add click handler (can show toast for now)
    - _Requirements: 2.5_

  - [x] 3.4 Add record detail navigation
    - Implement onClick handler for RecordCard
    - Navigate to detail view (can be placeholder page for now)
    - _Requirements: 2.6_

  - [ ]* 3.5 Write property tests for filtering
    - **Property 4: Search Filtering Correctness**
    - **Validates: Requirements 2.7**
    - **Property 5: Category Filtering Correctness**
    - **Validates: Requirements 2.8**

- [-] 4. Implement Doctor's Insight View screen
  - [-] 4.1 Create PatientSnapshot component
    - Create `/components/vaidyalink/PatientSnapshot.tsx`
    - Display patient photo, name, age, gender, ABHA ID
    - Show last visit date
    - Use card layout with compact design
    - _Requirements: 3.1_

  - [x] 4.2 Create TrendChart component
    - Create `/components/vaidyalink/TrendChart.tsx` for health metrics visualization
    - Use simple SVG line chart or recharts library
    - Display time series data with date labels
    - Add reference range shading if applicable
    - Add hover tooltips for data points
    - _Requirements: 3.4_

  - [x] 4.3 Create Doctor Portal page with AI insights
    - Create `/app/vaidyalink/doctor-portal/page.tsx`
    - Display PatientSnapshot at top
    - Show Magic Metric card (AI time saved indicator)
    - Render AI Clinical Summary section with chief complaint, recent context, critical flags
    - Display TrendChart for relevant health metrics
    - Show Medication Ledger with current medications (name, dosage, frequency)
    - Display recent vitals with timestamps and normal/abnormal indicators
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.4 Add action toolbar for provider actions
    - Add Action Toolbar at bottom with 3 buttons: Update Prescription, Add Lab Request, End Consultation
    - Implement click handlers (can show toast for now)
    - Style buttons with primary color
    - _Requirements: 3.7, 3.8_

  - [ ]* 4.5 Write property test for clinical summary display
    - **Property 17: Clinical Summary Component Completeness**
    - **Validates: Requirements 3.3**

- [-] 5. Implement Voice Dashboard screen
  - [x] 5.1 Create Voice Dashboard page reusing existing components
    - Create `/app/vaidyalink/voice/page.tsx`
    - Reuse VoiceRecorder component from document-scan-demo
    - Reuse VoiceResults component for displaying transcription
    - Add bilingual text labels (English/Hindi) for UI elements
    - Display Magic Metric card showing AI efficiency
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 5.2 Add health summary grid and recent scans
    - Create health summary grid with Active Patients and Critical Alerts cards
    - Display recent scans list with thumbnails
    - Use mock data for all metrics
    - _Requirements: 4.4, 4.5_

  - [x] 5.3 Integrate voice processing flow
    - Connect VoiceRecorder to existing Sarvam API integration
    - Handle voice recording start/stop
    - Display transcription results using VoiceResults
    - Add error handling with Toast notifications
    - _Requirements: 4.6, 4.7, 4.8, 4.9_

- [ ] 6. Implement AI Document Scanner screen
  - [x] 6.1 Create Scanner page with camera interface
    - Create `/app/vaidyalink/scanner/page.tsx`
    - Add camera viewfinder using browser MediaDevices API
    - Display scanning frame overlay
    - Add real-time progress indicator
    - _Requirements: 5.1, 5.3_

  - [x] 6.2 Add AR overlay for text detection
    - Implement AR overlay rendering for detected text regions
    - Highlight text regions with colored boxes
    - Update overlay in real-time as text is detected
    - _Requirements: 5.2, 5.6_

  - [x] 6.3 Add structured data preview and confirmation
    - Display structured data preview after text detection
    - Add "Confirm & Structure" button
    - Integrate with existing document processor Lambda for OCR
    - Show extracted medical entities after processing
    - _Requirements: 5.4, 5.5, 5.7, 5.8, 5.9_

  - [ ]* 6.4 Write property test for AR overlay rendering
    - **Property 16: AR Overlay Rendering**
    - **Validates: Requirements 5.2, 5.6**

- [-] 7. Implement Health Timeline and FHIR Export screen
  - [x] 7.1 Create TimelineEvent component
    - Create `/components/vaidyalink/TimelineEvent.tsx`
    - Display event icon based on type (visit, lab, prescription, scan)
    - Show date, title, and description
    - Add expandable section for structured data
    - Use vertical timeline layout with connecting lines
    - _Requirements: 6.2, 6.3_

  - [x] 7.2 Create Timeline page with chronological display
    - Create `/app/vaidyalink/timeline/page.tsx`
    - Display "Export to HL7 FHIR" button at top
    - Render TimelineEvent components in chronological order (most recent first)
    - Implement expand/collapse for event details
    - Add floating action button for adding new events
    - _Requirements: 6.1, 6.2, 6.4, 6.8_

  - [x] 7.3 Implement FHIR export functionality
    - Add click handler for "Export to HL7 FHIR" button
    - Generate FHIR-compliant JSON from timeline data
    - Integrate with existing FHIR transformation backend service
    - Provide download or share options after export completes
    - Show loading state during export
    - _Requirements: 6.5, 6.6, 6.7_

  - [ ]* 7.4 Write property tests for timeline and FHIR export
    - **Property 7: Timeline Chronological Ordering**
    - **Validates: Requirements 6.2**
    - **Property 8: FHIR Export Validity**
    - **Validates: Requirements 6.5**
    - **Property 18: Timeline Event Details Display**
    - **Validates: Requirements 6.3, 6.8**

- [x] 8. Implement parsers and pretty printers
  - [x] 8.1 Create medical document parser and pretty printer
    - Create `/lib/vaidyalink/document-parser.ts`
    - Implement parseMedicalDocument function to parse text into MedicalDocument object
    - Implement printMedicalDocument function to format MedicalDocument back to text
    - Add entity extraction for medications, diagnoses, vitals, dates
    - Add error handling with descriptive error messages
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6_

  - [ ]* 8.2 Write property tests for document parser
    - **Property 10: Medical Document Round Trip**
    - **Validates: Requirements 11.4**
    - **Property 11: Document Parser Error Handling**
    - **Validates: Requirements 11.2**
    - **Property 12: Entity Extraction Completeness**
    - **Validates: Requirements 11.5**

  - [x] 8.3 Create FHIR resource parser and pretty printer
    - Create `/lib/vaidyalink/fhir-parser.ts`
    - Implement parseFHIRResource function to parse JSON into typed resource objects
    - Implement printFHIRResource function to format resource objects back to FHIR JSON
    - Support Patient, Observation, MedicationRequest, DiagnosticReport resource types
    - Follow HL7 FHIR R4 specification formatting rules
    - Add validation error handling
    - _Requirements: 12.1, 12.2, 12.3, 12.5, 12.6_

  - [ ]* 8.4 Write property tests for FHIR parser
    - **Property 13: FHIR Resource Round Trip**
    - **Validates: Requirements 12.4**
    - **Property 14: FHIR Parser Error Handling**
    - **Validates: Requirements 12.2**
    - **Property 15: FHIR Resource Type Support**
    - **Validates: Requirements 12.5**

- [x] 9. Add responsive design and accessibility
  - [x] 9.1 Implement responsive layouts for all screens
    - Apply mobile-first CSS with breakpoints for tablet and desktop
    - Use CSS Grid and Flexbox for flexible layouts
    - Test layouts at 320px, 768px, 1024px, 1920px widths
    - Ensure touch-friendly tap targets (minimum 44px)
    - Optimize images for mobile network conditions
    - Support both portrait and landscape orientations
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 9.2 Write property test for touch target sizes
    - **Property 9: Touch Target Minimum Size**
    - **Validates: Requirements 8.3**

  - [x] 9.3 Implement theme system with persistence
    - Create theme context provider with light and dark color schemes
    - Persist theme preference in local storage
    - Apply theme colors consistently across all components
    - Support system theme detection and auto-switching
    - Ensure sufficient contrast ratios for accessibility (WCAG 2.1 AA)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 9.4 Write property tests for theme system
    - **Property 2: Theme Persistence Round Trip**
    - **Validates: Requirements 9.2**
    - **Property 20: Dark Mode Theme Application**
    - **Validates: Requirements 1.8**

- [x] 10. Integration with existing backend services
  - [x] 10.1 Set up API client integration
    - Reuse existing API client utilities from document-scan-demo
    - Configure API Gateway endpoints for document processor, voice processing, clinical summarizer
    - Add authentication using existing Cognito integration
    - Implement error handling and retry logic
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 10.2 Connect document scanner to backend
    - Integrate scanner page with document processor Lambda
    - Send captured images to S3 using presigned URLs
    - Poll for OCR processing results
    - Display extracted entities in UI
    - _Requirements: 10.1, 10.6, 10.7_

  - [x] 10.3 Connect voice dashboard to backend
    - Integrate voice recorder with voice processing Lambda
    - Send audio to Sarvam API for transcription
    - Display transcription results
    - Handle bilingual (English/Hindi) responses
    - _Requirements: 10.2, 10.4_

  - [x] 10.4 Connect doctor portal to clinical summarizer
    - Fetch AI-generated clinical summaries from clinical summarizer Lambda
    - Display summary data in doctor portal
    - Handle loading and error states
    - _Requirements: 10.3, 10.4_

  - [x] 10.5 Connect timeline to FHIR transformer
    - Integrate FHIR export with FHIR transformation backend service
    - Send timeline data for FHIR conversion
    - Download generated FHIR JSON
    - _Requirements: 10.4, 10.7_

- [ ] 11. Add comprehensive property-based tests
  - [ ]* 11.1 Write property test for list rendering completeness
    - **Property 3: List Rendering Completeness**
    - **Validates: Requirements 1.4, 2.4, 3.5, 3.6, 4.5**

  - [ ]* 11.2 Write property test for navigation behavior
    - **Property 6: Navigation Triggers Correct Route**
    - **Validates: Requirements 2.6, 3.8, 7.4**

  - [ ]* 11.3 Write property test for bottom navigation active state
    - **Property 19: Bottom Navigation Active State**
    - **Validates: Requirements 7.2**

- [ ] 12. Final checkpoint - Ensure all screens are visually complete
  - Verify all 6 screens render correctly with mock data
  - Test navigation between all screens
  - Verify responsive design on mobile, tablet, desktop
  - Test dark mode on all screens
  - Ensure all interactive elements work (buttons, tabs, search, filters)
  - Run all unit tests and property tests
  - Ask the user if questions arise or if backend integration should proceed

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Focus on visual completeness first, backend integration second
- All screens use mock data initially for rapid prototyping
- Reuse existing components (VoiceRecorder, VoiceResults, Toast, Header, ResultsDisplay) wherever possible
- Only 6 new minimal components needed (BottomNavigation, HealthPassportCard, RecordCard, PatientSnapshot, TrendChart, TimelineEvent)
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across all inputs
- Backend integration tasks (10.x) can be done incrementally after visual completion
