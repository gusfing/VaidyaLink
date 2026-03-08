'use client';

import { useState, useEffect } from 'react';
import { createMFAService, type MFAStatus, type MFAMethod } from '@/lib/auth/mfa-service';
import { TOTPSetup } from './TOTPSetup';
import { SMSSetup } from './SMSSetup';

interface MFASetupProps {
  accessToken: string;
  onComplete?: () => void;
}

/**
 * MFA Setup Component
 * Allows users to configure multi-factor authentication
 */
export function MFASetup({ accessToken, onComplete }: MFASetupProps) {
  const [mfaStatus, setMFAStatus] = useState<MFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'SMS' | 'TOTP' | null>(null);

  const mfaService = createMFAService();

  useEffect(() => {
    loadMFAStatus();
  }, [accessToken]);

  const loadMFAStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await mfaService.getMFAStatus(accessToken);
      setMFAStatus(status);
    } catch (err) {
      setError('Failed to load MFA status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMethodChange = async (method: MFAMethod) => {
    try {
      setError(null);
      await mfaService.setMFAPreference(accessToken, method);
      await loadMFAStatus();
      onComplete?.();
    } catch (err) {
      setError('Failed to update MFA preference');
      console.error(err);
    }
  };

  const handleDisableMFA = async () => {
    if (!confirm('Are you sure you want to disable MFA? This will reduce your account security.')) {
      return;
    }

    try {
      setError(null);
      await mfaService.disableMFA(accessToken);
      await loadMFAStatus();
      onComplete?.();
    } catch (err) {
      setError('Failed to disable MFA');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (selectedMethod === 'TOTP') {
    return (
      <TOTPSetup
        accessToken={accessToken}
        onComplete={() => {
          setSelectedMethod(null);
          loadMFAStatus();
          onComplete?.();
        }}
        onCancel={() => setSelectedMethod(null)}
      />
    );
  }

  if (selectedMethod === 'SMS') {
    return (
      <SMSSetup
        accessToken={accessToken}
        onComplete={() => {
          setSelectedMethod(null);
          loadMFAStatus();
          onComplete?.();
        }}
        onCancel={() => setSelectedMethod(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-2xl font-bold">Multi-Factor Authentication</h2>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          Multi-factor authentication adds an extra layer of security to your account by requiring a
          second form of verification in addition to your password.
        </p>
      </div>

      {mfaStatus && (
        <div className="space-y-4">
          <div className="rounded-lg border p-6">
            <h3 className="mb-4 text-lg font-semibold">Current Status</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">SMS MFA:</span>
                <span
                  className={`rounded-full px-3 py-1 text-sm ${
                    mfaStatus.smsEnabled
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {mfaStatus.smsEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Authenticator App (TOTP):</span>
                <span
                  className={`rounded-full px-3 py-1 text-sm ${
                    mfaStatus.totpEnabled
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {mfaStatus.totpEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Preferred Method:</span>
                <span className="font-medium text-gray-900">
                  {mfaStatus.preferredMethod === 'SMS'
                    ? 'SMS'
                    : mfaStatus.preferredMethod === 'TOTP'
                      ? 'Authenticator App'
                      : 'None'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="mb-4 text-lg font-semibold">Setup MFA Methods</h3>
            <div className="space-y-4">
              <button
                onClick={() => setSelectedMethod('TOTP')}
                className="flex w-full items-center justify-between rounded-lg border p-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <svg
                      className="h-6 w-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Authenticator App (Recommended)</div>
                    <div className="text-sm text-gray-500">
                      Use Google Authenticator, Authy, or similar apps
                    </div>
                  </div>
                </div>
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              <button
                onClick={() => setSelectedMethod('SMS')}
                className="flex w-full items-center justify-between rounded-lg border p-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <svg
                      className="h-6 w-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">SMS Text Message</div>
                    <div className="text-sm text-gray-500">
                      Receive codes via text message to your phone
                    </div>
                  </div>
                </div>
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>

          {(mfaStatus.smsEnabled || mfaStatus.totpEnabled) && (
            <div className="rounded-lg border p-6">
              <h3 className="mb-4 text-lg font-semibold text-red-600">Danger Zone</h3>
              <button
                onClick={handleDisableMFA}
                className="rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
              >
                Disable All MFA Methods
              </button>
              <p className="mt-2 text-sm text-gray-600">
                This will remove all MFA protection from your account.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
