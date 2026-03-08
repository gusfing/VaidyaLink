/**
 * Migration Validators
 *
 * Validation utilities for migration scripts.
 */

/**
 * Validate migration structure
 */
function validateMigration(migration, direction) {
  if (!migration) {
    throw new Error('Migration module is empty');
  }

  // Check for required functions
  if (typeof migration.up !== 'function') {
    throw new Error('Migration must export an "up" function');
  }

  if (typeof migration.down !== 'function') {
    throw new Error('Migration must export a "down" function');
  }

  // Check for description
  if (!migration.description || typeof migration.description !== 'string') {
    throw new Error('Migration must export a "description" string');
  }

  // Check for affected tables
  if (!migration.affectedTables || !Array.isArray(migration.affectedTables)) {
    throw new Error('Migration must export an "affectedTables" array');
  }

  if (migration.affectedTables.length === 0) {
    throw new Error('Migration must specify at least one affected table');
  }

  return true;
}

/**
 * Validate table name format
 */
function validateTableName(tableName) {
  if (!tableName || typeof tableName !== 'string') {
    throw new Error('Table name must be a non-empty string');
  }

  // Check for environment suffix
  const validPattern = /^vaidyalink-[a-z]+-[a-z]+$/;
  if (!validPattern.test(tableName)) {
    throw new Error(
      `Invalid table name format: ${tableName}. ` +
        'Expected format: vaidyalink-{resource}-{environment}'
    );
  }

  return true;
}

/**
 * Validate GSI configuration
 */
function validateGSIConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('GSI config must be an object');
  }

  if (!config.indexName || typeof config.indexName !== 'string') {
    throw new Error('GSI config must have an indexName string');
  }

  if (!config.partitionKey || typeof config.partitionKey !== 'string') {
    throw new Error('GSI config must have a partitionKey string');
  }

  const validProjectionTypes = ['ALL', 'KEYS_ONLY', 'INCLUDE'];
  if (config.projectionType && !validProjectionTypes.includes(config.projectionType)) {
    throw new Error(
      `Invalid projectionType: ${config.projectionType}. ` +
        `Must be one of: ${validProjectionTypes.join(', ')}`
    );
  }

  if (config.projectionType === 'INCLUDE') {
    if (!config.nonKeyAttributes || !Array.isArray(config.nonKeyAttributes)) {
      throw new Error('GSI with INCLUDE projection must specify nonKeyAttributes array');
    }
  }

  return true;
}

/**
 * Validate batch operation configuration
 */
function validateBatchConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Batch config must be an object');
  }

  if (config.batchSize && (typeof config.batchSize !== 'number' || config.batchSize < 1)) {
    throw new Error('batchSize must be a positive number');
  }

  if (config.delayMs && (typeof config.delayMs !== 'number' || config.delayMs < 0)) {
    throw new Error('delayMs must be a non-negative number');
  }

  if (config.maxRetries && (typeof config.maxRetries !== 'number' || config.maxRetries < 0)) {
    throw new Error('maxRetries must be a non-negative number');
  }

  return true;
}

/**
 * Validate attribute transformation function
 */
function validateTransformFunction(fn) {
  if (typeof fn !== 'function') {
    throw new Error('Transform must be a function');
  }

  // Check function arity (should accept at least one parameter)
  if (fn.length === 0) {
    throw new Error('Transform function must accept at least one parameter (item)');
  }

  return true;
}

/**
 * Validate migration context
 */
function validateContext(context) {
  if (!context || typeof context !== 'object') {
    throw new Error('Migration context must be an object');
  }

  if (!context.environment || typeof context.environment !== 'string') {
    throw new Error('Context must have an environment string');
  }

  if (typeof context.dryRun !== 'boolean') {
    throw new Error('Context must have a dryRun boolean');
  }

  if (typeof context.log !== 'function') {
    throw new Error('Context must have a log function');
  }

  return true;
}

/**
 * Validate item structure for DynamoDB
 */
function validateDynamoDBItem(item) {
  if (!item || typeof item !== 'object') {
    throw new Error('Item must be an object');
  }

  if (!item.PK || typeof item.PK !== 'string') {
    throw new Error('Item must have a PK (partition key) string');
  }

  if (!item.SK || typeof item.SK !== 'string') {
    throw new Error('Item must have an SK (sort key) string');
  }

  return true;
}

/**
 * Validate backup configuration
 */
function validateBackupConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Backup config must be an object');
  }

  if (!config.tableName || typeof config.tableName !== 'string') {
    throw new Error('Backup config must have a tableName string');
  }

  if (!config.backupName || typeof config.backupName !== 'string') {
    throw new Error('Backup config must have a backupName string');
  }

  return true;
}

/**
 * Validate date string format (ISO 8601)
 */
function validateISODate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error('Date must be a string');
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO 8601 date: ${dateString}`);
  }

  return true;
}

/**
 * Validate migration version format
 */
function validateVersion(version) {
  if (!version || typeof version !== 'string') {
    throw new Error('Version must be a non-empty string');
  }

  // Version should be a 3-digit number
  if (!/^\d{3}$/.test(version)) {
    throw new Error(`Invalid version format: ${version}. Expected format: 001, 002, etc.`);
  }

  return true;
}

module.exports = {
  validateMigration,
  validateTableName,
  validateGSIConfig,
  validateBatchConfig,
  validateTransformFunction,
  validateContext,
  validateDynamoDBItem,
  validateBackupConfig,
  validateISODate,
  validateVersion,
};
