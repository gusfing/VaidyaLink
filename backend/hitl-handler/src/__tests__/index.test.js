/**
 * Tests for HITL Handler Lambda
 */

const { handler, processVerification } = require('../index');

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-sqs');
jest.mock('@aws-sdk/client-lambda');

const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { S3Client } = require('@aws-sdk/client-s3');
const { SQSClient } = require('@aws-sdk/client-sqs');
const { LambdaClient } = require('@aws-sdk/client-lambda');

describe('HITL Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set environment variables
    process.env.SCANJOBS_TABLE = 'test-scanjobs-table';
    process.env.DOCUMENTS_BUCKET = 'test-documents-bucket';
    process.env.FHIR_TRANSFORMER_LAMBDA_ARN =
      'arn:aws:lambda:us-east-1:123456789012:function:fhir-transformer';
  });

  describe('handler', () => {
    it('should process HITL queue messages successfully', async () => {
      // Mock DynamoDB response
      DynamoDBDocumentClient.prototype.send = jest
        .fn()
        .mockResolvedValueOnce({
          Item: {
            PK: 'JOB#test-job-123',
            SK: 'METADATA',
            jobId: 'test-job-123',
            patientId: 'patient-456',
            imageS3Key: 'raw/patient-456/test-job-123/original.jpg',
            status: 'processing',
          },
        })
        .mockResolvedValueOnce({}); // UpdateCommand

      // Mock S3 response
      S3Client.prototype.send = jest.fn().mockResolvedValue({});

      // Mock SQS response
      SQSClient.prototype.send = jest.fn().mockResolvedValue({});

      const event = {
        Records: [
          {
            messageId: 'msg-123',
            receiptHandle: 'receipt-handle-123',
            body: JSON.stringify({
              jobId: 'test-job-123',
              structuredData: {
                patient_name: 'John Doe',
                medications: [{ name: 'Aspirin', dosage: '100mg' }],
              },
              confidenceScores: {
                overall: 0.75,
                patient_name: 0.7,
                medications: 0.8,
              },
              routedAt: '2024-01-15T10:00:00Z',
            }),
            eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:queue/hitl-queue',
          },
        ],
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).results).toHaveLength(1);
      expect(JSON.parse(result.body).results[0].status).toBe('queued_for_verification');
    });

    it('should handle errors gracefully', async () => {
      // Mock DynamoDB error
      DynamoDBDocumentClient.prototype.send = jest
        .fn()
        .mockRejectedValue(new Error('DynamoDB error'));

      const event = {
        Records: [
          {
            messageId: 'msg-123',
            receiptHandle: 'receipt-handle-123',
            body: JSON.stringify({
              jobId: 'test-job-123',
              structuredData: {},
              confidenceScores: {},
              routedAt: '2024-01-15T10:00:00Z',
            }),
            eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:queue/hitl-queue',
          },
        ],
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).results[0].status).toBe('failed');
    });
  });

  describe('processVerification', () => {
    it('should process verification result successfully', async () => {
      // Mock DynamoDB response
      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({});

      // Mock S3 response
      S3Client.prototype.send = jest.fn().mockResolvedValue({});

      // Mock Lambda response
      LambdaClient.prototype.send = jest.fn().mockResolvedValue({});

      const event = {
        body: JSON.stringify({
          jobId: 'test-job-123',
          correctedData: {
            patient_name: 'John Doe (Corrected)',
            medications: [{ name: 'Aspirin', dosage: '100mg' }],
          },
          verifiedBy: 'verifier@example.com',
          notes: 'Corrected patient name spelling',
        }),
      };

      const result = await processVerification(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).message).toBe('Verification processed successfully');
    });

    it('should return 400 for missing required fields', async () => {
      const event = {
        body: JSON.stringify({
          jobId: 'test-job-123',
          // Missing correctedData
        }),
      };

      const result = await processVerification(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('Missing required fields');
    });

    it('should handle errors during verification processing', async () => {
      // Mock S3 error
      S3Client.prototype.send = jest.fn().mockRejectedValue(new Error('S3 error'));

      const event = {
        body: JSON.stringify({
          jobId: 'test-job-123',
          correctedData: {
            patient_name: 'John Doe',
          },
          verifiedBy: 'verifier@example.com',
        }),
      };

      const result = await processVerification(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toBe('S3 error');
    });
  });
});
