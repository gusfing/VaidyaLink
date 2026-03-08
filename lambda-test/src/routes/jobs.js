/**
 * Job Management Routes
 * Handles job creation, status queries, and result retrieval
 */

const express = require('express');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const Joi = require('joi');

const router = express.Router();

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Initialize S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION });

// Environment variables
const JOBS_TABLE = process.env.JOBS_TABLE || 'document-scan-jobs';
const DOCUMENTS_BUCKET = process.env.S3_DOCUMENTS_BUCKET;
const AUDIO_BUCKET = process.env.S3_AUDIO_BUCKET;
const PRESIGNED_URL_EXPIRATION = 3600; // 1 hour

// Validation schemas
const processJobSchema = Joi.object({
  s3Key: Joi.string().required().messages({
    'any.required': 's3Key is required',
  }),
});

const transcribeJobSchema = Joi.object({
  s3Key: Joi.string().required().messages({
    'any.required': 's3Key is required',
  }),
  language: Joi.string()
    .valid('hi', 'en', 'ta', 'te', 'kn', 'ml', 'bn', 'mr', 'gu')
    .required()
    .messages({
      'any.required': 'language is required',
      'any.only': 'language must be one of: hi, en, ta, te, kn, ml, bn, mr, gu',
    }),
});

const transcriptionCorrectionSchema = Joi.object({
  correctedText: Joi.string().required().messages({
    'any.required': 'correctedText is required',
  }),
});

/**
 * Create job record for document processing
 * POST /jobs/process
 */
router.post('/process', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = processJobSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.details[0].message,
        requestId: req.id,
      });
    }

    const { s3Key } = value;
    const userId = req.user.userId;

    // Extract jobId from s3Key pattern: uploads/{userId}/{jobId}-{filename}
    const jobId = extractJobIdFromS3Key(s3Key);

    if (!jobId) {
      return res.status(400).json({
        error: 'Invalid s3Key format',
        code: 'INVALID_S3_KEY',
        details: 's3Key must follow pattern: uploads/{userId}/{jobId}-{filename}',
        requestId: req.id,
      });
    }

    // Create job record
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

    const jobRecord = {
      jobId,
      userId,
      type: 'document',
      status: 'uploading',
      message: 'Document uploaded, waiting for processing',
      s3Key,
      documentUrl: `s3://${process.env.S3_DOCUMENTS_BUCKET}/${s3Key}`,
      createdAt: now,
      updatedAt: now,
      ttl,
    };

    await docClient.send(
      new PutCommand({
        TableName: JOBS_TABLE,
        Item: jobRecord,
      })
    );

    console.log('Created document processing job:', {
      jobId,
      userId,
      s3Key,
    });

    res.json({ jobId });
  } catch (error) {
    console.error('Error creating document processing job:', error);

    res.status(500).json({
      error: 'Failed to create job',
      code: 'JOB_CREATION_ERROR',
      details: 'Unable to create processing job',
      requestId: req.id,
    });
  }
});

/**
 * Create job record for voice transcription
 * POST /jobs/transcribe
 */
router.post('/transcribe', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = transcribeJobSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.details[0].message,
        requestId: req.id,
      });
    }

    const { s3Key, language } = value;
    const userId = req.user.userId;

    // Extract jobId from s3Key
    const jobId = extractJobIdFromS3Key(s3Key);

    if (!jobId) {
      return res.status(400).json({
        error: 'Invalid s3Key format',
        code: 'INVALID_S3_KEY',
        details: 's3Key must follow pattern: uploads/{userId}/{jobId}-{filename}',
        requestId: req.id,
      });
    }

    // Create job record
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

    const jobRecord = {
      jobId,
      userId,
      type: 'voice',
      status: 'uploading',
      message: 'Audio uploaded, waiting for transcription',
      s3Key,
      audioUrl: `s3://${process.env.S3_AUDIO_BUCKET}/${s3Key}`,
      language,
      createdAt: now,
      updatedAt: now,
      ttl,
    };

    await docClient.send(
      new PutCommand({
        TableName: JOBS_TABLE,
        Item: jobRecord,
      })
    );

    console.log('Created voice transcription job:', {
      jobId,
      userId,
      s3Key,
      language,
    });

    res.json({ jobId });
  } catch (error) {
    console.error('Error creating transcription job:', error);

    res.status(500).json({
      error: 'Failed to create job',
      code: 'JOB_CREATION_ERROR',
      details: 'Unable to create transcription job',
      requestId: req.id,
    });
  }
});

/**
 * Get job status
 * GET /jobs/:jobId/status
 */
router.get('/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;

    // Query job from DynamoDB
    const result = await docClient.send(
      new GetCommand({
        TableName: JOBS_TABLE,
        Key: { jobId },
      })
    );

    if (!result.Item) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
        details: `Job with ID ${jobId} does not exist`,
        requestId: req.id,
      });
    }

    // Verify job belongs to user
    if (result.Item.userId !== userId) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
        details: `Job with ID ${jobId} does not exist`,
        requestId: req.id,
      });
    }

    // Return status information
    const statusResponse = {
      jobId: result.Item.jobId,
      status: result.Item.status,
      type: result.Item.type,
      createdAt: result.Item.createdAt,
    };

    if (result.Item.message) {
      statusResponse.message = result.Item.message;
    }

    if (result.Item.error) {
      statusResponse.error = result.Item.error;
    }

    res.json(statusResponse);
  } catch (error) {
    console.error('Error getting job status:', error);

    res.status(500).json({
      error: 'Failed to get job status',
      code: 'JOB_STATUS_ERROR',
      details: 'Unable to retrieve job status',
      requestId: req.id,
    });
  }
});

/**
 * Get job results
 * GET /jobs/:jobId/results
 */
router.get('/:jobId/results', async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;

    // Query job from DynamoDB
    const result = await docClient.send(
      new GetCommand({
        TableName: JOBS_TABLE,
        Key: { jobId },
      })
    );

    if (!result.Item) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
        details: `Job with ID ${jobId} does not exist`,
        requestId: req.id,
      });
    }

    // Verify job belongs to user
    if (result.Item.userId !== userId) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
        details: `Job with ID ${jobId} does not exist`,
        requestId: req.id,
      });
    }

    // Check if job is complete
    if (result.Item.status !== 'complete') {
      return res.status(400).json({
        error: 'Job not complete',
        code: 'JOB_NOT_COMPLETE',
        details: `Job is in status: ${result.Item.status}`,
        requestId: req.id,
      });
    }

    // Return complete results
    const resultsResponse = {
      jobId: result.Item.jobId,
      type: result.Item.type,
      status: result.Item.status,
      processedAt: result.Item.processedAt,
    };

    // Add type-specific fields
    if (result.Item.type === 'document') {
      // Generate presigned URL for document viewing
      const s3Key = extractS3KeyFromUri(result.Item.documentUrl);
      const presignedUrl = s3Key ? await generatePresignedGetUrl(DOCUMENTS_BUCKET, s3Key) : null;

      resultsResponse.documentUrl = presignedUrl || result.Item.documentUrl;
      resultsResponse.ocrText = result.Item.ocrText;
      resultsResponse.entities = result.Item.entities || [];
      resultsResponse.medications = result.Item.medications || [];
      resultsResponse.conditions = result.Item.conditions || [];
      resultsResponse.labResults = result.Item.labResults || [];
      resultsResponse.fhirResource = result.Item.fhirResource;
    } else if (result.Item.type === 'voice') {
      // Generate presigned URL for audio playback
      const s3Key = extractS3KeyFromUri(result.Item.audioUrl);
      const presignedUrl = s3Key ? await generatePresignedGetUrl(AUDIO_BUCKET, s3Key) : null;

      resultsResponse.audioUrl = presignedUrl || result.Item.audioUrl;
      resultsResponse.transcribedText = result.Item.transcribedText;
      resultsResponse.detectedLanguage = result.Item.detectedLanguage;
      resultsResponse.confidence = result.Item.confidence;
      resultsResponse.needsReview = result.Item.needsReview;
      resultsResponse.entities = result.Item.entities || [];
      resultsResponse.fhirResource = result.Item.fhirResource;
    }

    res.json(resultsResponse);
  } catch (error) {
    console.error('Error getting job results:', error);

    res.status(500).json({
      error: 'Failed to get job results',
      code: 'JOB_RESULTS_ERROR',
      details: 'Unable to retrieve job results',
      requestId: req.id,
    });
  }
});

/**
 * Update transcription with user corrections
 * PATCH /jobs/:jobId/transcription
 */
router.patch('/:jobId/transcription', async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.userId;

    // Validate request body
    const { error, value } = transcriptionCorrectionSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.details[0].message,
        requestId: req.id,
      });
    }

    const { correctedText } = value;

    // Get job to verify ownership and type
    const getResult = await docClient.send(
      new GetCommand({
        TableName: JOBS_TABLE,
        Key: { jobId },
      })
    );

    if (!getResult.Item) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
        details: `Job with ID ${jobId} does not exist`,
        requestId: req.id,
      });
    }

    // Verify job belongs to user
    if (getResult.Item.userId !== userId) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
        details: `Job with ID ${jobId} does not exist`,
        requestId: req.id,
      });
    }

    // Verify job is voice type
    if (getResult.Item.type !== 'voice') {
      return res.status(400).json({
        error: 'Invalid job type',
        code: 'INVALID_JOB_TYPE',
        details: 'Transcription corrections can only be applied to voice jobs',
        requestId: req.id,
      });
    }

    // Update transcription
    await docClient.send(
      new UpdateCommand({
        TableName: JOBS_TABLE,
        Key: { jobId },
        UpdateExpression: 'SET transcribedText = :text, correctedAt = :now, updatedAt = :now',
        ExpressionAttributeValues: {
          ':text': correctedText,
          ':now': new Date().toISOString(),
        },
      })
    );

    console.log('Updated transcription for job:', {
      jobId,
      userId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating transcription:', error);

    res.status(500).json({
      error: 'Failed to update transcription',
      code: 'TRANSCRIPTION_UPDATE_ERROR',
      details: 'Unable to update transcription',
      requestId: req.id,
    });
  }
});

/**
 * Extract jobId from S3 key pattern: uploads/{userId}/{jobId}-{filename}
 */
function extractJobIdFromS3Key(s3Key) {
  const match = s3Key.match(/uploads\/[^/]+\/([^-]+)-/);
  return match ? match[1] : null;
}

/**
 * Generate presigned URL for viewing/downloading a file from S3
 */
async function generatePresignedGetUrl(bucket, key) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRATION,
    });

    return url;
  } catch (error) {
    console.error('Error generating presigned GET URL:', { bucket, key, error });
    return null;
  }
}

/**
 * Extract S3 key from S3 URI (s3://bucket/key)
 */
function extractS3KeyFromUri(s3Uri) {
  const match = s3Uri.match(/^s3:\/\/[^/]+\/(.+)$/);
  return match ? match[1] : null;
}

module.exports = router;
