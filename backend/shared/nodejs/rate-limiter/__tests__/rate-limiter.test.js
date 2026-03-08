// Mock AWS SDK before requiring the handler
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({
        send: mockSend,
      })),
    },
    PutCommand: jest.fn((params) => ({ input: params })),
    QueryCommand: jest.fn((params) => ({ input: params })),
    mockSend, // Export for test access
  };
});

const { handler } = require('../index');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

describe('Rate Limiter Authorizer', () => {
  let mockSend;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mock send function from the mocked DynamoDB client
    const mockClient = DynamoDBDocumentClient.from();
    mockSend = mockClient.send;
    process.env.RATE_LIMIT_TABLE = 'test-rate-limit-table';
  });

  describe('User Tier Detection', () => {
    it('should identify Admin tier from groups', async () => {
      const event = createMockEvent('user-123', ['admins']);

      mockSend.mockResolvedValueOnce({ Items: [] }); // Query
      mockSend.mockResolvedValueOnce({}); // Put

      const result = await handler(event);

      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(result.context.tier).toBe('Admin');
      expect(result.context.limit).toBe('2000');
    });

    it('should identify HealthcareProvider tier from groups', async () => {
      const event = createMockEvent('user-456', ['providers']);

      mockSend.mockResolvedValueOnce({ Items: [] });
      mockSend.mockResolvedValueOnce({});

      const result = await handler(event);

      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(result.context.tier).toBe('HealthcareProvider');
      expect(result.context.limit).toBe('1000');
    });

    it('should default to Patient tier when no groups', async () => {
      const event = createMockEvent('user-789', null);

      mockSend.mockResolvedValueOnce({ Items: [] });
      mockSend.mockResolvedValueOnce({});

      const result = await handler(event);

      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(result.context.tier).toBe('Patient');
      expect(result.context.limit).toBe('100');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow request within rate limit', async () => {
      const event = createMockEvent('user-123', ['patients']);

      mockSend.mockResolvedValueOnce({
        Items: [{ userId: 'user-123', requestCount: 50 }],
      });
      mockSend.mockResolvedValueOnce({});

      const result = await handler(event);

      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should deny request when burst capacity exceeded', async () => {
      const event = createMockEvent('user-123', ['patients']);

      mockSend.mockResolvedValueOnce({
        Items: [{ userId: 'user-123', requestCount: 200 }], // At burst limit
      });

      const result = await handler(event);

      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
      expect(result.context.error).toBe('Rate limit exceeded');
    });

    it('should allow first request in new window', async () => {
      const event = createMockEvent('user-123', ['patients']);

      mockSend.mockResolvedValueOnce({ Items: [] }); // No existing window
      mockSend.mockResolvedValueOnce({});

      const result = await handler(event);

      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Item: expect.objectContaining({
              requestCount: 1,
            }),
          }),
        })
      );
    });

    it('should increment request count', async () => {
      const event = createMockEvent('user-123', ['patients']);

      mockSend.mockResolvedValueOnce({
        Items: [{ userId: 'user-123', requestCount: 10 }],
      });
      mockSend.mockResolvedValueOnce({});

      await handler(event);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Item: expect.objectContaining({
              requestCount: 11,
            }),
          }),
        })
      );
    });
  });

  describe('Tier-Specific Limits', () => {
    it('should enforce Patient tier limits (100/min, 200 burst)', async () => {
      const event = createMockEvent('patient-1', ['patients']);

      mockSend.mockResolvedValueOnce({
        Items: [{ requestCount: 199 }],
      });
      mockSend.mockResolvedValueOnce({});

      const result = await handler(event);
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');

      // Next request should be denied
      mockSend.mockResolvedValueOnce({
        Items: [{ requestCount: 200 }],
      });

      const result2 = await handler(event);
      expect(result2.policyDocument.Statement[0].Effect).toBe('Deny');
    });

    it('should enforce HealthcareProvider tier limits (1000/min, 2000 burst)', async () => {
      const event = createMockEvent('provider-1', ['providers']);

      mockSend.mockResolvedValueOnce({
        Items: [{ requestCount: 1999 }],
      });
      mockSend.mockResolvedValueOnce({});

      const result = await handler(event);
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');

      // Next request should be denied
      mockSend.mockResolvedValueOnce({
        Items: [{ requestCount: 2000 }],
      });

      const result2 = await handler(event);
      expect(result2.policyDocument.Statement[0].Effect).toBe('Deny');
    });
  });

  describe('Error Handling', () => {
    it('should fail open on DynamoDB errors', async () => {
      const event = createMockEvent('user-123', ['patients']);

      mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));

      const result = await handler(event);

      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(result.context.error).toBe('Rate limit check failed');
    });

    it('should deny when no user ID in context', async () => {
      const event = {
        methodArn: 'arn:aws:execute-api:region:account:api/stage/method/path',
        requestContext: {
          authorizer: {
            claims: {},
          },
        },
      };

      const result = await handler(event);

      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
      expect(result.context.error).toBe('Unauthorized');
    });
  });

  describe('Time Window Management', () => {
    it('should use 1-minute time windows', async () => {
      const event = createMockEvent('user-123', ['patients']);
      const now = Date.now();
      const expectedWindow = Math.floor(now / 60000) * 60000;

      mockSend.mockResolvedValueOnce({ Items: [] });
      mockSend.mockResolvedValueOnce({});

      await handler(event);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Item: expect.objectContaining({
              windowStart: expectedWindow,
            }),
          }),
        })
      );
    });

    it('should set TTL for 2 minutes after window', async () => {
      const event = createMockEvent('user-123', ['patients']);

      mockSend.mockResolvedValueOnce({ Items: [] });
      mockSend.mockResolvedValueOnce({});

      await handler(event);

      const putCall = mockSend.mock.calls.find((call) => call[0].constructor.name === 'PutCommand');
      const ttl = putCall[0].input.Item.ttl;
      const now = Math.floor(Date.now() / 1000);

      expect(ttl).toBeGreaterThan(now);
      expect(ttl).toBeLessThan(now + 180); // Within 3 minutes
    });
  });
});

function createMockEvent(userId, groups) {
  return {
    methodArn: 'arn:aws:execute-api:ap-south-1:123456789012:abc123/prod/GET/api/v1/scans',
    requestContext: {
      authorizer: {
        claims: {
          sub: userId,
          'cognito:groups': groups ? JSON.stringify(groups) : undefined,
        },
      },
    },
  };
}
