"""
FHIR Bundle Export Integration Example

This example demonstrates how to integrate the FHIR bundle export functionality
into your application or API Gateway.
"""

import json
import boto3
from typing import Dict, Any


class FHIRExportService:
    """
    Service class for exporting patient FHIR bundles.
    Wraps the FHIR Transformer Lambda export functionality.
    """

    def __init__(self, lambda_function_name: str = 'fhir-transformer'):
        """
        Initialize the export service.

        Args:
            lambda_function_name: Name of the FHIR Transformer Lambda function
        """
        self.lambda_client = boto3.client('lambda')
        self.lambda_function_name = lambda_function_name

    def export_patient_bundle(
        self,
        patient_id: str,
        export_format: str = 'json',
        bundle_type: str = 'collection',
        include_patient: bool = True,
        resource_types: list = None
    ) -> Dict[str, Any]:
        """
        Export a patient's FHIR bundle.

        Args:
            patient_id: FHIR Patient resource ID
            export_format: Export format ('json' or 'xml')
            bundle_type: FHIR bundle type ('collection', 'document', 'transaction', 'batch')
            include_patient: Whether to include Patient resource
            resource_types: List of resource types to include (None = all)

        Returns:
            Dictionary with export results including download URL

        Raises:
            Exception: If export fails
        """
        # Build Lambda event
        event = {
            'operation': 'export',
            'patientId': patient_id,
            'options': {
                'exportFormat': export_format,
                'bundleType': bundle_type,
                'includePatient': include_patient
            }
        }

        if resource_types:
            event['options']['resourceTypes'] = resource_types

        # Invoke Lambda
        response = self.lambda_client.invoke(
            FunctionName=self.lambda_function_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(event)
        )

        # Parse response
        result = json.loads(response['Payload'].read())

        if result['statusCode'] != 200:
            error_body = json.loads(result['body'])
            raise Exception(f"Export failed: {error_body.get('message', 'Unknown error')}")

        return json.loads(result['body'])


# Example 1: Basic export for medical tourism
def export_for_medical_tourism(patient_id: str) -> str:
    """
    Export complete patient records for medical tourism.

    Args:
        patient_id: Patient ID

    Returns:
        Download URL for the bundle
    """
    service = FHIRExportService()

    result = service.export_patient_bundle(
        patient_id=patient_id,
        export_format='json',
        bundle_type='document',  # Document bundle for clinical documents
        include_patient=True
    )

    print(f"Export completed successfully!")
    print(f"Patient ID: {result['patientId']}")
    print(f"Total resources: {result['resourceCount']}")
    print(f"Download URL: {result['downloadUrl']}")
    print(f"URL expires in: {result['expiresIn']} seconds")

    return result['downloadUrl']


# Example 2: Export specific resource types
def export_lab_results(patient_id: str) -> str:
    """
    Export only lab results and diagnostic reports.

    Args:
        patient_id: Patient ID

    Returns:
        Download URL for the bundle
    """
    service = FHIRExportService()

    result = service.export_patient_bundle(
        patient_id=patient_id,
        export_format='json',
        bundle_type='collection',
        include_patient=True,
        resource_types=['Observation', 'DiagnosticReport']
    )

    print(f"Lab results exported!")
    print(f"Resources by type: {result['resourceCountByType']}")
    print(f"Download URL: {result['downloadUrl']}")

    return result['downloadUrl']


# Example 3: API Gateway Lambda handler
def api_gateway_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    API Gateway Lambda handler for FHIR export endpoint.

    Endpoint: POST /api/v1/patients/{patientId}/export

    Request body:
    {
        "exportFormat": "json",
        "bundleType": "collection",
        "resourceTypes": ["Observation", "MedicationStatement"]
    }

    Args:
        event: API Gateway event
        context: Lambda context

    Returns:
        API Gateway response
    """
    try:
        # Extract patient ID from path parameters
        patient_id = event['pathParameters']['patientId']

        # Parse request body
        body = json.loads(event.get('body', '{}'))

        # Initialize service
        service = FHIRExportService()

        # Export bundle
        result = service.export_patient_bundle(
            patient_id=patient_id,
            export_format=body.get('exportFormat', 'json'),
            bundle_type=body.get('bundleType', 'collection'),
            include_patient=body.get('includePatient', True),
            resource_types=body.get('resourceTypes')
        )

        # Return success response
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }

    except Exception as e:
        # Return error response
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'ExportFailed',
                'message': str(e)
            })
        }


# Example 4: Batch export for multiple patients
def batch_export_patients(patient_ids: list) -> Dict[str, str]:
    """
    Export bundles for multiple patients.

    Args:
        patient_ids: List of patient IDs

    Returns:
        Dictionary mapping patient IDs to download URLs
    """
    service = FHIRExportService()
    results = {}

    for patient_id in patient_ids:
        try:
            result = service.export_patient_bundle(
                patient_id=patient_id,
                export_format='json',
                bundle_type='collection'
            )
            results[patient_id] = result['downloadUrl']
            print(f"✓ Exported {patient_id}: {result['resourceCount']} resources")
        except Exception as e:
            print(f"✗ Failed to export {patient_id}: {str(e)}")
            results[patient_id] = None

    return results


# Example 5: Download and save bundle
def download_and_save_bundle(patient_id: str, output_file: str) -> None:
    """
    Export bundle and save to local file.

    Args:
        patient_id: Patient ID
        output_file: Local file path to save bundle
    """
    import requests

    service = FHIRExportService()

    # Export bundle
    result = service.export_patient_bundle(
        patient_id=patient_id,
        export_format='json',
        bundle_type='collection'
    )

    # Download bundle from S3
    download_url = result['downloadUrl']
    response = requests.get(download_url)

    if response.status_code == 200:
        # Save to file
        with open(output_file, 'w') as f:
            f.write(response.text)
        print(f"Bundle saved to {output_file}")
    else:
        raise Exception(f"Failed to download bundle: {response.status_code}")


# Example 6: Frontend integration (JavaScript/TypeScript)
FRONTEND_EXAMPLE = """
// Frontend API client for FHIR export

class FHIRExportClient {
  constructor(apiBaseUrl, authToken) {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
  }

  async exportPatientBundle(patientId, options = {}) {
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/patients/${patientId}/export`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          exportFormat: options.format || 'json',
          bundleType: options.bundleType || 'collection',
          resourceTypes: options.resourceTypes,
          includePatient: options.includePatient !== false
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Export failed');
    }

    return await response.json();
  }

  async downloadBundle(patientId, options = {}) {
    const result = await this.exportPatientBundle(patientId, options);

    // Trigger browser download
    window.location.href = result.downloadUrl;

    return result;
  }
}

// Usage example
const client = new FHIRExportClient('https://api.vaidyalink.com', 'your-auth-token');

// Export and download
client.downloadBundle('patient-123', {
  format: 'json',
  bundleType: 'collection'
}).then(result => {
  console.log(`Exported ${result.resourceCount} resources`);
}).catch(error => {
  console.error('Export failed:', error);
});
"""


if __name__ == '__main__':
    # Example usage
    print("FHIR Bundle Export Examples\n")

    # Example 1: Medical tourism export
    print("1. Medical Tourism Export")
    print("-" * 50)
    try:
        url = export_for_medical_tourism('patient-123')
        print(f"Success! Download URL: {url}\n")
    except Exception as e:
        print(f"Error: {e}\n")

    # Example 2: Lab results export
    print("2. Lab Results Export")
    print("-" * 50)
    try:
        url = export_lab_results('patient-123')
        print(f"Success! Download URL: {url}\n")
    except Exception as e:
        print(f"Error: {e}\n")

    # Example 3: Batch export
    print("3. Batch Export")
    print("-" * 50)
    patient_ids = ['patient-123', 'patient-456', 'patient-789']
    results = batch_export_patients(patient_ids)
    print(f"Exported {len([r for r in results.values() if r])} out of {len(patient_ids)} patients\n")

    # Print frontend example
    print("4. Frontend Integration Example")
    print("-" * 50)
    print(FRONTEND_EXAMPLE)
