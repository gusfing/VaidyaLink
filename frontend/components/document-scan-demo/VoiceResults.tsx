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
        <h2 className="text-2xl font-bold text-gray-900">Voice Note</h2>
        <button
          onClick={onReset}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm transition-all duration-200 hover:bg-gray-50"
        >
          New Recording
        </button>
      </div>

      {/* Transcription */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold text-gray-900">What You Said</h3>
        <p className="text-lg leading-relaxed text-gray-700">{transcription}</p>
      </div>

      {/* Structured Medical Data */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Summary</h3>

        <div className="space-y-4">
          {/* Chief Complaint */}
          {structuredData.chiefComplaint && (
            <div>
              <p className="text-base text-gray-900">{structuredData.chiefComplaint}</p>
            </div>
          )}

          {/* Symptoms */}
          {structuredData.symptoms && structuredData.symptoms.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {structuredData.symptoms.map((symptom, index) => (
                <span
                  key={index}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700 capitalize"
                >
                  {symptom}
                </span>
              ))}
            </div>
          )}

          {/* Duration & Severity */}
          {(structuredData.duration || structuredData.severity) && (
            <div className="flex gap-4 text-sm text-gray-600">
              {structuredData.duration && <span>Duration: {structuredData.duration}</span>}
              {structuredData.severity && (
                <span className="capitalize">Severity: {structuredData.severity}</span>
              )}
            </div>
          )}

          {/* Current Medications */}
          {structuredData.currentMedications && structuredData.currentMedications.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Medications</label>
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
    </div>
  );
}
