'use client';

import { useState, useEffect } from 'react';
import HealthPassportCard from '@/components/vaidyalink/HealthPassportCard';
import { mockPatientProfile } from '@/lib/vaidyalink/mock-data';

export default function HealthPassportPage() {
  const [privacyMode, setPrivacyMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showAbha, setShowAbha] = useState(false);
  const [showCritical, setShowCritical] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showDoctors, setShowDoctors] = useState(false);
  const patient = mockPatientProfile;

  useEffect(() => {
    // Simulate loading with progressive reveal
    const timers = [
      setTimeout(() => setShowProfile(true), 300),
      setTimeout(() => setShowAbha(true), 600),
      setTimeout(() => setShowCritical(true), 900),
      setTimeout(() => setShowEmergency(true), 1200),
      setTimeout(() => {
        setShowDoctors(true);
        setLoading(false);
      }, 1500),
    ];

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  const maskText = (text: string) => '•'.repeat(text.length);

  return (
    <div className="health-passport-page">
      <div className="page-header">
        <h1>Health Passport</h1>
        <button onClick={() => setPrivacyMode(!privacyMode)} className="privacy-toggle">
          <span className="material-symbols-outlined">
            {privacyMode ? 'visibility_off' : 'visibility'}
          </span>
          {privacyMode ? 'Show Info' : 'Hide Info'}
        </button>
      </div>

      {/* Patient Profile */}
      {showProfile ? (
        <div className="profile-section fade-in">
          <div className="profile-photo">
            <div className="photo-placeholder">
              <span className="material-symbols-outlined">person</span>
            </div>
            {patient.verified && (
              <span className="verified-badge">
                <span className="material-symbols-outlined">verified</span>
              </span>
            )}
          </div>
          <div className="profile-info">
            <h2>{patient.name}</h2>
            <p className="demographics">
              {patient.age} years • {patient.gender} • {patient.bloodType}
            </p>
          </div>
        </div>
      ) : (
        <div className="profile-section">
          <div
            className="skeleton"
            style={{ width: '80px', height: '80px', borderRadius: '50%' }}
          />
          <div style={{ flex: 1 }}>
            <div
              className="skeleton"
              style={{ width: '200px', height: '28px', marginBottom: '8px' }}
            />
            <div className="skeleton" style={{ width: '150px', height: '20px' }} />
          </div>
        </div>
      )}

      {/* ABHA Card */}
      {showAbha ? (
        <div className="slide-in-left">
          <HealthPassportCard
            abhaId={privacyMode ? maskText(patient.abhaId) : patient.abhaId}
            qrCodeData={patient.abhaId}
            verified={patient.verified}
          />
        </div>
      ) : (
        <div className="health-passport-card">
          <div className="skeleton" style={{ width: '100%', height: '200px' }} />
        </div>
      )}

      {/* Critical Information */}
      {showCritical ? (
        <div className="info-card slide-in-left" style={{ animationDelay: '0.1s' }}>
          <h3>
            <span className="material-symbols-outlined">warning</span>
            Critical Information
          </h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Allergies</label>
              <div className="tags">
                {patient.allergies.map((allergy, i) => (
                  <span
                    key={i}
                    className="tag alert fade-in"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    {privacyMode ? maskText(allergy) : allergy}
                  </span>
                ))}
              </div>
            </div>
            <div className="info-item">
              <label>Chronic Conditions</label>
              <div className="tags">
                {patient.chronicConditions.map((condition, i) => (
                  <span key={i} className="tag fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                    {privacyMode ? maskText(condition) : condition}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="info-card">
          <div
            className="skeleton"
            style={{ width: '200px', height: '24px', marginBottom: '16px' }}
          />
          <div className="skeleton" style={{ width: '100%', height: '80px' }} />
        </div>
      )}

      {/* Emergency Contacts */}
      {showEmergency ? (
        <div className="info-card slide-in-left" style={{ animationDelay: '0.2s' }}>
          <h3>
            <span className="material-symbols-outlined">emergency</span>
            Emergency Contacts
          </h3>
          {patient.emergencyContacts.map((contact, i) => (
            <div key={i} className="contact-item fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="contact-info">
                <strong>{privacyMode ? maskText(contact.name) : contact.name}</strong>
                <span className="relationship">{contact.relationship}</span>
              </div>
              <a href={`tel:${contact.phone}`} className="contact-phone">
                {privacyMode ? maskText(contact.phone) : contact.phone}
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="info-card">
          <div
            className="skeleton"
            style={{ width: '200px', height: '24px', marginBottom: '16px' }}
          />
          <div className="skeleton" style={{ width: '100%', height: '120px' }} />
        </div>
      )}

      {/* Authorized Doctors */}
      {showDoctors ? (
        <div className="info-card slide-in-left" style={{ animationDelay: '0.3s' }}>
          <h3>
            <span className="material-symbols-outlined">medical_services</span>
            Authorized Healthcare Providers
          </h3>
          {patient.authorizedDoctors.map((doctor, i) => (
            <div
              key={doctor.id}
              className="doctor-item fade-in"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="doctor-photo">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div className="doctor-info">
                <strong>{doctor.name}</strong>
                <p className="specialization">{doctor.specialization}</p>
                <p className="hospital">{doctor.hospital}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="info-card">
          <div
            className="skeleton"
            style={{ width: '250px', height: '24px', marginBottom: '16px' }}
          />
          <div className="skeleton" style={{ width: '100%', height: '150px' }} />
        </div>
      )}
    </div>
  );
}
