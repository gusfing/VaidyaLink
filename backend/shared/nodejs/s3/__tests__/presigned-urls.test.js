/**
 * Unit tests for S3 pre-signed URL generation utilities.
 */

const { S3PresignedURLGenerator } = require('../presigned-urls');
const { mockClient } = require('aws-sdk-client-mock');
const {
  S3Client,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require('@aws-sdk/client-s3');

// Mock the S3 client
const s3Mock = mockClient(S3Client);

// Mock the presigned URL functions
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: jest.fn(),
}));

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');

describe('S3PresignedURLGenerator', () => {
  let generator;

  beforeEach(() => {
    s3Mock.reset();
    jest.clearAllMocks();

    generator = new S3PresignedURLGenerator({
      bucketName: 'test-bucket',
      region: 'ap-south-1',
      kmsKeyId: 'test-kms-key-id',
    });
  });

  describe('Initialization', () => {
    test('should initialize with provided configuration', () => {
      expect(generator.bucketName).toBe('test-bucket');
      expect(generator.region).toBe('ap-south-1');
      expect(generator.kmsKeyId).toBe('test-kms-key-id');
    });

    test('should use environment variables for defaults', () => {
      process.env.AWS_REGION = 'us-east-1';
      process.env.S3_KMS_KEY_ID = 'env-key';

      const gen = new S3PresignedURLGenerator({ bucketName: 'test-bucket' });

      expect(gen.region).toBe('us-east-1');
      expect(gen.kmsKeyId).toBe('env-key');

      delete process.env.AWS_REGION;
      delete process.env.S3_KMS_KEY_ID;
    });
  });

  describe('generateUploadUrl', () => {
    test('should generate upload URL successfully', async () => {
      const mockResponse = {
        url: 'https://test-bucket.s3.amazonaws.com/',
        fields: {
          key: 'test.jpg',
          'Content-Type': 'image/jpeg',
        },
      };

      createPresignedPost.mockResolvedValue(mockResponse);

      const result = await generator.generateUploadUrl({
        key: 'test.jpg',
        contentType: 'image/jpeg',
        maxFileSize: 5 * 1024 * 1024,
      });

      expect(result.url).toBe('https://test-bucket.s3.amazonaws.com/');
      expect(result.key).toBe('test.jpg');
      expect(result.max_file_size).toBe(5 * 1024 * 1024);
      expect(result.expires_at).toBeDefined();
      expect(result.fields).toBeDefined();
    });

    test('should reject invalid content type', async () => {
      await expect(
        generator.generateUploadUrl({
          key: 'test.txt',
          contentType: 'text/plain',
        })
      ).rejects.toThrow('not allowed');
    });

    test('should allow invalid content type when validation is disabled', async () => {
      const mockResponse = {
        url: 'https://test-bucket.s3.amazonaws.com/',
        fields: { key: 'test.txt' },
      };

      createPresignedPost.mockResolvedValue(mockResponse);

      const result = await generator.generateUploadUrl({
        key: 'test.txt',
        contentType: 'text/plain',
        validateContentType: false,
      });

      expect(result.url).toBe('https://test-bucket.s3.amazonaws.com/');
    });

    test('should include custom metadata', async () => {
      const mockResponse = {
        url: 'https://test-bucket.s3.amazonaws.com/',
        fields: { key: 'test.jpg' },
      };

      createPresignedPost.mockResolvedValue(mockResponse);

      const metadata = {
        'patient-id': 'patient-123',
        'scan-type': 'prescription',
      };

      await generator.generateUploadUrl({
        key: 'test.jpg',
        contentType: 'image/jpeg',
        metadata,
      });

      expect(createPresignedPost).toHaveBeenCalled();
      const callArgs = createPresignedPost.mock.calls[0][1];
      expect(callArgs.Fields['x-amz-meta-patient-id']).toBe('patient-123');
      expect(callArgs.Fields['x-amz-meta-scan-type']).toBe('prescription');
    });

    test('should include KMS encryption parameters', async () => {
      const mockResponse = {
        url: 'https://test-bucket.s3.amazonaws.com/',
        fields: { key: 'test.jpg' },
      };

      createPresignedPost.mockResolvedValue(mockResponse);

      await generator.generateUploadUrl({
        key: 'test.jpg',
        contentType: 'image/jpeg',
      });

      const callArgs = createPresignedPost.mock.calls[0][1];
      expect(callArgs.Fields['x-amz-server-side-encryption']).toBe('aws:kms');
      expect(callArgs.Fields['x-amz-server-side-encryption-aws-kms-key-id']).toBe(
        'test-kms-key-id'
      );
    });

    test('should use default max file size', async () => {
      const mockResponse = {
        url: 'https://test-bucket.s3.amazonaws.com/',
        fields: { key: 'test.jpg' },
      };

      createPresignedPost.mockResolvedValue(mockResponse);

      const result = await generator.generateUploadUrl({
        key: 'test.jpg',
        contentType: 'image/jpeg',
      });

      expect(result.max_file_size).toBe(S3PresignedURLGenerator.DEFAULT_MAX_FILE_SIZE);
    });
  });

  describe('generateDownloadUrl', () => {
    test('should generate download URL successfully', async () => {
      const mockUrl = 'https://test-bucket.s3.amazonaws.com/test.jpg?signature=xyz';
      getSignedUrl.mockResolvedValue(mockUrl);

      const result = await generator.generateDownloadUrl({
        key: 'test.jpg',
      });

      expect(result.url).toBe(mockUrl);
      expect(result.key).toBe('test.jpg');
      expect(result.expires_at).toBeDefined();
    });

    test('should include custom response headers', async () => {
      const mockUrl = 'https://test-bucket.s3.amazonaws.com/test.jpg';
      getSignedUrl.mockResolvedValue(mockUrl);

      await generator.generateDownloadUrl({
        key: 'test.jpg',
        responseContentType: 'application/octet-stream',
        responseContentDisposition: 'attachment; filename="download.jpg"',
      });

      expect(getSignedUrl).toHaveBeenCalled();
      const command = getSignedUrl.mock.calls[0][1];
      expect(command.input.ResponseContentType).toBe('application/octet-stream');
      expect(command.input.ResponseContentDisposition).toBe('attachment; filename="download.jpg"');
    });

    test('should use custom expiration', async () => {
      const mockUrl = 'https://test-bucket.s3.amazonaws.com/test.jpg';
      getSignedUrl.mockResolvedValue(mockUrl);

      await generator.generateDownloadUrl({
        key: 'test.jpg',
        expiration: 600,
      });

      const options = getSignedUrl.mock.calls[0][2];
      expect(options.expiresIn).toBe(600);
    });
  });

  describe('generateMultipartUploadUrls', () => {
    test('should generate multipart upload URLs successfully', async () => {
      s3Mock.on(CreateMultipartUploadCommand).resolves({
        UploadId: 'test-upload-id',
      });

      getSignedUrl.mockResolvedValue('https://test-bucket.s3.amazonaws.com/part');

      const result = await generator.generateMultipartUploadUrls({
        key: 'large-file.jpg',
        contentType: 'image/jpeg',
        numParts: 3,
      });

      expect(result.upload_id).toBe('test-upload-id');
      expect(result.key).toBe('large-file.jpg');
      expect(result.part_urls).toHaveLength(3);
      expect(result.part_urls[0].part_number).toBe(1);
      expect(result.expires_at).toBeDefined();
    });

    test('should include KMS encryption for multipart upload', async () => {
      s3Mock.on(CreateMultipartUploadCommand).resolves({
        UploadId: 'test-upload-id',
      });

      getSignedUrl.mockResolvedValue('https://test-bucket.s3.amazonaws.com/part');

      await generator.generateMultipartUploadUrls({
        key: 'large-file.jpg',
        contentType: 'image/jpeg',
        numParts: 2,
      });

      const commandCalls = s3Mock.commandCalls(CreateMultipartUploadCommand);
      expect(commandCalls).toHaveLength(1);
      expect(commandCalls[0].args[0].input.ServerSideEncryption).toBe('aws:kms');
      expect(commandCalls[0].args[0].input.SSEKMSKeyId).toBe('test-kms-key-id');
    });

    test('should include custom metadata for multipart upload', async () => {
      s3Mock.on(CreateMultipartUploadCommand).resolves({
        UploadId: 'test-upload-id',
      });

      getSignedUrl.mockResolvedValue('https://test-bucket.s3.amazonaws.com/part');

      const metadata = { 'patient-id': 'patient-123' };

      await generator.generateMultipartUploadUrls({
        key: 'large-file.jpg',
        contentType: 'image/jpeg',
        numParts: 2,
        metadata,
      });

      const commandCalls = s3Mock.commandCalls(CreateMultipartUploadCommand);
      expect(commandCalls[0].args[0].input.Metadata).toEqual(metadata);
    });
  });

  describe('completeMultipartUpload', () => {
    test('should complete multipart upload successfully', async () => {
      s3Mock.on(CompleteMultipartUploadCommand).resolves({
        Location: 'https://test-bucket.s3.amazonaws.com/large-file.jpg',
        Bucket: 'test-bucket',
        Key: 'large-file.jpg',
        ETag: '"test-etag"',
      });

      const parts = [
        { PartNumber: 1, ETag: 'etag1' },
        { PartNumber: 2, ETag: 'etag2' },
      ];

      const result = await generator.completeMultipartUpload({
        key: 'large-file.jpg',
        uploadId: 'test-upload-id',
        parts,
      });

      expect(result.location).toBe('https://test-bucket.s3.amazonaws.com/large-file.jpg');
      expect(result.key).toBe('large-file.jpg');
      expect(result.etag).toBe('"test-etag"');
    });
  });

  describe('abortMultipartUpload', () => {
    test('should abort multipart upload successfully', async () => {
      s3Mock.on(AbortMultipartUploadCommand).resolves({});

      await generator.abortMultipartUpload({
        key: 'large-file.jpg',
        uploadId: 'test-upload-id',
      });

      const commandCalls = s3Mock.commandCalls(AbortMultipartUploadCommand);
      expect(commandCalls).toHaveLength(1);
      expect(commandCalls[0].args[0].input.Key).toBe('large-file.jpg');
      expect(commandCalls[0].args[0].input.UploadId).toBe('test-upload-id');
    });
  });

  describe('Constants', () => {
    test('should have correct allowed content types', () => {
      const expectedTypes = new Set([
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

      expect(S3PresignedURLGenerator.ALLOWED_CONTENT_TYPES).toEqual(expectedTypes);
    });

    test('should have correct default expiration times', () => {
      expect(S3PresignedURLGenerator.DEFAULT_UPLOAD_EXPIRATION).toBe(900); // 15 minutes
      expect(S3PresignedURLGenerator.DEFAULT_DOWNLOAD_EXPIRATION).toBe(300); // 5 minutes
    });

    test('should have correct default max file size', () => {
      expect(S3PresignedURLGenerator.DEFAULT_MAX_FILE_SIZE).toBe(100 * 1024 * 1024); // 100 MB
    });
  });
});
