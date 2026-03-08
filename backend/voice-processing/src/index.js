/**
 * Voice Processing Lambda Handler
 *
 * Pipeline:
 *   1. Receive audio file reference (S3 event or direct invocation)
 *   2. Download audio from S3
 *   3. Detect language (language-detector util)
 *   4. Transcribe speech via Bhashini API
 *   5. (Optional) Generate playback audio for user confirmation
 *   6. Structure clinical data via ClinicalExtractor (Bedrock)
 *   7. Map to FHIR Observation/MedicationStatement payload
 *   8. Trigger FHIR Transformer Lambda asynchronously
 *
 * Exports:
 *   handler             – main entry point (S3 event or direct invocation)
 *   processConfirmation – called by the API Gateway /voice/{jobId}/confirm endpoint
 *   getJobStatus        – called by the API Gateway GET /voice/{jobId} endpoint
 *
 * Runtime: Node.js 18
 */

'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const axios = require('axios');

const {
  detectLanguage,
  detectLanguageFromText,
  formatDetectionResult,
  isLanguageSupported,
} = require('./utils/language-detector');
const { createClinicalExtractor } = require('./utils/clinical-extractor');
const { createAudioGenerator } = require('./utils/audio-generator');
const { buildFHIRPayload, hasMappableEntities } = require('./utils/fhir-observation-mapper');

// ─── AWS clients ──────────────────────────────────────────────────────────────

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const lambdaClient = new LambdaClient({});

// ─── Service instances ────────────────────────────────────────────────────────

const clinicalExtractor = createClinicalExtractor();
const audioGenerator = createAudioGenerator();

// ─── Environment variables ────────────────────────────────────────────────────

const VOICEJOBS_TABLE = process.env.VOICEJOBS_TABLE;
const S3_AUDIO_BUCKET = process.env.S3_AUDIO_BUCKET;
const SARVAM_API_URL = process.env.SARVAM_API_URL || 'https://api.sarvam.ai/speech-to-text';
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const TRANSCRIPTION_CONFIDENCE_THRESHOLD = parseFloat(
  process.env.TRANSCRIPTION_CONFIDENCE_THRESHOLD || '0.75'
);
const FHIR_TRANSFORMER_LAMBDA_ARN = process.env.FHIR_TRANSFORMER_LAMBDA_ARN;
const ENABLE_PLAYBACK_CONFIRMATION = process.env.ENABLE_PLAYBACK_CONFIRMATION === 'true';

const SUPPORTED_LANGUAGES = (
  process.env.SUPPORTED_LANGUAGES ||
  'en,hi,bn,te,mr,ta,gu,kn,ml,pa,or,as,ur,sa,ks,sd,ne,kok,mai,bodo,doi,mni'
).split(',');

// ─── Main handler ─────────────────────────────────────────────────────────────

/**
 * Main Lambda handler — invoked by S3 events or directly.
 */
exports.handler = async (event, context) => {
  console.log('Processing voice event:', JSON.stringify(event, null, 2));

  const requestId = context?.awsRequestId || context?.requestId;

  try {
    if (event.Records && event.Records[0]?.eventSource === 'aws:s3') {
      for (const record of event.Records) {
        await processS3Event(record);
      }
    } else {
      const { jobId } = event;
      if (!jobId) {
        throw new Error('jobId is required for direct invocation');
      }
      await processVoiceJob(jobId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Voice processing completed successfully', requestId }),
    };
  } catch (error) {
    console.error('Error processing voice:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'InternalServerError',
        message: error.message,
        requestId,
      }),
    };
  }
};

// ─── Task 10.7: Confirmation workflow ─────────────────────────────────────────

/**
 * processConfirmation
 *
 * Handles the user's accept/reject decision on a transcription that was
 * routed for confirmation (status === 'confirming').
 *
 * Expected input – either:
 *   API Gateway proxy:  { body: '{"jobId":"...","confirmed":true}' }
 *   Direct invocation:  { jobId: '...', confirmed: true }
 *
 * On success:
 *   - confirmed === true  → extracts clinical entities, maps to FHIR, triggers transformer → status 'completed'
 *   - confirmed === false → marks job as 'rejected', client should retry
 */
exports.processConfirmation = async (event) => {
  console.log('Processing confirmation:', JSON.stringify(event, null, 2));

  // ── Parse payload (API Gateway body string OR direct JSON) ─────────────────
  let payload;
  try {
    payload = typeof event.body === 'string' ? JSON.parse(event.body) : event;
  } catch {
    return _response(400, { error: 'InvalidJSON', message: 'Request body is not valid JSON' });
  }

  const { jobId, confirmed, editedTranscription } = payload;

  // ── Input validation ───────────────────────────────────────────────────────
  if (!jobId) {
    return _response(400, { error: 'MissingField', message: 'jobId is required' });
  }
  if (confirmed === undefined || confirmed === null) {
    return _response(400, {
      error: 'MissingField',
      message: 'confirmed (boolean) is required',
    });
  }

  try {
    // ── Fetch job ──────────────────────────────────────────────────────────────
    const job = await getVoiceJob(jobId);
    if (!job) {
      return _response(404, { error: 'NotFound', message: `Voice job not found: ${jobId}` });
    }

    // ── State guard ────────────────────────────────────────────────────────────
    if (job.status !== 'confirming') {
      return _response(409, {
        error: 'InvalidState',
        message: `Job ${jobId} is not awaiting confirmation (current status: ${job.status})`,
        currentStatus: job.status,
      });
    }

    // ── User rejected transcription ────────────────────────────────────────────
    if (!confirmed) {
      await updateJobStatus(jobId, 'rejected', {
        rejectedAt: new Date().toISOString(),
        rejectionReason: 'User rejected transcription',
      });
      return _response(200, {
        message: 'Transcription rejected. Please re-record.',
        jobId,
        status: 'rejected',
      });
    }

    // ── User accepted — run clinical extraction on final transcription ──────────
    const finalTranscription = editedTranscription?.trim() || job.transcription;
    const language = job.detectedLanguage || job.language || 'en';

    const extractionResult = await clinicalExtractor.extractEntities(finalTranscription, language, {
      userConfirmed: true,
      originalTranscription: job.transcription,
      jobId,
    });

    const { entities: structuredData, confidence: entityConfidence } = extractionResult;

    // ── Validate extracted entities ────────────────────────────────────────────
    const validation = clinicalExtractor.validateEntities(structuredData);
    if (validation.errors.length > 0) {
      console.warn(`Entity validation errors for job ${jobId}:`, validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn(`Entity validation warnings for job ${jobId}:`, validation.warnings);
    }

    // ── Persist structured data to S3 ─────────────────────────────────────────
    await saveStructuredData(jobId, {
      ...structuredData,
      _metadata: {
        confidence: entityConfidence,
        validation,
        extractedAt: extractionResult.metadata.extractedAt,
        userConfirmed: true,
      },
    });

    // ── Task 10.8: Build FHIR Observation payload and trigger transformer ──────
    if (FHIR_TRANSFORMER_LAMBDA_ARN && hasMappableEntities(structuredData)) {
      const patientId = job.patientId;
      if (patientId) {
        const fhirPayload = buildFHIRPayload({
          patientId,
          jobId,
          entities: structuredData,
          confidence: entityConfidence,
        });
        await triggerFHIRTransformation(fhirPayload);
      } else {
        console.warn(`Job ${jobId} has no patientId — skipping FHIR transformation`);
      }
    }

    // ── Mark job complete ──────────────────────────────────────────────────────
    await updateJobStatus(jobId, 'completed', {
      confirmed: true,
      finalTranscription,
      structuredData,
      entityConfidence: entityConfidence.overall,
      entityConfidenceByType: entityConfidence.byEntity,
      validationWarnings: validation.warnings,
      confirmedAt: new Date().toISOString(),
    });

    return _response(200, {
      message: 'Confirmation processed successfully',
      jobId,
      status: 'completed',
      entityCount: _countEntities(structuredData),
    });
  } catch (error) {
    console.error(`Error processing confirmation for job ${jobId}:`, error);
    // Attempt to mark job as failed so the client is not stuck
    try {
      await updateJobStatus(jobId, 'failed', {
        errorMessage: `Confirmation processing failed: ${error.message}`,
        failedAt: new Date().toISOString(),
      });
    } catch (updateError) {
      console.error('Failed to update job status after confirmation error:', updateError);
    }
    return _response(500, { error: 'InternalServerError', message: error.message });
  }
};

// ─── Task 10.7: get job status (for client polling) ──────────────────────────

/**
 * getJobStatus
 *
 * Lightweight handler so the frontend can poll for the job's current status
 * and retrieve the playbackAudioUrl when available.
 *
 * Input (API Gateway or direct):
 *   { jobId: '...' }  OR  { pathParameters: { jobId: '...' } }
 */
exports.getJobStatus = async (event) => {
  console.log('Getting job status:', JSON.stringify(event, null, 2));

  const jobId =
    event.jobId ||
    event.pathParameters?.jobId ||
    (typeof event.body === 'string' ? JSON.parse(event.body).jobId : undefined);

  if (!jobId) {
    return _response(400, { error: 'MissingField', message: 'jobId is required' });
  }

  try {
    const job = await getVoiceJob(jobId);
    if (!job) {
      return _response(404, { error: 'NotFound', message: `Voice job not found: ${jobId}` });
    }

    return _response(200, {
      jobId,
      status: job.status,
      transcription: job.transcription || null,
      detectedLanguage: job.detectedLanguage || null,
      transcriptionConfidence: job.transcriptionConfidence || null,
      needsConfirmation: job.needsConfirmation || false,
      playbackAudioUrl: job.playbackAudioUrl || null,
      playbackAudioFormat: job.playbackAudioFormat || null,
      entityConfidence: job.entityConfidence || null,
      confirmedAt: job.confirmedAt || null,
      rejectedAt: job.rejectedAt || null,
      failedAt: job.failedAt || null,
      errorMessage: job.errorMessage || null,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    console.error(`Error getting job status for ${jobId}:`, error);
    return _response(500, { error: 'InternalServerError', message: error.message });
  }
};

// ─── Core voice processing pipeline ──────────────────────────────────────────

async function processS3Event(record) {
  const bucket = record.s3.bucket.name;
  const key = record.s3.object.key;
  console.log(`Processing S3 audio file: s3://${bucket}/${key}`);

  const parts = key.split('/');
  if (parts.length < 3) {
    throw new Error(`Invalid S3 key format: ${key}`);
  }
  const jobId = parts[2];

  try {
    await updateJobStatus(jobId, 'transcribing', {
      processingStartedAt: new Date().toISOString(),
    });
    await processVoiceRecording(jobId, bucket, key);
  } catch (error) {
    console.error(`Error processing S3 event for job ${jobId}:`, error);
    await updateJobStatus(jobId, 'failed', {
      errorMessage: error.message,
      failedAt: new Date().toISOString(),
    });
    throw error;
  }
}

async function processVoiceJob(jobId) {
  console.log(`Processing voice job: ${jobId}`);

  const job = await getVoiceJob(jobId);
  if (!job) throw new Error(`Voice job not found: ${jobId}`);

  const bucket = job.audioS3Bucket || S3_AUDIO_BUCKET;
  const key = job.audioS3Key;
  if (!key) throw new Error(`No audio S3 key found for job: ${jobId}`);

  await updateJobStatus(jobId, 'transcribing', {
    processingStartedAt: new Date().toISOString(),
  });
  await processVoiceRecording(jobId, bucket, key);
}

async function processVoiceRecording(jobId, bucket, key) {
  console.log(`Starting voice recording pipeline for job ${jobId}`);
  const startTime = Date.now();

  try {
    // 1. Fetch job metadata
    const job = await getVoiceJob(jobId);
    const userSpecifiedLanguage = job.language || null;

    // 2. Download audio from S3
    console.log(`Downloading audio from s3://${bucket}/${key}`);
    const audioData = await downloadAudioFromS3(bucket, key);

    // 3. Detect language
    console.log(`Detecting language for job ${jobId}…`);
    const languageDetection = await detectLanguage(audioData, userSpecifiedLanguage);
    console.log(`Language detection: ${formatDetectionResult(languageDetection)}`);

    if (!isLanguageSupported(languageDetection.detectedLanguage)) {
      throw new Error(
        `Unsupported language: ${languageDetection.detectedLanguage}. ` +
          `Supported: ${SUPPORTED_LANGUAGES.join(', ')}`
      );
    }

    const language = languageDetection.detectedLanguage;

    await updateJobStatus(jobId, 'transcribing', {
      detectedLanguage: language,
      languageConfidence: languageDetection.confidence,
      languageDetectionMethod: languageDetection.detectionMethod,
      isCodeMixed: languageDetection.isCodeMixed,
      codeMixedLanguages: languageDetection.codeMixedLanguages,
    });

    // 4. Transcribe via Sarvam API
    console.log(`Transcribing audio with Sarvam API (language: ${language})`);
    const transcriptionResult = await transcribeAudio(audioData, language);
    const { transcription, confidence, detectedLanguage } = transcriptionResult;

    console.log(
      `Transcription done — confidence: ${confidence.toFixed(2)}, ` +
        `detected language: ${detectedLanguage}`
    );

    // Cross-validate language detection vs transcription language
    if (detectedLanguage && detectedLanguage !== language) {
      console.warn(
        `Language mismatch: detected ${language} but transcription returned ${detectedLanguage}`
      );
      const textLangDetection = detectLanguageFromText(transcription);
      console.log(
        `Text-based language: ${textLangDetection.language} ` +
          `(confidence: ${textLangDetection.confidence.toFixed(2)})`
      );
    }

    // Persist raw transcription
    await saveTranscription(jobId, transcription, confidence, detectedLanguage);

    // 5. Route to confirmation if needed
    const needsConfirmation =
      ENABLE_PLAYBACK_CONFIRMATION && confidence < TRANSCRIPTION_CONFIDENCE_THRESHOLD;

    if (needsConfirmation) {
      console.log(
        `Generating playback audio for confirmation (confidence: ${confidence.toFixed(2)})`
      );

      try {
        const audioResult = await audioGenerator.generatePlaybackAudio(
          transcription,
          detectedLanguage,
          jobId
        );
        const playbackUrl = await audioGenerator.generatePresignedUrl(audioResult.s3Key, 3600);

        await updateJobStatus(jobId, 'confirming', {
          transcription,
          transcriptionConfidence: confidence,
          detectedLanguage,
          needsConfirmation: true,
          playbackAudioS3Key: audioResult.s3Key,
          playbackAudioUrl: playbackUrl,
          playbackAudioFormat: audioResult.format,
          playbackAudioGenerated: true,
          transcribedAt: new Date().toISOString(),
        });
        console.log(`Job ${jobId} awaiting user confirmation`);
      } catch (audioError) {
        console.error('Failed to generate playback audio:', audioError);

        // Still route to confirmation — the user can confirm without hearing the audio
        await updateJobStatus(jobId, 'confirming', {
          transcription,
          transcriptionConfidence: confidence,
          detectedLanguage,
          needsConfirmation: true,
          playbackAudioGenerated: false,
          playbackAudioError: audioError.message,
          transcribedAt: new Date().toISOString(),
        });
        console.log(`Job ${jobId} awaiting user confirmation (playback audio unavailable)`);
      }

      // Stop here — processConfirmation continues the pipeline
      return;
    }

    // 6. Clinical entity extraction (no confirmation required)
    console.log(`Extracting clinical entities for job ${jobId}…`);
    const extractionResult = await clinicalExtractor.extractEntities(transcription, language, {
      transcriptionConfidence: confidence,
      detectedLanguage,
    });

    const { entities: structuredData, confidence: entityConfidence } = extractionResult;

    const validation = clinicalExtractor.validateEntities(structuredData);
    if (!validation.isValid) {
      console.error('Entity validation errors:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn('Entity validation warnings:', validation.warnings);
    }

    await saveStructuredData(jobId, {
      ...structuredData,
      _metadata: {
        confidence: entityConfidence,
        validation,
        extractedAt: extractionResult.metadata.extractedAt,
      },
    });

    // 7. Task 10.8 — FHIR Observation / MedicationStatement trigger
    if (FHIR_TRANSFORMER_LAMBDA_ARN && hasMappableEntities(structuredData)) {
      const patientId = job.patientId;
      if (patientId) {
        const fhirPayload = buildFHIRPayload({
          patientId,
          jobId,
          entities: structuredData,
          confidence: entityConfidence,
        });
        await triggerFHIRTransformation(fhirPayload);
      } else {
        console.warn(`Job ${jobId} has no patientId — skipping FHIR transformation`);
      }
    }

    // 8. Mark complete
    const duration = Date.now() - startTime;
    await updateJobStatus(jobId, 'completed', {
      transcription,
      transcriptionConfidence: confidence,
      detectedLanguage,
      structuredData,
      entityConfidence: entityConfidence.overall,
      entityConfidenceByType: entityConfidence.byEntity,
      validationWarnings: validation.warnings,
      processingCompletedAt: new Date().toISOString(),
      processingDurationMs: duration,
    });

    console.log(`Voice processing completed for job ${jobId} in ${duration}ms`);
  } catch (error) {
    console.error(`Error processing voice recording for job ${jobId}:`, error);
    await updateJobStatus(jobId, 'failed', {
      errorMessage: error.message,
      failedAt: new Date().toISOString(),
    });
    throw error;
  }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function downloadAudioFromS3(bucket, key) {
  try {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    throw new Error(`Failed to download audio from S3: ${error.message}`);
  }
}

async function saveTranscription(jobId, transcription, confidence, detectedLanguage) {
  const key = `transcriptions/${jobId}/transcription.json`;
  const data = {
    jobId,
    transcription,
    confidence,
    detectedLanguage,
    transcribedAt: new Date().toISOString(),
  };

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_AUDIO_BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'aws:kms',
    })
  );
  console.log(`Transcription saved to s3://${S3_AUDIO_BUCKET}/${key}`);
}

async function saveStructuredData(jobId, structuredData) {
  const key = `transcriptions/${jobId}/structured-data.json`;
  const data = { jobId, structuredData, structuredAt: new Date().toISOString() };

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_AUDIO_BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'aws:kms',
    })
  );
  console.log(`Structured data saved to s3://${S3_AUDIO_BUCKET}/${key}`);
}

// ─── DynamoDB helpers ─────────────────────────────────────────────────────────

async function getVoiceJob(jobId) {
  try {
    const response = await docClient.send(
      new GetCommand({
        TableName: VOICEJOBS_TABLE,
        Key: { PK: `VOICE#${jobId}`, SK: 'METADATA' },
      })
    );
    return response.Item;
  } catch (error) {
    throw new Error(`Failed to get voice job ${jobId}: ${error.message}`);
  }
}

async function updateJobStatus(jobId, status, additionalFields = {}) {
  const updateExpression = ['updatedAt = :updatedAt'];
  const expressionAttributeNames = {};
  const expressionAttributeValues = { ':updatedAt': new Date().toISOString() };

  if (status) {
    updateExpression.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = status;
  }

  for (const [key, value] of Object.entries(additionalFields)) {
    updateExpression.push(`${key} = :${key}`);
    expressionAttributeValues[`:${key}`] = value;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: VOICEJOBS_TABLE,
      Key: { PK: `VOICE#${jobId}`, SK: 'METADATA' },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames:
        Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
  console.log(`Voice job ${jobId} status updated${status ? ` to ${status}` : ''}`);
}

// ─── Sarvam API transcription ─────────────────────────────────────────────────

async function transcribeAudio(audioData, language) {
  try {
    // Sarvam API expects multipart/form-data with audio file
    const FormData = require('form-data');
    const form = new FormData();

    // Add audio file as buffer
    form.append('file', audioData, {
      filename: 'audio.wav',
      contentType: 'audio/wav',
    });

    // Add language code
    form.append('language_code', language);

    // Optional: Add model parameter (default is saaras:v1)
    form.append('model', 'saaras:v1');

    const response = await axios.post(SARVAM_API_URL, form, {
      headers: {
        ...form.getHeaders(),
        'api-subscription-key': SARVAM_API_KEY,
      },
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Sarvam API response format:
    // {
    //   "transcript": "transcribed text here",
    //   "language_code": "hi",
    //   "confidence": 0.95
    // }

    const transcription = response.data.transcript || '';
    const confidence = response.data.confidence || 0.0;
    const detectedLanguage = response.data.language_code || language;

    if (!transcription) {
      throw new Error('Empty transcription from Sarvam API');
    }

    console.log(
      `Sarvam API transcription: "${transcription.substring(0, 100)}..." (confidence: ${confidence})`
    );

    return { transcription, confidence, detectedLanguage };
  } catch (error) {
    if (error.response) {
      console.error('Sarvam API error response:', error.response.data);
      throw new Error(
        `Sarvam API error: ${error.response.status} — ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(`Failed to transcribe audio with Sarvam API: ${error.message}`);
  }
}

// ─── FHIR transformer trigger ─────────────────────────────────────────────────

/**
 * Trigger the FHIR Transformer Lambda asynchronously.
 * Accepts a pre-built FHIR payload (produced by buildFHIRPayload).
 * Errors here are logged but do not fail voice processing.
 */
async function triggerFHIRTransformation(fhirPayload) {
  try {
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: FHIR_TRANSFORMER_LAMBDA_ARN,
        InvocationType: 'Event', // async — fire and forget
        Payload: JSON.stringify(fhirPayload),
      })
    );
    console.log(`FHIR transformation triggered for job ${fhirPayload.jobId}`);
  } catch (error) {
    // FHIR failure must not block voice processing
    console.error('Error triggering FHIR transformation (non-fatal):', error);
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function _response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function _countEntities(entities) {
  if (!entities) return 0;
  let count = 0;
  if (entities.chiefComplaint) count += 1;
  if (Array.isArray(entities.symptoms)) count += entities.symptoms.length;
  if (Array.isArray(entities.currentMedications)) count += entities.currentMedications.length;
  if (Array.isArray(entities.allergies)) count += entities.allergies.length;
  if (Array.isArray(entities.medicalHistory)) count += entities.medicalHistory.length;
  if (entities.vitalSigns) {
    count += Object.values(entities.vitalSigns).filter(Boolean).length;
  }
  return count;
}
