# DynamoDB Migrations - Quick Start

Get started with DynamoDB migrations in 5 minutes.

## Installation

```bash
cd backend/migrations
npm install
```

## Initialize Migrations Table

Create the migrations tracking table:

```bash
npm run migrate:init
```

This creates a table named `vaidyalink-migrations-{environment}` to track migration history.

## Check Migration Status

See which migrations have been applied:

```bash
npm run migrate:status
```

Output:

```
Migration Status:
================================================================================
Version   Name                                    Status         Applied At
--------------------------------------------------------------------------------
001       initial_schema                          ✓ Applied      2024-01-15T10:00:00Z
002       example_add_verification_status         ○ Pending
================================================================================

Total: 2 migrations (1 applied, 1 pending)
```

## Run Pending Migrations

Apply all pending migrations:

```bash
# Dry run first (preview changes)
npm run migrate:up -- --dry-run

# Apply migrations
npm run migrate:up
```

## Create a New Migration

Generate a new migration file:

```bash
npm run migrate:create -- --name=add_patient_email_index
```

This creates `backend/migrations/scripts/003_add_patient_email_index.js`.

Edit the file:

```javascript
const { batchTransformItems } = require('../utils/batch-operations');
const { addAttribute } = require('../utils/data-transformers');

const description = 'Add email index to patients table';

const affectedTables = [
  'vaidyalink-patients-dev',
  'vaidyalink-patients-staging',
  'vaidyalink-patients-prod',
];

async function up(context) {
  const { environment, dryRun, log } = context;

  log('Adding email attribute to patients...');

  const stats = await batchTransformItems(
    `vaidyalink-patients-${environment}`,
    (item) => addAttribute(item, 'email', ''),
    { dryRun }
  );

  log(`Updated ${stats.updatedCount} patients`);
}

async function down(context) {
  const { environment, dryRun, log } = context;

  log('Removing email attribute from patients...');

  const stats = await batchTransformItems(
    `vaidyalink-patients-${environment}`,
    (item) => {
      const { email, ...rest } = item;
      return rest;
    },
    { dryRun }
  );

  log(`Updated ${stats.updatedCount} patients`);
}

module.exports = { description, affectedTables, up, down };
```

## Test Your Migration

1. **Validate structure**:

   ```bash
   npm run migrate:validate
   ```

2. **Dry run**:

   ```bash
   ENVIRONMENT=dev npm run migrate:up -- --dry-run
   ```

3. **Apply in development**:

   ```bash
   ENVIRONMENT=dev npm run migrate:up
   ```

4. **Verify results**:

   ```bash
   npm run migrate:status
   ```

5. **Test rollback**:

   ```bash
   ENVIRONMENT=dev npm run migrate:down
   ```

6. **Re-apply**:
   ```bash
   ENVIRONMENT=dev npm run migrate:up
   ```

## Rollback a Migration

Rollback the last migration:

```bash
npm run migrate:down
```

Rollback to a specific version:

```bash
npm run migrate:down -- --to=003
```

## Common Commands

```bash
# Check status
npm run migrate:status

# Run all pending migrations
npm run migrate:up

# Run migrations up to version 005
npm run migrate:up -- --to=005

# Dry run (preview changes)
npm run migrate:up -- --dry-run

# Rollback last migration
npm run migrate:down

# Rollback to version 003
npm run migrate:down -- --to=003

# Create new migration
npm run migrate:create -- --name=my_migration

# Validate all migrations
npm run migrate:validate

# Initialize migrations table
npm run migrate:init
```

## Environment Variables

Set these environment variables:

```bash
# Required
export AWS_REGION=ap-south-1
export ENVIRONMENT=dev  # or staging, prod

# Optional
export AWS_PROFILE=vaidyalink  # If using AWS profiles
```

## Common Patterns

### Add a New Attribute

```javascript
const { addAttribute } = require('../utils/data-transformers');

await batchTransformItems(tableName, (item) => addAttribute(item, 'newField', 'defaultValue'));
```

### Rename an Attribute

```javascript
const { renameAttribute } = require('../utils/data-transformers');

await batchTransformItems(tableName, (item) => renameAttribute(item, 'oldName', 'newName'));
```

### Transform Attribute Value

```javascript
const { transformAttribute } = require('../utils/data-transformers');

await batchTransformItems(tableName, (item) => transformAttribute(item, 'count', (val) => val * 2));
```

### Conditional Update

```javascript
const { conditionalTransform } = require('../utils/data-transformers');

await batchTransformItems(tableName, (item) =>
  conditionalTransform(
    item,
    (item) => item.status === 'pending',
    (item) => ({ ...item, status: 'queued' })
  )
);
```

## Next Steps

- Read the [Migration Guide](./docs/MIGRATION_GUIDE.md) for detailed instructions
- Review [Best Practices](./docs/BEST_PRACTICES.md) for production migrations
- Check [Rollback Guide](./docs/ROLLBACK_GUIDE.md) for emergency procedures
- See [DynamoDB Tables Reference](../../infrastructure/docs/DYNAMODB_TABLES.md) for table schemas

## Getting Help

- Check the [Migration Guide](./docs/MIGRATION_GUIDE.md)
- Review example migrations in `scripts/`
- Ask the team in #vaidyalink-dev Slack channel

## Troubleshooting

### "Migrations table does not exist"

Run `npm run migrate:init` to create the migrations table.

### "Migration has been modified"

Never modify an applied migration. Create a new migration instead.

### "Throttling errors"

Reduce `batchSize` and increase `delayMs` in migration options:

```javascript
await batchTransformItems(tableName, transformFn, {
  batchSize: 10,
  delayMs: 500,
});
```

### "Migration failed"

1. Check CloudWatch logs for errors
2. Verify IAM permissions
3. Test in development first
4. Use dry-run mode to preview changes
