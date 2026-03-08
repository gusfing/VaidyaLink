'use client';

/**
 * AuthWrapper Component
 *
 * Manages authentication state and protects routes.
 * Checks for valid Cognito session on mount and redirects to login if unauthenticated.
 * Provides authentication context to child components.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';
import type { CognitoUser } from '@/lib/document-scan-demo/types';
import LoadingSpinner from './LoadingSpinner';

// Import Amplify configuration
import '@/lib/document-scan-demo/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  user: CognitoUser | null;
  isLoading: boolean;
  signIn: typeof signIn;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthWrapperProps {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check if authentication should be skipped (MVP mode) - CHECK THIS FIRST
      const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

      if (skipAuth) {
        console.log('SKIP_AUTH enabled - bypassing authentication');
        // Skip authentication: Use mock user but still call real AWS backend
        setUser({
          username: 'test-user',
          email: 'test@example.com',
          attributes: {
            name: 'Test User',
          },
        });
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // Check if demo mode is enabled (uses mock data)
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

      if (isDemoMode) {
        console.log('DEMO_MODE enabled - using mock data');
        // Demo mode: Skip authentication and use mock user
        setUser({
          username: 'demo-user',
          email: 'demo@example.com',
          attributes: {
            name: 'Demo User',
          },
        });
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // Real mode: Check for valid Cognito session
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();

      if (currentUser && session.tokens) {
        // User is authenticated
        setUser({
          username: currentUser.username,
          email: currentUser.signInDetails?.loginId || '',
          attributes: {},
        });
        setIsAuthenticated(true);
      } else {
        // No valid session
        handleUnauthenticated();
      }
    } catch (error) {
      // Error checking auth status (likely not authenticated)
      console.error('Auth check error:', error);

      // If SKIP_AUTH or DEMO_MODE, don't redirect to login
      const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

      if (skipAuth || isDemoMode) {
        console.log('Auth error but SKIP_AUTH/DEMO_MODE enabled - proceeding anyway');
        setUser({
          username: 'test-user',
          email: 'test@example.com',
          attributes: {
            name: 'Test User',
          },
        });
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      handleUnauthenticated();
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnauthenticated = () => {
    setIsAuthenticated(false);
    setUser(null);

    // Redirect to login if not already on login page
    if (pathname !== '/login' && pathname !== '/document-scan-demo/login') {
      console.log('Redirecting to login: User not authenticated');
      router.push('/document-scan-demo/login');
    }
  };

  const handleSignOut = async () => {
    try {
      // Check if authentication should be skipped
      const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

      if (!skipAuth && !isDemoMode) {
        // Real mode: Sign out from Cognito
        await signOut();
      }

      // Clear state and redirect
      setIsAuthenticated(false);
      setUser(null);
      router.push('/document-scan-demo/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const contextValue: AuthContextType = {
    isAuthenticated,
    user,
    isLoading,
    signIn,
    signOut: handleSignOut,
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return <LoadingSpinner fullPage message="Loading..." />;
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context
 * Must be used within AuthWrapper
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthWrapper');
  }
  return context;
}
