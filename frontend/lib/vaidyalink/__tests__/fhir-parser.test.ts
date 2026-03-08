/**
 * Unit tests for FHIR Resource Parser and Pretty Printer
 */

import {
  parseFHIRResource,
  printFHIRResource,
  FHIRParseError,
  FHIRPatient,
  FHIRObservation,
  FHIRMedicationRequest,
  FHIRDiagnosticReport,
} from '../fhir-parser';

describe('parseFHIRResource', () => {
  describe('Patient resources', () => {
    it('should parse valid Patient resource from JSON string', () => {
      const json = JSON.stringify({
        resourceType: 'Patient',
        id: 'patient-001',
        name: [{ family: 'Kumar', given: ['Rajesh'] }],
        gender: 'male',
        birthDate: '1979-03-15',
      });

      const result = parseFHIRResource(json);

      expect(result.resourceType).toBe('Patient');
      expect(result.id).toBe('patient-001');
      expect((result as FHIRPatient).name).toHaveLength(1);
      expect((result as FHIRPatient).gender).toBe('male');
    });

    it('should parse valid Patient resource from object', () => {
      const patient: FHIRPatient = {
        resourceType: 'Patient',
        id: 'patient-002',
        name: [{ text: 'Priya Sharma' }],
      };

      const result = parseFHIRResource(patient);

      expect(result.resourceType).toBe('Patient');
      expect(result.id).toBe('patient-002');
    });

    it('should throw error for Patient without name', () => {
      const patient = {
        resourceType: 'Patient',
        id: 'patient-003',
      };

      expect(() => parseFHIRResource(patient)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(patient)).toThrow(/name/);
    });

    it('should throw error for Patient with invalid gender', () => {
      const patient = {
        resourceType: 'Patient',
        id: 'patient-004',
        name: [{ text: 'Test Patient' }],
        gender: 'invalid',
      };

      expect(() => parseFHIRResource(patient)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(patient)).toThrow(/gender/);
    });
  });

  describe('Observation resources', () => {
    it('should parse valid Observation resource', () => {
      const observation: FHIRObservation = {
        resourceType: 'Observation',
        id: 'obs-001',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '15074-8', display: 'Glucose' }],
        },
        subject: { reference: 'Patient/patient-001' },
        valueQuantity: { value: 95, unit: 'mg/dL' },
      };

      const result = parseFHIRResource(observation);

      expect(result.resourceType).toBe('Observation');
      expect((result as FHIRObservation).status).toBe('final');
      expect((result as FHIRObservation).valueQuantity?.value).toBe(95);
    });

    it('should throw error for Observation without status', () => {
      const observation = {
        resourceType: 'Observation',
        id: 'obs-002',
        code: { text: 'Blood Pressure' },
        subject: { reference: 'Patient/patient-001' },
      };

      expect(() => parseFHIRResource(observation)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(observation)).toThrow(/status/);
    });

    it('should throw error for Observation without code', () => {
      const observation = {
        resourceType: 'Observation',
        id: 'obs-003',
        status: 'final',
        subject: { reference: 'Patient/patient-001' },
      };

      expect(() => parseFHIRResource(observation)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(observation)).toThrow(/code/);
    });

    it('should throw error for Observation without subject', () => {
      const observation = {
        resourceType: 'Observation',
        id: 'obs-004',
        status: 'final',
        code: { text: 'Temperature' },
      };

      expect(() => parseFHIRResource(observation)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(observation)).toThrow(/subject/);
    });
  });

  describe('MedicationRequest resources', () => {
    it('should parse valid MedicationRequest resource', () => {
      const medRequest: FHIRMedicationRequest = {
        resourceType: 'MedicationRequest',
        id: 'med-001',
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: '860975',
              display: 'Metformin',
            },
          ],
        },
        subject: { reference: 'Patient/patient-001' },
      };

      const result = parseFHIRResource(medRequest);

      expect(result.resourceType).toBe('MedicationRequest');
      expect((result as FHIRMedicationRequest).status).toBe('active');
      expect((result as FHIRMedicationRequest).intent).toBe('order');
    });

    it('should throw error for MedicationRequest without status', () => {
      const medRequest = {
        resourceType: 'MedicationRequest',
        id: 'med-002',
        intent: 'order',
        medicationCodeableConcept: { text: 'Aspirin' },
        subject: { reference: 'Patient/patient-001' },
      };

      expect(() => parseFHIRResource(medRequest)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(medRequest)).toThrow(/status/);
    });

    it('should throw error for MedicationRequest without intent', () => {
      const medRequest = {
        resourceType: 'MedicationRequest',
        id: 'med-003',
        status: 'active',
        medicationCodeableConcept: { text: 'Aspirin' },
        subject: { reference: 'Patient/patient-001' },
      };

      expect(() => parseFHIRResource(medRequest)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(medRequest)).toThrow(/intent/);
    });

    it('should throw error for MedicationRequest without medication', () => {
      const medRequest = {
        resourceType: 'MedicationRequest',
        id: 'med-004',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/patient-001' },
      };

      expect(() => parseFHIRResource(medRequest)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(medRequest)).toThrow(/medication/);
    });

    it('should throw error for MedicationRequest without subject', () => {
      const medRequest = {
        resourceType: 'MedicationRequest',
        id: 'med-005',
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: { text: 'Aspirin' },
      };

      expect(() => parseFHIRResource(medRequest)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(medRequest)).toThrow(/subject/);
    });
  });

  describe('DiagnosticReport resources', () => {
    it('should parse valid DiagnosticReport resource', () => {
      const report: FHIRDiagnosticReport = {
        resourceType: 'DiagnosticReport',
        id: 'report-001',
        status: 'final',
        code: {
          coding: [
            { system: 'http://loinc.org', code: '58410-2', display: 'Complete blood count' },
          ],
        },
        subject: { reference: 'Patient/patient-001' },
      };

      const result = parseFHIRResource(report);

      expect(result.resourceType).toBe('DiagnosticReport');
      expect((result as FHIRDiagnosticReport).status).toBe('final');
    });

    it('should throw error for DiagnosticReport without status', () => {
      const report = {
        resourceType: 'DiagnosticReport',
        id: 'report-002',
        code: { text: 'Lab Report' },
        subject: { reference: 'Patient/patient-001' },
      };

      expect(() => parseFHIRResource(report)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(report)).toThrow(/status/);
    });

    it('should throw error for DiagnosticReport without code', () => {
      const report = {
        resourceType: 'DiagnosticReport',
        id: 'report-003',
        status: 'final',
        subject: { reference: 'Patient/patient-001' },
      };

      expect(() => parseFHIRResource(report)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(report)).toThrow(/code/);
    });

    it('should throw error for DiagnosticReport without subject', () => {
      const report = {
        resourceType: 'DiagnosticReport',
        id: 'report-004',
        status: 'final',
        code: { text: 'Lab Report' },
      };

      expect(() => parseFHIRResource(report)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(report)).toThrow(/subject/);
    });
  });

  describe('General validation', () => {
    it('should throw error for invalid JSON string', () => {
      expect(() => parseFHIRResource('invalid json')).toThrow(FHIRParseError);
      expect(() => parseFHIRResource('invalid json')).toThrow(/Invalid JSON/);
    });

    it('should throw error for non-object input', () => {
      expect(() => parseFHIRResource('null')).toThrow(FHIRParseError);
      expect(() => parseFHIRResource('null')).toThrow(/must be an object/);
    });

    it('should throw error for missing resourceType', () => {
      const resource = {
        id: 'test-001',
      };

      expect(() => parseFHIRResource(resource)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(resource)).toThrow(/resourceType/);
    });

    it('should throw error for missing id', () => {
      const resource = {
        resourceType: 'Patient',
      };

      expect(() => parseFHIRResource(resource)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(resource)).toThrow(/id/);
    });

    it('should throw error for unsupported resourceType', () => {
      const resource = {
        resourceType: 'Procedure',
        id: 'proc-001',
      };

      expect(() => parseFHIRResource(resource)).toThrow(FHIRParseError);
      expect(() => parseFHIRResource(resource)).toThrow(/Unsupported resourceType/);
    });
  });
});

describe('printFHIRResource', () => {
  it('should format Patient resource as JSON', () => {
    const patient: FHIRPatient = {
      resourceType: 'Patient',
      id: 'patient-001',
      name: [{ family: 'Kumar', given: ['Rajesh'] }],
      gender: 'male',
    };

    const result = printFHIRResource(patient);

    expect(result).toContain('"resourceType": "Patient"');
    expect(result).toContain('"id": "patient-001"');
    expect(JSON.parse(result)).toEqual(
      expect.objectContaining({
        resourceType: 'Patient',
        id: 'patient-001',
      })
    );
  });

  it('should format Observation resource as JSON', () => {
    const observation: FHIRObservation = {
      resourceType: 'Observation',
      id: 'obs-001',
      status: 'final',
      code: { text: 'Glucose' },
      subject: { reference: 'Patient/patient-001' },
    };

    const result = printFHIRResource(observation);

    expect(result).toContain('"resourceType": "Observation"');
    expect(JSON.parse(result)).toEqual(
      expect.objectContaining({
        resourceType: 'Observation',
        status: 'final',
      })
    );
  });

  it('should use 2-space indentation', () => {
    const patient: FHIRPatient = {
      resourceType: 'Patient',
      id: 'patient-001',
      name: [{ text: 'Test' }],
    };

    const result = printFHIRResource(patient);

    expect(result).toContain('  "resourceType"');
    expect(result).toContain('  "id"');
  });

  it('should place resourceType and id first', () => {
    const patient: FHIRPatient = {
      resourceType: 'Patient',
      id: 'patient-001',
      name: [{ text: 'Test' }],
      gender: 'male',
    };

    const result = printFHIRResource(patient);
    const lines = result.split('\n');

    expect(lines[1]).toContain('"resourceType"');
    expect(lines[2]).toContain('"id"');
  });

  it('should sort remaining keys alphabetically', () => {
    const patient: FHIRPatient = {
      resourceType: 'Patient',
      id: 'patient-001',
      name: [{ text: 'Test' }],
      gender: 'male',
      birthDate: '1990-01-01',
    };

    const result = printFHIRResource(patient);
    const parsed = JSON.parse(result);
    const keys = Object.keys(parsed);

    expect(keys[0]).toBe('resourceType');
    expect(keys[1]).toBe('id');
    expect(keys[2]).toBe('birthDate'); // 'b' comes before 'g' and 'n'
  });

  it('should throw error for invalid resource', () => {
    expect(() => printFHIRResource(null as any)).toThrow(FHIRParseError);
  });

  it('should throw error for resource without resourceType', () => {
    const resource = {
      id: 'test-001',
    } as any;

    expect(() => printFHIRResource(resource)).toThrow(FHIRParseError);
    expect(() => printFHIRResource(resource)).toThrow(/resourceType/);
  });

  it('should throw error for resource without id', () => {
    const resource = {
      resourceType: 'Patient',
    } as any;

    expect(() => printFHIRResource(resource)).toThrow(FHIRParseError);
    expect(() => printFHIRResource(resource)).toThrow(/id/);
  });
});

describe('Round-trip parsing', () => {
  it('should preserve Patient resource through parse-print-parse cycle', () => {
    const original: FHIRPatient = {
      resourceType: 'Patient',
      id: 'patient-001',
      name: [{ family: 'Kumar', given: ['Rajesh'] }],
      gender: 'male',
      birthDate: '1979-03-15',
    };

    const printed = printFHIRResource(original);
    const reparsed = parseFHIRResource(printed) as FHIRPatient;

    expect(reparsed.resourceType).toBe(original.resourceType);
    expect(reparsed.id).toBe(original.id);
    expect(reparsed.gender).toBe(original.gender);
    expect(reparsed.birthDate).toBe(original.birthDate);
  });

  it('should preserve Observation resource through parse-print-parse cycle', () => {
    const original: FHIRObservation = {
      resourceType: 'Observation',
      id: 'obs-001',
      status: 'final',
      code: { text: 'Glucose' },
      subject: { reference: 'Patient/patient-001' },
      valueQuantity: { value: 95, unit: 'mg/dL' },
    };

    const printed = printFHIRResource(original);
    const reparsed = parseFHIRResource(printed) as FHIRObservation;

    expect(reparsed.resourceType).toBe(original.resourceType);
    expect(reparsed.status).toBe(original.status);
    expect(reparsed.valueQuantity?.value).toBe(original.valueQuantity?.value);
  });

  it('should preserve MedicationRequest resource through parse-print-parse cycle', () => {
    const original: FHIRMedicationRequest = {
      resourceType: 'MedicationRequest',
      id: 'med-001',
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: { text: 'Metformin 500mg' },
      subject: { reference: 'Patient/patient-001' },
    };

    const printed = printFHIRResource(original);
    const reparsed = parseFHIRResource(printed) as FHIRMedicationRequest;

    expect(reparsed.resourceType).toBe(original.resourceType);
    expect(reparsed.status).toBe(original.status);
    expect(reparsed.intent).toBe(original.intent);
  });

  it('should preserve DiagnosticReport resource through parse-print-parse cycle', () => {
    const original: FHIRDiagnosticReport = {
      resourceType: 'DiagnosticReport',
      id: 'report-001',
      status: 'final',
      code: { text: 'Complete blood count' },
      subject: { reference: 'Patient/patient-001' },
    };

    const printed = printFHIRResource(original);
    const reparsed = parseFHIRResource(printed) as FHIRDiagnosticReport;

    expect(reparsed.resourceType).toBe(original.resourceType);
    expect(reparsed.status).toBe(original.status);
  });
});
