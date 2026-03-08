"""
HealthLake Storage Utility

Provides high-level functions for storing FHIR resources in AWS HealthLake
with error handling, retry logic, and batch operations.
"""

import logging
import sys
import os
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

# Add path for shared libraries
sys.path.append('/opt/python')

try:
    from healthlake.healthlake_client import HealthLakeClient
except ImportError:
    # Fallback for local development
    sys.path.append(os.path.join(os.path.dirname(__file__), '../../../shared/python'))
    from healthlake.healthlake_client import HealthLakeClient

from config import Config

logger = logging.getLogger(__name__)


class HealthLakeStore:
    """
    High-level interface for storing FHIR resources in AWS HealthLake.
    Handles batch operations, error recovery, and resource tracking.
    """

    def __init__(
        self,
        datastore_id: Optional[str] = None,
        datastore_endpoint: Optional[str] = None,
        region: Optional[str] = None
    ):
        """
        Initialize HealthLake store.

        Args:
            datastore_id: HealthLake datastore ID (defaults to Config)
            datastore_endpoint: HealthLake endpoint URL (defaults to Config)
            region: AWS region (defaults to Config)
        """
        self.datastore_id = datastore_id or Config.HEALTHLAKE_DATASTORE_ID
        self.datastore_endpoint = datastore_endpoint or Config.HEALTHLAKE_ENDPOINT
        self.region = region or Config.AWS_REGION

        self.client = HealthLakeClient(
            datastore_id=self.datastore_id,
            datastore_endpoint=self.datastore_endpoint,
            region=self.region
        )

        logger.info(f"Initialized HealthLakeStore for datastore: {self.datastore_id}")

    def store_resource(
        self,
        resource: Any,
        retry_count: int = 3
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Store a single FHIR resource in HealthLake with retry logic.

        Args:
            resource: FHIR resource object (from fhir.resources)
            retry_count: Number of retry attempts on failure

        Returns:
            Tuple of (success, resource_id, error_message)
        """
        resource_type = resource.get_resource_type()
        resource_dict = resource.dict(exclude_none=True)

        for attempt in range(retry_count):
            try:
                logger.info(f"Storing {resource_type} resource (attempt {attempt + 1}/{retry_count})")

                stored_resource = self.client.create_resource(
                    resource_type=resource_type,
                    resource_data=resource_dict
                )

                resource_id = stored_resource.get('id')
                if resource_id:
                    logger.info(f"Successfully stored {resource_type}/{resource_id}")
                    return True, resource_id, None
                else:
                    logger.warning(f"Resource stored but no ID returned for {resource_type}")
                    return True, None, "No ID returned"

            except Exception as e:
                error_msg = str(e)
                logger.error(f"Failed to store {resource_type} (attempt {attempt + 1}/{retry_count}): {error_msg}")

                if attempt == retry_count - 1:
                    # Last attempt failed
                    return False, None, error_msg

        return False, None, "Max retries exceeded"

    def store_resources_batch(
        self,
        resources: List[Any]
    ) -> Dict[str, Any]:
        """
        Store multiple FHIR resources in HealthLake.

        Uses batch operations if enabled and supported, otherwise stores sequentially.

        Args:
            resources: List of FHIR resource objects

        Returns:
            Dictionary with storage results:
            {
                "total": int,
                "successful": int,
                "failed": int,
                "resource_ids": List[str],
                "errors": List[Dict]
            }
        """
        results = {
            "total": len(resources),
            "successful": 0,
            "failed": 0,
            "resource_ids": [],
            "errors": []
        }

        if not resources:
            logger.warning("No resources to store")
            return results

        logger.info(f"Storing {len(resources)} FHIR resources in HealthLake")

        # Check if batch operations are enabled
        if Config.ENABLE_BATCH_OPERATIONS and len(resources) > 1:
            try:
                return self._store_batch_transaction(resources)
            except Exception as e:
                logger.warning(f"Batch operation failed, falling back to sequential: {str(e)}")
                # Fall through to sequential storage

        # Sequential storage
        for resource in resources:
            resource_type = resource.get_resource_type()

            success, resource_id, error_msg = self.store_resource(resource)

            if success:
                results["successful"] += 1
                if resource_id:
                    results["resource_ids"].append(f"{resource_type}/{resource_id}")
                else:
                    results["resource_ids"].append(f"{resource_type}/unknown")
            else:
                results["failed"] += 1
                results["errors"].append({
                    "resourceType": resource_type,
                    "error": error_msg
                })

        logger.info(
            f"Batch storage complete: {results['successful']} successful, "
            f"{results['failed']} failed out of {results['total']} total"
        )

        return results

    def _store_batch_transaction(
        self,
        resources: List[Any]
    ) -> Dict[str, Any]:
        """
        Store resources using FHIR Bundle transaction.

        Args:
            resources: List of FHIR resource objects

        Returns:
            Dictionary with storage results
        """
        results = {
            "total": len(resources),
            "successful": 0,
            "failed": 0,
            "resource_ids": [],
            "errors": []
        }

        # Convert resources to dictionaries
        resource_dicts = []
        for resource in resources:
            resource_dict = resource.dict(exclude_none=True)
            resource_dicts.append(resource_dict)

        # Create bundle
        bundle = self.client.create_bundle(
            resources=resource_dicts,
            bundle_type='transaction'
        )

        try:
            # Store bundle in HealthLake
            # Note: HealthLake doesn't have a direct bundle create method in boto3
            # We need to use the FHIR API endpoint directly
            logger.info(f"Creating transaction bundle with {len(resources)} resources")

            # For now, fall back to sequential storage without recursion
            logger.warning("Bundle transactions not yet implemented, using sequential storage")

            # Store sequentially without calling store_resources_batch again
            for resource in resources:
                resource_type = resource.get_resource_type()
                success, resource_id, error_msg = self.store_resource(resource)

                if success:
                    results["successful"] += 1
                    if resource_id:
                        results["resource_ids"].append(f"{resource_type}/{resource_id}")
                    else:
                        results["resource_ids"].append(f"{resource_type}/unknown")
                else:
                    results["failed"] += 1
                    results["errors"].append({
                        "resourceType": resource_type,
                        "error": error_msg
                    })

            return results

        except Exception as e:
            logger.error(f"Bundle transaction failed: {str(e)}")
            results["failed"] = len(resources)
            results["errors"].append({
                "resourceType": "Bundle",
                "error": str(e)
            })
            return results

    def get_patient_resources(
        self,
        patient_id: str
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Retrieve all resources for a specific patient.

        Args:
            patient_id: FHIR Patient resource ID

        Returns:
            Dictionary mapping resource types to lists of resources
        """
        try:
            logger.info(f"Retrieving all resources for patient: {patient_id}")
            return self.client.get_patient_resources(patient_id)
        except Exception as e:
            logger.error(f"Failed to retrieve patient resources: {str(e)}")
            raise

    def search_resources(
        self,
        resource_type: str,
        search_params: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for FHIR resources.

        Args:
            resource_type: FHIR resource type to search
            search_params: Dictionary of FHIR search parameters

        Returns:
            List of matching FHIR resources
        """
        try:
            logger.info(f"Searching {resource_type} with params: {search_params}")
            return self.client.search_resources(resource_type, search_params)
        except Exception as e:
            logger.error(f"Search failed: {str(e)}")
            raise

    def update_resource(
        self,
        resource_type: str,
        resource_id: str,
        resource_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update an existing FHIR resource.

        Args:
            resource_type: FHIR resource type
            resource_id: FHIR resource ID
            resource_data: Updated resource data

        Returns:
            Updated resource
        """
        try:
            logger.info(f"Updating {resource_type}/{resource_id}")
            return self.client.update_resource(resource_type, resource_id, resource_data)
        except Exception as e:
            logger.error(f"Update failed: {str(e)}")
            raise

    def delete_resource(
        self,
        resource_type: str,
        resource_id: str
    ) -> None:
        """
        Delete a FHIR resource.

        Args:
            resource_type: FHIR resource type
            resource_id: FHIR resource ID
        """
        try:
            logger.info(f"Deleting {resource_type}/{resource_id}")
            self.client.delete_resource(resource_type, resource_id)
        except Exception as e:
            logger.error(f"Delete failed: {str(e)}")
            raise

