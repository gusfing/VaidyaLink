"""
Lambda Handler Examples for S3 Pre-signed URL Generation

This module demonstrates how to use the S3PresignedURLGenerator in AWS Lambda functions
to provide secure upload and download URLs to clients.

API Endpoints:
- POST /api/v1/scans/upload-url - Get pre-signed URL for document upload
- POST /api/v1/voice/upload-url - Get pre-signed URL for audio upload
- GET /api/v1/documents/{key}/download-url - Get pre-signed URL for document download
"""

import json
import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from presigned_urls import S3PresignedURLGenerator


# Initialize generator (reused across invocations)
generator = S3PresignedURLGenerator(
    bucket_name=os.environ['DOCUMENTS_BUCKET_NAME'],
    region=os.environ.get('AWS_REGION', 'ap-south-1'),
    kms_key_id=os.environ.get('S3_KMS_KEY_ID')
)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler that routes requests to appropriate functions.

    Args:
        event: API Gateway event
        context: Lambda context

    Returns:
        API Gateway response
    """
    try:
        # Extract route information
        http_method = event.get('httpMethod')
        path = event.get('path', '')

        # Route to appropriate handler
        if http_method == 'POST' and '/upload-url' in path:
            return handle_upload_url_request(event)
        elif http_method == 'GET' and '/download-url' in path:
            return handle_download_url_request(event)
        else:
            return create_response(404, {'error': 'Not found'})

    except Exception as e:
        print(f"Error processing request: {str(e)}")
        return create_response(500, {'error': 'Internal server error'})


def handle_upload_url_request(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle request for upload pre-signed URL.

    Expected request body:
    {
        "file_name": "scan-123.jpg",
        "content_type": "image/jpeg",
        "patient_id": "patient-123",
        "scan_type": "prescription",
        "max_file_size": 10485760  // Optional, in bytes
    }

    Args:
        event: API Gateway event

    Returns:
        API Gateway response with pre-signed URL
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))

        # Extract parameters
        file_name = body.get('file_name')
        content_type = body.get('content_type')
        patient_id = body.get('patient_id')
        scan_type = body.get('scan_type', 'document')
        max_file_size = body.get('max_file_size')

        # Validate required parameters
        if not file_name or not content_type or not patient_id:
            return create_response(400, {
                'error': 'Missing required parameters: file_name, content_type, patient_id'
            })

        # Generate S3 key with proper structure
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
        s3_key = f"raw/{patient_id}/{timestamp}/{file_name}"

        # Prepare metadata
        metadata = {
            'patient-id': patient_id,
            'scan-type': scan_type,
            'uploaded-at': datetime.now(timezone.utc).isoformat(),
        }

        # Generate pre-signed URL
        result = generator.generate_upload_url(
            key=s3_key,
            content_type=content_type,
            max_file_size=max_file_size,
            metadata=metadata
        )

        # Return response
        return create_response(200, {
            'upload_url': result['url'],
            'fields': result['fields'],
            's3_key': result['key'],
            'expires_at': result['expires_at'],
            'max_file_size': result['max_file_size'],
        })

    except ValueError as e:
        return create_response(400, {'error': str(e)})
    except Exception as e:
        print(f"Error generating upload URL: {str(e)}")
        return create_response(500, {'error': 'Failed to generate upload URL'})


def handle_download_url_request(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle request for download pre-signed URL.

    Expected path parameters:
    - key: S3 object key (URL encoded)

    Optional query parameters:
    - download: If 'true', sets Content-Disposition to attachment
    - expiration: Custom expiration time in seconds

    Args:
        event: API Gateway event

    Returns:
        API Gateway response with pre-signed URL
    """
    try:
        # Extract S3 key from path parameters
        path_params = event.get('pathParameters', {})
        s3_key = path_params.get('key')

        if not s3_key:
            return create_response(400, {'error': 'Missing required parameter: key'})

        # Extract query parameters
        query_params = event.get('queryStringParameters') or {}
        download = query_params.get('download', 'false').lower() == 'true'
        expiration = int(query_params.get('expiration', 300))

        # Prepare response headers
        response_content_disposition = None
        if download:
            # Extract filename from key
            file_name = s3_key.split('/')[-1]
            response_content_disposition = f'attachment; filename="{file_name}"'

        # Generate pre-signed URL
        result = generator.generate_download_url(
            key=s3_key,
            expiration=expiration,
            response_content_disposition=response_content_disposition
        )

        # Return response
        return create_response(200, {
            'download_url': result['url'],
            's3_key': result['key'],
            'expires_at': result['expires_at'],
        })

    except Exception as e:
        print(f"Error generating download URL: {str(e)}")
        return create_response(500, {'error': 'Failed to generate download URL'})


def handle_multipart_upload_request(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle request for multipart upload pre-signed URLs (for large files).

    Expected request body:
    {
        "file_name": "large-scan.tiff",
        "content_type": "image/tiff",
        "patient_id": "patient-123",
        "num_parts": 5,
        "scan_type": "xray"
    }

    Args:
        event: API Gateway event

    Returns:
        API Gateway response with multipart upload URLs
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))

        # Extract parameters
        file_name = body.get('file_name')
        content_type = body.get('content_type')
        patient_id = body.get('patient_id')
        num_parts = body.get('num_parts')
        scan_type = body.get('scan_type', 'document')

        # Validate required parameters
        if not all([file_name, content_type, patient_id, num_parts]):
            return create_response(400, {
                'error': 'Missing required parameters: file_name, content_type, patient_id, num_parts'
            })

        # Generate S3 key
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
        s3_key = f"raw/{patient_id}/{timestamp}/{file_name}"

        # Prepare metadata
        metadata = {
            'patient-id': patient_id,
            'scan-type': scan_type,
            'uploaded-at': datetime.now(timezone.utc).isoformat(),
        }

        # Generate multipart upload URLs
        result = generator.generate_multipart_upload_urls(
            key=s3_key,
            content_type=content_type,
            num_parts=num_parts,
            metadata=metadata
        )

        # Return response
        return create_response(200, {
            'upload_id': result['upload_id'],
            'part_urls': result['part_urls'],
            's3_key': result['key'],
            'expires_at': result['expires_at'],
        })

    except Exception as e:
        print(f"Error generating multipart upload URLs: {str(e)}")
        return create_response(500, {'error': 'Failed to generate multipart upload URLs'})


def create_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create API Gateway response.

    Args:
        status_code: HTTP status code
        body: Response body

    Returns:
        API Gateway response object
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',  # Configure appropriately for production
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        },
        'body': json.dumps(body)
    }


# Example usage for testing
if __name__ == '__main__':
    # Test upload URL generation
    test_event = {
        'httpMethod': 'POST',
        'path': '/api/v1/scans/upload-url',
        'body': json.dumps({
            'file_name': 'test-scan.jpg',
            'content_type': 'image/jpeg',
            'patient_id': 'patient-123',
            'scan_type': 'prescription',
            'max_file_size': 10 * 1024 * 1024
        })
    }

    # Set environment variables for testing
    os.environ['DOCUMENTS_BUCKET_NAME'] = 'test-bucket'
    os.environ['AWS_REGION'] = 'ap-south-1'

    response = lambda_handler(test_event, None)
    print(json.dumps(response, indent=2))
