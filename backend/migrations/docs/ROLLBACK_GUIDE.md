# Rollback Guide

This guide covers rollback procedures for DynamoDB migrations in VaidyaLink.

## Table of Contents

1. [When to Rollback](#when-to-rollback)
2. [Rollback Methods](#rollback-methods)
3. [Emergency Procedures](#emergency-procedures)
4. [Recovery Strategies](#recovery-strategies)
5. [Post-Rollback Actions](#post-rollback-actions)

## When to Rollback

### Indicators for Rollback

Roll back a migration if you observe:

1. **Data Corruption**
   - Items have incorrect or missing data
   - Data integrity constraints violated
   - Relationships between items broken

2. **Application Errors**
   - Increased error rates in CloudWatch
   - Application crashes or failures
   - API endpoints returning errors

3. **Performance Degradation**
   - Slow query response times
   - Increased latency
   - Throttling errors

4. **Migration Failures**
   - Migration script errors
   - Partial completion
   - Timeout errors

### When NOT to Rollback

Don't rollback if:

1. **Minor Issues**: Small number of items affected that can be fixed manually
2. **Expected Behavior**: Issues are expected and documented
3. **Already Fixed**: Problem resolved by subsequent migration
4. **Point of No Return**: Migration has made irreversible changes (rare, but possible)

## Rollback Methods

### Method 1: Automatic Rollback (Preferred)

Use the migration framework's built-in rollback:

```bash
# Rollback last migration
npm run migrate:down

# Rollback to specific version
npm run migrate:down -- --to=003
```

**Advantages**:

- Uses tested `down()` function
- Tracks rollback in migrations table
- Maintains audit trail

**Disadvantages**:

- Requires working `down()` function
- May be slow for large datasets

### Method 2: Point-in-Time Recovery

Restore table to a previous point in time:

```bash
aws dynamodb restore-table-to-point-in-time \
  --source-table-name vaidyalink-scanjobs-prod \
  --target-table-name vaidyalink-scanjobs-prod-restored \
  --restore-date-time 2024-01-15T10:00:00Z
```

**Advantages**:

- Fast recovery
- Guaranteed data consistency
- No code required

**Disadvantages**:

- Loses all changes since restore point
- Requires table swap
- May affect other recent changes

### Method 3: Backup Restoration

Restore from a manual backup:

```bash
# List available backups
aws dynamodb list-backups \
  --table-name vaidyalink-scanjobs-prod

# Restore from backup
aws dynamodb restore-table-from-backup \
  --target-table-name vaidyalink-scanjobs-prod-restored \
  --backup-arn arn:aws:dynamodb:region:account:table/table-name/backup/backup-name
```

**Advantages**:

- Restore to known good state
- Predictable outcome

**Disadvantages**:

- Only as recent as last backup
- Requires table swap
- May lose recent data

### Method 4: Manual Correction

Fix issues with a corrective migration:

```javascript
// 011_fix_migration_010.js
async function up(context) {
  const { environment, log } = context;

  log('Fixing issues from migration 010...');

  // Identify affected items
  const affectedItems = await scanAndFilter(
    `vaidyalink-scanjobs-${environment}`,
    (item) => item.brokenAttribute !== undefined
  );

  log(`Found ${affectedItems.length} items to fix`);

  // Apply fix
  await batchTransformItems(tableName, (item) => {
    // Correct the issue
    return fixItem(item);
  });
}
```

**Advantages**:

- Surgical fix for specific issues
- Preserves other recent changes
- Can be tested thoroughly

**Disadvantages**:

- Requires writing new code
- Takes time to develop and test
- May not fix all issues

## Emergency Procedures

### Immediate Actions

When a migration causes critical issues:

1. **Stop the Migration** (if still running)

   ```bash
   # Find the process
   ps aux | grep migrate

   # Kill it
   kill -9 <process-id>
   ```

2. **Assess the Damage**

   ```bash
   # Check migration status
   npm run migrate:status

   # Check table status
   aws dynamodb describe-table --table-name vaidyalink-scanjobs-prod

   # Sample data
   aws dynamodb scan --table-name vaidyalink-scanjobs-prod --limit 10
   ```

3. **Notify the Team**
   - Alert on-call engineer
   - Notify team lead
   - Update status page (if customer-facing)

4. **Enable Maintenance Mode** (if possible)
   - Prevent new writes
   - Show maintenance page to users

### Rollback Decision Tree

```
Is the migration still running?
├─ Yes → Stop it immediately
└─ No → Continue

Is data corrupted?
├─ Yes → How severe?
│   ├─ Critical → Restore from backup/PITR
│   └─ Minor → Manual correction
└─ No → Continue

Are applications failing?
├─ Yes → Can you rollback code?
│   ├─ Yes → Rollback code first, then data
│   └─ No → Restore from backup/PITR
└─ No → Continue

Is performance degraded?
├─ Yes → Is it temporary?
│   ├─ Yes → Wait and monitor
│   └─ No → Rollback migration
└─ No → Monitor and investigate
```

### Emergency Rollback Procedure

**Step 1: Attempt Automatic Rollback**

```bash
# Dry run first to check if it will work
ENVIRONMENT=prod npm run migrate:down -- --dry-run

# If dry run succeeds, run actual rollback
ENVIRONMENT=prod npm run migrate:down
```

**Step 2: If Automatic Rollback Fails**

Use point-in-time recovery:

```bash
# 1. Identify restore point (before migration)
RESTORE_TIME="2024-01-15T09:55:00Z"  # 5 minutes before migration

# 2. Restore to new table
aws dynamodb restore-table-to-point-in-time \
  --source-table-name vaidyalink-scanjobs-prod \
  --target-table-name vaidyalink-scanjobs-prod-restored \
  --restore-date-time $RESTORE_TIME

# 3. Wait for table to become active
aws dynamodb wait table-exists \
  --table-name vaidyalink-scanjobs-prod-restored

# 4. Verify restored data
aws dynamodb scan \
  --table-name vaidyalink-scanjobs-prod-restored \
  --limit 10

# 5. Swap tables (requires application downtime)
# a. Stop application
# b. Rename original table
aws dynamodb update-table \
  --table-name vaidyalink-scanjobs-prod \
  --table-name vaidyalink-scanjobs-prod-old

# c. Rename restored table
aws dynamodb update-table \
  --table-name vaidyalink-scanjobs-prod-restored \
  --table-name vaidyalink-scanjobs-prod

# d. Start application
```

**Step 3: If PITR Fails**

Restore from backup:

```bash
# 1. Find most recent backup before migration
aws dynamodb list-backups \
  --table-name vaidyalink-scanjobs-prod \
  --time-range-lower-bound 2024-01-14T00:00:00Z \
  --time-range-upper-bound 2024-01-15T09:00:00Z

# 2. Restore from backup
aws dynamodb restore-table-from-backup \
  --target-table-name vaidyalink-scanjobs-prod-restored \
  --backup-arn <backup-arn>

# 3. Follow steps 3-5 from PITR procedure above
```

## Recovery Strategies

### Strategy 1: Partial Rollback

If only some items are affected:

```javascript
// Create a fix-up migration
async function up(context) {
  const { environment, log } = context;

  // Identify affected items
  const affectedItems = await scanAndFilter(`vaidyalink-scanjobs-${environment}`, (item) =>
    isAffected(item)
  );

  log(`Found ${affectedItems.length} affected items`);

  // Restore original values
  await batchTransformItems(tableName, (item) => {
    if (isAffected(item)) {
      return restoreOriginalValues(item);
    }
    return item;
  });
}
```

### Strategy 2: Gradual Rollback

For large tables, rollback in batches:

```javascript
async function down(context) {
  const { environment, log } = context;

  const tableName = `vaidyalink-scanjobs-${environment}`;

  // Process in smaller batches
  let processedCount = 0;
  let lastEvaluatedKey = null;

  do {
    const result = await batchTransformItems(tableName, rollbackTransform, {
      batchSize: 10,
      delayMs: 500,
      lastEvaluatedKey,
    });

    processedCount += result.processedCount;
    lastEvaluatedKey = result.lastEvaluatedKey;

    log(`Rolled back ${processedCount} items so far...`);
  } while (lastEvaluatedKey);
}
```

### Strategy 3: Hybrid Approach

Combine automatic rollback with manual fixes:

```bash
# 1. Rollback migration
npm run migrate:down

# 2. Identify remaining issues
aws dynamodb scan --table-name vaidyalink-scanjobs-prod \
  --filter-expression "attribute_exists(brokenAttribute)"

# 3. Create and run fix-up migration
npm run migrate:create -- --name=fix_remaining_issues
# Edit the migration file
npm run migrate:up
```

## Post-Rollback Actions

### 1. Verify Data Integrity

```bash
# Check item counts
aws dynamodb describe-table --table-name vaidyalink-scanjobs-prod \
  | jq '.Table.ItemCount'

# Sample data
aws dynamodb scan --table-name vaidyalink-scanjobs-prod --limit 20

# Run validation queries
npm run validate:data
```

### 2. Test Application

```bash
# Run integration tests
npm run test:integration

# Check API endpoints
curl https://api.vaidyalink.com/health

# Monitor error rates
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=vaidyalink-scanjobs-prod \
  --start-time 2024-01-15T10:00:00Z \
  --end-time 2024-01-15T11:00:00Z \
  --period 300 \
  --statistics Sum
```

### 3. Update Migration Status

```bash
# Verify migration status
npm run migrate:status

# Should show the migration as rolled back
```

### 4. Document the Incident

Create an incident report:

```markdown
# Incident Report: Migration 010 Rollback

## Summary

Migration 010 was rolled back due to data corruption.

## Timeline

- 10:00 AM: Migration started
- 10:15 AM: Errors detected in CloudWatch
- 10:20 AM: Migration stopped
- 10:25 AM: Rollback initiated
- 10:40 AM: Rollback completed
- 10:45 AM: Data verified
- 11:00 AM: Application restored

## Root Cause

The migration's transform function had a bug that...

## Impact

- 1,234 items affected
- 15 minutes of downtime
- No data loss

## Resolution

- Rolled back using automatic rollback
- Fixed bug in migration code
- Re-tested in development

## Prevention

- Add more comprehensive tests
- Require code review for migrations
- Test with production-like data volumes
```

### 5. Plan Next Steps

```markdown
## Action Items

1. [ ] Fix the bug in migration code
2. [ ] Add tests to prevent similar issues
3. [ ] Re-test in development
4. [ ] Schedule new migration attempt
5. [ ] Update runbook with lessons learned
```

### 6. Clean Up

```bash
# Remove temporary tables (if any)
aws dynamodb delete-table --table-name vaidyalink-scanjobs-prod-old

# Clean up old backups (if needed)
aws dynamodb delete-backup --backup-arn <backup-arn>
```

## Testing Rollback Procedures

### Regular Rollback Drills

Practice rollback procedures regularly:

```bash
# 1. Apply a test migration in dev
ENVIRONMENT=dev npm run migrate:up

# 2. Verify it worked
ENVIRONMENT=dev npm run migrate:status

# 3. Practice rollback
ENVIRONMENT=dev npm run migrate:down

# 4. Verify rollback worked
ENVIRONMENT=dev npm run migrate:status

# 5. Time the process
# Document how long it takes
```

### Rollback Checklist

Create a checklist for rollback procedures:

```markdown
## Rollback Checklist

### Pre-Rollback

- [ ] Identify the issue
- [ ] Determine severity
- [ ] Notify team
- [ ] Enable maintenance mode (if needed)
- [ ] Document current state

### Rollback

- [ ] Stop migration (if running)
- [ ] Attempt automatic rollback
- [ ] If failed, use PITR or backup
- [ ] Verify rollback completed
- [ ] Check data integrity

### Post-Rollback

- [ ] Test application
- [ ] Monitor metrics
- [ ] Update migration status
- [ ] Disable maintenance mode
- [ ] Notify team
- [ ] Document incident
- [ ] Plan next steps
```

## Related Documentation

- [Migration Guide](./MIGRATION_GUIDE.md)
- [Best Practices](./BEST_PRACTICES.md)
- [DynamoDB Tables Reference](../../../infrastructure/docs/DYNAMODB_TABLES.md)
