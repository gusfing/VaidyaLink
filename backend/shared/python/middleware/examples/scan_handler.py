"""
Example Lambda handler demonstrating RBAC usage
This handler manages scan job operations with role-based access control
"""

import json
from datetime import datetime
from middleware.auth import create_auth_middleware
from middleware.rbac import require_permission, require_ownership, Permission

# Initialize auth middleware
auth_middleware = create_auth_middleware()


def get_scan_job(event, context):
    """
    GET /api/v1/scans/:jobId
    Retrieve scan job details
    Requires: scan:read:own or scan:read:all permission
    Patients can only access their own scans
    """
    # Step 1: Authenticate user
    auth_result = auth_middleware(event)
    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Unauthorized', 'message': auth_result['error']}),
        }

    # Step 2: Check permissions
    perm_check = require_permission([Permission.SCAN_READ_OWN, Permission.SCAN_READ_ALL])
    perm_result = perm_check(event)

    if not perm_result['authorized']:
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Forbidden', 'message': perm_result['error']}),
        }

    # Step 3: Check resource ownership (for patients)
    async def get_resource_owner_id(event):
        job_id = event['pathParameters']['jobId']
        # In real implementation, fetch from DynamoDB
        # job = await dynamodb.get_item(TableName='ScanJobs', Key={'jobId': job_id})
        # return job['Item']['patientId']

        # Mock for example
        return 'patient-123'

    # Note: In real implementation, use async handler
    # ownership_check = require_ownership(get_resource_owner_id)
    # owner_result = await ownership_check(event)

    # For this example, we'll skip async ownership check
    user = event['user']

    # Step 4: Business logic
    job_id = event['pathParameters']['jobId']

    # Mock response
    scan_job = {
        'jobId': job_id,
        'patientId': 'patient-123',
        'status': 'completed',
        'imageUrl': 's3://bucket/image.jpg',
        'extractedData': {
            'patientName': 'John Doe',
            'medications': ['Aspirin 100mg'],
        },
        'createdAt': '2024-01-15T10:30:00Z',
    }

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'success': True,
            'data': scan_job,
            'requestedBy': user['username'],
        }),
    }


def create_scan_job(event, context):
    """
    POST /api/v1/scans
    Create new scan job
    Requires: scan:upload permission
    """
    # Step 1: Authenticate user
    auth_result = auth_middleware(event)
    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Unauthorized', 'message': auth_result['error']}),
        }

    # Step 2: Check permissions
    perm_check = require_permission([Permission.SCAN_UPLOAD])
    perm_result = perm_check(event)

    if not perm_result['authorized']:
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Forbidden', 'message': perm_result['error']}),
        }

    # Step 3: Check rate limit
    user = event['user']
    print(f"User {user['username']} rate limit: {user['rate_limit']}")

    # Step 4: Business logic
    body = json.loads(event['body'])
    job_id = f"job-{int(datetime.now().timestamp())}"

    # Mock response
    scan_job = {
        'jobId': job_id,
        'patientId': user['sub'],
        'status': 'pending',
        'imageS3Key': body['imageS3Key'],
        'createdAt': datetime.now().isoformat(),
    }

    return {
        'statusCode': 201,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'success': True,
            'data': scan_job,
            'message': 'Scan job created successfully',
        }),
    }


def delete_scan_job(event, context):
    """
    DELETE /api/v1/scans/:jobId
    Delete scan job
    Requires: scan:delete:own or scan:delete:all permission
    Patients can only delete their own scans
    """
    # Step 1: Authenticate user
    auth_result = auth_middleware(event)
    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Unauthorized', 'message': auth_result['error']}),
        }

    # Step 2: Check permissions
    perm_check = require_permission([Permission.SCAN_DELETE_OWN, Permission.SCAN_DELETE_ALL])
    perm_result = perm_check(event)

    if not perm_result['authorized']:
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Forbidden', 'message': perm_result['error']}),
        }

    # Step 3: Business logic
    job_id = event['pathParameters']['jobId']

    # Mock deletion
    print(f"Deleting scan job {job_id}")

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'success': True,
            'message': 'Scan job deleted successfully',
        }),
    }
