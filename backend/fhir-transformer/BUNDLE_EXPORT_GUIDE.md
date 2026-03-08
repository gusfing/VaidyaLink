# FHIR Bundle Export Guide

## Overview

The FHIR Transformer Lambda now supports exporting patient health records as FHIR R4 bundles. This feature enables medical tourism, data portability, and integration with external healthcare systems.

## Features

- **Multiple Bundle Types**: Support for collection, document, transaction, and batch bundles
- **Format Options**: JSON export (XML placeholder for future implementation)
- **Resource Filtering**: Export specific resource types or all available resources
- **S3 Storage**: Bundles are stored in S3 with pre-signed URLs for secure download
- **Metadata Tracking**: Each export includes patient ID, resource counts, and timestamps

## Usage

### Basic Export

Export all resources for a patient as a JSON bundle:

```json
{
  "operation": "export",
  "patientId": "patient-123",
  "options": {
    "exportFormat": "json",
    "bundleType": "collection"
  }
}
```

### Export Specific Resource Types

Export only specific types of resources:

```json
{
  "operation": "export",
  "patientId": "patient-123",
  "options": {
    "exportFormat": "json",
    "resourceTypes": ["Observation", "MedicationStatement"],
    "includePatient": true
  }
}
```

### Export Without Patient Resource

Exclude the Patient resource from the bundle:

```json
{
  "operation": "export",
  "patientId": "patient-123",
  "options": {
    "exportFormat": "json",
    "includePatient": false
  }
}
```

## Request Parameters

### Required Parameters

- `operation`: Must be "export"
- `patientId`: FHIR Patient resource ID

### Optional Parameters (in `options` object)

| Parameter        | Type    | Default      | Description                                                                      |
| ---------------- | ------- | ------------ | -------------------------------------------------------------------------------- |
| `exportFormat`   | string  | "json"       | Export format: "json" or "xml" (XML currently exports as JSON)                   |
| `bundleType`     | string  | "collection" | FHIR bundle type: "collection", "document", "transaction", or "batch"            |
| `includePatient` | boolean | true         | Whether to include the Patient resource in the bundle                            |
| `resourceTypes`  | array   | all types    | List of resource types to include (e.g., ["Observation", "MedicationStatement"]) |

## Response Format

### Success Response (200)

```json
{
  "statusCode": 200,
  "body": {
    "message": "FHIR export completed successfully",
    "patientId": "patient-123",
    "format": "json",
    "bundleType": "collection",
    "resourceCount": 15,
    "resourceCountByType": {
      "Observation": 8,
      "MedicationStatement": 4,
      "DiagnosticReport": 2,
      "Encounter": 1
    },
    "s3Location": "s3://vaidyalink-exports/exports/patient-123/fhir-bundle-20240315-143022.json",
    "downloadUrl": "https://s3.amazonaws.com/vaidyalink-exports/exports/patient-123/fhir-bundle-20240315-143022.json?signature=...",
    "expiresIn": 3600,
    "timestamp": "2024-03-15T14:30:22.123Z"
  }
}
```

### No Resources Found (404)

```json
{
  "statusCode": 404,
  "body": {
    "error": "NoResourcesFound",
    "message": "No FHIR resources found for patient: patient-123",
    "patientId": "patient-123"
  }
}
```

### Error Response (400/500)

```json
{
  "statusCode": 400,
  "body": {
    "error": "FHIRTransformerError",
    "message": "patientId is required for export"
  }
}
```

## Bundle Types

### Collection Bundle

A simple collection of resources without any processing semantics. Best for general data export.

```json
{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-123",
        ...
      }
    },
    ...
  ]
}
```

### Document Bundle

A document bundle represents a clinical document. The first entry must be a Composition resource.

### Transaction Bundle

A transaction bundle where all entries are processed as a single atomic transaction. Useful for bulk imports.

### Batch Bundle

A batch bundle where entries are processed independently. Failures in one entry don't affect others.

## S3 Storage

### Storage Location

Bundles are stored in S3 with the following structure:

```
s3://{bucket}/exports/{patientId}/fhir-bundle-{timestamp}.{format}
```

Example:

```
s3://vaidyalink-exports/exports/patient-123/fhir-bundle-20240315-143022.json
```

### S3 Object Metadata

Each exported bundle includes metadata:

- `patient-id`: Patient resource ID
- `bundle-type`: Type of FHIR bundle
- `resource-count`: Total number of resources in bundle
- `export-timestamp`: ISO 8601 timestamp of export

### Pre-signed URLs

Download URLs are valid for 1 hour (3600 seconds) by default. After expiration, a new export must be requested.

## Resource Types Included

The export includes the following resource types (if available for the patient):

- **Patient**: Patient demographics and identifiers
- **Observation**: Lab results, vital signs, clinical observations
- **MedicationStatement**: Current and past medications
- **Condition**: Diagnoses and health conditions
- **Procedure**: Medical procedures performed
- **DiagnosticReport**: Diagnostic test reports
- **Encounter**: Healthcare encounters and visits
- **AllergyIntolerance**: Allergies and intolerances

## Use Cases

### Medical Tourism

Export patient records in international FHIR format for treatment abroad:

```json
{
  "operation": "export",
  "patientId": "patient-123",
  "options": {
    "exportFormat": "json",
    "bundleType": "document",
    "includePatient": true
  }
}
```

### Data Portability

Allow patients to download their complete health records:

```json
{
  "operation": "export",
  "patientId": "patient-123",
  "options": {
    "exportFormat": "json",
    "bundleType": "collection"
  }
}
```

### System Integration

Export specific resource types for integration with external systems:

```json
{
  "operation": "export",
  "patientId": "patient-123",
  "options": {
    "exportFormat": "json",
    "bundleType": "transaction",
    "resourceTypes": ["Observation", "DiagnosticReport"]
  }
}
```

## Error Handling

### Common Errors

1. **Missing Patient ID**
   - Error: "patientId is required for export"
   - Solution: Include `patientId` in the request

2. **Invalid Export Format**
   - Error: "Invalid export format: pdf. Must be 'json' or 'xml'"
   - Solution: Use "json" or "xml" as exportFormat

3. **Invalid Bundle Type**
   - Error: "Invalid bundle type: invalid"
   - Solution: Use "collection", "document", "transaction", or "batch"

4. **No Resources Found**
   - Error: "No FHIR resources found for patient: patient-123"
   - Solution: Verify patient ID exists and has associated resources

5. **S3 Storage Failure**
   - Error: "Failed to store export bundle: ..."
   - Solution: Check S3 bucket permissions and configuration

## Environment Variables

Required environment variables:

- `HEALTHLAKE_DATASTORE_ID`: AWS HealthLake datastore ID
- `HEALTHLAKE_ENDPOINT`: HealthLake FHIR endpoint URL
- `AWS_REGION`: AWS region (default: us-east-1)
- `EXPORT_BUCKET`: S3 bucket for storing exports (defaults to Config.S3_BUCKET)

## Security Considerations

1. **Access Control**: Ensure proper IAM permissions for HealthLake and S3 access
2. **Pre-signed URLs**: URLs expire after 1 hour to limit exposure
3. **Encryption**: Bundles are stored in S3 with server-side encryption
4. **Audit Logging**: All export operations are logged to CloudWatch
5. **Patient Consent**: Verify patient consent before exporting data

## Future Enhancements

- **XML Export**: Full FHIR XML serialization support
- **Bulk Export**: Export multiple patients in a single operation
- **Compression**: Gzip compression for large bundles
- **Custom Expiration**: Configurable pre-signed URL expiration
- **Email Delivery**: Send download links via email
- **Encryption**: Client-side encryption for sensitive exports

## Testing

Run the export tests:

```bash
cd backend/fhir-transformer
python -m pytest src/__tests__/test_export.py -v
```

## Related Documentation

- [FHIR R4 Bundle Specification](https://www.hl7.org/fhir/bundle.html)
- [HealthLake Integration Guide](./HEALTHLAKE_INTEGRATION.md)
- [FHIR Resource Builder](./src/utils/fhir_builder.py)
- [VaidyaLink Requirements](../../.kiro/specs/vaidyalink/requirements.md)
