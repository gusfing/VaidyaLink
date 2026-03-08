# DynamoDB Migration Best Practices

This document outlines best practices for creating and managing DynamoDB migrations in VaidyaLink.

## General Principles

### 1. Migrations Are Immutable

**Never modify a migration after it has been applied to any environment.**

❌ **Bad**:

```javascript
// Modifying 001_add_status.js after it's been applied
async function up(context) {
  // Changed logic - this will cause checksum mismatch
}
```

✅ **Good**:

```javascript
// Create a new migration: 002_fix_status.js
async function up(context) {
  // New migration with corrected logic
}
```

### 2. Always Implement Rollback

Every migration must have a working `down()` function.

❌ **Bad**:

```javascript
async function down(context) {
  throw new Error('Rollback not implemented');
}
```

✅ **Good**:

```javascript
async function down(context) {
  // Reverse the changes made in up()
  await batchTransformItems(tableName, (item) => {
    const { newAttribute, ...rest } = item;
    return rest;
  });
}
```

### 3. Keep Migrations Small and Focused

Each migration should do one thing well.

❌ **Bad**:

```javascript
// 003_massive_refactor.js - does too much
async function up(context) {
  await addEmailIndex();
  await renameStatusField();
  await backfillPatientNames();
  await removeDeprecatedFields();
  await updateDateFormats();
}
```

✅ **Good**:

```javascript
// 003_add_email_index.js
// 004_rename_status_field.js
// 005_backfill_patient_names.js
// 006_remove_deprecated_fields.js
// 007_update_date_formats.js
```

## DynamoDB-Specific Practices

### 1. Understand Schema-less Nature

DynamoDB is schema-less at the item level. Migrations are primarily for:

- Adding/removing GSIs
- Backfilling new attributes
- Data transformations
- Cleanup operations

### 2. Use Batch Operations Efficiently

Always use batch operations for processing multiple items:

```javascript
const { batchTransformItems } = require('../utils/batch-operations');

async function up(context) {
  await batchTransformItems(tableName, transformFn, {
    batchSize: 25, // DynamoDB BatchWriteItem limit
    delayMs: 100, // Avoid throttling
    maxRetries: 3, // Retry on throttling
    onProgress: (stats) => {
      context.log(`Progress: ${stats.processedCount} items`);
    },
  });
}
```

### 3. Handle Throttling Gracefully

DynamoDB can throttle requests. Design migrations to handle this:

```javascript
async function up(context) {
  await batchTransformItems(tableName, transformFn, {
    batchSize: 10, // Smaller batches for large tables
    delayMs: 500, // Longer delays
    maxRetries: 5, // More retries
  });
}
```

### 4. Use Conditional Updates for Safety

When updating items, use conditions to prevent overwrites:

```javascript
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');

async function up(context) {
  await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: item.PK, SK: item.SK },
      UpdateExpression: 'SET #attr = :val',
      ConditionExpression: 'attribute_not_exists(#attr)', // Only if doesn't exist
      ExpressionAttributeNames: { '#attr': 'newAttribute' },
      ExpressionAttributeValues: { ':val': 'value' },
    })
  );
}
```

### 5. Preserve Existing Data

When transforming data, preserve the original when possible:

```javascript
// Add new attribute while keeping old one temporarily
async function up(context) {
  await batchTransformItems(tableName, (item) => ({
    ...item,
    newFormat: transformOldFormat(item.oldFormat),
    // Keep oldFormat for now - remove in a later migration
  }));
}
```

## Performance Optimization

### 1. Use Parallel Scans for Large Tables

For tables with millions of items, use parallel scans:

```javascript
async function up(context) {
  const segments = 4; // Number of parallel workers

  const promises = [];
  for (let segment = 0; segment < segments; segment++) {
    promises.push(
      batchTransformItems(tableName, transformFn, {
        segment,
        totalSegments: segments,
      })
    );
  }

  await Promise.all(promises);
}
```

### 2. Filter Items Before Processing

Only process items that need changes:

```javascript
async function up(context) {
  await batchTransformItems(tableName, transformFn, {
    filterFn: (item) => !item.newAttribute, // Only items missing the attribute
  });
}
```

### 3. Use Projection to Reduce Data Transfer

When scanning, only fetch needed attributes:

```javascript
const { scanAndFilter } = require('../utils/batch-operations');

async function up(context) {
  const items = await scanAndFilter(tableName, filterFn, {
    attributes: ['PK', 'SK', 'oldAttribute'], // Only fetch what's needed
  });
}
```

## Safety and Testing

### 1. Always Use Dry Run First

Test migrations without modifying data:

```bash
ENVIRONMENT=dev npm run migrate:up -- --dry-run
```

### 2. Test in Development Environment

Never test migrations directly in production:

```bash
# 1. Test in dev
ENVIRONMENT=dev npm run migrate:up

# 2. Verify results
ENVIRONMENT=dev npm run migrate:status

# 3. Test rollback
ENVIRONMENT=dev npm run migrate:down

# 4. Re-apply
ENVIRONMENT=dev npm run migrate:up
```

### 3. Create Backups Before Major Changes

For significant migrations, create manual backups:

```javascript
const { createBackup } = require('../utils/backup-restore');

async function up(context) {
  if (!context.dryRun) {
    await createBackup(tableName, `pre-migration-${Date.now()}`);
  }

  // Proceed with migration
}
```

### 4. Validate Data After Migration

Add validation to ensure data integrity:

```javascript
async function up(context) {
  // Apply migration
  await batchTransformItems(tableName, transformFn);

  // Validate results
  const invalidItems = await scanAndFilter(tableName, (item) => !isValid(item));

  if (invalidItems.length > 0) {
    throw new Error(`Found ${invalidItems.length} invalid items after migration`);
  }
}
```

## Error Handling

### 1. Handle Errors Gracefully

Don't let one failed item stop the entire migration:

```javascript
async function up(context) {
  const errors = [];

  await batchTransformItems(tableName, (item) => {
    try {
      return transformFn(item);
    } catch (error) {
      errors.push({ item: item.PK, error: error.message });
      return item; // Return unchanged
    }
  });

  if (errors.length > 0) {
    context.log(`Errors: ${JSON.stringify(errors, null, 2)}`);
  }
}
```

### 2. Log Progress and Errors

Provide visibility into migration progress:

```javascript
async function up(context) {
  const { log } = context;

  log('Starting migration...');

  const stats = await batchTransformItems(tableName, transformFn, {
    onProgress: (progress) => {
      if (progress.processedCount % 1000 === 0) {
        log(`Processed: ${progress.processedCount}`);
        log(`Updated: ${progress.updatedCount}`);
        log(`Errors: ${progress.errorCount}`);
      }
    },
  });

  log('Migration completed:');
  log(`  Total processed: ${stats.processedCount}`);
  log(`  Total updated: ${stats.updatedCount}`);
  log(`  Total errors: ${stats.errorCount}`);
}
```

### 3. Implement Retry Logic

Retry failed operations with exponential backoff:

```javascript
async function retryOperation(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}
```

## Documentation

### 1. Write Clear Descriptions

Explain what the migration does and why:

```javascript
const description = `
  Add verificationStatus attribute to all scan jobs.

  This attribute tracks whether a scan has been verified by HITL.
  Values: 'pending', 'auto-verified', 'verified', 'unverified'

  Related to: JIRA-123
  Breaking changes: None
`;
```

### 2. Document Breaking Changes

If a migration breaks existing code, document it:

```javascript
const description = `
  Rename 'status' to 'jobStatus' in ScanJobs table.

  ⚠️ BREAKING CHANGE: This requires updating all code that references
  the 'status' attribute. Deploy code changes before running this migration.

  Related PR: #456
`;
```

### 3. Add Comments for Complex Logic

Explain non-obvious transformations:

```javascript
async function up(context) {
  await batchTransformItems(tableName, (item) => {
    // Calculate verification status based on confidence scores
    // If all scores > 0.9, auto-verify
    // If HITL completed, mark as verified
    // Otherwise, mark as unverified
    const status = computeVerificationStatus(item);

    return { ...item, verificationStatus: status };
  });
}
```

## Coordination with Code Deployments

### 1. Plan Migration Timing

Coordinate migrations with code deployments:

**Backward-compatible migration** (safe):

```
1. Deploy code that handles both old and new schema
2. Run migration
3. Deploy code that only uses new schema
```

**Breaking migration** (requires downtime):

```
1. Schedule maintenance window
2. Stop application
3. Run migration
4. Deploy new code
5. Start application
```

### 2. Use Feature Flags

For gradual rollouts, use feature flags:

```javascript
async function up(context) {
  await batchTransformItems(tableName, (item) => ({
    ...item,
    newFeatureEnabled: false, // Start disabled
  }));
}
```

Then enable the feature gradually in code.

## Monitoring and Observability

### 1. Monitor CloudWatch Metrics

Watch for issues during migration:

- `UserErrors` - Client-side errors
- `SystemErrors` - Server-side errors
- `ConsumedReadCapacityUnits` - Read throughput
- `ConsumedWriteCapacityUnits` - Write throughput
- `ThrottledRequests` - Rate limiting

### 2. Set Up Alerts

Create CloudWatch alarms for migration issues:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name migration-throttling \
  --metric-name ThrottledRequests \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

### 3. Log to CloudWatch

Send migration logs to CloudWatch:

```javascript
const { CloudWatchLogsClient, PutLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');

async function up(context) {
  const logClient = new CloudWatchLogsClient();

  // Log migration start
  await logClient.send(
    new PutLogEventsCommand({
      logGroupName: '/vaidyalink/migrations',
      logStreamName: context.environment,
      logEvents: [
        {
          message: `Migration started: ${description}`,
          timestamp: Date.now(),
        },
      ],
    })
  );

  // Run migration
  // ...
}
```

## Cost Optimization

### 1. Run During Off-Peak Hours

Schedule migrations when traffic is low to:

- Reduce impact on users
- Avoid throttling
- Lower costs (if using provisioned capacity)

### 2. Use On-Demand Billing

For migrations, on-demand billing is usually more cost-effective than provisioned capacity.

### 3. Clean Up After Migration

Remove temporary attributes after they're no longer needed:

```javascript
// Migration 010: Add temporary field
async function up(context) {
  await batchTransformItems(tableName, (item) => ({
    ...item,
    tempField: computeValue(item),
  }));
}

// Migration 015: Remove temporary field (after code is updated)
async function up(context) {
  await batchTransformItems(tableName, (item) => {
    const { tempField, ...rest } = item;
    return rest;
  });
}
```

## Summary Checklist

Before running a migration in production:

- [ ] Migration tested in development
- [ ] Rollback tested and verified
- [ ] Dry run completed successfully
- [ ] Backup created (for major changes)
- [ ] Code changes deployed (if needed)
- [ ] Maintenance window scheduled (if needed)
- [ ] Team notified
- [ ] Monitoring set up
- [ ] Rollback plan documented
- [ ] Post-migration validation planned

## Related Documentation

- [Migration Guide](./MIGRATION_GUIDE.md)
- [Rollback Guide](./ROLLBACK_GUIDE.md)
- [DynamoDB Tables Reference](../../../infrastructure/docs/DYNAMODB_TABLES.md)
