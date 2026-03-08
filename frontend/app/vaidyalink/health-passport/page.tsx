'use client';

import { useState } from 'react';
import HealthPassportCard from '@/components/vaidyalink/HealthPassportCard';
import { mockPatientProfile } from '@/lib/vaidyalink/mock-data';

export default function HealthPassportPage() {
  const [privacyMode, setPrivacyMode] = useState(false);
  const patient = mockPatientProfile;

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
      <div className="profile-section">
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

      {/* ABHA Card */}
      <HealthPassportCard
        abhaId={privacyMode ? maskText(patient.abhaId) : patient.abhaId}
        qrCodeData={patient.abhaId}
        verified={patient.verified}
      />

      {/* Critical Information */}
      <div className="info-card">
        <h3>
          <span className="material-symbols-outlined">warning</span>
          Critical Information
        </h3>
        <div className="info-grid">
          <div className="info-item">
            <label>Allergies</label>
            <div className="tags">
              {patient.allergies.map((allergy, i) => (
                <span key={i} className="tag alert">
                  {privacyMode ? maskText(allergy) : allergy}
                </span>
              ))}
            </div>
          </div>
          <div className="info-item">
            <label>Chronic Conditions</label>
            <div className="tags">
              {patient.chronicConditions.map((condition, i) => (
                <span key={i} className="tag">
                  {privacyMode ? maskText(condition) : condition}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="info-card">
        <h3>
          <span className="material-symbols-outlined">emergency</span>
          Emergency Contacts
        </h3>
        {patient.emergencyContacts.map((contact, i) => (
          <div key={i} className="contact-item">
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

      {/* Authorized Doctors */}
      <div className="info-card">
        <h3>
          <span className="material-symbols-outlined">medical_services</span>
          Authorized Healthcare Providers
        </h3>
        {patient.authorizedDoctors.map((doctor) => (
          <div key={doctor.id} className="doctor-item">
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
    </div>
  );
}
