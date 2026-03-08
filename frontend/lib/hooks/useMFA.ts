import { useState, useEffect, useCallback } from 'react';
import { createMFAService, type MFAStatus, type MFAMethod } from '@/lib/auth/mfa-service';

interface UseMFAOptions {
  accessToken: string | null;
  autoLoad?: boolean;
}

/**
 * React hook for managing MFA operations
 */
export function useMFA({ accessToken, autoLoad = true }: UseMFAOptions) {
  const [mfaStatus, setMFAStatus] = useState<MFAStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mfaService = createMFAService();

  const loadMFAStatus = useCallback(async () => {
    if (!accessToken) {
      setMFAStatus(null);
      return;
    }

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
  }, [accessToken]);

  useEffect(() => {
    if (autoLoad && accessToken) {
      loadMFAStatus();
    }
  }, [accessToken, autoLoad, loadMFAStatus]);

  const setupTOTP = useCallback(async () => {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    try {
      setLoading(true);
      setError(null);
      const response = await mfaService.setupTOTP(accessToken);
      return response;
    } catch (err) {
      setError('Failed to setup TOTP');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const verifyTOTP = useCallback(
    async (code: string, session?: string) => {
      if (!accessToken) {
        throw new Error('Access token is required');
      }

      try {
        setLoading(true);
        setError(null);
        await mfaService.verifyTOTP(accessToken, code, session);
        await loadMFAStatus();
      } catch (err) {
        setError('Invalid verification code');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken, loadMFAStatus]
  );

  const enableSMSMFA = useCallback(async () => {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    try {
      setLoading(true);
      setError(null);
      await mfaService.enableSMSMFA(accessToken);
      await loadMFAStatus();
    } catch (err) {
      setError('Failed to enable SMS MFA');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [accessToken, loadMFAStatus]);

  const setMFAPreference = useCallback(
    async (method: MFAMethod) => {
      if (!accessToken) {
        throw new Error('Access token is required');
      }

      try {
        setLoading(true);
        setError(null);
        await mfaService.setMFAPreference(accessToken, method);
        await loadMFAStatus();
      } catch (err) {
        setError('Failed to update MFA preference');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken, loadMFAStatus]
  );

  const disableMFA = useCallback(async () => {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    try {
      setLoading(true);
      setError(null);
      await mfaService.disableMFA(accessToken);
      await loadMFAStatus();
    } catch (err) {
      setError('Failed to disable MFA');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [accessToken, loadMFAStatus]);

  const respondToMFAChallenge = useCallback(
    async (
      challengeName: 'SMS_MFA' | 'SOFTWARE_TOKEN_MFA',
      session: string,
      code: string,
      username: string
    ) => {
      try {
        setLoading(true);
        setError(null);
        const response = await mfaService.respondToMFAChallenge(
          challengeName,
          session,
          code,
          username
        );
        return response;
      } catch (err) {
        setError('Invalid MFA code');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    mfaStatus,
    loading,
    error,
    loadMFAStatus,
    setupTOTP,
    verifyTOTP,
    enableSMSMFA,
    setMFAPreference,
    disableMFA,
    respondToMFAChallenge,
  };
}
