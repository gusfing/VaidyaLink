import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  APIGatewayClient,
  CreateApiKeyCommand,
  CreateUsagePlanKeyCommand,
} from '@aws-sdk/client-api-gateway';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const apiGatewayClient = new APIGatewayClient({});
const cloudWatchClient = new CloudWatchClient({});

const API_KEY_TABLE = process.env.API_KEY_TABLE!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

interface CreateKeyRequest {
  name: string;
  description?: string;
  tier: 'Standard' | 'HealthcareProvider' | 'Enterprise';
  permissions?: string[];
  expiresInDays?: number;
}

/**
 * Create API Key Handler
 *
 * Creates a new API key for external integrations with:
 * - API Gateway API key generation
 * - Usage plan association
 * - Metadata storage in DynamoDB
 * - CloudWatch metrics emission
 *
 * **Validates: Requirements 6 (API Security)**
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Create API Key request:', JSON.stringify(event, null, 2));

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

    // Only admins can create API keys
    if (userRole !== 'admin') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Forbidden: Only admins can create API keys' }),
      };
    }

    // Parse request body
    const body: CreateKeyRequest = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.name || !body.tier) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Missing required fields: name, tier' }),
      };
    }

    // Validate tier
    const validTiers = ['Standard', 'HealthcareProvider', 'Enterprise'];
    if (!validTiers.includes(body.tier)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Invalid tier. Must be one of: ${validTiers.join(', ')}` }),
      };
    }

    // Generate unique key ID
    const keyId = uuidv4();
    const now = new Date().toISOString();

    // Calculate expiration date
    const expiresInDays = body.expiresInDays || 365;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    // Create API Gateway API key
    const createKeyCommand = new CreateApiKeyCommand({
      name: `vaidyalink-${ENVIRONMENT}-${body.name}`,
      description: body.description || `API key for ${body.name}`,
      enabled: true,
      tags: {
        Environment: ENVIRONMENT,
        KeyId: keyId,
        Tier: body.tier,
        Owner: userId,
      },
    });

    const apiKeyResponse = await apiGatewayClient.send(createKeyCommand);

    if (!apiKeyResponse.id || !apiKeyResponse.value) {
      throw new Error('Failed to create API Gateway API key');
    }

    // Associate with usage plan
    const usagePlanId = getUsagePlanId(body.tier);
    const createUsagePlanKeyCommand = new CreateUsagePlanKeyCommand({
      usagePlanId,
      keyId: apiKeyResponse.id,
      keyType: 'API_KEY',
    });

    await apiGatewayClient.send(createUsagePlanKeyCommand);

    // Store metadata in DynamoDB
    const metadata = {
      keyId,
      apiGatewayKeyId: apiKeyResponse.id,
      name: body.name,
      description: body.description || '',
      tier: body.tier,
      owner: userId,
      permissions: body.permissions || [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      expiresAt,
      lastUsedAt: null,
      requestCount: 0,
      lastRotatedAt: null,
    };

    await docClient.send(
      new PutCommand({
        TableName: API_KEY_TABLE,
        Item: metadata,
      })
    );

    // Emit CloudWatch metric
    await cloudWatchClient.send(
      new PutMetricDataCommand({
        Namespace: 'VaidyaLink/ApiKeys',
        MetricData: [
          {
            MetricName: 'ApiKeyCreated',
            Value: 1,
            Unit: 'Count',
            Timestamp: new Date(),
            Dimensions: [
              { Name: 'Environment', Value: ENVIRONMENT },
              { Name: 'Tier', Value: body.tier },
            ],
          },
        ],
      })
    );

    console.log('API key created successfully:', keyId);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyId,
        apiKey: apiKeyResponse.value,
        name: body.name,
        tier: body.tier,
        createdAt: now,
        expiresAt,
        message:
          'API key created successfully. Store the API key securely - it will not be shown again.',
      }),
    };
  } catch (error) {
    console.error('Error creating API key:', error);

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
