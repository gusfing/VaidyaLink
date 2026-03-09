'use client';

import { useState, useEffect } from 'react';
import { mockTimelineEvents, mockPatientProfile } from '@/lib/vaidyalink/mock-data';
import { exportToFHIR } from '@/lib/vaidyalink/api-client';
import { useProgressiveReveal } from '@/hooks/useProgressiveReveal';

export default function TimelinePage() {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [exportInProgress, setExportInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // Progressive reveal for timeline events
  const revealedEvents = useProgressiveReveal(mockTimelineEvents, 200, !loading);

  const handleExport = async () => {
    setExportInProgress(true);
    setError(null);

    try {
      // Call FHIR export API
      const exportResult = await exportToFHIR({
        patientId: mockPatientProfile.id,
        timelineEvents: mockTimelineEvents.map((event) => ({
          id: event.id,
          type: event.type,
          date: event.date,
          title: event.title,
          description: event.description,
          structuredData: event.structuredData,
        })),
        includeResourceTypes: ['Patient', 'Observation', 'MedicationRequest', 'DiagnosticReport'],
      });

      // Download the FHIR bundle
      const blob = new Blob([JSON.stringify(exportResult.fhirBundle, null, 2)], {
        type: 'application/fhir+json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `health-timeline-fhir-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setExportInProgress(false);
    } catch (err) {
      console.error('Failed to export to FHIR:', err);
      setError('Failed to export to FHIR. Please try again.');
      setExportInProgress(false);
    }
  };

  return (
    <div className="timeline-page">
      <div className="page-header fade-in">
        <h1>Health Timeline</h1>
        <button onClick={handleExport} disabled={exportInProgress} className="export-btn">
          <span className="material-symbols-outlined">
            {exportInProgress ? 'hourglass_empty' : 'download'}
          </span>
          {exportInProgress ? 'Exporting...' : 'Export to HL7 FHIR'}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="error-message fade-in">
          <span className="material-symbols-outlined">error</span>
          <p>{error}</p>
        </div>
      )}

      {/* Timeline */}
      <div className="timeline">
        {loading
          ? // Skeleton loaders for timeline
            [...Array(5)].map((_, i) => (
              <div key={i} className="timeline-item" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="timeline-marker">
                  <div
                    className="skeleton"
                    style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                  />
                </div>
                <div className="timeline-content">
                  <div className="event-card">
                    <div
                      className="skeleton"
                      style={{ width: '70%', height: '24px', marginBottom: '12px' }}
                    />
                    <div className="skeleton" style={{ width: '100%', height: '60px' }} />
                  </div>
                </div>
              </div>
            ))
          : revealedEvents.map((event, index) => (
              <div
                key={event.id}
                className="timeline-item slide-in-left"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div
                  className="timeline-marker pulse"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <span className="material-symbols-outlined">{event.icon}</span>
                </div>
                <div className="timeline-content">
                  <div className="event-card">
                    <div className="event-header">
                      <div>
                        <h3>{event.title}</h3>
                        <p className="event-date">
                          {new Date(event.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <span className={`event-type ${event.type}`}>{event.type}</span>
                    </div>
                    <p className="event-description">{event.description}</p>

                    {event.structuredData && (
                      <button
                        onClick={() =>
                          setExpandedEventId(expandedEventId === event.id ? null : event.id)
                        }
                        className="expand-btn"
                      >
                        <span className="material-symbols-outlined">
                          {expandedEventId === event.id ? 'expand_less' : 'expand_more'}
                        </span>
                        {expandedEventId === event.id ? 'Hide Details' : 'Show Details'}
                      </button>
                    )}

                    {expandedEventId === event.id && event.structuredData && (
                      <div className="structured-data fade-in">
                        <pre>{JSON.stringify(event.structuredData, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Floating Action Button */}
      {!loading && (
        <button className="fab fade-in" style={{ animationDelay: '0.5s' }} title="Add new event">
          <span className="material-symbols-outlined">add</span>
        </button>
      )}
    </div>
  );
}
