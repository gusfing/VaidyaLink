import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface EventsConstructProps {
  environment: string;
  documentsBucket: s3.Bucket;
  documentProcessingFunction: lambda.Function;
  fhirTransformerFunction: lambda.Function;
  notificationTopic: sns.Topic;
}

export class EventsConstruct extends Construct {
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: EventsConstructProps) {
    super(scope, id);

    const {
      environment,
      documentsBucket,
      documentProcessingFunction,
      fhirTransformerFunction,
      notificationTopic,
    } = props;

    // ========================================
    // EventBridge Event Bus
    // ========================================

    this.eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: `vaidyalink-${environment}`,
    });

    // ========================================
    // S3 Event Notifications
    // ========================================

    // Trigger document processing when new images are uploaded
    documentsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(documentProcessingFunction),
      { prefix: 'raw/', suffix: '.jpg' }
    );

    documentsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(documentProcessingFunction),
      { prefix: 'raw/', suffix: '.png' }
    );

    documentsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(documentProcessingFunction),
      { prefix: 'raw/', suffix: '.jpeg' }
    );

    // ========================================
    // EventBridge Rules
    // ========================================

    // Rule for document processing completion
    const documentProcessedRule = new events.Rule(this, 'DocumentProcessedRule', {
      eventBus: this.eventBus,
      ruleName: `vaidyalink-document-processed-${environment}`,
      description: 'Triggered when document processing completes',
      eventPattern: {
        source: ['vaidyalink.document-processing'],
        detailType: ['Document Processing Completed'],
      },
    });

    documentProcessedRule.addTarget(new targets.LambdaFunction(fhirTransformerFunction));
    documentProcessedRule.addTarget(new targets.SnsTopic(notificationTopic));

    // Rule for FHIR transformation completion
    const fhirTransformedRule = new events.Rule(this, 'FHIRTransformedRule', {
      eventBus: this.eventBus,
      ruleName: `vaidyalink-fhir-transformed-${environment}`,
      description: 'Triggered when FHIR transformation completes',
      eventPattern: {
        source: ['vaidyalink.fhir-transformer'],
        detailType: ['FHIR Transformation Completed'],
      },
    });

    fhirTransformedRule.addTarget(new targets.SnsTopic(notificationTopic));

    // Rule for HITL required
    const hitlRequiredRule = new events.Rule(this, 'HITLRequiredRule', {
      eventBus: this.eventBus,
      ruleName: `vaidyalink-hitl-required-${environment}`,
      description: 'Triggered when human verification is required',
      eventPattern: {
        source: ['vaidyalink.document-processing'],
        detailType: ['HITL Required'],
      },
    });

    hitlRequiredRule.addTarget(new targets.SnsTopic(notificationTopic));

    // Tags
    cdk.Tags.of(this.eventBus).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.eventBus).add('Environment', environment);
  }
}
