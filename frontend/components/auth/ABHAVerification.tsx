'use client';

import { useState, useEffect } from 'react';
import { useABHA } from '@/lib/hooks/useABHA';

interface ABHAVerificationProps {
  abhaId: string;
  accessToken: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

/**
 * ABHA OTP Verification Component
 * Handles OTP request and verification for ABHA ID linking
 */
export function ABHAVerification({
  abhaId,
  accessToken,
  onComplete,
  onCancel,
}: ABHAVerificationProps) {
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 minutes
  const [canResend, setCanResend] = useState(false);

  const { loading, error, otpTxnId, requestOTP, verifyAndLink } = useABHA({
    accessToken,
    autoLoad: false,
  });

  useEffect(() => {
    // Send OTP on component mount
    handleSendOTP();
  }, []);

  useEffect(() => {
    if (!otpSent || countdown <= 0) {
      if (countdown <= 0) {
        setCanResend(true);
      }
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [otpSent, countdown]);

  const handleSendOTP = async () => {
    try {
      await requestOTP(abhaId);
      setOtpSent(true);
      setCountdown(600);
      setCanResend(false);
    } catch (err) {
      console.error('Failed to send OTP:', err);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      return;
    }

    try {
      await verifyAndLink(abhaId, otp);
      onComplete?.();
    } catch (err) {
      console.error('Failed to verify OTP:', err);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Verify ABHA ID</h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter the OTP sent to your registered mobile number
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm">
          <span className="text-gray-600">ABHA ID:</span>
          <span className="ml-2 font-mono font-medium text-gray-900">{abhaId}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {otpSent && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          OTP has been sent to your registered mobile number
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
            Enter OTP
          </label>
          <input
            type="text"
            id="otp"
            value={otp}
            onChange={handleOtpChange}
            placeholder="000000"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-center font-mono text-2xl tracking-widest shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            maxLength={6}
            disabled={loading}
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-gray-500">6-digit OTP</span>
            {countdown > 0 && (
              <span className="font-medium text-gray-700">Expires in {formatTime(countdown)}</span>
            )}
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleVerify}
            disabled={otp.length !== 6 || loading}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Verifying...
              </span>
            ) : (
              'Verify & Link'
            )}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={loading}
              className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
          )}
        </div>

        <div className="text-center">
          {canResend ? (
            <button
              onClick={handleSendOTP}
              disabled={loading}
              className="text-sm text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Resend OTP
            </button>
          ) : (
            <span className="text-sm text-gray-500">
              Didn't receive OTP? You can resend after {formatTime(countdown)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <div className="flex items-start space-x-3">
          <svg
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="text-sm text-yellow-800">
            <p className="font-medium">Security Notice</p>
            <p className="mt-1">
              Never share your OTP with anyone. VaidyaLink will never ask for your OTP over phone or
              email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
