'use client';

import { useState } from 'react';

export default function FHIRTransformerPage() {
  const [isTransforming, setIsTransforming] = useState(false);
  const [fhirBundle, setFhirBundle] = useState<any>(null);

  const transformToFHIR = async () => {
    setIsTransforming(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setFhirBundle({
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: 'patient-001',
            name: [{ family: 'M', given: ['Vivek'] }],
            gender: 'male',
            identifier: [{ system: 'UHID', value: '10197' }],
          },
        },
        {
          resource: {
            resourceType: 'MedicationRequest',
            id: 'med-001',
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
            subject: { reference: 'Patient/patient-001' },
            dosageInstruction: [
              {
                text: '10 S/L Dextrose IV stat',
                timing: { code: { coding: [{ code: 'STAT', display: 'Immediately' }] } },
              },
            ],
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: 'obs-001',
            status: 'final',
            code: {
              coding: [
                { system: 'http://loinc.org', code: '1558-6', display: 'Fasting Blood Sugar' },
              ],
            },
            subject: { reference: 'Patient/patient-001' },
            valueQuantity: { value: 120, unit: 'mg/dL' },
          },
        },
      ],
    });
    setIsTransforming(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">FHIR Transformer</h1>
          <p className="mt-2 text-sm text-gray-600">
            Convert medical data to HL7 FHIR R4 standard format
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {!fhirBundle ? (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <div className="mb-4 text-6xl">🔄</div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Transform to FHIR</h2>
            <p className="mb-6 text-gray-600">
              Convert medical data to HL7 FHIR R4 format for interoperability
            </p>
            <button
              onClick={transformToFHIR}
              disabled={isTransforming}
              className="rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isTransforming ? 'Transforming...' : 'Transform to FHIR'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">FHIR Bundle</h2>
                <button
                  onClick={() => setFhirBundle(null)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  New Transformation
                </button>
              </div>

              <div className="mb-6 grid grid-cols-3 gap-4">
                <div className="rounded-md bg-blue-50 p-4">
                  <p className="text-sm text-gray-600">Resource Type</p>
                  <p className="text-lg font-semibold text-gray-900">{fhirBundle.resourceType}</p>
                </div>
                <div className="rounded-md bg-green-50 p-4">
                  <p className="text-sm text-gray-600">Total Resources</p>
                  <p className="text-lg font-semibold text-gray-900">{fhirBundle.entry.length}</p>
                </div>
                <div className="rounded-md bg-purple-50 p-4">
                  <p className="text-sm text-gray-600">FHIR Version</p>
                  <p className="text-lg font-semibold text-gray-900">R4</p>
                </div>
              </div>

              <div className="space-y-4">
                {fhirBundle.entry.map((entry: any, index: number) => (
                  <div key={index} className="rounded-md border border-gray-200 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{entry.resource.resourceType}</h3>
                      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                        Valid
                      </span>
                    </div>
                    <pre className="overflow-x-auto rounded bg-gray-50 p-3 text-xs">
                      {JSON.stringify(entry.resource, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
