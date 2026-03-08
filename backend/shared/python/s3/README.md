# S3 Pre-signed URL Generation

Secure utilities for generating time-limited pre-signed URLs for uploading and downloading files from S3.

## Features

- **Secure Upload URLs**: Generate pre-signed POST URLs with content-type validation and file size limits
- **Secure Download URLs**: Generate pre-signed GET URLs with custom response headers
- **Multipart Upload Support**: Handle large files with multipart upload pre-signed URLs
- **KMS Encryption**: Automatic integration with AWS KMS for server-side encryption
- **Custom Metadata**: Attach custom metadata to uploaded objects
- **Content-Type Validation**: Restrict uploads to allowed medical document types
- **File Size Limits**: Enforce maximum file size constraints

## Installation

```bash
pip install boto3
```

## Quick Start

### Basic Upload URL Generation

```python
from s3.presigned_urls import S3PresignedURLGenerator

# Initialize generator
generator = S3PresignedURLGenerator(
    bucket_name='vaidyalink-documents-prod',
    region='ap-south-1',
    kms_key_id='arn:aws:kms:ap-south-1:123456789012:key/...'
)

# Generate upload URL
upload_url = generator.generate_upload_url(
    key='raw/patient-123/scan-456.jpg',
    content_type='image/jpeg',
    max_file_size=10 * 1024 * 1024,  # 10 MB
    metadata={
        'patient-id': 'patient-123',
        'scan-type': 'prescription'
    }
)

print(f"Upload URL: {upload_url['url']}")
print(f"Expires at: {upload_url['expires_at']}")
```

### Basic Download URL Generation

```python
# Generate download URL
download_url = generator.generate_download_url(
    key='raw/patient-123/scan-456.jpg',
    expiration=300,  # 5 minutes
    response_content_disposition='attachment; filename="prescription.jpg"'
)

print(f"Download URL: {download_url['url']}")
```

### Multipart Upload (Large Files)

```python
# Initiate multipart upload
multipart = generator.generate_multipart_upload_urls(
    key='raw/patient-123/large-scan.tiff',
    content_type='image/tiff',
    num_parts=5,
    metadata={'patient-id': 'patient-123'}
)

print(f"Upload ID: {multipart['upload_id']}")
for part in multipart['part_urls']:
    print(f"Part {part['part_number']}: {part['url']}")

# After uploading all parts, complete the upload
result = generator.complete_multipart_upload(
    key='raw/patient-123/large-scan.tiff',
    upload_id=multipart['upload_id'],
    parts=[
        {'PartNumber': 1, 'ETag': 'etag1'},
        {'PartNumber': 2, 'ETag': 'etag2'},
        # ... more parts
    ]
)
```

## Configuration

### Environment Variables

- `AWS_REGION`: AWS region (default: `ap-south-1`)
- `S3_KMS_KEY_ID`: KMS key ID for server-side encryption (optional)

### Allowed Content Types

The following content types are allowed by default:

- `image/jpeg`, `image/jpg`, `image/png`, `image/tiff`
- `application/pdf`
- `audio/wav`, `audio/mpeg`, `audio/mp3`, `audio/webm`

To allow additional content types, set `validate_content_type=False` when generating upload URLs.

### Default Settings

- **Upload URL Expiration**: 15 minutes (900 seconds)
- **Download URL Expiration**: 5 minutes (300 seconds)
- **Maximum File Size**: 100 MB (104,857,600 bytes)

## API Reference

### S3PresignedURLGenerator

#### `__init__(bucket_name, region=None, kms_key_id=None)`

Initialize the pre-signed URL generator.

**Parameters:**

- `bucket_name` (str): Name of the S3 bucket
- `region` (str, optional): AWS region
- `kms_key_id` (str, optional): KMS key ID for encryption

#### `generate_upload_url(key, content_type, expiration=900, max_file_size=None, metadata=None, validate_content_type=True)`

Generate a pre-signed URL for uploading a file.

**Parameters:**

- `key` (str): S3 object key (path within bucket)
- `content_type` (str): MIME type of the file
- `expiration` (int): URL expiration in seconds (default: 900)
- `max_file_size` (int): Maximum file size in bytes (default: 100 MB)
- `metadata` (dict): Custom metadata to attach
- `validate_content_type` (bool): Validate content type (default: True)

**Returns:**

```python
{
    'url': 'https://bucket.s3.amazonaws.com/',
    'fields': {...},  # Form fields for POST request
    'key': 'raw/patient-123/scan.jpg',
    'expires_at': '2024-01-15T10:30:00Z',
    'max_file_size': 10485760
}
```

#### `generate_download_url(key, expiration=300, response_content_type=None, response_content_disposition=None)`

Generate a pre-signed URL for downloading a file.

**Parameters:**

- `key` (str): S3 object key
- `expiration` (int): URL expiration in seconds (default: 300)
- `response_content_type` (str): Override Content-Type header
- `response_content_disposition` (str): Set Content-Disposition header

**Returns:**

```python
{
    'url': 'https://bucket.s3.amazonaws.com/file.jpg?signature=...',
    'key': 'raw/patient-123/scan.jpg',
    'expires_at': '2024-01-15T10:30:00Z'
}
```

#### `generate_multipart_upload_urls(key, content_type, num_parts, expiration=900, metadata=None)`

Generate pre-signed URLs for multipart upload.

**Parameters:**

- `key` (str): S3 object key
- `content_type` (str): MIME type of the file
- `num_parts` (int): Number of parts
- `expiration` (int): URL expiration in seconds (default: 900)
- `metadata` (dict): Custom metadata

**Returns:**

```python
{
    'upload_id': 'multipart-upload-id',
    'part_urls': [
        {'part_number': 1, 'url': 'https://...'},
        {'part_number': 2, 'url': 'https://...'}
    ],
    'key': 'raw/patient-123/large-file.tiff',
    'expires_at': '2024-01-15T10:30:00Z'
}
```

## Lambda Integration

See `examples/lambda_handler_example.py` for complete Lambda function examples.

### Environment Variables for Lambda

```bash
DOCUMENTS_BUCKET_NAME=vaidyalink-documents-prod-123456789012
AWS_REGION=ap-south-1
S3_KMS_KEY_ID=arn:aws:kms:ap-south-1:123456789012:key/...
```

### IAM Permissions

Lambda functions need the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::vaidyalink-documents-*/*"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
      "Resource": "arn:aws:kms:ap-south-1:123456789012:key/*"
    }
  ]
}
```

## Security Best Practices

1. **Always use HTTPS**: Pre-signed URLs enforce SSL/TLS by default
2. **Short expiration times**: Use 15 minutes for uploads, 5 minutes for downloads
3. **Content-type validation**: Restrict uploads to expected file types
4. **File size limits**: Prevent abuse with reasonable size constraints
5. **KMS encryption**: Always encrypt sensitive medical documents
6. **Metadata tracking**: Include patient ID and scan type for audit trails

## Testing

Run unit tests:

```bash
pytest test_presigned_urls.py -v
```

## Use Cases

### Document Scanning

```python
# Patient uploads scanned prescription
upload_url = generator.generate_upload_url(
    key=f'raw/{patient_id}/{timestamp}/prescription.jpg',
    content_type='image/jpeg',
    max_file_size=10 * 1024 * 1024,
    metadata={
        'patient-id': patient_id,
        'scan-type': 'prescription',
        'uploaded-by': 'patient'
    }
)
```

### Voice Recording

```python
# Patient uploads voice recording
upload_url = generator.generate_upload_url(
    key=f'audio/{patient_id}/{timestamp}/history.wav',
    content_type='audio/wav',
    max_file_size=50 * 1024 * 1024,
    metadata={
        'patient-id': patient_id,
        'language': 'hi',
        'recording-type': 'medical-history'
    }
)
```

### Document Download

```python
# User downloads their health record
download_url = generator.generate_download_url(
    key=f'processed/{patient_id}/report.pdf',
    response_content_disposition='attachment; filename="health-report.pdf"'
)
```

## Troubleshooting

### "Content type not allowed" Error

Ensure the content type is in the allowed list or set `validate_content_type=False`:

```python
upload_url = generator.generate_upload_url(
    key='file.txt',
    content_type='text/plain',
    validate_content_type=False  # Skip validation
)
```

### "Access Denied" Error

Verify that:

1. Lambda has correct IAM permissions for S3 and KMS
2. S3 bucket policy allows the operation
3. KMS key policy grants access to the Lambda role

### Expired URL

Pre-signed URLs expire after the specified time. Generate a new URL if needed.

## Related Documentation

- [AWS S3 Pre-signed URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [AWS KMS Encryption](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html)
- [VaidyaLink Storage Architecture](../../../../infrastructure/docs/STORAGE_ARCHITECTURE.md)
