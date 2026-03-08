/**
 * Property-Based Tests for Authentication Middleware
 *
 * Feature: aws-real-data-integration
 * These tests verify universal properties that should hold for all authentication scenarios.
 *
 * Properties tested:
 * - Property 28: Authentication Header Inclusion
 * - Property 29: Invalid Token Rejection
 * - Property 30: Token Expiration Extraction
 * - Property 31: User Identity Extraction
 *
 * Validates: Requirements 8.1, 8.2, 8.6, 8.7
 */

const fc = require('fast-check');
const jwt = require('jsonwebtoken');
const { authenticateRequest, verifyToken } = require('../auth');

// Mock jwks-rsa
jest.mock('jwks-rsa', () => {
  return jest.fn(() => ({
    getSigningKey: jest.fn((kid, callback) => {
      // Return a mock signing key
      callback(null, {
        getPublicKey: () => 'mock-public-key',
      });
    }),
  }));
});

describe('Authentication Middleware Properties', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Reset mocks
    mockReq = {
      headers: {},
      id: 'test-request-id',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Set required environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_TestPool';
  });

  /**
   * Property 28: Authentication Header Inclusion
   *
   * **Validates: Requirement 8.1**
   *
   * For any API request to the backend, the request SHALL include an
   * Authorization header with the format "Bearer {token}".
   *
   * This property verifies that:
   * 1. Requests with Authorization header in correct format are processed
   * 2. Requests without Authorization header are rejected with 401
   * 3. Requests with malformed Authorization header are rejected with 401
   */
  describe('Property 28: Authentication Header Inclusion', () => {
    it('should reject requests without Authorization header', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
            path: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async ({ method, path }) => {
            mockReq.method = method;
            mockReq.path = path;
            // No Authorization header

            await authenticateRequest(mockReq, mockRes, mockNext);

            // Should return 401
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
              expect.objectContaining({
                error: 'Missing authentication token',
                code: 'MISSING_TOKEN',
              })
            );
            expect(mockNext).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject requests with malformed Authorization header', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            authHeader: fc.oneof(
              fc.string({ minLength: 1, maxLength: 50 }), // Random string without Bearer
              fc.constant('Basic token123'), // Wrong scheme
              fc.constant('Bearer'), // Bearer without token
              fc.constant('bearer token123') // Lowercase bearer
            ),
          }),
          async ({ authHeader }) => {
            mockReq.headers.authorization = authHeader;

            await authenticateRequest(mockReq, mockRes, mockNext);

            // Should return 401
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalled();
            expect(mockNext).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept requests with Bearer token format', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 10, maxLength: 100 }), async (tokenString) => {
          // Create a valid JWT token
          const secret = 'test-secret';
          const token = jwt.sign(
            {
              sub: 'user-123',
              email: 'test@example.com',
              username: 'testuser',
              exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            },
            secret
          );

          mockReq.headers.authorization = `Bearer ${token}`;

          // Mock jwt.verify to succeed
          jest.spyOn(jwt, 'verify').mockImplementation((token, getKey, options, callback) => {
            callback(null, {
              sub: 'user-123',
              email: 'test@example.com',
              username: 'testuser',
              exp: Math.floor(Date.now() / 1000) + 3600,
            });
          });

          await authenticateRequest(mockReq, mockRes, mockNext);

          // Should call next() without error
          expect(mockNext).toHaveBeenCalled();
          expect(mockRes.status).not.toHaveBeenCalled();
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 29: Invalid Token Rejection
   *
   * **Validates: Requirement 8.2**
   *
   * For any API request with missing or invalid authentication token,
   * the backend SHALL return 401 Unauthorized.
   *
   * This property verifies that:
   * 1. Invalid JWT tokens are rejected with 401
   * 2. Malformed tokens are rejected with 401
   * 3. Tokens with invalid signatures are rejected with 401
   */
  describe('Property 29: Invalid Token Rejection', () => {
    it('should reject invalid JWT tokens with 401', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string({ minLength: 10, maxLength: 100 }), // Random string
            fc.constant('invalid.jwt.token'), // Malformed JWT
            fc.constant('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature') // Invalid signature
          ),
          async (invalidToken) => {
            mockReq.headers.authorization = `Bearer ${invalidToken}`;

            // Mock jwt.verify to fail
            jest.spyOn(jwt, 'verify').mockImplementation((token, getKey, options, callback) => {
              const error = new Error('Invalid token');
              error.name = 'JsonWebTokenError';
              callback(error);
            });

            await authenticateRequest(mockReq, mockRes, mockNext);

            // Should return 401
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
              expect.objectContaining({
                error: expect.any(String),
                code: expect.any(String),
              })
            );
            expect(mockNext).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject tokens with invalid signatures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sub: fc.string({ minLength: 5, maxLength: 20 }),
            email: fc.emailAddress(),
          }),
          async ({ sub, email }) => {
            // Create token with one secret
            const token = jwt.sign({ sub, email }, 'secret1');

            mockReq.headers.authorization = `Bearer ${token}`;

            // Mock jwt.verify to fail with signature error
            jest.spyOn(jwt, 'verify').mockImplementation((token, getKey, options, callback) => {
              const error = new Error('invalid signature');
              error.name = 'JsonWebTokenError';
              callback(error);
            });

            await authenticateRequest(mockReq, mockRes, mockNext);

            // Should return 401
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 30: Token Expiration Extraction
   *
   * **Validates: Requirement 8.6**
   *
   * For any valid JWT token, the backend SHALL correctly extract and
   * verify the expiration timestamp from the token claims.
   *
   * This property verifies that:
   * 1. Expired tokens are rejected with 401 and TOKEN_EXPIRED code
   * 2. Valid tokens with future expiration are accepted
   * 3. Expiration checking is consistent across all token types
   */
  describe('Property 30: Token Expiration Extraction', () => {
    it('should reject expired tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sub: fc.string({ minLength: 5, maxLength: 20 }),
            email: fc.emailAddress(),
            expirationSecondsAgo: fc.integer({ min: 1, max: 86400 }), // 1 second to 1 day ago
          }),
          async ({ sub, email, expirationSecondsAgo }) => {
            const expiredTime = Math.floor(Date.now() / 1000) - expirationSecondsAgo;
            const token = jwt.sign({ sub, email, exp: expiredTime }, 'test-secret');

            mockReq.headers.authorization = `Bearer ${token}`;

            // Mock jwt.verify to fail with expiration error
            jest.spyOn(jwt, 'verify').mockImplementation((token, getKey, options, callback) => {
              const error = new Error('jwt expired');
              error.name = 'TokenExpiredError';
              callback(error);
            });

            await authenticateRequest(mockReq, mockRes, mockNext);

            // Should return 401 with TOKEN_EXPIRED code
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
              expect.objectContaining({
                error: 'Token expired',
                code: 'TOKEN_EXPIRED',
              })
            );
            expect(mockNext).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept tokens with future expiration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sub: fc.string({ minLength: 5, maxLength: 20 }),
            email: fc.emailAddress(),
            expirationSecondsFromNow: fc.integer({ min: 60, max: 86400 }), // 1 minute to 1 day
          }),
          async ({ sub, email, expirationSecondsFromNow }) => {
            const futureTime = Math.floor(Date.now() / 1000) + expirationSecondsFromNow;
            const token = jwt.sign({ sub, email, exp: futureTime }, 'test-secret');

            mockReq.headers.authorization = `Bearer ${token}`;

            // Mock jwt.verify to succeed
            jest.spyOn(jwt, 'verify').mockImplementation((token, getKey, options, callback) => {
              callback(null, { sub, email, exp: futureTime });
            });

            await authenticateRequest(mockReq, mockRes, mockNext);

            // Should call next() without error
            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 31: User Identity Extraction
   *
   * **Validates: Requirement 8.7**
   *
   * For any valid JWT token, the backend SHALL extract the user identity
   * (userId, email, username) from the token claims.
   *
   * This property verifies that:
   * 1. User identity is correctly extracted from token claims
   * 2. All required identity fields are present in req.user
   * 3. Identity extraction is consistent across different token formats
   */
  describe('Property 31: User Identity Extraction', () => {
    it('should extract user identity from valid tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sub: fc.string({ minLength: 5, maxLength: 36 }),
            email: fc.emailAddress(),
            username: fc.string({ minLength: 3, maxLength: 20 }),
          }),
          async ({ sub, email, username }) => {
            const token = jwt.sign(
              {
                sub,
                email,
                'cognito:username': username,
                exp: Math.floor(Date.now() / 1000) + 3600,
              },
              'test-secret'
            );

            mockReq.headers.authorization = `Bearer ${token}`;

            // Mock jwt.verify to succeed
            jest.spyOn(jwt, 'verify').mockImplementation((token, getKey, options, callback) => {
              callback(null, {
                sub,
                email,
                'cognito:username': username,
                exp: Math.floor(Date.now() / 1000) + 3600,
              });
            });

            await authenticateRequest(mockReq, mockRes, mockNext);

            // Should extract user identity
            expect(mockReq.user).toBeDefined();
            expect(mockReq.user.userId).toBe(sub);
            expect(mockReq.user.email).toBe(email);
            expect(mockReq.user.username).toBe(username);
            expect(mockNext).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle tokens with standard username claim', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sub: fc.string({ minLength: 5, maxLength: 36 }),
            email: fc.emailAddress(),
            username: fc.string({ minLength: 3, maxLength: 20 }),
          }),
          async ({ sub, email, username }) => {
            const token = jwt.sign(
              {
                sub,
                email,
                username, // Standard claim instead of cognito:username
                exp: Math.floor(Date.now() / 1000) + 3600,
              },
              'test-secret'
            );

            mockReq.headers.authorization = `Bearer ${token}`;

            // Mock jwt.verify to succeed
            jest.spyOn(jwt, 'verify').mockImplementation((token, getKey, options, callback) => {
              callback(null, {
                sub,
                email,
                username,
                exp: Math.floor(Date.now() / 1000) + 3600,
              });
            });

            await authenticateRequest(mockReq, mockRes, mockNext);

            // Should extract user identity with fallback to standard username
            expect(mockReq.user).toBeDefined();
            expect(mockReq.user.userId).toBe(sub);
            expect(mockReq.user.email).toBe(email);
            expect(mockReq.user.username).toBe(username);
            expect(mockNext).toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should extract groups from token claims', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sub: fc.string({ minLength: 5, maxLength: 36 }),
            email: fc.emailAddress(),
            groups: fc.array(fc.string({ minLength: 3, maxLength: 20 }), {
              minLength: 0,
              maxLength: 5,
            }),
          }),
          async ({ sub, email, groups }) => {
            const token = jwt.sign(
              {
                sub,
                email,
                'cognito:groups': groups,
                exp: Math.floor(Date.now() / 1000) + 3600,
              },
              'test-secret'
            );

            mockReq.headers.authorization = `Bearer ${token}`;

            // Mock jwt.verify to succeed
            jest.spyOn(jwt, 'verify').mockImplementation((token, getKey, options, callback) => {
              callback(null, {
                sub,
                email,
                'cognito:groups': groups,
                exp: Math.floor(Date.now() / 1000) + 3600,
              });
            });

            await authenticateRequest(mockReq, mockRes, mockNext);

            // Should extract groups
            expect(mockReq.user).toBeDefined();
            expect(mockReq.user.groups).toEqual(groups);
            expect(mockNext).toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle tokens without groups claim', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sub: fc.string({ minLength: 5, maxLength: 36 }),
            email: fc.emailAddress(),
          }),
          async ({ sub, email }) => {
            const token = jwt.sign(
              {
                sub,
                email,
                exp: Math.floor(Date.now() / 1000) + 3600,
              },
              'test-secret'
            );

            mockReq.headers.authorization = `Bearer ${token}`;

            // Mock jwt.verify to succeed
            jest.spyOn(jwt, 'verify').mockImplementation((token, getKey, options, callback) => {
              callback(null, {
                sub,
                email,
                exp: Math.floor(Date.now() / 1000) + 3600,
              });
            });

            await authenticateRequest(mockReq, mockRes, mockNext);

            // Should have empty groups array
            expect(mockReq.user).toBeDefined();
            expect(mockReq.user.groups).toEqual([]);
            expect(mockNext).toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional Property: Consistent Error Response Format
   *
   * This property verifies that all authentication errors return
   * a consistent JSON response format with error, code, details, and requestId.
   */
  describe('Additional Property: Consistent Error Response Format', () => {
    it('should return consistent error format for all auth failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant({ type: 'missing', authHeader: undefined }),
            fc.constant({ type: 'invalid_format', authHeader: 'InvalidFormat token' }),
            fc.constant({ type: 'expired', authHeader: 'Bearer expired-token' }),
            fc.constant({ type: 'invalid', authHeader: 'Bearer invalid-token' })
          ),
          async ({ type, authHeader }) => {
            if (authHeader) {
              mockReq.headers.authorization = authHeader;
            }

            // Mock jwt.verify based on type
            if (type === 'expired') {
              jest.spyOn(jwt, 'verify').mockImplementation((token, getKey, options, callback) => {
                const error = new Error('jwt expired');
                error.name = 'TokenExpiredError';
                callback(error);
              });
            } else if (type === 'invalid') {
              jest.spyOn(jwt, 'verify').mockImplementation((token, getKey, options, callback) => {
                const error = new Error('invalid token');
                error.name = 'JsonWebTokenError';
                callback(error);
              });
            }

            await authenticateRequest(mockReq, mockRes, mockNext);

            // Should return 401
            expect(mockRes.status).toHaveBeenCalledWith(401);

            // Should have consistent error format
            const errorResponse = mockRes.json.mock.calls[0][0];
            expect(errorResponse).toHaveProperty('error');
            expect(errorResponse).toHaveProperty('code');
            expect(errorResponse).toHaveProperty('details');
            expect(errorResponse).toHaveProperty('requestId');
            expect(errorResponse.requestId).toBe('test-request-id');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
