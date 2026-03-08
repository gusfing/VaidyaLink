"""
Integration tests for HITL routing functionality.

Tests the complete flow from low-confidence detection to HITL queue routing.
"""

import json
import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Mock AWS services before importing the handler
os.environ['SCANJOBS_TABLE'] = 'test-scanjobs-table'
os.environ['DOCUMENTS_BUCKET'] = 'test-documents-bucket'
os.environ['HITL_QUEUE_URL'] = 'https://sqs.us-east-1.amazonaws.com/123456789012/test-hitl-queue'
os.environ['CONFIDENCE_THRESHOLD'] = '0.80'
os.environ['BEDROCK_MODEL_ID'] = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
os.environ['OCR_LANGUAGES'] = 'en,hi'


class TestHITLIntegration:
    """Integration tests for HITL routing."""

    @patch('index.sqs_client')
    @patch('index.dynamodb')
    @patch('index.s3_client')
    @patch('index.get_confidence_scorer')
    @patch('index.get_clinical_structurer')
    @patch('index.get_ocr_extractor')
    def test_low_confidence_routes_to_hitl(
        self,
        mock_ocr,
        mock_structurer,
        mock_scorer,
        mock_s3,
        mock_dynamodb,
        mock_sqs
    ):
        """Test that low confidence extraction routes to HITL queue."""
        from index import process_document
        from ocr import OCRResult
        from bedrock import StructuredClinicalData
        from confidence import ConfidenceScores

        # Mock OCR results with low confidence
        mock_ocr_extractor = Mock()
        mock_ocr_extractor.extract_text.return_value = [
            OCRResult(
                text='Patient Name: John Doe',
                confidence=0.65,
                bbox=[0, 0, 100, 20],
                language='en'
            ),
            OCRResult(
                text='Medication: Aspirin 100mg',
                confidence=0.70,
                bbox=[0, 30, 100, 50],
                language='en'
            )
        ]
        mock_ocr_extractor.get_average_confidence.return_value = 0.675
        mock_ocr_extractor.get_full_text.return_value = 'Patient Name: John Doe\nMedication: Aspirin 100mg'
        mock_ocr.return_value = mock_ocr_extractor

        # Mock Bedrock structuring
        mock_clinical_structurer = Mock()
        mock_clinical_structurer.structure_clinical_data.return_value = StructuredClinicalData(
            patient_name='John Doe',
            medications=[{'name': 'Aspirin', 'dosage': '100mg'}],
            diagnosis=None,
            document_date=None,
            doctor_name=None,
            patient_age=None,
            patient_gender=None,
            lab_results=[],
            vital_signs={},
            raw_text='Patient Name: John Doe\nMedication: Aspirin 100mg'
        )
        mock_structurer.return_value = mock_clinical_structurer

        # Mock confidence scorer with LOW confidence
        mock_confidence_scorer = Mock()
        mock_confidence_scorer.calculate_confidence.return_value = ConfidenceScores(
            overall=0.72,  # Below threshold of 0.80
            ocr=0.675,
            extraction=0.80,
            validation=0.70,
            field_scores={
                'patient_name': 0.68,  # Low confidence
                'medications': 0.75,
                'diagnosis': 0.0
            },
            critical_fields_below_threshold=['patient_name'],
            calculated_at=datetime.utcnow().isoformat(),
            threshold_used=0.80
        )
        mock_scorer.return_value = mock_confidence_scorer

        # Mock S3 client
        mock_s3.get_object.return_value = {
            'Body': Mock(read=lambda: b'fake_image_data')
        }
        mock_s3.put_object.return_value = {}

        # Mock DynamoDB
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.update_item.return_value = {}

        # Mock SQS client
        mock_sqs.send_message.return_value = {
            'MessageId': 'test-message-id'
        }

        # Execute
        job_id = 'test-job-123'
        bucket = 'test-bucket'
        key = 'raw/patient-456/test-job-123/original.jpg'

        process_document(job_id, bucket, key)

        # Verify SQS message was sent
        mock_sqs.send_message.assert_called_once()
        call_args = mock_sqs.send_message.call_args

        assert call_args[1]['QueueUrl'] == os.environ['HITL_QUEUE_URL']

        # Verify message content
        message_body = json.loads(call_args[1]['MessageBody'])
        assert message_body['jobId'] == job_id
        assert 'structuredData' in message_body
        assert 'confidenceScores' in message_body
        assert message_body['confidenceScores']['overall'] == 0.72
        assert 'patient_name' in message_body['confidenceScores']['criticalFieldsBelowThreshold']

        # Verify job status was updated to hitl_required
        update_calls = [call for call in mock_table.update_item.call_args_list
                       if 'hitl_required' in str(call)]
        assert len(update_calls) > 0

    @patch('index.lambda_client')
    @patch('index.sqs_client')
    @patch('index.dynamodb')
    @patch('index.s3_client')
    @patch('index.get_confidence_scorer')
    @patch('index.get_clinical_structurer')
    @patch('index.get_ocr_extractor')
    def test_high_confidence_bypasses_hitl(
        self,
        mock_ocr,
        mock_structurer,
        mock_scorer,
        mock_s3,
        mock_dynamodb,
        mock_sqs,
        mock_lambda
    ):
        """Test that high confidence extraction bypasses HITL queue."""
        from index import process_document
        from ocr import OCRResult
        from bedrock import StructuredClinicalData
        from confidence import ConfidenceScores

        # Mock OCR results with HIGH confidence
        mock_ocr_extractor = Mock()
        mock_ocr_extractor.extract_text.return_value = [
            OCRResult(
                text='Patient Name: John Doe',
                confidence=0.95,
                bbox=[0, 0, 100, 20],
                language='en'
            ),
            OCRResult(
                text='Medication: Aspirin 100mg',
                confidence=0.92,
                bbox=[0, 30, 100, 50],
                language='en'
            )
        ]
        mock_ocr_extractor.get_average_confidence.return_value = 0.935
        mock_ocr_extractor.get_full_text.return_value = 'Patient Name: John Doe\nMedication: Aspirin 100mg'
        mock_ocr.return_value = mock_ocr_extractor

        # Mock Bedrock structuring
        mock_clinical_structurer = Mock()
        mock_clinical_structurer.structure_clinical_data.return_value = StructuredClinicalData(
            patient_name='John Doe',
            medications=[{'name': 'Aspirin', 'dosage': '100mg'}],
            diagnosis='Hypertension',
            document_date='2024-01-15',
            doctor_name='Dr. Smith',
            patient_age=45,
            patient_gender='male',
            lab_results=[],
            vital_signs={},
            raw_text='Patient Name: John Doe\nMedication: Aspirin 100mg'
        )
        mock_structurer.return_value = mock_clinical_structurer

        # Mock confidence scorer with HIGH confidence
        mock_confidence_scorer = Mock()
        mock_confidence_scorer.calculate_confidence.return_value = ConfidenceScores(
            overall=0.89,  # Above threshold of 0.80
            ocr=0.935,
            extraction=0.90,
            validation=0.85,
            field_scores={
                'patient_name': 0.92,
                'medications': 0.88,
                'diagnosis': 0.85
            },
            critical_fields_below_threshold=[],  # No critical fields below threshold
            calculated_at=datetime.utcnow().isoformat(),
            threshold_used=0.80
        )
        mock_scorer.return_value = mock_confidence_scorer

        # Mock S3 client
        mock_s3.get_object.return_value = {
            'Body': Mock(read=lambda: b'fake_image_data')
        }
        mock_s3.put_object.return_value = {}

        # Mock DynamoDB
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.update_item.return_value = {}

        # Mock Lambda client
        mock_lambda.invoke.return_value = {}

        # Execute
        job_id = 'test-job-456'
        bucket = 'test-bucket'
        key = 'raw/patient-789/test-job-456/original.jpg'

        process_document(job_id, bucket, key)

        # Verify SQS message was NOT sent
        mock_sqs.send_message.assert_not_called()

        # Verify FHIR transformation was triggered
        mock_lambda.invoke.assert_called_once()

        # Verify job status was updated to completed
        update_calls = [call for call in mock_table.update_item.call_args_list
                       if 'completed' in str(call)]
        assert len(update_calls) > 0

    @patch('index.sqs_client')
    @patch('index.dynamodb')
    @patch('index.s3_client')
    @patch('index.get_confidence_scorer')
    @patch('index.get_clinical_structurer')
    @patch('index.get_ocr_extractor')
    def test_critical_field_failure_routes_to_hitl(
        self,
        mock_ocr,
        mock_structurer,
        mock_scorer,
        mock_s3,
        mock_dynamodb,
        mock_sqs
    ):
        """Test that critical field failure routes to HITL even with decent overall confidence."""
        from index import process_document
        from ocr import OCRResult
        from bedrock import StructuredClinicalData
        from confidence import ConfidenceScores

        # Mock OCR results
        mock_ocr_extractor = Mock()
        mock_ocr_extractor.extract_text.return_value = [
            OCRResult(text='Patient Name: ???', confidence=0.45, bbox=[0, 0, 100, 20], language='en'),
            OCRResult(text='Medication: Aspirin 100mg', confidence=0.95, bbox=[0, 30, 100, 50], language='en')
        ]
        mock_ocr_extractor.get_average_confidence.return_value = 0.70
        mock_ocr_extractor.get_full_text.return_value = 'Patient Name: ???\nMedication: Aspirin 100mg'
        mock_ocr.return_value = mock_ocr_extractor

        # Mock Bedrock structuring
        mock_clinical_structurer = Mock()
        mock_clinical_structurer.structure_clinical_data.return_value = StructuredClinicalData(
            patient_name='???',  # Unclear patient name
            medications=[{'name': 'Aspirin', 'dosage': '100mg'}],
            diagnosis=None,
            document_date=None,
            doctor_name=None,
            patient_age=None,
            patient_gender=None,
            lab_results=[],
            vital_signs={},
            raw_text='Patient Name: ???\nMedication: Aspirin 100mg'
        )
        mock_structurer.return_value = mock_clinical_structurer

        # Mock confidence scorer - overall OK but critical field fails
        mock_confidence_scorer = Mock()
        mock_confidence_scorer.calculate_confidence.return_value = ConfidenceScores(
            overall=0.78,  # Just below threshold
            ocr=0.70,
            extraction=0.85,
            validation=0.80,
            field_scores={
                'patient_name': 0.50,  # CRITICAL FIELD with low confidence
                'medications': 0.92,
                'diagnosis': 0.0
            },
            critical_fields_below_threshold=['patient_name'],  # Critical field flagged
            calculated_at=datetime.utcnow().isoformat(),
            threshold_used=0.80
        )
        mock_scorer.return_value = mock_confidence_scorer

        # Mock S3 client
        mock_s3.get_object.return_value = {
            'Body': Mock(read=lambda: b'fake_image_data')
        }
        mock_s3.put_object.return_value = {}

        # Mock DynamoDB
        mock_table = Mock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.update_item.return_value = {}

        # Mock SQS client
        mock_sqs.send_message.return_value = {
            'MessageId': 'test-message-id'
        }

        # Execute
        job_id = 'test-job-789'
        bucket = 'test-bucket'
        key = 'raw/patient-999/test-job-789/original.jpg'

        process_document(job_id, bucket, key)

        # Verify SQS message was sent due to critical field failure
        mock_sqs.send_message.assert_called_once()

        # Verify message highlights critical field issue
        call_args = mock_sqs.send_message.call_args
        message_body = json.loads(call_args[1]['MessageBody'])
        assert 'patient_name' in message_body['confidenceScores']['criticalFieldsBelowThreshold']


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
