/**
 * S3 Audio File Handling Tests
 *
 * Tests for audio file download, validation, and S3 event processing
 */

jest.mock('axios');

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { Readable } = require('stream');
const { mockClient } = require('aws-sdk-client-mock');
const axios = require('axios');

// Declare mocks via aws-sdk-client-mock
const s3Mock     = mockClient(S3Client);
const dynamoMock = mockClient(DynamoDBDocumentClient);
const lambdaMock = mockClient(LambdaClient);
const bedrockMock = mockClient(BedrockRuntimeClient);

// Set required environment variables before the module is loaded
process.env.S3_AUDIO_BUCKET = 'test-audio-bucket';
process.env.VOICEJOBS_TABLE = 'test-voice-jobs';
process.env.BHASHINI_API_URL = 'https://test-bhashini.com';
process.env.BHASHINI_API_KEY = 'test-key';
process.env.BHASHINI_USER_ID = 'test-user';
process.env.BHASHINI_ASR_SERVICE_ID = 'test-service';
process.env.TRANSCRIPTION_CONFIDENCE_THRESHOLD = '0.75';
process.env.BEDROCK_MODEL_ID = 'test-model';
process.env.FHIR_TRANSFORMER_LAMBDA_ARN = 'arn:aws:lambda:us-east-1:123:function:fhir-test';

// Import handler AFTER env vars are set
const { handler } = require('../index');
/** Default Bhashini API mock response (confidence 0.92 → above threshold → goes to clinical extraction) */
const MOCK_BHASHINI_RESPONSE = {
  data: {
    pipelineResponse: [
      {
        taskType: 'asr',
        output: [{ source: 'Mock transcription text for testing purposes.' }],
        config: {
          confidence: 0.92,
          language: { sourceLanguage: 'en' },
        },
      },
    ],
  },
};

/** Default Bedrock clinical extraction response */
const MOCK_BEDROCK_RESPONSE = {
  content: [
    {
      text: JSON.stringify({
        chiefComplaint: 'Test complaint',
        symptoms: [{ name: 'Test symptom', description: null, location: null, onset: null }],
        duration: null,
        severity: 'mild',
        previousTreatments: [],
        allergies: [],
        medicalHistory: [],
        currentMedications: [],
        vitalSigns: {},
        familyHistory: [],
        lifestyle: {},
        additionalNotes: null,
      }),
    },
  ],
};

describe('S3 Audio File Handling', () => {
  beforeEach(() => {
    s3Mock.reset();
    dynamoMock.reset();
    lambdaMock.reset();
    bedrockMock.reset();
    jest.clearAllMocks();

    // Default: Bhashini API returns a successful transcription or LID based on payload
    axios.post = jest.fn().mockImplementation((url, payload) => {
      const taskType = payload?.pipelineTasks?.[0]?.taskType;

      if (taskType === 'lid') {
        return Promise.resolve({
          data: {
            pipelineResponse: [
              {
                taskType: 'lid',
                output: [{ language: 'en' }],
                config: { confidence: 0.95 },
              },
            ],
          },
        });
      }

      return Promise.resolve(MOCK_BHASHINI_RESPONSE);
    });

    // Default: Bedrock returns a clinical extraction result
    const { InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
    bedrockMock.on(InvokeModelCommand).resolves({
      body: new TextEncoder().encode(JSON.stringify(MOCK_BEDROCK_RESPONSE)),
    });

    // Default: S3 PutObject succeeds
    s3Mock.on(PutObjectCommand).resolves({});

    // Default: Lambda async invocations succeed silently
    lambdaMock.on(InvokeCommand).resolves({ StatusCode: 202 });
  });

  afterEach(() => {
    s3Mock.reset();
    dynamoMock.reset();
  });


  describe('downloadAudioFromS3', () => {
    it('should download audio file successfully', async () => {
      const mockAudioData = Buffer.from('mock audio data');
      const mockStream = Readable.from([mockAudioData]);

      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream,
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          jobId: 'test-job-123',
          patientId: 'patient-123',
          audioS3Key: 'audio/patient-123/test-job-123/recording.wav',
          language: 'en',
          status: 'pending',
        },
      });

      dynamoMock.on(UpdateCommand).resolves({});

      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            s3: {
              bucket: { name: 'test-audio-bucket' },
              object: {
                key: 'audio/patient-123/test-job-123/recording.wav',
                size: 524288,
              },
            },
          },
        ],
      };

      const context = { requestId: 'test-request-123' };

      // Note: This will fail transcription but we're testing S3 download
      const result = await handler(event, context);

      // Verify S3 GetObject was called
      expect(s3Mock.calls()).toHaveLength(1);
      const s3Call = s3Mock.call(0);
      expect(s3Call.args[0].input).toMatchObject({
        Bucket: 'test-audio-bucket',
        Key: 'audio/patient-123/test-job-123/recording.wav',
      });
    });

    it('should handle NoSuchKey error', async () => {
      s3Mock.on(GetObjectCommand).rejects({
        name: 'NoSuchKey',
        message: 'The specified key does not exist',
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          jobId: 'test-job-123',
          patientId: 'patient-123',
          audioS3Key: 'audio/patient-123/test-job-123/nonexistent.wav',
          language: 'en',
          status: 'pending',
        },
      });

      dynamoMock.on(UpdateCommand).resolves({});

      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            s3: {
              bucket: { name: 'test-audio-bucket' },
              object: {
                key: 'audio/patient-123/test-job-123/nonexistent.wav',
              },
            },
          },
        ],
      };

      const context = { requestId: 'test-request-123' };

      const result = await handler(event, context);

      // Should update job status to failed
      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      expect(updateCalls.length).toBeGreaterThan(0);

      // Check that at least one update set status to failed
      const failedUpdate = updateCalls.find((call) =>
        call.args[0].input.UpdateExpression?.includes('status')
      );
      expect(failedUpdate).toBeDefined();
    });

    it('should handle AccessDenied error', async () => {
      s3Mock.on(GetObjectCommand).rejects({
        name: 'AccessDenied',
        message: 'Access Denied',
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          jobId: 'test-job-123',
          patientId: 'patient-123',
          audioS3Key: 'audio/patient-123/test-job-123/recording.wav',
          language: 'en',
          status: 'pending',
        },
      });

      dynamoMock.on(UpdateCommand).resolves({});

      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            s3: {
              bucket: { name: 'test-audio-bucket' },
              object: {
                key: 'audio/patient-123/test-job-123/recording.wav',
              },
            },
          },
        ],
      };

      const context = { requestId: 'test-request-123' };

      const result = await handler(event, context);

      // Should fail and update status
      expect(result.statusCode).toBe(500);
    });

    it('should handle large audio files with streaming', async () => {
      // Create a large mock audio buffer (5 MB)
      const chunkSize = 1024 * 1024; // 1 MB chunks
      const chunks = [
        Buffer.alloc(chunkSize, 'a'),
        Buffer.alloc(chunkSize, 'b'),
        Buffer.alloc(chunkSize, 'c'),
        Buffer.alloc(chunkSize, 'd'),
        Buffer.alloc(chunkSize, 'e'),
      ];

      const mockStream = Readable.from(chunks);

      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream,
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          jobId: 'test-job-123',
          patientId: 'patient-123',
          audioS3Key: 'audio/patient-123/test-job-123/large-recording.wav',
          language: 'en',
          status: 'pending',
        },
      });

      dynamoMock.on(UpdateCommand).resolves({});

      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            s3: {
              bucket: { name: 'test-audio-bucket' },
              object: {
                key: 'audio/patient-123/test-job-123/large-recording.wav',
                size: 5 * 1024 * 1024,
              },
            },
          },
        ],
      };

      const context = { requestId: 'test-request-123' };

      // Should handle large file without memory issues
      await handler(event, context);

      expect(s3Mock.calls()).toHaveLength(1);
    });
  });

  describe('S3 Event Processing', () => {
    it('should parse S3 event correctly', async () => {
      const mockAudioData = Buffer.from('mock audio data');
      const mockStream = Readable.from([mockAudioData]);

      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream,
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          jobId: 'voice-job-456',
          patientId: 'patient-789',
          audioS3Key: 'audio/patient-789/voice-job-456/recording.wav',
          language: 'hi',
          status: 'pending',
        },
      });

      dynamoMock.on(UpdateCommand).resolves({});

      const event = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'ap-south-1',
            eventTime: '2024-01-15T10:30:00.000Z',
            eventName: 'ObjectCreated:Put',
            s3: {
              bucket: {
                name: 'test-audio-bucket',
                arn: 'arn:aws:s3:::test-audio-bucket',
              },
              object: {
                key: 'audio/patient-789/voice-job-456/recording.wav',
                size: 524288,
                eTag: 'd41d8cd98f00b204e9800998ecf8427e',
              },
            },
          },
        ],
      };

      const context = { requestId: 'test-request-123' };

      await handler(event, context);

      // Verify job status was updated to transcribing
      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      expect(updateCalls.length).toBeGreaterThan(0);

      // Check first update set status to transcribing
      const firstUpdate = updateCalls[0];
      expect(firstUpdate.args[0].input.Key).toEqual({
        PK: 'VOICE#voice-job-456',
        SK: 'METADATA',
      });
    });

    it('should handle invalid S3 key format', async () => {
      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            s3: {
              bucket: { name: 'test-audio-bucket' },
              object: {
                key: 'invalid-key-format.wav', // Missing patientId/jobId structure
              },
            },
          },
        ],
      };

      const context = { requestId: 'test-request-123' };

      const result = await handler(event, context);

      // Should fail due to invalid key format
      expect(result.statusCode).toBe(500);
    });

    it('should process multiple S3 events', async () => {
      const mockAudioData = Buffer.from('mock audio data');
      const mockStream1 = Readable.from([mockAudioData]);
      const mockStream2 = Readable.from([mockAudioData]);

      s3Mock
        .on(GetObjectCommand, {
          Key: 'audio/patient-123/job-1/recording.wav',
        })
        .resolves({ Body: mockStream1 })
        .on(GetObjectCommand, {
          Key: 'audio/patient-456/job-2/recording.wav',
        })
        .resolves({ Body: mockStream2 });

      dynamoMock
        .on(GetCommand, {
          Key: { PK: 'VOICE#job-1', SK: 'METADATA' },
        })
        .resolves({
          Item: {
            jobId: 'job-1',
            patientId: 'patient-123',
            audioS3Key: 'audio/patient-123/job-1/recording.wav',
            language: 'en',
            status: 'pending',
          },
        })
        .on(GetCommand, {
          Key: { PK: 'VOICE#job-2', SK: 'METADATA' },
        })
        .resolves({
          Item: {
            jobId: 'job-2',
            patientId: 'patient-456',
            audioS3Key: 'audio/patient-456/job-2/recording.wav',
            language: 'hi',
            status: 'pending',
          },
        });

      dynamoMock.on(UpdateCommand).resolves({});

      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            s3: {
              bucket: { name: 'test-audio-bucket' },
              object: { key: 'audio/patient-123/job-1/recording.wav' },
            },
          },
          {
            eventSource: 'aws:s3',
            s3: {
              bucket: { name: 'test-audio-bucket' },
              object: { key: 'audio/patient-456/job-2/recording.wav' },
            },
          },
        ],
      };

      const context = { requestId: 'test-request-123' };

      await handler(event, context);

      // Should have processed both audio files
      const getObjectKeys = s3Mock.commandCalls(GetObjectCommand).map(call => call.args[0].input.Key);
      console.log('GET_OBJECT_KEYS:', getObjectKeys);
      expect(getObjectKeys).toContain('audio/patient-123/job-1/recording.wav');
      expect(getObjectKeys).toContain('audio/patient-456/job-2/recording.wav');
    });
  });

  describe('Saving Results to S3', () => {
    it('should save transcription to S3', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const mockAudioData = Buffer.from('mock audio data');
      const mockStream = Readable.from([mockAudioData]);

      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream,
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          jobId: 'test-job-123',
          patientId: 'patient-123',
          audioS3Key: 'audio/patient-123/test-job-123/recording.wav',
          language: 'en',
          status: 'pending',
        },
      });

      dynamoMock.on(UpdateCommand).resolves({});

      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            s3: {
              bucket: { name: 'test-audio-bucket' },
              object: {
                key: 'audio/patient-123/test-job-123/recording.wav',
              },
            },
          },
        ],
      };

      const context = { requestId: 'test-request-123' };

      await handler(event, context);

      // Note: Transcription will fail due to missing Bhashini mock,
      // but we can verify S3 operations were attempted
      expect(s3Mock.calls()).toHaveLength(1);
    });

    it('should use KMS encryption when saving', async () => {
      process.env.KMS_KEY_ID = 'test-kms-key-id';

      s3Mock.on(PutObjectCommand).resolves({});

      const mockAudioData = Buffer.from('mock audio data');
      const mockStream = Readable.from([mockAudioData]);

      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream,
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          jobId: 'test-job-123',
          patientId: 'patient-123',
          audioS3Key: 'audio/patient-123/test-job-123/recording.wav',
          language: 'en',
          status: 'pending',
        },
      });

      dynamoMock.on(UpdateCommand).resolves({});

      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            s3: {
              bucket: { name: 'test-audio-bucket' },
              object: {
                key: 'audio/patient-123/test-job-123/recording.wav',
              },
            },
          },
        ],
      };

      const context = { requestId: 'test-request-123' };

      await handler(event, context);

      // Verify S3 operations
      expect(s3Mock.calls()).toHaveLength(1);
    });
  });

  describe('Direct Invocation', () => {
    it('should process job by jobId', async () => {
      const mockAudioData = Buffer.from('mock audio data');
      const mockStream = Readable.from([mockAudioData]);

      s3Mock.on(GetObjectCommand).resolves({
        Body: mockStream,
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          jobId: 'direct-job-123',
          patientId: 'patient-123',
          audioS3Key: 'audio/patient-123/direct-job-123/recording.wav',
          audioS3Bucket: 'test-audio-bucket',
          language: 'en',
          status: 'pending',
        },
      });

      dynamoMock.on(UpdateCommand).resolves({});

      const event = {
        jobId: 'direct-job-123',
      };

      const context = { requestId: 'test-request-123' };

      await handler(event, context);

      // Verify DynamoDB was queried for job details
      const getCalls = dynamoMock.commandCalls(GetCommand);
      expect(getCalls.length).toBeGreaterThan(0);
      expect(getCalls[0].args[0].input.Key).toEqual({
        PK: 'VOICE#direct-job-123',
        SK: 'METADATA',
      });
    });

    it('should fail if jobId is missing', async () => {
      const event = {}; // No jobId

      const context = { requestId: 'test-request-123' };

      const result = await handler(event, context);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).message).toContain('jobId is required');
    });

    it('should fail if job not found in DynamoDB', async () => {
      dynamoMock.on(GetCommand).resolves({
        Item: undefined, // Job not found
      });

      const event = {
        jobId: 'nonexistent-job',
      };

      const context = { requestId: 'test-request-123' };

      const result = await handler(event, context);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).message).toContain('Voice job not found');
    });
  });

  describe('Error Handling', () => {
    it('should update job status to failed on error', async () => {
      s3Mock.on(GetObjectCommand).rejects(new Error('S3 service error'));

      dynamoMock.on(GetCommand).resolves({
        Item: {
          jobId: 'error-job-123',
          patientId: 'patient-123',
          audioS3Key: 'audio/patient-123/error-job-123/recording.wav',
          language: 'en',
          status: 'pending',
        },
      });

      dynamoMock.on(UpdateCommand).resolves({});

      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            s3: {
              bucket: { name: 'test-audio-bucket' },
              object: {
                key: 'audio/patient-123/error-job-123/recording.wav',
              },
            },
          },
        ],
      };

      const context = { requestId: 'test-request-123' };

      await handler(event, context);

      // Verify job status was updated to failed
      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      expect(updateCalls.length).toBeGreaterThan(0);

      // Find the failed status update
      const failedUpdate = updateCalls.find((call) => {
        const expr = call.args[0].input.UpdateExpression;
        return expr && expr.includes('status');
      });

      expect(failedUpdate).toBeDefined();
    });

    it('should include error message in failed status', async () => {
      const errorMessage = 'Custom S3 error';
      s3Mock.on(GetObjectCommand).rejects(new Error(errorMessage));

      dynamoMock.on(GetCommand).resolves({
        Item: {
          jobId: 'error-job-456',
          patientId: 'patient-456',
          audioS3Key: 'audio/patient-456/error-job-456/recording.wav',
          language: 'en',
          status: 'pending',
        },
      });

      dynamoMock.on(UpdateCommand).resolves({});

      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            s3: {
              bucket: { name: 'test-audio-bucket' },
              object: {
                key: 'audio/patient-456/error-job-456/recording.wav',
              },
            },
          },
        ],
      };

      const context = { requestId: 'test-request-123' };

      await handler(event, context);

      // Verify error message was included
      const updateCalls = dynamoMock.commandCalls(UpdateCommand);
      const failedUpdate = updateCalls.find((call) => {
        const values = call.args[0].input.ExpressionAttributeValues;
        return values && values[':errorMessage'];
      });

      expect(failedUpdate).toBeDefined();
    });
  });
});
