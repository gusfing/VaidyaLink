/**
 * Unit tests for mock data utility
 * Tests demo mode functionality
 */

import {
  mockApiResponses,
  MOCK_PRESCRIPTION_RESULTS,
  MOCK_LAB_RESULTS,
  simulateProcessingStages,
  simulateUpload,
} from '../mock-data';

describe('Mock Data Utility', () => {
  describe('mockApiResponses', () => {
    it('should generate pre-signed URL response', () => {
      const response = mockApiResponses.getPresignedUrl('test-document.jpg');

      expect(response).toHaveProperty('uploadUrl');
      expect(response).toHaveProperty('s3Key');
      expect(response).toHaveProperty('expiresIn');
      expect(response.uploadUrl).toContain('mock-s3.amazonaws.com');
      expect(response.s3Key).toContain('test-document.jpg');
      expect(response.expiresIn).toBe(3600);
    });

    it('should generate processing job ID', () => {
      const response = mockApiResponses.triggerProcessing('test-s3-key');

      expect(response).toHaveProperty('jobId');
      expect(response.jobId).toContain('demo-job-');
    });

    it('should return job status with correct stage', () => {
      const response = mockApiResponses.getJobStatus('test-job', 'processing');

      expect(response.jobId).toBe('test-job');
      expect(response.status).toBe('processing');
      expect(response.message).toBe('Processing document with OCR...');
    });

    it('should return processing results', () => {
      const response = mockApiResponses.getResults('test-job');

      expect(response).toHaveProperty('jobId');
      expect(response).toHaveProperty('documentUrl');
      expect(response).toHaveProperty('ocrText');
      expect(response).toHaveProperty('entities');
      expect(response).toHaveProperty('medications');
      expect(response).toHaveProperty('fhirResource');
    });
  });

  describe('MOCK_PRESCRIPTION_RESULTS', () => {
    it('should contain valid prescription data', () => {
      expect(MOCK_PRESCRIPTION_RESULTS.medications).toHaveLength(2);
      expect(MOCK_PRESCRIPTION_RESULTS.medications[0].name).toBe('Amoxicillin');
      expect(MOCK_PRESCRIPTION_RESULTS.medications[0].dosage).toBe('500mg');
      expect(MOCK_PRESCRIPTION_RESULTS.medications[0].frequency).toBe('3 times daily');
      expect(MOCK_PRESCRIPTION_RESULTS.medications[0].confidence).toBeGreaterThan(0.9);
    });

    it('should contain OCR text', () => {
      expect(MOCK_PRESCRIPTION_RESULTS.ocrText).toContain('Amoxicillin');
      expect(MOCK_PRESCRIPTION_RESULTS.ocrText).toContain('500mg');
      expect(MOCK_PRESCRIPTION_RESULTS.ocrText.length).toBeGreaterThan(100);
    });

    it('should contain FHIR resources', () => {
      expect(MOCK_PRESCRIPTION_RESULTS.fhirResource).toHaveProperty('resourceType');
      expect(MOCK_PRESCRIPTION_RESULTS.fhirResource.resourceType).toBe('Bundle');
      expect(MOCK_PRESCRIPTION_RESULTS.fhirResource).toHaveProperty('entry');
    });

    it('should have confidence scores between 0 and 1', () => {
      MOCK_PRESCRIPTION_RESULTS.medications.forEach((med) => {
        expect(med.confidence).toBeGreaterThanOrEqual(0);
        expect(med.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('MOCK_LAB_RESULTS', () => {
    it('should contain valid lab test data', () => {
      expect(MOCK_LAB_RESULTS.labResults.length).toBeGreaterThan(5);

      const hemoglobin = MOCK_LAB_RESULTS.labResults.find((test) => test.testName === 'Hemoglobin');
      expect(hemoglobin).toBeDefined();
      expect(hemoglobin?.value).toBe('14.2');
      expect(hemoglobin?.unit).toBe('g/dL');
    });

    it('should have no medications', () => {
      expect(MOCK_LAB_RESULTS.medications).toHaveLength(0);
    });

    it('should contain lab-specific OCR text', () => {
      expect(MOCK_LAB_RESULTS.ocrText).toContain('LABORATORY REPORT');
      expect(MOCK_LAB_RESULTS.ocrText).toContain('Hemoglobin');
      expect(MOCK_LAB_RESULTS.ocrText).toContain('Glucose');
    });
  });

  describe('simulateProcessingStages', () => {
    it('should call callback with each processing stage', (done) => {
      const stages: string[] = [];

      const cleanup = simulateProcessingStages(
        'test-job',
        (status) => {
          stages.push(status.status);
        },
        500 // 500ms for quick test
      );

      setTimeout(() => {
        cleanup();
        expect(stages.length).toBeGreaterThan(0);
        expect(stages).toContain('uploading');
        expect(stages[stages.length - 1]).toBe('complete');
        done();
      }, 600);
    });

    it('should progress through stages in order', (done) => {
      const stages: string[] = [];

      const cleanup = simulateProcessingStages(
        'test-job',
        (status) => {
          stages.push(status.status);
        },
        1000
      );

      setTimeout(() => {
        cleanup();
        const expectedOrder = ['uploading', 'processing', 'extracting', 'transforming', 'complete'];
        expect(stages).toEqual(expectedOrder);
        done();
      }, 1100);
    });
  });

  describe('simulateUpload', () => {
    it('should call progress callback with increasing percentages', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const progressValues: number[] = [];

      await simulateUpload(
        mockFile,
        (progress) => {
          progressValues.push(progress);
        },
        200 // 200ms for quick test
      );

      expect(progressValues.length).toBeGreaterThan(0);
      expect(progressValues[0]).toBeGreaterThan(0);
      expect(progressValues[progressValues.length - 1]).toBe(100);

      // Verify progress increases
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }
    });

    it('should complete within specified delay', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const startTime = Date.now();
      const delay = 500;

      await simulateUpload(mockFile, () => {}, delay);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(delay);
      expect(elapsed).toBeLessThan(delay + 200); // Allow 200ms tolerance for slower systems
    });
  });
});
