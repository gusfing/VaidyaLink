/**
 * TypeScript interfaces and types for the Document Scan Demo application
 *
 * This file contains all type definitions for authentication, upload, processing,
 * and results display functionality.
 */

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * Represents a Cognito authenticated user
 */
export interface CognitoUser {
  username: string;
  email: string;
  attributes: Record<string, string>;
}

// ============================================================================
// Upload Types
// ============================================================================

/**
 * Response from the API when requesting a pre-signed S3 upload URL
 */
export interface PresignedUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

// ============================================================================
// Processing Types
// ============================================================================

/**
 * Represents the current stage of document processing
 */
export type ProcessingStage =
  | 'uploading'
  | 'processing'
  | 'extracting'
  | 'transforming'
  | 'complete'
  | 'failed';

/**
 * Response from the API when polling for job status
 */
export interface JobStatusResponse {
  jobId: string;
  status: ProcessingStage;
  message?: string;
  error?: string;
}

// ============================================================================
// Results Types
// ============================================================================

/**
 * Represents an extracted entity from the document
 */
export interface Entity {
  text: string;
  type: string;
  confidence: number;
}

/**
 * Represents a medication extracted from the document
 */
export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  confidence: number;
}

/**
 * Represents a lab result extracted from the document
 */
export interface LabResult {
  testName: string;
  value: string;
  unit: string;
  confidence: number;
}

/**
 * Complete processing results returned by the API
 */
export interface ProcessingResults {
  jobId: string;
  documentUrl: string;
  ocrText: string;
  entities: Entity[];
  medications: Medication[];
  conditions: string[];
  labResults: LabResult[];
  fhirResource: object;
  processedAt: string;
}

// ============================================================================
// Demo Mode Types
// ============================================================================

/**
 * Configuration for demo mode functionality
 */
export interface DemoConfig {
  enabled: boolean;
  uploadDelay: number;
  processingDuration: number;
}
