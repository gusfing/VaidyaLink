# FHIR Bundle Export - Quick Start

## What is FHIR Bundle Export?

FHIR Bundle Export allows you to export a patient's complete health records as a standardized FHIR R4 bundle. This is essential for:

- **Medical Tourism**: Patients traveling abroad for treatment
- **Data Portability**: Patients switching healthcare providers
- **System Integration**: Sharing data with external healthcare systems
- **Compliance**: Meeting ABDM and international data portability requirements

## Quick Example

### 1. Export All Patient Resources

```bash
# Lambda event
{
  "operation": "export",
  "patientId": "patient-123"
}
```

**Response:**

```json
{
  "statusCode": 200,
  "body": {
    "message": "FHIR export completed successfully",
    "patientId": "patient-123",
    "resourceCount": 15,
    "downloadUrl": "https://s3.amazonaws.com/bucket/exports/patient-123/fhir-bundle-20240315-143022.json?signature=...",
    "expiresIn": 3600
  }
}
```

### 2. Export Specific Resource Types

```bash
# Lambda event
{
  "operation": "export",
  "patientId": "patient-123",
  "options": {
    "resourceTypes": ["Observation", "MedicationStatement"]
  }
}
```

### 3. Export for Medical Tourism

```bash
# Lambda event
{
  "operation": "export",
  "patientId": "patient-123",
  "options": {
    "bundleType": "document",
    "exportFormat": "json"
  }
}
```

## Common Options

| Option           | Values                                           | Default      | Use Case                         |
| ---------------- | ------------------------------------------------ | ------------ | -------------------------------- |
| `exportFormat`   | "json", "xml"                                    | "json"       | Choose output format             |
| `bundleType`     | "collection", "document", "transaction", "batch" | "collection" | Bundle processing semantics      |
| `includePatient` | true, false                                      | true         | Include/exclude Patient resource |
| `resourceTypes`  | Array of strings                                 | all          | Filter specific resource types   |

## Integration Examples

### API Gateway Integration

```javascript
// Frontend API call
const exportPatientData = async (patientId) => {
  const response = await fetch('/api/v1/patients/${patientId}/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      exportFormat: 'json',
      bundleType: 'collection',
    }),
  });

  const result = await response.json();

  // Download the bundle
  window.location.href = result.downloadUrl;
};
```

### Direct Lambda Invocation

```python
import boto3
import json

lambda_client = boto3.client('lambda')

response = lambda_client.invoke(
    FunctionName='fhir-transformer',
    InvocationType='RequestResponse',
    Payload=json.dumps({
        'operation': 'export',
        'patientId': 'patient-123',
        'options': {
            'exportFormat': 'json',
            'bundleType': 'collection'
        }
    })
)

result = json.loads(response['Payload'].read())
print(f"Download URL: {result['body']['downloadUrl']}")
```

## What Gets Exported?

The bundle includes all available resources for the patient:

✅ Patient demographics and identifiers
✅ Medical observations (lab results, vitals)
✅ Current and past medications
✅ Diagnoses and conditions
✅ Medical procedures
✅ Diagnostic reports
✅ Healthcare encounters
✅ Allergies and intolerances

## Bundle Structure

```json
{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-123",
        "name": [{"text": "John Doe"}],
        ...
      }
    },
    {
      "resource": {
        "resourceType": "Observation",
        "id": "obs-1",
        "code": {"text": "Blood Pressure"},
        ...
      }
    },
    ...
  ]
}
```

## Download and Use

1. **Get Download URL**: Call the export API to get a pre-signed S3 URL
2. **Download Bundle**: Use the URL to download the JSON file (valid for 1 hour)
3. **Import to System**: Import the bundle into any FHIR-compatible system
4. **Share with Provider**: Send the bundle to healthcare providers abroad

## Error Handling

```javascript
try {
  const result = await exportPatientData('patient-123');
  console.log('Export successful:', result);
} catch (error) {
  if (error.statusCode === 404) {
    console.error('No resources found for patient');
  } else if (error.statusCode === 400) {
    console.error('Invalid request:', error.message);
  } else {
    console.error('Export failed:', error);
  }
}
```

## Testing

Test the export functionality:

```bash
cd backend/fhir-transformer
python -m pytest src/__tests__/test_export.py -v
```

## Next Steps

- Read the [Full Export Guide](./BUNDLE_EXPORT_GUIDE.md) for advanced features
- Check [HealthLake Integration](./HEALTHLAKE_INTEGRATION.md) for data storage
- Review [FHIR R4 Specification](https://www.hl7.org/fhir/) for bundle details

## Support

For issues or questions:

- Check CloudWatch logs for error details
- Verify HealthLake datastore configuration
- Ensure S3 bucket permissions are correct
- Review IAM roles for Lambda execution
