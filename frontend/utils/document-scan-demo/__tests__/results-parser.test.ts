/**
 * Unit tests for results parser
 */

import {
  parseResults,
  formatResults,
  getConfidenceLevel,
  getConfidenceBadgeColor,
  ParsingError,
} from '../results-parser';
import type { ProcessingResults } from '@/lib/document-scan-demo/types';

describe('parseResults', () => {
  const validApiResponse = {
    jobId: 'job-123',
    documentUrl: 'https://example.com/doc.jpg',
    ocrText: 'Sample OCR text',
    entities: [{ text: 'Amoxicillin', type: 'MEDICATION', confidence: 0.95 }],
    medications: [
      {
        name: 'Amoxicillin',
        dosage: '500mg',
        frequency: '3 times daily',
        confidence: 0.95,
      },
    ],
    conditions: ['Bacterial Infection'],
    labResults: [
      {
        testName: 'Hemoglobin',
        value: '14.2',
        unit: 'g/dL',
        confidence: 0.92,
      },
    ],
    fhirResource: {
      resourceType: 'MedicationRequest',
      status: 'active',
    },
    processedAt: '2024-01-15T10:30:00Z',
  };

  it('should parse valid API response', () => {
    const result = parseResults(validApiResponse);

    expect(result.jobId).toBe('job-123');
    expect(result.documentUrl).toBe('https://example.com/doc.jpg');
    expect(result.ocrText).toBe('Sample OCR text');
    expect(result.entities).toHaveLength(1);
    expect(result.medications).toHaveLength(1);
    expect(result.conditions).toEqual(['Bacterial Infection']);
    expect(result.labResults).toHaveLength(1);
    expect(result.fhirResource).toEqual({
      resourceType: 'MedicationRequest',
      status: 'active',
    });
    expect(result.processedAt).toBe('2024-01-15T10:30:00Z');
  });

  it('should throw ParsingError for null response', () => {
    expect(() => parseResults(null)).toThrow(ParsingError);
    expect(() => parseResults(null)).toThrow('API response must be an object');
  });

  it('should throw ParsingError for non-object response', () => {
    expect(() => parseResults('string')).toThrow(ParsingError);
    expect(() => parseResults(123)).toThrow(ParsingError);
  });

  it('should throw ParsingError for missing jobId', () => {
    const response = { ...validApiResponse };
    delete (response as any).jobId;
    expect(() => parseResults(response)).toThrow('Missing or invalid jobId');
  });

  it('should throw ParsingError for missing documentUrl', () => {
    const response = { ...validApiResponse };
    delete (response as any).documentUrl;
    expect(() => parseResults(response)).toThrow('Missing or invalid documentUrl');
  });

  it('should throw ParsingError for missing ocrText', () => {
    const response = { ...validApiResponse };
    delete (response as any).ocrText;
    expect(() => parseResults(response)).toThrow('Missing or invalid ocrText');
  });

  it('should throw ParsingError for missing processedAt', () => {
    const response = { ...validApiResponse };
    delete (response as any).processedAt;
    expect(() => parseResults(response)).toThrow('Missing or invalid processedAt');
  });

  it('should handle empty entities array', () => {
    const response = { ...validApiResponse, entities: [] };
    const result = parseResults(response);
    expect(result.entities).toEqual([]);
  });

  it('should handle missing entities field', () => {
    const response = { ...validApiResponse };
    delete (response as any).entities;
    const result = parseResults(response);
    expect(result.entities).toEqual([]);
  });

  it('should filter out invalid entities', () => {
    const response = {
      ...validApiResponse,
      entities: [
        { text: 'Valid', type: 'MEDICATION', confidence: 0.9 },
        { text: 'Invalid', type: 'MEDICATION' }, // missing confidence
        { text: 'Invalid2' }, // missing type and confidence
        'not an object',
      ],
    };
    const result = parseResults(response);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].text).toBe('Valid');
  });

  it('should handle empty medications array', () => {
    const response = { ...validApiResponse, medications: [] };
    const result = parseResults(response);
    expect(result.medications).toEqual([]);
  });

  it('should filter out invalid medications', () => {
    const response = {
      ...validApiResponse,
      medications: [
        {
          name: 'Valid',
          dosage: '500mg',
          frequency: 'daily',
          confidence: 0.9,
        },
        { name: 'Invalid', dosage: '500mg' }, // missing frequency and confidence
        'not an object',
      ],
    };
    const result = parseResults(response);
    expect(result.medications).toHaveLength(1);
    expect(result.medications[0].name).toBe('Valid');
  });

  it('should handle empty conditions array', () => {
    const response = { ...validApiResponse, conditions: [] };
    const result = parseResults(response);
    expect(result.conditions).toEqual([]);
  });

  it('should filter out non-string conditions', () => {
    const response = {
      ...validApiResponse,
      conditions: ['Valid Condition', 123, null, 'Another Valid'],
    };
    const result = parseResults(response);
    expect(result.conditions).toEqual(['Valid Condition', 'Another Valid']);
  });

  it('should handle empty labResults array', () => {
    const response = { ...validApiResponse, labResults: [] };
    const result = parseResults(response);
    expect(result.labResults).toEqual([]);
  });

  it('should filter out invalid lab results', () => {
    const response = {
      ...validApiResponse,
      labResults: [
        {
          testName: 'Valid',
          value: '10',
          unit: 'mg/dL',
          confidence: 0.9,
        },
        { testName: 'Invalid', value: '10' }, // missing unit and confidence
        'not an object',
      ],
    };
    const result = parseResults(response);
    expect(result.labResults).toHaveLength(1);
    expect(result.labResults[0].testName).toBe('Valid');
  });

  it('should parse FHIR resource as object', () => {
    const response = {
      ...validApiResponse,
      fhirResource: { resourceType: 'Bundle' },
    };
    const result = parseResults(response);
    expect(result.fhirResource).toEqual({ resourceType: 'Bundle' });
  });

  it('should parse FHIR resource from JSON string', () => {
    const response = {
      ...validApiResponse,
      fhirResource: '{"resourceType":"Bundle"}',
    };
    const result = parseResults(response);
    expect(result.fhirResource).toEqual({ resourceType: 'Bundle' });
  });

  it('should throw ParsingError for malformed FHIR JSON string', () => {
    const response = {
      ...validApiResponse,
      fhirResource: '{invalid json}',
    };
    expect(() => parseResults(response)).toThrow('FHIR resource contains malformed JSON');
  });

  it('should throw ParsingError for invalid FHIR resource type', () => {
    const response = {
      ...validApiResponse,
      fhirResource: 'not a json string',
    };
    expect(() => parseResults(response)).toThrow('FHIR resource contains malformed JSON');
  });
});

describe('formatResults', () => {
  const sampleResults: ProcessingResults = {
    jobId: 'job-123',
    documentUrl: 'https://example.com/doc.jpg',
    ocrText: 'Sample text',
    entities: [{ text: 'Entity', type: 'TYPE', confidence: 0.9 }],
    medications: [
      {
        name: 'Med',
        dosage: '100mg',
        frequency: 'daily',
        confidence: 0.95,
      },
    ],
    conditions: ['Condition'],
    labResults: [
      {
        testName: 'Test',
        value: '10',
        unit: 'mg/dL',
        confidence: 0.92,
      },
    ],
    fhirResource: { resourceType: 'Bundle' },
    processedAt: '2024-01-15T10:30:00Z',
  };

  it('should format results for display', () => {
    const formatted = formatResults(sampleResults);

    expect(formatted.jobId).toBe('job-123');
    expect(formatted.documentUrl).toBe('https://example.com/doc.jpg');
    expect(formatted.ocrText).toBe('Sample text');
    expect(Array.isArray(formatted.entities)).toBe(true);
    expect(Array.isArray(formatted.medications)).toBe(true);
    expect(Array.isArray(formatted.conditions)).toBe(true);
    expect(Array.isArray(formatted.labResults)).toBe(true);
    expect(formatted.fhirResource).toEqual({ resourceType: 'Bundle' });
  });

  it('should preserve all entity fields', () => {
    const formatted = formatResults(sampleResults);
    const entities = formatted.entities as any[];
    expect(entities[0]).toEqual({
      text: 'Entity',
      type: 'TYPE',
      confidence: 0.9,
    });
  });

  it('should preserve all medication fields', () => {
    const formatted = formatResults(sampleResults);
    const medications = formatted.medications as any[];
    expect(medications[0]).toEqual({
      name: 'Med',
      dosage: '100mg',
      frequency: 'daily',
      confidence: 0.95,
    });
  });

  it('should preserve all lab result fields', () => {
    const formatted = formatResults(sampleResults);
    const labResults = formatted.labResults as any[];
    expect(labResults[0]).toEqual({
      testName: 'Test',
      value: '10',
      unit: 'mg/dL',
      confidence: 0.92,
    });
  });
});

describe('getConfidenceLevel', () => {
  it('should return high for confidence >= 0.9', () => {
    expect(getConfidenceLevel(0.9)).toBe('high');
    expect(getConfidenceLevel(0.95)).toBe('high');
    expect(getConfidenceLevel(1.0)).toBe('high');
  });

  it('should return medium for confidence >= 0.7 and < 0.9', () => {
    expect(getConfidenceLevel(0.7)).toBe('medium');
    expect(getConfidenceLevel(0.8)).toBe('medium');
    expect(getConfidenceLevel(0.89)).toBe('medium');
  });

  it('should return low for confidence < 0.7', () => {
    expect(getConfidenceLevel(0.69)).toBe('low');
    expect(getConfidenceLevel(0.5)).toBe('low');
    expect(getConfidenceLevel(0.0)).toBe('low');
  });
});

describe('getConfidenceBadgeColor', () => {
  it('should return green classes for high confidence', () => {
    expect(getConfidenceBadgeColor(0.95)).toBe('bg-green-100 text-green-800');
  });

  it('should return yellow classes for medium confidence', () => {
    expect(getConfidenceBadgeColor(0.8)).toBe('bg-yellow-100 text-yellow-800');
  });

  it('should return red classes for low confidence', () => {
    expect(getConfidenceBadgeColor(0.5)).toBe('bg-red-100 text-red-800');
  });
});
