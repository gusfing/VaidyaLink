"""
Unit tests for Document Processing Lambda handler
"""

import json
import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Set environment variables before importing handler
os.environ['SCANJOBS_TABLE'] = 'test-scanjobs-table'
os.environ['DOCUMENTS_BUCKET'] = 'test-documents-bucket'
os.environ['HITL_QUEUE_URL'] = 'https://sqs.us-east-1.amazonaws.com/123456789/test-hitl-queue'
os.environ['CONFIDENCE_THRESHOLD'] = '0.80'
os.environ['BEDROCK_MODEL_ID'] = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
os.environ['LOG_LEVEL'] = 'INFO'
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'

# Mock boto3 before importing handler
with patch('boto3.client'), patch('boto3.resource'):
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    import index


@pytest.fixture
def s3_event():
    """Sample S3 event notification"""
    return {
        'Records': [
            {
                'eventSource': 'aws:s3',
                's3': {
                    'bucket': {
                        'name': 'test-documents-bucket'
                    },
                    'object': {
                        'key': 'raw/patient-123/job-456/original.jpg'
                    }
                }
            }
        ]
    }


@pytest.fixture
def direct_invocation_event():
    """Sample direct invocation event"""
    return {
        'jobId': 'job-456'
    }


@pytest.fixture
def mock_context():
    """Mock Lambda context"""
    context = Mock()
    context.function_name = 'test-function'
    context.function_version = '1'
    context.invoked_function_arn = 'arn:aws:lambda:us-east-1:123456789:function:test-function'
    context.memory_limit_in_mb = 1024
    context.aws_request_id = 'test-request-id'
    return context


class TestHandler:
    """Test cases for main Lambda handler"""

    @patch('index.process_s3_event')
    def test_handler_with_s3_event(self, mock_process_s3_event, s3_event, mock_context):
        """Test handler with S3 event notification"""
        response = index.handler(s3_event, mock_context)

        assert response['statusCode'] == 200
        assert 'message' in json.loads(response['body'])
        mock_process_s3_event.assert_called_once()

    @patch('index.process_job')
    def test_handler_with_direct_invocation(self, mock_process_job, direct_invocation_event, mock_context):
        """Test handler with direct invocation"""
        response = index.handler(direct_invocation_event, mock_context)

        assert response['statusCode'] == 200
        mock_process_job.assert_called_once_with('job-456')

    def test_handler_missing_job_id(self, mock_context):
        """Test handler with missing jobId in direct invocation"""
        event = {}
        response = index.handler(event, mock_context)

        assert response['statusCode'] == 500
        assert 'error' in json.loads(response['body'])

    @patch('index.process_s3_event')
    def test_handler_exception_handling(self, mock_process_s3_event, s3_event, mock_context):
        """Test handler exception handling"""
        mock_process_s3_event.side_effect = Exception('Test error')

        response = index.handler(s3_event, mock_context)

        assert response['statusCode'] == 500
        assert 'error' in json.loads(response['body'])


class TestProcessS3Event:
    """Test cases for S3 event processing"""

    @patch('index.update_job_status')
    @patch('index.process_document')
    def test_process_s3_event_valid_key(self, mock_process_document, mock_update_job_status):
        """Test processing valid S3 event"""
        record = {
            's3': {
                'bucket': {'name': 'test-bucket'},
                'object': {'key': 'raw/patient-123/job-456/original.jpg'}
            }
        }

        index.process_s3_event(record)

        mock_update_job_status.assert_called_once()
        mock_process_document.assert_called_once_with('job-456', 'test-bucket', 'raw/patient-123/job-456/original.jpg')

    @patch('index.update_job_status')
    @patch('index.process_document')
    def test_process_s3_event_invalid_key(self, mock_process_document, mock_update_job_status):
        """Test processing S3 event with invalid key format"""
        record = {
            's3': {
                'bucket': {'name': 'test-bucket'},
                'object': {'key': 'invalid-key.jpg'}
            }
        }

        index.process_s3_event(record)

        # Should not process document with invalid key
        mock_process_document.assert_not_called()


class TestProcessJob:
    """Test cases for job processing"""

    @patch('index.dynamodb')
    @patch('index.update_job_status')
    @patch('index.process_document')
    def test_process_job_success(self, mock_process_document, mock_update_job_status, mock_dynamodb):
        """Test successful job processing"""
        # Mock DynamoDB response
        mock_table = Mock()
        mock_table.get_item.return_value = {
            'Item': {
                'jobId': 'job-456',
                'imageS3Bucket': 'test-bucket',
                'imageS3Key': 'raw/patient-123/job-456/original.jpg'
            }
        }
        mock_dynamodb.Table.return_value = mock_table

        index.process_job('job-456')

        mock_update_job_status.assert_called()
        mock_process_document.assert_called_once()

    @patch('index.dynamodb')
    def test_process_job_not_found(self, mock_dynamodb):
        """Test processing non-existent job"""
        mock_table = Mock()
        mock_table.get_item.return_value = {}
        mock_dynamodb.Table.return_value = mock_table

        with pytest.raises(ValueError, match='Job not found'):
            index.process_job('job-456')


class TestShouldRouteToHitl:
    """Test cases for HITL routing logic"""

    def test_should_route_low_confidence(self):
        """Test routing with low confidence score"""
        confidence_scores = {'overall': 0.75}
        assert index.should_route_to_hitl(confidence_scores) is True

    def test_should_not_route_high_confidence(self):
        """Test not routing with high confidence score"""
        confidence_scores = {'overall': 0.85}
        assert index.should_route_to_hitl(confidence_scores) is False

    def test_should_route_threshold_boundary(self):
        """Test routing at threshold boundary"""
        confidence_scores = {'overall': 0.80}
        assert index.should_route_to_hitl(confidence_scores) is False


class TestRouteToHitl:
    """Test cases for HITL routing"""

    @patch('index.sqs_client')
    @patch('index.update_job_status')
    def test_route_to_hitl_success(self, mock_update_job_status, mock_sqs_client):
        """Test successful routing to HITL queue"""
        structured_data = {'patientName': 'Test Patient'}
        confidence_scores = {'overall': 0.75}

        index.route_to_hitl('job-456', structured_data, confidence_scores)

        mock_sqs_client.send_message.assert_called_once()
        mock_update_job_status.assert_called_once()

        # Verify message content
        call_args = mock_sqs_client.send_message.call_args
        message_body = json.loads(call_args[1]['MessageBody'])
        assert message_body['jobId'] == 'job-456'
        assert message_body['structuredData'] == structured_data
        assert message_body['confidenceScores'] == confidence_scores


class TestSaveExtractedData:
    """Test cases for saving extracted data"""

    @patch('index.s3_client')
    @patch('index.update_job_status')
    def test_save_extracted_data_success(self, mock_update_job_status, mock_s3_client):
        """Test successful data saving"""
        structured_data = {'patientName': 'Test Patient'}
        confidence_scores = {'overall': 0.85}

        index.save_extracted_data('job-456', structured_data, confidence_scores)

        mock_s3_client.put_object.assert_called_once()
        mock_update_job_status.assert_called_once()

        # Verify S3 put_object call
        call_args = mock_s3_client.put_object.call_args
        assert call_args[1]['Bucket'] == 'test-documents-bucket'
        assert 'processed/job-456/extracted.json' in call_args[1]['Key']
        assert call_args[1]['ServerSideEncryption'] == 'aws:kms'


class TestTriggerFhirTransformation:
    """Test cases for FHIR transformation triggering"""

    @patch('index.lambda_client')
    def test_trigger_fhir_transformation_success(self, mock_lambda_client):
        """Test successful FHIR transformation trigger"""
        os.environ['FHIR_TRANSFORMER_LAMBDA_ARN'] = 'arn:aws:lambda:us-east-1:123456789:function:fhir-transformer'

        index.trigger_fhir_transformation('job-456')

        mock_lambda_client.invoke.assert_called_once()
        call_args = mock_lambda_client.invoke.call_args
        assert call_args[1]['FunctionName'] == 'arn:aws:lambda:us-east-1:123456789:function:fhir-transformer'
        assert call_args[1]['InvocationType'] == 'Event'

    @patch('index.lambda_client')
    def test_trigger_fhir_transformation_not_configured(self, mock_lambda_client):
        """Test FHIR transformation when ARN not configured"""
        if 'FHIR_TRANSFORMER_LAMBDA_ARN' in os.environ:
            del os.environ['FHIR_TRANSFORMER_LAMBDA_ARN']

        # Should not raise exception
        index.trigger_fhir_transformation('job-456')

        mock_lambda_client.invoke.assert_not_called()


class TestUpdateJobStatus:
    """Test cases for job status updates"""

    @patch('index.dynamodb')
    def test_update_job_status_with_status(self, mock_dynamodb):
        """Test updating job status"""
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table

        index.update_job_status('job-456', 'processing')

        mock_table.update_item.assert_called_once()
        call_args = mock_table.update_item.call_args
        assert call_args[1]['Key'] == {'PK': 'JOB#job-456', 'SK': 'METADATA'}

    @patch('index.dynamodb')
    def test_update_job_status_with_additional_fields(self, mock_dynamodb):
        """Test updating job status with additional fields"""
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table

        additional_fields = {
            'processingStartedAt': '2024-01-01T00:00:00',
            'confidenceScores': {'overall': 0.85}
        }

        index.update_job_status('job-456', 'processing', additional_fields)

        mock_table.update_item.assert_called_once()

    @patch('index.dynamodb')
    def test_update_job_status_without_status(self, mock_dynamodb):
        """Test updating job fields without changing status"""
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table

        additional_fields = {'extractedDataS3Key': 'processed/job-456/extracted.json'}

        index.update_job_status('job-456', None, additional_fields)

        mock_table.update_item.assert_called_once()


class TestExtractTextFromImage:
    """Test cases for OCR text extraction"""

    @patch('index.get_ocr_extractor')
    @patch('index.s3_client')
    def test_extract_text_success(self, mock_s3_client, mock_get_ocr_extractor):
        """Test successful text extraction from image"""
        # Mock S3 response
        mock_s3_client.get_object.return_value = {
            'Body': Mock(read=Mock(return_value=b'fake_image_data'))
        }

        # Mock OCR extractor
        mock_extractor = Mock()
        mock_result = Mock()
        mock_result.text = "Patient Name: John Doe"
        mock_result.confidence = 0.95
        mock_result.to_dict.return_value = {
            'text': "Patient Name: John Doe",
            'confidence': 0.95
        }
        mock_extractor.extract_text.return_value = [mock_result]
        mock_get_ocr_extractor.return_value = mock_extractor

        results = index.extract_text_from_image('test-bucket', 'test-key.jpg')

        assert len(results) == 1
        assert results[0].text == "Patient Name: John Doe"
        assert results[0].confidence == 0.95
        mock_s3_client.get_object.assert_called_once_with(
            Bucket='test-bucket',
            Key='test-key.jpg'
        )

    @patch('index.get_ocr_extractor')
    @patch('index.s3_client')
    def test_extract_text_multiple_regions(self, mock_s3_client, mock_get_ocr_extractor):
        """Test extraction with multiple text regions"""
        mock_s3_client.get_object.return_value = {
            'Body': Mock(read=Mock(return_value=b'fake_image_data'))
        }

        mock_extractor = Mock()
        mock_results = [
            Mock(text="Line 1", confidence=0.95),
            Mock(text="Line 2", confidence=0.90),
            Mock(text="Line 3", confidence=0.85)
        ]
        mock_extractor.extract_text.return_value = mock_results
        mock_get_ocr_extractor.return_value = mock_extractor

        results = index.extract_text_from_image('test-bucket', 'test-key.jpg')

        assert len(results) == 3
        assert all(r.confidence >= 0.85 for r in results)

    @patch('index.s3_client')
    def test_extract_text_s3_error(self, mock_s3_client):
        """Test handling S3 download error"""
        from botocore.exceptions import ClientError

        mock_s3_client.get_object.side_effect = ClientError(
            {'Error': {'Code': 'NoSuchKey', 'Message': 'Key not found'}},
            'GetObject'
        )

        with pytest.raises(ClientError):
            index.extract_text_from_image('test-bucket', 'nonexistent-key.jpg')


class TestGetOCRExtractor:
    """Test cases for OCR extractor singleton"""

    @patch('index.create_ocr_extractor')
    def test_get_ocr_extractor_creates_singleton(self, mock_create_ocr_extractor):
        """Test that OCR extractor is created as singleton"""
        # Reset global variable
        index.ocr_extractor = None

        mock_extractor = Mock()
        mock_create_ocr_extractor.return_value = mock_extractor

        # First call should create extractor
        extractor1 = index.get_ocr_extractor()
        assert extractor1 == mock_extractor
        assert mock_create_ocr_extractor.call_count == 1

        # Second call should reuse extractor
        extractor2 = index.get_ocr_extractor()
        assert extractor2 == mock_extractor
        assert mock_create_ocr_extractor.call_count == 1  # Not called again


class TestProcessDocumentWithOCR:
    """Test cases for document processing with OCR integration"""

    @patch('index.trigger_fhir_transformation')
    @patch('index.save_extracted_data')
    @patch('index.update_job_status')
    @patch('index.get_ocr_extractor')
    @patch('index.s3_client')
    def test_process_document_with_ocr_success(
        self,
        mock_s3_client,
        mock_get_ocr_extractor,
        mock_update_job_status,
        mock_save_extracted_data,
        mock_trigger_fhir
    ):
        """Test successful document processing with OCR"""
        # Mock S3
        mock_s3_client.get_object.return_value = {
            'Body': Mock(read=Mock(return_value=b'fake_image_data'))
        }

        # Mock OCR extractor
        mock_extractor = Mock()
        mock_bbox = Mock()
        mock_bbox.to_dict.return_value = {'x1': 0, 'y1': 0, 'x2': 100, 'y2': 100, 'x3': 100, 'y3': 100, 'x4': 0, 'y4': 100}

        mock_result = Mock()
        mock_result.text = "Patient: John Doe\nMedication: Aspirin 100mg"
        mock_result.confidence = 0.92
        mock_result.bounding_box = mock_bbox
        mock_result.to_dict.return_value = {
            'text': mock_result.text,
            'confidence': 0.92,
            'boundingBox': mock_bbox.to_dict()
        }

        mock_extractor.extract_text.return_value = [mock_result]
        mock_extractor.get_average_confidence.return_value = 0.92
        mock_extractor.get_full_text.return_value = "Patient: John Doe\nMedication: Aspirin 100mg"
        mock_get_ocr_extractor.return_value = mock_extractor

        # Process document
        index.process_document('job-456', 'test-bucket', 'test-key.jpg')

        # Verify OCR was called
        mock_extractor.extract_text.assert_called_once()
        mock_extractor.get_average_confidence.assert_called_once()
        mock_extractor.get_full_text.assert_called_once()

        # Verify data was saved
        mock_save_extracted_data.assert_called_once()

        # Verify FHIR transformation was triggered
        mock_trigger_fhir.assert_called_once()

        # Verify status was updated to completed
        status_calls = [call[0] for call in mock_update_job_status.call_args_list]
        assert any('completed' in str(call) for call in status_calls)

    @patch('index.route_to_hitl')
    @patch('index.update_job_status')
    @patch('index.get_ocr_extractor')
    @patch('index.s3_client')
    def test_process_document_low_confidence_routes_to_hitl(
        self,
        mock_s3_client,
        mock_get_ocr_extractor,
        mock_update_job_status,
        mock_route_to_hitl
    ):
        """Test that low confidence results route to HITL"""
        # Mock S3
        mock_s3_client.get_object.return_value = {
            'Body': Mock(read=Mock(return_value=b'fake_image_data'))
        }

        # Mock OCR extractor with low confidence
        mock_extractor = Mock()
        mock_result = Mock()
        mock_result.text = "Unclear text"
        mock_result.confidence = 0.60
        mock_result.to_dict.return_value = {'text': "Unclear text", 'confidence': 0.60}

        mock_extractor.extract_text.return_value = [mock_result]
        mock_extractor.get_average_confidence.return_value = 0.60  # Below threshold
        mock_extractor.get_full_text.return_value = "Unclear text"
        mock_get_ocr_extractor.return_value = mock_extractor

        # Process document
        index.process_document('job-456', 'test-bucket', 'test-key.jpg')

        # Verify routed to HITL
        mock_route_to_hitl.assert_called_once()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
