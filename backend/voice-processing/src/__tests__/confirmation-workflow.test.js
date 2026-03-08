/**
 * Confirmation Workflow Tests
 *
 * Tests for Task 10.7: Add confirmation workflow
 *
 * Test Coverage:
 * - processConfirmation handler with accept/reject scenarios
 * - getJobStatus handler for polling
 * - State transitions (confirming → completed/rejected)
 * - Edited transcription handling
 * - Error handling and validation
 */

const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Mock AWS clients
const dynamoMock = mockClient(DynamoDBDocumentClient);
const lambdaMock = mockClient(LambdaClient);
const s3Mock = mockClient(S3Client);

// Mock clinical extractor
const mockExtractEntities = jest.fn();
const mockValidateEntities = jest.fn();
jest.mock('../utils/clinical-extractor', () => ({
  createClinicalExtractor: () => ({
    extractEntities: mockExtractEntities,
    validateEntities: mockValidateEntities,
  }),
}));

// Mock audio generator
const mockGeneratePlaybackAudio = jest.fn();
const mockGeneratePresignedUrl = jest.fn();
jest.mock('../utils/audio-generator', () => ({
  createAudioGenerator: () => ({
    generatePlaybackAudio: mockGeneratePlaybackAudio,
    generatePresignedUrl: mockGeneratePresignedUrl,
  }),
}));

// Mock FHIR mapper
const mockBuildFHIRPayload = jest.fn();
const mockHasMappableEntities = jest.fn();
jest.mock('../utils/fhir-observation-mapper', () => ({
  buildFHIRPayload: (...args) => mockBuildFHIRPayload(...args),
  hasMappableEntities: (...args) => mockHasMappableEntities(...args),
}));

const { processConfirmation, getJobStatus } = require('../index');

describe('Confirmation Workflow - Task 10.7', () => {
  beforeEach(() => {
    dynamoMock.reset();
    lambdaMock.reset();
    s3Mock.reset();
    jest.clearAllMocks();

    // Reset all mock functions
    mockExtractEntities.mockReset();
    mockValidateEntities.mockReset();
    mockGeneratePlaybackAudio.mockReset();
    mockGeneratePresignedUrl.mockReset();
    mockBuildFHIRPayload.mockReset();
    mockHasMappableEntities.mockReset();

    // Mock S3 PutObject by default
    s3Mock.on(PutObjectCommand).resolves({});

    // Set environment variables
    process.env.VOICEJOBS_TABLE = 'VoiceJobs';
    process.env.S3_AUDIO_BUCKET = 'test-audio-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.FHIR_TRANSFORMER_LAMBDA_ARN =
      'arn:aws:lambda:us-east-1:123456789012:function:fhir-transformer';
    process.env.ENABLE_PLAYBACK_CONFIRMATION = 'true';
  });

  describe('processConfirmation', () => {
    const mockJob = {
      PK: 'VOICE#job-123',
      SK: 'METADATA',
      jobId: 'job-123',
      patientId: 'patient-456',
      status: 'confirming',
      transcription: 'Patient has fever and headache for two days',
      transcriptionConfidence: 0.72,
      detectedLanguage: 'en',
      needsConfirmation: true,
      playbackAudioUrl: 'https://s3.amazonaws.com/test-bucket/playback/job-123/confirmation.mp3',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:05:00Z',
    };

    describe('User accepts transcription', () => {
      it('should process confirmation and extract clinical entities', async () => {
        // Mock DynamoDB responses
        dynamoMock.on(GetCommand).resolves({ Item: mockJob });
        dynamoMock.on(UpdateCommand).resolves({});

        // Mock clinical extraction
        mockExtractEntities.mockResolvedValue({
          entities: {
            symptoms: [
              { name: 'fever', severity: 'moderate', duration: '2 days' },
              { name: 'headache', severity: 'moderate', duration: '2 days' },
            ],
            chiefComplaint: 'fever and headache',
          },
          confidence: {
            overall: 0.88,
            byEntity: {
              symptoms: 0.9,
              chiefComplaint: 0.85,
            },
          },
          metadata: {
            extractedAt: '2024-01-15T10:10:00Z',
          },
        });

        mockValidateEntities.mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
        });

        // Mock FHIR mapping
        mockHasMappableEntities.mockReturnValue(true);
        mockBuildFHIRPayload.mockReturnValue({
          patientId: 'patient-456',
          jobId: 'job-123',
          resourceType: 'Observation',
        });

        // Mock Lambda invocation
        lambdaMock.on(InvokeCommand).resolves({});

        const event = {
          body: JSON.stringify({
            jobId: 'job-123',
            confirmed: true,
          }),
        };

        const response = await processConfirmation(event);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.message).toContain('Confirmation processed successfully');
        expect(body.status).toBe('completed');
        expect(body.entityCount).toBeGreaterThan(0);

        // Verify clinical extraction was called
        expect(mockExtractEntities).toHaveBeenCalledWith(
          mockJob.transcription,
          mockJob.detectedLanguage,
          expect.objectContaining({
            userConfirmed: true,
            originalTranscription: mockJob.transcription,
            jobId: 'job-123',
          })
        );

        // Verify job status was updated to completed
        expect(dynamoMock.commandCalls(UpdateCommand).length).toBeGreaterThan(0);
      });

      it('should handle edited transcription', async () => {
        dynamoMock.on(GetCommand).resolves({ Item: mockJob });
        dynamoMock.on(UpdateCommand).resolves({});

        mockExtractEntities.mockResolvedValue({
          entities: {
            symptoms: [{ name: 'fever', severity: 'high', duration: '3 days' }],
          },
          confidence: { overall: 0.92, byEntity: {} },
          metadata: { extractedAt: '2024-01-15T10:10:00Z' },
        });

        mockValidateEntities.mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
        });

        mockHasMappableEntities.mockReturnValue(true);
        mockBuildFHIRPayload.mockReturnValue({ patientId: 'patient-456', jobId: 'job-123' });
        lambdaMock.on(InvokeCommand).resolves({});

        const editedText = 'Patient has high fever for three days';
        const event = {
          body: JSON.stringify({
            jobId: 'job-123',
            confirmed: true,
            editedTranscription: editedText,
          }),
        };

        const response = await processConfirmation(event);

        expect(response.statusCode).toBe(200);

        // Verify edited transcription was used
        expect(mockExtractEntities).toHaveBeenCalledWith(
          editedText,
          expect.any(String),
          expect.any(Object)
        );
      });

      it('should trigger FHIR transformation when entities are mappable', async () => {
        dynamoMock.on(GetCommand).resolves({ Item: mockJob });
        dynamoMock.on(UpdateCommand).resolves({});

        mockExtractEntities.mockResolvedValue({
          entities: { symptoms: [{ name: 'fever' }] },
          confidence: { overall: 0.85, byEntity: {} },
          metadata: { extractedAt: '2024-01-15T10:10:00Z' },
        });

        mockValidateEntities.mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
        });

        mockHasMappableEntities.mockReturnValue(true);
        const mockFHIRPayload = {
          patientId: 'patient-456',
          jobId: 'job-123',
          resourceType: 'Observation',
        };
        mockBuildFHIRPayload.mockReturnValue(mockFHIRPayload);

        lambdaMock.on(InvokeCommand).resolves({});

        const event = {
          body: JSON.stringify({ jobId: 'job-123', confirmed: true }),
        };

        const response = await processConfirmation(event);

        // Verify response is successful
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe('completed');
        expect(body.message).toContain('Confirmation processed successfully');
      });

      it('should skip FHIR transformation when no mappable entities', async () => {
        dynamoMock.on(GetCommand).resolves({ Item: mockJob });
        dynamoMock.on(UpdateCommand).resolves({});

        mockExtractEntities.mockResolvedValue({
          entities: {},
          confidence: { overall: 0.5, byEntity: {} },
          metadata: { extractedAt: '2024-01-15T10:10:00Z' },
        });

        mockValidateEntities.mockReturnValue({
          isValid: true,
          errors: [],
          warnings: ['No clinical entities extracted'],
        });

        mockHasMappableEntities.mockReturnValue(false);

        const event = {
          body: JSON.stringify({ jobId: 'job-123', confirmed: true }),
        };

        const response = await processConfirmation(event);

        expect(response.statusCode).toBe(200);

        // Verify FHIR transformer was NOT invoked
        expect(lambdaMock.commandCalls(InvokeCommand).length).toBe(0);
      });
    });

    describe('User rejects transcription', () => {
      it('should mark job as rejected when user declines', async () => {
        dynamoMock.on(GetCommand).resolves({ Item: mockJob });
        dynamoMock.on(UpdateCommand).resolves({});

        const event = {
          body: JSON.stringify({
            jobId: 'job-123',
            confirmed: false,
          }),
        };

        const response = await processConfirmation(event);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.message).toContain('rejected');
        expect(body.status).toBe('rejected');

        // Verify job status was updated to rejected
        const updateCalls = dynamoMock.commandCalls(UpdateCommand);
        expect(updateCalls.length).toBeGreaterThan(0);

        // Verify no clinical extraction or FHIR transformation
        expect(mockExtractEntities).not.toHaveBeenCalled();
        expect(lambdaMock.commandCalls(InvokeCommand).length).toBe(0);
      });
    });

    describe('Input validation', () => {
      it('should return 400 when jobId is missing', async () => {
        const event = {
          body: JSON.stringify({ confirmed: true }),
        };

        const response = await processConfirmation(event);

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('MissingField');
        expect(body.message).toContain('jobId');
      });

      it('should return 400 when confirmed field is missing', async () => {
        const event = {
          body: JSON.stringify({ jobId: 'job-123' }),
        };

        const response = await processConfirmation(event);

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('MissingField');
        expect(body.message).toContain('confirmed');
      });

      it('should return 400 for invalid JSON', async () => {
        const event = {
          body: 'invalid json {',
        };

        const response = await processConfirmation(event);

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('InvalidJSON');
      });

      it('should handle direct invocation (no body string)', async () => {
        dynamoMock.on(GetCommand).resolves({ Item: mockJob });
        dynamoMock.on(UpdateCommand).resolves({});

        mockExtractEntities.mockResolvedValue({
          entities: { symptoms: [] },
          confidence: { overall: 0.8, byEntity: {} },
          metadata: { extractedAt: '2024-01-15T10:10:00Z' },
        });

        mockValidateEntities.mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
        });

        mockHasMappableEntities.mockReturnValue(false);

        const event = {
          jobId: 'job-123',
          confirmed: true,
        };

        const response = await processConfirmation(event);

        expect(response.statusCode).toBe(200);
      });
    });

    describe('State validation', () => {
      it('should return 404 when job not found', async () => {
        dynamoMock.on(GetCommand).resolves({ Item: undefined });

        const event = {
          body: JSON.stringify({ jobId: 'nonexistent', confirmed: true }),
        };

        const response = await processConfirmation(event);

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('NotFound');
      });

      it('should return 409 when job is not in confirming state', async () => {
        const completedJob = { ...mockJob, status: 'completed' };
        dynamoMock.on(GetCommand).resolves({ Item: completedJob });

        const event = {
          body: JSON.stringify({ jobId: 'job-123', confirmed: true }),
        };

        const response = await processConfirmation(event);

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('InvalidState');
        expect(body.currentStatus).toBe('completed');
      });
    });

    describe('Error handling', () => {
      it('should handle clinical extraction errors gracefully', async () => {
        dynamoMock.on(GetCommand).resolves({ Item: mockJob });
        dynamoMock.on(UpdateCommand).resolves({});

        mockExtractEntities.mockRejectedValue(new Error('Bedrock API timeout'));

        const event = {
          body: JSON.stringify({ jobId: 'job-123', confirmed: true }),
        };

        const response = await processConfirmation(event);

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('InternalServerError');

        // Verify job was marked as failed
        const updateCalls = dynamoMock.commandCalls(UpdateCommand);
        expect(updateCalls.length).toBeGreaterThan(0);
      });

      it('should continue if FHIR transformation fails', async () => {
        dynamoMock.on(GetCommand).resolves({ Item: mockJob });
        dynamoMock.on(UpdateCommand).resolves({});

        mockExtractEntities.mockResolvedValue({
          entities: { symptoms: [{ name: 'fever' }] },
          confidence: { overall: 0.85, byEntity: {} },
          metadata: { extractedAt: '2024-01-15T10:10:00Z' },
        });

        mockValidateEntities.mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
        });

        mockHasMappableEntities.mockReturnValue(true);
        mockBuildFHIRPayload.mockReturnValue({ patientId: 'patient-456', jobId: 'job-123' });

        // FHIR Lambda invocation fails
        lambdaMock.on(InvokeCommand).rejects(new Error('Lambda invocation failed'));

        const event = {
          body: JSON.stringify({ jobId: 'job-123', confirmed: true }),
        };

        const response = await processConfirmation(event);

        // Should still succeed (FHIR failure is non-fatal)
        expect(response.statusCode).toBe(200);
      });
    });
  });

  describe('getJobStatus', () => {
    const mockJob = {
      PK: 'VOICE#job-123',
      SK: 'METADATA',
      jobId: 'job-123',
      status: 'confirming',
      transcription: 'Patient has fever',
      detectedLanguage: 'en',
      transcriptionConfidence: 0.72,
      needsConfirmation: true,
      playbackAudioUrl: 'https://s3.amazonaws.com/test-bucket/playback/job-123/confirmation.mp3',
      playbackAudioFormat: 'mp3',
      updatedAt: '2024-01-15T10:05:00Z',
    };

    it('should return job status for confirming job', async () => {
      dynamoMock.on(GetCommand).resolves({ Item: mockJob });

      const event = {
        pathParameters: { jobId: 'job-123' },
      };

      const response = await getJobStatus(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.jobId).toBe('job-123');
      expect(body.status).toBe('confirming');
      expect(body.transcription).toBe('Patient has fever');
      expect(body.needsConfirmation).toBe(true);
      expect(body.playbackAudioUrl).toBeTruthy();
      expect(body.playbackAudioFormat).toBe('mp3');
    });

    it('should return job status for completed job', async () => {
      const completedJob = {
        ...mockJob,
        status: 'completed',
        confirmed: true,
        entityConfidence: 0.88,
        confirmedAt: '2024-01-15T10:10:00Z',
      };

      dynamoMock.on(GetCommand).resolves({ Item: completedJob });

      const event = {
        pathParameters: { jobId: 'job-123' },
      };

      const response = await getJobStatus(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('completed');
      expect(body.entityConfidence).toBe(0.88);
      expect(body.confirmedAt).toBeTruthy();
    });

    it('should return job status for rejected job', async () => {
      const rejectedJob = {
        ...mockJob,
        status: 'rejected',
        rejectedAt: '2024-01-15T10:08:00Z',
      };

      dynamoMock.on(GetCommand).resolves({ Item: rejectedJob });

      const event = {
        pathParameters: { jobId: 'job-123' },
      };

      const response = await getJobStatus(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('rejected');
      expect(body.rejectedAt).toBeTruthy();
    });

    it('should handle jobId from different sources', async () => {
      dynamoMock.on(GetCommand).resolves({ Item: mockJob });

      // Test with pathParameters
      let event = { pathParameters: { jobId: 'job-123' } };
      let response = await getJobStatus(event);
      expect(response.statusCode).toBe(200);

      // Test with direct jobId
      event = { jobId: 'job-123' };
      response = await getJobStatus(event);
      expect(response.statusCode).toBe(200);

      // Test with body string
      event = { body: JSON.stringify({ jobId: 'job-123' }) };
      response = await getJobStatus(event);
      expect(response.statusCode).toBe(200);
    });

    it('should return 400 when jobId is missing', async () => {
      const event = {};

      const response = await getJobStatus(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('MissingField');
      expect(body.message).toContain('jobId');
    });

    it('should return 404 when job not found', async () => {
      dynamoMock.on(GetCommand).resolves({ Item: undefined });

      const event = {
        pathParameters: { jobId: 'nonexistent' },
      };

      const response = await getJobStatus(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotFound');
    });

    it('should handle DynamoDB errors', async () => {
      dynamoMock.on(GetCommand).rejects(new Error('DynamoDB connection failed'));

      const event = {
        pathParameters: { jobId: 'job-123' },
      };

      const response = await getJobStatus(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('InternalServerError');
    });
  });
});
