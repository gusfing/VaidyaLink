import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Configuration for Lambda cold start optimization
 */
export interface ColdStartOptimizationConfig {
  /**
   * Enable Lambda layers for dependency management
   * @default true
   */
  enableLayers?: boolean;

  /**
   * Enable provisioned concurrency for production
   * @default false (only enable for production)
   */
  enableProvisionedConcurrency?: boolean;

  /**
   * Number of provisioned concurrent executions
   * @default 5
   */
  provisionedConcurrentExecutions?: number;

  /**
   * Enable auto-scaling for provisioned concurrency
   * @default false
   */
  enableAutoScaling?: boolean;

  /**
   * Minimum provisioned concurrency for auto-scaling
   * @default 2
   */
  minProvisionedConcurrency?: number;

  /**
   * Maximum provisioned concurrency for auto-scaling
   * @default 10
   */
  maxProvisionedConcurrency?: number;

  /**
   * Target utilization for auto-scaling (0.0 to 1.0)
   * @default 0.7
   */
  targetUtilization?: number;

  /**
   * Enable X-Ray tracing for cold start monitoring
   * @default true
   */
  enableXRayTracing?: boolean;

  /**
   * Enable CloudWatch Insights for cold start analysis
   * @default true
   */
  enableCloudWatchInsights?: boolean;

  /**
   * Reserved concurrent executions (limits max concurrency)
   * @default undefined (no limit)
   */
  reservedConcurrentExecutions?: number;
}

/**
 * Lambda Layer ARNs for different regions
 */
export interface LayerArns {
  awsSdk?: string;
  imageProcessing?: string;
  paddleOcr?: string;
  utilities?: string;
}

/**
 * Construct for optimizing Lambda cold start performance
 */
export class LambdaColdStartOptimization extends Construct {
  public readonly layers: lambda.ILayerVersion[];
  public readonly alias?: lambda.Alias;

  constructor(
    scope: Construct,
    id: string,
    lambdaFunction: lambda.Function,
    config: ColdStartOptimizationConfig = {},
    layerArns?: LayerArns
  ) {
    super(scope, id);

    const {
      enableLayers = true,
      enableProvisionedConcurrency = false,
      provisionedConcurrentExecutions = 5,
      enableAutoScaling = false,
      minProvisionedConcurrency = 2,
      maxProvisionedConcurrency = 10,
      targetUtilization = 0.7,
      enableXRayTracing = true,
      enableCloudWatchInsights = true,
      reservedConcurrentExecutions,
    } = config;

    this.layers = [];

    // ========================================
    // 1. Lambda Layers
    // ========================================

    if (enableLayers && layerArns) {
      // AWS SDK Layer
      if (layerArns.awsSdk) {
        const awsSdkLayer = lambda.LayerVersion.fromLayerVersionArn(
          this,
          'AwsSdkLayer',
          layerArns.awsSdk
        );
        this.layers.push(awsSdkLayer);
      }

      // Image Processing Layer
      if (layerArns.imageProcessing) {
        const imageProcessingLayer = lambda.LayerVersion.fromLayerVersionArn(
          this,
          'ImageProcessingLayer',
          layerArns.imageProcessing
        );
        this.layers.push(imageProcessingLayer);
      }

      // PaddleOCR Layer
      if (layerArns.paddleOcr) {
        const paddleOcrLayer = lambda.LayerVersion.fromLayerVersionArn(
          this,
          'PaddleOcrLayer',
          layerArns.paddleOcr
        );
        this.layers.push(paddleOcrLayer);
      }

      // Utilities Layer
      if (layerArns.utilities) {
        const utilitiesLayer = lambda.LayerVersion.fromLayerVersionArn(
          this,
          'UtilitiesLayer',
          layerArns.utilities
        );
        this.layers.push(utilitiesLayer);
      }
    }

    // ========================================
    // 2. Environment Variables for Optimization
    // ========================================

    // Add optimization environment variables
    const optimizationEnvVars = {
      // Python optimization
      PYTHONUNBUFFERED: '1',
      PYTHONDONTWRITEBYTECODE: '1',

      // PaddleOCR optimization
      PADDLE_SKIP_SIGNAL_HANDLER: '1',
      USE_GPU: 'false',

      // Logging optimization
      LOG_LEVEL: 'INFO',
    };

    // Add to existing environment variables
    Object.entries(optimizationEnvVars).forEach(([key, value]) => {
      lambdaFunction.addEnvironment(key, value);
    });

    // ========================================
    // 3. X-Ray Tracing
    // ========================================

    if (enableXRayTracing) {
      // X-Ray is already enabled in the Lambda function configuration
      // Add X-Ray SDK environment variable
      lambdaFunction.addEnvironment('AWS_XRAY_TRACING_NAME', lambdaFunction.functionName);
      lambdaFunction.addEnvironment('AWS_XRAY_CONTEXT_MISSING', 'LOG_ERROR');
    }

    // ========================================
    // 4. Reserved Concurrent Executions
    // ========================================

    if (reservedConcurrentExecutions !== undefined) {
      // Note: This is set in the Lambda function configuration
      // We document it here for reference
      new cdk.CfnOutput(this, 'ReservedConcurrency', {
        value: reservedConcurrentExecutions.toString(),
        description: 'Reserved concurrent executions for Lambda function',
      });
    }

    // ========================================
    // 5. Provisioned Concurrency
    // ========================================

    if (enableProvisionedConcurrency) {
      // Create a version
      const version = lambdaFunction.currentVersion;

      // Create an alias with provisioned concurrency
      this.alias = new lambda.Alias(this, 'ProvisionedAlias', {
        aliasName: 'prod',
        version: version,
        provisionedConcurrentExecutions: provisionedConcurrentExecutions,
        description: 'Production alias with provisioned concurrency for cold start optimization',
      });

      // ========================================
      // 6. Auto-Scaling for Provisioned Concurrency
      // ========================================

      if (enableAutoScaling) {
        const target = this.alias.addAutoScaling({
          minCapacity: minProvisionedConcurrency,
          maxCapacity: maxProvisionedConcurrency,
        });

        // Scale based on utilization
        target.scaleOnUtilization({
          utilizationTarget: targetUtilization,
        });

        // Scale based on schedule (optional - example for business hours)
        // Uncomment and adjust as needed
        /*
        target.scaleOnSchedule('ScaleUpMorning', {
          schedule: appscaling.Schedule.cron({ hour: '8', minute: '0' }),
          minCapacity: maxProvisionedConcurrency,
        });

        target.scaleOnSchedule('ScaleDownEvening', {
          schedule: appscaling.Schedule.cron({ hour: '18', minute: '0' }),
          minCapacity: minProvisionedConcurrency,
        });
        */
      }

      // Output provisioned concurrency configuration
      new cdk.CfnOutput(this, 'ProvisionedConcurrency', {
        value: provisionedConcurrentExecutions.toString(),
        description: 'Provisioned concurrent executions',
      });

      new cdk.CfnOutput(this, 'AliasArn', {
        value: this.alias.functionArn,
        description: 'ARN of the alias with provisioned concurrency',
      });
    }

    // ========================================
    // 7. CloudWatch Insights Queries
    // ========================================

    if (enableCloudWatchInsights) {
      // Create CloudWatch Insights query definitions for cold start analysis
      this.createInsightsQueries(lambdaFunction);
    }

    // ========================================
    // 8. CloudWatch Alarms for Cold Start Monitoring
    // ========================================

    this.createColdStartAlarms(lambdaFunction);

    // ========================================
    // Outputs
    // ========================================

    new cdk.CfnOutput(this, 'LayerCount', {
      value: this.layers.length.toString(),
      description: 'Number of Lambda layers attached',
    });

    new cdk.CfnOutput(this, 'OptimizationEnabled', {
      value: 'true',
      description: 'Cold start optimization enabled',
    });
  }

  /**
   * Create CloudWatch Insights query definitions for cold start analysis
   */
  private createInsightsQueries(lambdaFunction: lambda.Function): void {
    // Query 1: Cold Start Analysis
    new cdk.CfnOutput(this, 'ColdStartQuery', {
      value: `
fields @timestamp, @duration, @initDuration
| filter @type = "REPORT"
| filter ispresent(@initDuration)
| stats count() as coldStarts, avg(@initDuration) as avgInitDuration, max(@initDuration) as maxInitDuration by bin(5m)
      `.trim(),
      description: 'CloudWatch Insights query for cold start analysis',
    });

    // Query 2: Cold vs Warm Comparison
    new cdk.CfnOutput(this, 'ColdVsWarmQuery', {
      value: `
fields @timestamp, @duration, @initDuration
| filter @type = "REPORT"
| stats
    count() as totalInvocations,
    sum(ispresent(@initDuration)) as coldStarts,
    avg(@duration) as avgDuration,
    avg(@initDuration) as avgInitDuration,
    pct(@duration, 50) as p50Duration,
    pct(@duration, 95) as p95Duration,
    pct(@duration, 99) as p99Duration
      `.trim(),
      description: 'CloudWatch Insights query for cold vs warm comparison',
    });

    // Query 3: Memory Usage Analysis
    new cdk.CfnOutput(this, 'MemoryUsageQuery', {
      value: `
fields @timestamp, @maxMemoryUsed, @memorySize
| filter @type = "REPORT"
| stats
    avg(@maxMemoryUsed) as avgMemoryUsed,
    max(@maxMemoryUsed) as maxMemoryUsed,
    avg(@memorySize) as memorySize,
    avg(@maxMemoryUsed / @memorySize * 100) as avgMemoryUtilization
      `.trim(),
      description: 'CloudWatch Insights query for memory usage analysis',
    });
  }

  /**
   * Create CloudWatch alarms for cold start monitoring
   */
  private createColdStartAlarms(lambdaFunction: lambda.Function): void {
    // Note: Alarms would be created here using CloudWatch metrics
    // This is a placeholder for documentation purposes

    new cdk.CfnOutput(this, 'AlarmRecommendations', {
      value: JSON.stringify({
        coldStartDuration: {
          metric: 'ColdStartDuration',
          threshold: 5000, // 5 seconds
          evaluationPeriods: 2,
          datapointsToAlarm: 2,
        },
        coldStartRate: {
          metric: 'ColdStartRate',
          threshold: 0.2, // 20%
          evaluationPeriods: 5,
          datapointsToAlarm: 3,
        },
      }),
      description: 'Recommended CloudWatch alarms for cold start monitoring',
    });
  }
}

/**
 * Helper function to get optimization recommendations based on environment
 */
export function getOptimizationConfig(environment: string): ColdStartOptimizationConfig {
  switch (environment) {
    case 'production':
      return {
        enableLayers: true,
        enableProvisionedConcurrency: true,
        provisionedConcurrentExecutions: 5,
        enableAutoScaling: true,
        minProvisionedConcurrency: 2,
        maxProvisionedConcurrency: 10,
        targetUtilization: 0.7,
        enableXRayTracing: true,
        enableCloudWatchInsights: true,
        reservedConcurrentExecutions: 20,
      };

    case 'staging':
      return {
        enableLayers: true,
        enableProvisionedConcurrency: true,
        provisionedConcurrentExecutions: 2,
        enableAutoScaling: false,
        enableXRayTracing: true,
        enableCloudWatchInsights: true,
        reservedConcurrentExecutions: 10,
      };

    case 'development':
    default:
      return {
        enableLayers: true,
        enableProvisionedConcurrency: false,
        enableXRayTracing: true,
        enableCloudWatchInsights: true,
      };
  }
}

/**
 * Helper function to estimate cold start optimization costs
 */
export function estimateColdStartCosts(config: ColdStartOptimizationConfig): {
  monthlyProvisionedConcurrencyCost: number;
  monthlySavingsFromLayers: number;
  netMonthlyCost: number;
} {
  const { enableProvisionedConcurrency = false, provisionedConcurrentExecutions = 5 } = config;

  // Provisioned concurrency cost: ~$0.015 per GB-hour
  // Assuming 1GB memory allocation
  const provisionedConcurrencyCostPerGBHour = 0.015;
  const hoursPerMonth = 730;
  const memoryGB = 1;

  const monthlyProvisionedConcurrencyCost = enableProvisionedConcurrency
    ? provisionedConcurrentExecutions *
      memoryGB *
      hoursPerMonth *
      provisionedConcurrencyCostPerGBHour
    : 0;

  // Estimated savings from layers (faster cold starts = lower costs)
  // Assuming 50% reduction in cold start time
  // Assuming 20% of invocations are cold starts
  // Assuming 10,000 invocations per month
  const invocationsPerMonth = 10000;
  const coldStartPercentage = 0.2;
  const coldStartReduction = 0.5;
  const costPerGBSecond = 0.0000166667;
  const coldStartTimeSavingsSeconds = 6; // 12s -> 6s
  const memoryMB = 1024;

  const monthlySavingsFromLayers =
    invocationsPerMonth *
    coldStartPercentage *
    coldStartReduction *
    (coldStartTimeSavingsSeconds * (memoryMB / 1024) * costPerGBSecond);

  const netMonthlyCost = monthlyProvisionedConcurrencyCost - monthlySavingsFromLayers;

  return {
    monthlyProvisionedConcurrencyCost,
    monthlySavingsFromLayers,
    netMonthlyCost,
  };
}
