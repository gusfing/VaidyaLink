# API Key Management - Best Practices

Security and operational best practices for managing VaidyaLink API keys.

## Table of Contents

1. [Security Best Practices](#security-best-practices)
2. [Key Lifecycle Management](#key-lifecycle-management)
3. [Access Control](#access-control)
4. [Monitoring and Auditing](#monitoring-and-auditing)
5. [Error Handling](#error-handling)
6. [Performance Optimization](#performance-optimization)
7. [Compliance](#compliance)

## Security Best Practices

### 1. Secure Storage

**❌ DON'T: Hardcode API keys**

```typescript
// BAD - Never do this!
const apiKey = 'vl_live_abc123def456...';
```

**✅ DO: Use environment variables**

```typescript
// GOOD
const apiKey = process.env.VAIDYALINK_API_KEY;
if (!apiKey) {
  throw new Error('VAIDYALINK_API_KEY environment variable is required');
}
```

**✅ DO: Use secret management services**

```typescript
// AWS Secrets Manager
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getApiKey() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await client.send(new GetSecretValueCommand({ SecretId: 'vaidyalink/api-key' }));
  return JSON.parse(response.SecretString!).apiKey;
}
```

### 2. Key Rotation

**Rotate keys every 90 days minimum:**

```typescript
// Automated rotation script
import { VaidyaLinkAdminSDK } from './admin-sdk';

async function rotateApiKey(keyId: string) {
  const admin = new VaidyaLinkAdminSDK(process.env.ADMIN_TOKEN!);

  // Rotate key
  const newKey = await admin.rotateApiKey(keyId, { deleteOldKey: false });

  // Update secret in Secrets Manager
  await updateSecret('vaidyalink/api-key', newKey.apiKey);

  // Grace period: wait 24 hours before deleting old key
  setTimeout(
    async () => {
      await admin.rotateApiKey(keyId, { deleteOldKey: true });
    },
    24 * 60 * 60 * 1000
  );

  console.log('API key rotated successfully');
}

// Schedule rotation every 90 days
setInterval(() => rotateApiKey('your-key-id'), 90 * 24 * 60 * 60 * 1000);
```

### 3. Least Privilege Principle

**Only grant necessary permissions:**

```typescript
// ❌ DON'T: Grant all permissions
const key = await admin.createApiKey({
  name: 'external-integration',
  tier: 'Standard',
  permissions: ['*'], // Too broad!
});

// ✅ DO: Grant specific permissions
const key = await admin.createApiKey({
  name: 'external-integration',
  tier: 'Standard',
  permissions: [
    'scans:read', // Only what's needed
    'patients:read',
  ],
});
```

### 4. Network Security

**Use HTTPS only:**

```typescript
// ✅ Always use HTTPS
const baseURL = 'https://api.vaidyalink.com/api/v1';

// ❌ Never use HTTP
// const baseURL = 'http://api.vaidyalink.com/api/v1'; // INSECURE!
```

**Implement certificate pinning for mobile apps:**

```swift
// iOS example
let session = URLSession(
    configuration: .default,
    delegate: self,
    delegateQueue: nil
)

func urlSession(
    _ session: URLSession,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
) {
    guard let serverTrust = challenge.protectionSpace.serverTrust else {
        completionHandler(.cancelAuthenticationChallenge, nil)
        return
    }

    // Verify certificate
    let credential = URLCredential(trust: serverTrust)
    completionHandler(.useCredential, credential)
}
```

### 5. API Key Exposure Prevention

**Prevent accidental commits:**

```bash
# .gitignore
.env
.env.local
.env.production
secrets/
*.key
```

**Use pre-commit hooks:**

```bash
# .git/hooks/pre-commit
#!/bin/bash

# Check for potential API keys
if git diff --cached | grep -E "vl_(live|test)_[a-zA-Z0-9]{32,}"; then
    echo "ERROR: Potential API key found in commit!"
    echo "Please remove the API key and use environment variables instead."
    exit 1
fi
```

**Scan for exposed keys:**

```bash
# Use tools like truffleHog or git-secrets
git secrets --scan
```

## Key Lifecycle Management

### 1. Key Creation Workflow

```typescript
interface KeyCreationWorkflow {
  // 1. Request approval
  async requestKeyCreation(justification: string): Promise<string> {
    const approvalId = await submitApprovalRequest({
      type: 'api_key_creation',
      justification,
      requester: getCurrentUser(),
    });
    return approvalId;
  }

  // 2. Create key after approval
  async createKeyAfterApproval(approvalId: string, keyConfig: KeyConfig): Promise<ApiKey> {
    const approval = await getApproval(approvalId);
    if (approval.status !== 'approved') {
      throw new Error('Approval required');
    }

    const key = await admin.createApiKey(keyConfig);

    // 3. Store in secret manager
    await storeSecret(`vaidyalink/keys/${key.keyId}`, key.apiKey);

    // 4. Notify stakeholders
    await notifyKeyCreation(key);

    // 5. Schedule first rotation
    await scheduleRotation(key.keyId, 90);

    return key;
  }
}
```

### 2. Key Inventory Management

```typescript
// Maintain inventory of all API keys
interface KeyInventory {
  keyId: string;
  name: string;
  owner: string;
  tier: string;
  createdAt: Date;
  expiresAt: Date;
  lastRotatedAt: Date;
  lastUsedAt: Date;
  status: 'active' | 'revoked' | 'expired';
  environment: 'production' | 'staging' | 'development';
}

async function auditApiKeys(): Promise<KeyInventory[]> {
  const keys = await admin.listApiKeys();

  const inventory = keys.map((key) => ({
    ...key,
    daysUntilExpiration: Math.floor(
      (new Date(key.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ),
    daysSinceLastRotation: Math.floor(
      (Date.now() - new Date(key.lastRotatedAt || key.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));

  // Alert on keys needing attention
  const keysNeedingRotation = inventory.filter((k) => k.daysSinceLastRotation > 90);
  const keysNearExpiration = inventory.filter((k) => k.daysUntilExpiration < 30);

  if (keysNeedingRotation.length > 0) {
    await alertSecurityTeam('Keys need rotation', keysNeedingRotation);
  }

  if (keysNearExpiration.length > 0) {
    await alertSecurityTeam('Keys near expiration', keysNearExpiration);
  }

  return inventory;
}

// Run audit weekly
setInterval(auditApiKeys, 7 * 24 * 60 * 60 * 1000);
```

### 3. Key Revocation Process

```typescript
async function revokeKeyWithWorkflow(keyId: string, reason: string) {
  // 1. Verify authorization
  const user = getCurrentUser();
  if (!user.hasRole('admin')) {
    throw new Error('Unauthorized');
  }

  // 2. Get key details
  const key = await admin.getApiKey(keyId);

  // 3. Notify key owner
  await notifyKeyOwner(key.owner, {
    message: `API key ${key.name} will be revoked`,
    reason,
    revokedBy: user.email,
  });

  // 4. Revoke key
  await admin.revokeApiKey(keyId);

  // 5. Remove from secret manager
  await deleteSecret(`vaidyalink/keys/${keyId}`);

  // 6. Log audit event
  await logAuditEvent({
    action: 'api_key_revoked',
    keyId,
    reason,
    revokedBy: user.id,
    timestamp: new Date(),
  });

  // 7. Update inventory
  await updateKeyInventory(keyId, { status: 'revoked' });
}
```

## Access Control

### 1. Role-Based Access Control (RBAC)

```typescript
// Define roles and permissions
const roles = {
  admin: {
    canCreateKeys: true,
    canRevokeKeys: true,
    canRotateKeys: true,
    canViewAllKeys: true,
  },
  developer: {
    canCreateKeys: false,
    canRevokeKeys: false,
    canRotateKeys: false,
    canViewAllKeys: false,
    canViewOwnKeys: true,
  },
  auditor: {
    canCreateKeys: false,
    canRevokeKeys: false,
    canRotateKeys: false,
    canViewAllKeys: true,
  },
};

// Enforce RBAC
function checkPermission(user: User, action: string): boolean {
  const userRole = roles[user.role];
  if (!userRole) return false;

  return userRole[action] === true;
}
```

### 2. IP Whitelisting

```typescript
// Configure IP whitelist for API keys
const keyConfig = {
  name: 'production-integration',
  tier: 'Enterprise',
  permissions: ['scans:read', 'patients:read'],
  ipWhitelist: [
    '203.0.113.0/24', // Office network
    '198.51.100.42', // Production server
  ],
};

// Validate IP in middleware
function validateIPWhitelist(clientIP: string, whitelist: string[]): boolean {
  return whitelist.some((range) => isIPInRange(clientIP, range));
}
```

## Monitoring and Auditing

### 1. CloudWatch Dashboards

```typescript
// Create custom dashboard
import { CloudWatchClient, PutDashboardCommand } from '@aws-sdk/client-cloudwatch';

const dashboardBody = {
  widgets: [
    {
      type: 'metric',
      properties: {
        metrics: [
          ['VaidyaLink/ApiKeys', 'ApiKeyValidationSuccess'],
          ['VaidyaLink/ApiKeys', 'ApiKeyValidationFailed'],
        ],
        period: 300,
        stat: 'Sum',
        region: 'us-east-1',
        title: 'API Key Validations',
      },
    },
    {
      type: 'metric',
      properties: {
        metrics: [
          ['VaidyaLink/ApiKeys', 'ApiKeyCreated'],
          ['VaidyaLink/ApiKeys', 'ApiKeyRevoked'],
          ['VaidyaLink/ApiKeys', 'ApiKeyRotated'],
        ],
        period: 86400,
        stat: 'Sum',
        region: 'us-east-1',
        title: 'API Key Lifecycle Events',
      },
    },
  ],
};

await cloudwatch.send(
  new PutDashboardCommand({
    DashboardName: 'VaidyaLink-ApiKeys',
    DashboardBody: JSON.stringify(dashboardBody),
  })
);
```

### 2. Alerting

```typescript
// Set up CloudWatch alarms
import { CloudWatchClient, PutMetricAlarmCommand } from '@aws-sdk/client-cloudwatch';

// Alert on high failure rate
await cloudwatch.send(
  new PutMetricAlarmCommand({
    AlarmName: 'VaidyaLink-ApiKey-HighFailureRate',
    MetricName: 'ApiKeyValidationFailed',
    Namespace: 'VaidyaLink/ApiKeys',
    Statistic: 'Sum',
    Period: 300,
    EvaluationPeriods: 2,
    Threshold: 100,
    ComparisonOperator: 'GreaterThanThreshold',
    AlarmActions: ['arn:aws:sns:us-east-1:123456789012:security-alerts'],
  })
);

// Alert on unusual activity
await cloudwatch.send(
  new PutMetricAlarmCommand({
    AlarmName: 'VaidyaLink-ApiKey-UnusualActivity',
    MetricName: 'ApiKeyValidationSuccess',
    Namespace: 'VaidyaLink/ApiKeys',
    Statistic: 'Sum',
    Period: 300,
    EvaluationPeriods: 1,
    Threshold: 10000,
    ComparisonOperator: 'GreaterThanThreshold',
    AlarmActions: ['arn:aws:sns:us-east-1:123456789012:security-alerts'],
  })
);
```

### 3. Audit Logging

```typescript
// Comprehensive audit logging
interface AuditLog {
  timestamp: Date;
  action: string;
  keyId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure';
  details: Record<string, any>;
}

async function logAuditEvent(event: AuditLog) {
  // Log to CloudWatch Logs
  await cloudwatchLogs.putLogEvents({
    logGroupName: '/vaidyalink/api-keys/audit',
    logStreamName: new Date().toISOString().split('T')[0],
    logEvents: [
      {
        timestamp: event.timestamp.getTime(),
        message: JSON.stringify(event),
      },
    ],
  });

  // Also store in DynamoDB for querying
  await dynamodb.putItem({
    TableName: 'vaidyalink-audit-logs',
    Item: marshall(event),
  });
}
```

## Error Handling

### 1. Retry Logic with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;

      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}

// Usage
const result = await retryWithBackoff(() => sdk.getPatientRecords('patient-123'));
```

### 2. Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}

// Usage
const breaker = new CircuitBreaker();
const result = await breaker.execute(() => sdk.getPatientRecords('patient-123'));
```

## Performance Optimization

### 1. Request Caching

```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

async function getCachedPatientRecords(patientId: string) {
  const cacheKey = `patient:${patientId}:records`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('Cache hit');
    return cached;
  }

  // Fetch from API
  const records = await sdk.getPatientRecords(patientId);

  // Store in cache
  cache.set(cacheKey, records);

  return records;
}
```

### 2. Connection Pooling

```typescript
import axios from 'axios';
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const client = axios.create({
  baseURL: 'https://api.vaidyalink.com/api/v1',
  httpAgent,
  httpsAgent,
  headers: {
    'X-API-Key': process.env.VAIDYALINK_API_KEY,
  },
});
```

### 3. Batch Requests

```typescript
// Batch multiple requests
async function batchGetPatients(patientIds: string[]) {
  const batchSize = 10;
  const batches = [];

  for (let i = 0; i < patientIds.length; i += batchSize) {
    const batch = patientIds.slice(i, i + batchSize);
    batches.push(Promise.all(batch.map((id) => sdk.getPatientRecords(id))));
  }

  return (await Promise.all(batches)).flat();
}
```

## Compliance

### 1. HIPAA Compliance

- **Encryption**: All API keys are encrypted at rest using AWS KMS
- **Audit Logs**: All API key operations are logged for 7 years
- **Access Controls**: RBAC enforced for all key management operations
- **Data Minimization**: API keys only grant necessary permissions

### 2. GDPR Compliance

- **Right to Access**: Users can list their API keys
- **Right to Deletion**: API keys can be revoked and deleted
- **Data Portability**: API key metadata can be exported
- **Consent**: API key creation requires explicit admin approval

### 3. SOC 2 Compliance

- **Security**: Encryption, access controls, audit logging
- **Availability**: High availability architecture, monitoring
- **Confidentiality**: API keys never logged or exposed
- **Privacy**: Minimal data collection, secure storage

## Checklist

Use this checklist for API key management:

- [ ] API keys stored in secret management system
- [ ] Keys rotated every 90 days
- [ ] Least privilege permissions applied
- [ ] HTTPS enforced for all requests
- [ ] Pre-commit hooks prevent key exposure
- [ ] CloudWatch monitoring configured
- [ ] Alerts set up for unusual activity
- [ ] Audit logging enabled
- [ ] Error handling with retries implemented
- [ ] Circuit breaker pattern applied
- [ ] Request caching configured
- [ ] Connection pooling enabled
- [ ] HIPAA compliance verified
- [ ] GDPR compliance verified
- [ ] SOC 2 compliance verified

## Support

For security concerns or questions:

- Email: security@vaidyalink.com
- Security Portal: https://security.vaidyalink.com
- Bug Bounty: https://hackerone.com/vaidyalink
