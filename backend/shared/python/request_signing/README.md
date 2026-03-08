# VaidyaLink Request Signing (Python)

HMAC-SHA256 request signing for sensitive operations to prevent replay attacks and ensure request integrity.

## Installation

```bash
pip install -e backend/shared/python/request_signing
```

## Quick Start

```python
from request_signing import create_signature_middleware

# Create middleware
verify_signature = create_signature_middleware(
    get_secret=lambda event: 'user-signing-secret',
    max_age_seconds=300,
    sensitive_operations=['/delete', '/update']
)

# Use in Lambda handler
async def handler(event, context):
    verification = await verify_signature(event)

    if 'statusCode' in verification:
        return verification  # Return error

    # Process request
    return {'statusCode': 200, 'body': json.dumps({'success': True})}
```

## API

### `generate_signature(method, path, body, secret, timestamp)`

Generate HMAC-SHA256 signature for a request.

**Parameters:**

- `method` (str): HTTP method (GET, POST, etc.)
- `path` (str): Request path
- `body` (Any): Request body (dict, str, or None)
- `secret` (str): Signing secret
- `timestamp` (int): Unix timestamp in seconds

**Returns:** Hex-encoded signature string

**Example:**

```python
import time

signature = generate_signature(
    method='POST',
    path='/api/v1/patients/delete',
    body={'patientId': '123'},
    secret='my-secret',
    timestamp=int(time.time())
)
```

### `verify_signature(method, path, body, secret, provided_signature, provided_timestamp, max_age_seconds=300)`

Verify a request signature.

**Parameters:**

- `method` (str): HTTP method
- `path` (str): Request path
- `body` (Any): Request body
- `secret` (str): Signing secret
- `provided_signature` (str): Signature from request
- `provided_timestamp` (int): Timestamp from request
- `max_age_seconds` (int, optional): Maximum request age (default: 300)

**Returns:** Dictionary with verification result

```python
{
    'valid': bool,
    'error': str,  # Optional
    'message': str  # Optional
}
```

**Example:**

```python
result = verify_signature(
    method='POST',
    path='/api/v1/test',
    body={'data': 'value'},
    secret='my-secret',
    provided_signature='abc123...',
    provided_timestamp=1234567890,
    max_age_seconds=300
)

if result['valid']:
    print('Signature valid')
else:
    print(f"Signature invalid: {result['error']}")
```

### `create_signature_middleware(get_secret, max_age_seconds=300, sensitive_operations=None)`

Create middleware for Lambda to verify request signatures.

**Parameters:**

- `get_secret` (Callable): Function to retrieve signing secret
- `max_age_seconds` (int, optional): Maximum request age (default: 300)
- `sensitive_operations` (List[str], optional): Operations requiring signing

**Returns:** Middleware function

**Example:**

```python
async def get_secret(event):
    user_id = event['requestContext']['authorizer']['claims']['sub']
    return await get_secret_from_secrets_manager(user_id)

middleware = create_signature_middleware(
    get_secret=get_secret,
    max_age_seconds=300,
    sensitive_operations=['/delete', '/update', '/export']
)
```

## Error Codes

- `MISSING_SIGNATURE`: Request missing signature headers
- `REQUEST_EXPIRED`: Request timestamp too old
- `TIMESTAMP_FUTURE`: Request timestamp in the future
- `INVALID_SIGNATURE`: Signature verification failed
- `INTERNAL_ERROR`: Error retrieving secret or processing request

## Security Features

- **HMAC-SHA256**: Industry-standard cryptographic signing
- **Constant-Time Comparison**: Prevents timing attacks using `hmac.compare_digest()`
- **Timestamp Validation**: Prevents replay attacks
- **Configurable Expiry**: Adjustable request age limits

## Testing

```bash
pytest test_request_signing.py
```

## Examples

See [examples/lambda_handler_example.py](./examples/lambda_handler_example.py) for complete Lambda implementation.

## Documentation

- [Quick Start Guide](../../REQUEST_SIGNING_QUICK_START.md)
- [Implementation Guide](../../REQUEST_SIGNING_GUIDE.md)

## License

MIT
