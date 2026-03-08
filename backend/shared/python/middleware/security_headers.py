"""
Security Headers Middleware for AWS Lambda (Python)
Adds essential security headers to all HTTP responses

Implements OWASP security best practices and HIPAA compliance requirements
"""

from typing import Dict, Any, Optional, Callable
from functools import wraps


# Default security headers configuration
DEFAULT_HEADERS = {
    # Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    # Prevent clickjacking attacks
    'X-Frame-Options': 'DENY',

    # Enable XSS protection (legacy browsers)
    'X-XSS-Protection': '1; mode=block',

    # Enforce HTTPS with HSTS (1 year)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

    # Control referrer information
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    # Content Security Policy - restrictive by default
    'Content-Security-Policy': '; '.join([
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
    ]),

    # Permissions Policy (formerly Feature Policy)
    'Permissions-Policy': ', '.join([
        'geolocation=()',
        'microphone=()',
        'camera=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()'
    ])
}


class SecurityHeadersMiddleware:
    """Security headers middleware class"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize security headers middleware

        Args:
            config: Configuration dictionary with optional 'headers' and 'overwrite' keys
        """
        config = config or {}
        custom_headers = config.get('headers', {})
        self.headers = {**DEFAULT_HEADERS, **custom_headers}
        self.overwrite = config.get('overwrite', True)

    def apply(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply security headers to Lambda response

        Args:
            response: Lambda response dictionary

        Returns:
            Response with security headers added
        """
        if not response:
            raise ValueError('Response object is required')

        # Ensure headers dict exists
        if 'headers' not in response:
            response['headers'] = {}

        # Apply security headers
        for key, value in self.headers.items():
            # Only add header if it doesn't exist or overwrite is enabled
            if self.overwrite or key not in response['headers']:
                response['headers'][key] = value

        return response

    def set_header(self, name: str, value: str) -> None:
        """
        Update specific header

        Args:
            name: Header name
            value: Header value
        """
        self.headers[name] = value

    def remove_header(self, name: str) -> None:
        """
        Remove specific header

        Args:
            name: Header name
        """
        self.headers.pop(name, None)

    def get_headers(self) -> Dict[str, str]:
        """
        Get current headers configuration

        Returns:
            Copy of current headers
        """
        return self.headers.copy()


def create_security_headers_middleware(config: Optional[Dict[str, Any]] = None) -> Callable:
    """
    Create security headers middleware function

    Args:
        config: Configuration dictionary with optional 'headers' and 'overwrite' keys

    Returns:
        Middleware function that applies security headers

    Example:
        apply_headers = create_security_headers_middleware()

        def handler(event, context):
            response = {
                'statusCode': 200,
                'body': json.dumps({'message': 'Success'})
            }
            return apply_headers(response)
    """
    middleware = SecurityHeadersMiddleware(config)

    def apply_headers(response: Dict[str, Any]) -> Dict[str, Any]:
        return middleware.apply(response)

    return apply_headers


def with_security_headers(config: Optional[Dict[str, Any]] = None) -> Callable:
    """
    Decorator for Lambda handlers to automatically apply security headers

    Args:
        config: Configuration dictionary with optional 'headers' and 'overwrite' keys

    Returns:
        Decorator function

    Example:
        @with_security_headers()
        def handler(event, context):
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'Success'})
            }
    """
    apply_headers = create_security_headers_middleware(config)

    def decorator(handler: Callable) -> Callable:
        @wraps(handler)
        def wrapper(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
            try:
                # Call original handler
                response = handler(event, context)

                # Apply security headers
                return apply_headers(response)
            except Exception as error:
                # Apply headers even to error responses
                import json
                error_response = {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({
                        'error': 'Internal Server Error',
                        'message': str(error)
                    })
                }

                return apply_headers(error_response)

        return wrapper

    return decorator


# Preset configurations for common scenarios
PRESETS = {
    # Strict configuration for healthcare/HIPAA compliance
    'strict': {
        'headers': {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
            'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': '; '.join([
                "default-src 'none'",
                "script-src 'self'",
                "style-src 'self'",
                "img-src 'self'",
                "font-src 'self'",
                "connect-src 'self'",
                "frame-ancestors 'none'",
                "base-uri 'none'",
                "form-action 'self'"
            ]),
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
        }
    },

    # API-only configuration (no CSP for HTML)
    'api': {
        'headers': {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
        }
    },

    # Relaxed configuration for development
    'development': {
        'headers': {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
    }
}


def get_preset(preset_name: str) -> Dict[str, Any]:
    """
    Get preset configuration

    Args:
        preset_name: Name of preset (strict, api, development)

    Returns:
        Preset configuration dictionary

    Raises:
        ValueError: If preset name is unknown
    """
    if preset_name not in PRESETS:
        available = ', '.join(PRESETS.keys())
        raise ValueError(f'Unknown preset: {preset_name}. Available: {available}')

    return PRESETS[preset_name]
