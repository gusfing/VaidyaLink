// Export all handlers for Lambda deployment
export { handler as createKey } from './handlers/create-key';
export { handler as listKeys } from './handlers/list-keys';
export { handler as revokeKey } from './handlers/revoke-key';
export { handler as rotateKey } from './handlers/rotate-key';

// Export middleware
export { validateApiKey, withApiKeyValidation } from './middleware/api-key-validator';
