"""
Example Lambda handler demonstrating encryption utilities usage
"""

import json
import os
from typing import Dict, Any
from encryption import FieldEncryption, KMSEncryption


# Initialize encryption services (reuse across invocations)
field_encryption = FieldEncryption()
kms_encryption = KMSEncryption()


def store_patient_record(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler to store encrypted patient records

    Example event:
    {
        "body": "{\"patient_name\": \"Rajesh Kumar\", \"age\": 45, ...}",
        "pathParameters": {"patientId": "123"}
    }
    """
    try:
        # Parse request
        patient_record = json.loads(event['body'])
        patient_id = event['pathParameters']['patientId']

        # Encrypt sensitive fields
        encrypted_record = field_encryption.encrypt_record(
            patient_record,
            patient_id=patient_id,
            additional_context={
                'operation': 'store_record',
                'source': 'api_gateway'
            }
        )

        # Add metadata
        encrypted_record['patient_id'] = patient_id
        encrypted_record['encrypted_at'] = context.aws_request_id

        # Store in DynamoDB (pseudo-code)
        # dynamodb.put_item(TableName='Patients', Item=encrypted_record)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Patient record stored successfully',
                'patient_id': patient_id
            })
        }

    except ValueError as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': f'Invalid request: {str(e)}'})
        }
    except Exception as e:
        print(f"Error storing patient record: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }


def retrieve_patient_record(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler to retrieve and decrypt patient records

    Example event:
    {
        "pathParameters": {"patientId": "123"},
        "queryStringParameters": {"fields": "patient_name,age"}
    }
    """
    try:
        patient_id = event['pathParameters']['patientId']

        # Get requested fields (optional partial decryption)
        query_params = event.get('queryStringParameters', {})
        requested_fields = None
        if query_params and 'fields' in query_params:
            requested_fields = query_params['fields'].split(',')

        # Retrieve from DynamoDB (pseudo-code)
        # encrypted_record = dynamodb.get_item(
        #     TableName='Patients',
        #     Key={'patient_id': patient_id}
        # )['Item']

        # Mock encrypted record for example
        encrypted_record = {
            'patient_id': patient_id,
            'patient_name': 'AQICAHh...encrypted...',
            'patient_name_encrypted': True,
            'age': 45,
            'medical_history': 'AQICAHh...encrypted...',
            'medical_history_encrypted': True
        }

        # Decrypt record (partial or full)
        decrypted_record = field_encryption.decrypt_record(
            encrypted_record,
            patient_id=patient_id,
            fields_to_decrypt=requested_fields
        )

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(decrypted_record)
        }

    except Exception as e:
        print(f"Error retrieving patient record: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }


def encrypt_medical_document(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler to encrypt medical document metadata
    Uses direct KMS encryption for individual fields
    """
    try:
        document_metadata = json.loads(event['body'])
        patient_id = document_metadata['patient_id']

        # Encrypt specific sensitive fields using KMS directly
        encryption_context = {
            'patient_id': patient_id,
            'service': 'vaidyalink',
            'data_type': 'document_metadata'
        }

        encrypted_metadata = {
            'document_id': document_metadata['document_id'],
            'patient_id': patient_id,
            'document_type': document_metadata['document_type'],
            'encrypted_notes': kms_encryption.encrypt(
                document_metadata['doctor_notes'],
                encryption_context
            ),
            'encrypted_diagnosis': kms_encryption.encrypt(
                document_metadata['diagnosis'],
                encryption_context
            ),
            'upload_date': document_metadata['upload_date']
        }

        # Store metadata
        # dynamodb.put_item(TableName='Documents', Item=encrypted_metadata)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Document metadata encrypted and stored',
                'document_id': document_metadata['document_id']
            })
        }

    except Exception as e:
        print(f"Error encrypting document: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }


def rotate_encryption_keys(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler to re-encrypt data with new KMS key
    Used during key rotation
    """
    try:
        # Get records to re-encrypt
        patient_id = event['pathParameters']['patientId']
        new_key_id = os.environ.get('NEW_KMS_KEY_ID')

        if not new_key_id:
            raise ValueError('NEW_KMS_KEY_ID not configured')

        # Retrieve encrypted record
        # encrypted_record = dynamodb.get_item(...)

        # Re-encrypt each encrypted field
        old_context = {
            'patient_id': patient_id,
            'service': 'vaidyalink',
            'data_type': 'phi'
        }

        new_context = old_context.copy()
        new_context['key_version'] = 'v2'

        # Re-encrypt sensitive fields
        # for field in encrypted_fields:
        #     old_ciphertext = encrypted_record[field]
        #     new_ciphertext = kms_encryption.re_encrypt(
        #         old_ciphertext,
        #         new_key_id,
        #         old_context,
        #         new_context
        #     )
        #     encrypted_record[field] = new_ciphertext

        # Update record
        # dynamodb.put_item(...)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Keys rotated successfully',
                'patient_id': patient_id
            })
        }

    except Exception as e:
        print(f"Error rotating keys: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
