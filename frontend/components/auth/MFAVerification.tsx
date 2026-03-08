'use client';

import { useState } from 'react';
import { createMFAService } from '@/lib/auth/mfa-service';

interface MFAVerificationProps {
  challengeName: 'SMS_MFA' | 'SOFTWARE_TOKEN_MFA';
  session: string;
  username: string;
  onSuccess: (response: any) => void;
  onCancel?: () => void;
}

/**
 * MFA Verification Component
 * Handles MFA code verification during login
 */
export function MFAVerification({
  challengeName,
  session,
  username,
  onSuccess,
  onCancel,
}: MFAVerificationProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mfaService = createMFAService();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await mfaService.respondToMFAChallenge(
        challengeName,
        session,
        code,
        username
      );
      onSuccess(response);
    } catch (err) {
      setError('Invalid verification code. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isSMS = challengeName === 'SMS_MFA';
  const methodName = isSMS ? 'SMS' : 'Authenticator App';

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          {isSMS ? (
            <svg
              className="h-8 w-8 text-blue-600"
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
          ) : (
            <svg
              className="h-8 w-8 text-blue-600"
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
          )}
        </div>
        <h2 className="mb-2 text-2xl font-bold">Verify Your Identity</h2>
        <p className="text-gray-600">
          {isSMS
            ? 'Enter the 6-digit code sent to your phone'
            : 'Enter the 6-digit code from your authenticator app'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="mfa-code" className="mb-2 block text-sm font-medium text-gray-700">
            Verification Code
          </label>
          <input
            type="text"
            id="mfa-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full rounded-md border border-gray-300 px-4 py-3 text-center font-mono text-2xl tracking-widest focus:border-transparent focus:ring-2 focus:ring-blue-500"
            maxLength={6}
            autoComplete="off"
            autoFocus
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full rounded-md bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-md border border-gray-300 px-6 py-3 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          {isSMS ? (
            <>
              Didn't receive a code?{' '}
              <button className="font-medium text-blue-600 hover:text-blue-700">Resend Code</button>
            </>
          ) : (
            <>
              Having trouble?{' '}
              <a href="/help/mfa" className="font-medium text-blue-600 hover:text-blue-700">
                Get Help
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
