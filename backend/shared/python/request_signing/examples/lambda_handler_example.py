"""
Example Lambda handler using request signing middleware
"""

import json
import boto3
from request_signing import create_signature_middleware

secrets_client = boto3.client('secretsmanager')


def get_signing_secret(event):
    """
    Retrieve signing secret from AWS Secrets Manager
    """
    # Extract user ID from event
    request_context = event.get('requestContext', {})
    authorizer = request_context.get('authorizer', {})
    claims = authorizer.get('claims', {})
    user_id = claims.get('sub')

    if not user_id:
        raise ValueError('User ID not found in request context')

    # Retrieve user-specific signing secret
    secret_name = f'vaidyalink/signing-secrets/{user_id}'

    try:
        response = secrets_client.get_secret_value(SecretId=secret_name)

        if 'SecretString' in response:
            secret = json.loads(response['SecretString'])
            return secret['signingKey']

        raise ValueError('Secret not found')
    except Exception as error:
        print(f'Failed to retrieve signing secret: {error}')
        raise


# Create signature verification middleware
verify_signature = create_signature_middleware(
    get_secret=get_signing_secret,
    max_age_seconds=300,  # 5 minutes
    sensitive_operations=[
        '/delete',
        '/update',
        '/export',
        '/abdm/consent',
        '/patients/merge'
    ]
)


async def delete_patient_handler(event, context):
    """
    Example: Delete patient record (sensitive operation)
    """
    try:
        # Verify request signature
        verification = await verify_signature(event)

        # If verification failed, return error response
        if 'statusCode' in verification:
            return verification

        # Extract patient ID from path
        path_parameters = event.get('pathParameters', {})
        patient_id = path_parameters.get('patientId')

        if not patient_id:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'MISSING_PARAMETER',
                    'message': 'Patient ID is required'
                })
            }

        # Perform deletion logic
        print(f'Deleting patient: {patient_id}')

        # TODO: Implement actual deletion logic
        # - Delete from DynamoDB
        # - Delete from HealthLake
        # - Delete S3 objects
        # - Log audit trail

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Patient record deleted successfully',
                'patientId': patient_id
            })
        }
    except Exception as error:
        print(f'Error deleting patient: {error}')

        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'INTERNAL_ERROR',
                'message': 'Failed to delete patient record'
            })
        }


async def export_patient_data_handler(event, context):
    """
    Example: Export patient data (sensitive operation)
    """
    try:
        # Verify request signature
        verification = await verify_signature(event)

        if 'statusCode' in verification:
            return verification

        path_parameters = event.get('pathParameters', {})
        patient_id = path_parameters.get('patientId')

        query_parameters = event.get('queryStringParameters', {})
        format_type = query_parameters.get('format', 'json')

        print(f'Exporting patient data: {patient_id} in {format_type} format')

        # TODO: Implement export logic
        # - Query HealthLake for FHIR resources
        # - Generate FHIR bundle
        # - Convert to requested format
        # - Log audit trail

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/xml' if format_type == 'xml' else 'application/json'
            },
            'body': json.dumps({
                'message': 'Export initiated',
                'patientId': patient_id,
                'format': format_type
            })
        }
    except Exception as error:
        print(f'Error exporting patient data: {error}')

        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'INTERNAL_ERROR',
                'message': 'Failed to export patient data'
            })
        }


def get_patient_handler(event, context):
    """
    Example: Regular operation (no signature required)
    """
    try:
        path_parameters = event.get('pathParameters', {})
        patient_id = path_parameters.get('patientId')

        print(f'Fetching patient: {patient_id}')

        # TODO: Implement fetch logic

        return {
            'statusCode': 200,
            'body': json.dumps({
                'patientId': patient_id,
                'name': 'John Doe',
                # ... other patient data
            })
        }
    except Exception as error:
        print(f'Error fetching patient: {error}')

        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'INTERNAL_ERROR',
                'message': 'Failed to fetch patient'
            })
        }
