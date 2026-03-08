# S3 Intelligent-Tiering Quick Start

## What is S3 Intelligent-Tiering?

S3 Intelligent-Tiering is an AWS S3 storage class that automatically moves objects between access tiers based on changing access patterns, optimizing storage costs without performance impact or operational overhead.

## Quick Setup

### 1. Verify Configuration

Check that Intelligent-Tiering is enabled in your environment config:

```bash
# For dev environment
cat infrastructure/config/dev.json | grep enableIntelligentTiering
```

Expected output:

```json
"enableIntelligentTiering": true
```

### 2. Deploy Infrastructure

```bash
cd infrastructure
npm run build
cdk deploy --context env=dev
```

### 3. Verify Deployment

After deployment, verify the lifecycle rule is applied:

```bash
aws s3api get-bucket-lifecycle-configuration \
  --bucket vaidyalink-documents-dev-<account-id>
```

Expected output:

```json
{
  "Rules": [
    {
      "ID": "IntelligentTieringRule",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 0,
          "StorageClass": "INTELLIGENT_TIERING"
        }
      ]
    }
  ]
}
```

## How It Works

1. **Upload**: Objects are uploaded to S3 Standard storage class
2. **Immediate Transition**: Objects are immediately moved to Intelligent-Tiering (0 days)
3. **Automatic Optimization**: S3 monitors access patterns and moves objects between tiers:
   - Frequent Access (default)
   - Infrequent Access (after 30 days of no access)
   - Archive Instant Access (after 90 days of no access)

## Cost Savings

### Example Scenario

For a medical practice processing 1000 scans per month:

- **Month 1**: All objects in Frequent Access tier
- **Month 2**: 70% of objects moved to Infrequent Access tier
- **Month 3**: 50% of objects moved to Archive Instant Access tier

**Estimated savings**: 40-60% reduction in storage costs after 3 months

### Pricing

- **Frequent Access**: $0.023 per GB/month
- **Infrequent Access**: $0.0125 per GB/month (46% savings)
- **Archive Instant Access**: $0.004 per GB/month (83% savings)
- **Monitoring fee**: $0.0025 per 1,000 objects

## Monitoring

### View Storage Class Distribution

```bash
aws s3api list-objects-v2 \
  --bucket vaidyalink-documents-dev-<account-id> \
  --query 'Contents[].{Key:Key,StorageClass:StorageClass}' \
  --output table
```

### CloudWatch Metrics

Monitor these metrics in CloudWatch:

1. **BucketSizeBytes** - Total storage by storage class
2. **NumberOfObjects** - Object count by storage class

## Troubleshooting

### Objects Not Transitioning

**Issue**: Objects remain in Standard storage class

**Solution**:

- Verify lifecycle rule is applied: `aws s3api get-bucket-lifecycle-configuration`
- Check object age: Transitions happen after the specified days
- Ensure objects are larger than 128 KB (Intelligent-Tiering minimum)

### Unexpected Costs

**Issue**: Storage costs higher than expected

**Solution**:

- Check monitoring fees: $0.0025 per 1,000 objects
- Review object sizes: Objects < 128 KB are not eligible
- Verify access patterns: Frequently accessed objects stay in Frequent Access tier

## Best Practices

1. **Use for all medical documents**: Enable Intelligent-Tiering for all buckets storing medical records
2. **Monitor access patterns**: Review CloudWatch metrics monthly
3. **Set up cost alerts**: Configure billing alerts for unexpected cost increases
4. **Keep enabled in production**: Intelligent-Tiering provides automatic optimization

## Disabling (Not Recommended)

To disable Intelligent-Tiering:

1. Edit `infrastructure/config/<env>.json`:

   ```json
   "enableIntelligentTiering": false
   ```

2. Deploy changes:
   ```bash
   cdk deploy --context env=<env>
   ```

**Note**: Existing objects will remain in Intelligent-Tiering until manually moved.

## Support

For issues or questions:

- Review full documentation: `infrastructure/docs/S3_INTELLIGENT_TIERING.md`
- Check AWS documentation: https://aws.amazon.com/s3/storage-classes/intelligent-tiering/
- Contact DevOps team
