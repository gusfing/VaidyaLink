// API Types based on design.md

export interface DocumentMetadata {
  patientId: string;
  documentType: 'prescription' | 'lab_report' | 'scan' | 'other';
  uploadedBy: string;
}

export interface ScanJob {
  jobId: string;
  patientId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'hitl_required';
  imageUrl?: string;
  createdAt: string;
}

export interface ScanStatus {
  jobId: string;
  status: string;
  progress: number;
  message?: string;
}

export interface ExtractedRecord {
  jobId: string;
  patientName?: string;
  date?: string;
  medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    confidence: number;
  }>;
  diagnoses?: Array<{
    condition: string;
    confidence: number;
  }>;
  vitals?: Record<string, { value: string; confidence: number }>;
  confidenceScores: Record<string, number>;
}

export interface TranscriptionJob {
  jobId: string;
  status: 'pending' | 'transcribing' | 'confirming' | 'completed' | 'failed';
  language: string;
  createdAt: string;
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'collection';
  entry: Array<{
    resource: any;
  }>;
}

export interface ClinicalSummary {
  patientId: string;
  chronicConditions: Array<{ condition: string; confidence: number }>;
  currentMedications: Array<{ medication: string; dosage: string; confidence: number }>;
  recentVisits: Array<{ date: string; summary: string; confidence: number }>;
  flags: string[];
  generatedAt: string;
}

export interface ABHALinkStatus {
  linked: boolean;
  abhaId?: string;
  message: string;
}
