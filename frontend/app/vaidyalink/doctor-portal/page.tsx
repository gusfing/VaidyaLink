'use client';

import { useState, useEffect } from 'react';
import PatientSnapshot from '@/components/vaidyalink/PatientSnapshot';
import { mockPatientProfile, mockClinicalSummary } from '@/lib/vaidyalink/mock-data';
import { getClinicalSummary } from '@/lib/vaidyalink/api-client';
import { useTypingEffect, useProgressiveReveal } from '@/hooks/useProgressiveReveal';
import type { ClinicalSummary } from '@/lib/vaidyalink/types';

export default function DoctorPortalPage() {
  const patient = mockPatientProfile;
  const [summary, setSummary] = useState<ClinicalSummary>(mockClinicalSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  // Typing effects for AI summary
  const displayedChiefComplaint = useTypingEffect(
    showSummary ? summary.chiefComplaint : '',
    25,
    showSummary
  );
  const displayedRecentContext = useTypingEffect(
    showSummary ? summary.recentContext : '',
    20,
    showSummary && displayedChiefComplaint === summary.chiefComplaint
  );

  // Progressive reveal for data
  const revealedFlags = useProgressiveReveal(
    showSummary ? summary.criticalFlags : [],
    300,
    showSummary
  );
  const revealedVitals = useProgressiveReveal(showSummary ? summary.vitals : [], 250, showSummary);
  const revealedMedications = useProgressiveReveal(
    showSummary ? summary.medications : [],
    200,
    showSummary
  );

  useEffect(() => {
    loadClinicalSummary();
  }, []);

  const loadClinicalSummary = async () => {
    setLoading(true);
    setError(null);
    setProcessingStage(0);

    // Simulate processing stages
    const stages = [
      { message: 'Loading patient data...', duration: 500 },
      { message: 'Analyzing medical history...', duration: 1000 },
      { message: 'Generating AI summary...', duration: 1500 },
      { message: 'Checking vitals...', duration: 800 },
      { message: 'Finalizing insights...', duration: 500 },
    ];

    let currentStage = 0;
    const stageInterval = setInterval(() => {
      if (currentStage < stages.length) {
        setProcessingStage(currentStage);
        currentStage++;
      } else {
        clearInterval(stageInterval);
      }
    }, 800);

    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, stages.length * 800));
      clearInterval(stageInterval);

      const summaryData = await getClinicalSummary({
        patientId: patient.id,
        includeVitals: true,
        includeMedications: true,
        includeLabResults: true,
      });

      // Transform API response to match local type
      const transformedSummary: ClinicalSummary = {
        patientId: summaryData.patientId,
        generatedAt: summaryData.generatedAt,
        chiefComplaint: summaryData.chiefComplaint,
        recentContext: summaryData.recentContext,
        criticalFlags: summaryData.criticalFlags,
        vitals: summaryData.vitals.map((vital) => ({
          type: vital.type as 'blood-pressure' | 'heart-rate' | 'temperature' | 'oxygen-saturation',
          value: vital.value,
          unit: vital.unit,
          timestamp: vital.timestamp,
          normal: vital.normal,
        })),
        medications: summaryData.medications,
        recentLabs: summaryData.recentLabs.map((lab) => ({
          testName: lab.testName,
          value: lab.value,
          unit: lab.unit,
          referenceRange: lab.referenceRange || '',
          date: lab.timestamp,
        })),
        timeSavedMinutes: summaryData.timeSavedMinutes,
        confidence: summaryData.confidence,
      };

      setSummary(transformedSummary);
      setShowSummary(true);
    } catch (err) {
      console.error('Failed to load clinical summary:', err);
      clearInterval(stageInterval);
      setError('Failed to load clinical summary. Using cached data.');
      // Keep using mock data on error
      setShowSummary(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="doctor-portal-page">
      <h1>Doctor's Insight View</h1>

      {/* Loading State with Processing Stages */}
      {loading && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
          {/* Processing stages */}
          <div className="processing-stages">
            {[
              { message: 'Loading patient data...', icon: 'folder_open' },
              { message: 'Analyzing medical history...', icon: 'analytics' },
              { message: 'Generating AI summary...', icon: 'psychology' },
              { message: 'Checking vitals...', icon: 'monitor_heart' },
              { message: 'Finalizing insights...', icon: 'check_circle' },
            ].map((stage, index) => (
              <div
                key={index}
                className={`stage-item ${
                  index === processingStage ? 'active' : index < processingStage ? 'completed' : ''
                }`}
              >
                <div className="stage-icon">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {index < processingStage ? 'check' : stage.icon}
                  </span>
                </div>
                <div className="stage-message">{stage.message}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="progress-bar mt-4">
            <div
              className="progress-fill"
              style={{ width: `${((processingStage + 1) / 5) * 100}%` }}
            />
          </div>

          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            AI is analyzing patient data...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-message fade-in">
          <span className="material-symbols-outlined">warning</span>
          <p>{error}</p>
        </div>
      )}

      {/* Patient Snapshot */}
      {!loading && (
        <div className="fade-in">
          <PatientSnapshot
            patient={{
              name: patient.name,
              age: patient.age,
              gender: patient.gender,
              abhaId: patient.abhaId,
              lastVisit: '2024-01-15',
            }}
          />
        </div>
      )}

      {/* Magic Metric */}
      {showSummary && (
        <div className="magic-metric slide-in-left">
          <span className="material-symbols-outlined">auto_awesome</span>
          <div>
            <div className="metric-value">{summary.timeSavedMinutes} min</div>
            <div className="metric-label">Time Saved by AI</div>
          </div>
        </div>
      )}

      {/* Clinical Summary with Typing Effect */}
      {showSummary && (
        <div className="info-card slide-in-left" style={{ animationDelay: '0.1s' }}>
          <h3>
            <span className="material-symbols-outlined">psychology</span>
            AI Clinical Summary
          </h3>
          <div className="summary-section">
            <h4>Chief Complaint</h4>
            <p>
              {displayedChiefComplaint}
              {displayedChiefComplaint.length < summary.chiefComplaint.length && (
                <span className="bg-primary-color ml-1 inline-block h-4 w-0.5 animate-pulse" />
              )}
            </p>
          </div>
          <div className="summary-section">
            <h4>Recent Context</h4>
            <p>
              {displayedRecentContext}
              {displayedRecentContext.length < summary.recentContext.length && (
                <span className="bg-primary-color ml-1 inline-block h-4 w-0.5 animate-pulse" />
              )}
            </p>
          </div>
          <div className="summary-section">
            <h4>Critical Flags</h4>
            <div className="flags">
              {revealedFlags.map((flag, i) => (
                <span key={i} className="flag pulse" style={{ animationDelay: `${i * 0.1}s` }}>
                  <span className="material-symbols-outlined">flag</span>
                  {flag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Vitals with Progressive Reveal */}
      {showSummary && (
        <div className="info-card slide-in-left" style={{ animationDelay: '0.2s' }}>
          <h3>
            <span className="material-symbols-outlined">monitor_heart</span>
            Recent Vitals
          </h3>
          <div className="vitals-grid">
            {revealedVitals.map((vital, i) => (
              <div
                key={i}
                className={`vital-item ${vital.normal ? 'normal' : 'abnormal'} fade-in`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="vital-value">{vital.value}</div>
                <div className="vital-label">{vital.type.replace('-', ' ')}</div>
                <div className="vital-unit">{vital.unit}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medications with Progressive Reveal */}
      {showSummary && (
        <div className="info-card slide-in-left" style={{ animationDelay: '0.3s' }}>
          <h3>
            <span className="material-symbols-outlined">medication</span>
            Current Medications
          </h3>
          {revealedMedications.map((med, i) => (
            <div key={i} className="med-item fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="med-info">
                <strong>{med.name}</strong>
                <span className="med-dosage">
                  {med.dosage} • {med.frequency}
                </span>
              </div>
              {med.active && <span className="active-badge">Active</span>}
            </div>
          ))}
        </div>
      )}

      {/* Action Toolbar */}
      {showSummary && (
        <div className="action-toolbar fade-in" style={{ animationDelay: '0.4s' }}>
          <button className="action-btn primary">
            <span className="material-symbols-outlined">edit_note</span>
            Update Prescription
          </button>
          <button className="action-btn">
            <span className="material-symbols-outlined">lab_profile</span>
            Add Lab Request
          </button>
          <button className="action-btn">
            <span className="material-symbols-outlined">check_circle</span>
            End Consultation
          </button>
        </div>
      )}
    </div>
  );
}
