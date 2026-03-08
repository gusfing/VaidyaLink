"""
AWS HealthLake Client Helper

Provides a simplified interface for interacting with AWS HealthLake FHIR datastores.
Handles authentication, error handling, and common FHIR operations.
"""

import os
import json
import boto3
from typing import Dict, List, Optional, Any
from botocore.exceptions import ClientError


class HealthLakeClient:
    """
    Helper class for AWS HealthLake FHIR operations.

    Environment Variables:
        HEALTHLAKE_DATASTORE_ID: The HealthLake datastore ID
        HEALTHLAKE_DATASTORE_ENDPOINT: The HealthLake datastore endpoint URL
        AWS_REGION: AWS region (defaults to us-east-1)
    """

    def __init__(
        self,
        datastore_id: Optional[str] = None,
        datastore_endpoint: Optional[str] = None,
        region: Optional[str] = None
    ):
        """
        Initialize HealthLake client.

        Args:
            datastore_id: HealthLake datastore ID (defaults to env var)
            datastore_endpoint: HealthLake endpoint URL (defaults to env var)
            region: AWS region (defaults to env var or us-east-1)
        """
        self.datastore_id = datastore_id or os.environ.get('HEALTHLAKE_DATASTORE_ID')
        self.datastore_endpoint = datastore_endpoint or os.environ.get('HEALTHLAKE_DATASTORE_ENDPOINT')
        self.region = region or os.environ.get('AWS_REGION', 'us-east-1')

        if not self.datastore_id:
            raise ValueError("HEALTHLAKE_DATASTORE_ID must be provided or set as environment variable")

        if not self.datastore_endpoint:
            raise ValueError("HEALTHLAKE_DATASTORE_ENDPOINT must be provided or set as environment variable")

        # Initialize boto3 client
        self.client = boto3.client('healthlake', region_name=self.region)

    def create_resource(self, resource_type: str, resource_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a FHIR resource in HealthLake.

        Args:
            resource_type: FHIR resource type (e.g., 'Patient', 'Observation')
            resource_data: FHIR resource data as dictionary

        Returns:
            Created resource with ID and metadata

        Raises:
            ClientError: If the API call fails
        """
        try:
            # Ensure resourceType is set
            resource_data['resourceType'] = resource_type

            response = self.client.create_resource(
                DatastoreId=self.datastore_id,
                Resource=json.dumps(resource_data)
            )

            return json.loads(response['Resource'])
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            raise Exception(f"Failed to create {resource_type}: {error_code} - {error_message}")

    def read_resource(self, resource_type: str, resource_id: str) -> Dict[str, Any]:
        """
        Read a FHIR resource from HealthLake by ID.

        Args:
            resource_type: FHIR resource type (e.g., 'Patient', 'Observation')
            resource_id: FHIR resource ID

        Returns:
            FHIR resource data

        Raises:
            ClientError: If the API call fails or resource not found
        """
        try:
            response = self.client.read_resource(
                DatastoreId=self.datastore_id,
                ResourceType=resource_type,
                ResourceId=resource_id
            )

            return json.loads(response['Resource'])
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            raise Exception(f"Failed to read {resource_type}/{resource_id}: {error_code} - {error_message}")

    def update_resource(self, resource_type: str, resource_id: str, resource_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a FHIR resource in HealthLake.

        Args:
            resource_type: FHIR resource type
            resource_id: FHIR resource ID
            resource_data: Updated FHIR resource data

        Returns:
            Updated resource with new version metadata

        Raises:
            ClientError: If the API call fails
        """
        try:
            # Ensure resourceType and id are set
            resource_data['resourceType'] = resource_type
            resource_data['id'] = resource_id

            response = self.client.update_resource(
                DatastoreId=self.datastore_id,
                Resource=json.dumps(resource_data)
            )

            return json.loads(response['Resource'])
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            raise Exception(f"Failed to update {resource_type}/{resource_id}: {error_code} - {error_message}")

    def delete_resource(self, resource_type: str, resource_id: str) -> None:
        """
        Delete a FHIR resource from HealthLake.

        Args:
            resource_type: FHIR resource type
            resource_id: FHIR resource ID

        Raises:
            ClientError: If the API call fails
        """
        try:
            self.client.delete_resource(
                DatastoreId=self.datastore_id,
                ResourceType=resource_type,
                ResourceId=resource_id
            )
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            raise Exception(f"Failed to delete {resource_type}/{resource_id}: {error_code} - {error_message}")

    def search_resources(
        self,
        resource_type: str,
        search_params: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for FHIR resources using search parameters.

        Args:
            resource_type: FHIR resource type to search
            search_params: Dictionary of FHIR search parameters

        Returns:
            List of matching FHIR resources

        Raises:
            ClientError: If the API call fails
        """
        try:
            # Build query string from search params
            query_string = ''
            if search_params:
                query_parts = [f"{key}={value}" for key, value in search_params.items()]
                query_string = '&'.join(query_parts)

            response = self.client.search_with_get(
                DatastoreId=self.datastore_id,
                ResourceType=resource_type,
                QueryString=query_string
            )

            bundle = json.loads(response['Resource'])

            # Extract resources from bundle
            resources = []
            if 'entry' in bundle:
                resources = [entry['resource'] for entry in bundle['entry']]

            return resources
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            raise Exception(f"Failed to search {resource_type}: {error_code} - {error_message}")

    def get_patient_resources(self, patient_id: str) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get all resources for a specific patient.

        Args:
            patient_id: FHIR Patient resource ID

        Returns:
            Dictionary mapping resource types to lists of resources
        """
        resource_types = [
            'Observation',
            'Condition',
            'MedicationStatement',
            'Procedure',
            'DiagnosticReport',
            'Encounter',
            'AllergyIntolerance'
        ]

        patient_resources = {}

        for resource_type in resource_types:
            try:
                resources = self.search_resources(
                    resource_type=resource_type,
                    search_params={'patient': patient_id}
                )
                patient_resources[resource_type] = resources
            except Exception as e:
                # Log error but continue with other resource types
                print(f"Warning: Failed to fetch {resource_type} for patient {patient_id}: {str(e)}")
                patient_resources[resource_type] = []

        return patient_resources

    def create_bundle(self, resources: List[Dict[str, Any]], bundle_type: str = 'transaction') -> Dict[str, Any]:
        """
        Create a FHIR Bundle resource.

        Args:
            resources: List of FHIR resources to include in bundle
            bundle_type: Bundle type ('transaction', 'batch', 'collection', etc.)

        Returns:
            FHIR Bundle resource
        """
        entries = []
        for resource in resources:
            entry = {
                'resource': resource
            }

            # Add request for transaction/batch bundles
            if bundle_type in ['transaction', 'batch']:
                resource_type = resource.get('resourceType')
                resource_id = resource.get('id')

                if resource_id:
                    entry['request'] = {
                        'method': 'PUT',
                        'url': f"{resource_type}/{resource_id}"
                    }
                else:
                    entry['request'] = {
                        'method': 'POST',
                        'url': resource_type
                    }

            entries.append(entry)

        bundle = {
            'resourceType': 'Bundle',
            'type': bundle_type,
            'entry': entries
        }

        return bundle
