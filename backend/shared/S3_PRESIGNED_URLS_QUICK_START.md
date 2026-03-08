# S3 Pre-signed URLs - Quick Start Guide

Get started with secure S3 pre-signed URL generation in 5 minutes.

## What are Pre-signed URLs?

Pre-signed URLs allow clients to upload or download files directly to/from S3 without exposing AWS credentials. The URLs are time-limited and include cryptographic signatures that validate the request.

## Benefits

- **Security**: No AWS credentials exposed to clients
- **Direct Upload**: Files go directly to S3, bypassing your API servers
- **Cost Efficient**: Reduces bandwidth costs on your infrastructure
- **Scalable**: S3 handles the load, not your servers
- **Time-Limited**: URLs expire automatically for security

## Installation

### Python

```bash
pip install boto3
```

### Node.js

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/s3-presigned-post
```

## Basic Usage

### Python

```python
from s3.presigned_urls import S3PresignedURLGenerator

# Initialize
generator = S3PresignedURLGenerator(
    bucket_name='my-bucket',
    region='ap-south-1'
)

# Generate upload URL
upload = generator.generate_upload_url(
    key='documents/file.jpg',
    content_type='image/jpeg'
)

# Generate download URL
download = generator.generate_download_url(
    key='documents/file.jpg'
)
```

### Node.js

```javascript
const { S3PresignedURLGenerator } = require('./s3/presigned-urls');

// Initialize
const generator = new S3PresignedURLGenerator({
  bucketName: 'my-bucket',
  region: 'ap-south-1',
});

// Generate upload URL
const upload = await generator.generateUploadUrl({
  key: 'documents/file.jpg',
  contentType: 'image/jpeg',
});

// Generate download URL
const download = await generator.generateDownloadUrl({
  key: 'documents/file.jpg',
});
```

## Lambda Function Example

### Python Lambda

```python
import json
import os
from s3.presigned_urls import S3PresignedURLGenerator

generator = S3PresignedURLGenerator(
    bucket_name=os.environ['BUCKET_NAME']
)

def lambda_handler(event, context):
    body = json.loads(event['body'])

    result = generator.generate_upload_url(
        key=f"uploads/{body['filename']}",
        content_type=body['content_type']
    )

    return {
        'statusCode': 200,
        'body': json.dumps(result)
    }
```

### Node.js Lambda

```javascript
const { S3PresignedURLGenerator } = require('./s3/presigned-urls');

const generator = new S3PresignedURLGenerator({
  bucketName: process.env.BUCKET_NAME,
});

exports.handler = async (event) => {
  const body = JSON.parse(event.body);

  const result = await generator.generateUploadUrl({
    key: `uploads/${body.filename}`,
    contentType: body.content_type,
  });

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
};
```

## Client-Side Upload

### JavaScript (Browser)

```javascript
// 1. Get pre-signed URL from your API
const response = await fetch('/api/upload-url', {
  method: 'POST',
  body: JSON.stringify({
    filename: 'photo.jpg',
    content_type: 'image/jpeg',
  }),
});

const { url, fields } = await response.json();

// 2. Upload file directly to S3
const formData = new FormData();
Object.entries(fields).forEach(([key, value]) => {
  formData.append(key, value);
});
formData.append('file', fileInput.files[0]);

await fetch(url, {
  method: 'POST',
  body: formData,
});
```

### React Example

```jsx
import { useState } from 'react';

function FileUpload() {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file) => {
    setUploading(true);

    try {
      // Get pre-signed URL
      const urlResponse = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type,
        }),
      });

      const { url, fields } = await urlResponse.json();

      // Upload to S3
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append('file', file);

      await fetch(url, {
        method: 'POST',
        body: formData,
      });

      alert('Upload successful!');
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <input type="file" onChange={(e) => handleUpload(e.target.files[0])} disabled={uploading} />
  );
}
```

## Common Use Cases

### Document Upload with Metadata

```python
# Python
upload = generator.generate_upload_url(
    key=f'documents/{patient_id}/{filename}',
    content_type='image/jpeg',
    max_file_size=10 * 1024 * 1024,  # 10 MB
    metadata={
        'patient-id': patient_id,
        'document-type': 'prescription',
        'uploaded-by': user_id
    }
)
```

```javascript
// Node.js
const upload = await generator.generateUploadUrl({
  key: `documents/${patientId}/${filename}`,
  contentType: 'image/jpeg',
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  metadata: {
    'patient-id': patientId,
    'document-type': 'prescription',
    'uploaded-by': userId,
  },
});
```

### Secure Download with Filename

```python
# Python
download = generator.generate_download_url(
    key='documents/report.pdf',
    response_content_disposition='attachment; filename="patient-report.pdf"'
)
```

```javascript
// Node.js
const download = await generator.generateDownloadUrl({
  key: 'documents/report.pdf',
  responseContentDisposition: 'attachment; filename="patient-report.pdf"',
});
```

### Large File Upload (Multipart)

```python
# Python - For files > 100 MB
multipart = generator.generate_multipart_upload_urls(
    key='large-files/scan.tiff',
    content_type='image/tiff',
    num_parts=10  # Split into 10 parts
)

# Client uploads each part, then complete
generator.complete_multipart_upload(
    key='large-files/scan.tiff',
    upload_id=multipart['upload_id'],
    parts=[...]
)
```

## Configuration

### Environment Variables

```bash
# Required
DOCUMENTS_BUCKET_NAME=vaidyalink-documents-prod

# Optional
AWS_REGION=ap-south-1
S3_KMS_KEY_ID=arn:aws:kms:ap-south-1:123456789012:key/...
```

### IAM Permissions

Your Lambda execution role needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::your-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
      "Resource": "arn:aws:kms:*:*:key/*"
    }
  ]
}
```

## Security Features

### Content-Type Validation

Only allowed file types can be uploaded:

```python
# Allowed by default
allowed_types = [
    'image/jpeg', 'image/png', 'image/tiff',
    'application/pdf',
    'audio/wav', 'audio/mpeg'
]

# To allow other types
upload = generator.generate_upload_url(
    key='file.txt',
    content_type='text/plain',
    validate_content_type=False  # Disable validation
)
```

### File Size Limits

```python
# Python
upload = generator.generate_upload_url(
    key='file.jpg',
    content_type='image/jpeg',
    max_file_size=5 * 1024 * 1024  # 5 MB limit
)
```

```javascript
// Node.js
const upload = await generator.generateUploadUrl({
  key: 'file.jpg',
  contentType: 'image/jpeg',
  maxFileSize: 5 * 1024 * 1024, // 5 MB limit
});
```

### KMS Encryption

Automatically encrypts uploads when KMS key is configured:

```python
generator = S3PresignedURLGenerator(
    bucket_name='my-bucket',
    kms_key_id='arn:aws:kms:ap-south-1:123456789012:key/...'
)
```

## Troubleshooting

### Upload Fails with "Access Denied"

**Solution**: Check IAM permissions and S3 bucket policy.

### "Content type not allowed" Error

**Solution**: Either use an allowed content type or disable validation:

```python
validate_content_type=False
```

### URL Expired

**Solution**: Generate a new URL. Default expiration is 15 minutes for uploads, 5 minutes for downloads.

### CORS Error in Browser

**Solution**: Configure CORS on your S3 bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://yourdomain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Next Steps

- Read the full documentation: [Python](python/s3/README.md) | [Node.js](nodejs/s3/README.md)
- See Lambda examples: [Python](python/s3/examples/) | [Node.js](nodejs/s3/examples/)
- Review security best practices
- Implement in your application

## Support

For issues or questions:

- Check the [troubleshooting section](#troubleshooting)
- Review the full README documentation
- Contact the VaidyaLink team
