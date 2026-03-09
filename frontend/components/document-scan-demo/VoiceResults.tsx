/**
 * VoiceResults Component
 *
 * Displays voice transcription results and extracted medical entities with progressive reveal.
 */

'use client';

import { useTypingEffect, useProgressiveReveal } from '@/hooks/useProgressiveReveal';
import type { VoiceTranscriptionResult } from './VoiceRecorder';

interface VoiceResultsProps {
  result: VoiceTranscriptionResult;
  onReset: () => void;
}

export default function VoiceResults({ result, onReset }: VoiceResultsProps) {
  const { transcription, detectedLanguage, confidence, structuredData } = result;

  // Progressive reveal for transcription text (typing effect)
  const displayedTranscription = useTypingEffect(transcription, 30, true);

  // Progressive reveal for symptoms
  const revealedSymptoms = useProgressiveReveal(structuredData.symptoms || [], 200, true);

  // Progressive reveal for medications
  const revealedMedications = useProgressiveReveal(
    structuredData.currentMedications || [],
    250,
    true
  );

  // Progressive reveal for allergies
  const revealedAllergies = useProgressiveReveal(structuredData.allergies || [], 250, true);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="fade-in flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Voice Note</h2>
        <button
          onClick={onReset}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm transition-all duration-200 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          New Recording
        </button>
      </div>

      {/* Transcription with typing effect */}
      <div className="fade-in rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
          What You Said
        </h3>
        <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300">
          {displayedTranscription}
          {displayedTranscription.length < transcription.length && (
            <span className="bg-primary-color ml-1 inline-block h-5 w-0.5 animate-pulse" />
          )}
        </p>
      </div>

      {/* Structured Medical Data with progressive reveal */}
      <div className="slide-in-left rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Summary</h3>

        <div className="space-y-4">
          {/* Chief Complaint */}
          {structuredData.chiefComplaint && (
            <div className="fade-in">
              <p className="text-base text-gray-900 dark:text-gray-100">
                {structuredData.chiefComplaint}
              </p>
            </div>
          )}

          {/* Symptoms - progressive reveal */}
          {structuredData.symptoms && structuredData.symptoms.length > 0 && (
            <div className="fade-in">
              <div className="flex flex-wrap gap-2">
                {revealedSymptoms.map((symptom, index) => (
                  <span
                    key={index}
                    className="fade-in rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm capitalize text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {symptom}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Duration & Severity */}
          {(structuredData.duration || structuredData.severity) && (
            <div className="fade-in flex gap-4 text-sm text-gray-600 dark:text-gray-400">
              {structuredData.duration && <span>Duration: {structuredData.duration}</span>}
              {structuredData.severity && (
                <span className="capitalize">Severity: {structuredData.severity}</span>
              )}
            </div>
          )}

          {/* Current Medications - progressive reveal */}
          {structuredData.currentMedications && structuredData.currentMedications.length > 0 && (
            <div className="fade-in">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Medications
              </label>
              <div className="flex flex-wrap gap-2">
                {revealedMedications.map((med, index) => (
                  <span
                    key={index}
                    className="fade-in rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {med}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Allergies - progressive reveal */}
          {structuredData.allergies && structuredData.allergies.length > 0 && (
            <div className="fade-in">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Allergies
              </label>
              <div className="flex flex-wrap gap-2">
                {revealedAllergies.map((allergy, index) => (
                  <span
                    key={index}
                    className="fade-in rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                    style={{ animationDelay: `${index * 0.1}s` }}
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
