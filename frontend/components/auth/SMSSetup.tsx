'use client';

import { useState } from 'react';
import { createMFAService } from '@/lib/auth/mfa-service';

interface SMSSetupProps {
  accessToken: string;
  onComplete: () => void;
  onCancel: () => void;
}

/**
 * SMS MFA Setup Component
 * Enables SMS-based multi-factor authentication
 */
export function SMSSetup({ accessToken, onComplete, onCancel }: SMSSetupProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mfaService = createMFAService();

  const handleEnable = async () => {
    try {
      setLoading(true);
      setError(null);
      await mfaService.enableSMSMFA(accessToken);
      onComplete();
    } catch (err) {
      setError(
        'Failed to enable SMS MFA. Please ensure your phone number is verified in your account settings.'
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-2xl font-bold">Setup SMS Authentication</h2>

      <div className="space-y-6">
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 font-semibold text-blue-900">How SMS MFA works:</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-blue-800">
            <li>When you sign in, we'll send a verification code to your phone</li>
            <li>Enter the code to complete your login</li>
            <li>Codes expire after a few minutes for security</li>
          </ul>
        </div>

        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="mb-2 font-semibold text-yellow-900">Requirements:</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-yellow-800">
            <li>You must have a verified phone number on your account</li>
            <li>Standard SMS rates may apply from your carrier</li>
            <li>Ensure you have cellular reception when signing in</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-2 font-semibold text-gray-900">Note:</h3>
          <p className="text-sm text-gray-700">
            We recommend using an authenticator app instead of SMS for better security. SMS messages
            can be intercepted, while authenticator apps generate codes locally on your device.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
        )}

        <div className="flex space-x-4">
          <button
            onClick={handleEnable}
            disabled={loading}
            className="flex-1 rounded-md bg-green-600 px-6 py-3 text-white transition-colors hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? 'Enabling...' : 'Enable SMS MFA'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-6 py-3 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
