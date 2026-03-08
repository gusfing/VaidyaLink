import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const API_KEY_TABLE = process.env.API_KEY_TABLE!;

/**
 * List API Keys Handler
 *
 * Lists API keys with filtering and pagination:
 * - Filter by owner, status, or tier
 * - Pagination support
 * - Excludes actual API key values for security
 *
 * **Validates: Requirements 6 (API Security)**
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('List API Keys request:', JSON.stringify(event, null, 2));

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

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const owner = queryParams.owner;
    const status = queryParams.status;
    const tier = queryParams.tier;
    const limit = parseInt(queryParams.limit || '50', 10);
    const lastEvaluatedKey = queryParams.lastEvaluatedKey
      ? JSON.parse(decodeURIComponent(queryParams.lastEvaluatedKey))
      : undefined;

    // Admins can see all keys, others can only see their own
    const effectiveOwner = userRole === 'admin' ? owner : userId;

    let result;

    if (effectiveOwner) {
      // Query by owner using GSI
      result = await docClient.send(
        new QueryCommand({
          TableName: API_KEY_TABLE,
          IndexName: 'OwnerIndex',
          KeyConditionExpression: '#owner = :owner',
          ExpressionAttributeNames: {
            '#owner': 'owner',
          },
          ExpressionAttributeValues: {
            ':owner': effectiveOwner,
          },
          Limit: limit,
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );
    } else if (status) {
      // Query by status using GSI
      result = await docClient.send(
        new QueryCommand({
          TableName: API_KEY_TABLE,
          IndexName: 'StatusIndex',
          KeyConditionExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': status,
          },
          Limit: limit,
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );
    } else {
      // Scan all keys (admin only)
      if (userRole !== 'admin') {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Forbidden: Insufficient permissions' }),
        };
      }

      result = await docClient.send(
        new ScanCommand({
          TableName: API_KEY_TABLE,
          Limit: limit,
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );
    }

    // Filter by tier if specified
    let items = result.Items || [];
    if (tier) {
      items = items.filter((item) => item.tier === tier);
    }

    // Remove sensitive information
    const sanitizedItems = items.map((item) => ({
      keyId: item.keyId,
      name: item.name,
      description: item.description,
      tier: item.tier,
      owner: item.owner,
      permissions: item.permissions,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      expiresAt: item.expiresAt,
      lastUsedAt: item.lastUsedAt,
      requestCount: item.requestCount,
      lastRotatedAt: item.lastRotatedAt,
    }));

    // Prepare pagination token
    const nextToken = result.LastEvaluatedKey
      ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey))
      : null;

    console.log(`Listed ${sanitizedItems.length} API keys`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keys: sanitizedItems,
        count: sanitizedItems.length,
        nextToken,
      }),
    };
  } catch (error) {
    console.error('Error listing API keys:', error);

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
