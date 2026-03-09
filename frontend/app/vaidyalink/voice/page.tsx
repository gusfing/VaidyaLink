'use client';

import { useState } from 'react';
import VoiceRecorder from '@/components/document-scan-demo/VoiceRecorder';
import VoiceResults from '@/components/document-scan-demo/VoiceResults';

export default function VoiceDashboardPage() {
  const [transcriptionResult, setTranscriptionResult] = useState<any | null>(null);

  const handleTranscriptionComplete = (result: any) => {
    setTranscriptionResult(result);
  };

  const handleReset = () => {
    setTranscriptionResult(null);
  };

  return (
    <div className="voice-dashboard-page">
      <h1>Voice Dashboard</h1>
      <p className="subtitle">बोलें और सुनें • Speak and Listen</p>

      {/* Voice Recorder */}
      <div className="voice-section">
        <VoiceRecorder onTranscriptionComplete={handleTranscriptionComplete} />
      </div>

      {/* Voice Results */}
      {transcriptionResult && (
        <div className="results-section">
          <VoiceResults result={transcriptionResult} onReset={handleReset} />
        </div>
      )}

      {/* How it works */}
      {!transcriptionResult && (
        <div className="info-card">
          <h3>
            <span className="material-symbols-outlined">info</span>
            How Voice Notes Work
          </h3>
          <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
            <li>Select your preferred language from 22 Indian languages</li>
            <li>Record your symptoms, medications, or health concerns</li>
            <li>AI transcribes and extracts medical information automatically</li>
            <li>Review and save to your health records</li>
          </ul>
        </div>
      )}
    </div>
  );
}
