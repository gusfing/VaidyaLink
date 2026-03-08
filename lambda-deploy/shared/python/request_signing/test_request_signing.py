"""
Tests for request signing utilities
"""

import pytest
import time
import json
from request_signing import (
    generate_signature,
    verify_signature,
    create_signature_middleware
)


class TestGenerateSignature:
    def test_consistent_signatures(self):
        """Should generate consistent signatures for same input"""
        timestamp = int(time.time())
        secret = 'test-secret-key-12345'

        sig1 = generate_signature(
            method='POST',
            path='/api/v1/patients/123/delete',
            body={'patientId': '123'},
            secret=secret,
            timestamp=timestamp
        )

        sig2 = generate_signature(
            method='POST',
            path='/api/v1/patients/123/delete',
            body={'patientId': '123'},
            secret=secret,
            timestamp=timestamp
        )

        assert sig1 == sig2
        assert len(sig1) == 64  # SHA256 hex length

    def test_different_methods(self):
        """Should generate different signatures for different methods"""
        timestamp = int(time.time())
        secret = 'test-secret-key-12345'

        get_sig = generate_signature(
            method='GET',
            path='/api/v1/patients/123',
            body={},
            secret=secret,
            timestamp=timestamp
        )

        post_sig = generate_signature(
            method='POST',
            path='/api/v1/patients/123',
            body={},
            secret=secret,
            timestamp=timestamp
        )

        assert get_sig != post_sig

    def test_different_paths(self):
        """Should generate different signatures for different paths"""
        timestamp = int(time.time())
        secret = 'test-secret-key-12345'

        sig1 = generate_signature(
            method='POST',
            path='/api/v1/path1',
            body={},
            secret=secret,
            timestamp=timestamp
        )

        sig2 = generate_signature(
            method='POST',
            path='/api/v1/path2',
            body={},
            secret=secret,
            timestamp=timestamp
        )

        assert sig1 != sig2

    def test_different_bodies(self):
        """Should generate different signatures for different bodies"""
        timestamp = int(time.time())
        secret = 'test-secret-key-12345'

        sig1 = generate_signature(
            method='POST',
            path='/api/v1/test',
            body={'data': 'value1'},
            secret=secret,
            timestamp=timestamp
        )

        sig2 = generate_signature(
            method='POST',
            path='/api/v1/test',
            body={'data': 'value2'},
            secret=secret,
            timestamp=timestamp
        )

        assert sig1 != sig2

    def test_string_body(self):
        """Should handle string body"""
        timestamp = int(time.time())
        secret = 'test-secret-key-12345'

        signature = generate_signature(
            method='POST',
            path='/api/v1/test',
            body='{"data":"value"}',
            secret=secret,
            timestamp=timestamp
        )

        assert signature
        assert len(signature) == 64


class TestVerifySignature:
    def test_valid_signature(self):
        """Should verify valid signature"""
        timestamp = int(time.time())
        secret = 'test-secret-key-12345'
        body = {'data': 'value'}

        signature = generate_signature(
            method='POST',
            path='/api/v1/test',
            body=body,
            secret=secret,
            timestamp=timestamp
        )

        result = verify_signature(
            method='POST',
            path='/api/v1/test',
            body=body,
            secret=secret,
            provided_signature=signature,
            provided_timestamp=timestamp,
            max_age_seconds=300
        )

        assert result['valid'] is True

    def test_expired_request(self):
        """Should reject expired request"""
        timestamp = int(time.time()) - 400  # 400 seconds ago
        secret = 'test-secret-key-12345'

        signature = generate_signature(
            method='POST',
            path='/api/v1/test',
            body={},
            secret=secret,
            timestamp=timestamp
        )

        result = verify_signature(
            method='POST',
            path='/api/v1/test',
            body={},
            secret=secret,
            provided_signature=signature,
            provided_timestamp=timestamp,
            max_age_seconds=300
        )

        assert result['valid'] is False
        assert result['error'] == 'REQUEST_EXPIRED'

    def test_future_timestamp(self):
        """Should reject future timestamp"""
        timestamp = int(time.time()) + 120  # 2 minutes in future
        secret = 'test-secret-key-12345'

        signature = generate_signature(
            method='POST',
            path='/api/v1/test',
            body={},
            secret=secret,
            timestamp=timestamp
        )

        result = verify_signature(
            method='POST',
            path='/api/v1/test',
            body={},
            secret=secret,
            provided_signature=signature,
            provided_timestamp=timestamp,
            max_age_seconds=300
        )

        assert result['valid'] is False
        assert result['error'] == 'TIMESTAMP_FUTURE'

    def test_invalid_signature(self):
        """Should reject invalid signature"""
        timestamp = int(time.time())
        secret = 'test-secret-key-12345'

        result = verify_signature(
            method='POST',
            path='/api/v1/test',
            body={},
            secret=secret,
            provided_signature='invalid-signature-12345',
            provided_timestamp=timestamp,
            max_age_seconds=300
        )

        assert result['valid'] is False
        assert result['error'] == 'INVALID_SIGNATURE'

    def test_wrong_secret(self):
        """Should reject signature with wrong secret"""
        timestamp = int(time.time())
        secret = 'test-secret-key-12345'

        signature = generate_signature(
            method='POST',
            path='/api/v1/test',
            body={},
            secret=secret,
            timestamp=timestamp
        )

        result = verify_signature(
            method='POST',
            path='/api/v1/test',
            body={},
            secret='wrong-secret',
            provided_signature=signature,
            provided_timestamp=timestamp,
            max_age_seconds=300
        )

        assert result['valid'] is False
        assert result['error'] == 'INVALID_SIGNATURE'


class TestCreateSignatureMiddleware:
    def test_missing_get_secret(self):
        """Should raise error if getSecret is not provided"""
        with pytest.raises(ValueError, match='get_secret must be a callable'):
            create_signature_middleware(get_secret=None)

    @pytest.mark.asyncio
    async def test_skip_non_sensitive_operations(self):
        """Should skip verification for non-sensitive operations"""
        get_secret = lambda event: 'secret'
        middleware = create_signature_middleware(
            get_secret=get_secret,
            sensitive_operations=['/delete', '/update']
        )

        event = {
            'httpMethod': 'GET',
            'path': '/api/v1/patients/123',
            'headers': {},
            'body': ''
        }

        result = await middleware(event)

        assert result['verified'] is True
        assert result['skipped'] is True

    @pytest.mark.asyncio
    async def test_require_signature_for_sensitive_operations(self):
        """Should require signature for sensitive operations"""
        get_secret = lambda event: 'secret'
        middleware = create_signature_middleware(
            get_secret=get_secret,
            sensitive_operations=['/delete']
        )

        event = {
            'httpMethod': 'DELETE',
            'path': '/api/v1/patients/123/delete',
            'headers': {},
            'body': ''
        }

        result = await middleware(event)

        assert result['statusCode'] == 401
        body = json.loads(result['body'])
        assert body['error'] == 'MISSING_SIGNATURE'

    @pytest.mark.asyncio
    async def test_verify_valid_signature(self):
        """Should verify valid signature"""
        timestamp = int(time.time())
        secret = 'test-secret-key-12345'
        body = {'patientId': '123'}

        signature = generate_signature(
            method='DELETE',
            path='/api/v1/patients/123/delete',
            body=json.dumps(body),
            secret=secret,
            timestamp=timestamp
        )

        get_secret = lambda event: secret
        middleware = create_signature_middleware(
            get_secret=get_secret,
            max_age_seconds=300
        )

        event = {
            'httpMethod': 'DELETE',
            'path': '/api/v1/patients/123/delete',
            'headers': {
                'X-VaidyaLink-Signature': signature,
                'X-VaidyaLink-Timestamp': str(timestamp)
            },
            'body': json.dumps(body)
        }

        result = await middleware(event)

        assert result['verified'] is True

    @pytest.mark.asyncio
    async def test_reject_invalid_signature(self):
        """Should reject invalid signature"""
        timestamp = int(time.time())
        secret = 'test-secret-key-12345'

        get_secret = lambda event: secret
        middleware = create_signature_middleware(get_secret=get_secret)

        event = {
            'httpMethod': 'DELETE',
            'path': '/api/v1/patients/123/delete',
            'headers': {
                'X-VaidyaLink-Signature': 'invalid-signature',
                'X-VaidyaLink-Timestamp': str(timestamp)
            },
            'body': ''
        }

        result = await middleware(event)

        assert result['statusCode'] == 401
        body = json.loads(result['body'])
        assert body['error'] == 'INVALID_SIGNATURE'

    @pytest.mark.asyncio
    async def test_handle_get_secret_errors(self):
        """Should handle getSecret errors"""
        timestamp = int(time.time())

        def get_secret(event):
            raise Exception('Secret retrieval failed')

        middleware = create_signature_middleware(get_secret=get_secret)

        event = {
            'httpMethod': 'DELETE',
            'path': '/api/v1/test',
            'headers': {
                'X-VaidyaLink-Signature': 'some-signature',
                'X-VaidyaLink-Timestamp': str(timestamp)
            },
            'body': ''
        }

        result = await middleware(event)

        assert result['statusCode'] == 500
        body = json.loads(result['body'])
        assert body['error'] == 'INTERNAL_ERROR'
