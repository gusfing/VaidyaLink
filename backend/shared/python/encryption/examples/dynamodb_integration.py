"""
DynamoDB Integration Examples for VaidyaLink Data Models
Demonstrates field-level encryption for Patient, ScanJobs, and VoiceJobs tables
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, Optional, List
import boto3
from encryption import FieldEncryption


# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'ap-south-1'))

# Initialize encryption
field_encryption = FieldEncryption()


# Patient Table Operations

def store_patient(patient_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Store encrypted patient record in DynamoDB

    Args:
        patient_data: Patient information including sensitive PHI fields

    Returns:
        Success status and patient ID
    """
    try:
        patient_id = patient_data['patientId']

        # Encrypt sensitive fields
        encrypted_patient = field_encryption.encrypt_record(
            patient_data,
            patient_id=patient_id,
            additional_context={
                'table': 'Patients',
                'operation': 'create'
            }
        )

        # Add DynamoDB keys
        item = {
            'PK': f'PATIENT#{patient_id}',
            'SK': 'PROFILE',
            **encrypted_patient,
            'createdAt': datetime.utcnow().isoformat(),
            'updatedAt': datetime.utcnow().isoformat()
        }

        table = dynamodb.Table(os.environ.get('PATIENTS_TABLE', 'VaidyaLink-Patients'))
        table.put_item(Item=item)

        print(f'Patient {patient_id} stored with encrypted PHI fields')
        return {'success': True, 'patientId': patient_id}

    except Exception as e:
        print(f'Error storing patient: {e}')
        raise


def get_patient(patient_id: str, fields_to_decrypt: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
    """
    Retrieve and decrypt patient record from DynamoDB

    Args:
        patient_id: Patient identifier
        fields_to_decrypt: Optional list of specific fields to decrypt (decrypts all if None)

    Returns:
        Decrypted patient record or None if not found
    """
    try:
        table = dynamodb.Table(os.environ.get('PATIENTS_TABLE', 'VaidyaLink-Patients'))

        response = table.get_item(
            Key={
                'PK': f'PATIENT#{patient_id}',
                'SK': 'PROFILE'
            }
        )

        if 'Item' not in response:
            return None

        # Decrypt sensitive fields (partial or full)
        decrypted_patient = field_encryption.decrypt_record(
            response['Item'],
            patient_id=patient_id,
            additional_context={'table': 'Patients', 'operation': 'read'},
            fields_to_decrypt=fields_to_decrypt
        )

        return decrypted_patient

    except Exception as e:
        print(f'Error retrieving patient: {e}')
        raise


def update_patient(patient_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update patient record with encrypted fields

    Args:
        patient_id: Patient identifier
        updates: Dictionary of fields to update

    Returns:
        Success status and patient ID
    """
    try:
        # Encrypt any sensitive fields in updates
        encrypted_updates = field_encryption.encrypt_record(
            updates,
            patient_id=patient_id,
            additional_context={'table': 'Patients', 'operation': 'update'}
        )

        # Build update expression
        update_expressions = []
        expression_attribute_names = {}
        expression_attribute_values = {}

        for idx, (key, value) in enumerate(encrypted_updates.items()):
            attr_name = f'#attr{idx}'
            attr_value = f':val{idx}'
            update_expressions.append(f'{attr_name} = {attr_value}')
            expression_attribute_names[attr_name] = key
            expression_attribute_values[attr_value] = value

        # Add updatedAt
        update_expressions.append('#updatedAt = :updatedAt')
        expression_attribute_names['#updatedAt'] = 'updatedAt'
        expression_attribute_values[':updatedAt'] = datetime.utcnow().isoformat()

        table = dynamodb.Table(os.environ.get('PATIENTS_TABLE', 'VaidyaLink-Patients'))
        table.update_item(
            Key={
                'PK': f'PATIENT#{patient_id}',
                'SK': 'PROFILE'
            },
            UpdateExpression=f"SET {', '.join(update_expressions)}",
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values
        )

        print(f'Patient {patient_id} updated with encrypted fields')
        return {'success': True, 'patientId': patient_id}

    except Exception as e:
        print(f'Error updating patient: {e}')
        raise


# ScanJobs Table Operations

def store_scan_job(scan_job_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Store encrypted scan job with extracted data

    Args:
        scan_job_data: Scan job information including extracted medical data

    Returns:
        Success status and job ID
    """
    try:
        job_id = scan_job_data['jobId']
        patient_id = scan_job_data['patientId']

        # Encrypt sensitive extracted data
        encrypted_job = field_encryption.encrypt_record(
            scan_job_data,
            patient_id=patient_id,
            additional_context={
                'table': 'ScanJobs',
                'job_id': job_id,
                'operation': 'create'
            }
        )

        item = {
            'PK': f'JOB#{job_id}',
            'SK': 'METADATA',
            **encrypted_job,
            'createdAt': datetime.utcnow().isoformat(),
            'updatedAt': datetime.utcnow().isoformat()
        }

        table = dynamodb.Table(os.environ.get('SCANJOBS_TABLE', 'VaidyaLink-ScanJobs'))
        table.put_item(Item=item)

        print(f'Scan job {job_id} stored with encrypted extracted data')
        return {'success': True, 'jobId': job_id}

    except Exception as e:
        print(f'Error storing scan job: {e}')
        raise


def get_scan_job(job_id: str, patient_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve and decrypt scan job

    Args:
        job_id: Scan job identifier
        patient_id: Patient identifier (required for decryption context)

    Returns:
        Decrypted scan job or None if not found
    """
    try:
        table = dynamodb.Table(os.environ.get('SCANJOBS_TABLE', 'VaidyaLink-ScanJobs'))

        response = table.get_item(
            Key={
                'PK': f'JOB#{job_id}',
                'SK': 'METADATA'
            }
        )

        if 'Item' not in response:
            return None

        # Decrypt extracted data
        decrypted_job = field_encryption.decrypt_record(
            response['Item'],
            patient_id=patient_id,
            additional_context={
                'table': 'ScanJobs',
                'job_id': job_id,
                'operation': 'read'
            }
        )

        return decrypted_job

    except Exception as e:
        print(f'Error retrieving scan job: {e}')
        raise


# VoiceJobs Table Operations

def store_voice_job(voice_job_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Store encrypted voice job with transcription

    Args:
        voice_job_data: Voice job information including transcription

    Returns:
        Success status and job ID
    """
    try:
        job_id = voice_job_data['jobId']
        patient_id = voice_job_data['patientId']

        # Encrypt transcription and extracted medical data
        encrypted_job = field_encryption.encrypt_record(
            voice_job_data,
            patient_id=patient_id,
            additional_context={
                'table': 'VoiceJobs',
                'job_id': job_id,
                'operation': 'create'
            }
        )

        item = {
            'PK': f'VOICE#{job_id}',
            'SK': 'METADATA',
            **encrypted_job,
            'createdAt': datetime.utcnow().isoformat(),
            'updatedAt': datetime.utcnow().isoformat()
        }

        table = dynamodb.Table(os.environ.get('VOICEJOBS_TABLE', 'VaidyaLink-VoiceJobs'))
        table.put_item(Item=item)

        print(f'Voice job {job_id} stored with encrypted transcription')
        return {'success': True, 'jobId': job_id}

    except Exception as e:
        print(f'Error storing voice job: {e}')
        raise


def get_voice_job(job_id: str, patient_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve and decrypt voice job

    Args:
        job_id: Voice job identifier
        patient_id: Patient identifier (required for decryption context)

    Returns:
        Decrypted voice job or None if not found
    """
    try:
        table = dynamodb.Table(os.environ.get('VOICEJOBS_TABLE', 'VaidyaLink-VoiceJobs'))

        response = table.get_item(
            Key={
                'PK': f'VOICE#{job_id}',
                'SK': 'METADATA'
            }
        )

        if 'Item' not in response:
            return None

        # Decrypt transcription
        decrypted_job = field_encryption.decrypt_record(
            response['Item'],
            patient_id=patient_id,
            additional_context={
                'table': 'VoiceJobs',
                'job_id': job_id,
                'operation': 'read'
            }
        )

        return decrypted_job

    except Exception as e:
        print(f'Error retrieving voice job: {e}')
        raise


# Example: Complete workflow for document processing

def complete_document_processing_workflow():
    """
    Example workflow demonstrating complete document processing with encryption
    """
    try:
        # 1. Create patient record
        patient_data = {
            'patientId': 'patient-123',
            'name': 'Rajesh Kumar',
            'dateOfBirth': '1985-06-15',
            'phone': '+91-9876543210',
            'email': 'rajesh.kumar@example.com',
            'abhaId': '12-3456-7890-1234',
            'address': '123 MG Road, Mumbai, Maharashtra',
            'preferredLanguage': 'hi'
        }

        store_patient(patient_data)

        # 2. Process document scan
        scan_job_data = {
            'jobId': 'scan-456',
            'patientId': 'patient-123',
            'status': 'completed',
            'imageS3Key': 'raw/patient-123/scan-456/original.jpg',
            'extractedData': json.dumps({
                'diagnosis': 'Type 2 Diabetes Mellitus',
                'prescriptionDetails': 'Metformin 500mg twice daily',
                'doctorNotes': 'Patient shows good compliance with medication'
            }),
            'confidenceScores': {
                'diagnosis': 0.95,
                'prescriptionDetails': 0.92
            }
        }

        store_scan_job(scan_job_data)

        # 3. Process voice recording
        voice_job_data = {
            'jobId': 'voice-789',
            'patientId': 'patient-123',
            'status': 'completed',
            'audioS3Key': 'audio/patient-123/voice-789/recording.wav',
            'language': 'hi',
            'transcription': 'मुझे पिछले तीन महीनों से सिरदर्द हो रहा है',
            'transcribedText': 'I have been having headaches for the past three months',
            'transcriptionConfidence': 0.89
        }

        store_voice_job(voice_job_data)

        # 4. Retrieve patient with only name decrypted (for display)
        patient_summary = get_patient('patient-123', fields_to_decrypt=['name'])
        print(f'Patient summary: {patient_summary}')

        # 5. Retrieve full scan job data
        scan_job = get_scan_job('scan-456', 'patient-123')
        print(f'Scan job with decrypted data: {scan_job}')

        print('Complete workflow executed successfully')

    except Exception as e:
        print(f'Workflow error: {e}')
        raise


if __name__ == '__main__':
    # Run example workflow
    complete_document_processing_workflow()
