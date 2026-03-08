/**
 * Presigned URL Routes
 * Handles generation of S3 presigned URLs for document and audio uploads
 */

const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

const router = express.Router();

// Initialize S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION });

// Environment variables
const DOCUMENTS_BUCKET = process.env.S3_DOCUMENTS_BUCKET;
const AUDIO_BUCKET = process.env.S3_AUDIO_BUCKET;
const PRESIGNED_URL_EXPIRATION = 3600; // 3600 seconds = 1 hour

// Validation schemas
const documentPresignedUrlSchema = Joi.object({
  filename: Joi.string()
    .max(255)
    .required()
    .pattern(/\.(jpg|jpeg|png|pdf)$/i)
    .messages({
      'string.pattern.base': 'File must be JPEG, PNG, or PDF format',
      'string.max': 'Filename must not exceed 255 characters',
      'any.required': 'Filename is required',
    }),
});

const audioPresignedUrlSchema = Joi.object({
  filename: Joi.string()
    .max(255)
    .required()
    .pattern(/\.wav$/i)
    .messages({
      'string.pattern.base': 'File must be WAV format',
      'string.max': 'Filename must not exceed 255 characters',
      'any.required': 'Filename is required',
    }),
});

/**
 * Generate presigned URL for document upload
 * POST /upload/presigned-url
 */
router.post('/presigned-url', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = documentPresignedUrlSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.details[0].message,
        requestId: req.id,
      });
    }

    const { filename } = value;
    const userId = req.user.userId;
    const jobId = uuidv4();

    // Generate S3 key: uploads/{userId}/{jobId}-{filename}
    const s3Key = `uploads/${userId}/${jobId}-${filename}`;

    // Create presigned URL
    const command = new PutObjectCommand({
      Bucket: DOCUMENTS_BUCKET,
      Key: s3Key,
      ContentType: getContentType(filename),
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRATION,
    });

    console.log('Generated presigned URL for document:', {
      userId,
      jobId,
      filename,
      s3Key,
    });

    res.json({
      uploadUrl,
      s3Key,
      expiresIn: PRESIGNED_URL_EXPIRATION,
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);

    res.status(500).json({
      error: 'Failed to generate presigned URL',
      code: 'PRESIGNED_URL_ERROR',
      details: 'Unable to generate upload URL',
      requestId: req.id,
    });
  }
});

/**
 * Generate presigned URL for audio upload
 * POST /upload/audio-presigned-url
 */
router.post('/audio-presigned-url', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = audioPresignedUrlSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.details[0].message,
        requestId: req.id,
      });
    }

    const { filename } = value;
    const userId = req.user.userId;
    const jobId = uuidv4();

    // Generate S3 key: uploads/{userId}/{jobId}-{filename}
    const s3Key = `uploads/${userId}/${jobId}-${filename}`;

    // Create presigned URL
    const command = new PutObjectCommand({
      Bucket: AUDIO_BUCKET,
      Key: s3Key,
      ContentType: 'audio/wav',
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRATION,
    });

    console.log('Generated presigned URL for audio:', {
      userId,
      jobId,
      filename,
      s3Key,
    });

    res.json({
      uploadUrl,
      s3Key,
      expiresIn: PRESIGNED_URL_EXPIRATION,
    });
  } catch (error) {
    console.error('Error generating audio presigned URL:', error);

    res.status(500).json({
      error: 'Failed to generate presigned URL',
      code: 'PRESIGNED_URL_ERROR',
      details: 'Unable to generate upload URL',
      requestId: req.id,
    });
  }
});

/**
 * Get content type based on file extension
 */
function getContentType(filename) {
  const ext = filename.toLowerCase().split('.').pop();

  const contentTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    pdf: 'application/pdf',
  };

  return contentTypes[ext] || 'application/octet-stream';
}

module.exports = router;
