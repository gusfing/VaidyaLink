"""
Unit tests for security headers middleware
"""

import pytest
import json
from security_headers import (
    SecurityHeadersMiddleware,
    create_security_headers_middleware,
    with_security_headers,
    DEFAULT_HEADERS,
    PRESETS,
    get_preset
)


class TestSecurityHeadersMiddleware:
    """Test SecurityHeadersMiddleware class"""

    def test_init_with_defaults(self):
        """Should initialize with default headers"""
        middleware = SecurityHeadersMiddleware()
        headers = middleware.get_headers()

        assert 'X-Content-Type-Options' in headers
        assert headers['X-Content-Type-Options'] == 'nosniff'
        assert 'X-Frame-Options' in headers
        assert headers['X-Frame-Options'] == 'DENY'
        assert 'Strict-Transport-Security' in headers

    def test_init_with_custom_headers(self):
        """Should merge custom headers with defaults"""
        middleware = SecurityHeadersMiddleware({
            'headers': {
                'X-Custom-Header': 'custom-value'
            }
        })

        headers = middleware.get_headers()
        assert headers['X-Custom-Header'] == 'custom-value'
        assert headers['X-Content-Type-Options'] == 'nosniff'

    def test_init_override_default_headers(self):
        """Should override default headers with custom values"""
        middleware = SecurityHeadersMiddleware({
            'headers': {
                'X-Frame-Options': 'SAMEORIGIN'
            }
        })

        headers = middleware.get_headers()
        assert headers['X-Frame-Options'] == 'SAMEORIGIN'

    def test_apply_adds_headers(self):
        """Should add security headers to response"""
        middleware = SecurityHeadersMiddleware()
        response = {
            'statusCode': 200,
            'body': json.dumps({'message': 'Success'})
        }

        result = middleware.apply(response)

        assert 'headers' in result
        assert result['headers']['X-Content-Type-Options'] == 'nosniff'
        assert result['headers']['X-Frame-Options'] == 'DENY'
        assert 'max-age=31536000' in result['headers']['Strict-Transport-Security']

    def test_apply_preserves_existing_headers(self):
        """Should preserve existing headers"""
        middleware = SecurityHeadersMiddleware()
        response = {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'X-Custom-Header': 'custom-value'
            },
            'body': json.dumps({'message': 'Success'})
        }

        result = middleware.apply(response)

        assert result['headers']['Content-Type'] == 'application/json'
        assert result['headers']['X-Custom-Header'] == 'custom-value'
        assert result['headers']['X-Content-Type-Options'] == 'nosniff'

    def test_apply_no_overwrite(self):
        """Should not overwrite existing headers when overwrite is False"""
        middleware = SecurityHeadersMiddleware({'overwrite': False})
        response = {
            'statusCode': 200,
            'headers': {
                'X-Frame-Options': 'SAMEORIGIN'
            },
            'body': json.dumps({'message': 'Success'})
        }

        result = middleware.apply(response)

        assert result['headers']['X-Frame-Options'] == 'SAMEORIGIN'

    def test_apply_with_overwrite(self):
        """Should overwrite existing headers when overwrite is True"""
        middleware = SecurityHeadersMiddleware({'overwrite': True})
        response = {
            'statusCode': 200,
            'headers': {
                'X-Frame-Options': 'SAMEORIGIN'
            },
            'body': json.dumps({'message': 'Success'})
        }

        result = middleware.apply(response)

        assert result['headers']['X-Frame-Options'] == 'DENY'

    def test_apply_raises_error_for_none(self):
        """Should raise error if response is None"""
        middleware = SecurityHeadersMiddleware()

        with pytest.raises(ValueError, match='Response object is required'):
            middleware.apply(None)

    def test_apply_creates_headers_dict(self):
        """Should create headers dict if not present"""
        middleware = SecurityHeadersMiddleware()
        response = {
            'statusCode': 200,
            'body': json.dumps({'message': 'Success'})
        }

        result = middleware.apply(response)

        assert 'headers' in result
        assert isinstance(result['headers'], dict)

    def test_set_header(self):
        """Should add new header"""
        middleware = SecurityHeadersMiddleware()
        middleware.set_header('X-New-Header', 'new-value')

        headers = middleware.get_headers()
        assert headers['X-New-Header'] == 'new-value'

    def test_set_header_updates_existing(self):
        """Should update existing header"""
        middleware = SecurityHeadersMiddleware()
        middleware.set_header('X-Frame-Options', 'SAMEORIGIN')

        headers = middleware.get_headers()
        assert headers['X-Frame-Options'] == 'SAMEORIGIN'

    def test_remove_header(self):
        """Should remove header"""
        middleware = SecurityHeadersMiddleware()
        middleware.remove_header('X-Frame-Options')

        headers = middleware.get_headers()
        assert 'X-Frame-Options' not in headers

    def test_remove_nonexistent_header(self):
        """Should not raise error if header does not exist"""
        middleware = SecurityHeadersMiddleware()

        # Should not raise
        middleware.remove_header('Non-Existent-Header')


class TestCreateSecurityHeadersMiddleware:
    """Test create_security_headers_middleware function"""

    def test_returns_function(self):
        """Should return a function"""
        middleware = create_security_headers_middleware()

        assert callable(middleware)

    def test_applies_headers(self):
        """Should apply headers when called"""
        apply_headers = create_security_headers_middleware()
        response = {
            'statusCode': 200,
            'body': json.dumps({'message': 'Success'})
        }

        result = apply_headers(response)

        assert 'headers' in result
        assert result['headers']['X-Content-Type-Options'] == 'nosniff'

    def test_accepts_custom_config(self):
        """Should accept custom configuration"""
        apply_headers = create_security_headers_middleware({
            'headers': {
                'X-Custom-Header': 'custom-value'
            }
        })
        response = {
            'statusCode': 200,
            'body': json.dumps({'message': 'Success'})
        }

        result = apply_headers(response)

        assert result['headers']['X-Custom-Header'] == 'custom-value'


class TestWithSecurityHeaders:
    """Test with_security_headers decorator"""

    def test_wraps_handler(self):
        """Should wrap handler and apply headers"""
        @with_security_headers()
        def handler(event, context):
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'Success'})
            }

        result = handler({}, None)

        assert 'headers' in result
        assert result['headers']['X-Content-Type-Options'] == 'nosniff'
        assert result['headers']['X-Frame-Options'] == 'DENY'

    def test_preserves_handler_response(self):
        """Should preserve handler response"""
        @with_security_headers()
        def handler(event, context):
            return {
                'statusCode': 201,
                'headers': {
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'id': 123, 'message': 'Created'})
            }

        result = handler({}, None)

        assert result['statusCode'] == 201
        assert result['headers']['Content-Type'] == 'application/json'
        assert 'Created' in result['body']

    def test_applies_headers_to_errors(self):
        """Should apply headers to error responses"""
        @with_security_headers()
        def handler(event, context):
            raise Exception('Test error')

        result = handler({}, None)

        assert result['statusCode'] == 500
        assert 'headers' in result
        assert result['headers']['X-Content-Type-Options'] == 'nosniff'
        assert 'Test error' in result['body']

    def test_accepts_custom_config(self):
        """Should accept custom configuration"""
        @with_security_headers({
            'headers': {
                'X-Custom-Header': 'custom-value'
            }
        })
        def handler(event, context):
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'Success'})
            }

        result = handler({}, None)

        assert result['headers']['X-Custom-Header'] == 'custom-value'


class TestDefaultHeaders:
    """Test DEFAULT_HEADERS constant"""

    def test_contains_required_headers(self):
        """Should contain all required security headers"""
        assert 'X-Content-Type-Options' in DEFAULT_HEADERS
        assert 'X-Frame-Options' in DEFAULT_HEADERS
        assert 'X-XSS-Protection' in DEFAULT_HEADERS
        assert 'Strict-Transport-Security' in DEFAULT_HEADERS
        assert 'Referrer-Policy' in DEFAULT_HEADERS
        assert 'Content-Security-Policy' in DEFAULT_HEADERS
        assert 'Permissions-Policy' in DEFAULT_HEADERS

    def test_has_secure_defaults(self):
        """Should have secure default values"""
        assert DEFAULT_HEADERS['X-Content-Type-Options'] == 'nosniff'
        assert DEFAULT_HEADERS['X-Frame-Options'] == 'DENY'
        assert 'max-age=31536000' in DEFAULT_HEADERS['Strict-Transport-Security']


class TestPresets:
    """Test PRESETS constant"""

    def test_has_strict_preset(self):
        """Should have strict preset"""
        assert 'strict' in PRESETS
        assert 'headers' in PRESETS['strict']

    def test_has_api_preset(self):
        """Should have api preset"""
        assert 'api' in PRESETS
        assert 'headers' in PRESETS['api']

    def test_has_development_preset(self):
        """Should have development preset"""
        assert 'development' in PRESETS
        assert 'headers' in PRESETS['development']

    def test_strict_preset_is_restrictive(self):
        """Strict preset should be more restrictive"""
        assert 'max-age=63072000' in PRESETS['strict']['headers']['Strict-Transport-Security']
        assert PRESETS['strict']['headers']['Referrer-Policy'] == 'no-referrer'

    def test_development_preset_is_relaxed(self):
        """Development preset should be more relaxed"""
        assert PRESETS['development']['headers']['X-Frame-Options'] == 'SAMEORIGIN'


class TestGetPreset:
    """Test get_preset function"""

    def test_returns_preset_config(self):
        """Should return preset configuration"""
        preset = get_preset('strict')

        assert 'headers' in preset
        assert 'X-Content-Type-Options' in preset['headers']

    def test_raises_error_for_unknown_preset(self):
        """Should raise error for unknown preset"""
        with pytest.raises(ValueError, match='Unknown preset'):
            get_preset('unknown')

    def test_lists_available_presets_in_error(self):
        """Should list available presets in error message"""
        try:
            get_preset('unknown')
        except ValueError as error:
            assert 'strict' in str(error)
            assert 'api' in str(error)
            assert 'development' in str(error)


class TestIntegration:
    """Integration tests"""

    def test_works_with_preset_config(self):
        """Should work with preset configuration"""
        @with_security_headers(get_preset('strict'))
        def handler(event, context):
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'Success'})
            }

        result = handler({}, None)

        assert result['headers']['Referrer-Policy'] == 'no-referrer'
        assert 'max-age=63072000' in result['headers']['Strict-Transport-Security']

    def test_works_with_api_preset(self):
        """Should work with API preset for JSON responses"""
        @with_security_headers(get_preset('api'))
        def handler(event, context):
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'data': [1, 2, 3]})
            }

        result = handler({}, None)

        assert result['headers']['Content-Type'] == 'application/json'
        assert result['headers']['X-Content-Type-Options'] == 'nosniff'
