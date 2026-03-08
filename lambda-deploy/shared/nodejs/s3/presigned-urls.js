/**
 * S3 Pre-signed URL Generation Utilities
 *
 * This module provides utilities for generating secure, time-limited pre-signed URLs
 * for uploading and downloading files from S3. It supports content-type validation,
 * file size limits, and custom metadata attachment.
 *
 * Security Features:
 * - Time-limited URLs (configurable expiration)
 * - Content-type restrictions for uploads
 * - File size limits enforcement
 * - Integration with KMS encryption
 * - Proper IAM permissions validation
 *
 * @example
 * const { S3PresignedURLGenerator } = require('./presigned-urls');
 *
 * const generator = new S3PresignedURLGenerator({
 *   bucketName: 'my-bucket',
 *   region: 'ap-south-1'
 * });
 *
 * // Generate upload URL
 * const uploadUrl = await generator.generateUploadUrl({
 *   key: 'documents/scan-123.jpg',
 *   contentType: 'image/jpeg',
 *   maxFileSize: 10 * 1024 * 1024  // 10 MB
 * });
 *
 * // Generate download URL
 * const downloadUrl = await generator.generateDownloadUrl({
 *   key: 'documents/scan-123.jpg'
 * });
 */

const {
  S3Client,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');
const { PutObjectCommand, GetObjectCommand, UploadPartCommand } = require('@aws-sdk/client-s3');

/**
 * S3 Pre-signed URL Generator
 *
 * Generates secure pre-signed URLs for S3 operations with built-in security controls.
 */
class S3PresignedURLGenerator {
  // Default expiration times (in seconds)
  static DEFAULT_UPLOAD_EXPIRATION = 900; // 15 minutes
  static DEFAULT_DOWNLOAD_EXPIRATION = 300; // 5 minutes

  // Allowed content types for medical documents
  static ALLOWED_CONTENT_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/tiff',
    'application/pdf',
    'audio/wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/webm',
  ]);

  // Maximum file size (100 MB default)
  static DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024;

  /**
   * Initialize the pre-signed URL generator.
   *
   * @param {Object} config - Configuration object
   * @param {string} config.bucketName - Name of the S3 bucket
   * @param {string} [config.region] - AWS region (defaults to environment variable or ap-south-1)
   * @param {string} [config.kmsKeyId] - KMS key ID for server-side encryption (optional)
   */
  constructor({ bucketName, region, kmsKeyId }) {
    this.bucketName = bucketName;
    this.region = region || process.env.AWS_REGION || 'ap-south-1';
    this.kmsKeyId = kmsKeyId || process.env.S3_KMS_KEY_ID;

    this.s3Client = new S3Client({ region: this.region });
  }

  /**
   * Generate a pre-signed URL for uploading a file to S3.
   *
   * @param {Object} options - Upload options
   * @param {string} options.key - S3 object key (path within bucket)
   * @param {string} options.contentType - MIME type of the file to upload
   * @param {number} [options.expiration] - URL expiration time in seconds (default: 15 minutes)
   * @param {number} [options.maxFileSize] - Maximum allowed file size in bytes (default: 100 MB)
   * @param {Object} [options.metadata] - Custom metadata to attach to the object
   * @param {boolean} [options.validateContentType=true] - Whether to validate content type against allowed list
   * @returns {Promise<Object>} Object containing url, fields, key, expires_at, and max_file_size
   * @throws {Error} If content type is not allowed
   */
  async generateUploadUrl({
    key,
    contentType,
    expiration = S3PresignedURLGenerator.DEFAULT_UPLOAD_EXPIRATION,
    maxFileSize = S3PresignedURLGenerator.DEFAULT_MAX_FILE_SIZE,
    metadata = {},
    validateContentType = true,
  }) {
    // Validate content type
    if (validateContentType && !S3PresignedURLGenerator.ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new Error(
        `Content type '${contentType}' is not allowed. ` +
          `Allowed types: ${Array.from(S3PresignedURLGenerator.ALLOWED_CONTENT_TYPES).join(', ')}`
      );
    }

    // Prepare conditions for the upload
    const conditions = [
      { bucket: this.bucketName },
      { key },
      { 'Content-Type': contentType },
      ['content-length-range', 1, maxFileSize],
    ];

    // Prepare fields
    const fields = {
      'Content-Type': contentType,
    };

    // Add KMS encryption if configured
    if (this.kmsKeyId) {
      fields['x-amz-server-side-encryption'] = 'aws:kms';
      fields['x-amz-server-side-encryption-aws-kms-key-id'] = this.kmsKeyId;
      conditions.push({ 'x-amz-server-side-encryption': 'aws:kms' });
      conditions.push({ 'x-amz-server-side-encryption-aws-kms-key-id': this.kmsKeyId });
    }

    // Add custom metadata
    for (const [metaKey, metaValue] of Object.entries(metadata)) {
      const fieldKey = `x-amz-meta-${metaKey}`;
      fields[fieldKey] = metaValue;
      conditions.push({ [fieldKey]: metaValue });
    }

    // Generate pre-signed POST
    const { url, fields: postFields } = await createPresignedPost(this.s3Client, {
      Bucket: this.bucketName,
      Key: key,
      Conditions: conditions,
      Fields: fields,
      Expires: expiration,
    });

    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expiration * 1000).toISOString();

    return {
      url,
      fields: postFields,
      key,
      expires_at: expiresAt,
      max_file_size: maxFileSize,
    };
  }

  /**
   * Generate a pre-signed URL for downloading a file from S3.
   *
   * @param {Object} options - Download options
   * @param {string} options.key - S3 object key (path within bucket)
   * @param {number} [options.expiration] - URL expiration time in seconds (default: 5 minutes)
   * @param {string} [options.responseContentType] - Override Content-Type header in response
   * @param {string} [options.responseContentDisposition] - Set Content-Disposition header (e.g., for downloads)
   * @returns {Promise<Object>} Object containing url, key, and expires_at
   */
  async generateDownloadUrl({
    key,
    expiration = S3PresignedURLGenerator.DEFAULT_DOWNLOAD_EXPIRATION,
    responseContentType,
    responseContentDisposition,
  }) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ...(responseContentType && { ResponseContentType: responseContentType }),
      ...(responseContentDisposition && { ResponseContentDisposition: responseContentDisposition }),
    });

    // Generate pre-signed URL
    const url = await getSignedUrl(this.s3Client, command, { expiresIn: expiration });

    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expiration * 1000).toISOString();

    return {
      url,
      key,
      expires_at: expiresAt,
    };
  }

  /**
   * Generate pre-signed URLs for multipart upload (for large files).
   *
   * @param {Object} options - Multipart upload options
   * @param {string} options.key - S3 object key (path within bucket)
   * @param {string} options.contentType - MIME type of the file to upload
   * @param {number} options.numParts - Number of parts for the multipart upload
   * @param {number} [options.expiration] - URL expiration time in seconds (default: 15 minutes)
   * @param {Object} [options.metadata] - Custom metadata to attach to the object
   * @returns {Promise<Object>} Object containing upload_id, part_urls, key, and expires_at
   */
  async generateMultipartUploadUrls({
    key,
    contentType,
    numParts,
    expiration = S3PresignedURLGenerator.DEFAULT_UPLOAD_EXPIRATION,
    metadata = {},
  }) {
    // Prepare parameters for multipart upload
    const params = {
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    };

    // Add KMS encryption if configured
    if (this.kmsKeyId) {
      params.ServerSideEncryption = 'aws:kms';
      params.SSEKMSKeyId = this.kmsKeyId;
    }

    // Add custom metadata
    if (Object.keys(metadata).length > 0) {
      params.Metadata = metadata;
    }

    // Initiate multipart upload
    const createCommand = new CreateMultipartUploadCommand(params);
    const response = await this.s3Client.send(createCommand);
    const uploadId = response.UploadId;

    // Generate pre-signed URLs for each part
    const partUrls = [];
    for (let partNumber = 1; partNumber <= numParts; partNumber++) {
      const uploadPartCommand = new UploadPartCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const partUrl = await getSignedUrl(this.s3Client, uploadPartCommand, {
        expiresIn: expiration,
      });

      partUrls.push({
        part_number: partNumber,
        url: partUrl,
      });
    }

    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expiration * 1000).toISOString();

    return {
      upload_id: uploadId,
      part_urls: partUrls,
      key,
      expires_at: expiresAt,
    };
  }

  /**
   * Complete a multipart upload.
   *
   * @param {Object} options - Completion options
   * @param {string} options.key - S3 object key (path within bucket)
   * @param {string} options.uploadId - Multipart upload ID
   * @param {Array} options.parts - List of completed parts with ETag values
   *                                 Format: [{ PartNumber: 1, ETag: 'etag1' }, ...]
   * @returns {Promise<Object>} Object containing location, bucket, key, and etag
   */
  async completeMultipartUpload({ key, uploadId, parts }) {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    const response = await this.s3Client.send(command);

    return {
      location: response.Location,
      bucket: response.Bucket,
      key: response.Key,
      etag: response.ETag,
    };
  }

  /**
   * Abort a multipart upload and clean up parts.
   *
   * @param {Object} options - Abort options
   * @param {string} options.key - S3 object key (path within bucket)
   * @param {string} options.uploadId - Multipart upload ID
   * @returns {Promise<void>}
   */
  async abortMultipartUpload({ key, uploadId }) {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
    });

    await this.s3Client.send(command);
  }
}

module.exports = {
  S3PresignedURLGenerator,
};
