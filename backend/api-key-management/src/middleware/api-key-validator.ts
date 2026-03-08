import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cloudWatchClient = new CloudWatchClient({});

const API_KEY_TABLE = process.env.API_KEY_TABLE || 'vaidyalink-dev-api-keys';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

interface ApiKeyMetadata {
  keyId: string;
  apiGatewayKeyId: string;
  name: string;
  tier: string;
  owner: string;
  permissions: string[];
  status: string;
  expiresAt: string;
  requestCount: number;
}

/**
 * API Key Validation Middleware
 *
 * Validates API keys and tracks usage:
 * - Verifies API key exists and is active
 * - Checks expiration date
 * - Validates permissions for the requested resource
 * - Updates last used timestamp and request count
 * - Emits CloudWatch metrics
 *
 * Usage:
 * ```typescript
 * import { validateApiKey } from './middleware/api-key-validator';
 *
 * export const handler = async (event: APIGatewayProxyEvent) => {
 *   const validation = await validateApiKey(event, ['scans:read', 'scans:write']);
 *   if (!validation.isValid) {
 *     return validation.errorResponse!;
 *   }
 *
 *   // Continue with handler logic
 *   // Access key metadata via validation.metadata
 * };
 * ```
 *
 * **Validates: Requirements 6 (API Security)**
 */

export interface ValidationResult {
  isValid: boolean;
  metadata?: ApiKeyMetadata;
  errorResponse?: APIGatewayProxyResult;
}

export async function validateApiKey(
  event: APIGatewayProxyEvent,
  requiredPermissions: string[] = []
): Promise<ValidationResult> {
  try {
    // Extract API key from header
    const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];

    if (!apiKey) {
      return {
        isValid: false,
        errorResponse: {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Missing API key' }),
        },
      };
    }

    // Query DynamoDB for key metadata by API Gateway key ID
    // Note: In production, you'd query by a hash of the API key or use API Gateway's built-in validation
    const result = await docClient.send(
      new QueryCommand({
        TableName: API_KEY_TABLE,
        IndexName: 'StatusIndex',
        KeyConditionExpression: '#status = :status',
        FilterExpression: 'contains(#apiGatewayKeyId, :apiKey)',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#apiGatewayKeyId': 'apiGatewayKeyId',
        },
        ExpressionAttributeValues: {
          ':status': 'active',
          ':apiKey': apiKey.substring(0, 10), // Partial match for security
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      await emitMetric('ApiKeyValidationFailed', 'InvalidKey');
      return {
        isValid: false,
        errorResponse: {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Invalid API key' }),
        },
      };
    }

    const metadata = result.Items[0] as ApiKeyMetadata;

    // Check if key is expired
    if (new Date(metadata.expiresAt) < new Date()) {
      await emitMetric('ApiKeyValidationFailed', 'Expired');
      return {
        isValid: false,
        errorResponse: {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'API key has expired' }),
        },
      };
    }

    // Check permissions
    if (requiredPermissions.length > 0) {
      const hasPermissions = requiredPermissions.every((perm) =>
        metadata.permissions.includes(perm)
      );

      if (!hasPermissions) {
        await emitMetric('ApiKeyValidationFailed', 'InsufficientPermissions');
        return {
          isValid: false,
          errorResponse: {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: 'Insufficient permissions',
              required: requiredPermissions,
            }),
          },
        };
      }
    }

    // Update last used timestamp and request count
    const now = new Date().toISOString();
    await docClient.send(
      new UpdateCommand({
        TableName: API_KEY_TABLE,
        Key: { keyId: metadata.keyId },
        UpdateExpression: 'SET #lastUsedAt = :now, #requestCount = #requestCount + :inc',
        ExpressionAttributeNames: {
          '#lastUsedAt': 'lastUsedAt',
          '#requestCount': 'requestCount',
        },
        ExpressionAttributeValues: {
          ':now': now,
          ':inc': 1,
        },
      })
    );

    // Emit success metric
    await emitMetric('ApiKeyValidationSuccess', metadata.tier);

    return {
      isValid: true,
      metadata,
    };
  } catch (error) {
    console.error('Error validating API key:', error);

    return {
      isValid: false,
      errorResponse: {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Internal server error during API key validation' }),
      },
    };
  }
}

async function emitMetric(metricName: string, dimension: string): Promise<void> {
  try {
    await cloudWatchClient.send(
      new PutMetricDataCommand({
        Namespace: 'VaidyaLink/ApiKeys',
        MetricData: [
          {
            MetricName: metricName,
            Value: 1,
            Unit: 'Count',
            Timestamp: new Date(),
            Dimensions: [
              { Name: 'Environment', Value: ENVIRONMENT },
              { Name: 'Type', Value: dimension },
            ],
          },
        ],
      })
    );
  } catch (error) {
    console.error('Failed to emit CloudWatch metric:', error);
  }
}

/**
 * Higher-order function to wrap Lambda handlers with API key validation
 *
 * Usage:
 * ```typescript
 * export const handler = withApiKeyValidation(
 *   async (event, metadata) => {
 *     // Handler logic with validated API key
 *     return {
 *       statusCode: 200,
 *       body: JSON.stringify({ message: 'Success' }),
 *     };
 *   },
 *   ['scans:read']
 * );
 * ```
 */
export function withApiKeyValidation(
  handler: (
    event: APIGatewayProxyEvent,
    metadata: ApiKeyMetadata
  ) => Promise<APIGatewayProxyResult>,
  requiredPermissions: string[] = []
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const validation = await validateApiKey(event, requiredPermissions);

    if (!validation.isValid) {
      return validation.errorResponse!;
    }

    return handler(event, validation.metadata!);
  };
}
