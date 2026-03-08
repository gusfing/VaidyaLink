"""
Document Processing Lambda Handler

This Lambda function processes medical document images uploaded to S3:
1. Extracts text using PaddleOCR
2. Structures clinical data using Amazon Bedrock
3. Calculates confidence scores
4. Routes low-confidence extractions to HITL queue
5. Triggers FHIR transformation

Runtime: Python 3.11
"""

import json
import os
import logging
import time
from typing import Dict, Any, Optional, List
from datetime import datetime
import boto3
from botocore.exceptions import ClientError

# OCR imports
from ocr import PaddleOCRExtractor, OCRResult, create_ocr_extractor

# Bedrock imports
from bedrock import ClinicalStructurer, StructuredClinicalData, create_clinical_structurer

# Confidence scoring imports
from confidence import ConfidenceScorer, ConfidenceScores, create_confidence_scorer

# Error handling imports
from error_handling import (
    with_retry,
    RetryConfig,
    CircuitBreaker,
    ErrorReporter,
    ErrorContext,
    ErrorCategory,
    ErrorSeverity,
    OCRExtractionError,
    BedrockStructuringError,
    S3OperationError,
    DynamoDBOperationError,
    ValidationError,
    categorize_aws_error,
    calculate_backoff_delay
)

# CloudWatch logging and metrics imports
from cloudwatch_logger import (
    CloudWatchMetrics,
    StructuredLogger,
    track_operation,
    get_metrics,
    get_structured_logger
)

# Configure logging
logger = logging.getLogger()
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

# Initialize AWS clients
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
sqs_client = boto3.client('sqs')
lambda_client = boto3.client('lambda')

# Environment variables
SCANJOBS_TABLE = os.environ.get('SCANJOBS_TABLE')
DOCUMENTS_BUCKET = os.environ.get('DOCUMENTS_BUCKET')
HITL_QUEUE_URL = os.environ.get('HITL_QUEUE_URL')
CONFIDENCE_THRESHOLD = float(os.environ.get('CONFIDENCE_THRESHOLD', '0.80'))
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID')
OCR_LANGUAGES = os.environ.get('OCR_LANGUAGES', 'en,hi').split(',')
USE_GPU = os.environ.get('USE_GPU', 'false').lower() == 'true'

# Initialize OCR extractor (singleton for Lambda container reuse)
ocr_extractor: Optional[PaddleOCRExtractor] = None
clinical_structurer: Optional[ClinicalStructurer] = None
confidence_scorer: Optional[ConfidenceScorer] = None

# Initialize error reporter and circuit breakers
error_reporter = ErrorReporter()
bedrock_circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=60,
    expected_exception=BedrockStructuringError
)
s3_circuit_breaker = CircuitBreaker(
    failure_threshold=10,
    recovery_timeout=30,
    expected_exception=S3OperationError
)

# Initialize CloudWatch metrics and structured logger (lazy)
metrics: Optional[CloudWatchMetrics] = None
structured_logger: Optional[StructuredLogger] = None


def get_ocr_extractor() -> PaddleOCRExtractor:
    """
    Get or create OCR extractor instance (singleton pattern for Lambda reuse).

    Returns:
        PaddleOCRExtractor instance
    """
    global ocr_extractor

    if ocr_extractor is None:
        logger.info(f"Initializing OCR extractor with languages: {OCR_LANGUAGES}")
        ocr_extractor = create_ocr_extractor(
            languages=OCR_LANGUAGES,
            use_gpu=USE_GPU
        )

    return ocr_extractor


def get_clinical_structurer() -> ClinicalStructurer:
    """
    Get or create clinical structurer instance (singleton pattern for Lambda reuse).

    Returns:
        ClinicalStructurer instance
    """
    global clinical_structurer

    if clinical_structurer is None:
        logger.info(f"Initializing clinical structurer with model: {BEDROCK_MODEL_ID}")
        clinical_structurer = create_clinical_structurer(
            model_id=BEDROCK_MODEL_ID
        )

    return clinical_structurer


def get_confidence_scorer() -> ConfidenceScorer:
    """
    Get or create confidence scorer instance (singleton pattern for Lambda reuse).

    Returns:
        ConfidenceScorer instance
    """
    global confidence_scorer

    if confidence_scorer is None:
        logger.info(f"Initializing confidence scorer with threshold: {CONFIDENCE_THRESHOLD}")
        confidence_scorer = create_confidence_scorer(
            confidence_threshold=CONFIDENCE_THRESHOLD
        )

    return confidence_scorer


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for document processing.

    Args:
        event: S3 event notification or direct invocation payload
        context: Lambda context object

    Returns:
        Response dictionary with processing status
    """
    global metrics, structured_logger

    # Initialize CloudWatch metrics and logger
    if metrics is None:
        metrics = get_metrics()
    if structured_logger is None:
        structured_logger = get_structured_logger()

    request_id = context.request_id if context else 'unknown'

    try:
        logger.info(f"Processing event (request_id: {request_id}): {json.dumps(event)}")

        # Extract S3 event details
        if 'Records' in event:
            # S3 event notification
            for record in event['Records']:
                if record.get('eventSource') == 'aws:s3':
                    process_s3_event(record)
        else:
            # Direct invocation
            job_id = event.get('jobId')
            if not job_id:
                raise ValidationError("jobId is required for direct invocation")

            process_job(job_id)

        # Flush any remaining metrics
        if metrics:
            metrics.flush_metrics()

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Document processing completed successfully',
                'requestId': request_id
            })
        }

    except ValidationError as e:
        logger.error(f"Validation error: {str(e)}")

        # Flush metrics before returning
        if metrics:
            metrics.flush_metrics()

        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': 'Validation error',
                'message': str(e),
                'requestId': request_id
            })
        }

    except Exception as e:
        logger.error(f"Error processing document: {str(e)}", exc_info=True)

        # Report error
        error_context = ErrorContext(
            job_id=event.get('jobId', 'unknown'),
            operation='handler',
            attempt=1,
            error_category=ErrorCategory.PERMANENT,
            error_severity=ErrorSeverity.CRITICAL,
            error_message=str(e),
            timestamp=datetime.utcnow().isoformat()
        )
        error_reporter.report_error(error_context)

        # Flush metrics before returning
        if metrics:
            metrics.flush_metrics()

        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
                'requestId': request_id
            })
        }


def process_s3_event(record: Dict[str, Any]) -> None:
    """
    Process S3 event notification.

    Args:
        record: S3 event record
    """
    bucket = record['s3']['bucket']['name']
    key = record['s3']['object']['key']

    logger.info(f"Processing S3 object: s3://{bucket}/{key}")

    # Extract job ID from S3 key (format: raw/{patientId}/{jobId}/original.jpg)
    parts = key.split('/')
    if len(parts) < 3:
        logger.warning(f"Invalid S3 key format: {key}")
        raise ValidationError(f"Invalid S3 key format: {key}")

    patient_id = parts[1]
    job_id = parts[2]

    try:
        # Update job status to processing
        update_job_status(job_id, 'processing', {
            'processingStartedAt': datetime.utcnow().isoformat()
        })

        # Process the document
        process_document(job_id, bucket, key)

    except Exception as e:
        logger.error(f"Error processing S3 event for job {job_id}: {str(e)}", exc_info=True)

        # Report error
        error_context = ErrorContext(
            job_id=job_id,
            operation='process_s3_event',
            attempt=1,
            error_category=categorize_aws_error(e) if isinstance(e, ClientError) else ErrorCategory.PERMANENT,
            error_severity=ErrorSeverity.HIGH,
            error_message=str(e),
            timestamp=datetime.utcnow().isoformat(),
            metadata={'bucket': bucket, 'key': key}
        )
        error_reporter.report_error(error_context)
        raise


@with_retry(
    config=RetryConfig(max_attempts=3, initial_delay=1.0, max_delay=30.0),
    operation_name="process_job"
)
def process_job(job_id: str) -> None:
    """
    Process a document job by job ID.

    Args:
        job_id: Scan job identifier
    """
    # Retrieve job details from DynamoDB
    table = dynamodb.Table(SCANJOBS_TABLE)

    try:
        response = table.get_item(
            Key={
                'PK': f'JOB#{job_id}',
                'SK': 'METADATA'
            }
        )

        if 'Item' not in response:
            raise ValidationError(f"Job not found: {job_id}")

        job = response['Item']
        bucket = job.get('imageS3Bucket', DOCUMENTS_BUCKET)
        key = job.get('imageS3Key')

        if not key:
            raise ValidationError(f"No image S3 key found for job: {job_id}")

        # Update status to processing
        update_job_status(job_id, 'processing', {
            'processingStartedAt': datetime.utcnow().isoformat()
        })

        # Process the document
        process_document(job_id, bucket, key)

    except ClientError as e:
        error_msg = e.response['Error']['Message']
        logger.error(f"DynamoDB error: {error_msg}")
        raise DynamoDBOperationError(
            f"Failed to retrieve job {job_id}: {error_msg}",
            category=categorize_aws_error(e),
            metadata={'job_id': job_id}
        )


def process_document(job_id: str, bucket: str, key: str) -> None:
    """
    Main document processing pipeline with comprehensive error handling.

    Args:
        job_id: Scan job identifier
        bucket: S3 bucket name
        key: S3 object key
    """
    global metrics, structured_logger

    # Log processing start
    if structured_logger:
        structured_logger.log_processing_started(job_id, bucket, key)

    processing_start_time = time.time()
    attempt = 0
    max_attempts = 3

    while attempt < max_attempts:
        try:
            attempt += 1
            logger.info(f"Processing document for job {job_id} (attempt {attempt}/{max_attempts})")

            # Step 1: Extract text using PaddleOCR
            logger.info(f"Starting OCR extraction for job {job_id}")

            ocr_start_time = time.time()
            ocr_results = extract_text_from_image(bucket, key)
            ocr_duration_ms = (time.time() - ocr_start_time) * 1000

            if not ocr_results:
                raise OCRExtractionError(
                    "No text extracted from image",
                    category=ErrorCategory.PERMANENT,
                    severity=ErrorSeverity.HIGH,
                    metadata={'job_id': job_id, 'bucket': bucket, 'key': key}
                )

            # Calculate OCR confidence
            extractor = get_ocr_extractor()
            ocr_confidence = extractor.get_average_confidence(ocr_results)
            logger.info(f"OCR extraction completed with average confidence: {ocr_confidence:.2f}")

            # Emit OCR metrics
            if metrics:
                metrics.record_ocr_accuracy(ocr_confidence)
                metrics.record_processing_latency(ocr_duration_ms, 'ocr', 'success')

            if structured_logger:
                structured_logger.log_ocr_extraction(
                    job_id=job_id,
                    text_regions=len(ocr_results),
                    average_confidence=ocr_confidence,
                    duration_ms=ocr_duration_ms
                )

            # Get full text for structuring
            full_text = extractor.get_full_text(ocr_results, min_confidence=0.5)

            # Step 2: Structure clinical data using Amazon Bedrock (with circuit breaker)
            logger.info(f"Structuring clinical data with Bedrock for job {job_id}")
            structurer = get_clinical_structurer()

            # Prepare document context
            document_context = {
                'jobId': job_id,
                'ocrConfidence': ocr_confidence,
                'detectedLanguages': list(set(r.language for r in ocr_results if r.language))
            }

            bedrock_start_time = time.time()
            try:
                structured_data = bedrock_circuit_breaker.call(
                    structurer.structure_clinical_data,
                    extracted_text=full_text,
                    document_context=document_context
                )
                bedrock_duration_ms = (time.time() - bedrock_start_time) * 1000

                # Emit Bedrock metrics
                if metrics:
                    metrics.record_processing_latency(bedrock_duration_ms, 'bedrock', 'success')

            except Exception as e:
                bedrock_duration_ms = (time.time() - bedrock_start_time) * 1000

                if metrics:
                    metrics.record_processing_latency(bedrock_duration_ms, 'bedrock', 'failure')

                raise BedrockStructuringError(
                    f"Failed to structure clinical data: {str(e)}",
                    category=categorize_aws_error(e) if isinstance(e, ClientError) else ErrorCategory.TRANSIENT,
                    severity=ErrorSeverity.HIGH,
                    metadata={'job_id': job_id, 'ocr_confidence': ocr_confidence}
                )

            logger.info(f"Clinical data structured successfully for job {job_id}")

            # Count extracted fields
            structured_dict = structured_data.to_dict()
            fields_extracted = sum(1 for v in structured_dict.values() if v)

            if structured_logger:
                structured_logger.log_bedrock_structuring(
                    job_id=job_id,
                    fields_extracted=fields_extracted,
                    duration_ms=bedrock_duration_ms
                )

            # Step 3: Calculate confidence scores
            logger.info(f"Calculating confidence scores for job {job_id}")
            scorer = get_confidence_scorer()

            confidence_scores_obj = scorer.calculate_confidence(
                structured_data=structured_data.to_dict(),
                ocr_results=ocr_results,
                ocr_average_confidence=ocr_confidence
            )

            confidence_scores = confidence_scores_obj.to_dict()

            logger.info(f"Confidence scores calculated - Overall: {confidence_scores['overall']:.2f}, "
                       f"Critical fields below threshold: {len(confidence_scores['criticalFieldsBelowThreshold'])}")

            # Emit confidence metrics
            if metrics:
                metrics.record_confidence_score(
                    overall_confidence=confidence_scores['overall'],
                    ocr_confidence=confidence_scores['ocr'],
                    extraction_confidence=confidence_scores['extraction'],
                    validation_confidence=confidence_scores['validation']
                )

                # Record field-level extraction metrics
                for field_name, field_confidence in confidence_scores['fieldScores'].items():
                    metrics.record_field_extraction(
                        field_name=field_name,
                        extracted=field_confidence > 0,
                        confidence=field_confidence
                    )

            if structured_logger:
                structured_logger.log_confidence_calculation(
                    job_id=job_id,
                    overall_confidence=confidence_scores['overall'],
                    critical_fields_below_threshold=confidence_scores['criticalFieldsBelowThreshold']
                )

            # Check if HITL routing is needed
            if should_route_to_hitl(confidence_scores):
                route_to_hitl(job_id, structured_data.to_dict(), confidence_scores)

                # Emit HITL routing metrics
                if metrics:
                    metrics.record_hitl_routing(routed=True, reason='low_confidence')
                    metrics.record_document_processed(
                        document_type=structured_dict.get('document_type', 'unknown'),
                        status='hitl_required'
                    )

                if structured_logger:
                    structured_logger.log_hitl_routing(
                        job_id=job_id,
                        confidence=confidence_scores['overall'],
                        critical_fields=confidence_scores['criticalFieldsBelowThreshold']
                    )
            else:
                # Save extracted data
                save_extracted_data(job_id, structured_data.to_dict(), confidence_scores)

                # Trigger FHIR transformation
                trigger_fhir_transformation(job_id)

                # Update job status to completed
                update_job_status(job_id, 'completed', {
                    'processingCompletedAt': datetime.utcnow().isoformat(),
                    'confidenceScores': confidence_scores
                })

                # Emit completion metrics
                if metrics:
                    metrics.record_hitl_routing(routed=False)
                    metrics.record_document_processed(
                        document_type=structured_dict.get('document_type', 'unknown'),
                        status='completed'
                    )

            # Calculate total processing time
            total_duration_ms = (time.time() - processing_start_time) * 1000

            # Emit total processing latency
            if metrics:
                metrics.record_processing_latency(total_duration_ms, 'total', 'success')

            if structured_logger:
                structured_logger.log_processing_completed(
                    job_id=job_id,
                    duration_ms=total_duration_ms,
                    confidence=confidence_scores['overall'],
                    hitl_required=should_route_to_hitl(confidence_scores)
                )

            # Success - break out of retry loop
            return

        except (OCRExtractionError, BedrockStructuringError, S3OperationError, DynamoDBOperationError) as e:
            # Report error
            error_context = ErrorContext(
                job_id=job_id,
                operation='process_document',
                attempt=attempt,
                error_category=e.category,
                error_severity=e.severity,
                error_message=str(e),
                timestamp=datetime.utcnow().isoformat(),
                metadata=e.metadata
            )
            error_reporter.report_error(error_context)

            # Emit error metrics
            if metrics:
                metrics.record_error(
                    error_category=e.category.value,
                    error_severity=e.severity.value,
                    operation='process_document'
                )

            if structured_logger:
                structured_logger.log_error(
                    job_id=job_id,
                    operation='process_document',
                    error_message=str(e),
                    error_category=e.category.value,
                    error_severity=e.severity.value,
                    attempt=attempt
                )

            # Check if we should retry
            if e.category in [ErrorCategory.PERMANENT, ErrorCategory.VALIDATION]:
                logger.error(f"Non-retryable error for job {job_id}: {str(e)}")
                update_job_status(job_id, 'failed', {
                    'errorMessage': str(e),
                    'errorCategory': e.category.value,
                    'failedAt': datetime.utcnow().isoformat()
                })

                # Emit failed document metric
                if metrics:
                    metrics.record_document_processed(status='failed')

                raise

            if attempt >= max_attempts:
                logger.error(f"Max retry attempts reached for job {job_id}")
                update_job_status(job_id, 'failed', {
                    'errorMessage': f"Failed after {max_attempts} attempts: {str(e)}",
                    'errorCategory': e.category.value,
                    'failedAt': datetime.utcnow().isoformat()
                })

                # Emit failed document metric
                if metrics:
                    metrics.record_document_processed(status='failed')

                raise

            # Calculate backoff delay
            delay = calculate_backoff_delay(attempt - 1, RetryConfig())
            logger.warning(f"Retrying job {job_id} in {delay:.2f}s...")
            time.sleep(delay)

        except Exception as e:
            logger.error(f"Unexpected error processing document: {str(e)}", exc_info=True)

            # Report unexpected error
            error_context = ErrorContext(
                job_id=job_id,
                operation='process_document',
                attempt=attempt,
                error_category=ErrorCategory.PERMANENT,
                error_severity=ErrorSeverity.CRITICAL,
                error_message=str(e),
                timestamp=datetime.utcnow().isoformat()
            )
            error_reporter.report_error(error_context)

            # Emit error metrics
            if metrics:
                metrics.record_error(
                    error_category=ErrorCategory.PERMANENT.value,
                    error_severity=ErrorSeverity.CRITICAL.value,
                    operation='process_document'
                )
                metrics.record_document_processed(status='failed')

            if structured_logger:
                structured_logger.log_error(
                    job_id=job_id,
                    operation='process_document',
                    error_message=str(e),
                    error_category=ErrorCategory.PERMANENT.value,
                    error_severity=ErrorSeverity.CRITICAL.value,
                    attempt=attempt
                )

            update_job_status(job_id, 'failed', {
                'errorMessage': str(e),
                'failedAt': datetime.utcnow().isoformat()
            })
            raise


@with_retry(
    config=RetryConfig(max_attempts=3, initial_delay=0.5, max_delay=10.0),
    operation_name="extract_text_from_image"
)
def extract_text_from_image(bucket: str, key: str) -> List[OCRResult]:
    """
    Extract text from image using PaddleOCR with retry logic.

    Args:
        bucket: S3 bucket name
        key: S3 object key

    Returns:
        List of OCRResult objects with extracted text and metadata
    """
    try:
        # Download image from S3 (with circuit breaker)
        logger.info(f"Downloading image from s3://{bucket}/{key}")

        def download_from_s3():
            response = s3_client.get_object(Bucket=bucket, Key=key)
            return response['Body'].read()

        try:
            image_data = s3_circuit_breaker.call(download_from_s3)
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            raise S3OperationError(
                f"Failed to download image from S3: {error_code}",
                category=categorize_aws_error(e),
                severity=ErrorSeverity.HIGH,
                metadata={'bucket': bucket, 'key': key}
            )

        # Get OCR extractor
        extractor = get_ocr_extractor()

        # Detect primary language from key or metadata
        # Format: raw/{patientId}/{jobId}/original.jpg
        # For now, default to English and Hindi
        primary_language = 'en'

        # Extract text
        logger.info(f"Extracting text with PaddleOCR (language: {primary_language})")

        try:
            ocr_results = extractor.extract_text(
                image_data=image_data,
                language=primary_language,
                detect_language=True
            )
        except Exception as e:
            raise OCRExtractionError(
                f"OCR extraction failed: {str(e)}",
                category=ErrorCategory.TRANSIENT,
                severity=ErrorSeverity.HIGH,
                metadata={'bucket': bucket, 'key': key}
            )

        logger.info(f"Extracted {len(ocr_results)} text regions")

        # Log confidence distribution
        if ocr_results:
            confidences = [r.confidence for r in ocr_results]
            logger.info(f"Confidence stats - Min: {min(confidences):.2f}, "
                       f"Max: {max(confidences):.2f}, "
                       f"Avg: {sum(confidences)/len(confidences):.2f}")

        return ocr_results

    except (S3OperationError, OCRExtractionError):
        raise
    except Exception as e:
        logger.error(f"Unexpected error extracting text from image: {str(e)}", exc_info=True)
        raise OCRExtractionError(
            f"Unexpected error during OCR: {str(e)}",
            category=ErrorCategory.PERMANENT,
            severity=ErrorSeverity.HIGH,
            metadata={'bucket': bucket, 'key': key}
        )


def should_route_to_hitl(confidence_scores: Dict[str, float]) -> bool:
    """
    Determine if extraction should be routed to HITL.

    Args:
        confidence_scores: Dictionary of field confidence scores

    Returns:
        True if HITL routing is needed
    """
    overall_confidence = confidence_scores.get('overall', 0.0)
    return overall_confidence < CONFIDENCE_THRESHOLD


@with_retry(
    config=RetryConfig(max_attempts=3, initial_delay=1.0, max_delay=20.0),
    operation_name="route_to_hitl"
)
def route_to_hitl(
    job_id: str,
    structured_data: Dict[str, Any],
    confidence_scores: Dict[str, float]
) -> None:
    """
    Route low-confidence extraction to HITL queue with retry logic.

    Args:
        job_id: Scan job identifier
        structured_data: Extracted clinical data
        confidence_scores: Confidence scores for each field
    """
    try:
        message = {
            'jobId': job_id,
            'structuredData': structured_data,
            'confidenceScores': confidence_scores,
            'routedAt': datetime.utcnow().isoformat()
        }

        sqs_client.send_message(
            QueueUrl=HITL_QUEUE_URL,
            MessageBody=json.dumps(message)
        )

        # Update job status
        update_job_status(job_id, 'hitl_required', {
            'routedToHitlAt': datetime.utcnow().isoformat(),
            'confidenceScores': confidence_scores
        })

        logger.info(f"Job {job_id} routed to HITL queue")

    except ClientError as e:
        error_msg = e.response['Error']['Message']
        logger.error(f"Error routing to HITL: {error_msg}")
        raise DynamoDBOperationError(
            f"Failed to route job {job_id} to HITL: {error_msg}",
            category=categorize_aws_error(e),
            severity=ErrorSeverity.MEDIUM,
            metadata={'job_id': job_id}
        )


@with_retry(
    config=RetryConfig(max_attempts=3, initial_delay=0.5, max_delay=10.0),
    operation_name="save_extracted_data"
)
def save_extracted_data(
    job_id: str,
    structured_data: Dict[str, Any],
    confidence_scores: Dict[str, float]
) -> None:
    """
    Save extracted data to S3 with retry logic.

    Args:
        job_id: Scan job identifier
        structured_data: Extracted clinical data
        confidence_scores: Confidence scores for each field
    """
    try:
        # Prepare data for storage
        output_data = {
            'jobId': job_id,
            'extractedData': structured_data,
            'confidenceScores': confidence_scores,
            'extractedAt': datetime.utcnow().isoformat()
        }

        # Save to S3
        output_key = f"processed/{job_id}/extracted.json"

        def upload_to_s3():
            s3_client.put_object(
                Bucket=DOCUMENTS_BUCKET,
                Key=output_key,
                Body=json.dumps(output_data, indent=2),
                ContentType='application/json',
                ServerSideEncryption='aws:kms'
            )

        try:
            s3_circuit_breaker.call(upload_to_s3)
        except ClientError as e:
            raise S3OperationError(
                f"Failed to save extracted data to S3: {e.response['Error']['Code']}",
                category=categorize_aws_error(e),
                severity=ErrorSeverity.MEDIUM,
                metadata={'job_id': job_id, 'output_key': output_key}
            )

        # Update job with S3 key
        update_job_status(job_id, None, {
            'extractedDataS3Key': output_key
        })

        logger.info(f"Extracted data saved to s3://{DOCUMENTS_BUCKET}/{output_key}")

    except S3OperationError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error saving extracted data: {str(e)}", exc_info=True)
        raise S3OperationError(
            f"Unexpected error saving data: {str(e)}",
            category=ErrorCategory.PERMANENT,
            severity=ErrorSeverity.MEDIUM,
            metadata={'job_id': job_id}
        )


def trigger_fhir_transformation(job_id: str) -> None:
    """
    Trigger FHIR transformation Lambda.

    Args:
        job_id: Scan job identifier
    """
    try:
        fhir_lambda_arn = os.environ.get('FHIR_TRANSFORMER_LAMBDA_ARN')

        if not fhir_lambda_arn:
            logger.warning("FHIR_TRANSFORMER_LAMBDA_ARN not configured, skipping FHIR transformation")
            return

        payload = {
            'jobId': job_id
        }

        # Async invocation
        lambda_client.invoke(
            FunctionName=fhir_lambda_arn,
            InvocationType='Event',
            Payload=json.dumps(payload)
        )

        logger.info(f"FHIR transformation triggered for job {job_id}")

    except ClientError as e:
        logger.error(f"Error triggering FHIR transformation: {e.response['Error']['Message']}")
        # Don't raise - FHIR transformation failure shouldn't fail the whole job


@with_retry(
    config=RetryConfig(max_attempts=3, initial_delay=1.0, max_delay=20.0),
    operation_name="update_job_status"
)
def update_job_status(
    job_id: str,
    status: Optional[str],
    additional_fields: Optional[Dict[str, Any]] = None
) -> None:
    """
    Update job status in DynamoDB with retry logic.

    Args:
        job_id: Scan job identifier
        status: New status (or None to only update fields)
        additional_fields: Additional fields to update
    """
    try:
        table = dynamodb.Table(SCANJOBS_TABLE)

        update_expression_parts = []
        expression_attribute_values = {}
        expression_attribute_names = {}

        if status:
            update_expression_parts.append('#status = :status')
            expression_attribute_names['#status'] = 'status'
            expression_attribute_values[':status'] = status

        # Always update updatedAt
        update_expression_parts.append('updatedAt = :updatedAt')
        expression_attribute_values[':updatedAt'] = datetime.utcnow().isoformat()

        # Add additional fields
        if additional_fields:
            for key, value in additional_fields.items():
                placeholder = f':{key}'
                update_expression_parts.append(f'{key} = {placeholder}')
                expression_attribute_values[placeholder] = value

        update_expression = 'SET ' + ', '.join(update_expression_parts)

        table.update_item(
            Key={
                'PK': f'JOB#{job_id}',
                'SK': 'METADATA'
            },
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_attribute_values,
            ExpressionAttributeNames=expression_attribute_names if expression_attribute_names else None
        )

        logger.info(f"Job {job_id} status updated to {status}")

    except ClientError as e:
        error_msg = e.response['Error']['Message']
        logger.error(f"Error updating job status: {error_msg}")
        raise DynamoDBOperationError(
            f"Failed to update job {job_id} status: {error_msg}",
            category=categorize_aws_error(e),
            severity=ErrorSeverity.MEDIUM,
            metadata={'job_id': job_id, 'status': status}
        )
