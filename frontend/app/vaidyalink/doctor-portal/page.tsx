'use client';

import { useState, useEffect } from 'react';
import PatientSnapshot from '@/components/vaidyalink/PatientSnapshot';
import { mockPatientProfile, mockClinicalSummary } from '@/lib/vaidyalink/mock-data';
import { getClinicalSummary } from '@/lib/vaidyalink/api-client';
import type { ClinicalSummaryResponse } from '@/lib/vaidyalink/api-client';

export default function DoctorPortalPage() {
  const patient = mockPatientProfile;
  const [summary, setSummary] = useState<ClinicalSummaryResponse>(mockClinicalSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClinicalSummary();
  }, []);

  const loadClinicalSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const summaryData = await getClinicalSummary({
        patientId: patient.id,
        includeVitals: true,
        includeMedications: true,
        includeLabResults: true,
      });
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load clinical summary:', err);
      setError('Failed to load clinical summary. Using cached data.');
      // Keep using mock data on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="doctor-portal-page">
      <h1>Doctor's Insight View</h1>

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading clinical summary...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-message">
          <span className="material-symbols-outlined">warning</span>
          <p>{error}</p>
        </div>
      )}

      {/* Patient Snapshot */}
      <PatientSnapshot
        patient={{
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          abhaId: patient.abhaId,
          lastVisit: '2024-01-15',
        }}
      />

      {/* Magic Metric */}
      <div className="magic-metric">
        <span className="material-symbols-outlined">auto_awesome</span>
        <div>
          <div className="metric-value">{summary.timeSavedMinutes} min</div>
          <div className="metric-label">Time Saved by AI</div>
        </div>
      </div>

      {/* Clinical Summary */}
      <div className="info-card">
        <h3>
          <span className="material-symbols-outlined">psychology</span>
          AI Clinical Summary
        </h3>
        <div className="summary-section">
          <h4>Chief Complaint</h4>
          <p>{summary.chiefComplaint}</p>
        </div>
        <div className="summary-section">
          <h4>Recent Context</h4>
          <p>{summary.recentContext}</p>
        </div>
        <div className="summary-section">
          <h4>Critical Flags</h4>
          <div className="flags">
            {summary.criticalFlags.map((flag, i) => (
              <span key={i} className="flag">
                <span className="material-symbols-outlined">flag</span>
                {flag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Vitals */}
      <div className="info-card">
        <h3>
          <span className="material-symbols-outlined">monitor_heart</span>
          Recent Vitals
        </h3>
        <div className="vitals-grid">
          {summary.vitals.map((vital, i) => (
            <div key={i} className={`vital-item ${vital.normal ? 'normal' : 'abnormal'}`}>
              <div className="vital-value">{vital.value}</div>
              <div className="vital-label">{vital.type.replace('-', ' ')}</div>
              <div className="vital-unit">{vital.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Medications */}
      <div className="info-card">
        <h3>
          <span className="material-symbols-outlined">medication</span>
          Current Medications
        </h3>
        {summary.medications.map((med, i) => (
          <div key={i} className="med-item">
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

      {/* Action Toolbar */}
      <div className="action-toolbar">
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
    </div>
  );
}
