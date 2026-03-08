# API Key Management - Quick Start Guide

This guide helps you quickly get started with VaidyaLink's API key management system for external integrations.

## Overview

VaidyaLink's API key management system provides secure authentication for external integrations with:

- **Three usage tiers**: Standard, Healthcare Provider, and Enterprise
- **Automatic rate limiting** based on tier
- **Key rotation** for enhanced security
- **Usage tracking** and CloudWatch metrics
- **RBAC controls** - only admins can manage keys

## Prerequisites

- Admin role in VaidyaLink system
- AWS CLI configured (for infrastructure deployment)
- Valid Cognito authentication token

## Quick Start

### 1. Create an API Key

**Request:**

```bash
curl -X POST https://api.vaidyalink.com/api/v1/keys \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "external-integration",
    "description": "API key for external partner integration",
    "tier": "Standard",
    "permissions": ["scans:read", "patients:read"],
    "expiresInDays": 365
  }'
```

**Response:**

```json
{
  "keyId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "vl_live_abc123def456...",
  "name": "external-integration",
  "tier": "Standard",
  "createdAt": "2024-01-15T10:30:00Z",
  "expiresAt": "2025-01-15T10:30:00Z",
  "message": "API key created successfully. Store the API key securely - it will not be shown again."
}
```

⚠️ **Important**: Save the `apiKey` value immediately - it will not be shown again!

### 2. Use the API Key

Include the API key in the `X-API-Key` header:

```bash
curl -X GET https://api.vaidyalink.com/api/v1/patients/123/records \
  -H "X-API-Key: vl_live_abc123def456..."
```

### 3. List Your API Keys

```bash
curl -X GET https://api.vaidyalink.com/api/v1/keys \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN"
```

**Response:**

```json
{
  "keys": [
    {
      "keyId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "external-integration",
      "tier": "Standard",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z",
      "expiresAt": "2025-01-15T10:30:00Z",
      "lastUsedAt": "2024-01-20T14:22:00Z",
      "requestCount": 1523
    }
  ],
  "count": 1
}
```

### 4. Rotate an API Key

Rotate keys regularly for security:

```bash
curl -X POST https://api.vaidyalink.com/api/v1/keys/550e8400-e29b-41d4-a716-446655440000/rotate \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deleteOldKey": true
  }'
```

**Response:**

```json
{
  "keyId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "vl_live_xyz789ghi012...",
  "name": "external-integration",
  "tier": "Standard",
  "rotatedAt": "2024-06-15T10:30:00Z",
  "previousKeyDeleted": true,
  "message": "API key rotated successfully. Store the new API key securely - it will not be shown again."
}
```

### 5. Revoke an API Key

Revoke compromised or unused keys:

```bash
curl -X DELETE https://api.vaidyalink.com/api/v1/keys/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_COGNITO_TOKEN"
```

**Response:**

```json
{
  "keyId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "API key revoked successfully",
  "revokedAt": "2024-01-20T15:00:00Z"
}
```

## Usage Tiers

### Standard Tier

- **Rate Limit**: 100 requests/minute
- **Burst**: 200 requests
- **Monthly Quota**: 100,000 requests
- **Use Case**: Small integrations, testing

### Healthcare Provider Tier

- **Rate Limit**: 1,000 requests/minute
- **Burst**: 2,000 requests
- **Monthly Quota**: 1,000,000 requests
- **Use Case**: Hospital systems, clinic integrations

### Enterprise Tier

- **Rate Limit**: 5,000 requests/minute
- **Burst**: 10,000 requests
- **Monthly Quota**: 10,000,000 requests
- **Use Case**: Large-scale integrations, national health systems

## Permissions

Available permissions for API keys:

- `scans:read` - Read scan results
- `scans:write` - Create new scans
- `patients:read` - Read patient records
- `patients:write` - Update patient records
- `voice:read` - Read voice transcriptions
- `voice:write` - Create voice recordings
- `fhir:read` - Read FHIR resources
- `fhir:export` - Export FHIR bundles
- `abdm:read` - Read ABDM records
- `abdm:write` - Push to ABDM

## Error Handling

### Common Error Responses

**401 Unauthorized - Missing API Key**

```json
{
  "message": "Missing API key"
}
```

**401 Unauthorized - Invalid API Key**

```json
{
  "message": "Invalid API key"
}
```

**401 Unauthorized - Expired API Key**

```json
{
  "message": "API key has expired"
}
```

**403 Forbidden - Insufficient Permissions**

```json
{
  "message": "Insufficient permissions",
  "required": ["scans:write"]
}
```

**429 Too Many Requests - Rate Limit Exceeded**

```json
{
  "message": "Rate limit exceeded",
  "retryAfter": 60
}
```

## Best Practices

1. **Store Keys Securely**: Use environment variables or secret management systems
2. **Rotate Regularly**: Rotate keys every 90 days
3. **Use Least Privilege**: Only grant necessary permissions
4. **Monitor Usage**: Check CloudWatch metrics regularly
5. **Revoke Unused Keys**: Remove keys that are no longer needed
6. **Use HTTPS**: Always use HTTPS for API requests
7. **Handle Errors**: Implement proper error handling and retries

## Next Steps

- Read the [Integration Guide](./API_KEY_INTEGRATION_GUIDE.md) for detailed integration patterns
- Review [Best Practices](./API_KEY_BEST_PRACTICES.md) for security recommendations
- Check [CloudWatch Metrics](./API_KEY_METRICS.md) for monitoring guidance

## Support

For issues or questions:

- Email: support@vaidyalink.com
- Documentation: https://docs.vaidyalink.com
- GitHub Issues: https://github.com/vaidyalink/vaidyalink/issues
