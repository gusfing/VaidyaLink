import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayClient, DeleteApiKeyCommand } from '@aws-sdk/client-api-gateway';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const apiGatewayClient = new APIGatewayClient({});
const cloudWatchClient = new CloudWatchClient({});

const API_KEY_TABLE = process.env.API_KEY_TABLE!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

/**
 * Revoke API Key Handler
 *
 * Revokes an API key by:
 * - Deleting the API Gateway API key
 * - Updating status in DynamoDB to 'revoked'
 * - Emitting CloudWatch metrics
 *
 * **Validates: Requirements 6 (API Security)**
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Revoke API Key request:', JSON.stringify(event, null, 2));

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

    // Only admins can revoke API keys
    if (userRole !== 'admin') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Forbidden: Only admins can revoke API keys' }),
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

    // Check if already revoked
    if (keyMetadata.status === 'revoked') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'API key is already revoked' }),
      };
    }

    // Delete API Gateway API key
    try {
      await apiGatewayClient.send(
        new DeleteApiKeyCommand({
          apiKey: keyMetadata.apiGatewayKeyId,
        })
      );
    } catch (error) {
      console.warn('Failed to delete API Gateway key (may already be deleted):', error);
    }

    // Update status in DynamoDB
    const now = new Date().toISOString();
    await docClient.send(
      new UpdateCommand({
        TableName: API_KEY_TABLE,
        Key: { keyId },
        UpdateExpression:
          'SET #status = :status, #updatedAt = :updatedAt, #revokedAt = :revokedAt, #revokedBy = :revokedBy',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updatedAt': 'updatedAt',
          '#revokedAt': 'revokedAt',
          '#revokedBy': 'revokedBy',
        },
        ExpressionAttributeValues: {
          ':status': 'revoked',
          ':updatedAt': now,
          ':revokedAt': now,
          ':revokedBy': userId,
        },
      })
    );

    // Emit CloudWatch metric
    await cloudWatchClient.send(
      new PutMetricDataCommand({
        Namespace: 'VaidyaLink/ApiKeys',
        MetricData: [
          {
            MetricName: 'ApiKeyRevoked',
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

    console.log('API key revoked successfully:', keyId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyId,
        message: 'API key revoked successfully',
        revokedAt: now,
      }),
    };
  } catch (error) {
    console.error('Error revoking API key:', error);

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
