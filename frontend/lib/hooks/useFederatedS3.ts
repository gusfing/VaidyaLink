import { useState, useCallback } from 'react';
import { FederatedS3Client } from '../aws/s3-client';
import { createCognitoIdentityService } from '../auth/cognito-identity';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UseS3Return {
  uploadFile: (file: File, folder: string, idToken: string) => Promise<string>;
  downloadFile: (key: string, idToken: string) => Promise<string>;
  deleteFile: (key: string, idToken: string) => Promise<void>;
  uploading: boolean;
  uploadProgress: UploadProgress | null;
  error: Error | null;
}

/**
 * React hook for S3 operations using Cognito Identity Pool credentials
 * Provides direct browser-to-S3 uploads without API Gateway
 */
export function useFederatedS3(): UseS3Return {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const identityService = createCognitoIdentityService();
  const s3Client = new FederatedS3Client(identityService, process.env.NEXT_PUBLIC_AWS_REGION);

  const uploadFile = useCallback(
    async (file: File, folder: string, idToken: string): Promise<string> => {
      setUploading(true);
      setError(null);
      setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });

      try {
        const timestamp = Date.now();
        const filename = `${timestamp}-${file.name}`;
        const key = await s3Client.generateUserKey(idToken, folder, filename);

        const bucket = process.env.NEXT_PUBLIC_S3_DOCUMENTS_BUCKET!;

        await s3Client.uploadFile(idToken, {
          bucket,
          key,
          file,
          contentType: file.type,
          metadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
          },
        });

        setUploadProgress({ loaded: file.size, total: file.size, percentage: 100 });
        return key;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed');
        setError(error);
        throw error;
      } finally {
        setUploading(false);
      }
    },
    [s3Client]
  );

  const downloadFile = useCallback(
    async (key: string, idToken: string): Promise<string> => {
      setError(null);

      try {
        const bucket = process.env.NEXT_PUBLIC_S3_DOCUMENTS_BUCKET!;
        const url = await s3Client.getDownloadUrl(idToken, { bucket, key });
        return url;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Download failed');
        setError(error);
        throw error;
      }
    },
    [s3Client]
  );

  const deleteFile = useCallback(
    async (key: string, idToken: string): Promise<void> => {
      setError(null);

      try {
        const bucket = process.env.NEXT_PUBLIC_S3_DOCUMENTS_BUCKET!;
        await s3Client.deleteFile(idToken, { bucket, key });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Delete failed');
        setError(error);
        throw error;
      }
    },
    [s3Client]
  );

  return {
    uploadFile,
    downloadFile,
    deleteFile,
    uploading,
    uploadProgress,
    error,
  };
}
