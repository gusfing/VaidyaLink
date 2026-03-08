const {
  SecurityHeadersMiddleware,
  createSecurityHeadersMiddleware,
  withSecurityHeaders,
  DEFAULT_HEADERS,
  PRESETS,
  getPreset,
} = require('../security-headers');

describe('SecurityHeadersMiddleware', () => {
  describe('constructor', () => {
    it('should initialize with default headers', () => {
      const middleware = new SecurityHeadersMiddleware();
      const headers = middleware.getHeaders();

      expect(headers).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(headers).toHaveProperty('X-Frame-Options', 'DENY');
      expect(headers).toHaveProperty('Strict-Transport-Security');
    });

    it('should merge custom headers with defaults', () => {
      const middleware = new SecurityHeadersMiddleware({
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      const headers = middleware.getHeaders();
      expect(headers).toHaveProperty('X-Custom-Header', 'custom-value');
      expect(headers).toHaveProperty('X-Content-Type-Options', 'nosniff');
    });

    it('should override default headers with custom values', () => {
      const middleware = new SecurityHeadersMiddleware({
        headers: {
          'X-Frame-Options': 'SAMEORIGIN',
        },
      });

      const headers = middleware.getHeaders();
      expect(headers).toHaveProperty('X-Frame-Options', 'SAMEORIGIN');
    });
  });

  describe('apply', () => {
    it('should add security headers to response', () => {
      const middleware = new SecurityHeadersMiddleware();
      const response = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' }),
      };

      const result = middleware.apply(response);

      expect(result.headers).toBeDefined();
      expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(result.headers['X-Frame-Options']).toBe('DENY');
      expect(result.headers['Strict-Transport-Security']).toContain('max-age=31536000');
    });

    it('should preserve existing headers', () => {
      const middleware = new SecurityHeadersMiddleware();
      const response = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value',
        },
        body: JSON.stringify({ message: 'Success' }),
      };

      const result = middleware.apply(response);

      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['X-Custom-Header']).toBe('custom-value');
      expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should not overwrite existing headers when overwrite is false', () => {
      const middleware = new SecurityHeadersMiddleware({ overwrite: false });
      const response = {
        statusCode: 200,
        headers: {
          'X-Frame-Options': 'SAMEORIGIN',
        },
        body: JSON.stringify({ message: 'Success' }),
      };

      const result = middleware.apply(response);

      expect(result.headers['X-Frame-Options']).toBe('SAMEORIGIN');
    });

    it('should overwrite existing headers when overwrite is true', () => {
      const middleware = new SecurityHeadersMiddleware({ overwrite: true });
      const response = {
        statusCode: 200,
        headers: {
          'X-Frame-Options': 'SAMEORIGIN',
        },
        body: JSON.stringify({ message: 'Success' }),
      };

      const result = middleware.apply(response);

      expect(result.headers['X-Frame-Options']).toBe('DENY');
    });

    it('should throw error if response is null', () => {
      const middleware = new SecurityHeadersMiddleware();

      expect(() => middleware.apply(null)).toThrow('Response object is required');
    });

    it('should create headers object if not present', () => {
      const middleware = new SecurityHeadersMiddleware();
      const response = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' }),
      };

      const result = middleware.apply(response);

      expect(result.headers).toBeDefined();
      expect(typeof result.headers).toBe('object');
    });
  });

  describe('setHeader', () => {
    it('should add new header', () => {
      const middleware = new SecurityHeadersMiddleware();
      middleware.setHeader('X-New-Header', 'new-value');

      const headers = middleware.getHeaders();
      expect(headers['X-New-Header']).toBe('new-value');
    });

    it('should update existing header', () => {
      const middleware = new SecurityHeadersMiddleware();
      middleware.setHeader('X-Frame-Options', 'SAMEORIGIN');

      const headers = middleware.getHeaders();
      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    });
  });

  describe('removeHeader', () => {
    it('should remove header', () => {
      const middleware = new SecurityHeadersMiddleware();
      middleware.removeHeader('X-Frame-Options');

      const headers = middleware.getHeaders();
      expect(headers['X-Frame-Options']).toBeUndefined();
    });

    it('should not throw error if header does not exist', () => {
      const middleware = new SecurityHeadersMiddleware();

      expect(() => middleware.removeHeader('Non-Existent-Header')).not.toThrow();
    });
  });
});

describe('createSecurityHeadersMiddleware', () => {
  it('should return a function', () => {
    const middleware = createSecurityHeadersMiddleware();

    expect(typeof middleware).toBe('function');
  });

  it('should apply headers when called', () => {
    const applyHeaders = createSecurityHeadersMiddleware();
    const response = {
      statusCode: 200,
      body: JSON.stringify({ message: 'Success' }),
    };

    const result = applyHeaders(response);

    expect(result.headers).toBeDefined();
    expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('should accept custom configuration', () => {
    const applyHeaders = createSecurityHeadersMiddleware({
      headers: {
        'X-Custom-Header': 'custom-value',
      },
    });
    const response = {
      statusCode: 200,
      body: JSON.stringify({ message: 'Success' }),
    };

    const result = applyHeaders(response);

    expect(result.headers['X-Custom-Header']).toBe('custom-value');
  });
});

describe('withSecurityHeaders', () => {
  it('should wrap handler and apply headers', async () => {
    const handler = async (event, context) => {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' }),
      };
    };

    const wrappedHandler = withSecurityHeaders(handler);
    const result = await wrappedHandler({}, {});

    expect(result.headers).toBeDefined();
    expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(result.headers['X-Frame-Options']).toBe('DENY');
  });

  it('should preserve handler response', async () => {
    const handler = async (event, context) => {
      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: 123, message: 'Created' }),
      };
    };

    const wrappedHandler = withSecurityHeaders(handler);
    const result = await wrappedHandler({}, {});

    expect(result.statusCode).toBe(201);
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.body).toContain('Created');
  });

  it('should apply headers to error responses', async () => {
    const handler = async (event, context) => {
      throw new Error('Test error');
    };

    const wrappedHandler = withSecurityHeaders(handler);
    const result = await wrappedHandler({}, {});

    expect(result.statusCode).toBe(500);
    expect(result.headers).toBeDefined();
    expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(result.body).toContain('Test error');
  });

  it('should accept custom configuration', async () => {
    const handler = async (event, context) => {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' }),
      };
    };

    const wrappedHandler = withSecurityHeaders(handler, {
      headers: {
        'X-Custom-Header': 'custom-value',
      },
    });
    const result = await wrappedHandler({}, {});

    expect(result.headers['X-Custom-Header']).toBe('custom-value');
  });
});

describe('DEFAULT_HEADERS', () => {
  it('should contain all required security headers', () => {
    expect(DEFAULT_HEADERS).toHaveProperty('X-Content-Type-Options');
    expect(DEFAULT_HEADERS).toHaveProperty('X-Frame-Options');
    expect(DEFAULT_HEADERS).toHaveProperty('X-XSS-Protection');
    expect(DEFAULT_HEADERS).toHaveProperty('Strict-Transport-Security');
    expect(DEFAULT_HEADERS).toHaveProperty('Referrer-Policy');
    expect(DEFAULT_HEADERS).toHaveProperty('Content-Security-Policy');
    expect(DEFAULT_HEADERS).toHaveProperty('Permissions-Policy');
  });

  it('should have secure default values', () => {
    expect(DEFAULT_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(DEFAULT_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(DEFAULT_HEADERS['Strict-Transport-Security']).toContain('max-age=31536000');
  });
});

describe('PRESETS', () => {
  it('should have strict preset', () => {
    expect(PRESETS).toHaveProperty('strict');
    expect(PRESETS.strict).toHaveProperty('headers');
  });

  it('should have api preset', () => {
    expect(PRESETS).toHaveProperty('api');
    expect(PRESETS.api).toHaveProperty('headers');
  });

  it('should have development preset', () => {
    expect(PRESETS).toHaveProperty('development');
    expect(PRESETS.development).toHaveProperty('headers');
  });

  it('strict preset should be more restrictive', () => {
    expect(PRESETS.strict.headers['Strict-Transport-Security']).toContain('max-age=63072000');
    expect(PRESETS.strict.headers['Referrer-Policy']).toBe('no-referrer');
  });

  it('development preset should be more relaxed', () => {
    expect(PRESETS.development.headers['X-Frame-Options']).toBe('SAMEORIGIN');
  });
});

describe('getPreset', () => {
  it('should return preset configuration', () => {
    const preset = getPreset('strict');

    expect(preset).toHaveProperty('headers');
    expect(preset.headers).toHaveProperty('X-Content-Type-Options');
  });

  it('should throw error for unknown preset', () => {
    expect(() => getPreset('unknown')).toThrow('Unknown preset');
  });

  it('should list available presets in error message', () => {
    try {
      getPreset('unknown');
    } catch (error) {
      expect(error.message).toContain('strict');
      expect(error.message).toContain('api');
      expect(error.message).toContain('development');
    }
  });
});

describe('Integration tests', () => {
  it('should work with preset configuration', async () => {
    const handler = async (event, context) => {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' }),
      };
    };

    const strictPreset = getPreset('strict');
    const wrappedHandler = withSecurityHeaders(handler, strictPreset);
    const result = await wrappedHandler({}, {});

    expect(result.headers['Referrer-Policy']).toBe('no-referrer');
    expect(result.headers['Strict-Transport-Security']).toContain('max-age=63072000');
  });

  it('should work with API preset for JSON responses', async () => {
    const handler = async (event, context) => {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: [1, 2, 3] }),
      };
    };

    const apiPreset = getPreset('api');
    const wrappedHandler = withSecurityHeaders(handler, apiPreset);
    const result = await wrappedHandler({}, {});

    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
  });
});
