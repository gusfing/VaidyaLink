/**
 * AWS Amplify Authentication Configuration
 *
 * This file configures AWS Amplify for Cognito authentication.
 * Configuration is read from environment variables.
 */

import { Amplify } from 'aws-amplify';

/**
 * Configure AWS Amplify with Cognito settings from environment variables
 *
 * Environment variables required:
 * - NEXT_PUBLIC_COGNITO_USER_POOL_ID: Cognito User Pool ID
 * - NEXT_PUBLIC_COGNITO_CLIENT_ID: Cognito App Client ID
 * - NEXT_PUBLIC_COGNITO_REGION: AWS Region for Cognito
 */
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
      loginWith: {
        email: true,
        username: true,
      },
    },
  },
});

export { Amplify };
