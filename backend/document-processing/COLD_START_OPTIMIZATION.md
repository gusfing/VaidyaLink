# Lambda Cold Start Optimization Guide

## Overview

This document describes the cold start optimizations implemented for the Document Processing Lambda to reduce initialization time and improve performance.

## Cold Start Metrics

### Before Optimization

- Cold start time: ~8-12 seconds
- Warm start time: ~200-500ms
- Primary bottlenecks:
  - PaddleOCR model loading (~4-6s)
  - PaddlePaddle framework initialization (~2-3s)
  - Boto3 client initialization (~500ms)
  - Import overhead (~1-2s)

### After Optimization

- Target cold start time: ~3-5 seconds
- Warm start time: ~150-300ms
- Improvements:
  - Lazy initialization of heavy components
  - Optimized imports
  - Lambda layers for dependencies
  - Provisioned concurrency for critical paths

## Optimization Strategies

### 1. Lazy Initialization

Heavy components are initialized only when first needed, not at module import time:

```python
# Global variables for lazy initialization
ocr_extractor: Optional[PaddleOCRExtractor] = None
clinical_structurer: Optional[ClinicalStructurer] = None
confidence_scorer: Optional[ConfidenceScorer] = None

def get_ocr_extractor() -> PaddleOCRExtractor:
    """Lazy initialization of OCR extractor"""
    global ocr_extractor
    if ocr_extractor is None:
        ocr_extractor = create_ocr_extractor(...)
    return ocr_extractor
```

**Benefits:**

- Reduces initial cold start time
- Only loads components when actually needed
- Reuses instances across warm invocations

### 2. Import Optimization

Imports are organized to minimize cold start impact:

```python
# Standard library imports (fast)
import json
import os
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

# AWS SDK imports (moderate)
import boto3
from botocore.exceptions import ClientError

# Heavy imports from local modules (deferred where possible)
from ocr import PaddleOCRExtractor, OCRResult, create_ocr_extractor
from bedrock import ClinicalStructurer, create_clinical_structurer
from confidence import ConfidenceScorer, create_confidence_scorer
```

**Best Practices:**

- Import only what's needed
- Use `from module import specific_function` instead of `import module`
- Defer heavy imports to function scope when possible

### 3. Lambda Layers

Common dependencies are packaged in Lambda layers to reduce deployment package size and improve cold start:

**Layer 1: AWS SDK Layer** (`aws-sdk-layer`)

- boto3
- botocore
- Size: ~50MB

**Layer 2: Image Processing Layer** (`image-processing-layer`)

- Pillow
- opencv-python-headless
- numpy
- Size: ~80MB

**Layer 3: PaddleOCR Layer** (`paddleocr-layer`)

- paddleocr
- paddlepaddle
- Size: ~200MB

**Benefits:**

- Reduces deployment package from ~350MB to ~5MB
- Faster code deployment
- Shared layer caching across Lambda functions
- Easier dependency management

### 4. AWS Client Initialization

AWS clients are initialized at module level for reuse across invocations:

```python
# Initialize AWS clients once at module level
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
sqs_client = boto3.client('sqs')
lambda_client = boto3.client('lambda')
```

**Benefits:**

- Clients are reused in warm invocations
- Connection pooling is maintained
- Reduces per-invocation overhead

### 5. Environment Variable Optimization

Environment variables are read once at module initialization:

```python
# Read environment variables once
SCANJOBS_TABLE = os.environ.get('SCANJOBS_TABLE')
DOCUMENTS_BUCKET = os.environ.get('DOCUMENTS_BUCKET')
HITL_QUEUE_URL = os.environ.get('HITL_QUEUE_URL')
CONFIDENCE_THRESHOLD = float(os.environ.get('CONFIDENCE_THRESHOLD', '0.80'))
```

**Benefits:**

- Avoids repeated environment variable lookups
- Type conversion happens once
- Cleaner code with constants

### 6. Provisioned Concurrency

For production workloads with predictable traffic patterns, configure provisioned concurrency:

```typescript
// In CDK infrastructure code
const documentProcessingLambda = new lambda.Function(this, 'DocumentProcessing', {
  // ... other config
  reservedConcurrentExecutions: 10, // Limit max concurrency
});

// Add provisioned concurrency for production
const version = documentProcessingLambda.currentVersion;
const alias = new lambda.Alias(this, 'ProdAlias', {
  aliasName: 'prod',
  version: version,
  provisionedConcurrentExecutions: 5, // Keep 5 instances warm
});
```

**Configuration:**

- Development: No provisioned concurrency (cost optimization)
- Staging: 2 provisioned instances
- Production: 5-10 provisioned instances (based on traffic)

**Benefits:**

- Eliminates cold starts for provisioned instances
- Predictable performance
- Better user experience

**Cost Considerations:**

- Provisioned concurrency costs ~$0.015 per GB-hour
- For 1GB function with 5 instances: ~$54/month
- Evaluate based on traffic patterns and SLA requirements

### 7. Code Optimization

**Minimize Global Initialization:**

```python
# BAD: Heavy initialization at module level
ocr_extractor = PaddleOCRExtractor()  # Runs on every cold start

# GOOD: Lazy initialization
ocr_extractor: Optional[PaddleOCRExtractor] = None

def get_ocr_extractor():
    global ocr_extractor
    if ocr_extractor is None:
        ocr_extractor = PaddleOCRExtractor()
    return ocr_extractor
```

**Optimize Imports:**

```python
# BAD: Import entire module
import paddleocr
extractor = paddleocr.PaddleOCR()

# GOOD: Import only what's needed
from paddleocr import PaddleOCR
extractor = PaddleOCR()
```

**Use Connection Pooling:**

```python
# AWS SDK clients automatically use connection pooling
# Reuse clients across invocations
s3_client = boto3.client('s3')  # Module level
```

### 8. Lambda Configuration Optimization

**Memory Allocation:**

- Increased from 512MB to 1024MB
- More memory = more CPU = faster initialization
- Cost increase is offset by faster execution

**Timeout:**

- Set to 60 seconds (was 30 seconds)
- Allows for cold start + processing time
- Prevents premature timeouts during initialization

**Environment Variables:**

```bash
# Optimize Python runtime
PYTHONUNBUFFERED=1              # Disable output buffering
PYTHONDONTWRITEBYTECODE=1       # Skip .pyc file creation

# PaddleOCR optimization
USE_GPU=false                   # CPU-only for Lambda
PADDLE_SKIP_SIGNAL_HANDLER=1    # Skip signal handler setup

# Logging optimization
LOG_LEVEL=INFO                  # Reduce debug overhead
```

## Monitoring Cold Starts

### CloudWatch Metrics

Track cold start metrics using custom CloudWatch metrics:

```python
import time

# Track initialization time
init_start_time = time.time()

# ... initialization code ...

init_duration_ms = (time.time() - init_start_time) * 1000

# Emit metric
cloudwatch.put_metric_data(
    Namespace='VaidyaLink/Lambda',
    MetricData=[{
        'MetricName': 'ColdStartDuration',
        'Value': init_duration_ms,
        'Unit': 'Milliseconds',
        'Dimensions': [
            {'Name': 'FunctionName', 'Value': 'DocumentProcessing'},
            {'Name': 'InitType', 'Value': 'cold'}
        ]
    }]
)
```

### X-Ray Tracing

Enable AWS X-Ray to visualize cold start impact:

```python
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all

# Patch AWS SDK calls
patch_all()

@xray_recorder.capture('initialize_ocr')
def get_ocr_extractor():
    # ... initialization code ...
    pass
```

### CloudWatch Insights Queries

Query cold start patterns:

```sql
# Find cold starts
fields @timestamp, @duration, @initDuration
| filter @type = "REPORT"
| filter ispresent(@initDuration)
| stats count() as coldStarts, avg(@initDuration) as avgInitDuration by bin(5m)

# Compare cold vs warm starts
fields @timestamp, @duration, @initDuration
| filter @type = "REPORT"
| stats
    count() as totalInvocations,
    sum(ispresent(@initDuration)) as coldStarts,
    avg(@duration) as avgDuration,
    avg(@initDuration) as avgInitDuration
```

## Best Practices

### 1. Keep Deployment Package Small

- Use Lambda layers for large dependencies
- Exclude unnecessary files (.git, tests, docs)
- Minimize transitive dependencies

### 2. Optimize Initialization Order

- Initialize lightweight components first
- Defer heavy initialization until needed
- Use lazy loading patterns

### 3. Reuse Connections

- Initialize AWS clients at module level
- Use connection pooling
- Maintain database connections across invocations

### 4. Monitor and Iterate

- Track cold start metrics
- Identify bottlenecks with X-Ray
- Continuously optimize based on data

### 5. Consider Provisioned Concurrency

- Use for latency-sensitive workloads
- Balance cost vs performance
- Monitor utilization to right-size

## Testing Cold Starts

### Local Testing

Test cold start behavior locally:

```bash
# Clear Lambda container cache
docker system prune -a

# Run Lambda locally with SAM
sam local invoke DocumentProcessingFunction \
  --event events/s3-event.json \
  --docker-network lambda-local

# Measure initialization time
time sam local invoke DocumentProcessingFunction \
  --event events/s3-event.json
```

### Load Testing

Simulate cold starts with load testing:

```python
import boto3
import time
import concurrent.futures

lambda_client = boto3.client('lambda')

def invoke_lambda():
    start = time.time()
    response = lambda_client.invoke(
        FunctionName='DocumentProcessingFunction',
        InvocationType='RequestResponse',
        Payload=json.dumps({'test': 'cold-start'})
    )
    duration = time.time() - start
    return duration

# Invoke multiple times concurrently to trigger cold starts
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    futures = [executor.submit(invoke_lambda) for _ in range(10)]
    durations = [f.result() for f in futures]

print(f"Average duration: {sum(durations)/len(durations):.2f}s")
print(f"Max duration: {max(durations):.2f}s")
```

## Troubleshooting

### High Cold Start Times

**Symptoms:**

- Cold starts > 10 seconds
- Timeout errors during initialization
- High P99 latency

**Solutions:**

1. Check deployment package size (should be < 50MB without layers)
2. Review import statements for unnecessary dependencies
3. Verify Lambda layers are attached correctly
4. Increase memory allocation (more CPU = faster init)
5. Consider provisioned concurrency

### Inconsistent Performance

**Symptoms:**

- Variable cold start times
- Some invocations fast, others slow
- Unpredictable latency

**Solutions:**

1. Check for external dependencies (API calls during init)
2. Review lazy initialization logic
3. Monitor X-Ray traces for bottlenecks
4. Verify environment variables are set correctly

### Memory Issues

**Symptoms:**

- Out of memory errors
- Lambda killed during initialization
- Incomplete initialization

**Solutions:**

1. Increase memory allocation
2. Review memory usage of dependencies
3. Optimize PaddleOCR model size
4. Use streaming for large files

## Cost Analysis

### Without Optimization

- Cold start: 10s @ 512MB = 5,120 MB-seconds
- Warm execution: 2s @ 512MB = 1,024 MB-seconds
- Cost per cold invocation: $0.000085
- Cost per warm invocation: $0.000017

### With Optimization

- Cold start: 4s @ 1024MB = 4,096 MB-seconds
- Warm execution: 1.5s @ 1024MB = 1,536 MB-seconds
- Cost per cold invocation: $0.000068 (-20%)
- Cost per warm invocation: $0.000026 (+53%)

**Net Impact:**

- Assuming 20% cold starts, 80% warm starts
- Before: $0.000030 per invocation average
- After: $0.000034 per invocation average (+13%)
- **Trade-off:** Slightly higher cost for significantly better performance

### With Provisioned Concurrency (5 instances)

- Monthly cost: ~$54
- Eliminates cold starts for provisioned instances
- Recommended for production with consistent traffic

## References

- [AWS Lambda Cold Start Optimization](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Lambda Layers Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html)
- [Provisioned Concurrency](https://docs.aws.amazon.com/lambda/latest/dg/provisioned-concurrency.html)
- [Lambda Performance Tuning](https://aws.amazon.com/blogs/compute/operating-lambda-performance-optimization-part-1/)
