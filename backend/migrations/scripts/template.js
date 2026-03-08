/**
 * Migration Template
 *
 * Copy this template to create a new migration.
 * Naming convention: XXX_description.js (e.g., 001_add_email_index.js)
 */

const { batchTransformItems } = require('../utils/batch-operations');
const { addAttribute, removeAttribute } = require('../utils/data-transformers');

/**
 * Migration description
 * Explain what this migration does and why
 */
const description = 'Description of what this migration does';

/**
 * Tables affected by this migration
 * Used for backup creation and validation
 */
const affectedTables = [
  'vaidyalink-scanjobs-dev', // Update with actual table names
];

/**
 * Apply migration (forward)
 *
 * @param {Object} context - Migration context
 * @param {string} context.environment - Current environment (dev, staging, prod)
 * @param {boolean} context.dryRun - Whether this is a dry run
 * @param {Function} context.log - Logging function
 */
async function up(context) {
  const { environment, dryRun, log } = context;

  log('Starting migration...');

  // Example: Add a new attribute to all items
  const tableName = `vaidyalink-scanjobs-${environment}`;

  const stats = await batchTransformItems(
    tableName,
    (item) => {
      // Transform each item
      return addAttribute(item, 'newAttribute', 'defaultValue');
    },
    {
      dryRun,
      onProgress: (progress) => {
        log(`Processed: ${progress.processedCount}, Updated: ${progress.updatedCount}`);
      },
    }
  );

  log(`Migration completed: ${stats.updatedCount} items updated`);
}

/**
 * Rollback migration (backward)
 *
 * @param {Object} context - Migration context
 */
async function down(context) {
  const { environment, dryRun, log } = context;

  log('Rolling back migration...');

  // Example: Remove the attribute added in up()
  const tableName = `vaidyalink-scanjobs-${environment}`;

  const stats = await batchTransformItems(
    tableName,
    (item) => {
      return removeAttribute(item, 'newAttribute');
    },
    {
      dryRun,
      onProgress: (progress) => {
        log(`Processed: ${progress.processedCount}, Updated: ${progress.updatedCount}`);
      },
    }
  );

  log(`Rollback completed: ${stats.updatedCount} items updated`);
}

module.exports = {
  description,
  affectedTables,
  up,
  down,
};
