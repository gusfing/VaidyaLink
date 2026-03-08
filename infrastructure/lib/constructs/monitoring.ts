import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface MonitoringConstructProps {
  environment: string;
  restApi: apigateway.RestApi;
  lambdaFunctions: lambda.Function[];
}

export class MonitoringConstruct extends Construct {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringConstructProps) {
    super(scope, id);

    const { environment, restApi, lambdaFunctions } = props;

    // ========================================
    // SNS Topic for Alarms
    // ========================================

    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `vaidyalink-alarms-${environment}`,
      displayName: 'VaidyaLink System Alarms',
    });

    // ========================================
    // CloudWatch Dashboard
    // ========================================

    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `VaidyaLink-${environment}`,
    });

    // API Gateway Metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: [
          restApi.metricCount({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '4XXError',
            dimensionsMap: { ApiName: restApi.restApiName },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            dimensionsMap: { ApiName: restApi.restApiName },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Latency',
        left: [
          restApi.metricLatency({ statistic: 'Average', period: cdk.Duration.minutes(5) }),
          restApi.metricLatency({ statistic: 'p99', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      })
    );

    // Lambda Metrics
    const lambdaInvocations = lambdaFunctions.map((fn) =>
      fn.metricInvocations({ statistic: 'Sum', period: cdk.Duration.minutes(5) })
    );

    const lambdaErrors = lambdaFunctions.map((fn) =>
      fn.metricErrors({ statistic: 'Sum', period: cdk.Duration.minutes(5) })
    );

    const lambdaDuration = lambdaFunctions.map((fn) =>
      fn.metricDuration({ statistic: 'Average', period: cdk.Duration.minutes(5) })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: lambdaInvocations,
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: lambdaErrors,
        width: 12,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: lambdaDuration,
        width: 24,
      })
    );

    // ========================================
    // CloudWatch Alarms
    // ========================================

    // API Gateway 5xx Error Alarm
    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: `vaidyalink-api-5xx-${environment}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: { ApiName: restApi.restApiName },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    api5xxAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // API Gateway 4xx Error Rate Alarm
    const api4xxAlarm = new cloudwatch.Alarm(this, 'Api4xxAlarm', {
      alarmName: `vaidyalink-api-4xx-${environment}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        dimensionsMap: { ApiName: restApi.restApiName },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 50,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    api4xxAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // Lambda Error Rate Alarms
    lambdaFunctions.forEach((fn, index) => {
      const functionBaseName = fn.functionName || `function-${index}`;

      const errorAlarm = new cloudwatch.Alarm(this, `Lambda${index}ErrorAlarm`, {
        alarmName: `${environment}-lambda-${index}-errors`,
        metric: fn.metricErrors({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      errorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // Throttle Alarm
      const throttleAlarm = new cloudwatch.Alarm(this, `Lambda${index}ThrottleAlarm`, {
        alarmName: `${environment}-lambda-${index}-throttles`,
        metric: fn.metricThrottles({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      throttleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    });

    // Tags
    cdk.Tags.of(this.alarmTopic).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.alarmTopic).add('Environment', environment);
  }
}
