'use client';

import { useState } from 'react';
import { ABHAVerification } from './ABHAVerification';

interface ABHALinkingProps {
  accessToken: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

/**
 * ABHA ID Linking Component
 * Allows users to link their Ayushman Bharat Health Account
 */
export function ABHALinking({ accessToken, onComplete, onCancel }: ABHALinkingProps) {
  const [abhaId, setAbhaId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);

  const formatABHAId = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Limit to 14 digits
    const limited = digits.slice(0, 14);

    // Format as 12-3456-7890-1234
    const parts: string[] = [];
    if (limited.length > 0) parts.push(limited.slice(0, 2));
    if (limited.length > 2) parts.push(limited.slice(2, 6));
    if (limited.length > 6) parts.push(limited.slice(6, 10));
    if (limited.length > 10) parts.push(limited.slice(10, 14));

    return parts.join('-');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatABHAId(e.target.value);
    setAbhaId(formatted);
    setError(null);
  };

  const handleContinue = () => {
    // Validate ABHA ID format
    const abhaRegex = /^\d{2}-\d{4}-\d{4}-\d{4}$/;
    if (!abhaRegex.test(abhaId)) {
      setError('Please enter a valid ABHA ID in format: 12-3456-7890-1234');
      return;
    }

    setShowVerification(true);
  };

  if (showVerification) {
    return (
      <ABHAVerification
        abhaId={abhaId}
        accessToken={accessToken}
        onComplete={onComplete}
        onCancel={() => setShowVerification(false)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Link ABHA ID</h2>
        <p className="mt-2 text-sm text-gray-600">
          Connect your Ayushman Bharat Health Account to access unified healthcare services
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start space-x-3">
          <svg
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium">What is ABHA ID?</p>
            <p className="mt-1">
              ABHA (Ayushman Bharat Health Account) is a unique 14-digit health ID that enables you
              to access and share your health records digitally across India's healthcare system.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="abhaId" className="block text-sm font-medium text-gray-700">
            ABHA ID
          </label>
          <input
            type="text"
            id="abhaId"
            value={abhaId}
            onChange={handleInputChange}
            placeholder="12-3456-7890-1234"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            maxLength={17} // 14 digits + 3 hyphens
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter your 14-digit ABHA ID (format: 12-3456-7890-1234)
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleContinue}
            disabled={abhaId.length !== 17}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Continue
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium text-gray-900">Benefits of linking ABHA ID:</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start">
            <svg
              className="mt-0.5 mr-2 h-4 w-4 flex-shrink-0 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Access your health records from anywhere in India
          </li>
          <li className="flex items-start">
            <svg
              className="mt-0.5 mr-2 h-4 w-4 flex-shrink-0 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Share records securely with healthcare providers
          </li>
          <li className="flex items-start">
            <svg
              className="mt-0.5 mr-2 h-4 w-4 flex-shrink-0 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Seamless integration with ABDM ecosystem
          </li>
          <li className="flex items-start">
            <svg
              className="mt-0.5 mr-2 h-4 w-4 flex-shrink-0 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Import existing health records from ABDM
          </li>
        </ul>
      </div>

      <div className="mt-4 text-center">
        <a
          href="https://abha.abdm.gov.in/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          Don't have an ABHA ID? Create one here →
        </a>
      </div>
    </div>
  );
}
