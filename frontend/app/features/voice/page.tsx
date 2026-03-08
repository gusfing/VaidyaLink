'use client';

import { useState } from 'react';
import VoiceRecorder, {
  type VoiceTranscriptionResult,
} from '@/components/document-scan-demo/VoiceRecorder';
import VoiceResults from '@/components/document-scan-demo/VoiceResults';
import { ToastProvider } from '@/components/document-scan-demo/ToastContainer';

export default function VoiceProcessingPage() {
  const [result, setResult] = useState<VoiceTranscriptionResult | null>(null);

  const handleReset = () => {
    setResult(null);
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900">Voice Processing</h1>
            <p className="mt-2 text-sm text-gray-600">
              Record medical history in 22 Indian languages using Sarvam API
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {!result ? (
            <VoiceRecorder onTranscriptionComplete={setResult} />
          ) : (
            <VoiceResults result={result} onReset={handleReset} />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}
