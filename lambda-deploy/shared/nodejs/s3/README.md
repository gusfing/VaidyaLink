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
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/s3-presigned-post
```

## Quick Start

### Basic Upload URL Generation

```javascript
const { S3PresignedURLGenerator } = require('./presigned-urls');

// Initialize generator
const generator = new S3PresignedURLGenerator({
  bucketName: 'vaidyalink-documents-prod',
  region: 'ap-south-1',
  kmsKeyId: 'arn:aws:kms:ap-south-1:123456789012:key/...',
});

// Generate upload URL
const uploadUrl = await generator.generateUploadUrl({
  key: 'raw/patient-123/scan-456.jpg',
  contentType: 'image/jpeg',
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  metadata: {
    'patient-id': 'patient-123',
    'scan-type': 'prescription',
  },
});

console.log(`Upload URL: ${uploadUrl.url}`);
console.log(`Expires at: ${uploadUrl.expires_at}`);
```

### Basic Download URL Generation

```javascript
// Generate download URL
const downloadUrl = await generator.generateDownloadUrl({
  key: 'raw/patient-123/scan-456.jpg',
  expiration: 300, // 5 minutes
  responseContentDisposition: 'attachment; filename="prescription.jpg"',
});

console.log(`Download URL: ${downloadUrl.url}`);
```

### Multipart Upload (Large Files)

```javascript
// Initiate multipart upload
const multipart = await generator.generateMultipartUploadUrls({
  key: 'raw/patient-123/large-scan.tiff',
  contentType: 'image/tiff',
  numParts: 5,
  metadata: { 'patient-id': 'patient-123' },
});

console.log(`Upload ID: ${multipart.upload_id}`);
multipart.part_urls.forEach((part) => {
  console.log(`Part ${part.part_number}: ${part.url}`);
});

// After uploading all parts, complete the upload
const result = await generator.completeMultipartUpload({
  key: 'raw/patient-123/large-scan.tiff',
  uploadId: multipart.upload_id,
  parts: [
    { PartNumber: 1, ETag: 'etag1' },
    { PartNumber: 2, ETag: 'etag2' },
    // ... more parts
  ],
});
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

To allow additional content types, set `validateContentType: false` when generating upload URLs.

### Default Settings

- **Upload URL Expiration**: 15 minutes (900 seconds)
- **Download URL Expiration**: 5 minutes (300 seconds)
- **Maximum File Size**: 100 MB (104,857,600 bytes)

## API Reference

### S3PresignedURLGenerator

#### `constructor({ bucketName, region, kmsKeyId })`

Initialize the pre-signed URL generator.

**Parameters:**

- `bucketName` (string): Name of the S3 bucket
- `region` (string, optional): AWS region
- `kmsKeyId` (string, optional): KMS key ID for encryption

#### `generateUploadUrl({ key, contentType, expiration, maxFileSize, metadata, validateContentType })`

Generate a pre-signed URL for uploading a file.

**Parameters:**

- `key` (string): S3 object key (path within bucket)
- `contentType` (string): MIME type of the file
- `expiration` (number): URL expiration in seconds (default: 900)
- `maxFileSize` (number): Maximum file size in bytes (default: 100 MB)
- `metadata` (object): Custom metadata to attach
- `validateContentType` (boolean): Validate content type (default: true)

**Returns:**

```javascript
{
  url: 'https://bucket.s3.amazonaws.com/',
  fields: {...},  // Form fields for POST request
  key: 'raw/patient-123/scan.jpg',
  expires_at: '2024-01-15T10:30:00.000Z',
  max_file_size: 10485760
}
```

#### `generateDownloadUrl({ key, expiration, responseContentType, responseContentDisposition })`

Generate a pre-signed URL for downloading a file.

**Parameters:**

- `key` (string): S3 object key
- `expiration` (number): URL expiration in seconds (default: 300)
- `responseContentType` (string): Override Content-Type header
- `responseContentDisposition` (string): Set Content-Disposition header

**Returns:**

```javascript
{
  url: 'https://bucket.s3.amazonaws.com/file.jpg?signature=...',
  key: 'raw/patient-123/scan.jpg',
  expires_at: '2024-01-15T10:30:00.000Z'
}
```

#### `generateMultipartUploadUrls({ key, contentType, numParts, expiration, metadata })`

Generate pre-signed URLs for multipart upload.

**Parameters:**

- `key` (string): S3 object key
- `contentType` (string): MIME type of the file
- `numParts` (number): Number of parts
- `expiration` (number): URL expiration in seconds (default: 900)
- `metadata` (object): Custom metadata

**Returns:**

```javascript
{
  upload_id: 'multipart-upload-id',
  part_urls: [
    { part_number: 1, url: 'https://...' },
    { part_number: 2, url: 'https://...' }
  ],
  key: 'raw/patient-123/large-file.tiff',
  expires_at: '2024-01-15T10:30:00.000Z'
}
```

## Lambda Integration

See `examples/lambda-handler-example.js` for complete Lambda function examples.

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
npm test
```

## Use Cases

### Document Scanning

```javascript
// Patient uploads scanned prescription
const uploadUrl = await generator.generateUploadUrl({
  key: `raw/${patientId}/${timestamp}/prescription.jpg`,
  contentType: 'image/jpeg',
  maxFileSize: 10 * 1024 * 1024,
  metadata: {
    'patient-id': patientId,
    'scan-type': 'prescription',
    'uploaded-by': 'patient',
  },
});
```

### Voice Recording

```javascript
// Patient uploads voice recording
const uploadUrl = await generator.generateUploadUrl({
  key: `audio/${patientId}/${timestamp}/history.wav`,
  contentType: 'audio/wav',
  maxFileSize: 50 * 1024 * 1024,
  metadata: {
    'patient-id': patientId,
    language: 'hi',
    'recording-type': 'medical-history',
  },
});
```

### Document Download

```javascript
// User downloads their health record
const downloadUrl = await generator.generateDownloadUrl({
  key: `processed/${patientId}/report.pdf`,
  responseContentDisposition: 'attachment; filename="health-report.pdf"',
});
```

## Client-Side Upload Example

### Using Fetch API

```javascript
// Get pre-signed URL from your API
const response = await fetch('/api/v1/scans/upload-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    file_name: 'scan.jpg',
    content_type: 'image/jpeg',
    patient_id: 'patient-123',
  }),
});

const { url, fields } = await response.json();

// Upload file using pre-signed POST
const formData = new FormData();
Object.entries(fields).forEach(([key, value]) => {
  formData.append(key, value);
});
formData.append('file', fileBlob);

await fetch(url, {
  method: 'POST',
  body: formData,
});
```

## Troubleshooting

### "Content type not allowed" Error

Ensure the content type is in the allowed list or set `validateContentType: false`:

```javascript
const uploadUrl = await generator.generateUploadUrl({
  key: 'file.txt',
  contentType: 'text/plain',
  validateContentType: false, // Skip validation
});
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
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [VaidyaLink Storage Architecture](../../../../infrastructure/docs/STORAGE_ARCHITECTURE.md)
