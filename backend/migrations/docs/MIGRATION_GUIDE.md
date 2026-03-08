# Migration Guide

This guide explains how to create, test, and run DynamoDB migrations for VaidyaLink.

## Table of Contents

1. [Creating a Migration](#creating-a-migration)
2. [Writing Migration Code](#writing-migration-code)
3. [Testing Migrations](#testing-migrations)
4. [Running Migrations](#running-migrations)
5. [Rollback Procedures](#rollback-procedures)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)

## Creating a Migration

### Generate Migration File

Use the CLI to generate a new migration file:

```bash
npm run migrate:create -- --name=add_patient_email_index
```

This creates a file like `003_add_patient_email_index.js` in the `scripts/` directory.

### Migration File Structure

Every migration must export:

- `description`: String describing what the migration does
- `affectedTables`: Array of table names that will be modified
- `up()`: Function to apply the migration
- `down()`: Function to rollback the migration

```javascript
const description = 'Add email index to patients table';

const affectedTables = [
  'vaidyalink-patients-dev',
  'vaidyalink-patients-staging',
  'vaidyalink-patients-prod',
];

async function up(context) {
  // Apply migration
}

async function down(context) {
  // Rollback migration
}

module.exports = { description, affectedTables, up, down };
```

## Writing Migration Code

### Context Object

The `context` object passed to `up()` and `down()` contains:

- `environment`: Current environment (dev, staging, prod)
- `dryRun`: Boolean indicating if this is a dry run
- `log`: Function for logging messages

```javascript
async function up(context) {
  const { environment, dryRun, log } = context;

  log('Starting migration...');

  const tableName = `vaidyalink-scanjobs-${environment}`;

  // Your migration code here
}
```

### Using Batch Operations

For operations on many items, use the batch utilities:

```javascript
const { batchTransformItems } = require('../utils/batch-operations');

async function up(context) {
  const { environment, dryRun, log } = context;

  const stats = await batchTransformItems(
    `vaidyalink-scanjobs-${environment}`,
    (item) => {
      // Transform each item
      return {
        ...item,
        newAttribute: 'value',
      };
    },
    {
      dryRun,
      batchSize: 25,
      delayMs: 100,
      onProgress: (progress) => {
        log(`Processed: ${progress.processedCount}`);
      },
    }
  );

  log(`Updated ${stats.updatedCount} items`);
}
```

### Using Data Transformers

Common transformations are available in `data-transformers.js`:

```javascript
const {
  addAttribute,
  removeAttribute,
  renameAttribute,
  transformAttribute,
} = require('../utils/data-transformers');

async function up(context) {
  await batchTransformItems(tableName, (item) => {
    // Add new attribute
    item = addAttribute(item, 'status', 'active');

    // Rename attribute
    item = renameAttribute(item, 'oldName', 'newName');

    // Transform attribute value
    item = transformAttribute(item, 'count', (val) => val * 2);

    return item;
  });
}
```

## Testing Migrations

### 1. Validate Migration Structure

```bash
npm run migrate:validate
```

This checks that all migrations have the required structure.

### 2. Dry Run in Development

Test the migration without actually modifying data:

```bash
ENVIRONMENT=dev npm run migrate:up -- --dry-run
```

### 3. Run in Development

Apply the migration to your development environment:

```bash
ENVIRONMENT=dev npm run migrate:up
```

### 4. Verify Results

Check that the migration worked as expected:

```bash
# Check migration status
npm run migrate:status

# Verify data in DynamoDB
aws dynamodb scan --table-name vaidyalink-scanjobs-dev --limit 5
```

### 5. Test Rollback

Always test the rollback function:

```bash
ENVIRONMENT=dev npm run migrate:down
```

Verify that data is restored to its previous state.

### 6. Re-apply Migration

After successful rollback, re-apply the migration:

```bash
ENVIRONMENT=dev npm run migrate:up
```

## Running Migrations

### Development Environment

```bash
ENVIRONMENT=dev npm run migrate:up
```

### Staging Environment

```bash
ENVIRONMENT=staging npm run migrate:up
```

### Production Environment

**IMPORTANT**: Always follow these steps for production:

1. **Create Manual Backup**:

   ```bash
   aws dynamodb create-backup \
     --table-name vaidyalink-scanjobs-prod \
     --backup-name pre-migration-$(date +%Y%m%d-%H%M%S)
   ```

2. **Dry Run**:

   ```bash
   ENVIRONMENT=prod npm run migrate:up -- --dry-run
   ```

3. **Schedule Maintenance Window**:
   - Notify users of potential downtime
   - Choose low-traffic period
   - Have rollback plan ready

4. **Run Migration**:

   ```bash
   ENVIRONMENT=prod npm run migrate:up --verbose
   ```

5. **Monitor**:
   - Watch CloudWatch metrics for errors
   - Check application logs
   - Verify data integrity

6. **Verify**:
   ```bash
   npm run migrate:status
   ```

### Running Specific Migrations

Run migrations up to a specific version:

```bash
npm run migrate:up -- --to=005
```

## Rollback Procedures

### Rollback Last Migration

```bash
npm run migrate:down
```

### Rollback to Specific Version

```bash
npm run migrate:down -- --to=003
```

This rolls back all migrations after version 003.

### Emergency Rollback

If a migration fails in production:

1. **Stop the Migration** (if still running)

2. **Assess the Damage**:

   ```bash
   npm run migrate:status
   aws dynamodb describe-table --table-name vaidyalink-scanjobs-prod
   ```

3. **Attempt Automatic Rollback**:

   ```bash
   ENVIRONMENT=prod npm run migrate:down
   ```

4. **If Automatic Rollback Fails**:
   - Restore from backup:
     ```bash
     aws dynamodb restore-table-from-backup \
       --target-table-name vaidyalink-scanjobs-prod-restored \
       --backup-arn <backup-arn>
     ```
   - Or use point-in-time recovery:
     ```bash
     aws dynamodb restore-table-to-point-in-time \
       --source-table-name vaidyalink-scanjobs-prod \
       --target-table-name vaidyalink-scanjobs-prod-restored \
       --restore-date-time <timestamp>
     ```

5. **Document the Incident**:
   - What went wrong
   - How it was resolved
   - How to prevent it in the future

## Common Patterns

### Adding a New Attribute

```javascript
const { batchTransformItems } = require('../utils/batch-operations');
const { addAttribute } = require('../utils/data-transformers');

async function up(context) {
  const { environment, dryRun, log } = context;

  await batchTransformItems(
    `vaidyalink-scanjobs-${environment}`,
    (item) => addAttribute(item, 'newField', 'defaultValue'),
    { dryRun }
  );
}

async function down(context) {
  const { environment, dryRun, log } = context;

  await batchTransformItems(
    `vaidyalink-scanjobs-${environment}`,
    (item) => {
      const { newField, ...rest } = item;
      return rest;
    },
    { dryRun }
  );
}
```

### Renaming an Attribute

```javascript
const { renameAttribute } = require('../utils/data-transformers');

async function up(context) {
  await batchTransformItems(tableName, (item) => renameAttribute(item, 'oldName', 'newName'), {
    dryRun: context.dryRun,
  });
}

async function down(context) {
  await batchTransformItems(tableName, (item) => renameAttribute(item, 'newName', 'oldName'), {
    dryRun: context.dryRun,
  });
}
```

### Data Type Conversion

```javascript
const { convertDateFormat } = require('../utils/data-transformers');

async function up(context) {
  await batchTransformItems(
    tableName,
    (item) => convertDateFormat(item, 'createdAt', 'unix', 'iso8601'),
    { dryRun: context.dryRun }
  );
}
```

### Conditional Transformation

```javascript
const { conditionalTransform } = require('../utils/data-transformers');

async function up(context) {
  await batchTransformItems(
    tableName,
    (item) =>
      conditionalTransform(
        item,
        (item) => item.status === 'pending', // Condition
        (item) => ({ ...item, status: 'queued' }) // Transform
      ),
    { dryRun: context.dryRun }
  );
}
```

### Backfilling from Another Table

```javascript
const { getPatient } = require('../../shared/nodejs/dynamodb/query-helpers');

async function up(context) {
  await batchTransformItems(
    `vaidyalink-scanjobs-${context.environment}`,
    async (item) => {
      if (!item.patientName && item.patientId) {
        const patient = await getPatient(item.patientId);
        return {
          ...item,
          patientName: patient?.name || 'Unknown',
        };
      }
      return item;
    },
    {
      dryRun: context.dryRun,
      delayMs: 200, // Slower to avoid throttling
    }
  );
}
```

## Troubleshooting

### Migration Fails with Throttling Error

**Problem**: `ProvisionedThroughputExceededException`

**Solution**:

- Reduce `batchSize` in migration options
- Increase `delayMs` between batches
- Run during low-traffic periods

```javascript
await batchTransformItems(tableName, transformFn, {
  batchSize: 10, // Reduced from 25
  delayMs: 500, // Increased from 100
});
```

### Migration Checksum Mismatch

**Problem**: "Migration has been modified after being applied"

**Solution**:

- Never modify an applied migration
- Create a new migration instead
- If absolutely necessary, manually update the checksum in the migrations table

### Migration Stuck/Hanging

**Problem**: Migration doesn't complete

**Solution**:

1. Check CloudWatch logs for errors
2. Check if Lambda functions are timing out
3. Verify network connectivity
4. Check DynamoDB table status

### Rollback Fails

**Problem**: `down()` function fails

**Solution**:

1. Check error message in logs
2. Verify rollback logic is correct
3. Consider manual intervention
4. Restore from backup if necessary

### Data Inconsistency After Migration

**Problem**: Some items weren't updated

**Solution**:

1. Check migration logs for errors
2. Identify which items failed
3. Create a fix-up migration
4. Run validation queries

```javascript
// Fix-up migration
async function up(context) {
  const { environment, log } = context;

  // Find items that need fixing
  const items = await scanAndFilter(
    `vaidyalink-scanjobs-${environment}`,
    (item) => !item.newAttribute // Missing attribute
  );

  log(`Found ${items.length} items to fix`);

  // Apply fix
  await batchTransformItems(tableName, (item) => addAttribute(item, 'newAttribute', 'value'), {
    dryRun: context.dryRun,
  });
}
```

## Best Practices

1. **Always test in development first**
2. **Always implement rollback**
3. **Use dry-run mode before applying**
4. **Create backups before major changes**
5. **Monitor during and after migration**
6. **Document breaking changes**
7. **Keep migrations small and focused**
8. **Never modify applied migrations**
9. **Use batch operations for large datasets**
10. **Add delays to avoid throttling**

## Next Steps

- Read [Best Practices](./BEST_PRACTICES.md)
- Review [Rollback Guide](./ROLLBACK_GUIDE.md)
- Check [DynamoDB Tables Reference](../../../infrastructure/docs/DYNAMODB_TABLES.md)
