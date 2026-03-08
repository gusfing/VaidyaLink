'use client';

/**
 * ResultsDisplay Component
 *
 * Displays complete processing results including original document,
 * OCR text, structured data, and FHIR resources in a tabbed interface.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProcessingResults } from '@/lib/document-scan-demo/queries';
import { useToast } from './ToastContainer';
import LoadingSpinner from './LoadingSpinner';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Medication, LabResult } from '@/lib/document-scan-demo/types';

interface ResultsDisplayProps {
  jobId: string;
}

type TabType = 'overview' | 'ocr' | 'structured' | 'fhir';

/**
 * Get color class for confidence score badge
 */
function getConfidenceColor(confidence: number): string {
  if (confidence > 0.9) return 'bg-green-100 text-green-800 border-green-200';
  if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

/**
 * Format confidence score as percentage
 */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export default function ResultsDisplay({ jobId }: ResultsDisplayProps) {
  const router = useRouter();
  const { showError } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Fetch complete results
  const { data: results, isLoading, error, isError } = useProcessingResults(jobId);

  // Show error toast when error occurs
  useEffect(() => {
    if (isError && error) {
      const errorMessage = error?.message || 'Failed to load results';
      showError(errorMessage);
      console.error('Results fetch error:', { jobId, error: errorMessage });
    }
  }, [isError, error, showError, jobId]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
        <LoadingSpinner message="Loading results..." />
      </div>
    );
  }

  // Render error state
  if (isError || !results) {
    const displayError = error?.message || 'Failed to load results';
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="mb-4 flex items-center">
            <svg
              className="mr-3 h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-red-900">Error Loading Results</h3>
          </div>
          <p className="mb-4 text-red-700">{displayError}</p>
          <button
            onClick={() => router.push('/document-scan-demo')}
            className="w-full rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
          >
            New Scan
          </button>
        </div>
      </div>
    );
  }

  // Ensure arrays are defined (handle incomplete data gracefully)
  const safeResults = {
    ...results,
    entities: results.entities || [],
    medications: results.medications || [],
    conditions: results.conditions || [],
    labResults: results.labResults || [],
    ocrText: results.ocrText || '',
    fhirResource: results.fhirResource || {},
  };

  // Tab configuration
  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'ocr', label: 'OCR' },
    { id: 'structured', label: 'Structured' },
    { id: 'fhir', label: 'FHIR' },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Processing Results</h1>
          <p className="mt-1 text-sm text-gray-500">
            Processed at {new Date(safeResults.processedAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => router.push('/document-scan-demo')}
          className="rounded-md bg-blue-600 px-6 py-2 text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
        >
          New Scan
        </button>
      </div>

      {/* Original Document Image */}
      {safeResults.documentUrl && (
        <div className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-900">Original Document</h2>
          </div>
          <div className="flex justify-center p-6">
            <img
              src={safeResults.documentUrl}
              alt="Original document"
              className="max-h-96 rounded-lg border border-gray-300 object-contain shadow-sm"
            />
          </div>
        </div>
      )}

      {/* Tabbed Interface */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
        {/* Tab Headers */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 overflow-x-auto px-4" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-lg font-semibold text-gray-900">Summary</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50 to-gray-50 p-4 transition-all duration-200 hover:border-blue-300 hover:shadow-md">
                    <div className="text-2xl font-bold text-blue-600">
                      {safeResults.medications.length}
                    </div>
                    <div className="text-sm text-gray-600">Medications</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50 to-gray-50 p-4 transition-all duration-200 hover:border-blue-300 hover:shadow-md">
                    <div className="text-2xl font-bold text-blue-600">
                      {safeResults.conditions.length}
                    </div>
                    <div className="text-sm text-gray-600">Conditions</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50 to-gray-50 p-4 transition-all duration-200 hover:border-blue-300 hover:shadow-md">
                    <div className="text-2xl font-bold text-blue-600">
                      {safeResults.labResults.length}
                    </div>
                    <div className="text-sm text-gray-600">Lab Results</div>
                  </div>
                </div>
              </div>

              {/* Key Entities */}
              {safeResults.entities.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900">Key Entities</h3>
                  <div className="flex flex-wrap gap-2">
                    {safeResults.entities.slice(0, 10).map((entity, index) => (
                      <span
                        key={index}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-all duration-200 hover:shadow-sm ${getConfidenceColor(entity.confidence)}`}
                      >
                        <span className="font-medium">{entity.text}</span>
                        <span className="text-xs opacity-75">
                          {formatConfidence(entity.confidence)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Preview */}
              {safeResults.medications.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900">Medications Preview</h3>
                  <div className="space-y-2">
                    {safeResults.medications.slice(0, 3).map((med, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-3 transition-all duration-200 hover:bg-white hover:shadow-sm"
                      >
                        <div className="font-medium text-gray-900">{med.name}</div>
                        <div className="text-sm text-gray-600">
                          {med.dosage} • {med.frequency}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OCR Tab */}
          {activeTab === 'ocr' && (
            <div>
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Extracted Text</h3>
              {safeResults.ocrText ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <pre className="font-mono text-sm whitespace-pre-wrap text-gray-800">
                    {safeResults.ocrText}
                  </pre>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-gray-500">
                  No OCR text available
                </div>
              )}
            </div>
          )}

          {/* Structured Tab */}
          {activeTab === 'structured' && (
            <div className="space-y-6">
              {/* Medications */}
              {safeResults.medications.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900">Medications</h3>
                  <div className="space-y-3">
                    {safeResults.medications.map((med: Medication, index: number) => (
                      <div
                        key={index}
                        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md"
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="font-semibold text-gray-900">{med.name}</div>
                          <span
                            className={`rounded-full border px-2 py-1 text-xs font-medium transition-all duration-200 hover:shadow-sm ${getConfidenceColor(med.confidence)}`}
                          >
                            {formatConfidence(med.confidence)}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Dosage:</span> {med.dosage}
                          </div>
                          <div>
                            <span className="font-medium">Frequency:</span> {med.frequency}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conditions */}
              {safeResults.conditions.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900">Conditions</h3>
                  <div className="flex flex-wrap gap-2">
                    {safeResults.conditions.map((condition, index) => (
                      <span
                        key={index}
                        className="rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-sm text-gray-800 transition-all duration-200 hover:bg-gray-200 hover:shadow-sm"
                      >
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Lab Results */}
              {safeResults.labResults.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900">Lab Results</h3>
                  <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                              Test Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                              Value
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                              Unit
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                              Confidence
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {safeResults.labResults.map((lab: LabResult, index: number) => (
                            <tr
                              key={index}
                              className="transition-colors duration-150 hover:bg-gray-50"
                            >
                              <td className="px-4 py-3 text-sm font-medium whitespace-nowrap text-gray-900">
                                {lab.testName}
                              </td>
                              <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-600">
                                {lab.value}
                              </td>
                              <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-600">
                                {lab.unit}
                              </td>
                              <td className="px-4 py-3 text-sm whitespace-nowrap">
                                <span
                                  className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium transition-all duration-200 hover:shadow-sm ${getConfidenceColor(lab.confidence)}`}
                                >
                                  {formatConfidence(lab.confidence)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* No data message */}
              {safeResults.medications.length === 0 &&
                safeResults.conditions.length === 0 &&
                safeResults.labResults.length === 0 && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
                    No structured data extracted from this document
                  </div>
                )}
            </div>
          )}

          {/* FHIR Tab */}
          {activeTab === 'fhir' && (
            <div>
              <h3 className="mb-3 text-lg font-semibold text-gray-900">FHIR Resource</h3>
              {safeResults.fhirResource && Object.keys(safeResults.fhirResource).length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <SyntaxHighlighter
                    language="json"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    {JSON.stringify(safeResults.fhirResource, null, 2)}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-gray-500">
                  No FHIR resource available
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
