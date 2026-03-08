import {
  parseMedicalDocument,
  printMedicalDocument,
  DocumentParseError,
  formatDate,
  formatMeasurement,
  normalizeMedicalTerm,
} from '../document-parser';
import { MedicalRecord } from '../types';

describe('parseMedicalDocument', () => {
  describe('JSON input parsing', () => {
    it('should parse valid JSON medical document', () => {
      const validDoc = {
        id: 'doc-001',
        patientId: 'patient-001',
        title: 'Test Document',
        category: 'prescription',
        date: '2024-01-15',
        verified: true,
        processed: true,
        uploadedAt: '2024-01-15T10:00:00Z',
      };

      const result = parseMedicalDocument(JSON.stringify(validDoc));

      expect(result).toEqual(validDoc);
    });

    it('should parse document with optional fields', () => {
      const docWithOptionals = {
        id: 'doc-002',
        patientId: 'patient-002',
        title: 'Lab Report',
        category: 'lab-report',
        date: '2024-01-10',
        verified: false,
        processed: true,
        uploadedAt: '2024-01-10T14:00:00Z',
        s3Key: 'documents/lab-report.pdf',
        thumbnailUrl: '/thumbnails/lab.jpg',
        ocrText: 'HbA1c: 7.2%',
        entities: [{ text: 'HbA1c: 7.2%', type: 'vital', confidence: 0.9 }],
        processedAt: '2024-01-10T14:05:00Z',
      };

      const result = parseMedicalDocument(JSON.stringify(docWithOptionals));

      expect(result).toEqual(docWithOptionals);
    });
  });

  describe('Plain text parsing with entity extraction', () => {
    it('should extract medication entities', () => {
      const text = 'Patient prescribed Metformin 500mg twice daily and Amlodipine 5mg once daily.';

      const result = parseMedicalDocument(text);

      expect(result.entities).toBeDefined();
      const medications = result.entities!.filter((e) => e.type === 'medication');
      expect(medications.length).toBeGreaterThan(0);
      expect(medications.some((m) => m.text.toLowerCase().includes('metformin'))).toBe(true);
    });

    it('should extract diagnosis entities', () => {
      const text = 'Patient diagnosed with Type 2 Diabetes and Hypertension.';

      const result = parseMedicalDocument(text);

      expect(result.entities).toBeDefined();
      const diagnoses = result.entities!.filter((e) => e.type === 'diagnosis');
      expect(diagnoses.length).toBeGreaterThan(0);
      expect(diagnoses.some((d) => d.text.toLowerCase().includes('diabetes'))).toBe(true);
    });

    it('should extract vital sign entities', () => {
      const text = 'Vitals: Blood pressure: 128/82 mmHg, Heart rate: 72 bpm, Temperature: 98.6°F';

      const result = parseMedicalDocument(text);

      expect(result.entities).toBeDefined();
      const vitals = result.entities!.filter((e) => e.type === 'vital');
      expect(vitals.length).toBeGreaterThan(0);
    });

    it('should extract date entities', () => {
      const text = 'Visit date: 01/15/2024. Follow-up scheduled for January 30, 2024.';

      const result = parseMedicalDocument(text);

      expect(result.entities).toBeDefined();
      const dates = result.entities!.filter((e) => e.type === 'date');
      expect(dates.length).toBeGreaterThan(0);
    });

    it('should determine category from content - prescription', () => {
      const text = 'Prescription: Metformin 500mg twice daily';

      const result = parseMedicalDocument(text);

      expect(result.category).toBe('prescription');
    });

    it('should determine category from content - lab report', () => {
      const text = 'Lab Test Results: HbA1c 7.2%';

      const result = parseMedicalDocument(text);

      expect(result.category).toBe('lab-report');
    });

    it('should determine category from content - scan', () => {
      const text = 'X-Ray scan of chest shows no abnormalities';

      const result = parseMedicalDocument(text);

      expect(result.category).toBe('scan');
    });

    it('should use first line as title', () => {
      const text = 'Diabetes Follow-up Report\nPatient shows improvement.';

      const result = parseMedicalDocument(text);

      expect(result.title).toBe('Diabetes Follow-up Report');
    });

    it('should store original text in ocrText field', () => {
      const text = 'Sample medical document text';

      const result = parseMedicalDocument(text);

      expect(result.ocrText).toBe(text);
    });
  });

  describe('Error handling', () => {
    it('should throw error for non-string input', () => {
      expect(() => parseMedicalDocument(123 as any)).toThrow(DocumentParseError);
      expect(() => parseMedicalDocument(123 as any)).toThrow('Input must be a string');
    });

    it('should throw error for empty string', () => {
      expect(() => parseMedicalDocument('')).toThrow(DocumentParseError);
      expect(() => parseMedicalDocument('')).toThrow('Input text cannot be empty');
    });

    it('should throw error for whitespace-only string', () => {
      expect(() => parseMedicalDocument('   \n  \t  ')).toThrow(DocumentParseError);
      expect(() => parseMedicalDocument('   \n  \t  ')).toThrow('Input text cannot be empty');
    });

    it('should throw error for JSON missing id field', () => {
      const invalidDoc = {
        patientId: 'patient-001',
        title: 'Test',
        category: 'prescription',
        date: '2024-01-15',
        verified: true,
        processed: true,
        uploadedAt: '2024-01-15T10:00:00Z',
      };

      expect(() => parseMedicalDocument(JSON.stringify(invalidDoc))).toThrow(DocumentParseError);
      expect(() => parseMedicalDocument(JSON.stringify(invalidDoc))).toThrow(
        'Missing or invalid required field: id'
      );
    });

    it('should throw error for JSON missing patientId field', () => {
      const invalidDoc = {
        id: 'doc-001',
        title: 'Test',
        category: 'prescription',
        date: '2024-01-15',
        verified: true,
        processed: true,
        uploadedAt: '2024-01-15T10:00:00Z',
      };

      expect(() => parseMedicalDocument(JSON.stringify(invalidDoc))).toThrow(DocumentParseError);
      expect(() => parseMedicalDocument(JSON.stringify(invalidDoc))).toThrow(
        'Missing or invalid required field: patientId'
      );
    });

    it('should throw error for invalid category', () => {
      const invalidDoc = {
        id: 'doc-001',
        patientId: 'patient-001',
        title: 'Test',
        category: 'invalid-category',
        date: '2024-01-15',
        verified: true,
        processed: true,
        uploadedAt: '2024-01-15T10:00:00Z',
      };

      expect(() => parseMedicalDocument(JSON.stringify(invalidDoc))).toThrow(DocumentParseError);
      expect(() => parseMedicalDocument(JSON.stringify(invalidDoc))).toThrow(
        'Missing or invalid required field: category'
      );
    });

    it('should throw error for non-boolean verified field', () => {
      const invalidDoc = {
        id: 'doc-001',
        patientId: 'patient-001',
        title: 'Test',
        category: 'prescription',
        date: '2024-01-15',
        verified: 'true',
        processed: true,
        uploadedAt: '2024-01-15T10:00:00Z',
      };

      expect(() => parseMedicalDocument(JSON.stringify(invalidDoc))).toThrow(DocumentParseError);
      expect(() => parseMedicalDocument(JSON.stringify(invalidDoc))).toThrow(
        'Missing or invalid required field: verified'
      );
    });
  });
});

describe('printMedicalDocument', () => {
  const validDocument: MedicalRecord = {
    id: 'doc-001',
    patientId: 'patient-001',
    title: 'Test Document',
    category: 'prescription',
    date: '2024-01-15',
    verified: true,
    processed: true,
    uploadedAt: '2024-01-15T10:00:00Z',
  };

  it('should format valid document as JSON', () => {
    const result = printMedicalDocument(validDocument);

    expect(result).toBeTruthy();
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual(validDocument);
  });

  it('should format document with optional fields', () => {
    const docWithOptionals: MedicalRecord = {
      ...validDocument,
      s3Key: 'documents/test.pdf',
      thumbnailUrl: '/thumbnails/test.jpg',
      ocrText: 'Sample text',
      entities: [{ text: 'Metformin', type: 'medication', confidence: 0.9 }],
      processedAt: '2024-01-15T10:05:00Z',
    };

    const result = printMedicalDocument(docWithOptionals);

    expect(JSON.parse(result)).toEqual(docWithOptionals);
  });

  it('should produce pretty-printed JSON with indentation', () => {
    const result = printMedicalDocument(validDocument);

    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });

  describe('Error handling', () => {
    it('should throw error for null input', () => {
      expect(() => printMedicalDocument(null as any)).toThrow(DocumentParseError);
      expect(() => printMedicalDocument(null as any)).toThrow('Document must be an object');
    });

    it('should throw error for non-object input', () => {
      expect(() => printMedicalDocument('string' as any)).toThrow(DocumentParseError);
      expect(() => printMedicalDocument('string' as any)).toThrow('Document must be an object');
    });

    it('should throw error for missing id field', () => {
      const invalidDoc = { ...validDocument };
      delete (invalidDoc as any).id;

      expect(() => printMedicalDocument(invalidDoc as any)).toThrow(DocumentParseError);
      expect(() => printMedicalDocument(invalidDoc as any)).toThrow(
        'Missing or invalid required field: id'
      );
    });

    it('should throw error for missing patientId field', () => {
      const invalidDoc = { ...validDocument };
      delete (invalidDoc as any).patientId;

      expect(() => printMedicalDocument(invalidDoc as any)).toThrow(DocumentParseError);
      expect(() => printMedicalDocument(invalidDoc as any)).toThrow(
        'Missing or invalid required field: patientId'
      );
    });

    it('should throw error for invalid category', () => {
      const invalidDoc = { ...validDocument, category: 'invalid' as any };

      expect(() => printMedicalDocument(invalidDoc)).toThrow(DocumentParseError);
      expect(() => printMedicalDocument(invalidDoc)).toThrow(
        'Missing or invalid required field: category'
      );
    });
  });
});

describe('Round-trip property', () => {
  it('should preserve document through parse-print-parse cycle', () => {
    const originalDoc: MedicalRecord = {
      id: 'doc-roundtrip',
      patientId: 'patient-roundtrip',
      title: 'Round Trip Test',
      category: 'lab-report',
      date: '2024-01-20',
      verified: false,
      processed: true,
      uploadedAt: '2024-01-20T12:00:00Z',
      s3Key: 'documents/roundtrip.pdf',
      entities: [
        { text: 'HbA1c: 7.2%', type: 'vital', confidence: 0.9 },
        { text: 'Type 2 Diabetes', type: 'diagnosis', confidence: 0.85 },
      ],
    };

    // Print to text
    const text = printMedicalDocument(originalDoc);

    // Parse back to object
    const parsedDoc = parseMedicalDocument(text);

    // Should be equivalent
    expect(parsedDoc).toEqual(originalDoc);
  });

  it('should handle multiple round trips', () => {
    const originalDoc: MedicalRecord = {
      id: 'doc-multi',
      patientId: 'patient-multi',
      title: 'Multi Round Trip',
      category: 'prescription',
      date: '2024-01-21',
      verified: true,
      processed: true,
      uploadedAt: '2024-01-21T08:00:00Z',
    };

    let current = originalDoc;

    // Perform 5 round trips
    for (let i = 0; i < 5; i++) {
      const text = printMedicalDocument(current);
      current = parseMedicalDocument(text);
    }

    expect(current).toEqual(originalDoc);
  });
});

describe('formatDate', () => {
  it('should format Date object to ISO 8601', () => {
    const date = new Date('2024-01-15T10:30:00Z');

    const result = formatDate(date);

    expect(result).toBe('2024-01-15');
  });

  it('should format date string to ISO 8601', () => {
    const result = formatDate('2024-01-15T10:30:00Z');

    expect(result).toBe('2024-01-15');
  });

  it('should throw error for invalid date', () => {
    expect(() => formatDate('invalid-date')).toThrow(DocumentParseError);
    expect(() => formatDate('invalid-date')).toThrow('Invalid date format');
  });
});

describe('formatMeasurement', () => {
  it('should format numeric value with unit', () => {
    expect(formatMeasurement(500, 'mg')).toBe('500 mg');
  });

  it('should format string value with unit', () => {
    expect(formatMeasurement('128/82', 'mmHg')).toBe('128/82 mmHg');
  });

  it('should handle decimal values', () => {
    expect(formatMeasurement(98.6, '°F')).toBe('98.6 °F');
  });
});

describe('normalizeMedicalTerm', () => {
  it('should convert to title case', () => {
    expect(normalizeMedicalTerm('type 2 diabetes')).toBe('Type 2 Diabetes');
  });

  it('should handle all uppercase', () => {
    expect(normalizeMedicalTerm('HYPERTENSION')).toBe('Hypertension');
  });

  it('should handle mixed case', () => {
    expect(normalizeMedicalTerm('hYpErTeNsIoN')).toBe('Hypertension');
  });

  it('should handle single word', () => {
    expect(normalizeMedicalTerm('diabetes')).toBe('Diabetes');
  });
});
