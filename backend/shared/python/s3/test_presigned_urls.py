"""
Unit tests for S3 pre-signed URL generation utilities.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
from presigned_urls import S3PresignedURLGenerator


@pytest.fixture
def mock_s3_client():
    """Create a mock S3 client."""
    with patch('presigned_urls.boto3') as mock_boto3:
        mock_client = Mock()
        mock_boto3.client.return_value = mock_client
        yield mock_client


@pytest.fixture
def generator(mock_s3_client):
    """Create an S3PresignedURLGenerator instance."""
    return S3PresignedURLGenerator(
        bucket_name='test-bucket',
        region='ap-south-1',
        kms_key_id='test-kms-key-id'
    )


class TestS3PresignedURLGenerator:
    """Test suite for S3PresignedURLGenerator."""

    def test_initialization(self, generator):
        """Test generator initialization."""
        assert generator.bucket_name == 'test-bucket'
        assert generator.region == 'ap-south-1'
        assert generator.kms_key_id == 'test-kms-key-id'

    def test_initialization_with_defaults(self, mock_s3_client):
        """Test generator initialization with default values."""
        with patch.dict('os.environ', {'AWS_REGION': 'us-east-1', 'S3_KMS_KEY_ID': 'env-key'}):
            gen = S3PresignedURLGenerator(bucket_name='test-bucket')
            assert gen.region == 'us-east-1'
            assert gen.kms_key_id == 'env-key'

    def test_generate_upload_url_success(self, generator, mock_s3_client):
        """Test successful upload URL generation."""
        mock_s3_client.generate_presigned_post.return_value = {
            'url': 'https://test-bucket.s3.amazonaws.com/',
            'fields': {
                'key': 'test.jpg',
                'Content-Type': 'image/jpeg',
                'x-amz-server-side-encryption': 'aws:kms',
            }
        }

        result = generator.generate_upload_url(
            key='test.jpg',
            content_type='image/jpeg',
            max_file_size=5 * 1024 * 1024
        )

        assert result['url'] == 'https://test-bucket.s3.amazonaws.com/'
        assert result['key'] == 'test.jpg'
        assert result['max_file_size'] == 5 * 1024 * 1024
        assert 'expires_at' in result
        assert 'fields' in result

        # Verify the call was made with correct parameters
        mock_s3_client.generate_presigned_post.assert_called_once()
        call_args = mock_s3_client.generate_presigned_post.call_args
        assert call_args[1]['Bucket'] == 'test-bucket'
        assert call_args[1]['Key'] == 'test.jpg'

    def test_generate_upload_url_invalid_content_type(self, generator):
        """Test upload URL generation with invalid content type."""
        with pytest.raises(ValueError) as exc_info:
            generator.generate_upload_url(
                key='test.txt',
                content_type='text/plain'
            )

        assert 'not allowed' in str(exc_info.value)

    def test_generate_upload_url_skip_validation(self, generator, mock_s3_client):
        """Test upload URL generation with content type validation disabled."""
        mock_s3_client.generate_presigned_post.return_value = {
            'url': 'https://test-bucket.s3.amazonaws.com/',
            'fields': {'key': 'test.txt'}
        }

        result = generator.generate_upload_url(
            key='test.txt',
            content_type='text/plain',
            validate_content_type=False
        )

        assert result['url'] == 'https://test-bucket.s3.amazonaws.com/'

    def test_generate_upload_url_with_metadata(self, generator, mock_s3_client):
        """Test upload URL generation with custom metadata."""
        mock_s3_client.generate_presigned_post.return_value = {
            'url': 'https://test-bucket.s3.amazonaws.com/',
            'fields': {'key': 'test.jpg'}
        }

        metadata = {
            'patient-id': 'patient-123',
            'scan-type': 'prescription'
        }

        result = generator.generate_upload_url(
            key='test.jpg',
            content_type='image/jpeg',
            metadata=metadata
        )

        # Verify metadata was included in the call
        call_args = mock_s3_client.generate_presigned_post.call_args
        fields = call_args[1]['Fields']
        assert 'x-amz-meta-patient-id' in fields
        assert 'x-amz-meta-scan-type' in fields

    def test_generate_upload_url_with_kms(self, generator, mock_s3_client):
        """Test upload URL generation includes KMS encryption."""
        mock_s3_client.generate_presigned_post.return_value = {
            'url': 'https://test-bucket.s3.amazonaws.com/',
            'fields': {'key': 'test.jpg'}
        }

        generator.generate_upload_url(
            key='test.jpg',
            content_type='image/jpeg'
        )

        # Verify KMS encryption was included
        call_args = mock_s3_client.generate_presigned_post.call_args
        fields = call_args[1]['Fields']
        assert fields['x-amz-server-side-encryption'] == 'aws:kms'
        assert fields['x-amz-server-side-encryption-aws-kms-key-id'] == 'test-kms-key-id'

    def test_generate_download_url_success(self, generator, mock_s3_client):
        """Test successful download URL generation."""
        mock_s3_client.generate_presigned_url.return_value = 'https://test-bucket.s3.amazonaws.com/test.jpg?signature=xyz'

        result = generator.generate_download_url(key='test.jpg')

        assert result['url'] == 'https://test-bucket.s3.amazonaws.com/test.jpg?signature=xyz'
        assert result['key'] == 'test.jpg'
        assert 'expires_at' in result

        # Verify the call was made with correct parameters
        mock_s3_client.generate_presigned_url.assert_called_once()
        call_args = mock_s3_client.generate_presigned_url.call_args
        assert call_args[0][0] == 'get_object'
        assert call_args[1]['Params']['Bucket'] == 'test-bucket'
        assert call_args[1]['Params']['Key'] == 'test.jpg'

    def test_generate_download_url_with_response_headers(self, generator, mock_s3_client):
        """Test download URL generation with custom response headers."""
        mock_s3_client.generate_presigned_url.return_value = 'https://test-bucket.s3.amazonaws.com/test.jpg'

        result = generator.generate_download_url(
            key='test.jpg',
            response_content_type='application/octet-stream',
            response_content_disposition='attachment; filename="download.jpg"'
        )

        # Verify response headers were included
        call_args = mock_s3_client.generate_presigned_url.call_args
        params = call_args[1]['Params']
        assert params['ResponseContentType'] == 'application/octet-stream'
        assert params['ResponseContentDisposition'] == 'attachment; filename="download.jpg"'

    def test_generate_download_url_custom_expiration(self, generator, mock_s3_client):
        """Test download URL generation with custom expiration."""
        mock_s3_client.generate_presigned_url.return_value = 'https://test-bucket.s3.amazonaws.com/test.jpg'

        result = generator.generate_download_url(
            key='test.jpg',
            expiration=600  # 10 minutes
        )

        # Verify expiration was set correctly
        call_args = mock_s3_client.generate_presigned_url.call_args
        assert call_args[1]['ExpiresIn'] == 600

    def test_generate_multipart_upload_urls(self, generator, mock_s3_client):
        """Test multipart upload URL generation."""
        mock_s3_client.create_multipart_upload.return_value = {
            'UploadId': 'test-upload-id'
        }
        mock_s3_client.generate_presigned_url.return_value = 'https://test-bucket.s3.amazonaws.com/part'

        result = generator.generate_multipart_upload_urls(
            key='large-file.jpg',
            content_type='image/jpeg',
            num_parts=3
        )

        assert result['upload_id'] == 'test-upload-id'
        assert result['key'] == 'large-file.jpg'
        assert len(result['part_urls']) == 3
        assert result['part_urls'][0]['part_number'] == 1
        assert 'expires_at' in result

        # Verify multipart upload was initiated
        mock_s3_client.create_multipart_upload.assert_called_once()

        # Verify pre-signed URLs were generated for each part
        assert mock_s3_client.generate_presigned_url.call_count == 3

    def test_complete_multipart_upload(self, generator, mock_s3_client):
        """Test completing a multipart upload."""
        mock_s3_client.complete_multipart_upload.return_value = {
            'Location': 'https://test-bucket.s3.amazonaws.com/large-file.jpg',
            'Bucket': 'test-bucket',
            'Key': 'large-file.jpg',
            'ETag': '"test-etag"'
        }

        parts = [
            {'PartNumber': 1, 'ETag': 'etag1'},
            {'PartNumber': 2, 'ETag': 'etag2'},
        ]

        result = generator.complete_multipart_upload(
            key='large-file.jpg',
            upload_id='test-upload-id',
            parts=parts
        )

        assert result['location'] == 'https://test-bucket.s3.amazonaws.com/large-file.jpg'
        assert result['key'] == 'large-file.jpg'
        assert result['etag'] == '"test-etag"'

        # Verify the call was made with correct parameters
        mock_s3_client.complete_multipart_upload.assert_called_once()
        call_args = mock_s3_client.complete_multipart_upload.call_args
        assert call_args[1]['Bucket'] == 'test-bucket'
        assert call_args[1]['Key'] == 'large-file.jpg'
        assert call_args[1]['UploadId'] == 'test-upload-id'

    def test_abort_multipart_upload(self, generator, mock_s3_client):
        """Test aborting a multipart upload."""
        generator.abort_multipart_upload(
            key='large-file.jpg',
            upload_id='test-upload-id'
        )

        # Verify the call was made with correct parameters
        mock_s3_client.abort_multipart_upload.assert_called_once()
        call_args = mock_s3_client.abort_multipart_upload.call_args
        assert call_args[1]['Bucket'] == 'test-bucket'
        assert call_args[1]['Key'] == 'large-file.jpg'
        assert call_args[1]['UploadId'] == 'test-upload-id'

    def test_allowed_content_types(self):
        """Test that all expected content types are allowed."""
        expected_types = {
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

        assert S3PresignedURLGenerator.ALLOWED_CONTENT_TYPES == expected_types

    def test_default_expiration_times(self):
        """Test default expiration time constants."""
        assert S3PresignedURLGenerator.DEFAULT_UPLOAD_EXPIRATION == 900  # 15 minutes
        assert S3PresignedURLGenerator.DEFAULT_DOWNLOAD_EXPIRATION == 300  # 5 minutes

    def test_default_max_file_size(self):
        """Test default max file size constant."""
        assert S3PresignedURLGenerator.DEFAULT_MAX_FILE_SIZE == 100 * 1024 * 1024  # 100 MB


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
