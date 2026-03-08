import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CorsConfig } from '../lib/constructs/cors';

describe('CorsConfig', () => {
  describe('Production Environment', () => {
    let stack: cdk.Stack;
    let corsOptions: any;

    beforeEach(() => {
      const app = new cdk.App();
      stack = new cdk.Stack(app, 'TestStack');

      corsOptions = CorsConfig.createRestApiCors(stack, 'ProductionCors', {
        environment: 'production',
      });
    });

    test('should create CORS configuration with production origins', () => {
      expect(corsOptions.allowOrigins).toContain('https://vaidyalink.com');
      expect(corsOptions.allowOrigins).toContain('https://www.vaidyalink.com');
      expect(corsOptions.allowOrigins).toContain('https://app.vaidyalink.com');
    });

    test('should set appropriate max age', () => {
      expect(corsOptions.maxAge.toSeconds()).toBe(3600);
    });
  });

  describe('Staging Environment', () => {
    let stack: cdk.Stack;
    let corsOptions: any;

    beforeEach(() => {
      const app = new cdk.App();
      stack = new cdk.Stack(app, 'TestStack');

      corsOptions = CorsConfig.createRestApiCors(stack, 'StagingCors', {
        environment: 'staging',
      });
    });

    test('should include staging origins', () => {
      expect(corsOptions.allowOrigins).toContain('https://staging.vaidyalink.com');
      expect(corsOptions.allowOrigins).toContain('https://staging-app.vaidyalink.com');
    });

    test('should not include production origins', () => {
      expect(corsOptions.allowOrigins).not.toContain('https://vaidyalink.com');
      expect(corsOptions.allowOrigins).not.toContain('https://www.vaidyalink.com');
    });

    test('should allow standard HTTP methods', () => {
      expect(corsOptions.allowMethods).toContain('GET');
      expect(corsOptions.allowMethods).toContain('POST');
      expect(corsOptions.allowMethods).toContain('PUT');
      expect(corsOptions.allowMethods).toContain('PATCH');
      expect(corsOptions.allowMethods).toContain('DELETE');
      expect(corsOptions.allowMethods).toContain('OPTIONS');
    });

    test('should include required headers', () => {
      expect(corsOptions.allowHeaders).toContain('Content-Type');
      expect(corsOptions.allowHeaders).toContain('Authorization');
      expect(corsOptions.allowHeaders).toContain('X-Amz-Date');
      expect(corsOptions.allowHeaders).toContain('X-Api-Key');
      expect(corsOptions.allowHeaders).toContain('X-Amz-Security-Token');
    });

    test('should expose response headers', () => {
      expect(corsOptions.exposeHeaders).toContain('X-Request-Id');
      expect(corsOptions.exposeHeaders).toContain('X-Amzn-RequestId');
      expect(corsOptions.exposeHeaders).toContain('X-Amzn-Trace-Id');
    });

    test('should allow credentials', () => {
      expect(corsOptions.allowCredentials).toBe(true);
    });
  });

  describe('Development Environment', () => {
    let stack: cdk.Stack;
    let corsOptions: any;

    beforeEach(() => {
      const app = new cdk.App();
      stack = new cdk.Stack(app, 'TestStack');

      corsOptions = CorsConfig.createRestApiCors(stack, 'DevCors', {
        environment: 'dev',
      });
    });

    test('should include localhost origins', () => {
      expect(corsOptions.allowOrigins).toContain('http://localhost:3000');
      expect(corsOptions.allowOrigins).toContain('http://localhost:3001');
      expect(corsOptions.allowOrigins).toContain('http://127.0.0.1:3000');
    });

    test('should include dev domain', () => {
      expect(corsOptions.allowOrigins).toContain('https://dev.vaidyalink.com');
    });

    test('should not include production origins', () => {
      expect(corsOptions.allowOrigins).not.toContain('https://vaidyalink.com');
    });
  });

  describe('Custom Origins', () => {
    let stack: cdk.Stack;
    let corsOptions: any;

    beforeEach(() => {
      const app = new cdk.App();
      stack = new cdk.Stack(app, 'TestStack');

      corsOptions = CorsConfig.createRestApiCors(stack, 'CustomCors', {
        environment: 'production',
        allowedOrigins: ['https://custom1.com', 'https://custom2.com'],
      });
    });

    test('should use custom origins instead of defaults', () => {
      expect(corsOptions.allowOrigins).toContain('https://custom1.com');
      expect(corsOptions.allowOrigins).toContain('https://custom2.com');
      expect(corsOptions.allowOrigins).not.toContain('https://vaidyalink.com');
    });
  });

  describe('Custom Max Age', () => {
    let stack: cdk.Stack;
    let corsOptions: any;

    beforeEach(() => {
      const app = new cdk.App();
      stack = new cdk.Stack(app, 'TestStack');

      corsOptions = CorsConfig.createRestApiCors(stack, 'CustomMaxAgeCors', {
        environment: 'production',
        maxAge: cdk.Duration.hours(2),
      });
    });

    test('should use custom max age', () => {
      expect(corsOptions.maxAge.toSeconds()).toBe(7200);
    });
  });

  describe('Credentials Configuration', () => {
    test('should allow credentials by default', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      const corsOptions = CorsConfig.createRestApiCors(stack, 'DefaultCredentialsCors', {
        environment: 'production',
      });

      expect(corsOptions.allowCredentials).toBe(true);
    });

    test('should disable credentials when explicitly set to false', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      const corsOptions = CorsConfig.createRestApiCors(stack, 'NoCredentialsCors', {
        environment: 'production',
        allowCredentials: false,
      });

      expect(corsOptions.allowCredentials).toBe(false);
    });
  });

  describe('getCorsResponseHeaders', () => {
    test('should return correct CORS headers', () => {
      const headers = CorsConfig.getCorsResponseHeaders('https://app.vaidyalink.com');

      expect(headers['Access-Control-Allow-Origin']).toBe('https://app.vaidyalink.com');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(headers['Access-Control-Max-Age']).toBe('3600');
    });

    test('should include all required headers', () => {
      const headers = CorsConfig.getCorsResponseHeaders('https://app.vaidyalink.com');

      expect(headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(headers).toHaveProperty('Access-Control-Allow-Credentials');
      expect(headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(headers).toHaveProperty('Access-Control-Expose-Headers');
      expect(headers).toHaveProperty('Access-Control-Max-Age');
    });
  });

  describe('isOriginAllowed', () => {
    const allowedOrigins = ['https://vaidyalink.com', 'https://app.vaidyalink.com'];

    test('should return true for allowed origin', () => {
      expect(CorsConfig.isOriginAllowed('https://vaidyalink.com', allowedOrigins)).toBe(true);
      expect(CorsConfig.isOriginAllowed('https://app.vaidyalink.com', allowedOrigins)).toBe(true);
    });

    test('should return false for disallowed origin', () => {
      expect(CorsConfig.isOriginAllowed('https://evil.com', allowedOrigins)).toBe(false);
      expect(CorsConfig.isOriginAllowed('http://localhost:3000', allowedOrigins)).toBe(false);
    });

    test('should be case-sensitive', () => {
      expect(CorsConfig.isOriginAllowed('https://VaidyaLink.com', allowedOrigins)).toBe(false);
      expect(CorsConfig.isOriginAllowed('HTTPS://vaidyalink.com', allowedOrigins)).toBe(false);
    });
  });

  describe('Unknown Environment', () => {
    let stack: cdk.Stack;
    let corsOptions: any;

    beforeEach(() => {
      const app = new cdk.App();
      stack = new cdk.Stack(app, 'TestStack');

      corsOptions = CorsConfig.createRestApiCors(stack, 'UnknownEnvCors', {
        environment: 'unknown',
      });
    });

    test('should default to localhost only for unknown environments', () => {
      expect(corsOptions.allowOrigins).toContain('http://localhost:3000');
      expect(corsOptions.allowOrigins).toContain('http://127.0.0.1:3000');
      expect(corsOptions.allowOrigins.length).toBe(2);
    });
  });

  describe('Security Headers', () => {
    let stack: cdk.Stack;
    let corsOptions: any;

    beforeEach(() => {
      const app = new cdk.App();
      stack = new cdk.Stack(app, 'TestStack');

      corsOptions = CorsConfig.createRestApiCors(stack, 'SecurityCors', {
        environment: 'production',
      });
    });

    test('should include X-Request-Id for request tracing', () => {
      expect(corsOptions.allowHeaders).toContain('X-Request-Id');
      expect(corsOptions.exposeHeaders).toContain('X-Request-Id');
    });

    test('should include AWS signature headers', () => {
      expect(corsOptions.allowHeaders).toContain('X-Amz-Date');
      expect(corsOptions.allowHeaders).toContain('X-Amz-Security-Token');
      expect(corsOptions.allowHeaders).toContain('X-Amz-User-Agent');
    });

    test('should expose AWS request tracking headers', () => {
      expect(corsOptions.exposeHeaders).toContain('X-Amzn-RequestId');
      expect(corsOptions.exposeHeaders).toContain('X-Amzn-Trace-Id');
    });

    test('should include Accept-Language for multilingual support', () => {
      expect(corsOptions.allowHeaders).toContain('Accept-Language');
    });
  });

  describe('Integration with API Gateway', () => {
    test('should be compatible with API Gateway CORS options', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      const corsOptions = CorsConfig.createRestApiCors(stack, 'ApiGatewayCors', {
        environment: 'production',
      });

      // Verify structure matches API Gateway expectations
      expect(corsOptions).toHaveProperty('allowOrigins');
      expect(corsOptions).toHaveProperty('allowMethods');
      expect(corsOptions).toHaveProperty('allowHeaders');
      expect(corsOptions).toHaveProperty('exposeHeaders');
      expect(corsOptions).toHaveProperty('allowCredentials');
      expect(corsOptions).toHaveProperty('maxAge');

      // Verify types
      expect(Array.isArray(corsOptions.allowOrigins)).toBe(true);
      expect(Array.isArray(corsOptions.allowMethods)).toBe(true);
      expect(Array.isArray(corsOptions.allowHeaders)).toBe(true);
      expect(Array.isArray(corsOptions.exposeHeaders)).toBe(true);
      expect(typeof corsOptions.allowCredentials).toBe('boolean');
    });
  });
});
