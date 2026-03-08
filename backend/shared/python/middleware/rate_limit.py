"""
Rate Limiting Middleware for Lambda Functions
Implements token bucket algorithm with DynamoDB
"""

import os
import time
import json
from typing import Dict, Any, Optional
import boto3
from botocore.exceptions import ClientError

from .rbac import get_rate_limit, Role

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')
RATE_LIMIT_TABLE = os.environ.get('RATE_LIMIT_TABLE', 'vaidyalink-dev-rate-limits')
table = dynamodb.Table(RATE_LIMIT_TABLE)


def check_rate_limit(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check if user has exceeded rate limit

    Args:
        event: Lambda event object with user context

    Returns:
        Dict with keys: allowed, tier, limit, remaining, retryAfter

    Usage:
        from middleware.rate_limit import check_rate_limit

        def lambda_handler(event, context):
            # After authentication
            rate_limit_result = check_rate_limit(event)
            if not rate_limit_result['allowed']:
                return {
                    'statusCode': 429,
                    'body': json.dumps({
                        'message': 'Rate limit exceeded',
                        **rate_limit_result
                    })
                }
            # Continue with request processing
    """
    try:
        # Extract user information from event
        user = event.get('user') or event.get('requestContext', {}).get('authorizer', {}).get('claims')

        if not user:
            print('WARNING: No user context found for rate limiting')
            # Fail open - allow request if no user context
            return {
                'allowed': True,
                'tier': 'Unknown',
                'limit': 0,
                'remaining': 0,
                'retryAfter': 0,
            }

        user_id = user.get('sub') or user.get('userId')
        user_groups = user.get('groups') or user.get('cognito:groups') or []

        # Get rate limit for user's tier
        rate_limit = get_rate_limit(user_groups)
        tier = get_user_tier(user_groups)

        # Check rate limit in DynamoDB
        result = check_rate_limit_in_db(user_id, tier, rate_limit)

        return result
    except Exception as error:
        print(f'ERROR: Rate limit check failed: {error}')
        # Fail open - allow request on error to prevent service disruption
        return {
            'allowed': True,
            'tier': 'Unknown',
            'limit': 0,
            'remaining': 0,
            'retryAfter': 0,
            'error': str(error),
        }


def check_rate_limit_in_db(user_id: str, tier: str, rate_limit: Dict[str, int]) -> Dict[str, Any]:
    """
    Check rate limit in DynamoDB using token bucket algorithm
    """
    now = int(time.time() * 1000)  # milliseconds
    window_start = (now // 60000) * 60000  # 1-minute window
    ttl = (window_start + 120000) // 1000  # Expire after 2 minutes

    try:
        # Query current window
        response = table.query(
            KeyConditionExpression='userId = :userId AND windowStart = :windowStart',
            ExpressionAttributeValues={
                ':userId': user_id,
                ':windowStart': window_start,
            }
        )

        current_count = 0
        if response.get('Items'):
            current_count = response['Items'][0].get('requestCount', 0)

        # Check against burst capacity
        if current_count >= rate_limit['burst_capacity']:
            retry_after = (window_start + 60000 - now) // 1000
            return {
                'allowed': False,
                'tier': tier,
                'limit': rate_limit['requests_per_minute'],
                'remaining': 0,
                'retryAfter': max(1, retry_after),
            }

        # Increment counter
        table.put_item(
            Item={
                'userId': user_id,
                'windowStart': window_start,
                'requestCount': current_count + 1,
                'tier': tier,
                'ttl': ttl,
                'lastRequest': now,
            }
        )

        return {
            'allowed': True,
            'tier': tier,
            'limit': rate_limit['requests_per_minute'],
            'remaining': rate_limit['burst_capacity'] - current_count - 1,
            'retryAfter': 0,
        }
    except ClientError as error:
        print(f'ERROR: DynamoDB operation failed: {error}')
        # Fail open on database errors
        return {
            'allowed': True,
            'tier': tier,
            'limit': rate_limit['requests_per_minute'],
            'remaining': 0,
            'retryAfter': 0,
            'error': str(error),
        }


def get_user_tier(user_groups) -> str:
    """
    Determine user tier from Cognito groups
    """
    if not user_groups:
        return 'Patient'

    # Parse groups if it's a JSON string
    groups = user_groups
    if isinstance(user_groups, str):
        try:
            groups = json.loads(user_groups)
        except (json.JSONDecodeError, ValueError):
            groups = [user_groups]

    if not isinstance(groups, list):
        groups = [groups]

    # Priority order: Admin > HealthcareProvider > HITLVerifier > Patient
    if 'admins' in groups or 'Admin' in groups:
        return 'Admin'
    if 'providers' in groups or 'HealthcareProvider' in groups:
        return 'HealthcareProvider'
    if 'hitl_verifiers' in groups or 'HITLVerifier' in groups:
        return 'HITLVerifier'

    return 'Patient'


def get_rate_limit_headers(rate_limit_result: Dict[str, Any]) -> Dict[str, str]:
    """
    Create rate limit response headers

    Args:
        rate_limit_result: Result from check_rate_limit

    Returns:
        Headers dictionary
    """
    headers = {
        'X-RateLimit-Limit': str(rate_limit_result['limit']),
        'X-RateLimit-Remaining': str(rate_limit_result['remaining']),
        'X-RateLimit-Reset': str(int(time.time()) + rate_limit_result['retryAfter']),
    }

    if rate_limit_result['retryAfter'] > 0:
        headers['Retry-After'] = str(rate_limit_result['retryAfter'])

    return headers


def create_rate_limit_response(rate_limit_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create rate limit exceeded response

    Args:
        rate_limit_result: Result from check_rate_limit

    Returns:
        Lambda response object
    """
    return {
        'statusCode': 429,
        'headers': {
            'Content-Type': 'application/json',
            **get_rate_limit_headers(rate_limit_result),
        },
        'body': json.dumps({
            'message': 'Rate limit exceeded',
            'tier': rate_limit_result['tier'],
            'limit': rate_limit_result['limit'],
            'retryAfter': rate_limit_result['retryAfter'],
        }),
    }
