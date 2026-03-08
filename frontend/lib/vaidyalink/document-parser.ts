import { MedicalRecord, Entity } from './types';

/**
 * Error class for document parsing errors
 */
export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentParseError';
  }
}

/**
 * Entity extraction patterns for medical documents
 */
const ENTITY_PATTERNS = {
  // Medication patterns: drug names followed by dosage
  medication: [
    /\b([A-Z][a-z]+(?:in|ol|ide|ate|pril|sartan|statin))\s+(\d+\s*(?:mg|mcg|g|ml))/gi,
    /\b(Metformin|Amlodipine|Lisinopril|Atorvastatin|Aspirin|Insulin|Paracetamol|Ibuprofen)\b/gi,
  ],

  // Diagnosis patterns: common medical conditions
  diagnosis: [
    /\b(Type\s+[12]\s+Diabetes|Hypertension|Hyperlipidemia|Asthma|COPD|Pneumonia|Bronchitis|Arthritis|Migraine|Depression|Anxiety)\b/gi,
    /\b(diabetes|hypertension|fever|infection|fracture|sprain|allergy)\b/gi,
  ],

  // Vital signs patterns
  vitals: [
    /\b(blood\s+pressure|BP):\s*(\d{2,3}\/\d{2,3})\s*(mmHg)?/gi,
    /\b(heart\s+rate|pulse|HR):\s*(\d{2,3})\s*(bpm)?/gi,
    /\b(temperature|temp):\s*(\d{2,3}(?:\.\d)?)\s*(°?[FC])?/gi,
    /\b(oxygen\s+saturation|SpO2|O2\s+sat):\s*(\d{2,3})\s*%?/gi,
    /\b(weight):\s*(\d{2,3}(?:\.\d)?)\s*(kg|lbs?)?/gi,
    /\b(height):\s*(\d{2,3}(?:\.\d)?)\s*(cm|ft|in)?/gi,
  ],

  // Date patterns
  date: [
    /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/g,
    /\b(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})\b/g,
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/gi,
  ],
};

/**
 * Extract entities from text using pattern matching
 */
function extractEntities(text: string): Entity[] {
  const entities: Entity[] = [];

  // Extract medications
  ENTITY_PATTERNS.medication.forEach((pattern) => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      entities.push({
        text: match[0],
        type: 'medication',
        confidence: 0.85,
      });
    }
  });

  // Extract diagnoses
  ENTITY_PATTERNS.diagnosis.forEach((pattern) => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      entities.push({
        text: match[0],
        type: 'diagnosis',
        confidence: 0.8,
      });
    }
  });

  // Extract vitals
  ENTITY_PATTERNS.vitals.forEach((pattern) => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      entities.push({
        text: match[0],
        type: 'vital',
        confidence: 0.9,
      });
    }
  });

  // Extract dates
  ENTITY_PATTERNS.date.forEach((pattern) => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      entities.push({
        text: match[0],
        type: 'date',
        confidence: 0.95,
      });
    }
  });

  return entities;
}

/**
 * Parse medical document text into a structured MedicalRecord object
 *
 * @param text - The document text to parse (can be OCR output or structured text)
 * @returns Parsed MedicalRecord object
 * @throws DocumentParseError if the input is invalid
 */
export function parseMedicalDocument(text: string): MedicalRecord {
  // Validate input
  if (typeof text !== 'string') {
    throw new DocumentParseError('Input must be a string');
  }

  if (text.trim().length === 0) {
    throw new DocumentParseError('Input text cannot be empty');
  }

  try {
    // Try to parse as JSON first (for structured input)
    const parsed = JSON.parse(text);

    // Validate required fields
    if (!parsed.id || typeof parsed.id !== 'string') {
      throw new DocumentParseError('Missing or invalid required field: id');
    }
    if (!parsed.patientId || typeof parsed.patientId !== 'string') {
      throw new DocumentParseError('Missing or invalid required field: patientId');
    }
    if (!parsed.title || typeof parsed.title !== 'string') {
      throw new DocumentParseError('Missing or invalid required field: title');
    }
    if (
      !parsed.category ||
      !['prescription', 'lab-report', 'scan', 'other'].includes(parsed.category)
    ) {
      throw new DocumentParseError(
        'Missing or invalid required field: category (must be prescription, lab-report, scan, or other)'
      );
    }
    if (!parsed.date || typeof parsed.date !== 'string') {
      throw new DocumentParseError('Missing or invalid required field: date');
    }
    if (typeof parsed.verified !== 'boolean') {
      throw new DocumentParseError('Missing or invalid required field: verified (must be boolean)');
    }
    if (typeof parsed.processed !== 'boolean') {
      throw new DocumentParseError(
        'Missing or invalid required field: processed (must be boolean)'
      );
    }
    if (!parsed.uploadedAt || typeof parsed.uploadedAt !== 'string') {
      throw new DocumentParseError('Missing or invalid required field: uploadedAt');
    }

    // Return the parsed document
    return parsed as MedicalRecord;
  } catch (jsonError) {
    // If it's a DocumentParseError, re-throw it
    if (jsonError instanceof DocumentParseError) {
      throw jsonError;
    }

    // If JSON parsing fails, treat as plain text and extract entities
    const entities = extractEntities(text);

    // Create a basic MedicalRecord from plain text
    // Extract title from first line or first 50 characters
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    const title = lines[0]?.substring(0, 50) || 'Untitled Document';

    // Try to determine category from content
    let category: 'prescription' | 'lab-report' | 'scan' | 'other' = 'other';
    const lowerText = text.toLowerCase();
    if (
      lowerText.includes('prescription') ||
      lowerText.includes('medication') ||
      lowerText.includes('rx')
    ) {
      category = 'prescription';
    } else if (
      lowerText.includes('lab') ||
      lowerText.includes('test') ||
      lowerText.includes('result')
    ) {
      category = 'lab-report';
    } else if (
      lowerText.includes('scan') ||
      lowerText.includes('x-ray') ||
      lowerText.includes('mri') ||
      lowerText.includes('ct')
    ) {
      category = 'scan';
    }

    // Extract date from entities or use current date
    const dateEntity = entities.find((e) => e.type === 'date');
    const date = dateEntity ? dateEntity.text : new Date().toISOString().split('T')[0];

    return {
      id: `doc-${Date.now()}`,
      patientId: 'unknown',
      title,
      category,
      date,
      verified: false,
      processed: true,
      ocrText: text,
      entities,
      uploadedAt: new Date().toISOString(),
    };
  }
}

/**
 * Format a MedicalRecord object back into human-readable text
 *
 * @param document - The MedicalRecord object to format
 * @returns Formatted text representation
 * @throws DocumentParseError if the document is invalid
 */
export function printMedicalDocument(document: MedicalRecord): string {
  // Validate input
  if (!document || typeof document !== 'object') {
    throw new DocumentParseError('Document must be an object');
  }

  // Validate required fields
  if (!document.id || typeof document.id !== 'string') {
    throw new DocumentParseError('Missing or invalid required field: id');
  }
  if (!document.patientId || typeof document.patientId !== 'string') {
    throw new DocumentParseError('Missing or invalid required field: patientId');
  }
  if (!document.title || typeof document.title !== 'string') {
    throw new DocumentParseError('Missing or invalid required field: title');
  }
  if (
    !document.category ||
    !['prescription', 'lab-report', 'scan', 'other'].includes(document.category)
  ) {
    throw new DocumentParseError('Missing or invalid required field: category');
  }
  if (!document.date || typeof document.date !== 'string') {
    throw new DocumentParseError('Missing or invalid required field: date');
  }

  // Format as JSON for structured output (enables round-trip)
  return JSON.stringify(document, null, 2);
}

/**
 * Format date consistently (ISO 8601 format)
 */
export function formatDate(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  } catch {
    throw new DocumentParseError('Invalid date format');
  }
}

/**
 * Format measurement with unit
 */
export function formatMeasurement(value: number | string, unit: string): string {
  return `${value} ${unit}`;
}

/**
 * Normalize medical terminology to standard format
 */
export function normalizeMedicalTerm(term: string): string {
  // Convert to title case
  return term
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
