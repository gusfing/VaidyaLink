/**
 * Lambda Handler Examples for S3 Pre-signed URL Generation
 *
 * This module demonstrates how to use the S3PresignedURLGenerator in AWS Lambda functions
 * to provide secure upload and download URLs to clients.
 *
 * API Endpoints:
 * - POST /api/v1/scans/upload-url - Get pre-signed URL for document upload
 * - POST /api/v1/voice/upload-url - Get pre-signed URL for audio upload
 * - GET /api/v1/documents/{key}/download-url - Get pre-signed URL for document download
 */

const { S3PresignedURLGenerator } = require('../presigned-urls');

// Initialize generator (reused across invocations)
const generator = new S3PresignedURLGenerator({
  bucketName: process.env.DOCUMENTS_BUCKET_NAME,
  region: process.env.AWS_REGION || 'ap-south-1',
  kmsKeyId: process.env.S3_KMS_KEY_ID,
});

/**
 * Main Lambda handler that routes requests to appropriate functions.
 *
 * @param {Object} event - API Gateway event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} API Gateway response
 */
exports.handler = async (event, context) => {
  try {
    // Extract route information
    const httpMethod = event.httpMethod;
    const path = event.path || '';

    // Route to appropriate handler
    if (httpMethod === 'POST' && path.includes('/upload-url')) {
      return await handleUploadUrlRequest(event);
    } else if (httpMethod === 'GET' && path.includes('/download-url')) {
      return await handleDownloadUrlRequest(event);
    } else if (httpMethod === 'POST' && path.includes('/multipart-upload-url')) {
      return await handleMultipartUploadRequest(event);
    } else {
      return createResponse(404, { error: 'Not found' });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return createResponse(500, { error: 'Internal server error' });
  }
};

/**
 * Handle request for upload pre-signed URL.
 *
 * Expected request body:
 * {
 *   "file_name": "scan-123.jpg",
 *   "content_type": "image/jpeg",
 *   "patient_id": "patient-123",
 *   "scan_type": "prescription",
 *   "max_file_size": 10485760  // Optional, in bytes
 * }
 *
 * @param {Object} event - API Gateway event
 * @returns {Promise<Object>} API Gateway response with pre-signed URL
 */
async function handleUploadUrlRequest(event) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');

    // Extract parameters
    const { file_name, content_type, patient_id, scan_type = 'document', max_file_size } = body;

    // Validate required parameters
    if (!file_name || !content_type || !patient_id) {
      return createResponse(400, {
        error: 'Missing required parameters: file_name, content_type, patient_id',
      });
    }

    // Generate S3 key with proper structure
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const s3Key = `raw/${patient_id}/${timestamp}/${file_name}`;

    // Prepare metadata
    const metadata = {
      'patient-id': patient_id,
      'scan-type': scan_type,
      'uploaded-at': new Date().toISOString(),
    };

    // Generate pre-signed URL
    const result = await generator.generateUploadUrl({
      key: s3Key,
      contentType: content_type,
      maxFileSize: max_file_size,
      metadata,
    });

    // Return response
    return createResponse(200, {
      upload_url: result.url,
      fields: result.fields,
      s3_key: result.key,
      expires_at: result.expires_at,
      max_file_size: result.max_file_size,
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    if (error.message.includes('not allowed')) {
      return createResponse(400, { error: error.message });
    }
    return createResponse(500, { error: 'Failed to generate upload URL' });
  }
}

/**
 * Handle request for download pre-signed URL.
 *
 * Expected path parameters:
 * - key: S3 object key (URL encoded)
 *
 * Optional query parameters:
 * - download: If 'true', sets Content-Disposition to attachment
 * - expiration: Custom expiration time in seconds
 *
 * @param {Object} event - API Gateway event
 * @returns {Promise<Object>} API Gateway response with pre-signed URL
 */
async function handleDownloadUrlRequest(event) {
  try {
    // Extract S3 key from path parameters
    const pathParams = event.pathParameters || {};
    const s3Key = pathParams.key;

    if (!s3Key) {
      return createResponse(400, { error: 'Missing required parameter: key' });
    }

    // Extract query parameters
    const queryParams = event.queryStringParameters || {};
    const download = queryParams.download === 'true';
    const expiration = parseInt(queryParams.expiration || '300', 10);

    // Prepare response headers
    let responseContentDisposition;
    if (download) {
      // Extract filename from key
      const fileName = s3Key.split('/').pop();
      responseContentDisposition = `attachment; filename="${fileName}"`;
    }

    // Generate pre-signed URL
    const result = await generator.generateDownloadUrl({
      key: s3Key,
      expiration,
      responseContentDisposition,
    });

    // Return response
    return createResponse(200, {
      download_url: result.url,
      s3_key: result.key,
      expires_at: result.expires_at,
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    return createResponse(500, { error: 'Failed to generate download URL' });
  }
}

/**
 * Handle request for multipart upload pre-signed URLs (for large files).
 *
 * Expected request body:
 * {
 *   "file_name": "large-scan.tiff",
 *   "content_type": "image/tiff",
 *   "patient_id": "patient-123",
 *   "num_parts": 5,
 *   "scan_type": "xray"
 * }
 *
 * @param {Object} event - API Gateway event
 * @returns {Promise<Object>} API Gateway response with multipart upload URLs
 */
async function handleMultipartUploadRequest(event) {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');

    // Extract parameters
    const { file_name, content_type, patient_id, num_parts, scan_type = 'document' } = body;

    // Validate required parameters
    if (!file_name || !content_type || !patient_id || !num_parts) {
      return createResponse(400, {
        error: 'Missing required parameters: file_name, content_type, patient_id, num_parts',
      });
    }

    // Generate S3 key
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const s3Key = `raw/${patient_id}/${timestamp}/${file_name}`;

    // Prepare metadata
    const metadata = {
      'patient-id': patient_id,
      'scan-type': scan_type,
      'uploaded-at': new Date().toISOString(),
    };

    // Generate multipart upload URLs
    const result = await generator.generateMultipartUploadUrls({
      key: s3Key,
      contentType: content_type,
      numParts: num_parts,
      metadata,
    });

    // Return response
    return createResponse(200, {
      upload_id: result.upload_id,
      part_urls: result.part_urls,
      s3_key: result.key,
      expires_at: result.expires_at,
    });
  } catch (error) {
    console.error('Error generating multipart upload URLs:', error);
    return createResponse(500, { error: 'Failed to generate multipart upload URLs' });
  }
}

/**
 * Handle request to complete multipart upload.
 *
 * Expected request body:
 * {
 *   "s3_key": "raw/patient-123/...",
 *   "upload_id": "upload-id-123",
 *   "parts": [
 *     { "PartNumber": 1, "ETag": "etag1" },
 *     { "PartNumber": 2, "ETag": "etag2" }
 *   ]
 * }
 *
 * @param {Object} event - API Gateway event
 * @returns {Promise<Object>} API Gateway response
 */
async function handleCompleteMultipartUpload(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { s3_key, upload_id, parts } = body;

    if (!s3_key || !upload_id || !parts) {
      return createResponse(400, {
        error: 'Missing required parameters: s3_key, upload_id, parts',
      });
    }

    const result = await generator.completeMultipartUpload({
      key: s3_key,
      uploadId: upload_id,
      parts,
    });

    return createResponse(200, {
      location: result.location,
      bucket: result.bucket,
      key: result.key,
      etag: result.etag,
    });
  } catch (error) {
    console.error('Error completing multipart upload:', error);
    return createResponse(500, { error: 'Failed to complete multipart upload' });
  }
}

/**
 * Create API Gateway response.
 *
 * @param {number} statusCode - HTTP status code
 * @param {Object} body - Response body
 * @returns {Object} API Gateway response object
 */
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Configure appropriately for production
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

// Export individual handlers for testing
module.exports = {
  handler: exports.handler,
  handleUploadUrlRequest,
  handleDownloadUrlRequest,
  handleMultipartUploadRequest,
  handleCompleteMultipartUpload,
};
