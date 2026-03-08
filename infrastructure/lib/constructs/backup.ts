import * as cdk from 'aws-cdk-lib';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';

export interface BackupConstructProps {
  environment: string;
  encryptionKey: kms.Key;
  scanJobsTable: dynamodb.Table;
  patientsTable: dynamodb.Table;
  voiceJobsTable: dynamodb.Table;
  migrationsTable: dynamodb.Table;
  documentsBucket: s3.Bucket;
  alarmTopic: sns.Topic;
}

export class BackupConstruct extends Construct {
  public readonly backupVault: backup.BackupVault;
  public readonly backupPlan: backup.BackupPlan;

  constructor(scope: Construct, id: string, props: BackupConstructProps) {
    super(scope, id);

    const {
      environment,
      encryptionKey,
      scanJobsTable,
      patientsTable,
      voiceJobsTable,
      migrationsTable,
      documentsBucket,
      alarmTopic,
    } = props;

    // ========================================
    // Backup Vault with Encryption
    // ========================================

    this.backupVault = new backup.BackupVault(this, 'BackupVault', {
      backupVaultName: `vaidyalink-backup-vault-${environment}`,
      encryptionKey: encryptionKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // Backup Plan with Multiple Rules
    // ========================================

    this.backupPlan = new backup.BackupPlan(this, 'BackupPlan', {
      backupPlanName: `vaidyalink-backup-plan-${environment}`,
      backupVault: this.backupVault,
      backupPlanRules: [
        // Daily backups - retained for 35 days
        new backup.BackupPlanRule({
          ruleName: 'DailyBackup',
          scheduleExpression: events.Schedule.cron({
            hour: '2',
            minute: '0',
          }),
          startWindow: cdk.Duration.hours(1),
          completionWindow: cdk.Duration.hours(2),
          deleteAfter: cdk.Duration.days(35),
          enableContinuousBackup: true, // Enable PITR for DynamoDB
        }),
        // Weekly backups - retained for 90 days
        new backup.BackupPlanRule({
          ruleName: 'WeeklyBackup',
          scheduleExpression: events.Schedule.cron({
            weekDay: 'SUN',
            hour: '3',
            minute: '0',
          }),
          startWindow: cdk.Duration.hours(1),
          completionWindow: cdk.Duration.hours(3),
          deleteAfter: cdk.Duration.days(90),
        }),
        // Monthly backups - retained for 7 years (HIPAA compliance)
        new backup.BackupPlanRule({
          ruleName: 'MonthlyBackup',
          scheduleExpression: events.Schedule.cron({
            day: '1',
            hour: '4',
            minute: '0',
          }),
          startWindow: cdk.Duration.hours(1),
          completionWindow: cdk.Duration.hours(4),
          deleteAfter: cdk.Duration.days(2555), // ~7 years
          moveToColdStorageAfter: cdk.Duration.days(90), // Move to cold storage after 90 days
        }),
      ],
    });

    // ========================================
    // Backup Selection - DynamoDB Tables
    // ========================================

    this.backupPlan.addSelection('DynamoDBBackupSelection', {
      resources: [
        backup.BackupResource.fromDynamoDbTable(scanJobsTable),
        backup.BackupResource.fromDynamoDbTable(patientsTable),
        backup.BackupResource.fromDynamoDbTable(voiceJobsTable),
        backup.BackupResource.fromDynamoDbTable(migrationsTable),
      ],
      allowRestores: true,
    });

    // ========================================
    // Backup Selection - S3 Bucket
    // ========================================

    this.backupPlan.addSelection('S3BackupSelection', {
      resources: [backup.BackupResource.fromArn(documentsBucket.bucketArn)],
      allowRestores: true,
    });

    // ========================================
    // CloudWatch Alarms for Backup Monitoring
    // ========================================

    // Alarm for backup job failures
    const backupFailureMetric = new cloudwatch.Metric({
      namespace: 'AWS/Backup',
      metricName: 'NumberOfBackupJobsFailed',
      dimensionsMap: {
        BackupVaultName: this.backupVault.backupVaultName,
      },
      statistic: 'Sum',
      period: cdk.Duration.hours(24),
    });

    const backupFailureAlarm = new cloudwatch.Alarm(this, 'BackupFailureAlarm', {
      alarmName: `vaidyalink-backup-failures-${environment}`,
      alarmDescription: 'Alert when backup jobs fail',
      metric: backupFailureMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    backupFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // Alarm for restore job failures
    const restoreFailureMetric = new cloudwatch.Metric({
      namespace: 'AWS/Backup',
      metricName: 'NumberOfRestoreJobsFailed',
      dimensionsMap: {
        BackupVaultName: this.backupVault.backupVaultName,
      },
      statistic: 'Sum',
      period: cdk.Duration.hours(24),
    });

    const restoreFailureAlarm = new cloudwatch.Alarm(this, 'RestoreFailureAlarm', {
      alarmName: `vaidyalink-restore-failures-${environment}`,
      alarmDescription: 'Alert when restore jobs fail',
      metric: restoreFailureMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    restoreFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // ========================================
    // EventBridge Rules for Backup Notifications
    // ========================================

    // Notify on backup job completion
    new events.Rule(this, 'BackupCompletedRule', {
      ruleName: `vaidyalink-backup-completed-${environment}`,
      description: 'Notify when backup jobs complete',
      eventPattern: {
        source: ['aws.backup'],
        detailType: ['Backup Job State Change'],
        detail: {
          state: ['COMPLETED'],
          backupVaultName: [this.backupVault.backupVaultName],
        },
      },
      targets: [new events_targets.SnsTopic(alarmTopic)],
    });

    // Notify on backup job failure
    new events.Rule(this, 'BackupFailedRule', {
      ruleName: `vaidyalink-backup-failed-${environment}`,
      description: 'Notify when backup jobs fail',
      eventPattern: {
        source: ['aws.backup'],
        detailType: ['Backup Job State Change'],
        detail: {
          state: ['FAILED', 'ABORTED', 'EXPIRED'],
          backupVaultName: [this.backupVault.backupVaultName],
        },
      },
      targets: [new events_targets.SnsTopic(alarmTopic)],
    });

    // Notify on restore job completion
    new events.Rule(this, 'RestoreCompletedRule', {
      ruleName: `vaidyalink-restore-completed-${environment}`,
      description: 'Notify when restore jobs complete',
      eventPattern: {
        source: ['aws.backup'],
        detailType: ['Restore Job State Change'],
        detail: {
          state: ['COMPLETED'],
        },
      },
      targets: [new events_targets.SnsTopic(alarmTopic)],
    });

    // Notify on restore job failure
    new events.Rule(this, 'RestoreFailedRule', {
      ruleName: `vaidyalink-restore-failed-${environment}`,
      description: 'Notify when restore jobs fail',
      eventPattern: {
        source: ['aws.backup'],
        detailType: ['Restore Job State Change'],
        detail: {
          state: ['FAILED', 'ABORTED'],
        },
      },
      targets: [new events_targets.SnsTopic(alarmTopic)],
    });

    // ========================================
    // Tags for Compliance
    // ========================================

    cdk.Tags.of(this.backupVault).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.backupVault).add('Environment', environment);
    cdk.Tags.of(this.backupVault).add('Compliance', 'HIPAA');
    cdk.Tags.of(this.backupVault).add('Purpose', 'Disaster Recovery');

    cdk.Tags.of(this.backupPlan).add('Service', 'VaidyaLink');
    cdk.Tags.of(this.backupPlan).add('Environment', environment);
    cdk.Tags.of(this.backupPlan).add('Compliance', 'HIPAA');
  }
}
