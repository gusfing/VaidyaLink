import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface EventDrivenConstructProps {
  environment: string;
  encryptionKey: kms.Key;
}

export class EventDrivenConstruct extends Construct {
  public readonly hitlQueue: sqs.Queue;
  public readonly hitlDeadLetterQueue: sqs.Queue;
  public readonly hitlNotificationTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: EventDrivenConstructProps) {
    super(scope, id);

    const { environment, encryptionKey } = props;

    // ========================================
    // Dead Letter Queue for HITL
    // ========================================
    this.hitlDeadLetterQueue = new sqs.Queue(this, 'HITLDeadLetterQueue', {
      queueName: `vaidyalink-hitl-dlq-${environment}`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: encryptionKey,
      retentionPeriod: cdk.Duration.days(14),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // HITL Queue
    // ========================================
    this.hitlQueue = new sqs.Queue(this, 'HITLQueue', {
      queueName: `vaidyalink-hitl-${environment}`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: encryptionKey,
      visibilityTimeout: cdk.Duration.minutes(15), // Time for human verification
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: this.hitlDeadLetterQueue,
        maxReceiveCount: 3, // After 3 failed processing attempts, move to DLQ
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // SNS Topic for HITL Notifications
    // ========================================
    this.hitlNotificationTopic = new sns.Topic(this, 'HITLNotificationTopic', {
      topicName: `vaidyalink-hitl-notifications-${environment}`,
      displayName: 'VaidyaLink HITL Notifications',
      masterKey: encryptionKey,
    });

    // Tags for compliance and cost tracking
    cdk.Tags.of(this.hitlQueue).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.hitlQueue).add('Environment', environment);
    cdk.Tags.of(this.hitlQueue).add('Purpose', 'HITL Verification');

    cdk.Tags.of(this.hitlDeadLetterQueue).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.hitlDeadLetterQueue).add('Environment', environment);
    cdk.Tags.of(this.hitlDeadLetterQueue).add('Purpose', 'HITL DLQ');

    cdk.Tags.of(this.hitlNotificationTopic).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.hitlNotificationTopic).add('Environment', environment);
    cdk.Tags.of(this.hitlNotificationTopic).add('Purpose', 'HITL Notifications');

    // Output queue URL for easy reference
    new cdk.CfnOutput(this, 'HITLQueueUrl', {
      value: this.hitlQueue.queueUrl,
      description: 'HITL Queue URL',
      exportName: `vaidyalink-hitl-queue-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'HITLQueueArn', {
      value: this.hitlQueue.queueArn,
      description: 'HITL Queue ARN',
      exportName: `vaidyalink-hitl-queue-arn-${environment}`,
    });
  }
}
