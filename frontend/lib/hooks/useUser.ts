import { useState, useEffect, useCallback } from 'react';
import { useSession } from './useSession';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  UpdateUserAttributesCommand,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';

/**
 * User roles from RBAC system
 */
export type UserRole = 'Patient' | 'HealthcareProvider' | 'Admin' | 'HITLVerifier';

/**
 * User profile information
 */
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  name?: string;
  roles: UserRole[];
  abhaId?: string;
  preferredLanguage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User permissions from RBAC system
 */
export interface UserPermissions {
  canUploadScans: boolean;
  canReadOwnScans: boolean;
  canReadAllScans: boolean;
  canDeleteOwnScans: boolean;
  canDeleteAllScans: boolean;
  canUploadVoice: boolean;
  canReadOwnRecords: boolean;
  canReadAllRecords: boolean;
  canWriteOwnRecords: boolean;
  canWriteAllRecords: boolean;
  canExportRecords: boolean;
  canLinkABDM: boolean;
  canFetchABDM: boolean;
  canPushABDM: boolean;
  canManageConsent: boolean;
  canViewHITLQueue: boolean;
  canVerifyHITL: boolean;
  canAssignHITL: boolean;
  canManageUsers: boolean;
  canViewAudit: boolean;
  canConfigureSystem: boolean;
}

/**
 * User update data
 */
export interface UserUpdateData {
  name?: string;
  phone?: string;
  preferredLanguage?: string;
}

interface UseUserReturn {
  user: UserProfile | null;
  permissions: UserPermissions | null;
  isLoading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  updateProfile: (data: UserUpdateData) => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasPermission: (permission: keyof UserPermissions) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasAllRoles: (roles: UserRole[]) => boolean;
}

/**
 * Hook for accessing and managing current user information
 * Provides user profile, roles, permissions, and profile management
 */
export function useUser(): UseUserReturn {
  const { tokens, isAuthenticated } = useSession();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cognitoClient] = useState(() => {
    const config = getAuthConfig();
    return new CognitoIdentityProviderClient({ region: config.region });
  });

  /**
   * Parse user data from ID token
   */
  const parseUserFromToken = useCallback((idToken: string): Partial<UserProfile> => {
    try {
      const payload = JSON.parse(atob(idToken.split('.')[1]));

      const roles: UserRole[] = [];
      const cognitoGroups = payload['cognito:groups'] || [];

      // Map Cognito groups to roles
      if (cognitoGroups.includes('Patient')) roles.push('Patient');
      if (cognitoGroups.includes('HealthcareProvider')) roles.push('HealthcareProvider');
      if (cognitoGroups.includes('Admin')) roles.push('Admin');
      if (cognitoGroups.includes('HITLVerifier')) roles.push('HITLVerifier');

      // Default to Patient role if no roles assigned
      if (roles.length === 0) {
        roles.push('Patient');
      }

      return {
        id: payload.sub,
        username: payload['cognito:username'],
        email: payload.email,
        emailVerified: payload.email_verified === true,
        phone: payload.phone_number,
        phoneVerified: payload.phone_number_verified === true,
        name: payload.name,
        roles,
        abhaId: payload['custom:abha_id'],
        preferredLanguage: payload['custom:preferred_language'] || 'en',
      };
    } catch (err) {
      console.error('Failed to parse user from token:', err);
      return {};
    }
  }, []);

  /**
   * Calculate permissions based on user roles
   */
  const calculatePermissions = useCallback((roles: UserRole[]): UserPermissions => {
    const isAdmin = roles.includes('Admin');
    const isProvider = roles.includes('HealthcareProvider');
    const isVerifier = roles.includes('HITLVerifier');
    const isPatient = roles.includes('Patient');

    return {
      // Scan permissions
      canUploadScans: isAdmin || isProvider || isPatient,
      canReadOwnScans: isAdmin || isProvider || isPatient,
      canReadAllScans: isAdmin || isProvider || isVerifier,
      canDeleteOwnScans: isAdmin || isPatient,
      canDeleteAllScans: isAdmin,

      // Voice permissions
      canUploadVoice: isAdmin || isProvider || isPatient,

      // Record permissions
      canReadOwnRecords: isAdmin || isProvider || isPatient,
      canReadAllRecords: isAdmin || isProvider || isVerifier,
      canWriteOwnRecords: isAdmin || isProvider || isPatient,
      canWriteAllRecords: isAdmin || isProvider,
      canExportRecords: isAdmin || isProvider || isPatient,

      // ABDM permissions
      canLinkABDM: isAdmin || isPatient,
      canFetchABDM: isAdmin || isProvider || isPatient,
      canPushABDM: isAdmin || isProvider,
      canManageConsent: isAdmin || isProvider || isPatient,

      // HITL permissions
      canViewHITLQueue: isAdmin || isVerifier,
      canVerifyHITL: isAdmin || isVerifier,
      canAssignHITL: isAdmin,

      // Admin permissions
      canManageUsers: isAdmin,
      canViewAudit: isAdmin,
      canConfigureSystem: isAdmin,
    };
  }, []);

  /**
   * Fetch full user profile from Cognito
   */
  const fetchUserProfile = useCallback(async () => {
    if (!tokens?.accessToken) {
      setUser(null);
      setPermissions(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const command = new GetUserCommand({
        AccessToken: tokens.accessToken,
      });

      const response = await cognitoClient.send(command);

      // Parse basic info from token
      const tokenData = parseUserFromToken(tokens.idToken);

      // Extract attributes from Cognito response
      const attributes: Record<string, string> = {};
      response.UserAttributes?.forEach((attr) => {
        if (attr.Name && attr.Value) {
          attributes[attr.Name] = attr.Value;
        }
      });

      // Build complete user profile
      const userProfile: UserProfile = {
        id: tokenData.id || '',
        username: response.Username || tokenData.username || '',
        email: attributes.email || tokenData.email || '',
        emailVerified: attributes.email_verified === 'true',
        phone: attributes.phone_number || tokenData.phone,
        phoneVerified: attributes.phone_number_verified === 'true',
        name: attributes.name || tokenData.name,
        roles: tokenData.roles || ['Patient'],
        abhaId: attributes['custom:abha_id'] || tokenData.abhaId,
        preferredLanguage:
          attributes['custom:preferred_language'] || tokenData.preferredLanguage || 'en',
        createdAt: (response as any).UserCreateDate,
        updatedAt: (response as any).UserLastModifiedDate,
      };

      setUser(userProfile);
      setPermissions(calculatePermissions(userProfile.roles));
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch user profile';
      setError(errorMessage);
      console.error('Failed to fetch user profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tokens, cognitoClient, parseUserFromToken, calculatePermissions]);

  /**
   * Load user data when authenticated
   */
  useEffect(() => {
    if (isAuthenticated && tokens?.idToken) {
      fetchUserProfile();
    } else {
      setUser(null);
      setPermissions(null);
    }
  }, [isAuthenticated, tokens?.idToken, fetchUserProfile]);

  /**
   * Refresh user profile
   */
  const refreshUser = useCallback(async () => {
    await fetchUserProfile();
  }, [fetchUserProfile]);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(
    async (data: UserUpdateData) => {
      if (!tokens?.accessToken) {
        throw new Error('Not authenticated');
      }

      try {
        setIsLoading(true);
        setError(null);

        const attributes: AttributeType[] = [];

        if (data.name !== undefined) {
          attributes.push({ Name: 'name', Value: data.name });
        }

        if (data.phone !== undefined) {
          attributes.push({ Name: 'phone_number', Value: data.phone });
        }

        if (data.preferredLanguage !== undefined) {
          attributes.push({ Name: 'custom:preferred_language', Value: data.preferredLanguage });
        }

        if (attributes.length === 0) {
          return; // Nothing to update
        }

        const command = new UpdateUserAttributesCommand({
          AccessToken: tokens.accessToken,
          UserAttributes: attributes,
        });

        await cognitoClient.send(command);

        // Refresh user profile after update
        await fetchUserProfile();
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to update profile';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [tokens, cognitoClient, fetchUserProfile]
  );

  /**
   * Check if user has a specific role
   */
  const hasRole = useCallback(
    (role: UserRole): boolean => {
      return user?.roles.includes(role) || false;
    },
    [user]
  );

  /**
   * Check if user has a specific permission
   */
  const hasPermission = useCallback(
    (permission: keyof UserPermissions): boolean => {
      return permissions?.[permission] || false;
    },
    [permissions]
  );

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = useCallback(
    (roles: UserRole[]): boolean => {
      return roles.some((role) => user?.roles.includes(role)) || false;
    },
    [user]
  );

  /**
   * Check if user has all of the specified roles
   */
  const hasAllRoles = useCallback(
    (roles: UserRole[]): boolean => {
      return roles.every((role) => user?.roles.includes(role)) || false;
    },
    [user]
  );

  return {
    user,
    permissions,
    isLoading,
    error,
    refreshUser,
    updateProfile,
    hasRole,
    hasPermission,
    hasAnyRole,
    hasAllRoles,
  };
}

/**
 * Get auth configuration from environment
 */
function getAuthConfig() {
  return {
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-south-1',
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
  };
}
