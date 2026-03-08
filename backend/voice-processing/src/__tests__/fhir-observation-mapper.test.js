/**
 * FHIR Observation Mapper Tests
 *
 * Tests for the FHIR payload builder that maps voice-extracted clinical entities
 * to FHIR resource payloads for the FHIR Transformer Lambda.
 */

const { hasMappableEntities, buildFHIRPayload } = require('../utils/fhir-observation-mapper');

describe('FHIR Observation Mapper', () => {
  describe('hasMappableEntities', () => {
    it('should return true for entities with symptoms', () => {
      const entities = {
        symptoms: [{ name: 'fever', severity: 'moderate' }],
      };

      expect(hasMappableEntities(entities)).toBe(true);
    });

    it('should return true for entities with medications', () => {
      const entities = {
        currentMedications: [{ name: 'Paracetamol', dosage: '500mg' }],
      };

      expect(hasMappableEntities(entities)).toBe(true);
    });

    it('should return true for entities with vital signs', () => {
      const entities = {
        vitalSigns: {
          temperature: '38.5°C',
          heartRate: '90 bpm',
        },
      };

      expect(hasMappableEntities(entities)).toBe(true);
    });

    it('should return true for entities with allergies', () => {
      const entities = {
        allergies: [{ allergen: 'Penicillin', reaction: 'rash' }],
      };

      expect(hasMappableEntities(entities)).toBe(true);
    });

    it('should return true for entities with medical history', () => {
      const entities = {
        medicalHistory: [{ condition: 'Diabetes', diagnosedDate: '2020-01-15' }],
      };

      expect(hasMappableEntities(entities)).toBe(true);
    });

    it('should return true for entities with chief complaint', () => {
      const entities = {
        chiefComplaint: 'Severe headache for 3 days',
      };

      expect(hasMappableEntities(entities)).toBe(true);
    });

    it('should return false for empty entities', () => {
      expect(hasMappableEntities({})).toBe(false);
      expect(hasMappableEntities(null)).toBe(false);
      expect(hasMappableEntities(undefined)).toBe(false);
    });

    it('should return false for entities with empty arrays', () => {
      const entities = {
        symptoms: [],
        currentMedications: [],
        allergies: [],
      };

      expect(hasMappableEntities(entities)).toBe(false);
    });

    it('should return false for entities with empty chief complaint', () => {
      const entities = {
        chiefComplaint: '   ',
      };

      expect(hasMappableEntities(entities)).toBe(false);
    });
  });

  describe('buildFHIRPayload', () => {
    const baseOptions = {
      patientId: 'patient-123',
      jobId: 'voice-job-456',
      entities: {},
      confidence: { overall: 0.85, byEntity: {} },
    };

    describe('Input validation', () => {
      it('should throw error when patientId is missing', () => {
        const options = { ...baseOptions, patientId: undefined };

        expect(() => buildFHIRPayload(options)).toThrow('patientId is required');
      });

      it('should throw error when jobId is missing', () => {
        const options = { ...baseOptions, jobId: undefined };

        expect(() => buildFHIRPayload(options)).toThrow('jobId is required');
      });

      it('should throw error when entities are missing', () => {
        const options = { ...baseOptions, entities: undefined };

        expect(() => buildFHIRPayload(options)).toThrow('entities are required');
      });
    });

    describe('Symptom mapping', () => {
      it('should map symptoms to FHIR Observations', () => {
        const options = {
          ...baseOptions,
          entities: {
            symptoms: [
              {
                name: 'fever',
                severity: 'high',
                duration: '3 days',
                onset: '2024-01-12',
                location: 'whole body',
              },
              {
                name: 'headache',
                severity: 'moderate',
                duration: '2 days',
              },
            ],
          },
          confidence: {
            overall: 0.88,
            byEntity: { symptoms: 0.9 },
          },
        };

        const payload = buildFHIRPayload(options);

        expect(payload.resources).toHaveLength(2);
        expect(payload.resources[0]).toMatchObject({
          resourceType: 'Observation',
          category: 'symptom',
          data: {
            symptomName: 'fever',
            severity: 'high',
            duration: '3 days',
            onset: '2024-01-12',
            bodyLocation: 'whole body',
          },
          confidence: 0.9,
        });

        expect(payload.resources[1]).toMatchObject({
          resourceType: 'Observation',
          category: 'symptom',
          data: {
            symptomName: 'headache',
            severity: 'moderate',
            duration: '2 days',
          },
        });
      });
    });

    describe('Vital signs mapping', () => {
      it('should map vital signs to FHIR Observations with LOINC codes', () => {
        const options = {
          ...baseOptions,
          entities: {
            vitalSigns: {
              temperature: '38.5°C',
              heartRate: '90 bpm',
              bloodPressure: '120/80 mmHg',
              oxygenSaturation: '98%',
            },
          },
          confidence: {
            overall: 0.92,
            byEntity: { vitalSigns: 0.95 },
          },
        };

        const payload = buildFHIRPayload(options);

        expect(payload.resources).toHaveLength(4);

        const tempObservation = payload.resources.find((r) => r.data.vitalType === 'temperature');
        expect(tempObservation).toMatchObject({
          resourceType: 'Observation',
          category: 'vital-signs',
          data: {
            vitalType: 'temperature',
            value: '38.5°C',
            loincCode: '8310-5',
            display: 'Body temperature',
          },
          confidence: 0.95,
        });

        const bpObservation = payload.resources.find((r) => r.data.vitalType === 'bloodPressure');
        expect(bpObservation.data.loincCode).toBe('85354-9');
      });

      it('should skip null or undefined vital signs', () => {
        const options = {
          ...baseOptions,
          entities: {
            vitalSigns: {
              temperature: '38.5°C',
              heartRate: null,
              bloodPressure: undefined,
            },
          },
        };

        const payload = buildFHIRPayload(options);

        expect(payload.resources).toHaveLength(1);
        expect(payload.resources[0].data.vitalType).toBe('temperature');
      });
    });

    describe('Medication mapping', () => {
      it('should map medications to FHIR MedicationStatements', () => {
        const options = {
          ...baseOptions,
          entities: {
            currentMedications: [
              {
                name: 'Paracetamol',
                dosage: '500mg',
                frequency: 'twice daily',
                route: 'oral',
                duration: '5 days',
                startDate: '2024-01-15',
              },
              {
                name: 'Amoxicillin',
                dosage: '250mg',
                frequency: 'three times daily',
              },
            ],
          },
          confidence: {
            overall: 0.87,
            byEntity: { currentMedications: 0.89 },
          },
        };

        const payload = buildFHIRPayload(options);

        expect(payload.resources).toHaveLength(2);
        expect(payload.resources[0]).toMatchObject({
          resourceType: 'MedicationStatement',
          category: 'medication',
          data: {
            medicationName: 'Paracetamol',
            dosage: '500mg',
            frequency: 'twice daily',
            route: 'oral',
            duration: '5 days',
            startDate: '2024-01-15',
          },
          confidence: 0.89,
        });
      });
    });

    describe('Allergy mapping', () => {
      it('should map allergies to FHIR Observations', () => {
        const options = {
          ...baseOptions,
          entities: {
            allergies: [
              {
                allergen: 'Penicillin',
                reaction: 'rash',
                severity: 'moderate',
              },
              {
                name: 'Peanuts',
                reaction: 'anaphylaxis',
                severity: 'severe',
              },
            ],
          },
          confidence: {
            overall: 0.91,
            byEntity: { allergies: 0.93 },
          },
        };

        const payload = buildFHIRPayload(options);

        expect(payload.resources).toHaveLength(2);
        expect(payload.resources[0]).toMatchObject({
          resourceType: 'Observation',
          category: 'allergy',
          data: {
            allergen: 'Penicillin',
            reaction: 'rash',
            severity: 'moderate',
          },
          confidence: 0.93,
        });

        // Test fallback to 'name' field
        expect(payload.resources[1].data.allergen).toBe('Peanuts');
      });
    });

    describe('Chief complaint mapping', () => {
      it('should map chief complaint to FHIR Observation', () => {
        const options = {
          ...baseOptions,
          entities: {
            chiefComplaint: 'Severe chest pain radiating to left arm',
          },
          confidence: {
            overall: 0.94,
            byEntity: { chiefComplaint: 0.96 },
          },
        };

        const payload = buildFHIRPayload(options);

        expect(payload.resources).toHaveLength(1);
        expect(payload.resources[0]).toMatchObject({
          resourceType: 'Observation',
          category: 'chief-complaint',
          data: {
            complaint: 'Severe chest pain radiating to left arm',
          },
          confidence: 0.96,
        });
      });

      it('should skip empty chief complaint', () => {
        const options = {
          ...baseOptions,
          entities: {
            chiefComplaint: '   ',
          },
        };

        const payload = buildFHIRPayload(options);

        expect(payload.resources).toHaveLength(0);
      });
    });

    describe('Medical history mapping', () => {
      it('should map medical history to FHIR Observations', () => {
        const options = {
          ...baseOptions,
          entities: {
            medicalHistory: [
              {
                condition: 'Type 2 Diabetes',
                diagnosedDate: '2018-03-15',
                status: 'active',
              },
              {
                name: 'Hypertension',
                diagnosedDate: '2020-06-20',
              },
            ],
          },
          confidence: {
            overall: 0.86,
            byEntity: { medicalHistory: 0.88 },
          },
        };

        const payload = buildFHIRPayload(options);

        expect(payload.resources).toHaveLength(2);
        expect(payload.resources[0]).toMatchObject({
          resourceType: 'Observation',
          category: 'medical-history',
          data: {
            condition: 'Type 2 Diabetes',
            diagnosedDate: '2018-03-15',
            status: 'active',
          },
          confidence: 0.88,
        });

        // Test fallback to 'name' field
        expect(payload.resources[1].data.condition).toBe('Hypertension');
      });
    });

    describe('Payload structure', () => {
      it('should include correct metadata', () => {
        const options = {
          ...baseOptions,
          entities: {
            symptoms: [{ name: 'fever' }],
            _metadata: {
              language: 'hi',
              userConfirmed: true,
            },
          },
          confidence: {
            overall: 0.85,
            byEntity: { symptoms: 0.87 },
          },
        };

        const payload = buildFHIRPayload(options);

        expect(payload.source).toBe('voice-processing');
        expect(payload.sourceJobId).toBe('voice-job-456');
        expect(payload.patientId).toBe('patient-123');
        expect(payload.timestamp).toBeTruthy();
        expect(payload.metadata).toMatchObject({
          overallConfidence: 0.85,
          confidenceByEntity: { symptoms: 0.87 },
          extractionMethod: 'voice-transcription',
          language: 'hi',
          userConfirmed: true,
        });
      });

      it('should handle missing metadata gracefully', () => {
        const options = {
          ...baseOptions,
          entities: {
            symptoms: [{ name: 'fever' }],
          },
          confidence: { overall: 0.8 },
        };

        const payload = buildFHIRPayload(options);

        expect(payload.metadata).toMatchObject({
          overallConfidence: 0.8,
          confidenceByEntity: {},
          extractionMethod: 'voice-transcription',
          language: 'unknown',
          userConfirmed: false,
        });
      });
    });

    describe('Complex scenarios', () => {
      it('should handle multiple entity types in single payload', () => {
        const options = {
          ...baseOptions,
          entities: {
            chiefComplaint: 'Fever and cough',
            symptoms: [
              { name: 'fever', severity: 'high' },
              { name: 'cough', severity: 'moderate' },
            ],
            vitalSigns: {
              temperature: '39°C',
              heartRate: '95 bpm',
            },
            currentMedications: [{ name: 'Paracetamol', dosage: '500mg' }],
            allergies: [{ allergen: 'Aspirin', reaction: 'rash' }],
          },
          confidence: {
            overall: 0.88,
            byEntity: {
              chiefComplaint: 0.9,
              symptoms: 0.89,
              vitalSigns: 0.92,
              currentMedications: 0.87,
              allergies: 0.85,
            },
          },
        };

        const payload = buildFHIRPayload(options);

        // 1 chief complaint + 2 symptoms + 2 vitals + 1 medication + 1 allergy = 7 resources
        expect(payload.resources).toHaveLength(7);

        const resourceTypes = payload.resources.map((r) => r.resourceType);
        expect(resourceTypes).toContain('Observation');
        expect(resourceTypes).toContain('MedicationStatement');
      });

      it('should preserve source text when available', () => {
        const options = {
          ...baseOptions,
          entities: {
            symptoms: [
              {
                name: 'fever',
                severity: 'high',
                sourceText: 'Patient reports high fever since yesterday',
              },
            ],
          },
        };

        const payload = buildFHIRPayload(options);

        expect(payload.resources[0].sourceText).toBe('Patient reports high fever since yesterday');
      });
    });
  });
});
