# Design Document: VaidyaLink

## Overview

VaidyaLink is a serverless, AI-powered healthcare record digitization platform built on AWS infrastructure. The system transforms handwritten and printed medical documents from India's diverse healthcare ecosystem into structured, globally interoperable HL7 FHIR data. The architecture prioritizes cost-efficiency through a pay-per-scan model, accessibility through multilingual support, and medical safety through human-in-the-loop verification.

The platform serves three primary user groups:
1. Healthcare providers digitizing patient records in clinical settings
2. Patients accessing and managing their health information
3. Medical tourists requiring international-standard health records

### Design Principles

- **Bharat-First Accessibility**: Support for 22 Indian languages, offline-capable PWA, and voice interfaces for non-literate users
- **Serverless-First Architecture**: Zero idle costs with automatic scaling from zero to thousands of concurrent requests
- **Medical Safety**: Human verification for low-confidence extractions and comprehensive audit trails
- **Compliance by Design**: ABDM integration, HIPAA-eligible infrastructure, and end-to-end encryption
- **Cost Optimization**: Target ₹0.40 per scan through intelligent service selection and caching

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Next.js    │  │     PWA      │  │    Mobile    │          │
│  │   Web App    │  │   (Offline)  │  │     App      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Amazon API Gateway (REST + WebSocket)                   │  │
│  │  - Authentication (Cognito)                              │  │
│  │  - Rate Limiting                                         │  │
│  │  - Request Validation                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Processing Layer (Lambda)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Document   │  │    Voice     │  │   Clinical   │          │
│  │  Processing  │  │  Processing  │  │ Summarizer   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │     FHIR     │  │     ABDM     │  │     HITL     │          │
│  │ Transformer  │  │  Connector   │  │   Handler    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AI Services Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Amazon     │  │   Bhashini   │  │  PaddleOCR   │          │
│  │   Bedrock    │  │     API      │  │   (Custom)   │          │
│  │ (Claude 3.5) │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Amazon     │  │     AWS      │  │   DynamoDB   │          │
│  │  HealthLake  │  │      S3      │  │  (Metadata)  │          │
│  │    (FHIR)    │  │   (Images)   │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Security & Monitoring                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   AWS KMS    │  │  CloudWatch  │  │   X-Ray      │          │
│  │  (Encryption)│  │   (Metrics)  │  │  (Tracing)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │  CloudTrail  │  │   Cognito    │                            │
│  │   (Audit)    │  │    (Auth)    │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Primary Scan Flow

1. **Image Capture**: User uploads medical document via web/mobile app
2. **Pre-signed Upload**: Client requests pre-signed S3 URL from API Gateway
3. **S3 Storage**: Image uploaded directly to S3 with encryption
4. **Event Trigger**: S3 event triggers Document Processing Lambda
5. **AI Extraction**: 
   - PaddleOCR extracts text from image
   - Amazon Bedrock structures extracted text into clinical fields
   - Confidence scores calculated for each field
6. **Quality Check**: If confidence < 80%, route to HITL queue
7. **FHIR Transformation**: Structured data converted to FHIR resources
8. **HealthLake Storage**: FHIR resources stored in AWS HealthLake
9. **Metadata Update**: DynamoDB updated with scan status and references
10. **Client Notification**: WebSocket notification sent to client

#### Voice History Flow

1. **Voice Recording**: User records medical history in native language
2. **Audio Upload**: Audio file uploaded to S3
3. **Bhashini Transcription**: Voice Processing Lambda calls Bhashini API
4. **Text Structuring**: Amazon Bedrock extracts clinical entities from transcription
5. **Confirmation**: Transcribed text played back to user for verification
6. **FHIR Creation**: Confirmed data converted to FHIR Observation resources
7. **Storage**: FHIR resources stored in HealthLake

#### Clinical Summary Flow

1. **Summary Request**: Doctor requests patient summary via API
2. **Data Retrieval**: Lambda queries HealthLake for patient's FHIR resources
3. **Context Preparation**: Recent encounters, medications, and conditions aggregated
4. **LLM Summarization**: Amazon Bedrock generates structured summary
5. **Response**: Summary returned with confidence scores and source references

## Components and Interfaces

### 1. Frontend Application (Next.js)

**Technology**: Next.js 14 with App Router, TypeScript, Tailwind CSS

**Key Features**:
- Progressive Web App with offline support
- Responsive design for mobile and desktop
- Multilingual UI using next-i18next
- Real-time updates via WebSocket
- Camera integration for document capture

**API Integration**:
```typescript
interface VaidyaLinkAPI {
  // Document scanning
  uploadDocument(file: File, metadata: DocumentMetadata): Promise<ScanJob>
  getScanStatus(jobId: string): Promise<ScanStatus>
  getExtractedData(jobId: string): Promise<ExtractedRecord>
  
  // Voice interface
  uploadVoiceRecording(audio: Blob, language: string): Promise<TranscriptionJob>
  confirmTranscription(jobId: string, confirmed: boolean): Promise<void>
  
  // Patient records
  getPatientRecords(patientId: string): Promise<FHIRBundle>
  getClinicalSummary(patientId: string): Promise<ClinicalSummary>
  
  // FHIR export
  exportToFHIR(patientId: string, format: 'json' | 'xml'): Promise<Blob>
  
  // ABDM integration
  linkABHAId(abhaId: string, otp: string): Promise<ABHALinkStatus>
  fetchABDMRecords(abhaId: string): Promise<FHIRBundle>
}
```

### 2. API Gateway Layer

**Technology**: Amazon API Gateway (REST + WebSocket)

**REST Endpoints**:
```
POST   /api/v1/scans/upload-url          # Get pre-signed S3 URL
POST   /api/v1/scans                     # Create scan job
GET    /api/v1/scans/{jobId}             # Get scan status
GET    /api/v1/scans/{jobId}/data        # Get extracted data

POST   /api/v1/voice/upload-url          # Get pre-signed URL for audio
POST   /api/v1/voice/transcribe          # Start transcription
POST   /api/v1/voice/{jobId}/confirm     # Confirm transcription

GET    /api/v1/patients/{id}/records     # Get patient records
GET    /api/v1/patients/{id}/summary     # Get clinical summary
GET    /api/v1/patients/{id}/export      # Export FHIR bundle

POST   /api/v1/abdm/link                 # Link ABHA ID
GET    /api/v1/abdm/records              # Fetch ABDM records
POST   /api/v1/abdm/consent              # Manage consent

GET    /api/v1/hitl/queue                # Get HITL verification queue
POST   /api/v1/hitl/{jobId}/verify       # Submit verification
```

**WebSocket Endpoints**:
```
wss://api.vaidyalink.com/ws
  - Connection: Authenticated via Cognito token
  - Messages: Scan status updates, HITL notifications
```

**Authentication**: AWS Cognito with JWT tokens

**Rate Limiting**: 
- Standard users: 100 requests/minute
- Healthcare providers: 1000 requests/minute
- Burst capacity: 200 requests

### 3. Document Processing Lambda

**Technology**: Python 3.11, PaddleOCR, Boto3

**Responsibilities**:
- Receive S3 event notifications
- Download and preprocess images
- Execute OCR extraction
- Call Amazon Bedrock for structuring
- Calculate confidence scores
- Route to HITL if needed
- Trigger FHIR transformation

**Key Functions**:
```python
def process_document(event: S3Event) -> ProcessingResult:
    """Main handler for document processing"""
    
def extract_text(image_path: str) -> OCRResult:
    """Extract text using PaddleOCR"""
    
def structure_clinical_data(ocr_text: str) -> StructuredData:
    """Use Bedrock to structure extracted text"""
    
def calculate_confidence(structured_data: StructuredData) -> ConfidenceScores:
    """Calculate field-level confidence scores"""
    
def should_route_to_hitl(confidence_scores: ConfidenceScores) -> bool:
    """Determine if human verification needed"""
```

**Environment Variables**:
- `BEDROCK_MODEL_ID`: Claude 3.5 Sonnet model identifier
- `CONFIDENCE_THRESHOLD`: Minimum confidence for auto-processing (default: 0.80)
- `S3_BUCKET`: Source bucket for images
- `HITL_QUEUE_URL`: SQS queue for HITL jobs
- `FHIR_LAMBDA_ARN`: ARN of FHIR transformation Lambda

### 4. Voice Processing Lambda

**Technology**: Node.js 18, Axios for Bhashini API

**Responsibilities**:
- Receive audio file references
- Call Bhashini API for transcription
- Structure transcribed text using Bedrock
- Generate playback audio for confirmation
- Create FHIR Observation resources

**Bhashini Integration**:
```javascript
interface BhashiniRequest {
  audio: string;           // Base64 encoded audio
  sourceLanguage: string;  // ISO 639-1 code
  targetLanguage: 'en';    // Always English for processing
}

interface BhashiniResponse {
  transcription: string;
  confidence: number;
  detectedLanguage: string;
}

async function transcribeAudio(
  audioUrl: string, 
  language: string
): Promise<BhashiniResponse> {
  // Call Bhashini API
}
```

### 5. Clinical Summarizer Lambda

**Technology**: Python 3.11, Amazon Bedrock SDK

**Responsibilities**:
- Query HealthLake for patient FHIR resources
- Aggregate clinical data chronologically
- Generate structured summary using Claude 3.5 Sonnet
- Calculate confidence scores for extracted facts
- Format output for clinical display

**Prompt Engineering**:
```python
SUMMARY_PROMPT = """
You are a medical AI assistant. Generate a concise clinical summary from the following patient records.

Patient FHIR Resources:
{fhir_resources}

Requirements:
1. Maximum 200 words
2. Bullet-point format
3. Highlight: chronic conditions, allergies, current medications, recent diagnoses
4. Include confidence scores for each fact
5. Flag ambiguous medical terminology
6. Chronological order for events

Output Format:
## Chronic Conditions
- [condition] (confidence: X%)

## Current Medications
- [medication] [dosage] (confidence: X%)

## Recent Visits
- [date]: [summary] (confidence: X%)

## Flags
- [ambiguous terms or concerns]
"""
```

### 6. FHIR Transformer Lambda

**Technology**: Python 3.11, FHIR-Parser library

**Responsibilities**:
- Convert structured clinical data to FHIR R4 resources
- Map Indian medical codes to international standards
- Validate FHIR resources against profiles
- Store resources in AWS HealthLake
- Generate FHIR bundles for export

**FHIR Resource Mapping**:
```python
def create_patient_resource(data: PatientData) -> Patient:
    """Create FHIR Patient resource"""
    
def create_encounter_resource(data: EncounterData) -> Encounter:
    """Create FHIR Encounter resource"""
    
def create_medication_statement(data: MedicationData) -> MedicationStatement:
    """Create FHIR MedicationStatement resource"""
    
def create_observation(data: ObservationData) -> Observation:
    """Create FHIR Observation resource"""
    
def create_diagnostic_report(data: DiagnosticData) -> DiagnosticReport:
    """Create FHIR DiagnosticReport resource"""
```

**Code System Mapping**:
- Indian drug names → WHO ATC codes
- Indian diagnostic codes → ICD-10
- Lab tests → LOINC codes
- Procedures → SNOMED CT

### 7. ABDM Connector Lambda

**Technology**: Node.js 18, ABDM SDK

**Responsibilities**:
- Authenticate users via ABHA ID
- Fetch health records from ABDM HIE
- Push FHIR resources to ABDM
- Manage consent artifacts
- Verify healthcare facilities

**ABDM API Integration**:
```javascript
interface ABDMConnector {
  // Authentication
  authenticateABHA(abhaId: string, otp: string): Promise<AuthToken>
  
  // Health Information Exchange
  fetchHealthRecords(
    abhaId: string, 
    consentId: string
  ): Promise<FHIRBundle>
  
  pushHealthRecords(
    abhaId: string, 
    bundle: FHIRBundle, 
    consentId: string
  ): Promise<PushStatus>
  
  // Consent Management
  requestConsent(
    abhaId: string, 
    purpose: string, 
    hiTypes: string[]
  ): Promise<ConsentRequest>
  
  checkConsentStatus(consentId: string): Promise<ConsentStatus>
  
  revokeConsent(consentId: string): Promise<void>
  
  // Health Facility Registry
  verifyFacility(facilityId: string): Promise<FacilityInfo>
}
```

### 8. HITL Module

**Technology**: React admin panel, SQS for queue management

**Responsibilities**:
- Display low-confidence extractions for human review
- Show original document alongside extracted data
- Provide correction interface
- Track verification metrics
- Update records after verification

**Verification Interface**:
```typescript
interface HITLVerificationTask {
  jobId: string;
  originalImageUrl: string;
  extractedData: StructuredData;
  confidenceScores: ConfidenceScores;
  flaggedFields: string[];
  submittedAt: Date;
}

interface VerificationResult {
  jobId: string;
  correctedData: StructuredData;
  verifiedBy: string;
  verificationTime: number;
  notes: string;
}
```

## Data Models

### DynamoDB Schema

**ScanJobs Table**:
```typescript
interface ScanJob {
  PK: string;              // "JOB#${jobId}"
  SK: string;              // "METADATA"
  jobId: string;
  patientId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'hitl_required';
  imageS3Key: string;
  imageS3Bucket: string;
  createdAt: string;       // ISO 8601
  updatedAt: string;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  extractedDataS3Key?: string;
  fhirResourceIds?: string[];
  confidenceScores?: Record<string, number>;
  errorMessage?: string;
  hitlAssignedTo?: string;
  hitlCompletedAt?: string;
}
```

**Patients Table**:
```typescript
interface Patient {
  PK: string;              // "PATIENT#${patientId}"
  SK: string;              // "PROFILE"
  patientId: string;
  abhaId?: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email?: string;
  preferredLanguage: string;
  createdAt: string;
  updatedAt: string;
  fhirPatientId: string;   // HealthLake Patient resource ID
}
```

**VoiceJobs Table**:
```typescript
interface VoiceJob {
  PK: string;              // "VOICE#${jobId}"
  SK: string;              // "METADATA"
  jobId: string;
  patientId: string;
  status: 'pending' | 'transcribing' | 'confirming' | 'completed' | 'failed';
  audioS3Key: string;
  language: string;
  transcription?: string;
  transcriptionConfidence?: number;
  confirmed?: boolean;
  createdAt: string;
  updatedAt: string;
  fhirResourceIds?: string[];
}
```

### FHIR Resources

**Patient Resource**:
```json
{
  "resourceType": "Patient",
  "id": "patient-123",
  "identifier": [
    {
      "system": "https://abdm.gov.in/abha",
      "value": "12-3456-7890-1234"
    }
  ],
  "name": [
    {
      "use": "official",
      "text": "Rajesh Kumar",
      "family": "Kumar",
      "given": ["Rajesh"]
    }
  ],
  "telecom": [
    {
      "system": "phone",
      "value": "+91-9876543210"
    }
  ],
  "gender": "male",
  "birthDate": "1985-06-15",
  "address": [
    {
      "use": "home",
      "city": "Mumbai",
      "state": "Maharashtra",
      "country": "IN"
    }
  ],
  "communication": [
    {
      "language": {
        "coding": [
          {
            "system": "urn:ietf:bcp:47",
            "code": "hi",
            "display": "Hindi"
          }
        ]
      },
      "preferred": true
    }
  ]
}
```

**MedicationStatement Resource**:
```json
{
  "resourceType": "MedicationStatement",
  "id": "med-456",
  "status": "active",
  "medicationCodeableConcept": {
    "coding": [
      {
        "system": "http://www.whocc.no/atc",
        "code": "A02BC01",
        "display": "Omeprazole"
      }
    ],
    "text": "Omeprazole 20mg"
  },
  "subject": {
    "reference": "Patient/patient-123"
  },
  "effectivePeriod": {
    "start": "2024-01-15"
  },
  "dosage": [
    {
      "text": "One capsule daily before breakfast",
      "timing": {
        "repeat": {
          "frequency": 1,
          "period": 1,
          "periodUnit": "d"
        }
      },
      "route": {
        "coding": [
          {
            "system": "http://snomed.info/sct",
            "code": "26643006",
            "display": "Oral route"
          }
        ]
      },
      "doseAndRate": [
        {
          "doseQuantity": {
            "value": 20,
            "unit": "mg",
            "system": "http://unitsofmeasure.org",
            "code": "mg"
          }
        }
      ]
    }
  ],
  "note": [
    {
      "text": "Extracted from handwritten prescription dated 2024-01-15. Confidence: 92%"
    }
  ]
}
```

### S3 Storage Structure

```
vaidyalink-documents/
├── raw/
│   ├── ${patientId}/
│   │   ├── ${jobId}/
│   │   │   ├── original.jpg
│   │   │   └── metadata.json
├── processed/
│   ├── ${patientId}/
│   │   ├── ${jobId}/
│   │   │   ├── extracted.json
│   │   │   └── confidence.json
├── audio/
│   ├── ${patientId}/
│   │   ├── ${voiceJobId}/
│   │   │   ├── recording.wav
│   │   │   └── transcription.json
└── exports/
    ├── ${patientId}/
    │   ├── fhir-bundle-${timestamp}.json
    │   └── fhir-bundle-${timestamp}.xml
```
