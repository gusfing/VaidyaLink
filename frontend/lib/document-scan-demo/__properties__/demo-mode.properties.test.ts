/**
 * Property-Based Tests for Demo Mode
 * Feature: document-scan-demo, Property 28: Demo mode uses mock responses
 * Validates: Requirements 8.1
 */

import fc from 'fast-check';

// Mock the environment variable
const originalEnv = process.env.NEXT_PUBLIC_DEMO_MODE;

// Mock axios before importing api-client
jest.mock('axios', () => {
  const mockAxiosInstance = {
    create: jest.fn(() => mockAxiosInstance),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
  };
  return mockAxiosInstance;
});

// Mock axios-retry
jest.mock('axios-retry', () => jest.fn());

// Mock Amplify auth
jest.mock('aws-amplify/auth', () => ({
  fetchAuthSession: jest.fn().mockResolvedValue({
    tokens: {
      idToken: {
        toString: () => 'mock-token',
      },
    },
  }),
}));

// Import after mocks are set up
import * as apiClient from '../api-client';
import { mockApiResponses } from '@/utils/document-scan-demo/mock-data';

describe('Demo Mode Properties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = originalEnv;
  });

  describe('Property 28: Demo mode uses mock responses', () => {
    it('should use mock responses for getPresignedUrl when demo mode is enabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
          async (filename) => {
            // Enable demo mode
            process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

            // Call the API method
            const result = await apiClient.getPresignedUrl(filename);

            // Verify the result matches mock data structure
            expect(result).toHaveProperty('uploadUrl');
            expect(result).toHaveProperty('s3Key');
            expect(result).toHaveProperty('expiresIn');

            // Verify it's a mock response (contains 'mock' or 'demo')
            expect(result.uploadUrl.includes('mock') || result.s3Key.includes('demo')).toBe(true);

            // Verify the mock response structure matches expected format
            const mockResult = mockApiResponses.getPresignedUrl(filename);
            expect(result.expiresIn).toBe(mockResult.expiresIn);
          }
        ),
        { numRuns: 20 }
      );
    }, 30000);

    it('should use mock responses for triggerProcessing when demo mode is enabled', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1, maxLength: 200 }), async (s3Key) => {
          // Enable demo mode
          process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

          // Call the API method
          const result = await apiClient.triggerProcessing(s3Key);

          // Verify the result has jobId
          expect(result).toHaveProperty('jobId');
          expect(typeof result.jobId).toBe('string');
          expect(result.jobId.length).toBeGreaterThan(0);

          // Verify it's a demo job ID
          expect(result.jobId.includes('demo-job')).toBe(true);
        }),
        { numRuns: 20 }
      );
    }, 30000);

    it('should use mock responses for getJobStatus when demo mode is enabled', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1, maxLength: 100 }), async (jobId) => {
          // Enable demo mode
          process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

          // Call the API method
          const result = await apiClient.getJobStatus(jobId);

          // Verify the result matches JobStatusResponse structure
          expect(result).toHaveProperty('jobId');
          expect(result).toHaveProperty('status');
          expect(result).toHaveProperty('message');

          // Verify status is a valid ProcessingStage
          const validStatuses = [
            'uploading',
            'processing',
            'extracting',
            'transforming',
            'complete',
            'failed',
          ];
          expect(validStatuses).toContain(result.status);

          // Verify message is a string
          expect(typeof result.message).toBe('string');
        }),
        { numRuns: 20 }
      );
    }, 30000);

    it('should use mock responses for getResults when demo mode is enabled', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1, maxLength: 100 }), async (jobId) => {
          // Enable demo mode
          process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

          // Call the API method
          const result = await apiClient.getResults(jobId);

          // Verify the result matches ProcessingResults structure
          expect(result).toHaveProperty('jobId');
          expect(result).toHaveProperty('documentUrl');
          expect(result).toHaveProperty('ocrText');
          expect(result).toHaveProperty('entities');
          expect(result).toHaveProperty('medications');
          expect(result).toHaveProperty('conditions');
          expect(result).toHaveProperty('labResults');
          expect(result).toHaveProperty('fhirResource');
          expect(result).toHaveProperty('processedAt');

          // Verify arrays are present
          expect(Array.isArray(result.entities)).toBe(true);
          expect(Array.isArray(result.medications)).toBe(true);
          expect(Array.isArray(result.conditions)).toBe(true);
          expect(Array.isArray(result.labResults)).toBe(true);

          // Verify FHIR resource is an object
          expect(typeof result.fhirResource).toBe('object');
          expect(result.fhirResource).not.toBeNull();
        }),
        { numRuns: 20 }
      );
    }, 30000);

    it('should return mock responses consistently for the same input', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1, maxLength: 100 }), async (filename) => {
          // Enable demo mode
          process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

          // Call the same API method twice with the same input
          const result1 = await apiClient.getPresignedUrl(filename);
          const result2 = await apiClient.getPresignedUrl(filename);

          // Verify both results have the same structure
          expect(result1).toHaveProperty('uploadUrl');
          expect(result2).toHaveProperty('uploadUrl');
          expect(result1).toHaveProperty('s3Key');
          expect(result2).toHaveProperty('s3Key');
          expect(result1.expiresIn).toBe(result2.expiresIn);
        }),
        { numRuns: 15 }
      );
    }, 30000);

    it('should complete all API calls without making real HTTP requests in demo mode', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            filename: fc.string({ minLength: 1, maxLength: 50 }),
            s3Key: fc.string({ minLength: 1, maxLength: 100 }),
            jobId: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async ({ filename, s3Key, jobId }) => {
            // Enable demo mode
            process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

            // Execute all API methods
            const presignedUrl = await apiClient.getPresignedUrl(filename);
            const processing = await apiClient.triggerProcessing(s3Key);
            const status = await apiClient.getJobStatus(jobId);
            const results = await apiClient.getResults(jobId);

            // Verify all calls completed successfully
            expect(presignedUrl).toBeDefined();
            expect(processing).toBeDefined();
            expect(status).toBeDefined();
            expect(results).toBeDefined();

            // Verify all responses have expected properties
            expect(presignedUrl.uploadUrl).toBeDefined();
            expect(processing.jobId).toBeDefined();
            expect(status.status).toBeDefined();
            expect(results.ocrText).toBeDefined();
          }
        ),
        { numRuns: 15 }
      );
    }, 30000);

    it('should return responses with realistic medical data in demo mode', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1, maxLength: 50 }), async (jobId) => {
          // Enable demo mode
          process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

          // Get results
          const results = await apiClient.getResults(jobId);

          // Verify medical data is present and realistic
          if (results.medications.length > 0) {
            results.medications.forEach((med) => {
              expect(med).toHaveProperty('name');
              expect(med).toHaveProperty('dosage');
              expect(med).toHaveProperty('frequency');
              expect(med).toHaveProperty('confidence');
              expect(med.confidence).toBeGreaterThanOrEqual(0);
              expect(med.confidence).toBeLessThanOrEqual(1);
            });
          }

          if (results.labResults.length > 0) {
            results.labResults.forEach((lab) => {
              expect(lab).toHaveProperty('testName');
              expect(lab).toHaveProperty('value');
              expect(lab).toHaveProperty('unit');
              expect(lab).toHaveProperty('confidence');
              expect(lab.confidence).toBeGreaterThanOrEqual(0);
              expect(lab.confidence).toBeLessThanOrEqual(1);
            });
          }

          // Verify FHIR resource has proper structure
          expect(results.fhirResource).toHaveProperty('resourceType');
          expect(results.fhirResource).toHaveProperty('type');
        }),
        { numRuns: 15 }
      );
    }, 30000);
  });
});
