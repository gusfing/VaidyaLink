"""
Document Processor Lambda Handler for AWS Real Data Integration

This Lambda function processes medical document images uploaded to S3:
1. Parses S3 event to extract bucket and key
2. Extracts jobId from S3 key pattern: uploads/{userId}/{jobId}-{filename}
3. Updates job status to 'processing' in DynamoDB

Runtime: Python 3.11
Memory: 3008 MB
Timeout: 300 seconds
"""

import json
import os
import logging
import re
import time
from typing import Dict, Any, Optional
from datetime import datetime
import boto3
from botocore.exceptions import ClientError

# Enable X-Ray tracing
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all

# Patch all supported libraries for X-Ray tracing
patch_all()

# Configure logging
logger = logging.getLogger()
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Initialize AWS clients (will be automatically instrumented by X-Ray)
dynamodb = boto3.resource('dynamodb')
bedrock_runtime = boto3.client('bedrock-runtime')
cloudwatch = boto3.client('cloudwatch')

# Environment variables
JOBS_TABLE = os.environ.get('JOBS_TABLE', 'document-scan-jobs')
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'anthropic.claude-3-5-sonnet-20241022-v2:0')


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for document processing.

    Args:
        event: S3 event notification
        context: Lambda context object

    Returns:
        Response dictionary with processing status
    """
    request_id = context.request_id if context else 'unknown'

    # Log processing start event
    logger.info(
        "Document processing started",
        extra={
            'requestId': request_id,
            'eventType': 'processing_start'
        }
    )

    try:
        logger.info(f"Processing event (request_id: {request_id}): {json.dumps(event)}")

        # Extract S3 event details
        if 'Records' not in event:
            raise ValueError("Invalid event: missing 'Records' field")

        for record in event['Records']:
            if record.get('eventSource') == 'aws:s3':
                process_s3_event(record, request_id)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Document processing started successfully',
                'requestId': request_id
            })
        }

    except Exception as e:
        logger.error(
            "Document processing failed",
            exc_info=True,
            extra={
                'requestId': request_id,
                'eventType': 'processing_failure',
                'error': str(e)
            }
        )

        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
                'requestId': request_id
            })
        }


def process_s3_event(record: Dict[str, Any], request_id: str) -> None:
    """
    Process S3 event notification.

    Args:
        record: S3 event record
        request_id: Request ID for tracking
    """
    job_id = None
    processing_start_time = time.time()

    try:
        # Extract bucket and key from S3 event
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']

        logger.info(
            f"Processing S3 object: s3://{bucket}/{key}",
            extra={'requestId': request_id}
        )

        # Extract jobId from S3 key pattern: uploads/{userId}/{jobId}-{filename}
        job_id = extract_job_id_from_key(key)

        if not job_id:
            logger.error(
                f"Invalid S3 key format: {key}",
                extra={'requestId': request_id}
            )
            raise ValueError(f"Invalid S3 key format. Expected: uploads/{{userId}}/{{jobId}}-{{filename}}, got: {key}")

        logger.info(
            f"Extracted jobId: {job_id}",
            extra={'jobId': job_id, 'requestId': request_id}
        )

        # Update job status to 'processing' in DynamoDB
        update_job_status(
            job_id=job_id,
            status='processing',
            message='Processing document with OCR...',
            metadata={
                'processingStartedAt': datetime.utcnow().isoformat(),
                's3Bucket': bucket,
                's3Key': key
            }
        )

        logger.info(
            f"Updated job {job_id} status to 'processing'",
            extra={'jobId': job_id, 'requestId': request_id}
        )

        # Perform OCR extraction
        try:
            ocr_text = extract_text_with_ocr(bucket, key, job_id)
            logger.info(
                f"OCR extraction completed for job {job_id}, extracted {len(ocr_text)} characters",
                extra={'jobId': job_id, 'requestId': request_id, 'ocrTextLength': len(ocr_text)}
            )

            # Update job status to 'extracting' after OCR completes
            update_job_status(
                job_id=job_id,
                status='extracting',
                message='Extracting medical entities...',
                metadata={
                    'ocrCompletedAt': datetime.utcnow().isoformat(),
                    'ocrTextLength': len(ocr_text)
                }
            )

            logger.info(
                f"Updated job {job_id} status to 'extracting'",
                extra={'jobId': job_id, 'requestId': request_id}
            )

            # Extract entities with Bedrock
            try:
                structured_data = extract_entities_with_bedrock(ocr_text, job_id)
                logger.info(
                    f"Entity extraction completed for job {job_id}",
                    extra={'jobId': job_id, 'requestId': request_id}
                )

                # Update job status to 'transforming'
                update_job_status(
                    job_id=job_id,
                    status='transforming',
                    message='Transforming to FHIR format...',
                    metadata={
                        'entityExtractionCompletedAt': datetime.utcnow().isoformat(),
                        'entitiesCount': len(structured_data.get('entities', [])),
                        'medicationsCount': len(structured_data.get('medications', [])),
                        'conditionsCount': len(structured_data.get('conditions', [])),
                        'labResultsCount': len(structured_data.get('labResults', []))
                    }
                )

                logger.info(
                    f"Updated job {job_id} status to 'transforming'",
                    extra={'jobId': job_id, 'requestId': request_id}
                )

                # Transform to FHIR format
                try:
                    fhir_bundle = transform_to_fhir(structured_data, job_id)
                    logger.info(
                        f"FHIR transformation completed for job {job_id}",
                        extra={'jobId': job_id, 'requestId': request_id}
                    )

                    # Store complete results in DynamoDB
                    store_results(
                        job_id=job_id,
                        ocr_text=ocr_text,
                        structured_data=structured_data,
                        fhir_bundle=fhir_bundle,
                        document_url=f"s3://{bucket}/{key}"
                    )

                    logger.info(
                        f"Results stored for job {job_id}",
                        extra={'jobId': job_id, 'requestId': request_id}
                    )

                    # Update job status to 'complete'
                    update_job_status(
                        job_id=job_id,
                        status='complete',
                        message='Processing complete',
                        metadata={
                            'processedAt': datetime.utcnow().isoformat(),
                            'completedSuccessfully': True
                        }
                    )

                    # Calculate processing duration
                    processing_duration = time.time() - processing_start_time

                    # Log completion event
                    logger.info(
                        "Document processing completed successfully",
                        extra={
                            'jobId': job_id,
                            'requestId': request_id,
                            'eventType': 'processing_complete',
                            'processingDuration': processing_duration,
                            'entitiesCount': len(structured_data.get('entities', [])),
                            'medicationsCount': len(structured_data.get('medications', [])),
                            'conditionsCount': len(structured_data.get('conditions', [])),
                            'labResultsCount': len(structured_data.get('labResults', []))
                        }
                    )

                    # Emit success metric
                    emit_processing_metric(
                        metric_name='ProcessingSuccess',
                        value=1,
                        unit='Count',
                        job_id=job_id,
                        dimensions={'Status': 'Success'}
                    )
                    emit_processing_metric(
                        metric_name='ProcessingDuration',
                        value=processing_duration,
                        unit='Seconds',
                        job_id=job_id
                    )

                except Exception as e:
                    logger.error(
                        f"FHIR transformation or storage failed for job {job_id}: {str(e)}",
                        exc_info=True,
                        extra={'jobId': job_id, 'requestId': request_id}
                    )
                    handle_processing_error(job_id, 'FHIR transformation', e, processing_start_time)
                    raise

            except Exception as e:
                logger.error(
                    f"Entity extraction failed for job {job_id}: {str(e)}",
                    exc_info=True,
                    extra={'jobId': job_id, 'requestId': request_id}
                )
                handle_processing_error(job_id, 'Entity extraction', e, processing_start_time)
                raise

        except Exception as e:
            logger.error(
                f"OCR extraction failed for job {job_id}: {str(e)}",
                exc_info=True,
                extra={'jobId': job_id, 'requestId': request_id}
            )
            handle_processing_error(job_id, 'OCR extraction', e, processing_start_time)
            raise

    except Exception as e:
        # Top-level error handler for any uncaught exceptions
        error_type = type(e).__name__
        error_message = str(e)

        logger.error(
            "Unhandled error processing S3 event",
            exc_info=True,
            extra={
                'requestId': request_id,
                'jobId': job_id,
                'eventType': 'processing_failure',
                'errorType': error_type,
                'errorMessage': error_message,
                's3Record': record
            }
        )

        # Update job status to failed if we have a job_id
        if job_id:
            try:
                update_job_status(
                    job_id=job_id,
                    status='failed',
                    message=f'Processing failed: {error_message}',
                    metadata={
                        'failedAt': datetime.utcnow().isoformat(),
                        'error': error_message,
                        'errorType': error_type
                    }
                )
            except Exception as update_error:
                logger.error(
                    f"Failed to update job status to 'failed': {str(update_error)}",
                    extra={'jobId': job_id, 'requestId': request_id}
                )

            # Emit error metric
            emit_processing_metric(
                metric_name='ProcessingError',
                value=1,
                unit='Count',
                job_id=job_id,
                dimensions={
                    'Status': 'Failed',
                    'ErrorType': error_type
                }
            )

        # Re-raise the exception to mark Lambda execution as failed
        raise


def extract_job_id_from_key(s3_key: str) -> Optional[str]:
    """
    Extract jobId from S3 key pattern: uploads/{userId}/{jobId}-{filename}

    Args:
        s3_key: S3 object key

    Returns:
        Extracted jobId or None if pattern doesn't match
    """
    # Pattern: uploads/{userId}/{jobId}-{filename}
    pattern = r'uploads/[^/]+/([^-]+)-'
    match = re.match(pattern, s3_key)

    if match:
        return match.group(1)

    return None


def update_job_status(
    job_id: str,
    status: str,
    message: str,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Update job status in DynamoDB.

    Args:
        job_id: Job identifier
        status: New status value
        message: Status message
        metadata: Additional metadata to update
    """
    table = dynamodb.Table(JOBS_TABLE)

    try:
        # Prepare update expression
        update_expression = 'SET #status = :status, #message = :message, updatedAt = :updated_at'
        expression_attribute_names = {
            '#status': 'status',
            '#message': 'message'
        }
        expression_attribute_values = {
            ':status': status,
            ':message': message,
            ':updated_at': datetime.utcnow().isoformat()
        }

        # Add metadata fields if provided
        if metadata:
            for key, value in metadata.items():
                update_expression += f', {key} = :{key}'
                expression_attribute_values[f':{key}'] = value

        # Update item in DynamoDB
        table.update_item(
            Key={'jobId': job_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values
        )

        logger.info(f"Updated job {job_id} status to '{status}'")

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"DynamoDB error updating job {job_id}: {error_code} - {error_message}")
        raise


def extract_text_with_ocr(bucket: str, key: str, job_id: str, max_retries: int = 1) -> str:
    """
    Extract text from document using PaddleOCR with retry logic.

    Args:
        bucket: S3 bucket name
        key: S3 object key
        job_id: Job identifier for logging
        max_retries: Maximum number of retry attempts (default: 1)

    Returns:
        Extracted text as string

    Raises:
        Exception: If OCR extraction fails after all retries
    """
    s3_client = boto3.client('s3')
    attempt = 0

    while attempt <= max_retries:
        try:
            attempt += 1
            logger.info(f"OCR extraction attempt {attempt}/{max_retries + 1} for job {job_id}")

            # Download document from S3
            logger.info(f"Downloading document from s3://{bucket}/{key}")
            response = s3_client.get_object(Bucket=bucket, Key=key)
            image_data = response['Body'].read()
            logger.info(f"Downloaded {len(image_data)} bytes")

            # Import OCR module (lazy import to avoid cold start overhead)
            try:
                from paddleocr import PaddleOCR
            except ImportError as e:
                logger.error(f"PaddleOCR not installed: {str(e)}")
                raise Exception("PaddleOCR library not available. Please ensure it's included in Lambda layer.")

            # Initialize PaddleOCR (use English and Hindi for medical documents)
            logger.info("Initializing PaddleOCR with languages: en, hi")
            ocr = PaddleOCR(
                use_angle_cls=True,
                lang='en',
                use_gpu=False,
                show_log=False,
                use_space_char=True
            )

            # Convert image bytes to numpy array for PaddleOCR
            from PIL import Image
            import io
            import numpy as np

            image = Image.open(io.BytesIO(image_data))
            image_array = np.array(image)
            logger.info(f"Image size: {image.size}")

            # Perform OCR
            logger.info("Performing OCR extraction...")
            results = ocr.ocr(image_array, cls=True)

            if not results or not results[0]:
                logger.warning("No text detected in image")
                return ""

            # Extract text from results
            extracted_lines = []
            total_confidence = 0.0
            line_count = 0

            for line in results[0]:
                if len(line) < 2:
                    continue

                text_info = line[1]
                if len(text_info) < 2:
                    continue

                text = text_info[0]
                confidence = float(text_info[1])

                extracted_lines.append(text)
                total_confidence += confidence
                line_count += 1

            # Combine all text lines
            full_text = '\n'.join(extracted_lines)

            # Calculate average confidence
            avg_confidence = total_confidence / line_count if line_count > 0 else 0.0

            logger.info(f"OCR extraction successful: {line_count} lines extracted, "
                       f"average confidence: {avg_confidence:.2f}")

            return full_text

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            logger.error(f"S3 error on attempt {attempt}: {error_code} - {error_message}")

            if attempt > max_retries:
                raise Exception(f"Failed to download document from S3 after {attempt} attempts: {error_message}")

            # Wait before retry (exponential backoff)
            import time
            wait_time = 2 ** (attempt - 1)
            logger.info(f"Retrying in {wait_time} seconds...")
            time.sleep(wait_time)

        except Exception as e:
            logger.error(f"OCR extraction error on attempt {attempt}: {str(e)}", exc_info=True)

            if attempt > max_retries:
                raise Exception(f"OCR extraction failed after {attempt} attempts: {str(e)}")

            # Wait before retry
            import time
            wait_time = 2 ** (attempt - 1)
            logger.info(f"Retrying in {wait_time} seconds...")
            time.sleep(wait_time)

    # Should not reach here, but just in case
    raise Exception(f"OCR extraction failed after {max_retries + 1} attempts")




def extract_entities_with_bedrock(ocr_text: str, job_id: str, max_retries: int = 3) -> Dict[str, Any]:
    """
    Extract structured medical entities from OCR text using Amazon Bedrock.

    Implements exponential backoff for Bedrock throttling with 3 retries.

    Args:
        ocr_text: Extracted text from OCR
        job_id: Job identifier for logging
        max_retries: Maximum number of retry attempts (default: 3)

    Returns:
        Dictionary containing:
            - entities: List of medical entities with text, type, and confidence
            - medications: List with name, dosage, frequency, and confidence
            - conditions: List of medical conditions
            - labResults: List with testName, value, unit, and confidence

    Raises:
        Exception: If entity extraction fails after all retries
    """
    attempt = 0
    base_delay = 1  # Start with 1 second delay

    while attempt <= max_retries:
        try:
            attempt += 1
            logger.info(f"Bedrock entity extraction attempt {attempt}/{max_retries + 1} for job {job_id}")

            # Prepare the prompt for Claude
            prompt = create_entity_extraction_prompt(ocr_text)

            # Prepare request body for Claude 3.5 Sonnet
            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 4096,
                "temperature": 0.0,  # Deterministic for entity extraction
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            }

            logger.info(f"Calling Bedrock model: {BEDROCK_MODEL_ID}")

            # Call Bedrock
            response = bedrock_runtime.invoke_model(
                modelId=BEDROCK_MODEL_ID,
                body=json.dumps(request_body),
                contentType='application/json',
                accept='application/json'
            )

            # Parse response
            response_body = json.loads(response['body'].read())
            logger.info(f"Bedrock response received for job {job_id}")

            # Extract the text content from Claude's response
            if 'content' not in response_body or not response_body['content']:
                raise ValueError("Invalid Bedrock response: missing 'content' field")

            content_blocks = response_body['content']
            extracted_text = ''

            for block in content_blocks:
                if block.get('type') == 'text':
                    extracted_text += block.get('text', '')

            if not extracted_text:
                raise ValueError("No text content in Bedrock response")

            logger.info(f"Extracted text from Bedrock response: {len(extracted_text)} characters")

            # Parse JSON from the response
            structured_data = parse_bedrock_response(extracted_text, job_id)

            logger.info(f"Successfully extracted entities for job {job_id}: "
                       f"{len(structured_data.get('entities', []))} entities, "
                       f"{len(structured_data.get('medications', []))} medications, "
                       f"{len(structured_data.get('conditions', []))} conditions, "
                       f"{len(structured_data.get('labResults', []))} lab results")

            return structured_data

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            logger.error(f"Bedrock error on attempt {attempt}: {error_code} - {error_message}")

            # Check if it's a throttling error
            if error_code in ['ThrottlingException', 'TooManyRequestsException', 'ServiceUnavailableException']:
                if attempt > max_retries:
                    raise Exception(f"Bedrock throttled after {attempt} attempts: {error_message}")

                # Exponential backoff
                wait_time = base_delay * (2 ** (attempt - 1))
                logger.info(f"Throttled by Bedrock, retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                # Non-throttling error, fail immediately
                raise Exception(f"Bedrock error: {error_code} - {error_message}")

        except Exception as e:
            logger.error(f"Entity extraction error on attempt {attempt}: {str(e)}", exc_info=True)

            if attempt > max_retries:
                raise Exception(f"Entity extraction failed after {attempt} attempts: {str(e)}")

            # Exponential backoff for other errors
            wait_time = base_delay * (2 ** (attempt - 1))
            logger.info(f"Retrying in {wait_time} seconds...")
            time.sleep(wait_time)

    # Should not reach here, but just in case
    raise Exception(f"Entity extraction failed after {max_retries + 1} attempts")


def create_entity_extraction_prompt(ocr_text: str) -> str:
    """
    Create the prompt for Bedrock entity extraction.

    Args:
        ocr_text: Extracted text from OCR

    Returns:
        Formatted prompt string
    """
    prompt = f"""You are a medical document analysis assistant. Extract structured information from the following medical document text.

Document Text:
{ocr_text}

Extract the following information in JSON format:
1. entities: List of medical entities with text, type (MEDICATION, CONDITION, LAB_TEST, PROCEDURE, SYMPTOM, etc.), and confidence (0-1)
2. medications: List with name, dosage, frequency, and confidence
3. conditions: List of medical conditions (strings)
4. labResults: List with testName, value, unit, and confidence

Provide confidence scores based on text clarity and medical terminology accuracy. Use the following guidelines:
- High confidence (0.8-1.0): Clear, unambiguous medical terms with complete information
- Medium confidence (0.5-0.79): Recognizable terms but with some ambiguity or incomplete information
- Low confidence (0.0-0.49): Unclear or potentially incorrect information

Return only valid JSON without any markdown formatting or code blocks. The JSON should have this exact structure:

{{
  "entities": [
    {{"text": "entity text", "type": "ENTITY_TYPE", "confidence": 0.95}}
  ],
  "medications": [
    {{"name": "medication name", "dosage": "dosage amount", "frequency": "frequency", "confidence": 0.9}}
  ],
  "conditions": ["condition1", "condition2"],
  "labResults": [
    {{"testName": "test name", "value": "value", "unit": "unit", "confidence": 0.85}}
  ]
}}

If no information is found for a category, return an empty array or list."""

    return prompt


def parse_bedrock_response(response_text: str, job_id: str) -> Dict[str, Any]:
    """
    Parse the JSON response from Bedrock.

    Args:
        response_text: Text response from Bedrock
        job_id: Job identifier for logging

    Returns:
        Parsed structured data dictionary

    Raises:
        ValueError: If response cannot be parsed as JSON
    """
    try:
        # Try to find JSON in the response (in case there's extra text)
        # Look for the first { and last }
        start_idx = response_text.find('{')
        end_idx = response_text.rfind('}')

        if start_idx == -1 or end_idx == -1:
            raise ValueError("No JSON object found in response")

        json_str = response_text[start_idx:end_idx + 1]

        # Parse JSON
        structured_data = json.loads(json_str)

        # Validate structure
        if not isinstance(structured_data, dict):
            raise ValueError("Response is not a JSON object")

        # Ensure all required fields exist with defaults
        result = {
            'entities': structured_data.get('entities', []),
            'medications': structured_data.get('medications', []),
            'conditions': structured_data.get('conditions', []),
            'labResults': structured_data.get('labResults', [])
        }

        # Validate entities structure
        if not isinstance(result['entities'], list):
            logger.warning(f"Invalid entities format for job {job_id}, using empty list")
            result['entities'] = []

        # Validate medications structure
        if not isinstance(result['medications'], list):
            logger.warning(f"Invalid medications format for job {job_id}, using empty list")
            result['medications'] = []

        # Validate conditions structure
        if not isinstance(result['conditions'], list):
            logger.warning(f"Invalid conditions format for job {job_id}, using empty list")
            result['conditions'] = []

        # Validate labResults structure
        if not isinstance(result['labResults'], list):
            logger.warning(f"Invalid labResults format for job {job_id}, using empty list")
            result['labResults'] = []

        # Validate confidence scores are in range [0, 1]
        for entity in result['entities']:
            if 'confidence' in entity:
                entity['confidence'] = max(0.0, min(1.0, float(entity['confidence'])))

        for medication in result['medications']:
            if 'confidence' in medication:
                medication['confidence'] = max(0.0, min(1.0, float(medication['confidence'])))

        for lab_result in result['labResults']:
            if 'confidence' in lab_result:
                lab_result['confidence'] = max(0.0, min(1.0, float(lab_result['confidence'])))

        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Bedrock response as JSON for job {job_id}: {str(e)}")
        logger.error(f"Response text: {response_text[:500]}...")  # Log first 500 chars
        raise ValueError(f"Invalid JSON in Bedrock response: {str(e)}")

    except Exception as e:
        logger.error(f"Error parsing Bedrock response for job {job_id}: {str(e)}")
        raise ValueError(f"Failed to parse Bedrock response: {str(e)}")


def transform_to_fhir(structured_data: Dict[str, Any], job_id: str) -> Dict[str, Any]:
    """
    Transform extracted medical data to FHIR R4 Bundle format.

    Creates FHIR resources for medications, conditions, and observations (lab results).

    Args:
        structured_data: Dictionary containing entities, medications, conditions, and labResults
        job_id: Job identifier for resource IDs

    Returns:
        FHIR R4 Bundle with type "collection"
    """
    logger.info(f"Transforming data to FHIR format for job {job_id}")

    # Create FHIR Bundle
    fhir_bundle = {
        "resourceType": "Bundle",
        "type": "collection",
        "id": f"bundle-{job_id}",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "entry": []
    }

    # Transform medications to MedicationStatement resources
    medications = structured_data.get('medications', [])
    for idx, medication in enumerate(medications):
        medication_resource = create_medication_statement(medication, job_id, idx)
        fhir_bundle['entry'].append({
            "fullUrl": f"urn:uuid:medication-{job_id}-{idx}",
            "resource": medication_resource
        })

    # Transform conditions to Condition resources
    conditions = structured_data.get('conditions', [])
    for idx, condition in enumerate(conditions):
        condition_resource = create_condition(condition, job_id, idx)
        fhir_bundle['entry'].append({
            "fullUrl": f"urn:uuid:condition-{job_id}-{idx}",
            "resource": condition_resource
        })

    # Transform lab results to Observation resources
    lab_results = structured_data.get('labResults', [])
    for idx, lab_result in enumerate(lab_results):
        observation_resource = create_observation(lab_result, job_id, idx)
        fhir_bundle['entry'].append({
            "fullUrl": f"urn:uuid:observation-{job_id}-{idx}",
            "resource": observation_resource
        })

    logger.info(f"FHIR transformation complete for job {job_id}: "
               f"{len(medications)} medications, "
               f"{len(conditions)} conditions, "
               f"{len(lab_results)} observations")

    return fhir_bundle


def create_medication_statement(medication: Dict[str, Any], job_id: str, index: int) -> Dict[str, Any]:
    """
    Create a FHIR MedicationStatement resource.

    Args:
        medication: Dictionary with name, dosage, frequency, and confidence
        job_id: Job identifier
        index: Index for unique ID

    Returns:
        FHIR MedicationStatement resource
    """
    return {
        "resourceType": "MedicationStatement",
        "id": f"medication-{job_id}-{index}",
        "status": "active",
        "medicationCodeableConcept": {
            "text": medication.get('name', 'Unknown medication')
        },
        "dosage": [
            {
                "text": f"{medication.get('dosage', 'Unknown dosage')} {medication.get('frequency', 'Unknown frequency')}",
                "timing": {
                    "code": {
                        "text": medication.get('frequency', 'Unknown frequency')
                    }
                },
                "doseAndRate": [
                    {
                        "doseQuantity": {
                            "value": medication.get('dosage', 'Unknown'),
                            "unit": "dose"
                        }
                    }
                ]
            }
        ],
        "extension": [
            {
                "url": "http://example.org/fhir/StructureDefinition/confidence",
                "valueDecimal": medication.get('confidence', 0.0)
            }
        ]
    }


def create_condition(condition: str, job_id: str, index: int) -> Dict[str, Any]:
    """
    Create a FHIR Condition resource.

    Args:
        condition: Condition name/description
        job_id: Job identifier
        index: Index for unique ID

    Returns:
        FHIR Condition resource
    """
    return {
        "resourceType": "Condition",
        "id": f"condition-{job_id}-{index}",
        "clinicalStatus": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active",
                    "display": "Active"
                }
            ]
        },
        "verificationStatus": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                    "code": "unconfirmed",
                    "display": "Unconfirmed"
                }
            ]
        },
        "code": {
            "text": condition
        },
        "recordedDate": datetime.utcnow().isoformat() + "Z"
    }


def create_observation(lab_result: Dict[str, Any], job_id: str, index: int) -> Dict[str, Any]:
    """
    Create a FHIR Observation resource for lab results.

    Args:
        lab_result: Dictionary with testName, value, unit, and confidence
        job_id: Job identifier
        index: Index for unique ID

    Returns:
        FHIR Observation resource
    """
    return {
        "resourceType": "Observation",
        "id": f"observation-{job_id}-{index}",
        "status": "final",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "laboratory",
                        "display": "Laboratory"
                    }
                ]
            }
        ],
        "code": {
            "text": lab_result.get('testName', 'Unknown test')
        },
        "valueQuantity": {
            "value": lab_result.get('value', 'Unknown'),
            "unit": lab_result.get('unit', ''),
            "system": "http://unitsofmeasure.org"
        },
        "extension": [
            {
                "url": "http://example.org/fhir/StructureDefinition/confidence",
                "valueDecimal": lab_result.get('confidence', 0.0)
            }
        ],
        "effectiveDateTime": datetime.utcnow().isoformat() + "Z"
    }


def store_results(
    job_id: str,
    ocr_text: str,
    structured_data: Dict[str, Any],
    fhir_bundle: Dict[str, Any],
    document_url: str
) -> None:
    """
    Store complete processing results in DynamoDB.

    Args:
        job_id: Job identifier
        ocr_text: Extracted text from OCR
        structured_data: Extracted entities, medications, conditions, and lab results
        fhir_bundle: FHIR R4 Bundle resource
        document_url: S3 URL of the processed document
    """
    table = dynamodb.Table(JOBS_TABLE)

    try:
        # Calculate TTL (90 days from now)
        import time
        ttl = int(time.time()) + (90 * 24 * 60 * 60)

        # Prepare update expression
        update_expression = '''SET
            ocrText = :ocr_text,
            entities = :entities,
            medications = :medications,
            conditions = :conditions,
            labResults = :lab_results,
            fhirResource = :fhir_resource,
            documentUrl = :document_url,
            processedAt = :processed_at,
            updatedAt = :updated_at,
            ttl = :ttl
        '''

        expression_attribute_values = {
            ':ocr_text': ocr_text,
            ':entities': structured_data.get('entities', []),
            ':medications': structured_data.get('medications', []),
            ':conditions': structured_data.get('conditions', []),
            ':lab_results': structured_data.get('labResults', []),
            ':fhir_resource': fhir_bundle,
            ':document_url': document_url,
            ':processed_at': datetime.utcnow().isoformat(),
            ':updated_at': datetime.utcnow().isoformat(),
            ':ttl': ttl
        }

        # Update item in DynamoDB
        table.update_item(
            Key={'jobId': job_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_attribute_values
        )

        logger.info(f"Stored complete results for job {job_id} with TTL {ttl}")

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"DynamoDB error storing results for job {job_id}: {error_code} - {error_message}")
        raise Exception(f"Failed to store results in DynamoDB: {error_message}")


def handle_processing_error(
    job_id: str,
    stage: str,
    error: Exception,
    processing_start_time: float
) -> None:
    """
    Handle processing errors by updating job status and emitting metrics.

    Args:
        job_id: Job identifier
        stage: Processing stage where error occurred (e.g., 'OCR extraction', 'Entity extraction')
        error: The exception that was raised
        processing_start_time: Timestamp when processing started
    """
    error_type = type(error).__name__
    error_message = str(error)

    logger.error(
        f"{stage} failed for job {job_id}",
        exc_info=True,
        extra={
            'jobId': job_id,
            'stage': stage,
            'errorType': error_type,
            'errorMessage': error_message
        }
    )

    # Update job status to 'failed'
    try:
        update_job_status(
            job_id=job_id,
            status='failed',
            message=f'{stage} failed: {error_message}',
            metadata={
                'failedAt': datetime.utcnow().isoformat(),
                'error': error_message,
                'errorType': error_type,
                'failedStage': stage
            }
        )
    except Exception as update_error:
        logger.error(f"Failed to update job status to 'failed': {str(update_error)}")

    # Emit error metric
    processing_duration = time.time() - processing_start_time
    emit_processing_metric(
        metric_name='ProcessingError',
        value=1,
        unit='Count',
        job_id=job_id,
        dimensions={
            'Status': 'Failed',
            'ErrorType': error_type,
            'Stage': stage
        }
    )
    emit_processing_metric(
        metric_name='ProcessingDuration',
        value=processing_duration,
        unit='Seconds',
        job_id=job_id,
        dimensions={'Status': 'Failed'}
    )


def emit_processing_metric(
    metric_name: str,
    value: float,
    unit: str,
    job_id: str,
    dimensions: Optional[Dict[str, str]] = None
) -> None:
    """
    Emit a custom CloudWatch metric for document processing.

    Args:
        metric_name: Name of the metric
        value: Metric value
        unit: Metric unit (e.g., 'Count', 'Seconds')
        job_id: Job identifier for logging
        dimensions: Optional dimensions for the metric
    """
    try:
        metric_data = {
            'MetricName': metric_name,
            'Value': value,
            'Unit': unit,
            'Timestamp': datetime.utcnow(),
            'Dimensions': [
                {
                    'Name': 'Service',
                    'Value': 'DocumentProcessor'
                }
            ]
        }

        # Add custom dimensions if provided
        if dimensions:
            for dim_name, dim_value in dimensions.items():
                metric_data['Dimensions'].append({
                    'Name': dim_name,
                    'Value': dim_value
                })

        # Put metric to CloudWatch
        cloudwatch.put_metric_data(
            Namespace='DocumentScanDemo',
            MetricData=[metric_data]
        )

        logger.info(f"Emitted CloudWatch metric: {metric_name}={value} {unit} for job {job_id}")

    except Exception as e:
        # Log error but don't fail the processing
        logger.error(f"Failed to emit CloudWatch metric {metric_name}: {str(e)}")



