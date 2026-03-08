/**
 * Client-side request signing utilities for VaidyaLink
 *
 * Used to sign sensitive API requests before sending to backend
 */

import crypto from 'crypto';

export interface SignRequestParams {
  method: string;
  path: string;
  body?: any;
  secret: string;
}

export interface SignedHeaders {
  'X-VaidyaLink-Signature': string;
  'X-VaidyaLink-Timestamp': string;
}

/**
 * Generate HMAC-SHA256 signature for request
 */
export function generateSignature(params: SignRequestParams): string {
  const { method, path, body, secret } = params;
  const timestamp = Math.floor(Date.now() / 1000);

  // Normalize body
  const normalizedBody = body ? JSON.stringify(body) : '{}';

  // Create canonical string
  const canonicalString = [method.toUpperCase(), path, timestamp.toString(), normalizedBody].join(
    '\n'
  );

  // Generate HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(canonicalString);
  return hmac.digest('hex');
}

/**
 * Generate signed headers for API request
 */
export function generateSignedHeaders(params: SignRequestParams): SignedHeaders {
  const { method, path, body, secret } = params;
  const timestamp = Math.floor(Date.now() / 1000);

  // Normalize body
  const normalizedBody = body ? JSON.stringify(body) : '{}';

  // Create canonical string
  const canonicalString = [method.toUpperCase(), path, timestamp.toString(), normalizedBody].join(
    '\n'
  );

  // Generate signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(canonicalString);
  const signature = hmac.digest('hex');

  return {
    'X-VaidyaLink-Signature': signature,
    'X-VaidyaLink-Timestamp': timestamp.toString(),
  };
}

/**
 * Check if an operation requires request signing
 */
export function requiresSignature(path: string): boolean {
  const sensitiveOperations = ['/delete', '/update', '/export', '/abdm/consent', '/patients/merge'];

  return sensitiveOperations.some((op) => path.includes(op));
}

/**
 * Get user's signing secret from secure storage
 * In production, this should be retrieved from a secure backend endpoint
 */
export async function getUserSigningSecret(): Promise<string> {
  // TODO: Implement secure secret retrieval
  // This is a placeholder - in production, retrieve from backend

  const storedSecret = sessionStorage.getItem('vaidyalink_signing_secret');

  if (!storedSecret) {
    throw new Error('Signing secret not found. Please re-authenticate.');
  }

  return storedSecret;
}

/**
 * Store user's signing secret securely
 * Called after successful authentication
 */
export function storeUserSigningSecret(secret: string): void {
  // Store in sessionStorage (cleared on tab close)
  sessionStorage.setItem('vaidyalink_signing_secret', secret);
}

/**
 * Clear user's signing secret
 * Called on logout
 */
export function clearUserSigningSecret(): void {
  sessionStorage.removeItem('vaidyalink_signing_secret');
}
