'use client';

import { useState } from 'react';

interface HealthPassportCardProps {
  abhaId: string;
  qrCodeData: string;
  verified: boolean;
}

export default function HealthPassportCard({
  abhaId,
  qrCodeData,
  verified,
}: HealthPassportCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(abhaId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="health-passport-card">
      <div className="card-header">
        <h3>ABHA Health ID</h3>
        {verified && (
          <span className="verification-badge">
            <span className="material-symbols-outlined">verified</span>
            Verified
          </span>
        )}
      </div>

      <div className="card-body">
        <div className="qr-section">
          {/* Simple QR placeholder - in production use qrcode library */}
          <div className="qr-code-placeholder">
            <span className="material-symbols-outlined">qr_code_2</span>
          </div>
        </div>

        <div className="abha-details">
          <div className="abha-id">{abhaId}</div>
          <button onClick={handleCopy} className="copy-btn">
            <span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>
            {copied ? 'Copied!' : 'Copy ID'}
          </button>
        </div>
      </div>
    </div>
  );
}
