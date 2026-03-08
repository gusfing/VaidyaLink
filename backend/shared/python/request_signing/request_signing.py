"""
Request Signing Utilities for VaidyaLink

Implements HMAC-SHA256 request signing for sensitive operations
to prevent replay attacks and ensure request integrity.
"""

import hmac
import hashlib
import json
import time
from typing import Dict, Any, Optional, Callable, List


def generate_signature(
    method: str,
    path: str,
    body: Any,
    secret: str,
    timestamp: int
) -> str:
    """
    Generate HMAC-SHA256 signature for request

    Args:
        method: HTTP method (GET, POST, etc.)
        path: Request path
        body: Request body (string or dict)
        secret: Signing secret
        timestamp: Unix timestamp in seconds

    Returns:
        HMAC-SHA256 signature as hex string
    """
    # Normalize body
    if isinstance(body, dict):
        normalized_body = json.dumps(body, separators=(',', ':'), sort_keys=True)
    elif body is None:
        normalized_body = '{}'
    else:
        normalized_body = str(body)

    # Create canonical string
    canonical_string = '\n'.join([
        method.upper(),
        path,
        str(timestamp),
        normalized_body
    ])

    # Generate HMAC-SHA256 signature
    signature = hmac.new(
        secret.encode('utf-8'),
        canonical_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return signature


def verify_signature(
    method: str,
    path: str,
    body: Any,
    secret: str,
    provided_signature: str,
    provided_timestamp: int,
    max_age_seconds: int = 300
) -> Dict[str, Any]:
    """
    Verify request signature

    Args:
        method: HTTP method
        path: Request path
        body: Request body
        secret: Signing secret
        provided_signature: Signature from request
        provided_timestamp: Timestamp from request
        max_age_seconds: Maximum age of request in seconds

    Returns:
        Dictionary with verification result
    """
    # Check timestamp validity
    current_timestamp = int(time.time())
    age = current_timestamp - provided_timestamp

    if age > max_age_seconds:
        return {
            'valid': False,
            'error': 'REQUEST_EXPIRED',
            'message': f'Request expired. Age: {age}s, Max: {max_age_seconds}s'
        }

    if age < -60:
        return {
            'valid': False,
            'error': 'TIMESTAMP_FUTURE',
            'message': 'Request timestamp is in the future'
        }

    # Generate expected signature
    expected_signature = generate_signature(
        method=method,
        path=path,
        body=body,
        secret=secret,
        timestamp=provided_timestamp
    )

    # Constant-time comparison to prevent timing attacks
    valid = hmac.compare_digest(expected_signature, provided_signature)

    if not valid:
        return {
            'valid': False,
            'error': 'INVALID_SIGNATURE',
            'message': 'Signature verification failed'
        }

    return {'valid': True}


def create_signature_middleware(
    get_secret: Callable,
    max_age_seconds: int = 300,
    sensitive_operations: Optional[List[str]] = None
):
    """
    Create middleware for Lambda to verify request signatures

    Args:
        get_secret: Function to retrieve signing secret
        max_age_seconds: Maximum request age
        sensitive_operations: List of operations requiring signing

    Returns:
        Middleware function
    """
    if not callable(get_secret):
        raise ValueError('get_secret must be a callable')

    sensitive_ops = sensitive_operations or []

    async def middleware(event: Dict[str, Any]) -> Dict[str, Any]:
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')
        headers = event.get('headers', {})
        body = event.get('body', '')

        # Check if operation requires signing
        requires_signing = (
            len(sensitive_ops) == 0 or
            any(op in path for op in sensitive_ops)
        )

        if not requires_signing:
            return {'verified': True, 'skipped': True}

        # Extract signature and timestamp from headers
        signature = (
            headers.get('X-VaidyaLink-Signature') or
            headers.get('x-vaidyalink-signature')
        )
        timestamp_str = (
            headers.get('X-VaidyaLink-Timestamp') or
            headers.get('x-vaidyalink-timestamp')
        )

        if not signature or not timestamp_str:
            return {
                'statusCode': 401,
                'body': json.dumps({
                    'error': 'MISSING_SIGNATURE',
                    'message': 'Request signature and timestamp are required'
                })
            }

        try:
            timestamp = int(timestamp_str)
        except ValueError:
            return {
                'statusCode': 401,
                'body': json.dumps({
                    'error': 'INVALID_TIMESTAMP',
                    'message': 'Timestamp must be a valid integer'
                })
            }

        # Get signing secret
        try:
            secret = await get_secret(event) if hasattr(get_secret, '__call__') else get_secret(event)
        except Exception as error:
            print(f'Failed to retrieve signing secret: {error}')
            return {
                'statusCode': 500,
                'body': json.dumps({
                    'error': 'INTERNAL_ERROR',
                    'message': 'Failed to verify request signature'
                })
            }

        # Verify signature
        verification = verify_signature(
            method=http_method,
            path=path,
            body=body,
            secret=secret,
            provided_signature=signature,
            provided_timestamp=timestamp,
            max_age_seconds=max_age_seconds
        )

        if not verification['valid']:
            return {
                'statusCode': 401,
                'body': json.dumps({
                    'error': verification['error'],
                    'message': verification['message']
                })
            }

        return {'verified': True}

    return middleware
