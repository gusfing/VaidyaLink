"""
DynamoDB Query Helpers

Optimized query utilities for VaidyaLink DynamoDB tables.
Uses GSIs efficiently and implements best practices for pagination and filtering.
"""

import os
from typing import Dict, List, Optional, Any
from datetime import datetime
import boto3
from boto3.dynamodb.conditions import Key

# Initialize DynamoDB resource
dynamodb = boto3.resource(
    'dynamodb',
    region_name=os.environ.get('AWS_REGION', 'ap-south-1')
)

ENVIRONMENT = os.environ.get('ENVIRONMENT', 'dev')


def get_patient_scans(
    patient_id: str,
    limit: int = 20,
    ascending: bool = False,
    start_date: Optional[str] = None,
    last_evaluated_key: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Query all scan jobs for a specific patient.
    Uses PatientIndex GSI for efficient querying.

    Args:
        patient_id: Patient identifier
        limit: Maximum items to return (default: 20)
        ascending: Sort order (default: False = newest first)
        start_date: ISO 8601 date to filter from
        last_evaluated_key: Pagination token

    Returns:
        Dictionary with 'items', 'last_evaluated_key', and 'count'
    """
    table_name = f'vaidyalink-scanjobs-{ENVIRONMENT}'
    table = dynamodb.Table(table_name)

    # Build key condition
    key_condition = Key('patientId').eq(patient_id)
    if start_date:
        key_condition &= Key('createdAt').gte(start_date)

    query_params = {
        'IndexName': 'PatientIndex',
        'KeyConditionExpression': key_condition,
        'ScanIndexForward': ascending,
        'Limit': limit,
    }

    if last_evaluated_key:
        query_params['ExclusiveStartKey'] = last_evaluated_key

    response = table.query(**query_params)

    return {
        'items': response.get('Items', []),
        'last_evaluated_key': response.get('LastEvaluatedKey'),
        'count': response.get('Count', 0),
    }


def get_scans_by_status(
    status: str,
    limit: int = 50,
    ascending: bool = True,
    last_evaluated_key: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Query all scan jobs by status.
    Uses StatusIndex GSI for workflow management.

    Args:
        status: Job status (pending, processing, completed, failed, hitl_required)
        limit: Maximum items to return (default: 50)
        ascending: Sort order (default: True = oldest first for FIFO)
        last_evaluated_key: Pagination token

    Returns:
        Dictionary with 'items', 'last_evaluated_key', and 'count'
    """
    table_name = f'vaidyalink-scanjobs-{ENVIRONMENT}'
    table = dynamodb.Table(table_name)

    query_params = {
        'IndexName': 'StatusIndex',
        'KeyConditionExpression': Key('status').eq(status),
        'ScanIndexForward': ascending,
        'Limit': limit,
    }

    if last_evaluated_key:
        query_params['ExclusiveStartKey'] = last_evaluated_key

    response = table.query(**query_params)

    return {
        'items': response.get('Items', []),
        'last_evaluated_key': response.get('LastEvaluatedKey'),
        'count': response.get('Count', 0),
    }


def get_hitl_queue(limit: int = 20) -> List[Dict]:
    """
    Get HITL verification queue.
    Optimized query for jobs requiring human verification.

    Args:
        limit: Maximum items to return (default: 20)

    Returns:
        List of scan jobs requiring HITL verification
    """
    result = get_scans_by_status(
        status='hitl_required',
        limit=limit,
        ascending=True  # Oldest first (FIFO)
    )

    return result['items']


def get_patient_by_abha(abha_id: str) -> Optional[Dict]:
    """
    Find patient by ABHA ID.
    Uses ABHAIndex GSI for efficient lookup.

    Args:
        abha_id: Ayushman Bharat Health Account ID

    Returns:
        Patient object or None if not found
    """
    table_name = f'vaidyalink-patients-{ENVIRONMENT}'
    table = dynamodb.Table(table_name)

    response = table.query(
        IndexName='ABHAIndex',
        KeyConditionExpression=Key('abhaId').eq(abha_id),
        Limit=1  # Should only be one patient per ABHA ID
    )

    items = response.get('Items', [])
    return items[0] if items else None


def get_patient_voice_jobs(
    patient_id: str,
    limit: int = 20,
    ascending: bool = False,
    last_evaluated_key: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Query all voice jobs for a specific patient.
    Uses PatientIndex GSI.

    Args:
        patient_id: Patient identifier
        limit: Maximum items to return (default: 20)
        ascending: Sort order (default: False = newest first)
        last_evaluated_key: Pagination token

    Returns:
        Dictionary with 'items', 'last_evaluated_key', and 'count'
    """
    table_name = f'vaidyalink-voicejobs-{ENVIRONMENT}'
    table = dynamodb.Table(table_name)

    query_params = {
        'IndexName': 'PatientIndex',
        'KeyConditionExpression': Key('patientId').eq(patient_id),
        'ScanIndexForward': ascending,
        'Limit': limit,
    }

    if last_evaluated_key:
        query_params['ExclusiveStartKey'] = last_evaluated_key

    response = table.query(**query_params)

    return {
        'items': response.get('Items', []),
        'last_evaluated_key': response.get('LastEvaluatedKey'),
        'count': response.get('Count', 0),
    }


def get_scan_job(job_id: str) -> Optional[Dict]:
    """
    Get a single scan job by ID.
    Direct primary key lookup (most efficient).

    Args:
        job_id: Scan job identifier

    Returns:
        Scan job object or None if not found
    """
    table_name = f'vaidyalink-scanjobs-{ENVIRONMENT}'
    table = dynamodb.Table(table_name)

    response = table.get_item(
        Key={
            'PK': f'JOB#{job_id}',
            'SK': 'METADATA',
        }
    )

    return response.get('Item')


def get_batch_scan_jobs(job_ids: List[str]) -> List[Dict]:
    """
    Get multiple scan jobs by IDs.
    Uses batch_get_item for efficient parallel retrieval.

    Args:
        job_ids: List of job identifiers (max 25)

    Returns:
        List of scan job objects

    Raises:
        ValueError: If more than 25 job IDs provided
    """
    if not job_ids:
        return []

    if len(job_ids) > 25:
        raise ValueError('batch_get_item supports maximum 25 items')

    table_name = f'vaidyalink-scanjobs-{ENVIRONMENT}'

    keys = [
        {'PK': f'JOB#{job_id}', 'SK': 'METADATA'}
        for job_id in job_ids
    ]

    response = dynamodb.batch_get_item(
        RequestItems={
            table_name: {
                'Keys': keys
            }
        }
    )

    return response.get('Responses', {}).get(table_name, [])


def get_patient(patient_id: str) -> Optional[Dict]:
    """
    Get patient profile by ID.
    Direct primary key lookup.

    Args:
        patient_id: Patient identifier

    Returns:
        Patient object or None if not found
    """
    table_name = f'vaidyalink-patients-{ENVIRONMENT}'
    table = dynamodb.Table(table_name)

    response = table.get_item(
        Key={
            'PK': f'PATIENT#{patient_id}',
            'SK': 'PROFILE',
        }
    )

    return response.get('Item')


def get_recent_completed_scans(limit: int = 50) -> List[Dict]:
    """
    Get recent scans across all patients (admin view).
    Uses StatusIndex with 'completed' status.

    Args:
        limit: Maximum items to return (default: 50)

    Returns:
        List of recently completed scan jobs
    """
    result = get_scans_by_status(
        status='completed',
        limit=limit,
        ascending=False  # Most recent first
    )

    return result['items']


def get_all_patient_scans(
    patient_id: str,
    max_items: int = 1000
) -> List[Dict]:
    """
    Paginate through all items for a patient.
    Automatically handles pagination to fetch all items.

    Args:
        patient_id: Patient identifier
        max_items: Maximum total items to fetch (default: 1000)

    Returns:
        All scan jobs for the patient
    """
    all_items = []
    last_evaluated_key = None

    while True:
        result = get_patient_scans(
            patient_id=patient_id,
            limit=100,
            last_evaluated_key=last_evaluated_key
        )

        all_items.extend(result['items'])
        last_evaluated_key = result['last_evaluated_key']

        # Safety check to prevent infinite loops
        if not last_evaluated_key or len(all_items) >= max_items:
            break

    return all_items


def get_scans_by_date_range(
    patient_id: str,
    start_date: str,
    end_date: Optional[str] = None,
    limit: int = 100
) -> List[Dict]:
    """
    Get scans for a patient within a date range.
    Uses PatientIndex GSI with date filtering.

    Args:
        patient_id: Patient identifier
        start_date: ISO 8601 start date
        end_date: ISO 8601 end date (optional, defaults to now)
        limit: Maximum items to return

    Returns:
        List of scan jobs within the date range
    """
    if not end_date:
        end_date = datetime.utcnow().isoformat()

    table_name = f'vaidyalink-scanjobs-{ENVIRONMENT}'
    table = dynamodb.Table(table_name)

    key_condition = Key('patientId').eq(patient_id) & \
                   Key('createdAt').between(start_date, end_date)

    response = table.query(
        IndexName='PatientIndex',
        KeyConditionExpression=key_condition,
        Limit=limit,
        ScanIndexForward=False  # Most recent first
    )

    return response.get('Items', [])


def get_failed_scans(limit: int = 50) -> List[Dict]:
    """
    Get all failed scan jobs for monitoring.
    Uses StatusIndex GSI.

    Args:
        limit: Maximum items to return (default: 50)

    Returns:
        List of failed scan jobs
    """
    result = get_scans_by_status(
        status='failed',
        limit=limit,
        ascending=False  # Most recent failures first
    )

    return result['items']


def get_pending_scans(limit: int = 50) -> List[Dict]:
    """
    Get all pending scan jobs for monitoring.
    Uses StatusIndex GSI.

    Args:
        limit: Maximum items to return (default: 50)

    Returns:
        List of pending scan jobs
    """
    result = get_scans_by_status(
        status='pending',
        limit=limit,
        ascending=True  # Oldest first (FIFO)
    )

    return result['items']


# Export commonly used functions
__all__ = [
    'get_patient_scans',
    'get_scans_by_status',
    'get_hitl_queue',
    'get_patient_by_abha',
    'get_patient_voice_jobs',
    'get_scan_job',
    'get_batch_scan_jobs',
    'get_patient',
    'get_recent_completed_scans',
    'get_all_patient_scans',
    'get_scans_by_date_range',
    'get_failed_scans',
    'get_pending_scans',
]
