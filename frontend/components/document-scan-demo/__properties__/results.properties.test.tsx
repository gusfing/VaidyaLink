/**
 * Property-Based Tests for Results Display
 *
 * Tests universal properties that should hold for all valid processing results.
 * Uses fast-check for property-based testing with randomized inputs.
 */

import fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResultsDisplay from '../ResultsDisplay';
import { ProcessingResults, Medication, LabResult, Entity } from '@/lib/document-scan-demo/types';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock React Query hook
jest.mock('@/lib/document-scan-demo/queries', () => ({
  useProcessingResults: jest.fn(),
}));

// Mock react-syntax-highlighter to avoid ESM issues in Jest
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: string }) => <pre>{children}</pre>,
}));

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}));

import { useProcessingResults } from '@/lib/document-scan-demo/queries';
const mockUseProcessingResults = useProcessingResults as jest.MockedFunction<
  typeof useProcessingResults
>;

// ============================================================================
// Arbitraries (Generators for random test data)
// ============================================================================

/**
 * Generate random Entity objects
 */
const entityArbitrary = fc.record({
  text: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.constantFrom('MEDICATION', 'CONDITION', 'LAB_RESULT', 'OBSERVATION'),
  confidence: fc.float({ min: 0, max: 1 }),
});

/**
 * Generate random Medication objects with required fields
 */
const medicationArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  dosage: fc.string({ minLength: 1, maxLength: 50 }),
  frequency: fc.string({ minLength: 1, maxLength: 50 }),
  confidence: fc.float({ min: 0, max: 1 }),
});

/**
 * Generate random LabResult objects with required fields
 */
const labResultArbitrary = fc.record({
  testName: fc.string({ minLength: 1, maxLength: 100 }),
  value: fc.string({ minLength: 1, maxLength: 50 }),
  unit: fc.string({ minLength: 1, maxLength: 20 }),
  confidence: fc.float({ min: 0, max: 1 }),
});

/**
 * Generate random ProcessingResults objects
 */
const processingResultsArbitrary = fc.record({
  jobId: fc.uuid(),
  documentUrl: fc.webUrl(),
  ocrText: fc.string({ minLength: 10, maxLength: 1000 }),
  entities: fc.array(entityArbitrary, { minLength: 0, maxLength: 20 }),
  medications: fc.array(medicationArbitrary, { minLength: 0, maxLength: 10 }),
  conditions: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
    minLength: 0,
    maxLength: 10,
  }),
  labResults: fc.array(labResultArbitrary, { minLength: 0, maxLength: 10 }),
  fhirResource: fc.object(),
  processedAt: fc.date().map((d) => d.toISOString()),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('ResultsDisplay Properties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any rendered components
    document.body.innerHTML = '';
  });

  /**
   * Feature: document-scan-demo, Property 16: Results display is complete
   *
   * For any processing results received, the results display should show all
   * required components: original document image, OCR text, structured data
   * (medications, conditions, observations), confidence scores, and FHIR resource JSON.
   *
   * Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6
   */
  it('Property 16: should display all required result components', () => {
    fc.assert(
      fc.property(processingResultsArbitrary, (results) => {
        // Mock the query hook to return our generated results
        mockUseProcessingResults.mockReturnValue({
          data: results,
          isLoading: false,
          error: null,
          isError: false,
        } as any);

        // Render the component
        const { container, unmount } = render(<ResultsDisplay jobId={results.jobId} />);

        try {
          // Property: Original document image must be displayed
          const documentImage = screen.getAllByAltText('Original document')[0];
          expect(documentImage).toBeInTheDocument();
          expect(documentImage).toHaveAttribute('src', results.documentUrl);

          // Property: OCR text must be accessible (in OCR tab)
          // We verify the text exists in the DOM even if not currently visible
          expect(container.textContent).toContain(results.ocrText);

          // Property: Structured data tabs must exist
          expect(screen.getAllByText('Overview')[0]).toBeInTheDocument();
          expect(screen.getAllByText('OCR')[0]).toBeInTheDocument();
          expect(screen.getAllByText('Structured')[0]).toBeInTheDocument();
          expect(screen.getAllByText('FHIR')[0]).toBeInTheDocument();

          // Property: FHIR resource must be present in the DOM
          const fhirJson = JSON.stringify(results.fhirResource, null, 2);
          expect(container.textContent).toContain(fhirJson);

          // Property: "New Scan" button must be present
          const newScanButtons = screen.getAllByText('New Scan');
          expect(newScanButtons.length).toBeGreaterThan(0);

          // Property: Processed timestamp must be displayed
          expect(container.textContent).toContain('Processed at');
        } finally {
          unmount();
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: document-scan-demo, Property 17: Medication data includes required fields
   *
   * For any medication in the structured data, the results display should show
   * the medication name, dosage, and frequency.
   *
   * Validates: Requirements 4.8
   */
  it('Property 17: should display all required medication fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          results: processingResultsArbitrary,
        }),
        ({ results }) => {
          // Only test when there are medications
          fc.pre(results.medications.length > 0);

          // Mock the query hook
          mockUseProcessingResults.mockReturnValue({
            data: results,
            isLoading: false,
            error: null,
            isError: false,
          } as any);

          // Render the component
          const { unmount } = render(<ResultsDisplay jobId={results.jobId} />);

          try {
            // Click on Structured tab to view medications
            const structuredTab = screen.getAllByText('Structured')[0];
            structuredTab.click();

            // Property: For each medication, all required fields must be present
            results.medications.forEach((medication: Medication) => {
              // Medication name must be displayed
              expect(screen.getByText(medication.name)).toBeInTheDocument();

              // Dosage must be displayed
              expect(screen.getByText(medication.dosage, { exact: false })).toBeInTheDocument();

              // Frequency must be displayed
              expect(screen.getByText(medication.frequency, { exact: false })).toBeInTheDocument();

              // Confidence score must be displayed (as percentage)
              const confidencePercent = Math.round(medication.confidence * 100);
              expect(screen.getByText(`${confidencePercent}%`)).toBeInTheDocument();
            });
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: document-scan-demo, Property 18: Lab result data includes required fields
   *
   * For any lab result in the structured data, the results display should show
   * the test name, value, and unit.
   *
   * Validates: Requirements 4.9
   */
  it('Property 18: should display all required lab result fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          results: processingResultsArbitrary,
        }),
        ({ results }) => {
          // Only test when there are lab results
          fc.pre(results.labResults.length > 0);

          // Mock the query hook
          mockUseProcessingResults.mockReturnValue({
            data: results,
            isLoading: false,
            error: null,
            isError: false,
          } as any);

          // Render the component
          const { unmount } = render(<ResultsDisplay jobId={results.jobId} />);

          try {
            // Click on Structured tab to view lab results
            const structuredTab = screen.getAllByText('Structured')[0];
            structuredTab.click();

            // Property: For each lab result, all required fields must be present
            results.labResults.forEach((labResult: LabResult) => {
              // Test name must be displayed
              expect(screen.getByText(labResult.testName)).toBeInTheDocument();

              // Value must be displayed
              expect(screen.getByText(labResult.value)).toBeInTheDocument();

              // Unit must be displayed
              expect(screen.getByText(labResult.unit)).toBeInTheDocument();

              // Confidence score must be displayed (as percentage)
              const confidencePercent = Math.round(labResult.confidence * 100);
              expect(screen.getByText(`${confidencePercent}%`)).toBeInTheDocument();
            });
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Confidence scores are color-coded correctly
   *
   * Verifies that confidence scores are displayed with appropriate visual indicators
   * based on their value ranges (>90% green, 70-90% yellow, <70% red).
   */
  it('should color-code confidence scores based on value ranges', () => {
    fc.assert(
      fc.property(
        fc.record({
          highConfidence: fc.double({ min: 0.91, max: 1.0, noNaN: true }),
          mediumConfidence: fc.double({ min: 0.7, max: 0.9, noNaN: true }),
          lowConfidence: fc.double({ min: 0.0, max: 0.69, noNaN: true }),
        }),
        ({ highConfidence, mediumConfidence, lowConfidence }) => {
          const results: ProcessingResults = {
            jobId: 'test-job',
            documentUrl: 'https://example.com/doc.jpg',
            ocrText: 'Test OCR text',
            entities: [
              { text: 'High', type: 'TEST', confidence: highConfidence },
              { text: 'Medium', type: 'TEST', confidence: mediumConfidence },
              { text: 'Low', type: 'TEST', confidence: lowConfidence },
            ],
            medications: [],
            conditions: [],
            labResults: [],
            fhirResource: {},
            processedAt: new Date().toISOString(),
          };

          mockUseProcessingResults.mockReturnValue({
            data: results,
            isLoading: false,
            error: null,
            isError: false,
          } as any);

          const { container, unmount } = render(<ResultsDisplay jobId={results.jobId} />);

          try {
            // Verify color classes are applied based on confidence ranges
            const html = container.innerHTML;

            // High confidence should have green styling
            expect(html).toContain('bg-green-100');

            // Medium confidence should have yellow styling
            expect(html).toContain('bg-yellow-100');

            // Low confidence should have red styling
            expect(html).toContain('bg-red-100');
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional property: Empty results are handled gracefully
   *
   * Verifies that the component renders correctly even when result arrays are empty.
   */
  it('should handle empty result arrays gracefully', () => {
    fc.assert(
      fc.property(
        fc.record({
          jobId: fc.uuid(),
          documentUrl: fc.webUrl(),
          ocrText: fc.string(),
          processedAt: fc.date().map((d) => d.toISOString()),
        }),
        ({ jobId, documentUrl, ocrText, processedAt }) => {
          const results: ProcessingResults = {
            jobId,
            documentUrl,
            ocrText,
            entities: [],
            medications: [],
            conditions: [],
            labResults: [],
            fhirResource: {},
            processedAt,
          };

          mockUseProcessingResults.mockReturnValue({
            data: results,
            isLoading: false,
            error: null,
            isError: false,
          } as any);

          // Should not throw when rendering with empty arrays
          const { unmount } = render(<ResultsDisplay jobId={jobId} />);

          try {
            // Should still display core components
            expect(screen.getAllByAltText('Original document')[0]).toBeInTheDocument();
            expect(screen.getAllByText('Overview')[0]).toBeInTheDocument();
            expect(screen.getAllByText('New Scan')[0]).toBeInTheDocument();
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
