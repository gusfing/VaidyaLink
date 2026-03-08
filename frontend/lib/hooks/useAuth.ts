import { useState, useCallback, useEffect } from 'react';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { useSession } from './useSession';
import { sessionStorage, type CognitoTokens } from '@/lib/auth/session-storage';

interface AuthConfig {
  region: string;
  userPoolId: string;
  clientId: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface SignUpData {
  username: string;
  password: string;
  email: string;
  phone?: string;
  name?: string;
}

interface MFAChallenge {
  session: string;
  challengeName: 'SMS_MFA' | 'SOFTWARE_TOKEN_MFA';
  username: string;
}

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: any | null;
  mfaChallenge: MFAChallenge | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  confirmSignUp: (username: string, code: string) => Promise<void>;
  logout: () => void;
  forgotPassword: (username: string) => Promise<void>;
  resetPassword: (username: string, code: string, newPassword: string) => Promise<void>;
  respondToMFAChallenge: (code: string) => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

/**
 * Authentication hook with Cognito integration
 * Provides login, signup, password reset, and MFA functionality
 */
export function useAuth(): UseAuthReturn {
  const { tokens, isAuthenticated, refreshTokens, logout: sessionLogout, setTokens } = useSession();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MFAChallenge | null>(null);
  const [cognitoClient] = useState(() => {
    const config = getAuthConfig();
    return new CognitoIdentityProviderClient({ region: config.region });
  });

  /**
   * Load user data from token
   */
  useEffect(() => {
    if (tokens?.idToken) {
      try {
        const payload = JSON.parse(atob(tokens.idToken.split('.')[1]));
        setUser({
          id: payload.sub,
          username: payload['cognito:username'],
          email: payload.email,
          phone: payload.phone_number,
          name: payload.name,
        });
      } catch (err) {
        console.error('Failed to parse user from token:', err);
      }
    } else {
      setUser(null);
    }
  }, [tokens]);

  /**
   * Login with username and password
   */
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        setIsLoading(true);
        setError(null);

        const config = getAuthConfig();
        const command = new InitiateAuthCommand({
          AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
          ClientId: config.clientId,
          AuthParameters: {
            USERNAME: credentials.username,
            PASSWORD: credentials.password,
          },
        });

        const response = await cognitoClient.send(command);

        // Handle MFA challenge
        if (
          response.ChallengeName === 'SMS_MFA' ||
          response.ChallengeName === 'SOFTWARE_TOKEN_MFA'
        ) {
          setMfaChallenge({
            session: response.Session!,
            challengeName: response.ChallengeName,
            username: credentials.username,
          });
          return;
        }

        // Handle successful authentication
        if (response.AuthenticationResult) {
          const { IdToken, AccessToken, RefreshToken, ExpiresIn } = response.AuthenticationResult;

          if (!IdToken || !AccessToken || !RefreshToken) {
            throw new Error('Missing tokens in authentication response');
          }

          const expiresAt = Date.now() + (ExpiresIn || 3600) * 1000;

          const cognitoTokens: CognitoTokens = {
            idToken: IdToken,
            accessToken: AccessToken,
            refreshToken: RefreshToken,
            expiresAt,
          };

          setTokens(cognitoTokens);
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Login failed';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [cognitoClient, setTokens]
  );

  /**
   * Sign up new user
   */
  const signUp = useCallback(
    async (data: SignUpData) => {
      try {
        setIsLoading(true);
        setError(null);

        const config = getAuthConfig();
        const command = new SignUpCommand({
          ClientId: config.clientId,
          Username: data.username,
          Password: data.password,
          UserAttributes: [
            { Name: 'email', Value: data.email },
            ...(data.phone ? [{ Name: 'phone_number', Value: data.phone }] : []),
            ...(data.name ? [{ Name: 'name', Value: data.name }] : []),
          ],
        });

        await cognitoClient.send(command);
      } catch (err: any) {
        const errorMessage = err.message || 'Sign up failed';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [cognitoClient]
  );

  /**
   * Confirm sign up with verification code
   */
  const confirmSignUp = useCallback(
    async (username: string, code: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const config = getAuthConfig();
        const command = new ConfirmSignUpCommand({
          ClientId: config.clientId,
          Username: username,
          ConfirmationCode: code,
        });

        await cognitoClient.send(command);
      } catch (err: any) {
        const errorMessage = err.message || 'Confirmation failed';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [cognitoClient]
  );

  /**
   * Initiate forgot password flow
   */
  const forgotPassword = useCallback(
    async (username: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const config = getAuthConfig();
        const command = new ForgotPasswordCommand({
          ClientId: config.clientId,
          Username: username,
        });

        await cognitoClient.send(command);
      } catch (err: any) {
        const errorMessage = err.message || 'Password reset request failed';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [cognitoClient]
  );

  /**
   * Reset password with verification code
   */
  const resetPassword = useCallback(
    async (username: string, code: string, newPassword: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const config = getAuthConfig();
        const command = new ConfirmForgotPasswordCommand({
          ClientId: config.clientId,
          Username: username,
          ConfirmationCode: code,
          Password: newPassword,
        });

        await cognitoClient.send(command);
      } catch (err: any) {
        const errorMessage = err.message || 'Password reset failed';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [cognitoClient]
  );

  /**
   * Respond to MFA challenge
   */
  const respondToMFAChallenge = useCallback(
    async (code: string) => {
      if (!mfaChallenge) {
        throw new Error('No MFA challenge in progress');
      }

      try {
        setIsLoading(true);
        setError(null);

        const config = getAuthConfig();
        const { createMFAService } = await import('@/lib/auth/mfa-service');
        const mfaService = createMFAService();

        const response = await mfaService.respondToMFAChallenge(
          mfaChallenge.challengeName,
          mfaChallenge.session,
          code,
          mfaChallenge.username
        );

        if (response.AuthenticationResult) {
          const { IdToken, AccessToken, RefreshToken, ExpiresIn } = response.AuthenticationResult;

          if (!IdToken || !AccessToken || !RefreshToken) {
            throw new Error('Missing tokens in MFA response');
          }

          const expiresAt = Date.now() + (ExpiresIn || 3600) * 1000;

          const cognitoTokens: CognitoTokens = {
            idToken: IdToken,
            accessToken: AccessToken,
            refreshToken: RefreshToken,
            expiresAt,
          };

          setTokens(cognitoTokens);
          setMfaChallenge(null);
        }
      } catch (err: any) {
        const errorMessage = err.message || 'MFA verification failed';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [mfaChallenge, setTokens]
  );

  /**
   * Logout user
   */
  const logout = useCallback(() => {
    sessionLogout();
    setUser(null);
    setMfaChallenge(null);
    setError(null);
  }, [sessionLogout]);

  /**
   * Refresh session
   */
  const refreshSession = useCallback(async () => {
    try {
      setError(null);
      return await refreshTokens();
    } catch (err: any) {
      setError(err.message || 'Session refresh failed');
      return false;
    }
  }, [refreshTokens]);

  return {
    isAuthenticated,
    isLoading,
    error,
    user,
    mfaChallenge,
    login,
    signUp,
    confirmSignUp,
    logout,
    forgotPassword,
    resetPassword,
    respondToMFAChallenge,
    refreshSession,
  };
}

/**
 * Get auth configuration from environment
 */
function getAuthConfig(): AuthConfig {
  return {
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-south-1',
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
  };
}
