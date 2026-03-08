/**
 * VoiceResults Component
 *
 * Displays voice transcription results and extracted medical entities.
 */

'use client';

import type { VoiceTranscriptionResult } from './VoiceRecorder';

interface VoiceResultsProps {
  result: VoiceTranscriptionResult;
  onReset: () => void;
}

export default function VoiceResults({ result, onReset }: VoiceResultsProps) {
  const { transcription, detectedLanguage, confidence, structuredData } = result;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Voice Transcription Results</h2>
        <button
          onClick={onReset}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm transition-all duration-200 hover:bg-gray-50"
        >
          Record Again
        </button>
      </div>

      {/* Transcription */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Transcription</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Language:</span>
            <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
              {detectedLanguage.toUpperCase()}
            </span>
            <span className="text-sm text-gray-500">Confidence:</span>
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${
                confidence >= 0.9
                  ? 'bg-green-100 text-green-700'
                  : confidence >= 0.75
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        <p className="leading-relaxed text-gray-700">{transcription}</p>
      </div>

      {/* Structured Medical Data */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Extracted Medical Entities</h3>

        <div className="space-y-4">
          {/* Chief Complaint */}
          {structuredData.chiefComplaint && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Chief Complaint
              </label>
              <p className="text-gray-900">{structuredData.chiefComplaint}</p>
            </div>
          )}

          {/* Symptoms */}
          {structuredData.symptoms && structuredData.symptoms.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Symptoms</label>
              <div className="flex flex-wrap gap-2">
                {structuredData.symptoms.map((symptom, index) => (
                  <span
                    key={index}
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700"
                  >
                    {symptom}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Duration & Severity */}
          <div className="grid grid-cols-2 gap-4">
            {structuredData.duration && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Duration</label>
                <p className="text-gray-900">{structuredData.duration}</p>
              </div>
            )}
            {structuredData.severity && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Severity</label>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-sm ${
                    structuredData.severity === 'severe'
                      ? 'bg-red-100 text-red-700'
                      : structuredData.severity === 'moderate'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                  }`}
                >
                  {structuredData.severity}
                </span>
              </div>
            )}
          </div>

          {/* Current Medications */}
          {structuredData.currentMedications && structuredData.currentMedications.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Current Medications
              </label>
              <div className="flex flex-wrap gap-2">
                {structuredData.currentMedications.map((med, index) => (
                  <span
                    key={index}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-700"
                  >
                    {med}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Allergies */}
          {structuredData.allergies && structuredData.allergies.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Allergies</label>
              <div className="flex flex-wrap gap-2">
                {structuredData.allergies.map((allergy, index) => (
                  <span
                    key={index}
                    className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm text-orange-700"
                  >
                    {allergy}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FHIR Integration Notice */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-start space-x-3">
          <svg
            className="mt-0.5 h-5 w-5 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-800">FHIR Observation Created</p>
            <p className="mt-1 text-xs text-green-600">
              Voice data has been converted to HL7 FHIR Observation resource for interoperability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
