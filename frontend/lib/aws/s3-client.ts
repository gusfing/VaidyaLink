import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CognitoIdentityService } from '../auth/cognito-identity';

interface S3UploadOptions {
  bucket: string;
  key: string;
  file: File | Blob;
  contentType?: string;
  metadata?: Record<string, string>;
}

interface S3DownloadOptions {
  bucket: string;
  key: string;
}

/**
 * S3 client that uses Cognito Identity Pool credentials
 * Allows direct uploads/downloads from browser without going through API Gateway
 */
export class FederatedS3Client {
  private identityService: CognitoIdentityService;
  private region: string;

  constructor(identityService: CognitoIdentityService, region: string = 'ap-south-1') {
    this.identityService = identityService;
    this.region = region;
  }

  /**
   * Upload file directly to S3 using federated credentials
   * @param idToken - Cognito ID token
   * @param options - Upload options
   */
  async uploadFile(idToken: string, options: S3UploadOptions): Promise<void> {
    const credentials = await this.identityService.createCredentialProvider(idToken);

    const s3Client = new S3Client({
      region: this.region,
      credentials,
    });

    const fileBuffer = await options.file.arrayBuffer();

    const command = new PutObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
      Body: new Uint8Array(fileBuffer),
      ContentType: options.contentType || options.file.type,
      Metadata: options.metadata,
      ServerSideEncryption: 'aws:kms',
    });

    await s3Client.send(command);
  }

  /**
   * Get presigned URL for downloading file from S3
   * @param idToken - Cognito ID token
   * @param options - Download options
   * @param expiresIn - URL expiration in seconds (default: 3600)
   */
  async getDownloadUrl(
    idToken: string,
    options: S3DownloadOptions,
    expiresIn: number = 3600
  ): Promise<string> {
    const credentials = await this.identityService.createCredentialProvider(idToken);

    const s3Client = new S3Client({
      region: this.region,
      credentials,
    });

    const command = new GetObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Delete file from S3 using federated credentials
   * @param idToken - Cognito ID token
   * @param options - Delete options
   */
  async deleteFile(idToken: string, options: S3DownloadOptions): Promise<void> {
    const credentials = await this.identityService.createCredentialProvider(idToken);

    const s3Client = new S3Client({
      region: this.region,
      credentials,
    });

    const command = new DeleteObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
    });

    await s3Client.send(command);
  }

  /**
   * Generate S3 key with user-specific prefix using Identity ID
   * @param idToken - Cognito ID token
   * @param folder - Folder name (e.g., 'raw', 'audio', 'exports')
   * @param filename - File name
   */
  async generateUserKey(idToken: string, folder: string, filename: string): Promise<string> {
    const identityId = await this.identityService.getIdentityId(idToken);
    return `${folder}/${identityId}/${filename}`;
  }
}
