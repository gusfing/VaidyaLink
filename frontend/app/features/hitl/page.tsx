'use client';

import { useState } from 'react';

export default function HITLHandlerPage() {
  const [reviewQueue, setReviewQueue] = useState([
    {
      id: 'job-001',
      type: 'Prescription',
      confidence: 0.68,
      status: 'pending',
      submittedAt: '2024-03-08T10:30:00Z',
      extractedData: {
        medications: ['Dextrose (uncertain)', 'ORS'],
        dosages: ['10 S/L (low confidence)', '2 sachets'],
      },
    },
    {
      id: 'job-002',
      type: 'Lab Report',
      confidence: 0.72,
      status: 'pending',
      submittedAt: '2024-03-08T09:15:00Z',
      extractedData: {
        tests: ['Hemoglobin', 'WBC Count (unclear)'],
        values: ['14.2 g/dL', '7.8 (needs verification)'],
      },
    },
  ]);

  const [selectedJob, setSelectedJob] = useState<any>(null);

  const handleReview = (jobId: string, action: 'approve' | 'reject' | 'edit') => {
    setReviewQueue((prev) =>
      prev.map((job) =>
        job.id === jobId ? { ...job, status: action === 'approve' ? 'approved' : 'rejected' } : job
      )
    );
    setSelectedJob(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">HITL Handler</h1>
          <p className="mt-2 text-sm text-gray-600">
            Human-in-the-Loop quality assurance for low-confidence extractions
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Queue List */}
          <div className="lg:col-span-1">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Review Queue</h2>
              <div className="space-y-3">
                {reviewQueue.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={`cursor-pointer rounded-md p-4 transition-colors ${
                      selectedJob?.id === job.id
                        ? 'border-2 border-blue-500 bg-blue-50'
                        : job.status === 'pending'
                          ? 'border border-yellow-200 bg-yellow-50 hover:bg-yellow-100'
                          : job.status === 'approved'
                            ? 'border border-green-200 bg-green-50'
                            : 'border border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-gray-900">{job.type}</span>
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          job.confidence >= 0.75
                            ? 'bg-green-100 text-green-700'
                            : job.confidence >= 0.6
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {(job.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{job.id}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(job.submittedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Review Panel */}
          <div className="lg:col-span-2">
            {selectedJob ? (
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Review: {selectedJob.type}</h2>
                  <span
                    className={`rounded px-3 py-1 text-sm ${
                      selectedJob.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : selectedJob.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {selectedJob.status}
                  </span>
                </div>

                <div className="space-y-6">
                  {/* Confidence Score */}
                  <div className="rounded-md bg-gray-50 p-4">
                    <p className="mb-2 text-sm text-gray-600">Confidence Score</p>
                    <div className="flex items-center space-x-3">
                      <div className="h-2 flex-1 rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${
                            selectedJob.confidence >= 0.75
                              ? 'bg-green-500'
                              : selectedJob.confidence >= 0.6
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${selectedJob.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-lg font-semibold text-gray-900">
                        {(selectedJob.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Extracted Data */}
                  <div>
                    <h3 className="mb-3 font-semibold text-gray-900">Extracted Data</h3>
                    <div className="space-y-4">
                      {Object.entries(selectedJob.extractedData).map(
                        ([key, values]: [string, any]) => (
                          <div key={key} className="rounded-md border border-gray-200 p-4">
                            <p className="mb-2 text-sm font-medium text-gray-700 capitalize">
                              {key}
                            </p>
                            <div className="space-y-2">
                              {values.map((value: string, index: number) => (
                                <div key={index} className="flex items-center space-x-2">
                                  <input
                                    type="text"
                                    defaultValue={value}
                                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                                  />
                                  {value.includes('uncertain') ||
                                  value.includes('unclear') ||
                                  value.includes('low confidence') ? (
                                    <span className="text-xs text-red-600">⚠️ Needs review</span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {selectedJob.status === 'pending' && (
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleReview(selectedJob.id, 'approve')}
                        className="flex-1 rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(selectedJob.id, 'edit')}
                        className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                      >
                        Edit & Approve
                      </button>
                      <button
                        onClick={() => handleReview(selectedJob.id, 'reject')}
                        className="flex-1 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-white p-12 text-center shadow-sm">
                <div className="mb-4 text-6xl">👥</div>
                <h2 className="mb-2 text-xl font-bold text-gray-900">Select a Job to Review</h2>
                <p className="text-gray-600">
                  Choose a job from the queue to review and approve extracted data
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
