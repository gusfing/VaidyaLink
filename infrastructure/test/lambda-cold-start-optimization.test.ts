/**
 * Unit tests for Lambda Cold Start Optimization CDK construct
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {
  LambdaColdStartOptimization,
  getOptimizationConfig,
  estimateColdStartCosts,
} from '../lib/constructs/lambda-cold-start-optimization';

describe('Lambda Cold Start Optimization', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let testFunction: lambda.Function;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');

    // Create a test Lambda function
    testFunction = new lambda.Function(stack, 'TestFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline('def handler(event, context): return "Hello"'),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
    });
  });

  describe('Basic Configuration', () => {
    test('creates optimization construct with default config', () => {
      new LambdaColdStartOptimization(stack, 'Optimization', testFunction);

      const template = Template.fromStack(stack);

      // Should create outputs
      template.hasOutput('LayerCount', {});
      template.hasOutput('OptimizationEnabled', {
        Value: 'true',
      });
    });

    test('adds optimization environment variables', () => {
      new LambdaColdStartOptimization(stack, 'Optimization', testFunction);

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            PYTHONUNBUFFERED: '1',
            PYTHONDONTWRITEBYTECODE: '1',
            PADDLE_SKIP_SIGNAL_HANDLER: '1',
            USE_GPU: 'false',
            LOG_LEVEL: 'INFO',
          }),
        },
      });
    });
  });

  describe('Lambda Layers', () => {
    test('attaches layers when ARNs provided', () => {
      const layerArns = {
        awsSdk: 'arn:aws:lambda:us-east-1:123456789012:layer:aws-sdk:1',
        imageProcessing: 'arn:aws:lambda:us-east-1:123456789012:layer:image-processing:1',
        paddleOcr: 'arn:aws:lambda:us-east-1:123456789012:layer:paddleocr:1',
        utilities: 'arn:aws:lambda:us-east-1:123456789012:layer:utilities:1',
      };

      const optimization = new LambdaColdStartOptimization(
        stack,
        'Optimization',
        testFunction,
        { enableLayers: true },
        layerArns
      );

      expect(optimization.layers).toHaveLength(4);
    });

    test('does not attach layers when disabled', () => {
      const optimization = new LambdaColdStartOptimization(stack, 'Optimization', testFunction, {
        enableLayers: false,
      });

      expect(optimization.layers).toHaveLength(0);
    });
  });

  describe('Provisioned Concurrency', () => {
    test('creates alias with provisioned concurrency when enabled', () => {
      const optimization = new LambdaColdStartOptimization(stack, 'Optimization', testFunction, {
        enableProvisionedConcurrency: true,
        provisionedConcurrentExecutions: 5,
      });

      expect(optimization.alias).toBeDefined();

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Lambda::Alias', {
        Name: 'prod',
        ProvisionedConcurrencyConfig: {
          ProvisionedConcurrentExecutions: 5,
        },
      });

      template.hasOutput('ProvisionedConcurrency', {
        Value: '5',
      });
    });

    test('does not create alias when provisioned concurrency disabled', () => {
      const optimization = new LambdaColdStartOptimization(stack, 'Optimization', testFunction, {
        enableProvisionedConcurrency: false,
      });

      expect(optimization.alias).toBeUndefined();

      const template = Template.fromStack(stack);

      // Should not have alias resource
      expect(() => {
        template.hasResourceProperties('AWS::Lambda::Alias', {});
      }).toThrow();
    });

    test('configures auto-scaling when enabled', () => {
      new LambdaColdStartOptimization(stack, 'Optimization', testFunction, {
        enableProvisionedConcurrency: true,
        provisionedConcurrentExecutions: 5,
        enableAutoScaling: true,
        minProvisionedConcurrency: 2,
        maxProvisionedConcurrency: 10,
        targetUtilization: 0.7,
      });

      const template = Template.fromStack(stack);

      // Should create auto-scaling target
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', {
        MinCapacity: 2,
        MaxCapacity: 10,
      });

      // Should create scaling policy
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
        TargetTrackingScalingPolicyConfiguration: {
          TargetValue: 0.7,
        },
      });
    });
  });

  describe('X-Ray Tracing', () => {
    test('adds X-Ray environment variables when enabled', () => {
      new LambdaColdStartOptimization(stack, 'Optimization', testFunction, {
        enableXRayTracing: true,
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            AWS_XRAY_TRACING_NAME: Match.anyValue(),
            AWS_XRAY_CONTEXT_MISSING: 'LOG_ERROR',
          }),
        },
      });
    });
  });

  describe('CloudWatch Insights', () => {
    test('creates insights query outputs when enabled', () => {
      new LambdaColdStartOptimization(stack, 'Optimization', testFunction, {
        enableCloudWatchInsights: true,
      });

      const template = Template.fromStack(stack);

      template.hasOutput('ColdStartQuery', {});
      template.hasOutput('ColdVsWarmQuery', {});
      template.hasOutput('MemoryUsageQuery', {});
    });
  });

  describe('Reserved Concurrency', () => {
    test('outputs reserved concurrency when configured', () => {
      new LambdaColdStartOptimization(stack, 'Optimization', testFunction, {
        reservedConcurrentExecutions: 10,
      });

      const template = Template.fromStack(stack);

      template.hasOutput('ReservedConcurrency', {
        Value: '10',
      });
    });
  });
});

describe('Optimization Config Helper', () => {
  test('returns production config', () => {
    const config = getOptimizationConfig('production');

    expect(config.enableLayers).toBe(true);
    expect(config.enableProvisionedConcurrency).toBe(true);
    expect(config.provisionedConcurrentExecutions).toBe(5);
    expect(config.enableAutoScaling).toBe(true);
    expect(config.reservedConcurrentExecutions).toBe(20);
  });

  test('returns staging config', () => {
    const config = getOptimizationConfig('staging');

    expect(config.enableLayers).toBe(true);
    expect(config.enableProvisionedConcurrency).toBe(true);
    expect(config.provisionedConcurrentExecutions).toBe(2);
    expect(config.enableAutoScaling).toBe(false);
    expect(config.reservedConcurrentExecutions).toBe(10);
  });

  test('returns development config', () => {
    const config = getOptimizationConfig('development');

    expect(config.enableLayers).toBe(true);
    expect(config.enableProvisionedConcurrency).toBe(false);
  });
});

describe('Cost Estimation', () => {
  test('estimates costs with provisioned concurrency', () => {
    const costs = estimateColdStartCosts({
      enableProvisionedConcurrency: true,
      provisionedConcurrentExecutions: 5,
    });

    expect(costs.monthlyProvisionedConcurrencyCost).toBeGreaterThan(0);
    expect(costs.monthlySavingsFromLayers).toBeGreaterThan(0);
    expect(costs.netMonthlyCost).toBeDefined();
  });

  test('estimates zero cost without provisioned concurrency', () => {
    const costs = estimateColdStartCosts({
      enableProvisionedConcurrency: false,
    });

    expect(costs.monthlyProvisionedConcurrencyCost).toBe(0);
    expect(costs.monthlySavingsFromLayers).toBeGreaterThan(0);
  });

  test('calculates net cost correctly', () => {
    const costs = estimateColdStartCosts({
      enableProvisionedConcurrency: true,
      provisionedConcurrentExecutions: 5,
    });

    expect(costs.netMonthlyCost).toBe(
      costs.monthlyProvisionedConcurrencyCost - costs.monthlySavingsFromLayers
    );
  });
});
