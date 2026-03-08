import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { WafConstruct } from '../lib/constructs/waf';

describe('WafConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: { region: 'us-east-1', account: '123456789012' },
    });
  });

  describe('Basic Configuration', () => {
    test('creates Web ACL with default settings', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Name: 'vaidyalink-test',
        Scope: 'REGIONAL',
        DefaultAction: { Allow: {} },
      });
    });

    test('creates Web ACL for CloudFront', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'prod',
        scope: 'CLOUDFRONT',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Scope: 'CLOUDFRONT',
      });
    });

    test('outputs Web ACL ARN', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
      });

      const template = Template.fromStack(stack);

      template.hasOutput('*', {
        Description: 'WAF Web ACL ARN',
        Export: {
          Name: 'vaidyalink-test-WebACLArn',
        },
      });
    });
  });

  describe('Rate Limiting', () => {
    test('creates rate-based rule with default limit', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'vaidyalink-RateLimit',
            Priority: 1,
            Statement: {
              RateBasedStatement: {
                Limit: 2000,
                AggregateKeyType: 'IP',
              },
            },
            Action: {
              Block: {
                CustomResponse: {
                  ResponseCode: 429,
                  CustomResponseBodyKey: 'rate-limit-response',
                },
              },
            },
          }),
        ]),
      });
    });

    test('creates rate-based rule with custom limit', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
        rateLimit: 5000,
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Statement: {
              RateBasedStatement: {
                Limit: 5000,
              },
            },
          }),
        ]),
      });
    });

    test('includes custom response body for rate limit', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        CustomResponseBodies: {
          'rate-limit-response': {
            ContentType: 'APPLICATION_JSON',
            Content: Match.stringLikeRegexp('Rate limit exceeded'),
          },
        },
      });
    });
  });

  describe('AWS Managed Rules', () => {
    test('includes AWS managed rule sets by default', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
      });

      const template = Template.fromStack(stack);

      // Common Rule Set
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'vaidyalink-AWSManagedRulesCommonRuleSet',
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWSManagedRulesCommonRuleSet',
              },
            },
          }),
        ]),
      });

      // Known Bad Inputs
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'vaidyalink-AWSManagedRulesKnownBadInputsRuleSet',
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWSManagedRulesKnownBadInputsRuleSet',
              },
            },
          }),
        ]),
      });

      // SQL Injection
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'vaidyalink-AWSManagedRulesSQLiRuleSet',
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWSManagedRulesSQLiRuleSet',
              },
            },
          }),
        ]),
      });

      // IP Reputation List
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'vaidyalink-AWSManagedRulesAmazonIpReputationList',
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWSManagedRulesAmazonIpReputationList',
              },
            },
          }),
        ]),
      });

      // Anonymous IP List
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'vaidyalink-AWSManagedRulesAnonymousIpList',
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWSManagedRulesAnonymousIpList',
              },
            },
          }),
        ]),
      });
    });

    test('can disable managed rules', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
        enableManagedRules: false,
      });

      const template = Template.fromStack(stack);

      // Should only have rate limit rule
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: [
          Match.objectLike({
            Name: 'vaidyalink-RateLimit',
          }),
        ],
      });
    });
  });

  describe('Geo-Blocking', () => {
    test('creates geo-blocking rule when countries specified', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
        blockedCountries: ['CN', 'RU', 'KP'],
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'vaidyalink-GeoBlocking',
            Statement: {
              GeoMatchStatement: {
                CountryCodes: ['CN', 'RU', 'KP'],
              },
            },
            Action: {
              Block: {
                CustomResponse: {
                  ResponseCode: 403,
                  CustomResponseBodyKey: 'geo-block-response',
                },
              },
            },
          }),
        ]),
      });
    });

    test('does not create geo-blocking rule when no countries specified', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
      });

      const template = Template.fromStack(stack);
      const webAcl = template.findResources('AWS::WAFv2::WebACL');
      const rules = Object.values(webAcl)[0].Properties.Rules;

      const geoBlockingRule = rules.find((rule: any) => rule.Name === 'vaidyalink-GeoBlocking');
      expect(geoBlockingRule).toBeUndefined();
    });
  });

  describe('CloudWatch Metrics', () => {
    test('enables metrics by default', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: 'vaidyalink-WebACL',
        },
      });
    });

    test('creates CloudWatch alarms for blocked requests', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'vaidyalink-test-BlockedRequests',
        AlarmDescription: 'Alert when WAF blocks exceed threshold',
        Threshold: 100,
        ComparisonOperator: 'GreaterThanThreshold',
      });
    });

    test('creates CloudWatch alarms for rate limit violations', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'vaidyalink-test-RateLimit',
        AlarmDescription: 'Alert when rate limit is frequently triggered',
        Threshold: 50,
        ComparisonOperator: 'GreaterThanThreshold',
      });
    });

    test('can disable metrics', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
        enableMetrics: false,
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        VisibilityConfig: {
          CloudWatchMetricsEnabled: false,
        },
      });

      // Should not create alarms
      expect(() => {
        template.hasResourceProperties('AWS::CloudWatch::Alarm', {});
      }).toThrow();
    });
  });

  describe('Resource Associations', () => {
    test('can associate with API Gateway', () => {
      const waf = new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
      });

      const apiGatewayArn = 'arn:aws:apigateway:us-east-1::/restapis/abc123/stages/prod';
      waf.associateWithApiGateway(apiGatewayArn);

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACLAssociation', {
        ResourceArn: apiGatewayArn,
      });
    });

    test('can associate with CloudFront', () => {
      const waf = new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'CLOUDFRONT',
      });

      const distributionArn = 'arn:aws:cloudfront::123456789012:distribution/EDFDVBD6EXAMPLE';
      waf.associateWithCloudFront(distributionArn);

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACLAssociation', {
        ResourceArn: distributionArn,
      });
    });
  });

  describe('Tags', () => {
    test('applies standard tags to Web ACL', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'prod',
        scope: 'REGIONAL',
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Tags: Match.arrayWith([
          { Key: 'Environment', Value: 'prod' },
          { Key: 'ManagedBy', Value: 'CDK' },
          { Key: 'Project', Value: 'VaidyaLink' },
        ]),
      });
    });
  });

  describe('Rule Priorities', () => {
    test('assigns correct priorities to rules', () => {
      new WafConstruct(stack, 'TestWaf', {
        namePrefix: 'vaidyalink',
        environment: 'test',
        scope: 'REGIONAL',
        blockedCountries: ['CN'],
      });

      const template = Template.fromStack(stack);
      const webAcl = template.findResources('AWS::WAFv2::WebACL');
      const rules = Object.values(webAcl)[0].Properties.Rules;

      // Verify priorities are sequential and unique
      const priorities = rules.map((rule: any) => rule.Priority);
      const uniquePriorities = new Set(priorities);

      expect(priorities.length).toBe(uniquePriorities.size);
      expect(Math.min(...priorities)).toBe(1);
    });
  });
});
