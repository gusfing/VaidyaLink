'use client';

import { useState } from 'react';

export default function ClinicalSummaryPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const generateSummary = async () => {
    setIsGenerating(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setSummary({
      patientId: 'P-12345',
      patientName: 'Vivek M',
      generatedAt: new Date().toISOString(),
      summary: {
        chiefComplaint: 'Patient presents with giddiness and weakness for 2 days',
        currentConditions: ['Hypoglycemia', 'Dehydration'],
        medications: [
          { name: 'Dextrose 10% IV', dosage: '500ml', frequency: 'stat' },
          { name: 'ORS', dosage: '2 sachets', frequency: 'as needed' },
        ],
        vitalSigns: {
          bloodPressure: '110/70 mmHg',
          pulseRate: '60 bpm',
          bloodSugar: '120 mg/dL (fasting)',
        },
        assessment:
          'Patient showing signs of hypoglycemia with associated symptoms of giddiness and weakness. Blood sugar levels slightly elevated at 120 mg/dL. Vital signs stable.',
        plan: 'Immediate IV dextrose administration, oral rehydration, monitor blood sugar levels every 2 hours, dietary counseling.',
      },
    });
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Clinical Summarizer</h1>
          <p className="mt-2 text-sm text-gray-600">
            AI-powered comprehensive patient summaries using Amazon Bedrock
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {!summary ? (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <div className="mb-4 text-6xl">📋</div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Generate Clinical Summary</h2>
            <p className="mb-6 text-gray-600">
              Aggregate patient data from multiple sources and generate a comprehensive clinical
              summary
            </p>
            <button
              onClick={generateSummary}
              disabled={isGenerating}
              className="rounded-md bg-blue-600 px-6 py-3 text-white transition-colors duration-200 hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isGenerating ? 'Generating Summary...' : 'Generate Summary'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{summary.patientName}</h2>
                  <p className="text-sm text-gray-600">Patient ID: {summary.patientId}</p>
                </div>
                <button
                  onClick={() => setSummary(null)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  New Summary
                </button>
              </div>
            </div>

            {/* Chief Complaint */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Chief Complaint</h3>
              <p className="text-gray-700">{summary.summary.chiefComplaint}</p>
            </div>

            {/* Current Conditions */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Current Conditions</h3>
              <div className="flex flex-wrap gap-2">
                {summary.summary.currentConditions.map((condition: string, index: number) => (
                  <span
                    key={index}
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700"
                  >
                    {condition}
                  </span>
                ))}
              </div>
            </div>

            {/* Medications */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Current Medications</h3>
              <div className="space-y-3">
                {summary.summary.medications.map((med: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md bg-blue-50 p-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{med.name}</p>
                      <p className="text-sm text-gray-600">
                        {med.dosage} - {med.frequency}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vital Signs */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Vital Signs</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Blood Pressure</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {summary.summary.vitalSigns.bloodPressure}
                  </p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Pulse Rate</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {summary.summary.vitalSigns.pulseRate}
                  </p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Blood Sugar</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {summary.summary.vitalSigns.bloodSugar}
                  </p>
                </div>
              </div>
            </div>

            {/* Assessment */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Assessment</h3>
              <p className="text-gray-700">{summary.summary.assessment}</p>
            </div>

            {/* Plan */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Treatment Plan</h3>
              <p className="text-gray-700">{summary.summary.plan}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
