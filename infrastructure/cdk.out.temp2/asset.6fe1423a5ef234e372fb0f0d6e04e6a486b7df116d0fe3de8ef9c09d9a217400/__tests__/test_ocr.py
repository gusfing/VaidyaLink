"""
Unit tests for PaddleOCR integration module.
"""

import sys
import os
import pytest
from unittest.mock import Mock, patch, MagicMock
import numpy as np
from PIL import Image
import io

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ocr.paddle_ocr import (
    PaddleOCRExtractor,
    OCRResult,
    BoundingBox,
    create_ocr_extractor
)


class TestBoundingBox:
    """Tests for BoundingBox class."""

    def test_from_points(self):
        """Test creating BoundingBox from points."""
        points = [[10.0, 20.0], [100.0, 20.0], [100.0, 50.0], [10.0, 50.0]]
        bbox = BoundingBox.from_points(points)

        assert bbox.x1 == 10.0
        assert bbox.y1 == 20.0
        assert bbox.x2 == 100.0
        assert bbox.y2 == 20.0
        assert bbox.x3 == 100.0
        assert bbox.y3 == 50.0
        assert bbox.x4 == 10.0
        assert bbox.y4 == 50.0

    def test_to_dict(self):
        """Test converting BoundingBox to dictionary."""
        bbox = BoundingBox(10.0, 20.0, 100.0, 20.0, 100.0, 50.0, 10.0, 50.0)
        bbox_dict = bbox.to_dict()

        assert bbox_dict == {
            'x1': 10.0, 'y1': 20.0,
            'x2': 100.0, 'y2': 20.0,
            'x3': 100.0, 'y3': 50.0,
            'x4': 10.0, 'y4': 50.0
        }


class TestOCRResult:
    """Tests for OCRResult class."""

    def test_to_dict(self):
        """Test converting OCRResult to dictionary."""
        bbox = BoundingBox(10.0, 20.0, 100.0, 20.0, 100.0, 50.0, 10.0, 50.0)
        result = OCRResult(
            text="Patient Name",
            confidence=0.95,
            bounding_box=bbox,
            language='en'
        )

        result_dict = result.to_dict()

        assert result_dict['text'] == "Patient Name"
        assert result_dict['confidence'] == 0.95
        assert result_dict['language'] == 'en'
        assert 'boundingBox' in result_dict


class TestPaddleOCRExtractor:
    """Tests for PaddleOCRExtractor class."""

    @pytest.fixture
    def mock_paddle_ocr(self):
        """Mock PaddleOCR instance."""
        with patch('ocr.paddle_ocr.PaddleOCR') as mock:
            yield mock

    @pytest.fixture
    def sample_image_data(self):
        """Create sample image data."""
        # Create a simple white image
        img = Image.new('RGB', (100, 100), color='white')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        return img_bytes.getvalue()

    @pytest.fixture
    def mock_ocr_response(self):
        """Mock OCR response from PaddleOCR."""
        return [[
            [
                [[10.0, 20.0], [100.0, 20.0], [100.0, 50.0], [10.0, 50.0]],
                ['Patient Name: John Doe', 0.95]
            ],
            [
                [[10.0, 60.0], [100.0, 60.0], [100.0, 90.0], [10.0, 90.0]],
                ['Date: 2024-01-15', 0.92]
            ]
        ]]

    def test_initialization(self, mock_paddle_ocr):
        """Test PaddleOCRExtractor initialization."""
        extractor = PaddleOCRExtractor(languages=['en', 'hi'])

        assert 'en' in extractor.ocr_engines
        assert 'hi' in extractor.ocr_engines
        assert mock_paddle_ocr.call_count == 2

    def test_initialization_default_languages(self, mock_paddle_ocr):
        """Test initialization with default languages."""
        extractor = PaddleOCRExtractor()

        assert extractor.languages == ['en', 'hi']

    def test_extract_text(self, mock_paddle_ocr, sample_image_data, mock_ocr_response):
        """Test text extraction from image."""
        # Setup mock
        mock_instance = MagicMock()
        mock_instance.ocr.return_value = mock_ocr_response
        mock_paddle_ocr.return_value = mock_instance

        # Create extractor and extract text
        extractor = PaddleOCRExtractor(languages=['en'])
        results = extractor.extract_text(sample_image_data, language='en')

        # Verify results
        assert len(results) == 2
        assert results[0].text == 'Patient Name: John Doe'
        assert results[0].confidence == 0.95
        assert results[1].text == 'Date: 2024-01-15'
        assert results[1].confidence == 0.92

    def test_extract_text_no_results(self, mock_paddle_ocr, sample_image_data):
        """Test extraction when no text is detected."""
        # Setup mock with empty results
        mock_instance = MagicMock()
        mock_instance.ocr.return_value = [[]]
        mock_paddle_ocr.return_value = mock_instance

        extractor = PaddleOCRExtractor(languages=['en'])
        results = extractor.extract_text(sample_image_data, language='en')

        assert results == []

    def test_extract_text_unsupported_language(self, mock_paddle_ocr, sample_image_data, mock_ocr_response):
        """Test extraction with unsupported language falls back to English."""
        mock_instance = MagicMock()
        mock_instance.ocr.return_value = mock_ocr_response
        mock_paddle_ocr.return_value = mock_instance

        extractor = PaddleOCRExtractor(languages=['en'])
        results = extractor.extract_text(sample_image_data, language='fr')

        # Should fall back to English
        assert len(results) == 2

    def test_get_full_text(self, mock_paddle_ocr):
        """Test combining OCR results into full text."""
        extractor = PaddleOCRExtractor(languages=['en'])

        # Create sample results
        bbox1 = BoundingBox(10.0, 20.0, 100.0, 20.0, 100.0, 50.0, 10.0, 50.0)
        bbox2 = BoundingBox(10.0, 60.0, 100.0, 60.0, 100.0, 90.0, 10.0, 90.0)

        results = [
            OCRResult("Patient Name: John Doe", 0.95, bbox1, 'en'),
            OCRResult("Date: 2024-01-15", 0.92, bbox2, 'en')
        ]

        full_text = extractor.get_full_text(results, min_confidence=0.5)

        assert "Patient Name: John Doe" in full_text
        assert "Date: 2024-01-15" in full_text

    def test_get_full_text_filters_low_confidence(self, mock_paddle_ocr):
        """Test that low confidence results are filtered."""
        extractor = PaddleOCRExtractor(languages=['en'])

        bbox = BoundingBox(10.0, 20.0, 100.0, 20.0, 100.0, 50.0, 10.0, 50.0)

        results = [
            OCRResult("High confidence", 0.95, bbox, 'en'),
            OCRResult("Low confidence", 0.30, bbox, 'en')
        ]

        full_text = extractor.get_full_text(results, min_confidence=0.5)

        assert "High confidence" in full_text
        assert "Low confidence" not in full_text

    def test_get_average_confidence(self, mock_paddle_ocr):
        """Test calculating average confidence."""
        extractor = PaddleOCRExtractor(languages=['en'])

        bbox = BoundingBox(10.0, 20.0, 100.0, 20.0, 100.0, 50.0, 10.0, 50.0)

        results = [
            OCRResult("Text 1", 0.90, bbox, 'en'),
            OCRResult("Text 2", 0.80, bbox, 'en'),
            OCRResult("Text 3", 0.70, bbox, 'en')
        ]

        avg_confidence = extractor.get_average_confidence(results)

        assert avg_confidence == 0.80

    def test_get_average_confidence_empty(self, mock_paddle_ocr):
        """Test average confidence with empty results."""
        extractor = PaddleOCRExtractor(languages=['en'])

        avg_confidence = extractor.get_average_confidence([])

        assert avg_confidence == 0.0

    def test_filter_by_confidence(self, mock_paddle_ocr):
        """Test filtering results by confidence threshold."""
        extractor = PaddleOCRExtractor(languages=['en'])

        bbox = BoundingBox(10.0, 20.0, 100.0, 20.0, 100.0, 50.0, 10.0, 50.0)

        results = [
            OCRResult("High 1", 0.95, bbox, 'en'),
            OCRResult("High 2", 0.85, bbox, 'en'),
            OCRResult("Low", 0.60, bbox, 'en')
        ]

        filtered = extractor.filter_by_confidence(results, min_confidence=0.80)

        assert len(filtered) == 2
        assert all(r.confidence >= 0.80 for r in filtered)

    def test_get_text_by_region(self, mock_paddle_ocr):
        """Test extracting text from specific region."""
        extractor = PaddleOCRExtractor(languages=['en'])

        # Create results in different regions
        bbox1 = BoundingBox(10.0, 10.0, 50.0, 10.0, 50.0, 30.0, 10.0, 30.0)  # Top-left
        bbox2 = BoundingBox(60.0, 60.0, 100.0, 60.0, 100.0, 80.0, 60.0, 80.0)  # Bottom-right

        results = [
            OCRResult("Top text", 0.95, bbox1, 'en'),
            OCRResult("Bottom text", 0.92, bbox2, 'en')
        ]

        # Get text from top-left region only
        region_results = extractor.get_text_by_region(results, 0, 0, 55, 35)

        assert len(region_results) == 1
        assert region_results[0].text == "Top text"

    def test_extract_text_multilingual(self, mock_paddle_ocr, sample_image_data, mock_ocr_response):
        """Test multilingual extraction."""
        mock_instance = MagicMock()
        mock_instance.ocr.return_value = mock_ocr_response
        mock_paddle_ocr.return_value = mock_instance

        extractor = PaddleOCRExtractor(languages=['en', 'hi'])
        results_by_lang = extractor.extract_text_multilingual(sample_image_data)

        assert 'en' in results_by_lang
        assert 'hi' in results_by_lang
        assert len(results_by_lang['en']) == 2
        assert len(results_by_lang['hi']) == 2


class TestCreateOCRExtractor:
    """Tests for create_ocr_extractor factory function."""

    @patch('ocr.paddle_ocr.PaddleOCR')
    def test_create_with_defaults(self, mock_paddle_ocr):
        """Test creating extractor with default settings."""
        extractor = create_ocr_extractor()

        assert extractor.languages == ['en', 'hi']
        assert extractor.use_gpu is False

    @patch('ocr.paddle_ocr.PaddleOCR')
    def test_create_with_custom_languages(self, mock_paddle_ocr):
        """Test creating extractor with custom languages."""
        extractor = create_ocr_extractor(languages=['en', 'ta', 'te'])

        assert extractor.languages == ['en', 'ta', 'te']

    @patch('ocr.paddle_ocr.PaddleOCR')
    @patch('ocr.paddle_ocr.paddle')
    def test_create_with_gpu_available(self, mock_paddle, mock_paddle_ocr):
        """Test creating extractor with GPU when available."""
        mock_paddle.is_compiled_with_cuda.return_value = True

        extractor = create_ocr_extractor(use_gpu=True)

        assert extractor.use_gpu is True

    @patch('ocr.paddle_ocr.PaddleOCR')
    @patch('ocr.paddle_ocr.paddle')
    def test_create_with_gpu_unavailable(self, mock_paddle, mock_paddle_ocr):
        """Test creating extractor falls back to CPU when GPU unavailable."""
        mock_paddle.is_compiled_with_cuda.return_value = False

        extractor = create_ocr_extractor(use_gpu=True)

        assert extractor.use_gpu is False


class TestIntegration:
    """Integration tests for OCR module."""

    @patch('ocr.paddle_ocr.PaddleOCR')
    def test_end_to_end_extraction(self, mock_paddle_ocr):
        """Test complete extraction workflow."""
        # Setup mock
        mock_instance = MagicMock()
        mock_instance.ocr.return_value = [[
            [
                [[10.0, 20.0], [200.0, 20.0], [200.0, 50.0], [10.0, 50.0]],
                ['Patient: Rajesh Kumar', 0.95]
            ],
            [
                [[10.0, 60.0], [200.0, 60.0], [200.0, 90.0], [10.0, 90.0]],
                ['Medication: Omeprazole 20mg', 0.92]
            ],
            [
                [[10.0, 100.0], [200.0, 100.0], [200.0, 130.0], [10.0, 130.0]],
                ['Dosage: Once daily', 0.88]
            ]
        ]]
        mock_paddle_ocr.return_value = mock_instance

        # Create image data
        img = Image.new('RGB', (300, 200), color='white')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        image_data = img_bytes.getvalue()

        # Extract text
        extractor = create_ocr_extractor(languages=['en'])
        results = extractor.extract_text(image_data, language='en')

        # Verify extraction
        assert len(results) == 3

        # Get full text
        full_text = extractor.get_full_text(results)
        assert 'Rajesh Kumar' in full_text
        assert 'Omeprazole' in full_text

        # Check average confidence
        avg_conf = extractor.get_average_confidence(results)
        assert avg_conf > 0.90

        # Filter high confidence
        high_conf = extractor.filter_by_confidence(results, 0.90)
        assert len(high_conf) == 2
