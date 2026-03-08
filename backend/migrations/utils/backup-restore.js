/**
 * Backup and Restore Utilities
 *
 * Utilities for creating and restoring DynamoDB backups during migrations.
 */

const {
  DynamoDBClient,
  CreateBackupCommand,
  DescribeBackupCommand,
  ListBackupsCommand,
  RestoreTableFromBackupCommand,
  DescribeTableCommand,
} = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

/**
 * Create an on-demand backup of a table
 *
 * @param {string} tableName - Table to backup
 * @param {string} backupName - Name for the backup
 * @returns {Promise<Object>} Backup details
 */
async function createBackup(tableName, backupName) {
  const params = {
    TableName: tableName,
    BackupName: backupName || `${tableName}-${Date.now()}`,
  };

  try {
    const command = new CreateBackupCommand(params);
    const result = await client.send(command);

    console.log(`✓ Backup created: ${result.BackupDetails.BackupName}`);
    console.log(`  Backup ARN: ${result.BackupDetails.BackupArn}`);
    console.log(`  Created at: ${result.BackupDetails.BackupCreationDateTime}`);

    return {
      backupArn: result.BackupDetails.BackupArn,
      backupName: result.BackupDetails.BackupName,
      createdAt: result.BackupDetails.BackupCreationDateTime,
      status: result.BackupDetails.BackupStatus,
    };
  } catch (error) {
    if (error.name === 'LimitExceededException') {
      console.warn(
        `⚠ Backup limit reached for ${tableName}. ` +
          'Consider deleting old backups or relying on point-in-time recovery.'
      );
      return null;
    }
    throw error;
  }
}

/**
 * Get backup status
 *
 * @param {string} backupArn - Backup ARN
 * @returns {Promise<Object>} Backup status
 */
async function getBackupStatus(backupArn) {
  const params = {
    BackupArn: backupArn,
  };

  const command = new DescribeBackupCommand(params);
  const result = await client.send(command);

  return {
    status: result.BackupDescription.BackupDetails.BackupStatus,
    sizeBytes: result.BackupDescription.BackupDetails.BackupSizeBytes,
    createdAt: result.BackupDescription.BackupDetails.BackupCreationDateTime,
  };
}

/**
 * List backups for a table
 *
 * @param {string} tableName - Table name
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} List of backups
 */
async function listBackups(tableName, options = {}) {
  const { limit = 100, timeRangeStart = null, timeRangeEnd = null } = options;

  const params = {
    TableName: tableName,
    Limit: limit,
  };

  if (timeRangeStart) {
    params.TimeRangeLowerBound = timeRangeStart;
  }

  if (timeRangeEnd) {
    params.TimeRangeUpperBound = timeRangeEnd;
  }

  const command = new ListBackupsCommand(params);
  const result = await client.send(command);

  return (result.BackupSummaries || []).map((backup) => ({
    backupArn: backup.BackupArn,
    backupName: backup.BackupName,
    createdAt: backup.BackupCreationDateTime,
    status: backup.BackupStatus,
    sizeBytes: backup.BackupSizeBytes,
  }));
}

/**
 * Restore table from backup
 *
 * @param {string} backupArn - Backup ARN to restore from
 * @param {string} targetTableName - Name for the restored table
 * @returns {Promise<Object>} Restore operation details
 */
async function restoreFromBackup(backupArn, targetTableName) {
  const params = {
    BackupArn: backupArn,
    TargetTableName: targetTableName,
  };

  console.log(`Restoring backup to table: ${targetTableName}...`);

  const command = new RestoreTableFromBackupCommand(params);
  const result = await client.send(command);

  console.log(`✓ Restore initiated for ${targetTableName}`);
  console.log(`  Table ARN: ${result.TableDescription.TableArn}`);
  console.log(`  Status: ${result.TableDescription.TableStatus}`);

  // Wait for table to become active
  await waitForTableActive(targetTableName);

  return {
    tableName: result.TableDescription.TableName,
    tableArn: result.TableDescription.TableArn,
    status: result.TableDescription.TableStatus,
  };
}

/**
 * Restore table to a point in time
 *
 * @param {string} sourceTableName - Source table name
 * @param {string} targetTableName - Target table name
 * @param {Date} restoreDateTime - Point in time to restore to
 * @returns {Promise<Object>} Restore operation details
 */
async function restoreToPointInTime(sourceTableName, targetTableName, restoreDateTime) {
  const { RestoreTableToPointInTimeCommand } = require('@aws-sdk/client-dynamodb');

  const params = {
    SourceTableName: sourceTableName,
    TargetTableName: targetTableName,
    RestoreDateTime: restoreDateTime,
  };

  console.log(`Restoring ${sourceTableName} to ${restoreDateTime.toISOString()}...`);

  const command = new RestoreTableToPointInTimeCommand(params);
  const result = await client.send(command);

  console.log(`✓ Point-in-time restore initiated for ${targetTableName}`);

  // Wait for table to become active
  await waitForTableActive(targetTableName);

  return {
    tableName: result.TableDescription.TableName,
    tableArn: result.TableDescription.TableArn,
    status: result.TableDescription.TableStatus,
  };
}

/**
 * Wait for table to become active
 *
 * @param {string} tableName - Table name
 * @param {number} maxWaitTime - Maximum wait time in seconds
 * @returns {Promise<void>}
 */
async function waitForTableActive(tableName, maxWaitTime = 600) {
  const startTime = Date.now();
  const maxWaitMs = maxWaitTime * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    const params = {
      TableName: tableName,
    };

    const command = new DescribeTableCommand(params);
    const result = await client.send(command);

    const status = result.Table.TableStatus;

    if (status === 'ACTIVE') {
      console.log(`✓ Table ${tableName} is now ACTIVE`);
      return;
    }

    console.log(`  Table status: ${status}. Waiting...`);
    await sleep(10000); // Wait 10 seconds
  }

  throw new Error(`Table ${tableName} did not become ACTIVE within ${maxWaitTime} seconds`);
}

/**
 * Delete old backups
 *
 * @param {string} tableName - Table name
 * @param {number} retentionDays - Keep backups newer than this many days
 * @returns {Promise<Object>} Deletion statistics
 */
async function cleanupOldBackups(tableName, retentionDays = 30) {
  const { DeleteBackupCommand } = require('@aws-sdk/client-dynamodb');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const backups = await listBackups(tableName, {
    timeRangeEnd: cutoffDate,
  });

  console.log(`Found ${backups.length} backups older than ${retentionDays} days`);

  let deletedCount = 0;

  for (const backup of backups) {
    try {
      const params = {
        BackupArn: backup.backupArn,
      };

      const command = new DeleteBackupCommand(params);
      await client.send(command);

      console.log(`✓ Deleted backup: ${backup.backupName}`);
      deletedCount++;
    } catch (error) {
      console.error(`✗ Failed to delete backup ${backup.backupName}:`, error.message);
    }
  }

  return {
    totalBackups: backups.length,
    deletedCount,
  };
}

/**
 * Verify backup integrity
 *
 * @param {string} backupArn - Backup ARN
 * @returns {Promise<boolean>} True if backup is valid
 */
async function verifyBackup(backupArn) {
  try {
    const status = await getBackupStatus(backupArn);

    if (status.status !== 'AVAILABLE') {
      console.error(`Backup status is ${status.status}, expected AVAILABLE`);
      return false;
    }

    if (status.sizeBytes === 0) {
      console.error('Backup size is 0 bytes');
      return false;
    }

    console.log(`✓ Backup is valid (${formatBytes(status.sizeBytes)})`);
    return true;
  } catch (error) {
    console.error(`Backup verification failed: ${error.message}`);
    return false;
  }
}

/**
 * Get backup recommendations for a table
 *
 * @param {string} tableName - Table name
 * @returns {Promise<Object>} Backup recommendations
 */
async function getBackupRecommendations(tableName) {
  const backups = await listBackups(tableName);

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentBackups = backups.filter((b) => new Date(b.createdAt) > oneDayAgo);
  const weeklyBackups = backups.filter((b) => new Date(b.createdAt) > oneWeekAgo);

  const recommendations = [];

  if (recentBackups.length === 0) {
    recommendations.push({
      severity: 'high',
      message: 'No backups in the last 24 hours. Consider creating a backup before migration.',
    });
  }

  if (weeklyBackups.length < 2) {
    recommendations.push({
      severity: 'medium',
      message: 'Less than 2 backups in the last week. Consider more frequent backups.',
    });
  }

  if (backups.length > 50) {
    recommendations.push({
      severity: 'low',
      message: `${backups.length} backups found. Consider cleaning up old backups.`,
    });
  }

  return {
    totalBackups: backups.length,
    recentBackups: recentBackups.length,
    weeklyBackups: weeklyBackups.length,
    recommendations,
  };
}

/**
 * Helper: Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  createBackup,
  getBackupStatus,
  listBackups,
  restoreFromBackup,
  restoreToPointInTime,
  waitForTableActive,
  cleanupOldBackups,
  verifyBackup,
  getBackupRecommendations,
};
