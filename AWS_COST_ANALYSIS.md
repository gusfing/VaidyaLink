# AWS Cost Analysis - $3 in 24 Hours

## Current Status

Your VaidyaLink app is in **DEMO MODE** and should NOT be using AWS resources. However, you're being charged $3/day, which suggests AWS resources are still running.

## Likely Culprits (Most Expensive First)

### 1. **API Gateway** ($3-5/day if active)

- **Location**: `NEXT_PUBLIC_API_URL=https://ptln3qd359.execute-api.ap-south-1.amazonaws.com/prod`
- **Cost**: $3.50 per million requests + $0.09/GB data transfer
- **Issue**: Even if not used by VaidyaLink, might be receiving traffic or health checks

### 2. **Lambda Functions** ($0.20-2/day)

- Document processor
- API handler
- Voice processing
- Clinical summarizer
- **Cost**: $0.20 per 1M requests + compute time

### 3. **DynamoDB** ($0.25-1/day)

- Tables for storing medical records, jobs, etc.
- **Cost**: On-demand pricing or provisioned capacity

### 4. **S3 Buckets** ($0.023/GB/month)

- Document storage
- Lambda deployment packages
- **Cost**: Storage + requests

### 5. **Cognito** ($0.0055 per MAU after 50,000)

- User authentication (though SKIP_AUTH is enabled)

### 6. **CloudWatch Logs** ($0.50/GB)

- Lambda function logs
- API Gateway logs

### 7. **NAT Gateway** ($0.045/hour = $32.40/month) ⚠️ EXPENSIVE!

- If VPC has NAT Gateway for Lambda internet access
- **This could be your $3/day charge!**

## How to Check What's Running

### Option 1: AWS Console (Recommended)

```bash
1. Go to AWS Console: https://console.aws.amazon.com/
2. Region: ap-south-1 (Mumbai)
3. Check these services:

   a) API Gateway:
      - Services → API Gateway
      - Look for: ptln3qd359
      - Check: Stages, Deployments

   b) Lambda:
      - Services → Lambda
      - Look for functions with "vaidyalink" or "document"
      - Check: Invocations (last 24h)

   c) DynamoDB:
      - Services → DynamoDB
      - Check: Tables, Read/Write capacity

   d) VPC:
      - Services → VPC → NAT Gateways
      - ⚠️ DELETE if found - costs $32/month!

   e) S3:
      - Services → S3
      - Check bucket sizes

   f) CloudWatch:
      - Services → CloudWatch → Logs
      - Check log group sizes
```

### Option 2: AWS CLI

```bash
# Install AWS CLI first
# Then run these commands:

# Check API Gateway
aws apigateway get-rest-apis --region ap-south-1

# Check Lambda functions
aws lambda list-functions --region ap-south-1

# Check DynamoDB tables
aws dynamodb list-tables --region ap-south-1

# Check NAT Gateways (EXPENSIVE!)
aws ec2 describe-nat-gateways --region ap-south-1

# Check S3 buckets
aws s3 ls

# Check CloudWatch log groups
aws logs describe-log-groups --region ap-south-1
```

## How to Stop the Charges

### Immediate Actions (Stop Bleeding)

#### 1. Delete NAT Gateway (if exists)

```bash
# Via Console:
VPC → NAT Gateways → Select → Actions → Delete NAT Gateway

# Via CLI:
aws ec2 delete-nat-gateway --nat-gateway-id <nat-id> --region ap-south-1
```

#### 2. Delete API Gateway Stage

```bash
# Via Console:
API Gateway → ptln3qd359 → Stages → prod → Delete Stage

# This stops all API requests
```

#### 3. Disable Lambda Functions

```bash
# Via Console:
Lambda → Select function → Configuration → Environment variables
# Add: DISABLED=true

# Or delete the functions entirely
```

#### 4. Set DynamoDB to On-Demand (if provisioned)

```bash
# Via Console:
DynamoDB → Tables → Select table → Update settings
# Change to "On-demand" capacity mode
```

### Complete Teardown (Nuclear Option)

If you want to delete EVERYTHING:

```bash
cd infrastructure

# Delete the entire stack
cdk destroy DocumentScan-dev --region ap-south-1

# Or if using different stack name:
cdk destroy VaidyaLink-dev --region ap-south-1
```

## What VaidyaLink Actually Needs

Since `NEXT_PUBLIC_DEMO_MODE=true`, VaidyaLink needs:

- ✅ **Vercel** (free tier) - hosting the frontend
- ✅ **Sarvam AI** (your API key) - voice transcription
- ❌ **NO AWS resources** - everything is mocked

## Recommended Action Plan

1. **Check AWS Console** for NAT Gateway (most likely culprit)
2. **Delete NAT Gateway** if found
3. **Check API Gateway** request count
4. **Delete or disable** API Gateway stage if not needed
5. **Monitor costs** for 24 hours
6. **Consider full teardown** if not using AWS at all

## Cost Breakdown Estimate

If you have all resources running:

- NAT Gateway: $1.08/day ($32.40/month)
- API Gateway: $0.50/day (with traffic)
- Lambda: $0.30/day
- DynamoDB: $0.25/day
- S3: $0.10/day
- CloudWatch: $0.20/day
- **Total: ~$2.43/day ≈ $3/day** ✅ Matches your charge!

## Prevention

To avoid future charges:

1. Set up **AWS Budgets** with $5/month alert
2. Enable **Cost Explorer**
3. Use **AWS Free Tier** alerts
4. Delete resources immediately after hackathon

## Need Help?

Run this command to get detailed cost breakdown:

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-03-08,End=2026-03-09 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE \
  --region us-east-1
```

---

**Bottom Line**: You likely have a NAT Gateway running ($32/month) or API Gateway receiving traffic. Check AWS Console and delete unused resources immediately.
