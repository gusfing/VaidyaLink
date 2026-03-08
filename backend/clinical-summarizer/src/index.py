"""
Clinical Summarizer Lambda Handler

This Lambda function generates 30-second clinical summaries from patient FHIR records:
1. Queries AWS HealthLake for patient FHIR resources
2. Aggregates clinical data chronologically
3. Generates structured summary using Amazon Bedrock (Claude 3.5 Sonnet)
4. Calculates confidence scores for extracted facts
5. Formats output for clinical display

Runtime: Python 3.11
"""

import json
import os
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

import boto3
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Initialize AWS clients (lazy-loaded)
bedrock_runtime = None
healthlake_client = None
dynamodb = None

# Environment variables
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'anthropic.claude-3-5-sonnet-20241022-v2:0')
BEDROCK_REGION = os.environ.get('BEDROCK_REGION', 'us-east-1')
HEALTHLAKE_DATASTORE_ID = os.environ.get('HEALTHLAKE_DATASTORE_ID')
HEALTHLAKE_ENDPOINT = os.environ.get('HEALTHLAKE_ENDPOINT')
MAX_SUMMARY_WORDS = int(os.environ.get('MAX_SUMMARY_WORDS', '200'))
MAX_RECENT_ENCOUNTERS = int(os.environ.get('MAX_RECENT_ENCOUNTERS', '10'))
MAX_MEDICATIONS = int(os.environ.get('MAX_MEDICATIONS', '15'))
MIN_FACT_CONFIDENCE = float(os.environ.get('MIN_FACT_CONFIDENCE', '0.70'))
ENABLE_SUMMARY_CACHE = os.environ.get('ENABLE_SUMMARY_CACHE', 'true').lower() == 'true'
CACHE_TTL_SECONDS = int(os.environ.get('CACHE_TTL_SECONDS', '3600'))


class ClinicalSummarizerError(Exception):
    """Base exception for Clinical Summarizer errors"""
    pass


class HealthLakeQueryError(ClinicalSummarizerError):
    """Exception for HealthLake query failures"""
    pass


class BedrockSummarizationError(ClinicalSummarizerError):
    """Exception for Bedrock summarization failures"""
    pass


def get_bedrock_client():
    """
    Get or create Bedrock Runtime client (singleton pattern for Lambda reuse).

    Returns:
        Bedrock Runtime client
    """
    global bedrock_runtime

    if bedrock_runtime is None:
        logger.info(f"Initializing Bedrock Runtime client in region: {BEDROCK_REGION}")
        bedrock_runtime = boto3.client('bedrock-runtime', region_name=BEDROCK_REGION)

    return bedrock_runtime


def get_healthlake_client():
    """
    Get or create HealthLake client (singleton pattern for Lambda reuse).

    Returns:
        HealthLake client
    """
    global healthlake_client

    if healthlake_client is None:
        logger.info(f"Initializing HealthLake client with datastore: {HEALTHLAKE_DATASTORE_ID}")
        healthlake_client = boto3.client('healthlake')

    return healthlake_client


def get_dynamodb_resource():
    """
    Get or create DynamoDB resource (singleton pattern for Lambda reuse).

    Returns:
        DynamoDB resource
    """
    global dynamodb

    if dynamodb is None:
        logger.info("Initializing DynamoDB resource")
        dynamodb = boto3.resource('dynamodb')

    return dynamodb


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for clinical summarization.

    Args:
        event: Lambda event containing patient ID and options
        context: Lambda context object

    Returns:
        Response with clinical summary and metadata

    Event Structure:
        {
            "patientId": "string",
            "options": {
                "maxWords": int,
                "includeLabResults": bool,
                "includeVitalSigns": bool,
                "includeDiagnosticReports": bool,
                "maxRecordAgeDays": int,
                "outputFormat": "json" | "markdown" | "html"
            }
        }
    """
    request_id = context.request_id if context else 'unknown'

    try:
        logger.info(f"Processing clinical summary request (request_id: {request_id}): {json.dumps(event)}")

        # Extract patient ID
        patient_id = event.get('patientId')
        if not patient_id:
            raise ClinicalSummarizerError("patientId is required")

        # Extract options
        options = event.get('options', {})

        # Check cache if enabled
        if ENABLE_SUMMARY_CACHE:
            cached_summary = get_cached_summary(patient_id, options)
            if cached_summary:
                logger.info(f"Returning cached summary for patient {patient_id}")
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'summary': cached_summary,
                        'cached': True,
                        'requestId': request_id
                    })
                }

        # Generate new summary
        summary = generate_clinical_summary(patient_id, options)

        # Cache the summary if enabled
        if ENABLE_SUMMARY_CACHE:
            cache_summary(patient_id, options, summary)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'summary': summary,
                'cached': False,
                'requestId': request_id
            })
        }

    except ClinicalSummarizerError as e:
        logger.error(f"Clinical Summarizer error: {str(e)}")
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': 'ClinicalSummarizerError',
                'message': str(e),
                'requestId': request_id
            })
        }

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'InternalError',
                'message': 'An unexpected error occurred during clinical summarization',
                'requestId': request_id
            })
        }


def generate_clinical_summary(patient_id: str, options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate clinical summary for a patient.

    Args:
        patient_id: Patient identifier
        options: Summarization options

    Returns:
        Clinical summary with metadata
    """
    start_time = datetime.utcnow()

    logger.info(f"Generating clinical summary for patient {patient_id}")

    # Step 1: Query HealthLake for patient FHIR resources
    logger.info(f"Querying HealthLake for patient {patient_id} resources")
    fhir_resources = query_patient_resources(patient_id, options)

    if not fhir_resources:
        logger.warning(f"No FHIR resources found for patient {patient_id}")
        return {
            'patientId': patient_id,
            'summary': 'No clinical data available for this patient.',
            'metadata': {
                'resourceCount': 0,
                'generatedAt': start_time.isoformat(),
                'processingTimeMs': 0
            }
        }

    # Step 2: Aggregate and prepare clinical data
    logger.info(f"Aggregating {len(fhir_resources)} FHIR resources")
    aggregated_data = aggregate_clinical_data(fhir_resources, options)

    # Step 3: Generate summary using Amazon Bedrock
    logger.info(f"Generating summary with Bedrock model: {BEDROCK_MODEL_ID}")
    summary_text, confidence_scores = generate_summary_with_bedrock(
        patient_id=patient_id,
        aggregated_data=aggregated_data,
        options=options
    )

    # Step 4: Format output
    output_format = options.get('outputFormat', 'json')
    formatted_summary = format_summary(summary_text, output_format)

    # Calculate processing time
    processing_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

    logger.info(f"Clinical summary generated in {processing_time_ms:.2f}ms")

    return {
        'patientId': patient_id,
        'summary': formatted_summary,
        'confidenceScores': confidence_scores,
        'metadata': {
            'resourceCount': len(fhir_resources),
            'generatedAt': start_time.isoformat(),
            'processingTimeMs': processing_time_ms,
            'modelId': BEDROCK_MODEL_ID,
            'outputFormat': output_format
        }
    }


def query_patient_resources(patient_id: str, options: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Query HealthLake for patient FHIR resources.

    Args:
        patient_id: Patient identifier
        options: Query options (includeLabResults, includeVitalSigns, includeDiagnosticReports, maxRecordAgeDays)

    Returns:
        List of FHIR resources
    """
    try:
        logger.info(f"Querying HealthLake for patient {patient_id}")

        # Import shared HealthLake client
        import sys
        import os
        shared_path = os.path.join(os.path.dirname(__file__), '..', '..', 'shared', 'python')
        if shared_path not in sys.path:
            sys.path.insert(0, shared_path)

        from healthlake.healthlake_client import HealthLakeClient

        # Initialize HealthLake client
        healthlake = HealthLakeClient(
            datastore_id=HEALTHLAKE_DATASTORE_ID,
            datastore_endpoint=HEALTHLAKE_ENDPOINT
        )

        # Define resource types to query
        resource_types = [
            'Patient',           # Patient demographics
            'Encounter',         # Clinical visits
            'Condition',         # Diagnoses and chronic conditions
            'MedicationStatement',  # Current and past medications
            'AllergyIntolerance',   # Allergies
        ]

        # Add optional resource types based on options
        if options.get('includeLabResults', True):
            resource_types.append('Observation')

        if options.get('includeDiagnosticReports', True):
            resource_types.append('DiagnosticReport')

        # Collect all resources
        all_resources = []

        # Query each resource type
        for resource_type in resource_types:
            try:
                logger.info(f"Querying {resource_type} resources for patient {patient_id}")

                # Build search parameters
                search_params = {'patient': patient_id}

                # Add date filter if specified
                max_age_days = options.get('maxRecordAgeDays')
                if max_age_days and resource_type != 'Patient':
                    from datetime import datetime, timedelta
                    cutoff_date = (datetime.utcnow() - timedelta(days=max_age_days)).strftime('%Y-%m-%d')
                    search_params['date'] = f"ge{cutoff_date}"

                # Add count limit for large result sets
                search_params['_count'] = '100'

                # Query HealthLake
                resources = healthlake.search_resources(
                    resource_type=resource_type,
                    search_params=search_params
                )

                logger.info(f"Retrieved {len(resources)} {resource_type} resources")

                # Apply resource-specific limits
                if resource_type == 'Encounter' and len(resources) > MAX_RECENT_ENCOUNTERS:
                    # Sort by date and keep most recent
                    resources.sort(key=lambda r: r.get('period', {}).get('start', ''), reverse=True)
                    all_resources.extend(resources[:MAX_RECENT_ENCOUNTERS])
                elif resource_type == 'MedicationStatement' and len(resources) > MAX_MEDICATIONS:
                    # Sort by effective date and keep most recent
                    resources.sort(key=lambda r: r.get('effectiveDateTime', r.get('effectivePeriod', {}).get('start', '')), reverse=True)
                    all_resources.extend(resources[:MAX_MEDICATIONS])
                else:
                    all_resources.extend(resources)

            except Exception as e:
                # Log error but continue with other resource types
                logger.warning(f"Failed to query {resource_type} for patient {patient_id}: {str(e)}")
                continue

        logger.info(f"Total resources retrieved: {len(all_resources)}")
        return all_resources

    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        error_message = e.response.get('Error', {}).get('Message', '')
        logger.error(f"HealthLake query error: {error_code} - {error_message}")
        raise HealthLakeQueryError(f"Failed to query HealthLake: {error_message}")

    except Exception as e:
        logger.error(f"Unexpected error querying HealthLake: {str(e)}", exc_info=True)
        raise HealthLakeQueryError(f"Unexpected error during HealthLake query: {str(e)}")


def aggregate_clinical_data(fhir_resources: List[Dict[str, Any]], options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Aggregate FHIR resources into structured clinical data.

    Args:
        fhir_resources: List of FHIR resources
        options: Aggregation options

    Returns:
        Aggregated clinical data
    """
    # Import data aggregation utility
    from utils.data_aggregator import aggregate_clinical_data as aggregate_data

    logger.info(f"Aggregating {len(fhir_resources)} FHIR resources")

    # Use the data aggregation pipeline
    return aggregate_data(fhir_resources, options)


def generate_summary_with_bedrock(
    patient_id: str,
    aggregated_data: Dict[str, Any],
    options: Dict[str, Any]
) -> tuple[str, Dict[str, float]]:
    """
    Generate clinical summary using Amazon Bedrock.

    Args:
        patient_id: Patient identifier
        aggregated_data: Aggregated clinical data
        options: Summarization options

    Returns:
        Tuple of (summary text, confidence scores)
    """
    try:
        logger.info(f"Generating summary with Bedrock for patient {patient_id}")

        # Import Bedrock summarizer
        from utils.bedrock_summarizer import create_bedrock_summarizer

        # Create Bedrock summarizer instance
        summarizer = create_bedrock_summarizer(
            model_id=BEDROCK_MODEL_ID,
            region=BEDROCK_REGION,
            max_tokens=int(os.environ.get('BEDROCK_MAX_TOKENS', '1024')),
            temperature=float(os.environ.get('BEDROCK_TEMPERATURE', '0.0')),
            top_p=float(os.environ.get('BEDROCK_TOP_P', '0.9'))
        )

        # Generate summary
        summary_text, confidence_scores = summarizer.generate_summary(
            patient_id=patient_id,
            aggregated_data=aggregated_data,
            options=options
        )

        logger.info(f"Successfully generated summary for patient {patient_id} "
                   f"(overall confidence: {confidence_scores.get('overall', 0.0):.2%})")

        return summary_text, confidence_scores

    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        error_message = e.response.get('Error', {}).get('Message', '')
        logger.error(f"Bedrock error: {error_code} - {error_message}")
        raise BedrockSummarizationError(f"Failed to generate summary with Bedrock: {error_message}")

    except Exception as e:
        logger.error(f"Unexpected error generating summary: {str(e)}", exc_info=True)
        raise BedrockSummarizationError(f"Unexpected error during summarization: {str(e)}")


def format_summary(summary_text: str, output_format: str) -> str:
    """
    Format summary according to requested output format.

    Args:
        summary_text: Raw summary text
        output_format: Desired output format (json, markdown, html)

    Returns:
        Formatted summary
    """
    # This is a placeholder implementation
    # Actual implementation will be in Task 11.7
    logger.info(f"Formatting summary as {output_format}")

    # TODO: Implement in Task 11.7
    return summary_text


def get_cached_summary(patient_id: str, options: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Retrieve cached summary if available and valid.

    Args:
        patient_id: Patient identifier
        options: Summarization options

    Returns:
        Cached summary or None
    """
    # This is a placeholder implementation
    # Actual implementation will be in Task 11.8
    logger.debug(f"Checking cache for patient {patient_id}")

    # TODO: Implement in Task 11.8
    return None


def cache_summary(patient_id: str, options: Dict[str, Any], summary: Dict[str, Any]) -> None:
    """
    Cache generated summary.

    Args:
        patient_id: Patient identifier
        options: Summarization options
        summary: Generated summary
    """
    # This is a placeholder implementation
    # Actual implementation will be in Task 11.8
    logger.debug(f"Caching summary for patient {patient_id}")

    # TODO: Implement in Task 11.8
    pass


# For local testing
if __name__ == "__main__":
    # Test event
    test_event = {
        'patientId': 'test-patient-123',
        'options': {
            'maxWords': 200,
            'includeLabResults': True,
            'includeVitalSigns': True,
            'outputFormat': 'json'
        }
    }

    # Mock context
    class MockContext:
        request_id = 'test-request-123'
        function_name = 'clinical-summarizer-test'

    result = lambda_handler(test_event, MockContext())
    print(json.dumps(result, indent=2))
