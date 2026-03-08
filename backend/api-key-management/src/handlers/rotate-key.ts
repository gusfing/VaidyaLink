import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  APIGatewayClient,
  CreateApiKeyCommand,
  CreateUsagePlanKeyCommand,
  DeleteApiKeyCommand,
} from '@aws-sdk/client-api-gateway';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const apiGatewayClient = new APIGatewayClient({});
const cloudWatchClient = new CloudWatchClient({});

const API_KEY_TABLE = process.env.API_KEY_TABLE!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

/**
 * Rotate API Key Handler
 *
 * Rotates an API key by:
 * - Creating a new API Gateway API key
 * - Associating with the same usage plan
 * - Updating metadata in DynamoDB
 * - Optionally deleting the old key after grace period
 * - Emitting CloudWatch metrics
 *
 * **Validates: Requirements 6 (API Security)**
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Rotate API Key request:', JSON.stringify(event, null, 2));

  try {
    // Extract user info from Cognito authorizer
    const userId = event.requestContext.authorizer?.claims?.sub;
    const userRole = event.requestContext.authorizer?.claims?.['custom:role'];

    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Unauthorized: User ID not found' }),
      };
    }

    // Only admins can rotate API keys
    if (userRole !== 'admin') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Forbidden: Only admins can rotate API keys' }),
      };
    }

    // Get keyId from path parameters
    const keyId = event.pathParameters?.keyId;

    if (!keyId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing required parameter: keyId' }),
      };
    }

    // Parse request body for options
    const body = event.body ? JSON.parse(event.body) : {};
    const deleteOldKey = body.deleteOldKey !== false; // Default to true

    // Get key metadata from DynamoDB
    const getResult = await docClient.send(
      new GetCommand({
        TableName: API_KEY_TABLE,
        Key: { keyId },
      })
    );

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'API key not found' }),
      };
    }

    const keyMetadata = getResult.Item;

    // Check if key is active
    if (keyMetadata.status !== 'active') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Can only rotate active API keys' }),
      };
    }

    const now = new Date().toISOString();
    const oldApiGatewayKeyId = keyMetadata.apiGatewayKeyId;

    // Create new API Gateway API key
    const createKeyCommand = new CreateApiKeyCommand({
      name: `vaidyalink-${ENVIRONMENT}-${keyMetadata.name}`,
      description: `${keyMetadata.description} (Rotated on ${now})`,
      enabled: true,
      tags: {
        Environment: ENVIRONMENT,
        KeyId: keyId,
        Tier: keyMetadata.tier,
        Owner: keyMetadata.owner,
        RotatedFrom: oldApiGatewayKeyId,
      },
    });

    const apiKeyResponse = await apiGatewayClient.send(createKeyCommand);

    if (!apiKeyResponse.id || !apiKeyResponse.value) {
      throw new Error('Failed to create new API Gateway API key');
    }

    // Associate with usage plan
    const usagePlanId = getUsagePlanId(keyMetadata.tier);
    const createUsagePlanKeyCommand = new CreateUsagePlanKeyCommand({
      usagePlanId,
      keyId: apiKeyResponse.id,
      keyType: 'API_KEY',
    });

    await apiGatewayClient.send(createUsagePlanKeyCommand);

    // Delete old API Gateway key if requested
    if (deleteOldKey) {
      try {
        await apiGatewayClient.send(
          new DeleteApiKeyCommand({
            apiKey: oldApiGatewayKeyId,
          })
        );
      } catch (error) {
        console.warn('Failed to delete old API Gateway key:', error);
      }
    }

    // Update metadata in DynamoDB
    await docClient.send(
      new UpdateCommand({
        TableName: API_KEY_TABLE,
        Key: { keyId },
        UpdateExpression:
          'SET #apiGatewayKeyId = :newKeyId, #updatedAt = :updatedAt, #lastRotatedAt = :lastRotatedAt, #previousKeyId = :previousKeyId',
        ExpressionAttributeNames: {
          '#apiGatewayKeyId': 'apiGatewayKeyId',
          '#updatedAt': 'updatedAt',
          '#lastRotatedAt': 'lastRotatedAt',
          '#previousKeyId': 'previousKeyId',
        },
        ExpressionAttributeValues: {
          ':newKeyId': apiKeyResponse.id,
          ':updatedAt': now,
          ':lastRotatedAt': now,
          ':previousKeyId': oldApiGatewayKeyId,
        },
      })
    );

    // Emit CloudWatch metric
    await cloudWatchClient.send(
      new PutMetricDataCommand({
        Namespace: 'VaidyaLink/ApiKeys',
        MetricData: [
          {
            MetricName: 'ApiKeyRotated',
            Value: 1,
            Unit: 'Count',
            Timestamp: new Date(),
            Dimensions: [
              { Name: 'Environment', Value: ENVIRONMENT },
              { Name: 'Tier', Value: keyMetadata.tier },
            ],
          },
        ],
      })
    );

    console.log('API key rotated successfully:', keyId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyId,
        apiKey: apiKeyResponse.value,
        name: keyMetadata.name,
        tier: keyMetadata.tier,
        rotatedAt: now,
        previousKeyDeleted: deleteOldKey,
        message:
          'API key rotated successfully. Store the new API key securely - it will not be shown again.',
      }),
    };
  } catch (error) {
    console.error('Error rotating API key:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

function getUsagePlanId(tier: string): string {
  const usagePlanMap: Record<string, string> = {
    Standard: process.env.STANDARD_USAGE_PLAN_ID!,
    HealthcareProvider: process.env.HEALTHCARE_USAGE_PLAN_ID!,
    Enterprise: process.env.ENTERPRISE_USAGE_PLAN_ID!,
  };

  return usagePlanMap[tier];
}
