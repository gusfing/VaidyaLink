#!/usr/bin/env node

/**
 * Migration CLI
 *
 * Command-line interface for running DynamoDB migrations.
 */

const { MigrationManager } = require('./framework/migration-manager');
const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');

program.name('migrate').description('DynamoDB migration tool for VaidyaLink').version('1.0.0');

// Up command - run pending migrations
program
  .command('up')
  .description('Run all pending migrations')
  .option('--to <version>', 'Run migrations up to this version')
  .option('--dry-run', 'Preview changes without applying')
  .option('--no-backup', 'Skip automatic backups')
  .option('--verbose', 'Verbose output')
  .action(async (options) => {
    try {
      const manager = new MigrationManager({
        dryRun: options.dryRun,
        verbose: options.verbose,
        createBackups: options.backup,
      });

      const results = await manager.up(options.to);

      if (results.length === 0) {
        console.log('\n✓ No migrations to run');
      } else {
        console.log('\n✓ All migrations completed successfully');
        console.log(`\nExecuted ${results.length} migration(s):`);
        results.forEach((r) => {
          console.log(`  - ${r.version}: ${r.name} (${r.executionTime}ms)`);
        });
      }

      process.exit(0);
    } catch (error) {
      console.error('\n✗ Migration failed:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Down command - rollback migrations
program
  .command('down')
  .description('Rollback migrations')
  .option('--to <version>', 'Rollback to this version')
  .option('--dry-run', 'Preview changes without applying')
  .option('--no-backup', 'Skip automatic backups')
  .option('--verbose', 'Verbose output')
  .action(async (options) => {
    try {
      const manager = new MigrationManager({
        dryRun: options.dryRun,
        verbose: options.verbose,
        createBackups: options.backup,
      });

      const results = await manager.down(options.to);

      if (results.length === 0) {
        console.log('\n✓ No migrations to rollback');
      } else {
        console.log('\n✓ All rollbacks completed successfully');
        console.log(`\nRolled back ${results.length} migration(s):`);
        results.forEach((r) => {
          console.log(`  - ${r.version}: ${r.name} (${r.executionTime}ms)`);
        });
      }

      process.exit(0);
    } catch (error) {
      console.error('\n✗ Rollback failed:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Status command - show migration status
program
  .command('status')
  .description('Show migration status')
  .action(async () => {
    try {
      const manager = new MigrationManager({ verbose: true });
      await manager.status();
      process.exit(0);
    } catch (error) {
      console.error('\n✗ Failed to get status:', error.message);
      process.exit(1);
    }
  });

// Validate command - validate all migrations
program
  .command('validate')
  .description('Validate all migration files')
  .action(async () => {
    try {
      const manager = new MigrationManager({ verbose: true });
      await manager.validate();
      process.exit(0);
    } catch (error) {
      console.error('\n✗ Validation failed:', error.message);
      process.exit(1);
    }
  });

// Create command - generate new migration file
program
  .command('create')
  .description('Create a new migration file')
  .requiredOption('--name <name>', 'Migration name (e.g., add_email_index)')
  .action(async (options) => {
    try {
      const scriptsDir = path.join(__dirname, 'scripts');
      const files = await fs.readdir(scriptsDir);

      // Find next version number
      const versions = files
        .filter((f) => f.match(/^\d{3}_/))
        .map((f) => parseInt(f.substring(0, 3)))
        .sort((a, b) => a - b);

      const nextVersion =
        versions.length > 0 ? String(versions[versions.length - 1] + 1).padStart(3, '0') : '001';

      // Sanitize name
      const sanitizedName = options.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      const filename = `${nextVersion}_${sanitizedName}.js`;
      const filepath = path.join(scriptsDir, filename);

      // Read template
      const templatePath = path.join(scriptsDir, 'template.js');
      let template = await fs.readFile(templatePath, 'utf8');

      // Replace description
      template = template.replace(
        "const description = 'Description of what this migration does';",
        `const description = '${sanitizedName.replace(/_/g, ' ')}';`
      );

      // Write new migration file
      await fs.writeFile(filepath, template);

      console.log(`\n✓ Created migration: ${filename}`);
      console.log(`\nEdit the file at: ${filepath}`);
      console.log('\nRemember to:');
      console.log('  1. Update the description');
      console.log('  2. Update affectedTables array');
      console.log('  3. Implement up() function');
      console.log('  4. Implement down() function');
      console.log('  5. Test in development environment');

      process.exit(0);
    } catch (error) {
      console.error('\n✗ Failed to create migration:', error.message);
      process.exit(1);
    }
  });

// Init command - create migrations table
program
  .command('init')
  .description('Initialize migrations table (if not exists)')
  .action(async () => {
    try {
      const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');

      const client = new DynamoDBClient({
        region: process.env.AWS_REGION || 'ap-south-1',
      });

      const environment = process.env.ENVIRONMENT || 'dev';
      const tableName = `vaidyalink-migrations-${environment}`;

      console.log(`Creating migrations table: ${tableName}...`);

      const params = {
        TableName: tableName,
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      };

      const command = new CreateTableCommand(params);
      await client.send(command);

      console.log(`✓ Migrations table created: ${tableName}`);
      console.log('\nYou can now run migrations with: npm run migrate:up');

      process.exit(0);
    } catch (error) {
      if (error.name === 'ResourceInUseException') {
        console.log('✓ Migrations table already exists');
        process.exit(0);
      } else {
        console.error('\n✗ Failed to create migrations table:', error.message);
        process.exit(1);
      }
    }
  });

program.parse();
