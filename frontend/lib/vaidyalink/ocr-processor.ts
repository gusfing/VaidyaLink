/**
 * OCR Processor using Tesseract.js
 * Performs client-side OCR on uploaded medical documents
 */

import type { ProcessingResults } from '@/lib/document-scan-demo/types';

/**
 * Extract medical entities from OCR text using pattern matching
 */
function extractMedicalEntities(text: string): ProcessingResults['entities'] {
  const entities: ProcessingResults['entities'] = [];

  // Common medical patterns
  const patterns = {
    PATIENT_NAME: /(?:patient|name|pt\.?)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
    DIAGNOSIS:
      /(?:diagnosis|dx|condition)\s*:?\s*([A-Za-z\s]+(?:diabetes|hypertension|asthma|fever|infection|disease|syndrome))/gi,
    MEDICATION: /(?:medication|medicine|drug|rx)\s*:?\s*([A-Z][a-z]+(?:in|ol|ide|ate|cin)?)/gi,
    DATE: /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/g,
    DOSAGE: /\b(\d+\s*(?:mg|ml|mcg|g|units?))\b/gi,
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const matchedText = match[1] || match[0];
      entities.push({
        text: matchedText.trim(),
        type: type as any,
        confidence: 0.85, // Estimated confidence for pattern matching
      });
    }
  }

  return entities;
}

/**
 * Extract medications from OCR text
 */
function extractMedications(text: string): ProcessingResults['medications'] {
  const medications: ProcessingResults['medications'] = [];

  // Pattern: Medication name followed by dosage and frequency
  const medPattern =
    /([A-Z][a-z]+(?:in|ol|ide|ate|cin)?)\s+(\d+\s*(?:mg|ml|mcg))\s+([a-z\s]+(?:daily|twice|thrice|times|day|morning|evening|night))/gi;

  const matches = text.matchAll(medPattern);
  for (const match of matches) {
    medications.push({
      name: match[1].trim(),
      dosage: match[2].trim(),
      frequency: match[3].trim(),
      confidence: 0.8,
    });
  }

  return medications;
}

/**
 * Extract medical conditions from OCR text
 */
function extractConditions(text: string): string[] {
  const conditions: string[] = [];
  const conditionKeywords = [
    'diabetes',
    'hypertension',
    'asthma',
    'copd',
    'arthritis',
    'depression',
    'anxiety',
    'cancer',
    'heart disease',
    'stroke',
    'kidney disease',
    'liver disease',
    'thyroid',
    'anemia',
    'infection',
    'fever',
    'pneumonia',
    'bronchitis',
  ];

  const lowerText = text.toLowerCase();
  for (const condition of conditionKeywords) {
    if (lowerText.includes(condition)) {
      conditions.push(condition.charAt(0).toUpperCase() + condition.slice(1));
    }
  }

  return [...new Set(conditions)]; // Remove duplicates
}

/**
 * Process image with Tesseract.js OCR
 */
export async function processImageWithOCR(file: File): Promise<ProcessingResults> {
  try {
    // Dynamic import to avoid SSR issues
    const Tesseract = await import('tesseract.js');

    // Create worker
    const worker = await Tesseract.createWorker('eng');

    // Perform OCR
    const { data } = await worker.recognize(file);
    const ocrText = data.text;

    // Terminate worker
    await worker.terminate();

    // Extract medical information
    const entities = extractMedicalEntities(ocrText);
    const medications = extractMedications(ocrText);
    const conditions = extractConditions(ocrText);

    return {
      jobId: `ocr-${Date.now()}`,
      documentUrl: URL.createObjectURL(file),
      ocrText,
      entities,
      medications,
      conditions,
      labResults: [],
      fhirResource: {},
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('OCR processing failed:', error);
    throw new Error('Failed to process document with OCR');
  }
}

/**
 * Check if Tesseract.js is available
 */
export async function isOCRAvailable(): Promise<boolean> {
  try {
    await import('tesseract.js');
    return true;
  } catch {
    return false;
  }
}
