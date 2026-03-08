'use client';

/**
 * Results Page with Dynamic Routing
 *
 * Displays processing results for a specific job.
 * Extracts jobId from URL params and renders ResultsDisplay component.
 */

import React from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/document-scan-demo/Header';
import ResultsDisplay from '@/components/document-scan-demo/ResultsDisplay';

export default function ResultsPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  return (
    <>
      {/* Header with workflow progress showing results step */}
      <Header currentStep="results" />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ResultsDisplay jobId={jobId} />
      </main>
    </>
  );
}
