# S3 Intelligent-Tiering Configuration

## Overview

The VaidyaLink S3 buckets are configured with S3 Intelligent-Tiering to automatically optimize storage costs by moving objects between access tiers based on changing access patterns.

## Implementation

### Storage Construct Configuration

The `StorageConstruct` in `infrastructure/lib/constructs/storage.ts` implements S3 Intelligent-Tiering through lifecycle rules:

```typescript
lifecycleRules: enableIntelligentTiering
  ? [
      {
        id: 'IntelligentTieringRule',
        enabled: true,
        transitions: [
          {
            storageClass: s3.StorageClass.INTELLIGENT_TIERING,
            transitionAfter: cdk.Duration.days(0), // Immediate transition
          },
        ],
      },
    ]
  : undefined,
```

### Configuration

The Intelligent-Tiering feature is controlled by the `enableIntelligentTiering` flag in the environment configuration files:

- **dev.json**: `"enableIntelligentTiering": true`
- **staging.json**: `"enableIntelligentTiering": true`
- **prod.json**: `"enableIntelligentTiering": true`

By default, Intelligent-Tiering is enabled for all environments.

## How S3 Intelligent-Tiering Works

S3 Intelligent-Tiering automatically moves objects between four access tiers:

1. **Frequent Access tier**: For objects accessed frequently
2. **Infrequent Access tier**: For objects not accessed for 30 consecutive days
3. **Archive Instant Access tier**: For objects not accessed for 90 consecutive days
4. **Archive Access tier**: For objects not accessed for 90-270 days (optional)
5. **Deep Archive Access tier**: For objects not accessed for 180-730 days (optional)

### Benefits

- **Automatic cost optimization**: No manual intervention required
- **No retrieval fees**: Unlike Glacier, there are no retrieval fees for accessing objects
- **No minimum storage duration**: Objects can be deleted at any time without penalties
- **Monitoring fee**: Small monthly monitoring and automation fee per object

## Cost Optimization

According to Requirement 8.4:

> "WHEN storing images, THE VaidyaLink_System SHALL use S3 Intelligent-Tiering to optimize storage costs"

### Expected Savings

For the VaidyaLink use case:

- **Raw medical documents**: Frequently accessed immediately after upload, then rarely accessed
- **Processed data**: Accessed during initial processing, then infrequently
- **Audio files**: Accessed during transcription, then archived
- **FHIR exports**: Generated on-demand, then rarely accessed

Intelligent-Tiering automatically moves these objects to cheaper storage tiers as access patterns change, potentially saving 40-70% on storage costs compared to Standard storage.

## Bucket Structure

All objects in the following prefixes benefit from Intelligent-Tiering:

```
vaidyalink-documents-{env}-{account}/
├── raw/              # Original medical documents
├── processed/        # Extracted and structured data
├── audio/            # Voice recordings and transcriptions
└── exports/          # FHIR bundles and exports
```

## Monitoring

Monitor Intelligent-Tiering effectiveness through:

1. **S3 Storage Lens**: View storage class distribution
2. **CloudWatch Metrics**: Track storage bytes by storage class
3. **Cost Explorer**: Compare costs before and after Intelligent-Tiering

### Key Metrics

- `StorageBytes` by storage class
- `NumberOfObjects` by storage class
- Monthly storage costs by storage class

## Disabling Intelligent-Tiering

To disable Intelligent-Tiering (not recommended for production):

1. Set `enableIntelligentTiering: false` in the environment config file
2. Deploy the infrastructure: `cdk deploy --context env=<environment>`

## Testing

The implementation includes comprehensive tests in `infrastructure/test/storage.test.ts`:

```bash
# Run storage tests
npm test -- storage.test.ts

# Run specific Intelligent-Tiering tests
npm test -- storage.test.ts -t "Intelligent-Tiering"
```

## References

- [AWS S3 Intelligent-Tiering Documentation](https://aws.amazon.com/s3/storage-classes/intelligent-tiering/)
- [S3 Intelligent-Tiering Pricing](https://aws.amazon.com/s3/pricing/)
- VaidyaLink Requirements Document: Requirement 8.4 (Cost Efficiency)
