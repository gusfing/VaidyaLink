/**
 * Tests for DynamoDB Query Helpers
 */

const {
  getPatientScans,
  getScansByStatus,
  getHITLQueue,
  getPatientByABHA,
  getScanJob,
  getBatchScanJobs,
} = require('../query-helpers');

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

const {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  BatchGetCommand,
} = require('@aws-sdk/lib-dynamodb');

describe('DynamoDB Query Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENVIRONMENT = 'test';
  });

  describe('getPatientScans', () => {
    it('should query patient scans using PatientIndex', async () => {
      const mockItems = [
        { jobId: 'job-1', patientId: 'patient-123', status: 'completed' },
        { jobId: 'job-2', patientId: 'patient-123', status: 'completed' },
      ];

      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Items: mockItems,
        Count: 2,
      });

      const result = await getPatientScans('patient-123');

      expect(result.items).toEqual(mockItems);
      expect(result.count).toBe(2);
      expect(DynamoDBDocumentClient.prototype.send).toHaveBeenCalledWith(expect.any(QueryCommand));
    });

    it('should support date range filtering', async () => {
      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Items: [],
        Count: 0,
      });

      await getPatientScans('patient-123', {
        startDate: '2024-01-01T00:00:00Z',
      });

      const call = DynamoDBDocumentClient.prototype.send.mock.calls[0][0];
      expect(call.input.KeyConditionExpression).toContain('createdAt >= :startDate');
    });

    it('should support pagination', async () => {
      const lastKey = { PK: 'JOB#job-1', SK: 'METADATA' };

      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Items: [],
        LastEvaluatedKey: lastKey,
      });

      const result = await getPatientScans('patient-123', {
        lastEvaluatedKey: lastKey,
      });

      expect(result.lastEvaluatedKey).toEqual(lastKey);
    });
  });

  describe('getScansByStatus', () => {
    it('should query scans by status using StatusIndex', async () => {
      const mockItems = [
        { jobId: 'job-1', status: 'hitl_required' },
        { jobId: 'job-2', status: 'hitl_required' },
      ];

      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Items: mockItems,
        Count: 2,
      });

      const result = await getScansByStatus('hitl_required');

      expect(result.items).toEqual(mockItems);
      expect(result.count).toBe(2);
    });

    it('should use FIFO ordering by default', async () => {
      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Items: [],
      });

      await getScansByStatus('pending');

      const call = DynamoDBDocumentClient.prototype.send.mock.calls[0][0];
      expect(call.input.ScanIndexForward).toBe(true);
    });
  });

  describe('getHITLQueue', () => {
    it('should return jobs requiring HITL verification', async () => {
      const mockItems = [
        { jobId: 'job-1', status: 'hitl_required', confidenceScores: { field1: 0.75 } },
      ];

      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Items: mockItems,
      });

      const result = await getHITLQueue();

      expect(result).toEqual(mockItems);
    });
  });

  describe('getPatientByABHA', () => {
    it('should find patient by ABHA ID using ABHAIndex', async () => {
      const mockPatient = {
        patientId: 'patient-123',
        abhaId: '12-3456-7890-1234',
        name: 'Test Patient',
      };

      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Items: [mockPatient],
      });

      const result = await getPatientByABHA('12-3456-7890-1234');

      expect(result).toEqual(mockPatient);
    });

    it('should return null if patient not found', async () => {
      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Items: [],
      });

      const result = await getPatientByABHA('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getScanJob', () => {
    it('should get scan job by ID using primary key', async () => {
      const mockJob = {
        PK: 'JOB#job-123',
        SK: 'METADATA',
        jobId: 'job-123',
        status: 'completed',
      };

      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Item: mockJob,
      });

      const result = await getScanJob('job-123');

      expect(result).toEqual(mockJob);
      expect(DynamoDBDocumentClient.prototype.send).toHaveBeenCalledWith(expect.any(GetCommand));
    });
  });

  describe('getBatchScanJobs', () => {
    it('should get multiple jobs using BatchGetItem', async () => {
      const mockJobs = [
        { jobId: 'job-1', status: 'completed' },
        { jobId: 'job-2', status: 'completed' },
      ];

      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Responses: {
          'vaidyalink-scanjobs-test': mockJobs,
        },
      });

      const result = await getBatchScanJobs(['job-1', 'job-2']);

      expect(result).toEqual(mockJobs);
      expect(DynamoDBDocumentClient.prototype.send).toHaveBeenCalledWith(
        expect.any(BatchGetCommand)
      );
    });

    it('should throw error if more than 25 job IDs provided', async () => {
      const jobIds = Array.from({ length: 26 }, (_, i) => `job-${i}`);

      await expect(getBatchScanJobs(jobIds)).rejects.toThrow(
        'BatchGetItem supports maximum 25 items'
      );
    });

    it('should return empty array for empty input', async () => {
      const result = await getBatchScanJobs([]);
      expect(result).toEqual([]);
    });
  });
});
