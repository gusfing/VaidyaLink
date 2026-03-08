import {
  BackupClient,
  ListRecoveryPointsByBackupVaultCommand,
  StartRestoreJobCommand,
  DescribeRestoreJobCommand,
} from '@aws-sdk/client-backup';
import { DynamoDBClient, DescribeTableCommand, DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const backupClient = new BackupClient({});
const dynamoClient = new DynamoDBClient({});
const snsClient = new SNSClient({});

const BACKUP_VAULT_NAME = process.env.BACKUP_VAULT_NAME!;
const ALARM_TOPIC_ARN = process.env.ALARM_TOPIC_ARN!;
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const IAM_ROLE_ARN = process.env.RESTORE_ROLE_ARN!;

interface RestoreTestResult {
  success: boolean;
  resourceType: string;
  recoveryPointArn: string;
  restoreJobId?: string;
  duration?: number;
  error?: string;
}

/**
 * Lambda handler to test restore functionality
 * Performs a test restore to a temporary resource to verify backup integrity
 * Should be run periodically (e.g., monthly) to ensure disaster recovery readiness
 */
export async function handler(event: any): Promise<RestoreTestResult> {
  console.log('Starting restore test', { vaultName: BACKUP_VAULT_NAME });

  const resourceType = event.resourceType || 'DynamoDB';
  const testTableSuffix = event.testTableSuffix || 'restore-test';

  try {
    const result = await testRestore(resourceType, testTableSuffix);

    // Send notification
    await sendNotification(result);

    console.log('Restore test completed', result);
    return result;
  } catch (error) {
    console.error('Restore test failed', error);
    const failureResult: RestoreTestResult = {
      success: false,
      resourceType,
      recoveryPointArn: '',
      error: String(error),
    };
    await sendNotification(failureResult);
    throw error;
  }
}

async function testRestore(
  resourceType: string,
  testTableSuffix: string
): Promise<RestoreTestResult> {
  const startTime = Date.now();

  // Find a recent recovery point for the specified resource type
  const recoveryPointsResponse = await backupClient.send(
    new ListRecoveryPointsByBackupVaultCommand({
      BackupVaultName: BACKUP_VAULT_NAME,
      ByResourceType: resourceType,
    })
  );

  const recoveryPoints = recoveryPointsResponse.RecoveryPoints || [];
  if (recoveryPoints.length === 0) {
    throw new Error(`No recovery points found for resource type: ${resourceType}`);
  }

  // Get the most recent completed recovery point
  const sortedPoints = recoveryPoints
    .filter((rp) => rp.Status === 'COMPLETED')
    .sort((a, b) => {
      const dateA = a.CreationDate?.getTime() || 0;
      const dateB = b.CreationDate?.getTime() || 0;
      return dateB - dateA;
    });

  if (sortedPoints.length === 0) {
    throw new Error('No completed recovery points available for restore test');
  }

  const recoveryPoint = sortedPoints[0];
  const recoveryPointArn = recoveryPoint.RecoveryPointArn!;

  console.log('Selected recovery point for restore test', {
    arn: recoveryPointArn,
    creationDate: recoveryPoint.CreationDate,
    resourceType: recoveryPoint.ResourceType,
  });

  // Perform restore based on resource type
  let restoreJobId: string;

  if (resourceType === 'DynamoDB') {
    restoreJobId = await restoreDynamoDBTable(recoveryPointArn, testTableSuffix);
  } else if (resourceType === 'S3') {
    // S3 restore test would go here
    throw new Error('S3 restore testing not yet implemented');
  } else {
    throw new Error(`Unsupported resource type: ${resourceType}`);
  }

  // Wait for restore to complete (with timeout)
  const restoreSuccess = await waitForRestoreCompletion(restoreJobId, 600000); // 10 min timeout

  // Clean up test resource
  if (resourceType === 'DynamoDB') {
    await cleanupTestTable(testTableSuffix);
  }

  const duration = Date.now() - startTime;

  return {
    success: restoreSuccess,
    resourceType,
    recoveryPointArn,
    restoreJobId,
    duration,
  };
}

async function restoreDynamoDBTable(
  recoveryPointArn: string,
  testTableSuffix: string
): Promise<string> {
  const testTableName = `vaidyalink-${testTableSuffix}-${ENVIRONMENT}-${Date.now()}`;

  const restoreResponse = await backupClient.send(
    new StartRestoreJobCommand({
      RecoveryPointArn: recoveryPointArn,
      IamRoleArn: IAM_ROLE_ARN,
      Metadata: {
        targetTableName: testTableName,
      },
    })
  );

  console.log('Started DynamoDB restore job', {
    restoreJobId: restoreResponse.RestoreJobId,
    targetTable: testTableName,
  });

  return restoreResponse.RestoreJobId!;
}

async function waitForRestoreCompletion(restoreJobId: string, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 10000; // 10 seconds

  while (Date.now() - startTime < timeoutMs) {
    const response = await backupClient.send(
      new DescribeRestoreJobCommand({
        RestoreJobId: restoreJobId,
      })
    );

    const status = response.Status;
    console.log('Restore job status', { restoreJobId, status });

    if (status === 'COMPLETED') {
      return true;
    } else if (status === 'FAILED' || status === 'ABORTED') {
      throw new Error(`Restore job ${status}: ${response.StatusMessage}`);
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Restore job timed out after ${timeoutMs}ms`);
}

async function cleanupTestTable(testTableSuffix: string): Promise<void> {
  try {
    // Find tables matching the test pattern
    const testTablePattern = `vaidyalink-${testTableSuffix}-${ENVIRONMENT}`;

    // Note: In production, you'd want to list tables and find matches
    // For now, we'll just log that cleanup should happen
    console.log('Test table cleanup required', { pattern: testTablePattern });

    // Actual cleanup would involve:
    // 1. List all tables
    // 2. Find tables matching the pattern
    // 3. Delete tables older than X hours
    // This is left as a manual step to prevent accidental deletions
  } catch (error) {
    console.error('Failed to cleanup test table', error);
    // Don't throw - cleanup failure shouldn't fail the test
  }
}

async function sendNotification(result: RestoreTestResult): Promise<void> {
  const subject = result.success
    ? `[SUCCESS] VaidyaLink Restore Test Passed - ${ENVIRONMENT}`
    : `[FAILURE] VaidyaLink Restore Test Failed - ${ENVIRONMENT}`;

  const message = `
Restore Test Report
===================

Environment: ${ENVIRONMENT}
Backup Vault: ${BACKUP_VAULT_NAME}
Resource Type: ${result.resourceType}
Status: ${result.success ? 'SUCCESS' : 'FAILURE'}
Timestamp: ${new Date().toISOString()}

Details:
--------
Recovery Point: ${result.recoveryPointArn}
Restore Job ID: ${result.restoreJobId || 'N/A'}
Duration: ${result.duration ? `${(result.duration / 1000).toFixed(2)}s` : 'N/A'}
${result.error ? `Error: ${result.error}` : ''}

${result.success ? 'Backup restore capability verified successfully.' : 'IMMEDIATE ACTION REQUIRED: Restore test failed!'}

View AWS Backup Console:
https://console.aws.amazon.com/backup/home?region=${process.env.AWS_REGION}#/jobs/restore
  `.trim();

  await snsClient.send(
    new PublishCommand({
      TopicArn: ALARM_TOPIC_ARN,
      Subject: subject,
      Message: message,
    })
  );

  console.log('Notification sent', { success: result.success });
}
