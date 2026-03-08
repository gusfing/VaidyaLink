/**
 * VaidyaLink API Client
 *
 * Extends the document-scan-demo API client with VaidyaLink-specific endpoints
 * for document processing, voice processing, clinical summarizer, and FHIR transformation.
 */

import { apiClient } from '@/lib/document-scan-demo/api-client';
import type { ProcessingResults } from '@/lib/document-scan-demo/types';

/**
 * VaidyaLink-specific types
 */

export interface ClinicalSummaryRequest {
  patientId: string;
  includeVitals?: boolean;
  includeMedications?: boolean;
  includeLabResults?: boolean;
}

export interface ClinicalSummaryResponse {
  patientId: string;
  generatedAt: string;
  chiefComplaint: string;
  recentContext: string;
  criticalFlags: string[];
  vitals: Array<{
    type: string;
    value: string;
    unit: string;
    timestamp: string;
    normal: boolean;
  }>;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    startDate: string;
    endDate?: string;
    active: boolean;
  }>;
  recentLabs: Array<{
    testName: string;
    value: string;
    unit: string;
    referenceRange?: string;
    timestamp: string;
  }>;
  timeSavedMinutes: number;
  confidence: number;
}

export interface FHIRExportRequest {
  patientId: string;
  timelineEvents: Array<{
    id: string;
    type: string;
    date: string;
    title: string;
    description: string;
    structuredData?: object;
  }>;
  includeResourceTypes?: string[];
}

export interface FHIRExportResponse {
  fhirBundle: object;
  resourceCount: number;
  exportedAt: string;
}

export interface VoiceProcessingRequest {
  audioS3Key: string;
  language: string;
  patientId?: string;
}

export interface VoiceProcessingResponse {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  transcription?: string;
  detectedLanguage?: string;
  confidence?: number;
  structuredData?: {
    chiefComplaint?: string;
    symptoms?: string[];
    duration?: string;
    severity?: string;
    currentMedications?: string[];
    allergies?: string[];
  };
  errorMessage?: string;
}

/**
 * Check if demo mode is enabled
 */
function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

/**
 * Simulate delay for demo mode
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Document Processing API
 * Reuses existing document processor Lambda
 */

/**
 * Process a document image for OCR and entity extraction
 * @param s3Key - S3 key of the uploaded document image
 * @returns Processing results with OCR text and extracted entities
 */
export async function processDocument(s3Key: string): Promise<ProcessingResults> {
  try {
    if (isDemoMode()) {
      await delay(2000);
      return {
        jobId: `doc-${Date.now()}`,
        documentUrl: `https://example.com/${s3Key}`,
        ocrText:
          'Patient Name: John Doe\nDiagnosis: Type 2 Diabetes\nMedication: Metformin 500mg twice daily',
        entities: [
          { text: 'John Doe', type: 'PATIENT_NAME', confidence: 0.95 },
          { text: 'Type 2 Diabetes', type: 'DIAGNOSIS', confidence: 0.92 },
          { text: 'Metformin', type: 'MEDICATION', confidence: 0.98 },
        ],
        medications: [
          { name: 'Metformin', dosage: '500mg', frequency: 'twice daily', confidence: 0.98 },
        ],
        conditions: ['Type 2 Diabetes'],
        labResults: [],
        fhirResource: {},
        processedAt: new Date().toISOString(),
      };
    }

    // Use existing document processor endpoint
    const response = await apiClient.post<ProcessingResults>('/document/process', { s3Key });
    return response.data;
  } catch (error) {
    console.error('Failed to process document:', error);
    throw error;
  }
}

/**
 * Voice Processing API
 * Integrates with voice processing Lambda and Sarvam API
 */

/**
 * Get presigned URL for voice audio upload
 * @param language - Language code for transcription
 * @param contentType - Audio content type (e.g., 'audio/wav')
 * @returns Upload URL and job ID
 */
export async function getVoiceUploadUrl(
  language: string,
  contentType: string
): Promise<{ uploadUrl: string; jobId: string }> {
  try {
    if (isDemoMode()) {
      await delay(300);
      return {
        uploadUrl: 'https://example.com/upload',
        jobId: `voice-${Date.now()}`,
      };
    }

    const response = await apiClient.post<{ uploadUrl: string; jobId: string }>(
      '/voice/upload-url',
      {
        language,
        contentType,
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to get voice upload URL:', error);
    throw error;
  }
}

/**
 * Get voice processing job status
 * @param jobId - Voice processing job ID
 * @returns Job status and results
 */
export async function getVoiceJobStatus(jobId: string): Promise<VoiceProcessingResponse> {
  try {
    if (isDemoMode()) {
      await delay(500);
      return {
        jobId,
        status: 'completed',
        transcription: 'मुझे सिरदर्द है और बुखार है। दो दिन से यह समस्या है।',
        detectedLanguage: 'hi',
        confidence: 0.92,
        structuredData: {
          chiefComplaint: 'Headache and fever',
          symptoms: ['headache', 'fever'],
          duration: '2 days',
          severity: 'moderate',
        },
      };
    }

    const response = await apiClient.get<VoiceProcessingResponse>(`/voice/${jobId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get voice job status:', error);
    throw error;
  }
}

/**
 * Clinical Summarizer API
 * Integrates with clinical summarizer Lambda for AI-generated summaries
 */

/**
 * Get AI-generated clinical summary for a patient
 * @param request - Clinical summary request parameters
 * @returns Clinical summary with AI-generated insights
 */
export async function getClinicalSummary(
  request: ClinicalSummaryRequest
): Promise<ClinicalSummaryResponse> {
  try {
    if (isDemoMode()) {
      await delay(1500);
      return {
        patientId: request.patientId,
        generatedAt: new Date().toISOString(),
        chiefComplaint: 'Routine diabetes follow-up, reports feeling fatigued',
        recentContext:
          'Patient has been managing Type 2 Diabetes for 5 years. Recent HbA1c shows slight elevation to 7.2%. Blood pressure controlled on current medication.',
        criticalFlags: ['HbA1c elevated', 'Fatigue reported'],
        vitals: [
          {
            type: 'blood-pressure',
            value: '128/82',
            unit: 'mmHg',
            timestamp: new Date().toISOString(),
            normal: true,
          },
          {
            type: 'heart-rate',
            value: '72',
            unit: 'bpm',
            timestamp: new Date().toISOString(),
            normal: true,
          },
        ],
        medications: [
          {
            name: 'Metformin',
            dosage: '500mg',
            frequency: 'Twice daily',
            startDate: '2019-03-01',
            active: true,
          },
        ],
        recentLabs: [],
        timeSavedMinutes: 15,
        confidence: 0.92,
      };
    }

    const response = await apiClient.post<ClinicalSummaryResponse>(
      '/clinical-summary/generate',
      request
    );
    return response.data;
  } catch (error) {
    console.error('Failed to get clinical summary:', error);
    throw error;
  }
}

/**
 * FHIR Transformation API
 * Integrates with FHIR transformer for HL7 FHIR export
 */

/**
 * Export timeline data to HL7 FHIR format
 * @param request - FHIR export request with timeline events
 * @returns FHIR Bundle with exported resources
 */
export async function exportToFHIR(request: FHIRExportRequest): Promise<FHIRExportResponse> {
  try {
    if (isDemoMode()) {
      await delay(1000);
      return {
        fhirBundle: {
          resourceType: 'Bundle',
          type: 'collection',
          entry: request.timelineEvents.map((event) => ({
            resource: {
              resourceType: 'Basic',
              id: event.id,
              code: {
                text: event.type,
              },
              subject: {
                reference: `Patient/${request.patientId}`,
              },
            },
          })),
        },
        resourceCount: request.timelineEvents.length,
        exportedAt: new Date().toISOString(),
      };
    }

    const response = await apiClient.post<FHIRExportResponse>('/fhir/export', request);
    return response.data;
  } catch (error) {
    console.error('Failed to export to FHIR:', error);
    throw error;
  }
}

/**
 * Upload file to S3 using presigned URL
 * @param presignedUrl - Presigned S3 upload URL
 * @param file - File or Blob to upload
 * @param contentType - Content type of the file
 */
export async function uploadToS3(
  presignedUrl: string,
  file: File | Blob,
  contentType: string
): Promise<void> {
  try {
    if (isDemoMode()) {
      await delay(500);
      return;
    }

    await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('Failed to upload to S3:', error);
    throw error;
  }
}
