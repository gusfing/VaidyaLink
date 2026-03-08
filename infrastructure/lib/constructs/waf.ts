import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface WafConstructProps {
  /**
   * Name prefix for WAF resources
   */
  readonly namePrefix: string;

  /**
   * Environment (dev, staging, prod)
   */
  readonly environment: string;

  /**
   * Scope of the WAF (REGIONAL for API Gateway, CLOUDFRONT for CloudFront)
   */
  readonly scope: 'REGIONAL' | 'CLOUDFRONT';

  /**
   * Rate limit for requests per 5 minutes (default: 2000)
   */
  readonly rateLimit?: number;

  /**
   * Enable AWS managed rule sets
   */
  readonly enableManagedRules?: boolean;

  /**
   * Enable geo-blocking (list of country codes to block)
   */
  readonly blockedCountries?: string[];

  /**
   * Enable CloudWatch metrics
   */
  readonly enableMetrics?: boolean;
}

/**
 * WAF Construct for DDoS protection and security rules
 */
export class WafConstruct extends Construct {
  public readonly webAcl: wafv2.CfnWebACL;
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: WafConstructProps) {
    super(scope, id);

    const rateLimit = props.rateLimit ?? 2000;
    const enableManagedRules = props.enableManagedRules ?? true;
    const enableMetrics = props.enableMetrics ?? true;

    // Define WAF rules
    const rules: wafv2.CfnWebACL.RuleProperty[] = [];

    // Rule 1: Rate-based rule for DDoS protection
    rules.push({
      name: `${props.namePrefix}-RateLimit`,
      priority: 1,
      statement: {
        rateBasedStatement: {
          limit: rateLimit,
          aggregateKeyType: 'IP',
        },
      },
      action: {
        block: {
          customResponse: {
            responseCode: 429,
            customResponseBodyKey: 'rate-limit-response',
          },
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: enableMetrics,
        metricName: `${props.namePrefix}-RateLimit`,
      },
    });

    // Rule 2: AWS Managed Rules - Core Rule Set (CRS)
    if (enableManagedRules) {
      rules.push({
        name: `${props.namePrefix}-AWSManagedRulesCommonRuleSet`,
        priority: 2,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesCommonRuleSet',
            excludedRules: [],
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: enableMetrics,
          metricName: `${props.namePrefix}-CommonRuleSet`,
        },
      });

      // Rule 3: AWS Managed Rules - Known Bad Inputs
      rules.push({
        name: `${props.namePrefix}-AWSManagedRulesKnownBadInputsRuleSet`,
        priority: 3,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesKnownBadInputsRuleSet',
            excludedRules: [],
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: enableMetrics,
          metricName: `${props.namePrefix}-KnownBadInputs`,
        },
      });

      // Rule 4: AWS Managed Rules - SQL Injection
      rules.push({
        name: `${props.namePrefix}-AWSManagedRulesSQLiRuleSet`,
        priority: 4,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesSQLiRuleSet',
            excludedRules: [],
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: enableMetrics,
          metricName: `${props.namePrefix}-SQLi`,
        },
      });
    }

    // Rule 5: Geo-blocking (if specified)
    if (props.blockedCountries && props.blockedCountries.length > 0) {
      rules.push({
        name: `${props.namePrefix}-GeoBlocking`,
        priority: 5,
        statement: {
          geoMatchStatement: {
            countryCodes: props.blockedCountries,
          },
        },
        action: {
          block: {
            customResponse: {
              responseCode: 403,
              customResponseBodyKey: 'geo-block-response',
            },
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: enableMetrics,
          metricName: `${props.namePrefix}-GeoBlocking`,
        },
      });
    }

    // Rule 6: IP Reputation List (AWS managed)
    if (enableManagedRules) {
      rules.push({
        name: `${props.namePrefix}-AWSManagedRulesAmazonIpReputationList`,
        priority: 6,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesAmazonIpReputationList',
            excludedRules: [],
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: enableMetrics,
          metricName: `${props.namePrefix}-IpReputation`,
        },
      });
    }

    // Rule 7: Anonymous IP List (blocks VPNs, proxies, Tor)
    if (enableManagedRules) {
      rules.push({
        name: `${props.namePrefix}-AWSManagedRulesAnonymousIpList`,
        priority: 7,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesAnonymousIpList',
            excludedRules: [],
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: enableMetrics,
          metricName: `${props.namePrefix}-AnonymousIp`,
        },
      });
    }

    // Create Web ACL
    this.webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      name: `${props.namePrefix}-${props.environment}`,
      scope: props.scope,
      defaultAction: { allow: {} },
      rules,
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: enableMetrics,
        metricName: `${props.namePrefix}-WebACL`,
      },
      customResponseBodies: {
        'rate-limit-response': {
          contentType: 'APPLICATION_JSON',
          content: JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
          }),
        },
        'geo-block-response': {
          contentType: 'APPLICATION_JSON',
          content: JSON.stringify({
            error: 'Access denied',
            message: 'Access from your location is not permitted.',
          }),
        },
      },
      tags: [
        { key: 'Environment', value: props.environment },
        { key: 'ManagedBy', value: 'CDK' },
        { key: 'Project', value: 'VaidyaLink' },
      ],
    });

    this.webAclArn = this.webAcl.attrArn;

    // Create CloudWatch alarms if metrics are enabled
    if (enableMetrics) {
      this.createCloudWatchAlarms(props);
    }

    // Output the Web ACL ARN
    new cdk.CfnOutput(this, 'WebACLArn', {
      value: this.webAclArn,
      description: 'WAF Web ACL ARN',
      exportName: `${props.namePrefix}-${props.environment}-WebACLArn`,
    });
  }

  /**
   * Create CloudWatch alarms for WAF metrics
   */
  private createCloudWatchAlarms(props: WafConstructProps): void {
    // Alarm for blocked requests
    const blockedRequestsAlarm = new cloudwatch.Alarm(this, 'BlockedRequestsAlarm', {
      alarmName: `${props.namePrefix}-${props.environment}-BlockedRequests`,
      alarmDescription: 'Alert when WAF blocks exceed threshold',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/WAFV2',
        metricName: 'BlockedRequests',
        dimensionsMap: {
          WebACL: `${props.namePrefix}-${props.environment}`,
          Region: cdk.Stack.of(this).region,
          Rule: 'ALL',
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 100,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm for rate limit violations
    const rateLimitAlarm = new cloudwatch.Alarm(this, 'RateLimitAlarm', {
      alarmName: `${props.namePrefix}-${props.environment}-RateLimit`,
      alarmDescription: 'Alert when rate limit is frequently triggered',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/WAFV2',
        metricName: 'BlockedRequests',
        dimensionsMap: {
          WebACL: `${props.namePrefix}-${props.environment}`,
          Region: cdk.Stack.of(this).region,
          Rule: `${props.namePrefix}-RateLimit`,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 50,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    cdk.Tags.of(blockedRequestsAlarm).add('Environment', props.environment);
    cdk.Tags.of(rateLimitAlarm).add('Environment', props.environment);
  }

  /**
   * Associate Web ACL with an API Gateway REST API
   */
  public associateWithApiGateway(apiGatewayArn: string): wafv2.CfnWebACLAssociation {
    return new wafv2.CfnWebACLAssociation(this, 'ApiGatewayAssociation', {
      resourceArn: apiGatewayArn,
      webAclArn: this.webAclArn,
    });
  }

  /**
   * Associate Web ACL with a CloudFront distribution
   */
  public associateWithCloudFront(distributionArn: string): wafv2.CfnWebACLAssociation {
    return new wafv2.CfnWebACLAssociation(this, 'CloudFrontAssociation', {
      resourceArn: distributionArn,
      webAclArn: this.webAclArn,
    });
  }
}
