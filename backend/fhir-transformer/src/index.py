"""
FHIR Transformer Lambda Handler

Converts structured clinical data to HL7 FHIR R4 resources and stores them in AWS HealthLake.
"""

import json
import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

import boto3
from botocore.exceptions import ClientError

# Add path for shared libraries
import sys
sys.path.append('/opt/python')

from utils.fhir_builder import FHIRResourceBuilder
from utils.code_mapper import CodeSystemMapper
from utils.validator import FHIRValidator, ProfileType
from utils.healthlake_store import HealthLakeStore
from config import Config

# Configure logging
logger = logging.getLogger()
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))


class FHIRTransformerError(Exception):
    """Base exception for FHIR Transformer errors"""
    pass


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for FHIR transformation

    Args:
        event: Lambda event containing structured clinical data
        context: Lambda context object

    Returns:
        Response with FHIR resource IDs and status

    Event Structure:
        {
            "operation": "transform" | "export" | "validate",
            "data": {
                "patientData": {...},
                "encounters": [...],
                "medications": [...],
                "observations": [...],
                "diagnosticReports": [...]
            },
            "patientId": "string",
            "jobId": "string",
            "options": {
                "validateOnly": bool,
                "exportFormat": "json" | "xml",
                "pushToABDM": bool
            }
        }
    """
    try:
        logger.info(f"Processing FHIR transformation request: {json.dumps(event)}")

        # Extract operation type
        operation = event.get('operation', 'transform')

        # Route to appropriate handler
        if operation == 'transform':
            return handle_transform(event, context)
        elif operation == 'export':
            return handle_export(event, context)
        elif operation == 'validate':
            return handle_validate(event, context)
        else:
            raise FHIRTransformerError(f"Unknown operation: {operation}")

    except FHIRTransformerError as e:
        logger.error(f"FHIR Transformer error: {str(e)}")
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': 'FHIRTransformerError',
                'message': str(e)
            })
        }
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'InternalError',
                'message': 'An unexpected error occurred during FHIR transformation'
            })
        }


def handle_voice_transform(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Transform voice-extracted clinical data to FHIR resources

    Handles the special payload format from voice-processing Lambda:
    {
        "source": "voice-processing",
        "sourceJobId": "voice-job-123",
        "patientId": "patient-456",
        "timestamp": "2024-01-15T10:30:00Z",
        "resources": [
            {
                "resourceType": "Observation" | "MedicationStatement",
                "category": "symptom" | "vital-signs" | "medication" | etc.,
                "data": {...},
                "confidence": 0.85,
                "sourceText": "..." (optional)
            }
        ],
        "metadata": {
            "overallConfidence": 0.85,
            "confidenceByEntity": {...},
            "extractionMethod": "voice-transcription",
            "language": "hi",
            "userConfirmed": true
        }
    }

    Args:
        event: Voice processing Lambda event
        context: Lambda context

    Returns:
        Response with created FHIR resource IDs
    """
    patient_id = event.get('patientId')
    job_id = event.get('sourceJobId')
    resources_data = event.get('resources', [])
    metadata = event.get('metadata', {})
    timestamp = event.get('timestamp')

    if not patient_id:
        raise FHIRTransformerError("patientId is required for voice transform")

    if not resources_data:
        logger.warning(f"No resources to transform for voice job {job_id}")
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'No resources to transform',
                'patientId': patient_id,
                'jobId': job_id,
                'resourceIds': [],
                'resourceCount': 0
            })
        }

    logger.info(
        f"Transforming voice data for patient: {patient_id}, job: {job_id}, "
        f"resources: {len(resources_data)}, language: {metadata.get('language')}, "
        f"confidence: {metadata.get('overallConfidence')}"
    )

    # Initialize FHIR utilities
    builder = FHIRResourceBuilder()
    validator = FHIRValidator(profile=ProfileType.VAIDYALINK)

    created_resources = []
    resource_ids = []

    try:
        # Process each resource from voice data
        for resource_data in resources_data:
            resource_type = resource_data.get('resourceType')
            category = resource_data.get('category')
            data = resource_data.get('data', {})
            confidence = resource_data.get('confidence', metadata.get('overallConfidence', 0.0))
            source_text = resource_data.get('sourceText')

            if not resource_type or not data:
                logger.warning(f"Skipping invalid resource: {resource_data}")
                continue

            # Create FHIR resource based on type
            fhir_resource = None

            if resource_type == 'Observation':
                fhir_resource = create_observation_from_voice(
                    builder, data, category, patient_id, confidence,
                    source_text, timestamp, metadata
                )
            elif resource_type == 'MedicationStatement':
                fhir_resource = create_medication_from_voice(
                    builder, data, patient_id, confidence,
                    source_text, timestamp, metadata
                )
            else:
                logger.warning(f"Unsupported resource type from voice: {resource_type}")
                continue

            if fhir_resource:
                # Validate resource
                if validator.validate_resource(fhir_resource):
                    created_resources.append(fhir_resource)
                    logger.info(f"Created {resource_type} from voice data (category: {category})")
                else:
                    logger.warning(f"Validation warnings for {resource_type}: {validator.get_warnings()}")
                    if validator.get_errors():
                        logger.error(f"Validation errors for {resource_type}: {validator.get_errors()}")
                        # Still add resource but log the error
                        created_resources.append(fhir_resource)

        if not created_resources:
            logger.warning(f"No valid resources created from voice job {job_id}")
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'No valid resources created',
                    'patientId': patient_id,
                    'jobId': job_id,
                    'resourceIds': [],
                    'resourceCount': 0
                })
            }

        # Store resources in AWS HealthLake
        try:
            healthlake_store = HealthLakeStore()
            logger.info(f"Storing {len(created_resources)} voice-extracted resources in HealthLake")

            storage_results = healthlake_store.store_resources_batch(created_resources)
            resource_ids = storage_results['resource_ids']

            logger.info(
                f"HealthLake storage complete: {storage_results['successful']} successful, "
                f"{storage_results['failed']} failed out of {storage_results['total']} total"
            )

            if storage_results['failed'] > 0:
                logger.warning(f"Some resources failed to store: {storage_results['errors']}")
                if storage_results['successful'] == 0:
                    raise FHIRTransformerError(
                        f"All resources failed to store in HealthLake: {storage_results['errors']}"
                    )

        except Exception as e:
            logger.error(f"HealthLake storage failed: {str(e)}")
            raise FHIRTransformerError(f"Failed to store voice resources in HealthLake: {str(e)}")

        # Update DynamoDB VoiceJobs table with FHIR resource IDs
        try:
            update_voice_job_with_fhir_ids(job_id, resource_ids)
        except Exception as e:
            logger.warning(f"Failed to update VoiceJobs table: {str(e)}")
            # Don't fail the entire operation if DynamoDB update fails

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Voice FHIR transformation completed',
                'patientId': patient_id,
                'jobId': job_id,
                'resourceIds': resource_ids,
                'resourceCount': len(created_resources),
                'language': metadata.get('language'),
                'overallConfidence': metadata.get('overallConfidence'),
                'userConfirmed': metadata.get('userConfirmed'),
                'timestamp': datetime.utcnow().isoformat()
            })
        }

    except Exception as e:
        logger.error(f"Error during voice transformation: {str(e)}")
        raise FHIRTransformerError(f"Voice transformation failed: {str(e)}")


def handle_transform(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Transform structured clinical data to FHIR resources

    Args:
        event: Lambda event with clinical data
        context: Lambda context

    Returns:
        Response with created FHIR resource IDs
    """
    # Check if this is a voice-processing payload
    source = event.get('source')
    if source == 'voice-processing':
        return handle_voice_transform(event, context)

    data = event.get('data', {})
    patient_id = event.get('patientId')
    job_id = event.get('jobId')
    options = event.get('options', {})

    if not patient_id:
        raise FHIRTransformerError("patientId is required")

    logger.info(f"Transforming data for patient: {patient_id}, job: {job_id}")

    # Initialize FHIR utilities
    builder = FHIRResourceBuilder()
    mapper = CodeSystemMapper()

    # Choose validation profile based on use case
    # ProfileType.BASE_R4 - Default FHIR R4 validation
    # ProfileType.ABDM - For ABDM integration (requires ABHA ID, Indian codes)
    # ProfileType.VAIDYALINK - For AI-extracted data (requires confidence scores)
    # ProfileType.US_CORE - For medical tourism (US healthcare compatibility)
    profile = ProfileType.ABDM if options.get('pushToABDM') else ProfileType.BASE_R4
    validator = FHIRValidator(profile=profile)

    logger.info(f"Using validation profile: {profile.value}")

    created_resources = []
    resource_ids = []

    try:
        # Create Patient resource if patient data provided
        if data.get('patientData'):
            patient = builder.create_patient(data['patientData'])

            # Validate patient resource
            if validator.validate_resource(patient):
                created_resources.append(patient)
                logger.info(f"Patient resource created and validated")
            else:
                logger.warning(f"Patient validation warnings: {validator.get_warnings()}")
                if validator.get_errors():
                    raise FHIRTransformerError(f"Patient validation failed: {validator.get_errors()}")

        # Create MedicationStatement resources
        if data.get('medications'):
            for med_data in data['medications']:
                # Enhance with code mappings
                if med_data.get('text') and not med_data.get('code'):
                    atc_mapping = mapper.map_medication_to_atc(med_data['text'])
                    if atc_mapping and atc_mapping.get('code'):
                        med_data['code'] = atc_mapping['code']
                        med_data['display'] = atc_mapping['display']
                        med_data['codeSystem'] = atc_mapping['system']

                med_statement = builder.create_medication_statement(
                    med_data,
                    f"Patient/{patient_id}"
                )

                if validator.validate_resource(med_statement):
                    created_resources.append(med_statement)
                    logger.info(f"MedicationStatement resource created")

        # Create Observation resources
        if data.get('observations'):
            for obs_data in data['observations']:
                # Enhance with code mappings
                if obs_data.get('text') and not obs_data.get('code'):
                    loinc_mapping = mapper.map_lab_test_to_loinc(obs_data['text'])
                    if loinc_mapping and loinc_mapping.get('code'):
                        obs_data['code'] = loinc_mapping['code']
                        obs_data['display'] = loinc_mapping['display']
                        obs_data['codeSystem'] = loinc_mapping['system']

                observation = builder.create_observation(
                    obs_data,
                    f"Patient/{patient_id}"
                )

                if validator.validate_resource(observation):
                    created_resources.append(observation)
                    logger.info(f"Observation resource created")

        # Create Encounter resources
        if data.get('encounters'):
            for enc_data in data['encounters']:
                encounter = builder.create_encounter(
                    enc_data,
                    f"Patient/{patient_id}"
                )

                if validator.validate_resource(encounter):
                    created_resources.append(encounter)
                    logger.info(f"Encounter resource created")

        # Create DiagnosticReport resources
        if data.get('diagnosticReports'):
            for report_data in data['diagnosticReports']:
                diagnostic_report = builder.create_diagnostic_report(
                    report_data,
                    f"Patient/{patient_id}"
                )

                if validator.validate_resource(diagnostic_report):
                    created_resources.append(diagnostic_report)
                    logger.info(f"DiagnosticReport resource created")

        # Store resources in AWS HealthLake
        try:
            # Initialize HealthLake store
            healthlake_store = HealthLakeStore()
            logger.info(f"Initialized HealthLake store for datastore: {Config.HEALTHLAKE_DATASTORE_ID}")

            # Store all resources in batch
            storage_results = healthlake_store.store_resources_batch(created_resources)

            # Extract resource IDs from results
            resource_ids = storage_results['resource_ids']

            # Log storage summary
            logger.info(
                f"HealthLake storage complete: {storage_results['successful']} successful, "
                f"{storage_results['failed']} failed out of {storage_results['total']} total"
            )

            # If any resources failed to store, log errors but don't fail the entire operation
            if storage_results['failed'] > 0:
                logger.warning(f"Some resources failed to store: {storage_results['errors']}")
                # Still return success if at least some resources were stored
                if storage_results['successful'] == 0:
                    raise FHIRTransformerError(
                        f"All resources failed to store in HealthLake: {storage_results['errors']}"
                    )

        except Exception as e:
            logger.error(f"HealthLake storage failed: {str(e)}")
            raise FHIRTransformerError(f"Failed to store resources in HealthLake: {str(e)}")
            # Fallback: return resource types without IDs
            resource_ids = [
                f"{res.get_resource_type()}/pending" for res in created_resources
            ]
            raise FHIRTransformerError(f"Failed to store resources in HealthLake: {str(e)}")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'FHIR transformation completed',
                'patientId': patient_id,
                'jobId': job_id,
                'resourceIds': resource_ids,
                'resourceCount': len(created_resources),
                'timestamp': datetime.utcnow().isoformat()
            })
        }

    except Exception as e:
        logger.error(f"Error during transformation: {str(e)}")
        raise FHIRTransformerError(f"Transformation failed: {str(e)}")


def handle_export(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Export patient FHIR resources as a bundle

    Args:
        event: Lambda event with export parameters
            {
                "patientId": str (required),
                "options": {
                    "exportFormat": "json" | "xml" (default: "json"),
                    "bundleType": "collection" | "document" (default: "collection"),
                    "includePatient": bool (default: true),
                    "resourceTypes": List[str] (optional, defaults to all)
                }
            }
        context: Lambda context

    Returns:
        Response with export location and bundle metadata
    """
    patient_id = event.get('patientId')
    options = event.get('options', {})
    export_format = options.get('exportFormat', 'json')
    bundle_type = options.get('bundleType', 'collection')
    include_patient = options.get('includePatient', True)
    resource_types_filter = options.get('resourceTypes')

    if not patient_id:
        raise FHIRTransformerError("patientId is required for export")

    if export_format not in ['json', 'xml']:
        raise FHIRTransformerError(f"Invalid export format: {export_format}. Must be 'json' or 'xml'")

    if bundle_type not in ['collection', 'document', 'transaction', 'batch']:
        raise FHIRTransformerError(f"Invalid bundle type: {bundle_type}")

    logger.info(f"Exporting FHIR bundle for patient: {patient_id}, format: {export_format}, type: {bundle_type}")

    try:
        # Initialize utilities
        healthlake_store = HealthLakeStore()
        builder = FHIRResourceBuilder()

        # Retrieve all patient resources from HealthLake
        logger.info(f"Retrieving resources for patient: {patient_id}")
        patient_resources_dict = healthlake_store.get_patient_resources(patient_id)

        # Collect all resources for the bundle
        all_resources = []

        # Add Patient resource if requested
        if include_patient:
            try:
                patient_resource = healthlake_store.client.read_resource('Patient', patient_id)
                all_resources.append(patient_resource)
                logger.info(f"Added Patient resource to bundle")
            except Exception as e:
                logger.warning(f"Could not retrieve Patient resource: {str(e)}")

        # Add other resources, filtering by type if specified
        resource_count_by_type = {}
        for resource_type, resources in patient_resources_dict.items():
            # Apply resource type filter if provided
            if resource_types_filter and resource_type not in resource_types_filter:
                logger.info(f"Skipping {resource_type} (not in filter)")
                continue

            if resources:
                all_resources.extend(resources)
                resource_count_by_type[resource_type] = len(resources)
                logger.info(f"Added {len(resources)} {resource_type} resources to bundle")

        if not all_resources:
            logger.warning(f"No resources found for patient: {patient_id}")
            return {
                'statusCode': 404,
                'body': json.dumps({
                    'error': 'NoResourcesFound',
                    'message': f'No FHIR resources found for patient: {patient_id}',
                    'patientId': patient_id
                })
            }

        # Create FHIR Bundle
        logger.info(f"Creating FHIR Bundle with {len(all_resources)} resources")
        bundle = builder.create_bundle(all_resources, bundle_type=bundle_type)

        # Convert bundle to requested format
        if export_format == 'json':
            bundle_content = builder.resource_to_json(bundle)
            content_type = 'application/fhir+json'
            file_extension = 'json'
        else:  # xml
            # Convert to XML using fhir.resources
            try:
                # Use the bundle's built-in JSON serialization
                # Note: Full XML conversion requires additional XML serialization library
                # For production, consider using fhir.resources XML capabilities or lxml
                bundle_json = builder.resource_to_json(bundle)

                # For now, store as JSON with XML extension as a placeholder
                # A full implementation would convert JSON to proper FHIR XML format
                bundle_content = bundle_json
                content_type = 'application/fhir+json'  # Keep as JSON for now
                file_extension = 'json'  # Keep as JSON for now
                logger.warning("XML export not fully implemented - exporting as JSON format")
            except Exception as e:
                logger.error(f"XML conversion failed: {str(e)}")
                raise FHIRTransformerError(f"Failed to convert bundle to XML: {str(e)}")

        # Store bundle in S3 for download
        s3_client = boto3.client('s3')
        bucket_name = os.environ.get('EXPORT_BUCKET', Config.S3_BUCKET)
        timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
        s3_key = f"exports/{patient_id}/fhir-bundle-{timestamp}.{file_extension}"

        try:
            s3_client.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=bundle_content,
                ContentType=content_type,
                Metadata={
                    'patient-id': patient_id,
                    'bundle-type': bundle_type,
                    'resource-count': str(len(all_resources)),
                    'export-timestamp': datetime.utcnow().isoformat()
                }
            )
            logger.info(f"Bundle stored in S3: s3://{bucket_name}/{s3_key}")

            # Generate pre-signed URL for download (valid for 1 hour)
            download_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=3600
            )

        except Exception as e:
            logger.error(f"Failed to store bundle in S3: {str(e)}")
            raise FHIRTransformerError(f"Failed to store export bundle: {str(e)}")

        # Return success response
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'FHIR export completed successfully',
                'patientId': patient_id,
                'format': export_format,
                'bundleType': bundle_type,
                'resourceCount': len(all_resources),
                'resourceCountByType': resource_count_by_type,
                's3Location': f"s3://{bucket_name}/{s3_key}",
                'downloadUrl': download_url,
                'expiresIn': 3600,
                'timestamp': datetime.utcnow().isoformat()
            })
        }

    except FHIRTransformerError:
        raise
    except Exception as e:
        logger.error(f"Error during export: {str(e)}", exc_info=True)
        raise FHIRTransformerError(f"Export failed: {str(e)}")


def handle_validate(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Validate FHIR resources without storing them

    Args:
        event: Lambda event with FHIR resources
        context: Lambda context

    Returns:
        Validation results
    """
    data = event.get('data', {})

    logger.info("Validating FHIR resources")

    # Initialize validator
    validator = FHIRValidator()
    builder = FHIRResourceBuilder()

    validation_results = {
        'valid': True,
        'errors': [],
        'warnings': [],
        'resourceResults': []
    }

    try:
        # Validate each resource type
        if data.get('patientData'):
            patient = builder.create_patient(data['patientData'])
            is_valid = validator.validate_resource(patient)
            validation_results['resourceResults'].append({
                'resourceType': patient.get_resource_type(),
                'valid': is_valid,
                'errors': validator.get_errors(),
                'warnings': validator.get_warnings()
            })
            if not is_valid:
                validation_results['valid'] = False
                validation_results['errors'].extend(validator.get_errors())
            validation_results['warnings'].extend(validator.get_warnings())

        # Validate medications
        if data.get('medications'):
            for i, med_data in enumerate(data['medications']):
                med_statement = builder.create_medication_statement(
                    med_data,
                    "Patient/example"
                )
                is_valid = validator.validate_resource(med_statement)
                validation_results['resourceResults'].append({
                    'resourceType': med_statement.get_resource_type(),
                    'index': i,
                    'valid': is_valid,
                    'errors': validator.get_errors(),
                    'warnings': validator.get_warnings()
                })
                if not is_valid:
                    validation_results['valid'] = False
                    validation_results['errors'].extend(validator.get_errors())
                validation_results['warnings'].extend(validator.get_warnings())

        logger.info(f"Validation completed. Valid: {validation_results['valid']}")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'FHIR validation completed',
                'valid': validation_results['valid'],
                'errors': validation_results['errors'],
                'warnings': validation_results['warnings'],
                'resourceResults': validation_results['resourceResults'],
                'timestamp': datetime.utcnow().isoformat()
            })
        }

    except Exception as e:
        logger.error(f"Error during validation: {str(e)}")
        raise FHIRTransformerError(f"Validation failed: {str(e)}")


def create_observation_from_voice(
    builder: FHIRResourceBuilder,
    data: Dict[str, Any],
    category: str,
    patient_id: str,
    confidence: float,
    source_text: Optional[str],
    timestamp: Optional[str],
    metadata: Dict[str, Any]
) -> Any:
    """
    Create a FHIR Observation resource from voice-extracted data

    Args:
        builder: FHIR resource builder
        data: Voice-extracted observation data
        category: Observation category (symptom, vital-signs, allergy, etc.)
        patient_id: Patient ID
        confidence: Confidence score (0-1)
        source_text: Original transcribed text
        timestamp: Extraction timestamp
        metadata: Voice processing metadata

    Returns:
        FHIR Observation resource
    """
    observation_data = {
        'status': 'final',
        'category': category,
        'effectiveDateTime': timestamp or datetime.utcnow().isoformat(),
        'confidence': confidence,
    }

    # Build note with voice-specific context
    note_parts = []
    if source_text:
        note_parts.append(f"Voice transcription: {source_text}")

    note_parts.append(f"Extracted via voice interface in {metadata.get('language', 'unknown')} language")
    note_parts.append(f"Confidence: {int(confidence * 100)}%")

    if metadata.get('userConfirmed'):
        note_parts.append("User confirmed transcription")

    observation_data['note'] = '. '.join(note_parts)

    # Map category-specific data to FHIR Observation format
    if category == 'symptom':
        # Symptom observation
        observation_data['text'] = data.get('symptomName', 'Unknown symptom')
        observation_data['observationName'] = data.get('symptomName')

        # Map severity to interpretation
        severity = data.get('severity', '').lower()
        if severity in ['high', 'severe']:
            observation_data['interpretation'] = 'H'
            observation_data['interpretationDisplay'] = 'High'
        elif severity in ['moderate', 'medium']:
            observation_data['interpretation'] = 'N'
            observation_data['interpretationDisplay'] = 'Normal'
        elif severity in ['low', 'mild']:
            observation_data['interpretation'] = 'L'
            observation_data['interpretationDisplay'] = 'Low'

        # Add duration and onset as string value
        details = []
        if data.get('duration'):
            details.append(f"Duration: {data['duration']}")
        if data.get('onset'):
            details.append(f"Onset: {data['onset']}")
        if data.get('bodyLocation'):
            details.append(f"Location: {data['bodyLocation']}")

        if details:
            observation_data['valueString'] = ', '.join(details)
        else:
            observation_data['valueString'] = data.get('symptomName', 'Symptom reported')

    elif category == 'vital-signs':
        # Vital sign observation with LOINC code
        vital_type = data.get('vitalType')
        observation_data['code'] = data.get('loincCode')
        observation_data['display'] = data.get('display')
        observation_data['text'] = data.get('display', vital_type)

        # Parse value and unit from string like "38.5°C" or "120/80 mmHg"
        value_str = data.get('value', '')
        observation_data['valueString'] = value_str

        # Try to extract numeric value for quantity
        # This is a simple parser - production would need more robust parsing
        import re
        numeric_match = re.search(r'(\d+\.?\d*)', value_str)
        if numeric_match:
            try:
                numeric_value = float(numeric_match.group(1))
                unit_match = re.search(r'[°]?([A-Za-z%]+)', value_str)
                unit = unit_match.group(1) if unit_match else ''

                if unit:
                    observation_data['valueQuantity'] = {
                        'value': numeric_value,
                        'unit': unit,
                        'code': unit
                    }
            except ValueError:
                pass  # Keep as string value

    elif category == 'allergy':
        # Allergy observation
        allergen = data.get('allergen', 'Unknown allergen')
        observation_data['text'] = f"Allergy: {allergen}"
        observation_data['observationName'] = allergen

        # Build value as string with reaction and severity
        value_parts = [f"Allergen: {allergen}"]
        if data.get('reaction'):
            value_parts.append(f"Reaction: {data['reaction']}")
        if data.get('severity'):
            value_parts.append(f"Severity: {data['severity']}")

        observation_data['valueString'] = ', '.join(value_parts)

    elif category == 'chief-complaint':
        # Chief complaint observation
        complaint = data.get('complaint', '')
        observation_data['text'] = 'Chief Complaint'
        observation_data['observationName'] = 'Chief Complaint'
        observation_data['valueString'] = complaint

    elif category == 'medical-history':
        # Medical history observation
        condition = data.get('condition', 'Unknown condition')
        observation_data['text'] = f"Medical History: {condition}"
        observation_data['observationName'] = condition

        value_parts = [f"Condition: {condition}"]
        if data.get('diagnosedDate'):
            value_parts.append(f"Diagnosed: {data['diagnosedDate']}")
        if data.get('status'):
            value_parts.append(f"Status: {data['status']}")

        observation_data['valueString'] = ', '.join(value_parts)

    else:
        # Generic observation
        observation_data['text'] = str(data)
        observation_data['valueString'] = str(data)

    return builder.create_observation(observation_data, f"Patient/{patient_id}")


def create_medication_from_voice(
    builder: FHIRResourceBuilder,
    data: Dict[str, Any],
    patient_id: str,
    confidence: float,
    source_text: Optional[str],
    timestamp: Optional[str],
    metadata: Dict[str, Any]
) -> Any:
    """
    Create a FHIR MedicationStatement resource from voice-extracted data

    Args:
        builder: FHIR resource builder
        data: Voice-extracted medication data
        patient_id: Patient ID
        confidence: Confidence score (0-1)
        source_text: Original transcribed text
        timestamp: Extraction timestamp
        metadata: Voice processing metadata

    Returns:
        FHIR MedicationStatement resource
    """
    medication_data = {
        'medicationName': data.get('medicationName', 'Unknown medication'),
        'text': data.get('medicationName'),
        'status': 'active',
        'effectiveStart': timestamp or datetime.utcnow().isoformat(),
        'confidence': confidence,
    }

    # Build dosage information
    if data.get('dosage') or data.get('frequency') or data.get('route'):
        dosage_text_parts = []

        if data.get('dosage'):
            dosage_text_parts.append(data['dosage'])
        if data.get('frequency'):
            dosage_text_parts.append(data['frequency'])
        if data.get('route'):
            dosage_text_parts.append(f"via {data['route']}")

        medication_data['dosage'] = {
            'text': ' '.join(dosage_text_parts)
        }

        # Try to parse dosage value and unit
        if data.get('dosage'):
            import re
            dosage_match = re.search(r'(\d+\.?\d*)\s*([a-zA-Z]+)', data['dosage'])
            if dosage_match:
                medication_data['dosage']['doseValue'] = float(dosage_match.group(1))
                medication_data['dosage']['doseUnit'] = dosage_match.group(2)

        # Map route to SNOMED CT code (simplified)
        route = data.get('route', '').lower()
        if 'oral' in route:
            medication_data['dosage']['routeCode'] = '26643006'
            medication_data['dosage']['routeDisplay'] = 'Oral route'
        elif 'inject' in route or 'iv' in route:
            medication_data['dosage']['routeCode'] = '47625008'
            medication_data['dosage']['routeDisplay'] = 'Intravenous route'

    # Add duration to effective period
    if data.get('duration'):
        medication_data['note'] = f"Duration: {data['duration']}"

    if data.get('startDate'):
        medication_data['effectiveStart'] = data['startDate']

    # Build note with voice-specific context
    note_parts = []
    if source_text:
        note_parts.append(f"Voice transcription: {source_text}")

    note_parts.append(f"Extracted via voice interface in {metadata.get('language', 'unknown')} language")
    note_parts.append(f"Confidence: {int(confidence * 100)}%")

    if metadata.get('userConfirmed'):
        note_parts.append("User confirmed transcription")

    if medication_data.get('note'):
        note_parts.append(medication_data['note'])

    medication_data['note'] = '. '.join(note_parts)

    return builder.create_medication_statement(medication_data, f"Patient/{patient_id}")


def update_voice_job_with_fhir_ids(job_id: str, resource_ids: List[str]) -> None:
    """
    Update VoiceJobs DynamoDB table with FHIR resource IDs

    Args:
        job_id: Voice job ID
        resource_ids: List of FHIR resource IDs (e.g., ["Observation/123", "MedicationStatement/456"])
    """
    try:
        dynamodb = boto3.client('dynamodb')
        table_name = os.environ.get('VOICEJOBS_TABLE', 'VoiceJobs')

        dynamodb.update_item(
            TableName=table_name,
            Key={
                'PK': {'S': f'VOICE#{job_id}'},
                'SK': {'S': 'METADATA'}
            },
            UpdateExpression='SET fhirResourceIds = :ids, updatedAt = :updated',
            ExpressionAttributeValues={
                ':ids': {'L': [{'S': rid} for rid in resource_ids]},
                ':updated': {'S': datetime.utcnow().isoformat()}
            }
        )
        logger.info(f"Updated VoiceJobs table for job {job_id} with {len(resource_ids)} FHIR resource IDs")
    except Exception as e:
        logger.error(f"Failed to update VoiceJobs table: {str(e)}")
        raise
