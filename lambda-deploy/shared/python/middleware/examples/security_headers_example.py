"""
Security Headers Middleware Examples
Demonstrates various usage patterns for the security headers middleware
"""

import json
import os
from datetime import datetime
from security_headers import (
    create_security_headers_middleware,
    with_security_headers,
    get_preset
)


# ============================================================================
# Example 1: Basic Usage with Manual Application
# ============================================================================

apply_headers = create_security_headers_middleware()


def basic_handler(event, context):
    """Basic handler with manual header application"""
    response = {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps({
            'message': 'Hello from VaidyaLink',
            'timestamp': datetime.utcnow().isoformat()
        })
    }

    # Manually apply security headers
    return apply_headers(response)


# ============================================================================
# Example 2: Using Decorator Pattern (Recommended)
# ============================================================================

@with_security_headers()
def decorated_handler(event, context):
    """Handler with automatic security headers via decorator"""
    # Your business logic here
    user_id = event.get('user', {}).get('sub')

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps({
            'message': 'Security headers applied automatically',
            'userId': user_id
        })
    }


# ============================================================================
# Example 3: Custom Headers Configuration
# ============================================================================

@with_security_headers({
    'headers': {
        # Override default CSP for specific needs
        'Content-Security-Policy': '; '.join([
            "default-src 'self'",
            "script-src 'self' https://cdn.vaidyalink.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "connect-src 'self' https://api.vaidyalink.com"
        ]),
        # Add custom header
        'X-VaidyaLink-Version': '1.0.0'
    }
})
def custom_headers_handler(event, context):
    """Handler with custom security configuration"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps({
            'message': 'Custom security configuration'
        })
    }


# ============================================================================
# Example 4: Using Strict Preset for HIPAA Compliance
# ============================================================================

@with_security_headers(get_preset('strict'))
def hipaa_compliant_handler(event, context):
    """Handler for sensitive PHI data with strict security"""
    # Handle sensitive PHI data
    patient_id = event.get('pathParameters', {}).get('patientId')
    patient_data = {
        'id': patient_id,
        'records': []  # Fetch from HealthLake
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, private'
        },
        'body': json.dumps(patient_data)
    }


# ============================================================================
# Example 5: API-Only Preset for REST Endpoints
# ============================================================================

@with_security_headers(get_preset('api'))
def api_handler(event, context):
    """API handler with simplified security headers"""
    body = json.loads(event.get('body', '{}'))

    # Process API request
    result = {
        'success': True,
        'data': body
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps(result)
    }


# ============================================================================
# Example 6: Combining with Authentication Middleware
# ============================================================================

from auth import create_auth_middleware

auth_middleware = create_auth_middleware()


@with_security_headers()
def secure_authenticated_handler(event, context):
    """Handler combining authentication and security headers"""
    # First, authenticate the request
    auth_result = auth_middleware(event)

    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Unauthorized',
                'message': auth_result['error']
            })
        }

    # Process authenticated request
    user = event['user']

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps({
            'message': 'Authenticated and secured',
            'username': user['username']
        })
    }


# ============================================================================
# Example 7: Document Processing Handler with Security Headers
# ============================================================================

import boto3

s3_client = boto3.client('s3')


@with_security_headers(get_preset('strict'))
def document_processing_handler(event, context):
    """Document processing handler with strict security"""
    # Extract document info from S3 event
    record = event['Records'][0]
    bucket = record['s3']['bucket']['name']
    key = record['s3']['object']['key']

    # Process document
    result = {
        'jobId': context.request_id,
        'bucket': bucket,
        'key': key,
        'status': 'processing'
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps(result)
    }


# ============================================================================
# Example 8: FHIR Export Handler with Custom Headers
# ============================================================================

@with_security_headers({
    'headers': {
        **get_preset('strict')['headers'],
        # Additional headers for file downloads
        'X-Content-Type-Options': 'nosniff',
        'X-Download-Options': 'noopen'
    }
})
def fhir_export_handler(event, context):
    """FHIR export handler with download-specific headers"""
    patient_id = event.get('pathParameters', {}).get('patientId')
    format_type = event.get('queryStringParameters', {}).get('format', 'json')

    # Fetch FHIR bundle from HealthLake
    fhir_bundle = {
        'resourceType': 'Bundle',
        'type': 'collection',
        'entry': []
    }

    content_type = 'application/fhir+xml' if format_type == 'xml' else 'application/fhir+json'
    body = convert_to_xml(fhir_bundle) if format_type == 'xml' else json.dumps(fhir_bundle)

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': content_type,
            'Content-Disposition': f'attachment; filename="patient-{patient_id}.{format_type}"'
        },
        'body': body
    }


# ============================================================================
# Example 9: Error Handler with Security Headers
# ============================================================================

@with_security_headers()
def error_prone_handler(event, context):
    """Handler demonstrating error handling with security headers"""
    try:
        # Simulate operation that might fail
        data = risky_operation()

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'data': data})
        }
    except Exception as error:
        print(f'Operation failed: {str(error)}')

        # Return error response (headers will be applied automatically)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Internal Server Error',
                'message': str(error) if os.environ.get('ENV') == 'development' else 'An error occurred'
            })
        }


# ============================================================================
# Example 10: Clinical Summary Handler
# ============================================================================

@with_security_headers(get_preset('strict'))
def clinical_summary_handler(event, context):
    """Clinical summary handler with strict HIPAA compliance"""
    patient_id = event.get('pathParameters', {}).get('patientId')

    # Generate clinical summary using Bedrock
    summary = {
        'patientId': patient_id,
        'summary': 'Clinical summary content...',
        'generatedAt': datetime.utcnow().isoformat(),
        'confidence': 0.95
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, private'
        },
        'body': json.dumps(summary)
    }


# ============================================================================
# Example 11: Voice Transcription Handler
# ============================================================================

@with_security_headers(get_preset('strict'))
def voice_transcription_handler(event, context):
    """Voice transcription handler with security headers"""
    job_id = event.get('pathParameters', {}).get('jobId')

    # Fetch transcription result
    transcription = {
        'jobId': job_id,
        'status': 'completed',
        'transcription': 'Patient reported symptoms...',
        'language': 'hi',
        'confidence': 0.92
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps(transcription)
    }


# ============================================================================
# Example 12: ABDM Integration Handler
# ============================================================================

@with_security_headers(get_preset('strict'))
def abdm_integration_handler(event, context):
    """ABDM integration handler with strict security"""
    abha_id = event.get('pathParameters', {}).get('abhaId')

    # Fetch records from ABDM
    abdm_records = {
        'abhaId': abha_id,
        'records': [],
        'consentStatus': 'granted'
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, private'
        },
        'body': json.dumps(abdm_records)
    }


# Helper functions
def risky_operation():
    """Simulated risky operation"""
    return {'result': 'success'}


def convert_to_xml(data):
    """Simplified XML conversion"""
    return f'<?xml version="1.0" encoding="UTF-8"?><Bundle>{json.dumps(data)}</Bundle>'
