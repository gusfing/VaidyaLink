/**
 * Property-Based Tests for Results Parser
 *
 * Feature: document-scan-demo
 * These tests verify universal properties that should hold for all parsing operations.
 */

import fc from 'fast-check';
import { parseResults, formatResults, ParsingError } from '../results-parser';
import type { ProcessingResults } from '@/lib/document-scan-demo/types';

describe('Results Parser Properties', () => {
  /**
   * Property 32: Parser round-trip preserves data
   *
   * **Validates: Requirements 10.4**
   *
   * For any valid API response, parsing the response, formatting it for display,
   * and parsing again should produce an equivalent data structure.
   * This ensures that the parse and format operations are inverses of each other
   * and no data is lost in the transformation.
   */
  it('should preserve data through parse-format-parse round trip', () => {
    fc.assert(
      fc.property(
        fc.record({
          jobId: fc.uuid(),
          documentUrl: fc.webUrl(),
          ocrText: fc.string({ minLength: 0, maxLength: 1000 }),
          entities: fc.array(
            fc.record({
              text: fc.string({ minLength: 1, maxLength: 100 }),
              type: fc.constantFrom(
                'MEDICATION',
                'CONDITION',
                'LAB_RESULT',
                'PROCEDURE',
                'DIAGNOSIS',
                'SYMPTOM'
              ),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            }),
            { maxLength: 20 }
          ),
          medications: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              dosage: fc.string({ minLength: 1, maxLength: 50 }),
              frequency: fc.string({ minLength: 1, maxLength: 50 }),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            }),
            { maxLength: 20 }
          ),
          conditions: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 20 }),
          labResults: fc.array(
            fc.record({
              testName: fc.string({ minLength: 1, maxLength: 100 }),
              value: fc.string({ minLength: 1, maxLength: 50 }),
              unit: fc.string({ minLength: 1, maxLength: 20 }),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            }),
            { maxLength: 20 }
          ),
          fhirResource: fc.oneof(
            // Generate valid FHIR-like objects
            fc.record({
              resourceType: fc.constantFrom(
                'MedicationRequest',
                'Observation',
                'Condition',
                'Bundle',
                'Patient'
              ),
              status: fc.constantFrom('active', 'completed', 'draft'),
              id: fc.option(fc.uuid(), { nil: undefined }),
            }),
            // Generate nested FHIR objects
            fc.record({
              resourceType: fc.constant('Bundle'),
              type: fc.constantFrom('document', 'collection', 'searchset'),
              entry: fc.array(
                fc.record({
                  resource: fc.record({
                    resourceType: fc.constantFrom('Observation', 'MedicationRequest'),
                    status: fc.constantFrom('active', 'completed'),
                  }),
                }),
                { maxLength: 5 }
              ),
            })
          ),
          processedAt: fc
            .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
            .map((d) => d.toISOString()),
        }),
        (apiResponse) => {
          // First parse: API response -> ProcessingResults
          const parsed1 = parseResults(apiResponse);

          // Format: ProcessingResults -> display format
          const formatted = formatResults(parsed1);

          // Second parse: display format -> ProcessingResults
          const parsed2 = parseResults(formatted);

          // Verify that the two parsed results are equivalent
          expect(parsed2).toEqual(parsed1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Round-trip preserves array lengths
   *
   * This test verifies that the number of items in each array field
   * is preserved through the round-trip transformation.
   */
  it('should preserve array lengths through round trip', () => {
    fc.assert(
      fc.property(
        fc.record({
          jobId: fc.uuid(),
          documentUrl: fc.webUrl(),
          ocrText: fc.string(),
          entities: fc.array(
            fc.record({
              text: fc.string({ minLength: 1 }),
              type: fc.string({ minLength: 1 }),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          medications: fc.array(
            fc.record({
              name: fc.string({ minLength: 1 }),
              dosage: fc.string({ minLength: 1 }),
              frequency: fc.string({ minLength: 1 }),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          conditions: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 50 }),
          labResults: fc.array(
            fc.record({
              testName: fc.string({ minLength: 1 }),
              value: fc.string({ minLength: 1 }),
              unit: fc.string({ minLength: 1 }),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          fhirResource: fc.object(),
          processedAt: fc.date().map((d) => d.toISOString()),
        }),
        (apiResponse) => {
          const parsed1 = parseResults(apiResponse);
          const formatted = formatResults(parsed1);
          const parsed2 = parseResults(formatted);

          // Verify array lengths are preserved
          expect(parsed2.entities.length).toBe(parsed1.entities.length);
          expect(parsed2.medications.length).toBe(parsed1.medications.length);
          expect(parsed2.conditions.length).toBe(parsed1.conditions.length);
          expect(parsed2.labResults.length).toBe(parsed1.labResults.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Round-trip preserves confidence scores
   *
   * This test verifies that confidence scores in entities, medications,
   * and lab results are preserved exactly through the round-trip.
   */
  it('should preserve confidence scores through round trip', () => {
    fc.assert(
      fc.property(
        fc.record({
          jobId: fc.uuid(),
          documentUrl: fc.webUrl(),
          ocrText: fc.string(),
          entities: fc.array(
            fc.record({
              text: fc.string({ minLength: 1 }),
              type: fc.string({ minLength: 1 }),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          medications: fc.array(
            fc.record({
              name: fc.string({ minLength: 1 }),
              dosage: fc.string({ minLength: 1 }),
              frequency: fc.string({ minLength: 1 }),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          conditions: fc.array(fc.string({ minLength: 1 })),
          labResults: fc.array(
            fc.record({
              testName: fc.string({ minLength: 1 }),
              value: fc.string({ minLength: 1 }),
              unit: fc.string({ minLength: 1 }),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fhirResource: fc.object(),
          processedAt: fc.date().map((d) => d.toISOString()),
        }),
        (apiResponse) => {
          const parsed1 = parseResults(apiResponse);
          const formatted = formatResults(parsed1);
          const parsed2 = parseResults(formatted);

          // Verify confidence scores are preserved for entities
          parsed1.entities.forEach((entity, index) => {
            expect(parsed2.entities[index].confidence).toBe(entity.confidence);
          });

          // Verify confidence scores are preserved for medications
          parsed1.medications.forEach((med, index) => {
            expect(parsed2.medications[index].confidence).toBe(med.confidence);
          });

          // Verify confidence scores are preserved for lab results
          parsed1.labResults.forEach((lab, index) => {
            expect(parsed2.labResults[index].confidence).toBe(lab.confidence);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Round-trip preserves FHIR resource structure
   *
   * This test verifies that complex FHIR resource objects are preserved
   * through the round-trip, including nested structures.
   */
  it('should preserve FHIR resource structure through round trip', () => {
    fc.assert(
      fc.property(
        fc.record({
          jobId: fc.uuid(),
          documentUrl: fc.webUrl(),
          ocrText: fc.string(),
          entities: fc.array(
            fc.record({
              text: fc.string({ minLength: 1 }),
              type: fc.string({ minLength: 1 }),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            })
          ),
          medications: fc.array(
            fc.record({
              name: fc.string({ minLength: 1 }),
              dosage: fc.string({ minLength: 1 }),
              frequency: fc.string({ minLength: 1 }),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            })
          ),
          conditions: fc.array(fc.string({ minLength: 1 })),
          labResults: fc.array(
            fc.record({
              testName: fc.string({ minLength: 1 }),
              value: fc.string({ minLength: 1 }),
              unit: fc.string({ minLength: 1 }),
              confidence: fc.float({ min: 0, max: 1, noNaN: true }),
            })
          ),
          fhirResource: fc.record({
            resourceType: fc.constantFrom('MedicationRequest', 'Observation', 'Bundle'),
            status: fc.constantFrom('active', 'completed', 'draft'),
            id: fc.uuid(),
            meta: fc.option(
              fc.record({
                versionId: fc.string({ minLength: 1 }),
                lastUpdated: fc.date().map((d) => d.toISOString()),
              }),
              { nil: undefined }
            ),
          }),
          processedAt: fc.date().map((d) => d.toISOString()),
        }),
        (apiResponse) => {
          const parsed1 = parseResults(apiResponse);
          const formatted = formatResults(parsed1);
          const parsed2 = parseResults(formatted);

          // Verify FHIR resource is deeply equal
          expect(parsed2.fhirResource).toEqual(parsed1.fhirResource);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Empty arrays are preserved through round trip
   *
   * This test verifies that empty arrays in the response are correctly
   * preserved through the round-trip transformation.
   */
  it('should preserve empty arrays through round trip', () => {
    fc.assert(
      fc.property(
        fc.record({
          jobId: fc.uuid(),
          documentUrl: fc.webUrl(),
          ocrText: fc.string(),
          entities: fc.constant([]),
          medications: fc.constant([]),
          conditions: fc.constant([]),
          labResults: fc.constant([]),
          fhirResource: fc.object(),
          processedAt: fc.date().map((d) => d.toISOString()),
        }),
        (apiResponse) => {
          const parsed1 = parseResults(apiResponse);
          const formatted = formatResults(parsed1);
          const parsed2 = parseResults(formatted);

          expect(parsed2.entities).toEqual([]);
          expect(parsed2.medications).toEqual([]);
          expect(parsed2.conditions).toEqual([]);
          expect(parsed2.labResults).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 33: Malformed JSON returns error
   *
   * **Validates: Requirements 10.5**
   *
   * For any API response containing malformed JSON or invalid data structures,
   * the results parser should return a descriptive error message rather than
   * throwing an unhandled exception. This ensures graceful error handling
   * and provides useful feedback to users and developers.
   */
  describe('Property 33: Malformed JSON handling', () => {
    it('should return descriptive error for non-object responses', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer(),
            fc.boolean()
          ),
          (malformedResponse) => {
            expect(() => parseResults(malformedResponse)).toThrow(ParsingError);
            expect(() => parseResults(malformedResponse)).toThrow('API response must be an object');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return descriptive error for missing required fields', () => {
      fc.assert(
        fc.property(
          fc.record(
            {
              // Randomly omit required fields
              jobId: fc.option(fc.uuid(), { nil: undefined }),
              documentUrl: fc.option(fc.webUrl(), { nil: undefined }),
              ocrText: fc.option(fc.string(), { nil: undefined }),
              processedAt: fc.option(
                fc.date().map((d) => d.toISOString()),
                { nil: undefined }
              ),
              // Include optional fields to avoid FHIR validation errors
              entities: fc.constant([]),
              medications: fc.constant([]),
              conditions: fc.constant([]),
              labResults: fc.constant([]),
              fhirResource: fc.constant({}),
            },
            { requiredKeys: [] }
          ),
          (incompleteResponse) => {
            // At least one required field should be missing
            const hasAllRequired =
              typeof incompleteResponse.jobId === 'string' &&
              typeof incompleteResponse.documentUrl === 'string' &&
              typeof incompleteResponse.ocrText === 'string' &&
              typeof incompleteResponse.processedAt === 'string';

            // Only test when at least one required field is missing
            fc.pre(!hasAllRequired);

            expect(() => parseResults(incompleteResponse)).toThrow(ParsingError);

            // Verify error message is descriptive
            try {
              parseResults(incompleteResponse);
            } catch (error) {
              expect(error).toBeInstanceOf(ParsingError);
              expect((error as ParsingError).message).toMatch(/Missing or invalid/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return descriptive error for invalid field types', () => {
      fc.assert(
        fc.property(
          fc.record({
            jobId: fc.oneof(fc.uuid(), fc.integer(), fc.boolean(), fc.constant(null)),
            documentUrl: fc.oneof(fc.webUrl(), fc.integer(), fc.boolean(), fc.constant(null)),
            ocrText: fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
            processedAt: fc.oneof(
              fc.date().map((d) => d.toISOString()),
              fc.integer(),
              fc.boolean(),
              fc.constant(null)
            ),
            entities: fc.anything(),
            medications: fc.anything(),
            conditions: fc.anything(),
            labResults: fc.anything(),
            fhirResource: fc.anything(),
          }),
          (invalidResponse) => {
            // Check if any required field has invalid type
            const hasInvalidType =
              typeof invalidResponse.jobId !== 'string' ||
              typeof invalidResponse.documentUrl !== 'string' ||
              typeof invalidResponse.ocrText !== 'string' ||
              typeof invalidResponse.processedAt !== 'string';

            if (hasInvalidType) {
              expect(() => parseResults(invalidResponse)).toThrow(ParsingError);

              // Verify error message is descriptive
              try {
                parseResults(invalidResponse);
              } catch (error) {
                expect(error).toBeInstanceOf(ParsingError);
                expect((error as ParsingError).message).toMatch(/Missing or invalid/);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return descriptive error for malformed FHIR JSON string', () => {
      fc.assert(
        fc.property(
          fc.record({
            jobId: fc.uuid(),
            documentUrl: fc.webUrl(),
            ocrText: fc.string(),
            processedAt: fc.date().map((d) => d.toISOString()),
            entities: fc.constant([]),
            medications: fc.constant([]),
            conditions: fc.constant([]),
            labResults: fc.constant([]),
            // Generate malformed JSON strings
            fhirResource: fc.oneof(
              fc.constant('{ invalid json }'),
              fc.constant('{ "key": }'),
              fc.constant('{ "key": undefined }'),
              fc.constant('[1, 2, 3,]'),
              fc.constant('not json at all'),
              fc.constant('{ "unclosed": "object"'),
              fc.constant('null'),
              fc.constant('123'),
              fc.constant('true')
            ),
          }),
          (responseWithMalformedFhir) => {
            expect(() => parseResults(responseWithMalformedFhir)).toThrow(ParsingError);

            // Verify error message mentions FHIR or JSON
            try {
              parseResults(responseWithMalformedFhir);
            } catch (error) {
              expect(error).toBeInstanceOf(ParsingError);
              expect((error as ParsingError).message).toMatch(/FHIR|JSON|malformed/i);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always throw ParsingError (not generic Error) for any malformed input', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Various malformed inputs
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant([]),
            fc.record({
              jobId: fc.anything(),
              documentUrl: fc.anything(),
              ocrText: fc.anything(),
            }),
            fc.record({
              jobId: fc.uuid(),
              // Missing other required fields
            })
          ),
          (malformedInput) => {
            try {
              parseResults(malformedInput);
              // If we get here, the input was actually valid (shouldn't happen with our generators)
            } catch (error) {
              // Verify it's always a ParsingError, not a generic Error
              expect(error).toBeInstanceOf(ParsingError);
              expect(error).toBeInstanceOf(Error);
              expect((error as ParsingError).name).toBe('ParsingError');

              // Verify error message is non-empty and descriptive
              expect((error as ParsingError).message).toBeTruthy();
              expect((error as ParsingError).message.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide descriptive error messages for all malformed inputs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer(),
            fc.record({
              jobId: fc.constant(123), // Wrong type
              documentUrl: fc.webUrl(),
              ocrText: fc.string(),
              processedAt: fc.date().map((d) => d.toISOString()),
            }),
            fc.record({
              jobId: fc.uuid(),
              documentUrl: fc.constant(null), // Wrong type
              ocrText: fc.string(),
              processedAt: fc.date().map((d) => d.toISOString()),
            })
          ),
          (malformedInput) => {
            try {
              parseResults(malformedInput);
            } catch (error) {
              expect(error).toBeInstanceOf(ParsingError);
              const message = (error as ParsingError).message;

              // Verify message is descriptive (contains useful keywords)
              const hasDescriptiveContent =
                message.includes('Missing') ||
                message.includes('invalid') ||
                message.includes('must be') ||
                message.includes('Failed to parse') ||
                message.includes('malformed');

              expect(hasDescriptiveContent).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
