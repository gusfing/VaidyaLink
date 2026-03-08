import {
  BackupClient,
  ListBackupJobsCommand,
  ListRecoveryPointsByBackupVaultCommand,
  DescribeBackupJobCommand,
} from '@aws-sdk/client-backup';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const backupClient = new BackupClient({});
const snsClient = new SNSClient({});
const cloudwatchClient = new CloudWatchClient({});

const BACKUP_VAULT_NAME = process.env.BACKUP_VAULT_NAME!;
const ALARM_TOPIC_ARN = process.env.ALARM_TOPIC_ARN!;
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

interface BackupVerificationResult {
  vaultName: string;
  totalRecoveryPoints: number;
  recentBackups: number;
  oldestBackup: Date | null;
  newestBackup: Date | null;
  failedBackups: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  issues: string[];
}

/**
 * Lambda handler to verify backup health and completeness
 * Runs daily to ensure backups are being created successfully
 */
export async function handler(event: any): Promise<BackupVerificationResult> {
  console.log('Starting backup verification', { vaultName: BACKUP_VAULT_NAME });

  try {
    const result = await verifyBackups();

    // Publish custom CloudWatch metrics
    await publishMetrics(result);

    // Send alert if issues detected
    if (result.status !== 'HEALTHY') {
      await sendAlert(result);
    }

    console.log('Backup verification completed', result);
    return result;
  } catch (error) {
    console.error('Backup verification failed', error);
    await sendAlert({
      vaultName: BACKUP_VAULT_NAME,
      totalRecoveryPoints: 0,
      recentBackups: 0,
      oldestBackup: null,
      newestBackup: null,
      failedBackups: 0,
      status: 'CRITICAL',
      issues: [`Verification script failed: ${error}`],
    });
    throw error;
  }
}

async function verifyBackups(): Promise<BackupVerificationResult> {
  const issues: string[] = [];
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // List all recovery points in the vault
  const recoveryPointsResponse = await backupClient.send(
    new ListRecoveryPointsByBackupVaultCommand({
      BackupVaultName: BACKUP_VAULT_NAME,
    })
  );

  const recoveryPoints = recoveryPointsResponse.RecoveryPoints || [];
  const totalRecoveryPoints = recoveryPoints.length;

  // Check for recent backups (last 24 hours)
  const recentBackups = recoveryPoints.filter(
    (rp) => rp.CreationDate && rp.CreationDate > oneDayAgo
  ).length;

  // Find oldest and newest backups
  const sortedByDate = [...recoveryPoints].sort((a, b) => {
    const dateA = a.CreationDate?.getTime() || 0;
    const dateB = b.CreationDate?.getTime() || 0;
    return dateA - dateB;
  });

  const oldestBackup = sortedByDate[0]?.CreationDate || null;
  const newestBackup = sortedByDate[sortedByDate.length - 1]?.CreationDate || null;

  // Check for failed backup jobs in the last 7 days
  const backupJobsResponse = await backupClient.send(
    new ListBackupJobsCommand({
      ByBackupVaultName: BACKUP_VAULT_NAME,
      ByCreatedAfter: sevenDaysAgo,
    })
  );

  const failedBackups = (backupJobsResponse.BackupJobs || []).filter(
    (job) => job.State === 'FAILED' || job.State === 'ABORTED' || job.State === 'EXPIRED'
  ).length;

  // Verification checks
  if (totalRecoveryPoints === 0) {
    issues.push('No recovery points found in backup vault');
  }

  if (recentBackups === 0) {
    issues.push('No backups created in the last 24 hours');
  }

  if (failedBackups > 0) {
    issues.push(`${failedBackups} backup jobs failed in the last 7 days`);
  }

  // Check if we have backups for all expected resources
  const expectedResourceTypes = ['DynamoDB', 'S3'];
  const resourceTypes = new Set(recoveryPoints.map((rp) => rp.ResourceType).filter(Boolean));

  for (const expectedType of expectedResourceTypes) {
    if (!resourceTypes.has(expectedType)) {
      issues.push(`No backups found for resource type: ${expectedType}`);
    }
  }

  // Determine overall status
  let status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  if (issues.length === 0) {
    status = 'HEALTHY';
  } else if (totalRecoveryPoints === 0 || recentBackups === 0) {
    status = 'CRITICAL';
  } else {
    status = 'WARNING';
  }

  return {
    vaultName: BACKUP_VAULT_NAME,
    totalRecoveryPoints,
    recentBackups,
    oldestBackup,
    newestBackup,
    failedBackups,
    status,
    issues,
  };
}

async function publishMetrics(result: BackupVerificationResult): Promise<void> {
  const metrics = [
    {
      MetricName: 'TotalRecoveryPoints',
      Value: result.totalRecoveryPoints,
      Unit: 'Count',
    },
    {
      MetricName: 'RecentBackups',
      Value: result.recentBackups,
      Unit: 'Count',
    },
    {
      MetricName: 'FailedBackups',
      Value: result.failedBackups,
      Unit: 'Count',
    },
    {
      MetricName: 'BackupHealthStatus',
      Value: result.status === 'HEALTHY' ? 1 : result.status === 'WARNING' ? 0.5 : 0,
      Unit: 'None',
    },
  ];

  await cloudwatchClient.send(
    new PutMetricDataCommand({
      Namespace: 'VaidyaLink/Backup',
      MetricData: metrics.map((metric) => ({
        ...metric,
        Timestamp: new Date(),
        Dimensions: [
          { Name: 'Environment', Value: ENVIRONMENT },
          { Name: 'BackupVault', Value: result.vaultName },
        ],
      })),
    })
  );

  console.log('Published CloudWatch metrics', { metricsCount: metrics.length });
}

async function sendAlert(result: BackupVerificationResult): Promise<void> {
  const message = {
    Subject: `[${result.status}] VaidyaLink Backup Health Alert - ${ENVIRONMENT}`,
    Message: `
Backup Verification Report
==========================

Environment: ${ENVIRONMENT}
Backup Vault: ${result.vaultName}
Status: ${result.status}
Timestamp: ${new Date().toISOString()}

Metrics:
--------
Total Recovery Points: ${result.totalRecoveryPoints}
Recent Backups (24h): ${result.recentBackups}
Failed Backups (7d): ${result.failedBackups}
Oldest Backup: ${result.oldestBackup?.toISOString() || 'N/A'}
Newest Backup: ${result.newestBackup?.toISOString() || 'N/A'}

Issues Detected:
----------------
${result.issues.length > 0 ? result.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n') : 'None'}

Action Required:
----------------
${result.status === 'CRITICAL' ? 'IMMEDIATE ACTION REQUIRED: Critical backup issues detected!' : 'Review backup configuration and recent backup jobs.'}

View AWS Backup Console:
https://console.aws.amazon.com/backup/home?region=${process.env.AWS_REGION}#/backupvaults/details/${result.vaultName}
    `.trim(),
  };

  await snsClient.send(
    new PublishCommand({
      TopicArn: ALARM_TOPIC_ARN,
      Subject: message.Subject,
      Message: message.Message,
    })
  );

  console.log('Alert sent to SNS topic', { status: result.status });
}
