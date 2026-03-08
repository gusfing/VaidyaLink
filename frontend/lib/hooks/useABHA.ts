import { useState, useEffect, useCallback } from 'react';
import {
  createABHAService,
  type ABHALinkStatus,
  type ABHAOTPResponse,
  type ABHAVerificationResponse,
} from '@/lib/auth/abha-service';

interface UseABHAOptions {
  accessToken: string | null;
  autoLoad?: boolean;
}

/**
 * React hook for managing ABHA ID operations
 */
export function useABHA({ accessToken, autoLoad = true }: UseABHAOptions) {
  const [linkStatus, setLinkStatus] = useState<ABHALinkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpTxnId, setOtpTxnId] = useState<string | null>(null);

  const abhaService = createABHAService();

  const loadLinkStatus = useCallback(async () => {
    if (!accessToken) {
      setLinkStatus(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const status = await abhaService.getLinkStatus(accessToken);
      setLinkStatus(status);
    } catch (err) {
      setError('Failed to load ABHA link status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (autoLoad && accessToken) {
      loadLinkStatus();
    }
  }, [accessToken, autoLoad, loadLinkStatus]);

  const validateABHAId = useCallback((abhaId: string): boolean => {
    return abhaService.validateABHAId(abhaId);
  }, []);

  const requestOTP = useCallback(async (abhaId: string): Promise<ABHAOTPResponse> => {
    try {
      setLoading(true);
      setError(null);
      const response = await abhaService.requestOTP(abhaId);
      setOtpTxnId(response.txnId);
      return response;
    } catch (err: any) {
      setError(err.message || 'Failed to request OTP');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyAndLink = useCallback(
    async (abhaId: string, otp: string, txnId?: string): Promise<ABHAVerificationResponse> => {
      if (!accessToken) {
        throw new Error('Access token is required');
      }

      const transactionId = txnId || otpTxnId;
      if (!transactionId) {
        throw new Error('Transaction ID is required. Please request OTP first.');
      }

      try {
        setLoading(true);
        setError(null);
        const response = await abhaService.verifyAndLink(abhaId, otp, transactionId, accessToken);
        await loadLinkStatus();
        setOtpTxnId(null);
        return response;
      } catch (err: any) {
        setError(err.message || 'Failed to verify and link ABHA ID');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken, otpTxnId, loadLinkStatus]
  );

  const unlinkABHA = useCallback(async () => {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    try {
      setLoading(true);
      setError(null);
      await abhaService.unlinkABHA(accessToken);
      await loadLinkStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to unlink ABHA ID');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [accessToken, loadLinkStatus]);

  const fetchABDMRecords = useCallback(async () => {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    try {
      setLoading(true);
      setError(null);
      const records = await abhaService.fetchABDMRecords(accessToken);
      return records;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch ABDM records');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  return {
    linkStatus,
    loading,
    error,
    otpTxnId,
    loadLinkStatus,
    validateABHAId,
    requestOTP,
    verifyAndLink,
    unlinkABHA,
    fetchABDMRecords,
  };
}
