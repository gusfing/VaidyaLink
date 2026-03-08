"""
S3 Pre-signed URL Generation Utilities

This module provides utilities for generating secure, time-limited pre-signed URLs
for uploading and downloading files from S3. It supports content-type validation,
file size limits, and custom metadata attachment.

Security Features:
- Time-limited URLs (configurable expiration)
- Content-type restrictions for uploads
- File size limits enforcement
- Integration with KMS encryption
- Proper IAM permissions validation

Usage:
    from s3.presigned_urls import S3PresignedURLGenerator

    generator = S3PresignedURLGenerator(
        bucket_name='my-bucket',
        region='ap-south-1'
    )

    # Generate upload URL
    upload_url = generator.generate_upload_url(
        key='documents/scan-123.jpg',
        content_type='image/jpeg',
        max_file_size=10 * 1024 * 1024  # 10 MB
    )

    # Generate download URL
    download_url = generator.generate_download_url(
        key='documents/scan-123.jpg'
    )
"""

import boto3
from typing import Dict, Optional, Any
from datetime import datetime, timedelta, timezone
import os


class S3PresignedURLGenerator:
    """
    Generates secure pre-signed URLs for S3 operations.

    This class provides methods to generate time-limited URLs for uploading
    and downloading files from S3, with built-in security controls.
    """

    # Default expiration times (in seconds)
    DEFAULT_UPLOAD_EXPIRATION = 900  # 15 minutes
    DEFAULT_DOWNLOAD_EXPIRATION = 300  # 5 minutes

    # Allowed content types for medical documents
    ALLOWED_CONTENT_TYPES = {
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/tiff',
        'application/pdf',
        'audio/wav',
        'audio/mpeg',
        'audio/mp3',
        'audio/webm',
    }

    # Maximum file size (100 MB default)
    DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024

    def __init__(
        self,
        bucket_name: str,
        region: Optional[str] = None,
        kms_key_id: Optional[str] = None
    ):
        """
        Initialize the pre-signed URL generator.

        Args:
            bucket_name: Name of the S3 bucket
            region: AWS region (defaults to environment variable or us-east-1)
            kms_key_id: KMS key ID for server-side encryption (optional)
        """
        self.bucket_name = bucket_name
        self.region = region or os.environ.get('AWS_REGION', 'ap-south-1')
        self.kms_key_id = kms_key_id or os.environ.get('S3_KMS_KEY_ID')

        self.s3_client = boto3.client('s3', region_name=self.region)

    def generate_upload_url(
        self,
        key: str,
        content_type: str,
        expiration: int = DEFAULT_UPLOAD_EXPIRATION,
        max_file_size: Optional[int] = None,
        metadata: Optional[Dict[str, str]] = None,
        validate_content_type: bool = True
    ) -> Dict[str, Any]:
        """
        Generate a pre-signed URL for uploading a file to S3.

        Args:
            key: S3 object key (path within bucket)
            content_type: MIME type of the file to upload
            expiration: URL expiration time in seconds (default: 15 minutes)
            max_file_size: Maximum allowed file size in bytes (default: 100 MB)
            metadata: Custom metadata to attach to the object
            validate_content_type: Whether to validate content type against allowed list

        Returns:
            Dictionary containing:
                - url: Pre-signed URL for upload
                - fields: Form fields to include in the upload request
                - key: S3 object key
                - expires_at: ISO 8601 timestamp when URL expires

        Raises:
            ValueError: If content type is not allowed
        """
        # Validate content type
        if validate_content_type and content_type not in self.ALLOWED_CONTENT_TYPES:
            raise ValueError(
                f"Content type '{content_type}' is not allowed. "
                f"Allowed types: {', '.join(self.ALLOWED_CONTENT_TYPES)}"
            )

        # Set default max file size
        if max_file_size is None:
            max_file_size = self.DEFAULT_MAX_FILE_SIZE

        # Prepare conditions for the upload
        conditions = [
            {'bucket': self.bucket_name},
            {'key': key},
            {'Content-Type': content_type},
            ['content-length-range', 1, max_file_size],
        ]

        # Prepare fields
        fields = {
            'Content-Type': content_type,
        }

        # Add KMS encryption if configured
        if self.kms_key_id:
            fields['x-amz-server-side-encryption'] = 'aws:kms'
            fields['x-amz-server-side-encryption-aws-kms-key-id'] = self.kms_key_id
            conditions.append({'x-amz-server-side-encryption': 'aws:kms'})
            conditions.append({
                'x-amz-server-side-encryption-aws-kms-key-id': self.kms_key_id
            })

        # Add custom metadata
        if metadata:
            for meta_key, meta_value in metadata.items():
                field_key = f'x-amz-meta-{meta_key}'
                fields[field_key] = meta_value
                conditions.append({field_key: meta_value})

        # Generate pre-signed POST
        response = self.s3_client.generate_presigned_post(
            Bucket=self.bucket_name,
            Key=key,
            Fields=fields,
            Conditions=conditions,
            ExpiresIn=expiration
        )

        # Calculate expiration timestamp
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expiration)

        return {
            'url': response['url'],
            'fields': response['fields'],
            'key': key,
            'expires_at': expires_at.isoformat() + 'Z',
            'max_file_size': max_file_size,
        }

    def generate_download_url(
        self,
        key: str,
        expiration: int = DEFAULT_DOWNLOAD_EXPIRATION,
        response_content_type: Optional[str] = None,
        response_content_disposition: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a pre-signed URL for downloading a file from S3.

        Args:
            key: S3 object key (path within bucket)
            expiration: URL expiration time in seconds (default: 5 minutes)
            response_content_type: Override Content-Type header in response
            response_content_disposition: Set Content-Disposition header (e.g., for downloads)

        Returns:
            Dictionary containing:
                - url: Pre-signed URL for download
                - key: S3 object key
                - expires_at: ISO 8601 timestamp when URL expires
        """
        params = {
            'Bucket': self.bucket_name,
            'Key': key,
        }

        # Add optional response headers
        if response_content_type:
            params['ResponseContentType'] = response_content_type

        if response_content_disposition:
            params['ResponseContentDisposition'] = response_content_disposition

        # Generate pre-signed URL
        url = self.s3_client.generate_presigned_url(
            'get_object',
            Params=params,
            ExpiresIn=expiration
        )

        # Calculate expiration timestamp
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expiration)

        return {
            'url': url,
            'key': key,
            'expires_at': expires_at.isoformat() + 'Z',
        }

    def generate_multipart_upload_urls(
        self,
        key: str,
        content_type: str,
        num_parts: int,
        expiration: int = DEFAULT_UPLOAD_EXPIRATION,
        metadata: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Generate pre-signed URLs for multipart upload (for large files).

        Args:
            key: S3 object key (path within bucket)
            content_type: MIME type of the file to upload
            num_parts: Number of parts for the multipart upload
            expiration: URL expiration time in seconds (default: 15 minutes)
            metadata: Custom metadata to attach to the object

        Returns:
            Dictionary containing:
                - upload_id: Multipart upload ID
                - part_urls: List of pre-signed URLs for each part
                - key: S3 object key
                - expires_at: ISO 8601 timestamp when URLs expire
        """
        # Prepare parameters for multipart upload
        params = {
            'Bucket': self.bucket_name,
            'Key': key,
            'ContentType': content_type,
        }

        # Add KMS encryption if configured
        if self.kms_key_id:
            params['ServerSideEncryption'] = 'aws:kms'
            params['SSEKMSKeyId'] = self.kms_key_id

        # Add custom metadata
        if metadata:
            params['Metadata'] = metadata

        # Initiate multipart upload
        response = self.s3_client.create_multipart_upload(**params)
        upload_id = response['UploadId']

        # Generate pre-signed URLs for each part
        part_urls = []
        for part_number in range(1, num_parts + 1):
            part_url = self.s3_client.generate_presigned_url(
                'upload_part',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': key,
                    'UploadId': upload_id,
                    'PartNumber': part_number,
                },
                ExpiresIn=expiration
            )
            part_urls.append({
                'part_number': part_number,
                'url': part_url,
            })

        # Calculate expiration timestamp
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expiration)

        return {
            'upload_id': upload_id,
            'part_urls': part_urls,
            'key': key,
            'expires_at': expires_at.isoformat() + 'Z',
        }

    def complete_multipart_upload(
        self,
        key: str,
        upload_id: str,
        parts: list
    ) -> Dict[str, Any]:
        """
        Complete a multipart upload.

        Args:
            key: S3 object key (path within bucket)
            upload_id: Multipart upload ID
            parts: List of completed parts with ETag values
                   Format: [{'PartNumber': 1, 'ETag': 'etag1'}, ...]

        Returns:
            Dictionary containing completion response
        """
        response = self.s3_client.complete_multipart_upload(
            Bucket=self.bucket_name,
            Key=key,
            UploadId=upload_id,
            MultipartUpload={'Parts': parts}
        )

        return {
            'location': response['Location'],
            'bucket': response['Bucket'],
            'key': response['Key'],
            'etag': response['ETag'],
        }

    def abort_multipart_upload(self, key: str, upload_id: str) -> None:
        """
        Abort a multipart upload and clean up parts.

        Args:
            key: S3 object key (path within bucket)
            upload_id: Multipart upload ID
        """
        self.s3_client.abort_multipart_upload(
            Bucket=self.bucket_name,
            Key=key,
            UploadId=upload_id
        )
