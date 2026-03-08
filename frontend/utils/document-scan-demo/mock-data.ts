import type {
  PresignedUrlResponse,
  JobStatusResponse,
  ProcessingResults,
  ProcessingStage,
} from '@/lib/document-scan-demo/types';

/**
 * Mock data utility for demo mode
 * Provides realistic medical document processing responses
 */

// Sample prescription document results
export const MOCK_PRESCRIPTION_RESULTS: ProcessingResults = {
  jobId: 'demo-job-prescription-001',
  documentUrl: '/sample-prescription.jpg',
  ocrText: `
Adichunchanagiri University
Adichunchanagiri Institute of Medical Sciences
Hospital & Research Centre
Balagangadharanatha Nagara-571448

Date: 22/12/22

Name: Vivek M (Male)
UHID/IP No: 10197

Rx

c/o giddiness, weakness
Inj: hypoglycemic (FBS-120mg)
o/E-BP-110/70
PR-60bpm

Adv: 10 S/L Dextrose (IV) stat
→ Adequate fluid intake
→ ORS 2 sachets

Signature of Doctor (ID: 13144)
  `.trim(),
  entities: [
    { text: 'hypoglycemic', type: 'MEDICATION', confidence: 0.94 },
    { text: 'Dextrose', type: 'MEDICATION', confidence: 0.96 },
    { text: '10 S/L', type: 'DOSAGE', confidence: 0.92 },
    { text: 'ORS', type: 'MEDICATION', confidence: 0.95 },
    { text: '2 sachets', type: 'DOSAGE', confidence: 0.93 },
    { text: 'giddiness', type: 'SYMPTOM', confidence: 0.91 },
    { text: 'weakness', type: 'SYMPTOM', confidence: 0.9 },
    { text: 'Vivek M', type: 'PATIENT_NAME', confidence: 0.98 },
    { text: 'BP-110/70', type: 'VITAL_SIGN', confidence: 0.95 },
    { text: 'PR-60bpm', type: 'VITAL_SIGN', confidence: 0.94 },
    { text: 'FBS-120mg', type: 'LAB_VALUE', confidence: 0.93 },
  ],
  medications: [
    {
      name: 'Dextrose (IV)',
      dosage: '10 S/L',
      frequency: 'stat (immediately)',
      confidence: 0.96,
    },
    {
      name: 'ORS (Oral Rehydration Solution)',
      dosage: '2 sachets',
      frequency: 'As needed',
      confidence: 0.95,
    },
    {
      name: 'Hypoglycemic Injection',
      dosage: 'As prescribed',
      frequency: 'As needed',
      confidence: 0.94,
    },
  ],
  conditions: ['Giddiness', 'Weakness', 'Hypoglycemia (FBS-120mg)'],
  labResults: [
    {
      testName: 'Fasting Blood Sugar (FBS)',
      value: '120',
      unit: 'mg/dL',
      confidence: 0.93,
    },
    {
      testName: 'Blood Pressure',
      value: '110/70',
      unit: 'mmHg',
      confidence: 0.95,
    },
    {
      testName: 'Pulse Rate',
      value: '60',
      unit: 'bpm',
      confidence: 0.94,
    },
  ],
  fhirResource: {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      {
        resource: {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: {
            coding: [
              {
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: '4850',
                display: 'Dextrose',
              },
            ],
            text: 'Dextrose 10 S/L (IV)',
          },
          subject: {
            reference: 'Patient/demo-patient-001',
            display: 'Vivek M',
          },
          dosageInstruction: [
            {
              text: '10 S/L Dextrose IV stat (immediately)',
              timing: {
                code: {
                  coding: [
                    {
                      system: 'http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation',
                      code: 'STAT',
                      display: 'Immediately',
                    },
                  ],
                },
              },
              route: {
                coding: [
                  {
                    system: 'http://snomed.info/sct',
                    code: '47625008',
                    display: 'Intravenous route',
                  },
                ],
              },
            },
          ],
        },
      },
      {
        resource: {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: {
            coding: [
              {
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: '1234',
                display: 'Oral Rehydration Solution',
              },
            ],
            text: 'ORS 2 sachets',
          },
          subject: {
            reference: 'Patient/demo-patient-001',
            display: 'Vivek M',
          },
          dosageInstruction: [
            {
              text: 'Take 2 sachets of ORS as needed for hydration',
              asNeededBoolean: true,
              doseAndRate: [
                {
                  doseQuantity: {
                    value: 2,
                    unit: 'sachets',
                  },
                },
              ],
            },
          ],
        },
      },
      {
        resource: {
          resourceType: 'Observation',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '85354-9',
                display: 'Blood Pressure',
              },
            ],
            text: 'Blood Pressure',
          },
          subject: {
            reference: 'Patient/demo-patient-001',
            display: 'Vivek M',
          },
          valueString: '110/70 mmHg',
        },
      },
      {
        resource: {
          resourceType: 'Observation',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'laboratory',
                  display: 'Laboratory',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '1558-6',
                display: 'Fasting Blood Sugar',
              },
            ],
            text: 'FBS',
          },
          subject: {
            reference: 'Patient/demo-patient-001',
            display: 'Vivek M',
          },
          valueQuantity: {
            value: 120,
            unit: 'mg/dL',
            system: 'http://unitsofmeasure.org',
            code: 'mg/dL',
          },
        },
      },
    ],
  },
  processedAt: new Date().toISOString(),
};

// Sample lab report results
export const MOCK_LAB_RESULTS: ProcessingResults = {
  jobId: 'demo-job-lab-001',
  documentUrl: '/sample-documents/lab-report-sample.jpg',
  ocrText: `
LABORATORY REPORT

Patient: Jane Smith
DOB: 08/22/1985
Date Collected: January 10, 2024
Date Reported: January 11, 2024

COMPLETE BLOOD COUNT (CBC)

Test Name                Result      Reference Range    Unit
----------------------------------------------------------------
Hemoglobin              14.2        12.0-16.0          g/dL
Hematocrit              42.1        36.0-46.0          %
White Blood Cell Count   7.8         4.5-11.0          10^3/μL
Platelet Count          245         150-400            10^3/μL
Red Blood Cell Count    4.65        4.0-5.5            10^6/μL

METABOLIC PANEL

Glucose (Fasting)       92          70-100             mg/dL
Creatinine              0.9         0.6-1.2            mg/dL
Blood Urea Nitrogen     15          7-20               mg/dL
Sodium                  140         136-145            mmol/L
Potassium               4.2         3.5-5.0            mmol/L

All results within normal limits.

Reviewed by: Dr. Michael Chen, MD
Lab Director
  `.trim(),
  entities: [
    { text: 'Hemoglobin', type: 'LAB_TEST', confidence: 0.97 },
    { text: '14.2', type: 'LAB_VALUE', confidence: 0.96 },
    { text: 'White Blood Cell Count', type: 'LAB_TEST', confidence: 0.95 },
    { text: '7.8', type: 'LAB_VALUE', confidence: 0.94 },
    { text: 'Glucose', type: 'LAB_TEST', confidence: 0.96 },
    { text: '92', type: 'LAB_VALUE', confidence: 0.95 },
    { text: 'Jane Smith', type: 'PATIENT_NAME', confidence: 0.98 },
  ],
  medications: [],
  conditions: [],
  labResults: [
    {
      testName: 'Hemoglobin',
      value: '14.2',
      unit: 'g/dL',
      confidence: 0.97,
    },
    {
      testName: 'Hematocrit',
      value: '42.1',
      unit: '%',
      confidence: 0.96,
    },
    {
      testName: 'White Blood Cell Count',
      value: '7.8',
      unit: '10^3/μL',
      confidence: 0.95,
    },
    {
      testName: 'Platelet Count',
      value: '245',
      unit: '10^3/μL',
      confidence: 0.94,
    },
    {
      testName: 'Red Blood Cell Count',
      value: '4.65',
      unit: '10^6/μL',
      confidence: 0.93,
    },
    {
      testName: 'Glucose (Fasting)',
      value: '92',
      unit: 'mg/dL',
      confidence: 0.96,
    },
    {
      testName: 'Creatinine',
      value: '0.9',
      unit: 'mg/dL',
      confidence: 0.95,
    },
    {
      testName: 'Blood Urea Nitrogen',
      value: '15',
      unit: 'mg/dL',
      confidence: 0.94,
    },
    {
      testName: 'Sodium',
      value: '140',
      unit: 'mmol/L',
      confidence: 0.95,
    },
    {
      testName: 'Potassium',
      value: '4.2',
      unit: 'mmol/L',
      confidence: 0.94,
    },
  ],
  fhirResource: {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      {
        resource: {
          resourceType: 'Observation',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'laboratory',
                  display: 'Laboratory',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '718-7',
                display: 'Hemoglobin',
              },
            ],
            text: 'Hemoglobin',
          },
          subject: {
            reference: 'Patient/demo-patient-002',
            display: 'Jane Smith',
          },
          valueQuantity: {
            value: 14.2,
            unit: 'g/dL',
            system: 'http://unitsofmeasure.org',
            code: 'g/dL',
          },
          referenceRange: [
            {
              low: {
                value: 12.0,
                unit: 'g/dL',
              },
              high: {
                value: 16.0,
                unit: 'g/dL',
              },
            },
          ],
        },
      },
      {
        resource: {
          resourceType: 'Observation',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'laboratory',
                  display: 'Laboratory',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '1558-6',
                display: 'Glucose',
              },
            ],
            text: 'Glucose (Fasting)',
          },
          subject: {
            reference: 'Patient/demo-patient-002',
            display: 'Jane Smith',
          },
          valueQuantity: {
            value: 92,
            unit: 'mg/dL',
            system: 'http://unitsofmeasure.org',
            code: 'mg/dL',
          },
          referenceRange: [
            {
              low: {
                value: 70,
                unit: 'mg/dL',
              },
              high: {
                value: 100,
                unit: 'mg/dL',
              },
            },
          ],
        },
      },
    ],
  },
  processedAt: new Date().toISOString(),
};

// Mock API responses
export const mockApiResponses = {
  getPresignedUrl: (filename: string): PresignedUrlResponse => ({
    uploadUrl: `https://mock-s3.amazonaws.com/demo-bucket/${filename}?signature=mock`,
    s3Key: `uploads/demo-user/${Date.now()}-${filename}`,
    expiresIn: 3600,
  }),

  triggerProcessing: (s3Key: string): { jobId: string } => ({
    jobId: `demo-job-${Date.now()}`,
  }),

  getJobStatus: (jobId: string, stage: ProcessingStage = 'processing'): JobStatusResponse => ({
    jobId,
    status: stage,
    message: getStatusMessage(stage),
  }),

  getResults: (jobId: string): ProcessingResults => {
    // Alternate between prescription and lab results for variety
    const useLabResults = jobId.includes('lab') || Math.random() > 0.5;
    return useLabResults ? MOCK_LAB_RESULTS : MOCK_PRESCRIPTION_RESULTS;
  },
};

// Helper function to get status messages
function getStatusMessage(stage: ProcessingStage): string {
  const messages: Record<ProcessingStage, string> = {
    uploading: 'Uploading document to storage...',
    processing: 'Processing document with OCR...',
    extracting: 'Extracting medical entities...',
    transforming: 'Transforming to FHIR format...',
    complete: 'Processing complete',
    failed: 'Processing failed',
  };
  return messages[stage] || 'Processing...';
}

// Simulate processing stages over time
export function simulateProcessingStages(
  jobId: string,
  onStageChange: (status: JobStatusResponse) => void,
  duration: number = 8000
): () => void {
  const stages: ProcessingStage[] = [
    'uploading',
    'processing',
    'extracting',
    'transforming',
    'complete',
  ];

  const stageInterval = duration / stages.length;
  let currentStageIndex = 0;

  const interval = setInterval(() => {
    if (currentStageIndex < stages.length) {
      const stage = stages[currentStageIndex];
      onStageChange(mockApiResponses.getJobStatus(jobId, stage));
      currentStageIndex++;
    } else {
      clearInterval(interval);
    }
  }, stageInterval);

  // Return cleanup function
  return () => clearInterval(interval);
}

// Simulate upload delay
export function simulateUpload(
  file: File,
  onProgress: (progress: number) => void,
  delay: number = 2000
): Promise<void> {
  return new Promise((resolve) => {
    const steps = 10;
    const stepDelay = delay / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const progress = Math.min((currentStep / steps) * 100, 100);
      onProgress(progress);

      if (currentStep >= steps) {
        clearInterval(interval);
        resolve();
      }
    }, stepDelay);
  });
}
