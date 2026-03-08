/**
 * Unit tests for JWT authentication middleware
 */

const jwt = require('jsonwebtoken');
const { JWTValidator, createAuthMiddleware, hasRole, requireRole } = require('../auth');

// Mock jwks-rsa
jest.mock('jwks-rsa', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    getSigningKey: jest.fn(async () => ({
      getPublicKey: () => 'mock-public-key',
    })),
  })),
}));

describe('JWTValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new JWTValidator({
      region: 'ap-south-1',
      userPoolId: 'ap-south-1_TEST123',
      clientId: 'test-client-id',
    });
  });

  describe('extractToken', () => {
    it('should extract token from Bearer header', () => {
      const token = validator.extractToken('Bearer test-token-123');
      expect(token).toBe('test-token-123');
    });

    it('should throw error for missing header', () => {
      expect(() => validator.extractToken(null)).toThrow('Authorization header is missing');
    });

    it('should throw error for invalid format', () => {
      expect(() => validator.extractToken('test-token-123')).toThrow(
        'Invalid Authorization header format'
      );
    });

    it('should throw error for non-Bearer scheme', () => {
      expect(() => validator.extractToken('Basic test-token-123')).toThrow(
        'Invalid Authorization header format'
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      // Mock jwt.decode and jwt.verify
      const mockPayload = {
        sub: 'user-123',
        'cognito:username': 'testuser',
        email: 'test@example.com',
        token_use: 'access',
        iss: 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_TEST123',
      };

      jest.spyOn(jwt, 'decode').mockReturnValue({
        header: { kid: 'test-kid' },
        payload: mockPayload,
      });

      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload);

      const result = await validator.verifyToken('mock-token');

      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalled();
    });

    it('should throw error for expired token', async () => {
      jest.spyOn(jwt, 'decode').mockReturnValue({
        header: { kid: 'test-kid' },
      });

      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw error;
      });

      await expect(validator.verifyToken('expired-token')).rejects.toThrow('Token has expired');
    });

    it('should throw error for invalid token structure', async () => {
      jest.spyOn(jwt, 'decode').mockReturnValue(null);

      await expect(validator.verifyToken('invalid-token')).rejects.toThrow(
        'Invalid token structure'
      );
    });

    it('should throw error for invalid token_use', async () => {
      const mockPayload = {
        sub: 'user-123',
        token_use: 'refresh', // Invalid token_use
        iss: 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_TEST123',
      };

      jest.spyOn(jwt, 'decode').mockReturnValue({
        header: { kid: 'test-kid' },
      });

      jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload);

      await expect(validator.verifyToken('mock-token')).rejects.toThrow('Invalid token_use claim');
    });
  });
});

describe('createAuthMiddleware', () => {
  let authMiddleware;

  beforeEach(() => {
    authMiddleware = createAuthMiddleware({
      region: 'ap-south-1',
      userPoolId: 'ap-south-1_TEST123',
    });
  });

  it('should authenticate valid request', async () => {
    const mockPayload = {
      sub: 'user-123',
      'cognito:username': 'testuser',
      email: 'test@example.com',
      'cognito:groups': ['Patient'],
      token_use: 'access',
    };

    jest.spyOn(jwt, 'decode').mockReturnValue({
      header: { kid: 'test-kid' },
    });

    jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload);

    const event = {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    };

    const result = await authMiddleware(event);

    expect(result.authorized).toBe(true);
    expect(result.user.username).toBe('testuser');
    expect(result.user.groups).toEqual(['Patient']);
    expect(event.user).toBeDefined();
    expect(event.user.permissions).toBeDefined();
    expect(event.user.rateLimit).toBeDefined();
  });

  it('should reject request without authorization header', async () => {
    const event = {
      headers: {},
    };

    const result = await authMiddleware(event);

    expect(result.authorized).toBe(false);
    expect(result.error).toBe('Authorization header is missing');
  });

  it('should handle lowercase authorization header', async () => {
    const mockPayload = {
      sub: 'user-123',
      username: 'testuser',
      token_use: 'id',
    };

    jest.spyOn(jwt, 'decode').mockReturnValue({
      header: { kid: 'test-kid' },
    });

    jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload);

    const event = {
      headers: {
        authorization: 'Bearer valid-token',
      },
    };

    const result = await authMiddleware(event);

    expect(result.authorized).toBe(true);
  });
});

describe('hasRole', () => {
  it('should return true if user has required role', () => {
    const user = {
      groups: ['Patient', 'VerifiedUser'],
    };

    expect(hasRole(user, 'Patient')).toBe(true);
    expect(hasRole(user, ['Patient'])).toBe(true);
    expect(hasRole(user, ['Admin', 'Patient'])).toBe(true);
  });

  it('should return false if user does not have required role', () => {
    const user = {
      groups: ['Patient'],
    };

    expect(hasRole(user, 'Admin')).toBe(false);
    expect(hasRole(user, ['Admin', 'SuperAdmin'])).toBe(false);
  });

  it('should handle empty groups', () => {
    const user = {
      groups: [],
    };

    expect(hasRole(user, 'Patient')).toBe(false);
  });
});

describe('requireRole', () => {
  it('should authorize user with required role', () => {
    const event = {
      user: {
        groups: ['Admin', 'Patient'],
      },
    };

    const middleware = requireRole('Admin');
    const result = middleware(event);

    expect(result.authorized).toBe(true);
  });

  it('should reject user without required role', () => {
    const event = {
      user: {
        groups: ['Patient'],
      },
    };

    const middleware = requireRole(['Admin', 'SuperAdmin']);
    const result = middleware(event);

    expect(result.authorized).toBe(false);
    expect(result.error).toContain('Insufficient permissions');
  });

  it('should reject if user context is missing', () => {
    const event = {};

    const middleware = requireRole('Admin');
    const result = middleware(event);

    expect(result.authorized).toBe(false);
    expect(result.error).toContain('User context not found');
  });
});
