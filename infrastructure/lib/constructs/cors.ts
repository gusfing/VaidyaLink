import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

/**
 * CORS Configuration for VaidyaLink API Gateway
 *
 * Implements secure Cross-Origin Resource Sharing policies for the REST API.
 * Supports environment-specific origin whitelisting and security headers.
 *
 * Security Requirements:
 * - Task 6.3: Configure CORS policies
 * - Requirement 7: Security and Privacy
 */

export interface CorsConfigProps {
  /**
   * Deployment environment (dev, staging, production)
   */
  environment: string;

  /**
   * Custom allowed origins (optional)
   * If not provided, defaults to environment-specific origins
   */
  allowedOrigins?: string[];

  /**
   * Maximum age for preflight cache in seconds
   * @default 3600 (1 hour)
   */
  maxAge?: cdk.Duration;

  /**
   * Allow credentials (cookies, authorization headers)
   * @default true
   */
  allowCredentials?: boolean;
}

export class CorsConfig extends Construct {
  public readonly corsOptions: apigateway.CorsOptions;

  constructor(scope: Construct, id: string, props: CorsConfigProps) {
    super(scope, id);

    const { environment, allowedOrigins, maxAge, allowCredentials } = props;

    // Environment-specific origin configuration
    const origins = allowedOrigins || this.getDefaultOrigins(environment);

    // Standard headers required for VaidyaLink API
    const allowedHeaders = [
      'Content-Type',
      'Authorization',
      'X-Amz-Date',
      'X-Api-Key',
      'X-Amz-Security-Token',
      'X-Amz-User-Agent',
      'X-Request-Id',
      'Accept',
      'Accept-Language',
    ];

    // Exposed headers that clients can access
    const exposedHeaders = [
      'X-Request-Id',
      'X-Amzn-RequestId',
      'X-Amzn-Trace-Id',
      'Content-Length',
      'Content-Type',
      'Date',
    ];

    this.corsOptions = {
      allowOrigins: origins,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: allowedHeaders,
      exposeHeaders: exposedHeaders,
      allowCredentials: allowCredentials !== false,
      maxAge: maxAge || cdk.Duration.hours(1),
    };

    // Output CORS configuration for verification
    new cdk.CfnOutput(this, 'CorsAllowedOrigins', {
      value: origins.join(', '),
      description: `CORS allowed origins for ${environment}`,
    });

    new cdk.CfnOutput(this, 'CorsMaxAge', {
      value: (maxAge || cdk.Duration.hours(1)).toSeconds().toString(),
      description: 'CORS preflight cache duration in seconds',
    });
  }

  /**
   * Get default allowed origins based on environment
   */
  private getDefaultOrigins(environment: string): string[] {
    switch (environment) {
      case 'production':
        return [
          'https://vaidyalink.com',
          'https://www.vaidyalink.com',
          'https://app.vaidyalink.com',
        ];

      case 'staging':
        return ['https://staging.vaidyalink.com', 'https://staging-app.vaidyalink.com'];

      case 'dev':
      case 'development':
        return [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          'https://dev.vaidyalink.com',
        ];

      default:
        // For unknown environments, allow localhost only
        return ['http://localhost:3000', 'http://127.0.0.1:3000'];
    }
  }

  /**
   * Create CORS configuration for API Gateway REST API
   */
  public static createRestApiCors(
    scope: Construct,
    id: string,
    props: CorsConfigProps
  ): apigateway.CorsOptions {
    const corsConfig = new CorsConfig(scope, id, props);
    return corsConfig.corsOptions;
  }

  /**
   * Get CORS response headers for Lambda integration responses
   * Use this for custom Lambda responses that need CORS headers
   */
  public static getCorsResponseHeaders(allowedOrigin: string): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers':
        'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Request-Id',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'X-Request-Id,X-Amzn-RequestId,X-Amzn-Trace-Id',
      'Access-Control-Max-Age': '3600',
    };
  }

  /**
   * Validate origin against allowed origins
   * Use this in Lambda functions to validate request origin
   */
  public static isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    return allowedOrigins.includes(origin);
  }
}
