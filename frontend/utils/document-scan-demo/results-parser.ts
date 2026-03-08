/**
 * Results Parser Utility
 * Parses API responses from the document processing backend
 * Handles OCR text, entities, medications, conditions, lab results, and FHIR resources
 */

import type {
  ProcessingResults,
  Entity,
  Medication,
  LabResult,
} from '@/lib/document-scan-demo/types';

/**
 * Error thrown when parsing fails
 */
export class ParsingError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ParsingError';
  }
}

/**
 * Parse API response into ProcessingResults
 * Validates required fields and handles malformed data gracefully
 */
export function parseResults(apiResponse: unknown): ProcessingResults {
  try {
    // Validate that response is an object
    if (!apiResponse || typeof apiResponse !== 'object') {
      throw new ParsingError('API response must be an object');
    }

    const response = apiResponse as Record<string, unknown>;

    // Extract and validate required fields
    const jobId = response.jobId;
    if (typeof jobId !== 'string') {
      throw new ParsingError('Missing or invalid jobId');
    }

    const documentUrl = response.documentUrl;
    if (typeof documentUrl !== 'string') {
      throw new ParsingError('Missing or invalid documentUrl');
    }

    const ocrText = response.ocrText;
    if (typeof ocrText !== 'string') {
      throw new ParsingError('Missing or invalid ocrText');
    }

    const processedAt = response.processedAt;
    if (typeof processedAt !== 'string') {
      throw new ParsingError('Missing or invalid processedAt');
    }

    // Parse entities array
    const entities = parseEntities(response.entities);

    // Parse medications array
    const medications = parseMedications(response.medications);

    // Parse conditions array
    const conditions = parseConditions(response.conditions);

    // Parse lab results array
    const labResults = parseLabResults(response.labResults);

    // Parse FHIR resource
    const fhirResource = parseFhirResource(response.fhirResource);

    return {
      jobId,
      documentUrl,
      ocrText,
      entities,
      medications,
      conditions,
      labResults,
      fhirResource,
      processedAt,
    };
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }
    throw new ParsingError('Failed to parse API response', error);
  }
}

/**
 * Parse entities array from API response
 */
function parseEntities(data: unknown): Entity[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item): item is Record<string, unknown> => {
      return item && typeof item === 'object';
    })
    .map((item) => {
      const text = item.text;
      const type = item.type;
      const confidence = item.confidence;

      if (typeof text !== 'string' || typeof type !== 'string' || typeof confidence !== 'number') {
        return null;
      }

      return {
        text,
        type,
        confidence,
      };
    })
    .filter((entity): entity is Entity => entity !== null);
}

/**
 * Parse medications array from API response
 */
function parseMedications(data: unknown): Medication[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item): item is Record<string, unknown> => {
      return item && typeof item === 'object';
    })
    .map((item) => {
      const name = item.name;
      const dosage = item.dosage;
      const frequency = item.frequency;
      const confidence = item.confidence;

      if (
        typeof name !== 'string' ||
        typeof dosage !== 'string' ||
        typeof frequency !== 'string' ||
        typeof confidence !== 'number'
      ) {
        return null;
      }

      return {
        name,
        dosage,
        frequency,
        confidence,
      };
    })
    .filter((medication): medication is Medication => medication !== null);
}

/**
 * Parse conditions array from API response
 */
function parseConditions(data: unknown): string[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter((item): item is string => typeof item === 'string');
}

/**
 * Parse lab results array from API response
 */
function parseLabResults(data: unknown): LabResult[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item): item is Record<string, unknown> => {
      return item && typeof item === 'object';
    })
    .map((item) => {
      const testName = item.testName;
      const value = item.value;
      const unit = item.unit;
      const confidence = item.confidence;

      if (
        typeof testName !== 'string' ||
        typeof value !== 'string' ||
        typeof unit !== 'string' ||
        typeof confidence !== 'number'
      ) {
        return null;
      }

      return {
        testName,
        value,
        unit,
        confidence,
      };
    })
    .filter((labResult): labResult is LabResult => labResult !== null);
}

/**
 * Parse FHIR resource from API response
 * Validates that it's valid JSON and returns as object
 */
function parseFhirResource(data: unknown): object {
  // If it's already an object, return it
  if (data && typeof data === 'object') {
    return data as object;
  }

  // If it's a string, try to parse as JSON
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      throw new ParsingError('FHIR resource contains malformed JSON');
    }
  }

  throw new ParsingError('FHIR resource must be an object or valid JSON string');
}

/**
 * Format ProcessingResults for display
 * Converts internal data structures to display-friendly format
 */
export function formatResults(results: ProcessingResults): Record<string, unknown> {
  return {
    jobId: results.jobId,
    documentUrl: results.documentUrl,
    ocrText: results.ocrText,
    entities: results.entities.map((entity) => ({
      text: entity.text,
      type: entity.type,
      confidence: entity.confidence,
    })),
    medications: results.medications.map((med) => ({
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      confidence: med.confidence,
    })),
    conditions: [...results.conditions],
    labResults: results.labResults.map((lab) => ({
      testName: lab.testName,
      value: lab.value,
      unit: lab.unit,
      confidence: lab.confidence,
    })),
    fhirResource: results.fhirResource,
    processedAt: results.processedAt,
  };
}

/**
 * Get confidence level category for display
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

/**
 * Get confidence badge color for Tailwind CSS
 */
export function getConfidenceBadgeColor(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  switch (level) {
    case 'high':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-red-100 text-red-800';
  }
}
