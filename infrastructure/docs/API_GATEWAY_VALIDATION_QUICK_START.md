# API Gateway Request Validation - Quick Start

Get started with VaidyaLink's API Gateway request validation in 5 minutes.

## What You Get

✅ Automatic request validation at API Gateway level
✅ JSON Schema-based request models for all endpoints
✅ Path and query parameter validation
✅ Standardized error responses
✅ Reduced Lambda invocations from invalid requests

## Prerequisites

- AWS CDK installed
- VaidyaLink infrastructure repository cloned
- Lambda functions deployed (Tasks 8-12)
- Cognito User Pool configured (Task 4.1)

## Quick Deploy

### 1. Deploy API Gateway with Validation

```bash
cd infrastructure
npm install
npm run build
cdk deploy VaidyaLinkStack --context environment=dev
```

### 2. Test Request Validation

#### Valid Request Example

```bash
curl -X POST https://api.vaidyalink.com/api/v1/scans \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-123",
    "imageS3Key": "uploads/scan-001.jpg",
    "metadata": {
      "documentType": "prescription",
      "captureDate": "2024-01-15T10:30:00Z"
    }
  }'
```

**Response**: `201 Created`

#### Invalid Request Example (Missing Required Field)

```bash
curl -X POST https://api.vaidyalink.com/api/v1/scans \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageS3Key": "uploads/scan-001.jpg"
  }'
```

**Response**: `400 Bad Request`

```json
{
  "message": "Missing required request parameters: [patientId]",
  "code": "ValidationException"
}
```

#### Invalid ABHA ID Format

```bash
curl -X POST https://api.vaidyalink.com/api/v1/abdm/link \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "abhaId": "invalid-format",
    "otp": "123456"
  }'
```

**Response**: `400 Bad Request`

```json
{
  "message": "Invalid request body",
  "code": "ValidationException"
}
```

## Common Validation Patterns

### 1. Scan Job Creation

**Endpoint**: `POST /api/v1/scans`

**Valid Request**:

```json
{
  "patientId": "patient-123",
  "imageS3Key": "uploads/prescription-2024-01-15.jpg",
  "metadata": {
    "documentType": "prescription",
    "captureDate": "2024-01-15T10:30:00Z",
    "notes": "Follow-up prescription"
  }
}
```

**Validation Rules**:

- ✅ `patientId`: 1-100 characters, required
- ✅ `imageS3Key`: 1-500 characters, required
- ✅ `metadata.notes`: Max 1000 characters, optional

### 2. Voice Recording with Language

**Endpoint**: `POST /api/v1/voice`

**Valid Request**:

```json
{
  "patientId": "patient-123",
  "audioS3Key": "audio/recording-001.wav",
  "language": "hi"
}
```

**Validation Rules**:

- ✅ `language`: Must be one of 22 Indian languages (hi, en, bn, te, mr, ta, etc.)

### 3. ABHA ID Linking

**Endpoint**: `POST /api/v1/abdm/link`

**Valid Request**:

```json
{
  "abhaId": "12-3456-7890-1234",
  "otp": "123456"
}
```

**Validation Rules**:

- ✅ `abhaId`: Pattern `XX-XXXX-XXXX-XXXX` (14 digits with hyphens)
- ✅ `otp`: Pattern `XXXXXX` (6 digits)

### 4. Patient Records Query

**Endpoint**: `GET /api/v1/patients/{id}/records`

**Valid Request**:

```bash
GET /api/v1/patients/patient-123/records?startDate=2024-01-01&resourceType=MedicationStatement
```

**Validation Rules**:

- ✅ `id`: Path parameter, required
- ✅ `startDate`, `endDate`, `resourceType`: Query parameters, optional

## Validation Error Handling

### Client-Side Error Handling

```typescript
async function createScan(patientId: string, imageS3Key: string) {
  try {
    const response = await fetch('https://api.vaidyalink.com/api/v1/scans', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ patientId, imageS3Key }),
    });

    if (!response.ok) {
      const error = await response.json();

      if (response.status === 400) {
        // Validation error
        console.error('Validation failed:', error.message);
        // Show user-friendly error message
      } else if (response.status === 401) {
        // Authentication error
        console.error('Unauthorized:', error.message);
        // Redirect to login
      }

      throw new Error(error.message);
    }

    return await response.json();
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}
```

## Testing Validation

### Run Unit Tests

```bash
cd infrastructure
npm test -- api-gateway-validation.test.ts
```

### Manual Testing with Postman

1. Import the VaidyaLink API collection
2. Set environment variables:
   - `API_URL`: Your API Gateway URL
   - `JWT_TOKEN`: Valid Cognito JWT token
3. Run the "Request Validation" folder tests

### Testing Invalid Requests

```bash
# Missing required field
curl -X POST $API_URL/api/v1/scans \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"imageS3Key": "test.jpg"}'

# Invalid language code
curl -X POST $API_URL/api/v1/voice \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "p123",
    "audioS3Key": "audio.wav",
    "language": "invalid"
  }'

# Invalid ABHA ID format
curl -X POST $API_URL/api/v1/abdm/link \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "abhaId": "123456",
    "otp": "123456"
  }'
```

## Monitoring Validation Errors

### CloudWatch Metrics

View validation error rates in CloudWatch:

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 4XXError \
  --dimensions Name=ApiName,Value=vaidyalink-api-dev \
  --start-time 2024-01-15T00:00:00Z \
  --end-time 2024-01-15T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### CloudWatch Logs

Query validation errors:

```bash
aws logs filter-log-events \
  --log-group-name /aws/apigateway/vaidyalink-dev \
  --filter-pattern "ValidationException"
```

## Benefits

| Benefit                  | Impact                                                         |
| ------------------------ | -------------------------------------------------------------- |
| **Cost Savings**         | Invalid requests rejected at API Gateway, no Lambda invocation |
| **Security**             | Input validation prevents injection attacks and malformed data |
| **Developer Experience** | Clear error messages help developers fix issues quickly        |
| **API Documentation**    | Request models serve as living documentation                   |
| **Compliance**           | Input validation required for HIPAA technical safeguards       |

## Common Issues

### Issue: Validation passes but Lambda fails

**Cause**: Lambda-side validation is more strict than API Gateway validation

**Solution**: Align Lambda validation logic with API Gateway models

### Issue: Valid request rejected

**Cause**: Request model doesn't match actual data structure

**Solution**: Update the request model in `api-gateway.ts`

### Issue: Error message not helpful

**Cause**: API Gateway default error messages are generic

**Solution**: Implement custom error responses in Lambda functions

## Next Steps

1. ✅ **Task 6.1 Complete**: Request validation configured
2. ⏭️ **Task 6.2**: Implement rate limiting per user tier
3. ⏭️ **Task 6.3**: Configure CORS policies
4. ⏭️ **Task 13.8**: Create OpenAPI specification

## Resources

- [Full Documentation](./API_GATEWAY_VALIDATION.md)
- [API Gateway CDK Construct](../lib/constructs/api-gateway.ts)
- [Validation Tests](../test/api-gateway-validation.test.ts)
- [AWS API Gateway Validation Docs](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-method-request-validation.html)

## Support

For issues or questions:

- Check [API_GATEWAY_VALIDATION.md](./API_GATEWAY_VALIDATION.md) for detailed documentation
- Review test cases in `api-gateway-validation.test.ts`
- Contact the VaidyaLink infrastructure team
