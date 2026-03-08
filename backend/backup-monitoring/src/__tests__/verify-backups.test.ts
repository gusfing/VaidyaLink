import { handler } from '../verify-backups';
import { BackupClient } from '@aws-sdk/client-backup';
import { SNSClient } from '@aws-sdk/client-sns';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-backup');
jest.mock('@aws-sdk/client-sns');
jest.mock('@aws-sdk/client-cloudwatch');

describe('Backup Verification Lambda', () => {
  const mockBackupClient = BackupClient as jest.MockedClass<typeof BackupClient>;
  const mockSNSClient = SNSClient as jest.MockedClass<typeof SNSClient>;
  const mockCloudWatchClient = CloudWatchClient as jest.MockedClass<typeof CloudWatchClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BACKUP_VAULT_NAME = 'test-vault';
    process.env.ALARM_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:test-topic';
    process.env.ENVIRONMENT = 'test';
  });

  describe('Healthy Backup Status', () => {
    it('should return HEALTHY status when all checks pass', async () => {
      // Mock recovery points
      mockBackupClient.prototype.send = jest.fn().mockImplementation((command) => {
        if (command.constructor.name === 'ListRecoveryPointsByBackupVaultCommand') {
          return Promise.resolve({
            RecoveryPoints: [
              {
                RecoveryPointArn: 'arn:aws:backup:us-east-1:123456789012:recovery-point:test-1',
                ResourceType: 'DynamoDB',
                CreationDate: new Date(),
                Status: 'COMPLETED',
              },
              {
                RecoveryPointArn: 'arn:aws:backup:us-east-1:123456789012:recovery-point:test-2',
                ResourceType: 'S3',
                CreationDate: new Date(),
                Status: 'COMPLETED',
              },
            ],
          });
        } else if (command.constructor.name === 'ListBackupJobsCommand') {
          return Promise.resolve({
            BackupJobs: [],
          });
        }
      });

      mockCloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});

      const result = await handler({});

      expect(result.status).toBe('HEALTHY');
      expect(result.totalRecoveryPoints).toBe(2);
      expect(result.recentBackups).toBe(2);
      expect(result.failedBackups).toBe(0);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('Warning Status', () => {
    it('should return WARNING status when backups are old', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      mockBackupClient.prototype.send = jest.fn().mockImplementation((command) => {
        if (command.constructor.name === 'ListRecoveryPointsByBackupVaultCommand') {
          return Promise.resolve({
            RecoveryPoints: [
              {
                RecoveryPointArn: 'arn:aws:backup:us-east-1:123456789012:recovery-point:test-1',
                ResourceType: 'DynamoDB',
                CreationDate: twoDaysAgo,
                Status: 'COMPLETED',
              },
            ],
          });
        } else if (command.constructor.name === 'ListBackupJobsCommand') {
          return Promise.resolve({
            BackupJobs: [],
          });
        }
      });

      mockCloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});
      mockSNSClient.prototype.send = jest.fn().mockResolvedValue({});

      const result = await handler({});

      expect(result.status).toBe('WARNING');
      expect(result.recentBackups).toBe(0);
      expect(result.issues).toContain('No backups created in the last 24 hours');
    });

    it('should return WARNING status when some backups failed', async () => {
      mockBackupClient.prototype.send = jest.fn().mockImplementation((command) => {
        if (command.constructor.name === 'ListRecoveryPointsByBackupVaultCommand') {
          return Promise.resolve({
            RecoveryPoints: [
              {
                RecoveryPointArn: 'arn:aws:backup:us-east-1:123456789012:recovery-point:test-1',
                ResourceType: 'DynamoDB',
                CreationDate: new Date(),
                Status: 'COMPLETED',
              },
            ],
          });
        } else if (command.constructor.name === 'ListBackupJobsCommand') {
          return Promise.resolve({
            BackupJobs: [
              {
                BackupJobId: 'job-1',
                State: 'FAILED',
                CreationDate: new Date(),
              },
            ],
          });
        }
      });

      mockCloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});
      mockSNSClient.prototype.send = jest.fn().mockResolvedValue({});

      const result = await handler({});

      expect(result.status).toBe('WARNING');
      expect(result.failedBackups).toBe(1);
      expect(result.issues).toContain('1 backup jobs failed in the last 7 days');
    });
  });

  describe('Critical Status', () => {
    it('should return CRITICAL status when no recovery points exist', async () => {
      mockBackupClient.prototype.send = jest.fn().mockImplementation((command) => {
        if (command.constructor.name === 'ListRecoveryPointsByBackupVaultCommand') {
          return Promise.resolve({
            RecoveryPoints: [],
          });
        } else if (command.constructor.name === 'ListBackupJobsCommand') {
          return Promise.resolve({
            BackupJobs: [],
          });
        }
      });

      mockCloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});
      mockSNSClient.prototype.send = jest.fn().mockResolvedValue({});

      const result = await handler({});

      expect(result.status).toBe('CRITICAL');
      expect(result.totalRecoveryPoints).toBe(0);
      expect(result.issues).toContain('No recovery points found in backup vault');
    });

    it('should return CRITICAL status when no recent backups', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      mockBackupClient.prototype.send = jest.fn().mockImplementation((command) => {
        if (command.constructor.name === 'ListRecoveryPointsByBackupVaultCommand') {
          return Promise.resolve({
            RecoveryPoints: [
              {
                RecoveryPointArn: 'arn:aws:backup:us-east-1:123456789012:recovery-point:test-1',
                ResourceType: 'DynamoDB',
                CreationDate: threeDaysAgo,
                Status: 'COMPLETED',
              },
            ],
          });
        } else if (command.constructor.name === 'ListBackupJobsCommand') {
          return Promise.resolve({
            BackupJobs: [],
          });
        }
      });

      mockCloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});
      mockSNSClient.prototype.send = jest.fn().mockResolvedValue({});

      const result = await handler({});

      expect(result.status).toBe('CRITICAL');
      expect(result.recentBackups).toBe(0);
    });
  });

  describe('Resource Type Coverage', () => {
    it('should detect missing resource types', async () => {
      mockBackupClient.prototype.send = jest.fn().mockImplementation((command) => {
        if (command.constructor.name === 'ListRecoveryPointsByBackupVaultCommand') {
          return Promise.resolve({
            RecoveryPoints: [
              {
                RecoveryPointArn: 'arn:aws:backup:us-east-1:123456789012:recovery-point:test-1',
                ResourceType: 'DynamoDB',
                CreationDate: new Date(),
                Status: 'COMPLETED',
              },
            ],
          });
        } else if (command.constructor.name === 'ListBackupJobsCommand') {
          return Promise.resolve({
            BackupJobs: [],
          });
        }
      });

      mockCloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});
      mockSNSClient.prototype.send = jest.fn().mockResolvedValue({});

      const result = await handler({});

      expect(result.status).toBe('WARNING');
      expect(result.issues).toContain('No backups found for resource type: S3');
    });
  });

  describe('Metrics Publishing', () => {
    it('should publish CloudWatch metrics', async () => {
      mockBackupClient.prototype.send = jest.fn().mockImplementation((command) => {
        if (command.constructor.name === 'ListRecoveryPointsByBackupVaultCommand') {
          return Promise.resolve({
            RecoveryPoints: [
              {
                RecoveryPointArn: 'arn:aws:backup:us-east-1:123456789012:recovery-point:test-1',
                ResourceType: 'DynamoDB',
                CreationDate: new Date(),
                Status: 'COMPLETED',
              },
            ],
          });
        } else if (command.constructor.name === 'ListBackupJobsCommand') {
          return Promise.resolve({
            BackupJobs: [],
          });
        }
      });

      const mockPutMetricData = jest.fn().mockResolvedValue({});
      mockCloudWatchClient.prototype.send = mockPutMetricData;

      await handler({});

      expect(mockPutMetricData).toHaveBeenCalled();
      const metricCall = mockPutMetricData.mock.calls[0][0];
      expect(metricCall.input.Namespace).toBe('VaidyaLink/Backup');
      expect(metricCall.input.MetricData).toHaveLength(4);
    });
  });

  describe('Alert Notifications', () => {
    it('should send SNS alert for WARNING status', async () => {
      mockBackupClient.prototype.send = jest.fn().mockImplementation((command) => {
        if (command.constructor.name === 'ListRecoveryPointsByBackupVaultCommand') {
          return Promise.resolve({
            RecoveryPoints: [
              {
                RecoveryPointArn: 'arn:aws:backup:us-east-1:123456789012:recovery-point:test-1',
                ResourceType: 'DynamoDB',
                CreationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                Status: 'COMPLETED',
              },
            ],
          });
        } else if (command.constructor.name === 'ListBackupJobsCommand') {
          return Promise.resolve({
            BackupJobs: [],
          });
        }
      });

      mockCloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});
      const mockPublish = jest.fn().mockResolvedValue({});
      mockSNSClient.prototype.send = mockPublish;

      await handler({});

      expect(mockPublish).toHaveBeenCalled();
      const publishCall = mockPublish.mock.calls[0][0];
      expect(publishCall.input.TopicArn).toBe(process.env.ALARM_TOPIC_ARN);
      expect(publishCall.input.Subject).toContain('[WARNING]');
    });

    it('should not send alert for HEALTHY status', async () => {
      mockBackupClient.prototype.send = jest.fn().mockImplementation((command) => {
        if (command.constructor.name === 'ListRecoveryPointsByBackupVaultCommand') {
          return Promise.resolve({
            RecoveryPoints: [
              {
                RecoveryPointArn: 'arn:aws:backup:us-east-1:123456789012:recovery-point:test-1',
                ResourceType: 'DynamoDB',
                CreationDate: new Date(),
                Status: 'COMPLETED',
              },
              {
                RecoveryPointArn: 'arn:aws:backup:us-east-1:123456789012:recovery-point:test-2',
                ResourceType: 'S3',
                CreationDate: new Date(),
                Status: 'COMPLETED',
              },
            ],
          });
        } else if (command.constructor.name === 'ListBackupJobsCommand') {
          return Promise.resolve({
            BackupJobs: [],
          });
        }
      });

      mockCloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});
      const mockPublish = jest.fn().mockResolvedValue({});
      mockSNSClient.prototype.send = mockPublish;

      await handler({});

      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle AWS API errors gracefully', async () => {
      mockBackupClient.prototype.send = jest.fn().mockRejectedValue(new Error('AWS API Error'));
      mockCloudWatchClient.prototype.send = jest.fn().mockResolvedValue({});
      mockSNSClient.prototype.send = jest.fn().mockResolvedValue({});

      await expect(handler({})).rejects.toThrow('AWS API Error');
      expect(mockSNSClient.prototype.send).toHaveBeenCalled();
    });
  });
});
