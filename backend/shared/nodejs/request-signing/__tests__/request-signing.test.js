const { generateSignature, verifySignature, createSignatureMiddleware } = require('../index');

describe('Request Signing', () => {
  const testSecret = 'test-secret-key-12345';
  const testTimestamp = Math.floor(Date.now() / 1000);

  describe('generateSignature', () => {
    it('should generate consistent signatures for same input', () => {
      const params = {
        method: 'POST',
        path: '/api/v1/patients/123/delete',
        headers: {},
        body: { patientId: '123' },
        secret: testSecret,
        timestamp: testTimestamp,
      };

      const sig1 = generateSignature(params);
      const sig2 = generateSignature(params);

      expect(sig1).toBe(sig2);
      expect(sig1).toHaveLength(64); // SHA256 hex length
    });

    it('should generate different signatures for different methods', () => {
      const baseParams = {
        path: '/api/v1/patients/123',
        headers: {},
        body: {},
        secret: testSecret,
        timestamp: testTimestamp,
      };

      const getSig = generateSignature({ ...baseParams, method: 'GET' });
      const postSig = generateSignature({ ...baseParams, method: 'POST' });

      expect(getSig).not.toBe(postSig);
    });

    it('should generate different signatures for different paths', () => {
      const baseParams = {
        method: 'POST',
        headers: {},
        body: {},
        secret: testSecret,
        timestamp: testTimestamp,
      };

      const sig1 = generateSignature({ ...baseParams, path: '/api/v1/path1' });
      const sig2 = generateSignature({ ...baseParams, path: '/api/v1/path2' });

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different bodies', () => {
      const baseParams = {
        method: 'POST',
        path: '/api/v1/test',
        headers: {},
        secret: testSecret,
        timestamp: testTimestamp,
      };

      const sig1 = generateSignature({ ...baseParams, body: { data: 'value1' } });
      const sig2 = generateSignature({ ...baseParams, body: { data: 'value2' } });

      expect(sig1).not.toBe(sig2);
    });

    it('should handle string body', () => {
      const params = {
        method: 'POST',
        path: '/api/v1/test',
        headers: {},
        body: '{"data":"value"}',
        secret: testSecret,
        timestamp: testTimestamp,
      };

      const signature = generateSignature(params);
      expect(signature).toBeTruthy();
      expect(signature).toHaveLength(64);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const params = {
        method: 'POST',
        path: '/api/v1/test',
        headers: {},
        body: { data: 'value' },
        secret: testSecret,
        timestamp: testTimestamp,
      };

      const signature = generateSignature(params);

      const result = verifySignature({
        method: params.method,
        path: params.path,
        headers: params.headers,
        body: params.body,
        secret: testSecret,
        providedSignature: signature,
        providedTimestamp: testTimestamp,
        maxAgeSeconds: 300,
      });

      expect(result.valid).toBe(true);
    });

    it('should reject expired request', () => {
      const oldTimestamp = testTimestamp - 400; // 400 seconds ago

      const params = {
        method: 'POST',
        path: '/api/v1/test',
        headers: {},
        body: {},
        secret: testSecret,
        timestamp: oldTimestamp,
      };

      const signature = generateSignature(params);

      const result = verifySignature({
        method: params.method,
        path: params.path,
        headers: params.headers,
        body: params.body,
        secret: testSecret,
        providedSignature: signature,
        providedTimestamp: oldTimestamp,
        maxAgeSeconds: 300,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('REQUEST_EXPIRED');
    });

    it('should reject future timestamp', () => {
      const futureTimestamp = testTimestamp + 120; // 2 minutes in future

      const params = {
        method: 'POST',
        path: '/api/v1/test',
        headers: {},
        body: {},
        secret: testSecret,
        timestamp: futureTimestamp,
      };

      const signature = generateSignature(params);

      const result = verifySignature({
        method: params.method,
        path: params.path,
        headers: params.headers,
        body: params.body,
        secret: testSecret,
        providedSignature: signature,
        providedTimestamp: futureTimestamp,
        maxAgeSeconds: 300,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('TIMESTAMP_FUTURE');
    });

    it('should reject invalid signature', () => {
      const result = verifySignature({
        method: 'POST',
        path: '/api/v1/test',
        headers: {},
        body: {},
        secret: testSecret,
        providedSignature: 'invalid-signature-12345',
        providedTimestamp: testTimestamp,
        maxAgeSeconds: 300,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_SIGNATURE');
    });

    it('should reject signature with wrong secret', () => {
      const params = {
        method: 'POST',
        path: '/api/v1/test',
        headers: {},
        body: {},
        secret: testSecret,
        timestamp: testTimestamp,
      };

      const signature = generateSignature(params);

      const result = verifySignature({
        method: params.method,
        path: params.path,
        headers: params.headers,
        body: params.body,
        secret: 'wrong-secret',
        providedSignature: signature,
        providedTimestamp: testTimestamp,
        maxAgeSeconds: 300,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_SIGNATURE');
    });
  });

  describe('createSignatureMiddleware', () => {
    it('should throw error if getSecret is not provided', () => {
      expect(() => createSignatureMiddleware()).toThrow('getSecret function is required');
    });

    it('should skip verification for non-sensitive operations', async () => {
      const getSecret = jest.fn();
      const middleware = createSignatureMiddleware({
        getSecret,
        sensitiveOperations: ['/delete', '/update'],
      });

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/patients/123',
        headers: {},
        body: '',
      };

      const result = await middleware(event);

      expect(result.verified).toBe(true);
      expect(result.skipped).toBe(true);
      expect(getSecret).not.toHaveBeenCalled();
    });

    it('should require signature for sensitive operations', async () => {
      const getSecret = jest.fn();
      const middleware = createSignatureMiddleware({
        getSecret,
        sensitiveOperations: ['/delete'],
      });

      const event = {
        httpMethod: 'DELETE',
        path: '/api/v1/patients/123/delete',
        headers: {},
        body: '',
      };

      const result = await middleware(event);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error).toBe('MISSING_SIGNATURE');
    });

    it('should verify valid signature', async () => {
      const getSecret = jest.fn().mockResolvedValue(testSecret);
      const middleware = createSignatureMiddleware({
        getSecret,
        maxAgeSeconds: 300,
      });

      const body = { patientId: '123' };
      const signature = generateSignature({
        method: 'DELETE',
        path: '/api/v1/patients/123/delete',
        headers: {},
        body,
        secret: testSecret,
        timestamp: testTimestamp,
      });

      const event = {
        httpMethod: 'DELETE',
        path: '/api/v1/patients/123/delete',
        headers: {
          'X-VaidyaLink-Signature': signature,
          'X-VaidyaLink-Timestamp': testTimestamp.toString(),
        },
        body: JSON.stringify(body),
      };

      const result = await middleware(event);

      expect(result.verified).toBe(true);
      expect(getSecret).toHaveBeenCalledWith(event);
    });

    it('should reject invalid signature', async () => {
      const getSecret = jest.fn().mockResolvedValue(testSecret);
      const middleware = createSignatureMiddleware({ getSecret });

      const event = {
        httpMethod: 'DELETE',
        path: '/api/v1/patients/123/delete',
        headers: {
          'X-VaidyaLink-Signature': 'invalid-signature',
          'X-VaidyaLink-Timestamp': testTimestamp.toString(),
        },
        body: '',
      };

      const result = await middleware(event);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error).toBe('INVALID_SIGNATURE');
    });

    it('should handle getSecret errors', async () => {
      const getSecret = jest.fn().mockRejectedValue(new Error('Secret retrieval failed'));
      const middleware = createSignatureMiddleware({ getSecret });

      const event = {
        httpMethod: 'DELETE',
        path: '/api/v1/test',
        headers: {
          'X-VaidyaLink-Signature': 'some-signature',
          'X-VaidyaLink-Timestamp': testTimestamp.toString(),
        },
        body: '',
      };

      const result = await middleware(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toBe('INTERNAL_ERROR');
    });
  });
});
