/**
 * Migration Manager
 *
 * Core orchestration for DynamoDB migrations.
 * Handles version tracking, execution, and rollback.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  GetCommand,
} = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { validateMigration } = require('./validators');
const { createBackup } = require('../utils/backup-restore');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const docClient = DynamoDBDocumentClient.from(client);

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const MIGRATIONS_TABLE = `vaidyalink-migrations-${ENVIRONMENT}`;
const MIGRATIONS_DIR = path.join(__dirname, '../scripts');

class MigrationManager {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.createBackups = options.createBackups !== false; // Default true
  }

  /**
   * Initialize migrations table if it doesn't exist
   */
  async initialize() {
    try {
      await this.getAppliedMigrations();
      this.log('Migrations table exists');
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        throw new Error(
          `Migrations table ${MIGRATIONS_TABLE} does not exist. ` +
            'Please create it using the CDK stack or manually.'
        );
      }
      throw error;
    }
  }

  /**
   * Get all applied migrations from the database
   */
  async getAppliedMigrations() {
    const params = {
      TableName: MIGRATIONS_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'MIGRATION',
      },
      ScanIndexForward: true, // Sort by version ascending
    };

    const command = new QueryCommand(params);
    const result = await docClient.send(command);

    return (result.Items || []).map((item) => ({
      version: item.SK.replace('VERSION#', ''),
      name: item.name,
      appliedAt: item.appliedAt,
      executionTime: item.executionTime,
      status: item.status,
      checksum: item.checksum,
    }));
  }

  /**
   * Get all migration files from the scripts directory
   */
  async getMigrationFiles() {
    const files = await fs.readdir(MIGRATIONS_DIR);

    const migrations = files
      .filter((file) => file.endsWith('.js') && file !== 'template.js')
      .map((file) => {
        const match = file.match(/^(\d+)_(.+)\.js$/);
        if (!match) {
          throw new Error(`Invalid migration filename: ${file}`);
        }
        return {
          version: match[1],
          name: match[2],
          filename: file,
          path: path.join(MIGRATIONS_DIR, file),
        };
      })
      .sort((a, b) => a.version.localeCompare(b.version));

    return migrations;
  }

  /**
   * Calculate checksum of a migration file
   */
  async calculateChecksum(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get pending migrations that haven't been applied
   */
  async getPendingMigrations(toVersion = null) {
    const applied = await this.getAppliedMigrations();
    const allMigrations = await this.getMigrationFiles();

    const appliedVersions = new Set(
      applied.filter((m) => m.status === 'applied').map((m) => m.version)
    );

    let pending = allMigrations.filter((m) => !appliedVersions.has(m.version));

    if (toVersion) {
      pending = pending.filter((m) => m.version <= toVersion);
    }

    return pending;
  }

  /**
   * Run all pending migrations
   */
  async up(toVersion = null) {
    await this.initialize();

    const pending = await this.getPendingMigrations(toVersion);

    if (pending.length === 0) {
      this.log('No pending migrations');
      return [];
    }

    this.log(`Found ${pending.length} pending migration(s)`);

    const results = [];

    for (const migration of pending) {
      this.log(`\n${'='.repeat(60)}`);
      this.log(`Running migration ${migration.version}: ${migration.name}`);
      this.log('='.repeat(60));

      try {
        const result = await this.runMigration(migration, 'up');
        results.push(result);
        this.log(`✓ Migration ${migration.version} completed successfully`);
      } catch (error) {
        this.log(`✗ Migration ${migration.version} failed: ${error.message}`);
        throw error;
      }
    }

    return results;
  }

  /**
   * Rollback migrations
   */
  async down(toVersion = null) {
    await this.initialize();

    const applied = await this.getAppliedMigrations();
    const appliedMigrations = applied
      .filter((m) => m.status === 'applied')
      .sort((a, b) => b.version.localeCompare(a.version)); // Descending order

    if (appliedMigrations.length === 0) {
      this.log('No migrations to rollback');
      return [];
    }

    let toRollback;
    if (toVersion) {
      toRollback = appliedMigrations.filter((m) => m.version > toVersion);
    } else {
      // Rollback only the last migration
      toRollback = [appliedMigrations[0]];
    }

    if (toRollback.length === 0) {
      this.log('No migrations to rollback');
      return [];
    }

    this.log(`Rolling back ${toRollback.length} migration(s)`);

    const results = [];

    for (const migration of toRollback) {
      this.log(`\n${'='.repeat(60)}`);
      this.log(`Rolling back migration ${migration.version}: ${migration.name}`);
      this.log('='.repeat(60));

      try {
        const migrationFile = await this.getMigrationFiles();
        const file = migrationFile.find((m) => m.version === migration.version);

        if (!file) {
          throw new Error(`Migration file not found for version ${migration.version}`);
        }

        const result = await this.runMigration(file, 'down');
        results.push(result);
        this.log(`✓ Migration ${migration.version} rolled back successfully`);
      } catch (error) {
        this.log(`✗ Rollback ${migration.version} failed: ${error.message}`);
        throw error;
      }
    }

    return results;
  }

  /**
   * Run a single migration
   */
  async runMigration(migration, direction) {
    const startTime = Date.now();

    // Load migration module
    const migrationModule = require(migration.path);

    // Validate migration structure
    validateMigration(migrationModule, direction);

    // Calculate checksum
    const checksum = await this.calculateChecksum(migration.path);

    // Check if migration was already applied with different checksum
    if (direction === 'up') {
      const existing = await this.getMigrationRecord(migration.version);
      if (existing && existing.checksum !== checksum) {
        throw new Error(
          `Migration ${migration.version} has been modified after being applied. ` +
            'Create a new migration instead.'
        );
      }
    }

    // Create backup if enabled
    if (this.createBackups && !this.dryRun) {
      this.log('Creating backup before migration...');
      const tables = migrationModule.affectedTables || [];
      for (const tableName of tables) {
        await createBackup(tableName, `migration-${migration.version}-${Date.now()}`);
      }
    }

    // Run migration
    if (this.dryRun) {
      this.log('[DRY RUN] Would execute migration');
    } else {
      const context = {
        environment: ENVIRONMENT,
        dryRun: this.dryRun,
        log: this.log.bind(this),
      };

      if (direction === 'up') {
        await migrationModule.up(context);
      } else {
        await migrationModule.down(context);
      }
    }

    const executionTime = Date.now() - startTime;

    // Record migration
    if (!this.dryRun) {
      if (direction === 'up') {
        await this.recordMigration(migration, checksum, executionTime, 'applied');
      } else {
        await this.recordMigration(migration, checksum, executionTime, 'rolled_back');
      }
    }

    return {
      version: migration.version,
      name: migration.name,
      direction,
      executionTime,
      status: 'success',
    };
  }

  /**
   * Get a specific migration record
   */
  async getMigrationRecord(version) {
    const params = {
      TableName: MIGRATIONS_TABLE,
      Key: {
        PK: 'MIGRATION',
        SK: `VERSION#${version}`,
      },
    };

    const command = new GetCommand(params);
    const result = await docClient.send(command);

    return result.Item;
  }

  /**
   * Record migration in the database
   */
  async recordMigration(migration, checksum, executionTime, status) {
    const params = {
      TableName: MIGRATIONS_TABLE,
      Item: {
        PK: 'MIGRATION',
        SK: `VERSION#${migration.version}`,
        version: migration.version,
        name: migration.name,
        appliedAt: new Date().toISOString(),
        executionTime,
        status,
        checksum,
      },
    };

    const command = new PutCommand(params);
    await docClient.send(command);
  }

  /**
   * Get migration status
   */
  async status() {
    await this.initialize();

    const applied = await this.getAppliedMigrations();
    const allMigrations = await this.getMigrationFiles();

    const appliedVersions = new Set(
      applied.filter((m) => m.status === 'applied').map((m) => m.version)
    );

    console.log('\nMigration Status:');
    console.log('='.repeat(80));
    console.log('Version'.padEnd(10) + 'Name'.padEnd(40) + 'Status'.padEnd(15) + 'Applied At');
    console.log('-'.repeat(80));

    for (const migration of allMigrations) {
      const isApplied = appliedVersions.has(migration.version);
      const appliedInfo = applied.find((m) => m.version === migration.version);

      console.log(
        migration.version.padEnd(10) +
          migration.name.padEnd(40) +
          (isApplied ? '✓ Applied' : '○ Pending').padEnd(15) +
          (appliedInfo ? appliedInfo.appliedAt : '')
      );
    }

    console.log('='.repeat(80));
    console.log(
      `\nTotal: ${allMigrations.length} migrations ` +
        `(${appliedVersions.size} applied, ${allMigrations.length - appliedVersions.size} pending)`
    );
  }

  /**
   * Validate all migrations without running them
   */
  async validate() {
    const migrations = await this.getMigrationFiles();

    this.log(`Validating ${migrations.length} migration(s)...`);

    let hasErrors = false;

    for (const migration of migrations) {
      try {
        const migrationModule = require(migration.path);
        validateMigration(migrationModule, 'up');
        validateMigration(migrationModule, 'down');
        this.log(`✓ ${migration.version}: ${migration.name}`);
      } catch (error) {
        this.log(`✗ ${migration.version}: ${error.message}`);
        hasErrors = true;
      }
    }

    if (hasErrors) {
      throw new Error('Migration validation failed');
    }

    this.log('\n✓ All migrations are valid');
  }

  /**
   * Log message if verbose mode is enabled
   */
  log(message) {
    if (this.verbose || !this.dryRun) {
      console.log(message);
    }
  }
}

module.exports = { MigrationManager };
