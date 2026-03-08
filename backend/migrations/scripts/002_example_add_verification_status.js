/**
 * Migration 002: Add Verification Status to Scan Jobs
 *
 * This is an example migration showing how to add a new attribute
 * to existing items with a computed default value.
 *
 * NOTE: This is an example and should not be run in production.
 */

const { batchTransformItems } = require('../utils/batch-operations');
const { addAttribute } = require('../utils/data-transformers');

const description = 'Add verificationStatus attribute to all scan jobs (EXAMPLE)';

const affectedTables = [
  'vaidyalink-scanjobs-dev',
  'vaidyalink-scanjobs-staging',
  'vaidyalink-scanjobs-prod',
];

/**
 * Compute verification status based on existing data
 */
function computeVerificationStatus(item) {
  // If HITL was completed, mark as verified
  if (item.hitlCompletedAt) {
    return 'verified';
  }

  // If confidence scores are all above 90%, mark as auto-verified
  if (item.confidenceScores) {
    const scores = Object.values(item.confidenceScores);
    const allHighConfidence = scores.every((score) => score >= 0.9);
    if (allHighConfidence) {
      return 'auto-verified';
    }
  }

  // If status is completed but not verified, mark as unverified
  if (item.status === 'completed') {
    return 'unverified';
  }

  // For pending/processing jobs, mark as pending
  return 'pending';
}

/**
 * Apply migration (forward)
 */
async function up(context) {
  const { environment, dryRun, log } = context;

  log('Adding verificationStatus attribute to scan jobs...');

  const tableName = `vaidyalink-scanjobs-${environment}`;

  const stats = await batchTransformItems(
    tableName,
    (item) => {
      // Only add if not already present
      if (item.verificationStatus) {
        return item;
      }

      return addAttribute(item, 'verificationStatus', computeVerificationStatus);
    },
    {
      dryRun,
      batchSize: 25,
      delayMs: 100,
      onProgress: (progress) => {
        if (progress.processedCount % 100 === 0) {
          log(
            `Progress: ${progress.processedCount} processed, ` +
              `${progress.updatedCount} updated, ` +
              `${progress.skippedCount} skipped`
          );
        }
      },
    }
  );

  log('');
  log('Migration completed:');
  log(`  Processed: ${stats.processedCount} items`);
  log(`  Updated: ${stats.updatedCount} items`);
  log(`  Skipped: ${stats.skippedCount} items`);
  log(`  Errors: ${stats.errorCount} items`);
}

/**
 * Rollback migration (backward)
 */
async function down(context) {
  const { environment, dryRun, log } = context;

  log('Removing verificationStatus attribute from scan jobs...');

  const tableName = `vaidyalink-scanjobs-${environment}`;

  const stats = await batchTransformItems(
    tableName,
    (item) => {
      // Remove the attribute
      const { verificationStatus, ...rest } = item;
      return rest;
    },
    {
      dryRun,
      batchSize: 25,
      delayMs: 100,
      onProgress: (progress) => {
        if (progress.processedCount % 100 === 0) {
          log(`Progress: ${progress.processedCount} processed`);
        }
      },
    }
  );

  log('');
  log('Rollback completed:');
  log(`  Processed: ${stats.processedCount} items`);
  log(`  Updated: ${stats.updatedCount} items`);
}

module.exports = {
  description,
  affectedTables,
  up,
  down,
};
