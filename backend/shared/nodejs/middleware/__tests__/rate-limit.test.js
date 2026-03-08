const { checkRateLimit, getRateLimitHeaders, createRateLimitResponse } = require('../rate-limit');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('Rate Limiting Middleware', () => {
  let mockSend;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend = jest.fn();
    DynamoDBDocumentClient.from = jest.fn().mockReturnValue({
      send: mockSend,
    });
  });

  describe('checkRateLimit', () => {
    it('should allow request when under rate limit', async () => {
      // Mock DynamoDB query - no existing requests
      mockSend.mockResolvedValueOnce({ Items: [] });
      // Mock DynamoDB put
      mockSend.mockResolvedValueOnce({});

      const event = {
        user: {
          sub: 'user-123',
          groups: ['Patient'],
        },
      };

      const result = await checkRateLimit(event);

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe('Patient');
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(199); // burst capacity - 1
    });

    it('should deny request when rate limit exceeded', async () => {
      // Mock DynamoDB query - burst capacity reached
      mockSend.mockResolvedValueOnce({
        Items: [{ requestCount: 200 }],
      });

      const event = {
        user: {
          sub: 'user-123',
          groups: ['Patient'],
        },
      };

      const result = await checkRateLimit(event);

      expect(result.allowed).toBe(false);
      expect(result.tier).toBe('Patient');
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should use correct tier for healthcare provider', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      mockSend.mockResolvedValueOnce({});

      const event = {
        user: {
          sub: 'user-123',
          groups: ['HealthcareProvider'],
        },
      };

      const result = await checkRateLimit(event);

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe('HealthcareProvider');
      expect(result.limit).toBe(1000);
    });

    it('should use correct tier for admin', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      mockSend.mockResolvedValueOnce({});

      const event = {
        user: {
          sub: 'user-123',
          groups: ['Admin'],
        },
      };

      const result = await checkRateLimit(event);

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe('Admin');
      expect(result.limit).toBe(2000);
    });

    it('should use highest tier for multiple groups', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      mockSend.mockResolvedValueOnce({});

      const event = {
        user: {
          sub: 'user-123',
          groups: ['Patient', 'Admin'],
        },
      };

      const result = await checkRateLimit(event);

      expect(result.tier).toBe('Admin');
      expect(result.limit).toBe(2000);
    });

    it('should extract user from requestContext', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      mockSend.mockResolvedValueOnce({});

      const event = {
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user-123',
              'cognito:groups': ['Patient'],
            },
          },
        },
      };

      const result = await checkRateLimit(event);

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe('Patient');
    });

    it('should fail open when no user context', async () => {
      const event = {};

      const result = await checkRateLimit(event);

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe('Unknown');
    });

    it('should fail open on DynamoDB error', async () => {
      mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));

      const event = {
        user: {
          sub: 'user-123',
          groups: ['Patient'],
        },
      };

      const result = await checkRateLimit(event);

      expect(result.allowed).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should increment request count correctly', async () => {
      // Mock existing count of 50
      mockSend.mockResolvedValueOnce({
        Items: [{ requestCount: 50 }],
      });
      mockSend.mockResolvedValueOnce({});

      const event = {
        user: {
          sub: 'user-123',
          groups: ['Patient'],
        },
      };

      const result = await checkRateLimit(event);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(149); // 200 - 50 - 1
    });
  });

  describe('getRateLimitHeaders', () => {
    it('should create correct headers', () => {
      const rateLimitResult = {
        limit: 100,
        remaining: 50,
        retryAfter: 30,
      };

      const headers = getRateLimitHeaders(rateLimitResult);

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('50');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
      expect(headers['Retry-After']).toBe('30');
    });

    it('should not include Retry-After when retryAfter is 0', () => {
      const rateLimitResult = {
        limit: 100,
        remaining: 50,
        retryAfter: 0,
      };

      const headers = getRateLimitHeaders(rateLimitResult);

      expect(headers['Retry-After']).toBeUndefined();
    });
  });

  describe('createRateLimitResponse', () => {
    it('should create correct 429 response', () => {
      const rateLimitResult = {
        tier: 'Patient',
        limit: 100,
        remaining: 0,
        retryAfter: 30,
      };

      const response = createRateLimitResponse(rateLimitResult);

      expect(response.statusCode).toBe(429);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['X-RateLimit-Limit']).toBe('100');
      expect(response.headers['Retry-After']).toBe('30');

      const body = JSON.parse(response.body);
      expect(body.message).toBe('Rate limit exceeded');
      expect(body.tier).toBe('Patient');
      expect(body.limit).toBe(100);
      expect(body.retryAfter).toBe(30);
    });
  });
});
