# DynamoDB Migration Framework

This directory contains the migration framework and scripts for managing DynamoDB schema evolution in VaidyaLink.

## Overview

Unlike traditional SQL databases, DynamoDB is schema-less at the item level. However, we still need migrations for:

- **Global Secondary Index (GSI) changes**: Adding, removing, or modifying indexes
- **Attribute transformations**: Renaming attributes, changing data formats
- **Data backfills**: Populating new attributes across existing items
- **Table structure changes**: Splitting or merging tables
- **Cleanup operations**: Removing deprecated attributes

## Directory Structure

```
backend/migrations/
├── README.md                    # This file
├── framework/                   # Migration framework code
│   ├── migration-manager.js     # Core migration orchestration
│   ├── version-tracker.js       # Version tracking in DynamoDB
│   └── validators.js            # Migration validation utilities
├── scripts/                     # Migration scripts
│   ├── 001_initial_schema.js    # Initial schema baseline
│   ├── 002_add_gsi_example.js   # Example GSI addition
│   └── template.js              # Template for new migrations
├── utils/                       # Utility functions
│   ├── data-transformers.js     # Common data transformation functions
│   ├── backup-restore.js        # Backup and restore utilities
│   └── batch-operations.js      # Efficient batch read/write operations
├── tests/                       # Migration tests
│   ├── migration-manager.test.js
│   └── validators.test.js
└── docs/                        # Documentation
    ├── MIGRATION_GUIDE.md       # How to create and run migrations
    ├── BEST_PRACTICES.md        # DynamoDB migration best practices
    └── ROLLBACK_GUIDE.md        # Rollback procedures
```

## Quick Start

### Running Migrations

```bash
# Run all pending migrations
npm run migrate:up

# Run migrations up to a specific version
npm run migrate:up -- --to=003

# Rollback last migration
npm run migrate:down

# Rollback to a specific version
npm run migrate:down -- --to=002

# Check migration status
npm run migrate:status

# Validate migrations without running
npm run migrate:validate
```

### Creating a New Migration

```bash
# Generate a new migration file
npm run migrate:create -- --name=add_patient_email_index

# This creates: migrations/scripts/XXX_add_patient_email_index.js
```

## Migration Lifecycle

1. **Create**: Write migration script with `up()` and `down()` functions
2. **Validate**: Test migration in development environment
3. **Review**: Code review and approval
4. **Test**: Run in staging environment
5. **Execute**: Apply to production with monitoring
6. **Verify**: Validate data integrity and application functionality

## Version Tracking

Migrations are tracked in a DynamoDB table: `vaidyalink-migrations-{environment}`

Each migration record contains:

- `version`: Migration version number (e.g., "001")
- `name`: Migration name
- `appliedAt`: ISO 8601 timestamp
- `executionTime`: Duration in milliseconds
- `status`: "applied" | "rolled_back" | "failed"
- `checksum`: SHA-256 hash of migration file

## Safety Features

- **Dry-run mode**: Preview changes without applying
- **Automatic backups**: Point-in-time recovery enabled on all tables
- **Checksum validation**: Prevents running modified migrations
- **Rollback support**: Every migration must implement rollback
- **Progress tracking**: Resume interrupted migrations
- **Validation**: Pre-flight checks before execution

## Best Practices

1. **Never modify applied migrations**: Create a new migration instead
2. **Test rollbacks**: Always test the `down()` function
3. **Use batch operations**: Process items in batches to avoid throttling
4. **Monitor CloudWatch**: Watch for throttling and errors
5. **Backup before major changes**: Create on-demand backups
6. **Document breaking changes**: Update API documentation
7. **Coordinate with deployments**: Plan migrations with code deployments

## Common Migration Patterns

### Adding a GSI

```javascript
// up: Add index
await addGlobalSecondaryIndex(tableName, {
  indexName: 'EmailIndex',
  partitionKey: 'email',
  projectionType: 'ALL',
});

// down: Remove index
await removeGlobalSecondaryIndex(tableName, 'EmailIndex');
```

### Backfilling Data

```javascript
// up: Add new attribute to all items
await batchTransformItems(tableName, async (item) => {
  return {
    ...item,
    newAttribute: computeValue(item),
  };
});

// down: Remove attribute
await batchTransformItems(tableName, async (item) => {
  const { newAttribute, ...rest } = item;
  return rest;
});
```

### Renaming Attributes

```javascript
// up: Rename oldName to newName
await batchTransformItems(tableName, async (item) => {
  if (item.oldName) {
    return {
      ...item,
      newName: item.oldName,
      oldName: undefined, // Remove old attribute
    };
  }
  return item;
});
```

## Troubleshooting

### Migration Failed

1. Check CloudWatch logs for error details
2. Verify IAM permissions for DynamoDB operations
3. Check for throttling in CloudWatch metrics
4. Review migration checksum validation

### Rollback Failed

1. Check if rollback is implemented correctly
2. Verify data state before rollback
3. Consider manual intervention if needed
4. Document the issue for future reference

### Performance Issues

1. Reduce batch size in migration config
2. Add delays between batch operations
3. Temporarily increase provisioned capacity (if using provisioned mode)
4. Run during low-traffic periods

## Related Documentation

- [DynamoDB Tables Reference](../../infrastructure/docs/DYNAMODB_TABLES.md)
- [Query Helpers](../shared/nodejs/dynamodb/README.md)
- [Field Encryption](../shared/FIELD_ENCRYPTION_INTEGRATION.md)

## Support

For questions or issues with migrations:

1. Check the [Migration Guide](./docs/MIGRATION_GUIDE.md)
2. Review [Best Practices](./docs/BEST_PRACTICES.md)
3. Consult the team lead or DevOps engineer
