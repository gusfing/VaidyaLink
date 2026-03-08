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

      {/* Magic Metric */}
      <div className="magic-metric">
        <span className="material-symbols-outlined">auto_awesome</span>
        <div>
          <div className="metric-value">85%</div>
          <div className="metric-label">AI Efficiency</div>
        </div>
      </div>

      {/* Health Summary Grid */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="card-icon">
            <span className="material-symbols-outlined">groups</span>
          </div>
          <div className="card-content">
            <div className="card-value">24</div>
            <div className="card-label">Active Patients</div>
          </div>
        </div>
        <div className="summary-card alert">
          <div className="card-icon">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div className="card-content">
            <div className="card-value">3</div>
            <div className="card-label">Critical Alerts</div>
          </div>
        </div>
      </div>

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

      {/* Recent Scans */}
      <div className="info-card">
        <h3>
          <span className="material-symbols-outlined">history</span>
          Recent Scans
        </h3>
        <div className="scans-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="scan-item">
              <div className="scan-thumb">
                <span className="material-symbols-outlined">image</span>
              </div>
              <div className="scan-info">
                <strong>Medical Document {i}</strong>
                <span className="scan-date">2 hours ago</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
