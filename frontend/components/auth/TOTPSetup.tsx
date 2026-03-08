'use client';

import { useState } from 'react';
import { createMFAService } from '@/lib/auth/mfa-service';

interface TOTPSetupProps {
  accessToken: string;
  onComplete: () => void;
  onCancel: () => void;
}

/**
 * TOTP (Authenticator App) Setup Component
 * Guides users through setting up authenticator app MFA
 */
export function TOTPSetup({ accessToken, onComplete, onCancel }: TOTPSetupProps) {
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [secretCode, setSecretCode] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<string | undefined>();

  const mfaService = createMFAService();

  const handleSetup = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await mfaService.setupTOTP(accessToken);
      setSecretCode(response.secretCode);
      setQrCodeUrl(response.qrCodeUrl);
      setSession(response.session);
      setStep('verify');
    } catch (err) {
      setError('Failed to setup authenticator app');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await mfaService.verifyTOTP(accessToken, verificationCode, session);
      await mfaService.setMFAPreference(accessToken, 'TOTP');
      onComplete();
    } catch (err) {
      setError('Invalid verification code. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(secretCode);
    alert('Secret code copied to clipboard!');
  };

  if (step === 'setup') {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h2 className="mb-6 text-2xl font-bold">Setup Authenticator App</h2>

        <div className="space-y-6">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 font-semibold text-blue-900">What you'll need:</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-blue-800">
              <li>
                An authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
              </li>
              <li>Your smartphone or tablet</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Steps:</h3>
            <ol className="list-inside list-decimal space-y-2 text-gray-700">
              <li>Download an authenticator app if you don't have one</li>
              <li>Click "Generate QR Code" below</li>
              <li>Scan the QR code with your authenticator app</li>
              <li>Enter the 6-digit code from your app to verify</li>
            </ol>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
              {error}
            </div>
          )}

          <div className="flex space-x-4">
            <button
              onClick={handleSetup}
              disabled={loading}
              className="flex-1 rounded-md bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Generating...' : 'Generate QR Code'}
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

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-2xl font-bold">Scan QR Code</h2>

      <div className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}`}
              alt="QR Code for authenticator app"
              className="h-48 w-48"
            />
          </div>

          <div className="text-center">
            <p className="mb-2 text-sm text-gray-600">
              Can't scan the QR code? Enter this code manually:
            </p>
            <div className="flex items-center space-x-2">
              <code className="rounded bg-gray-100 px-4 py-2 font-mono text-sm">{secretCode}</code>
              <button
                onClick={copyToClipboard}
                className="rounded bg-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-300"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label htmlFor="code" className="mb-2 block text-sm font-medium text-gray-700">
              Enter the 6-digit code from your authenticator app:
            </label>
            <input
              type="text"
              id="code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-md border border-gray-300 px-4 py-3 text-center font-mono text-2xl tracking-widest focus:border-transparent focus:ring-2 focus:ring-blue-500"
              maxLength={6}
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
              {error}
            </div>
          )}

          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="flex-1 rounded-md bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Verifying...' : 'Verify and Enable'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 px-6 py-3 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            <strong>Important:</strong> Save your secret code in a secure location. You'll need it
            if you lose access to your authenticator app.
          </p>
        </div>
      </div>
    </div>
  );
}
