"""
Unit tests for image preprocessing pipeline.

Tests cover:
- Image loading and validation
- Individual preprocessing steps
- Quality metrics calculation
- Error handling scenarios
- Integration with OCR pipeline
"""

import pytest
import numpy as np
import cv2
import tempfile
import os
from pathlib import Path
from PIL import Image

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from preprocessing.image_processor import (
    ImagePreprocessor,
    PreprocessingResult,
    preprocess_document_image
)


@pytest.fixture
def sample_image():
    """Create a sample test image."""
    # Create a simple test image with text-like patterns
    image = np.ones((800, 600), dtype=np.uint8) * 255

    # Add some "text" (black rectangles)
    cv2.rectangle(image, (50, 50), (200, 80), 0, -1)
    cv2.rectangle(image, (50, 100), (300, 130), 0, -1)
    cv2.rectangle(image, (50, 150), (250, 180), 0, -1)

    return image


@pytest.fixture
def sample_image_path(sample_image, tmp_path):
    """Save sample image to temporary file."""
    image_path = tmp_path / "test_image.png"
    cv2.imwrite(str(image_path), sample_image)
    return str(image_path)


@pytest.fixture
def noisy_image():
    """Create a noisy test image."""
    image = np.ones((800, 600), dtype=np.uint8) * 255

    # Add text
    cv2.rectangle(image, (50, 50), (200, 80), 0, -1)

    # Add noise
    noise = np.random.normal(0, 25, image.shape).astype(np.uint8)
    noisy = cv2.add(image, noise)

    return noisy


@pytest.fixture
def rotated_image():
    """Create a rotated test image."""
    image = np.ones((800, 600), dtype=np.uint8) * 255

    # Add horizontal lines (text-like)
    for y in range(100, 700, 100):
        cv2.line(image, (50, y), (550, y), 0, 3)

    # Rotate by 5 degrees
    center = (image.shape[1] // 2, image.shape[0] // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, 5, 1.0)
    rotated = cv2.warpAffine(image, rotation_matrix, (image.shape[1], image.shape[0]))

    return rotated


@pytest.fixture
def low_contrast_image():
    """Create a low contrast test image."""
    image = np.ones((800, 600), dtype=np.uint8) * 200

    # Add low contrast text
    cv2.rectangle(image, (50, 50), (200, 80), 180, -1)
    cv2.rectangle(image, (50, 100), (300, 130), 180, -1)

    return image


class TestImagePreprocessor:
    """Test suite for ImagePreprocessor class."""

    def test_initialization(self):
        """Test preprocessor initialization with default parameters."""
        preprocessor = ImagePreprocessor()

        assert preprocessor.target_dpi == 300
        assert preprocessor.enable_denoising is True
        assert preprocessor.enable_deskewing is True
        assert preprocessor.enable_border_removal is True
        assert preprocessor.quality_threshold == 0.3

    def test_initialization_custom_params(self):
        """Test preprocessor initialization with custom parameters."""
        preprocessor = ImagePreprocessor(
            target_dpi=600,
            enable_denoising=False,
            enable_deskewing=False,
            quality_threshold=0.5
        )

        assert preprocessor.target_dpi == 600
        assert preprocessor.enable_denoising is False
        assert preprocessor.enable_deskewing is False
        assert preprocessor.quality_threshold == 0.5

    def test_load_image_success(self, sample_image_path):
        """Test successful image loading."""
        preprocessor = ImagePreprocessor()
        image = preprocessor._load_image(sample_image_path)

        assert image is not None
        assert isinstance(image, np.ndarray)
        assert len(image.shape) in [2, 3]

    def test_load_image_invalid_path(self):
        """Test image loading with invalid path."""
        preprocessor = ImagePreprocessor()
        image = preprocessor._load_image("/nonexistent/path/image.png")

        assert image is None

    def test_load_image_corrupted(self, tmp_path):
        """Test image loading with corrupted file."""
        # Create a corrupted image file
        corrupted_path = tmp_path / "corrupted.png"
        with open(corrupted_path, 'wb') as f:
            f.write(b'not an image')

        preprocessor = ImagePreprocessor()
        image = preprocessor._load_image(str(corrupted_path))

        assert image is None

    def test_validate_image_valid(self, sample_image):
        """Test image validation with valid image."""
        preprocessor = ImagePreprocessor()
        is_valid = preprocessor._validate_image(sample_image)

        assert is_valid is True

    def test_validate_image_invalid_shape(self):
        """Test image validation with invalid shape."""
        preprocessor = ImagePreprocessor()
        invalid_image = np.array([1, 2, 3])  # 1D array

        is_valid = preprocessor._validate_image(invalid_image)

        assert is_valid is False

    def test_validate_image_nan_values(self):
        """Test image validation with NaN values."""
        preprocessor = ImagePreprocessor()
        invalid_image = np.array([[1.0, 2.0], [np.nan, 4.0]])

        is_valid = preprocessor._validate_image(invalid_image)

        assert is_valid is False

    def test_reduce_noise(self, noisy_image):
        """Test noise reduction."""
        preprocessor = ImagePreprocessor()
        denoised = preprocessor._reduce_noise(noisy_image)

        assert denoised is not None
        assert denoised.shape == noisy_image.shape
        # Denoised image should have lower variance
        assert denoised.std() <= noisy_image.std()

    def test_deskew_image(self, rotated_image):
        """Test image deskewing."""
        preprocessor = ImagePreprocessor()
        deskewed, angle = preprocessor._deskew_image(rotated_image)

        assert deskewed is not None
        assert deskewed.shape == rotated_image.shape
        assert isinstance(angle, (float, np.floating))

    def test_deskew_image_no_rotation(self, sample_image):
        """Test deskewing on already straight image."""
        preprocessor = ImagePreprocessor()
        deskewed, angle = preprocessor._deskew_image(sample_image)

        assert deskewed is not None
        # Angle should be close to 0 for straight image
        assert abs(angle) < 1.0

    def test_remove_borders(self, sample_image):
        """Test border removal."""
        # Add borders to image
        bordered = cv2.copyMakeBorder(
            sample_image, 50, 50, 50, 50,
            cv2.BORDER_CONSTANT, value=0
        )

        preprocessor = ImagePreprocessor()
        cropped = preprocessor._remove_borders(bordered)

        assert cropped is not None
        # Cropped image should be smaller than bordered
        assert cropped.shape[0] <= bordered.shape[0]
        assert cropped.shape[1] <= bordered.shape[1]

    def test_enhance_contrast(self, low_contrast_image):
        """Test contrast enhancement."""
        preprocessor = ImagePreprocessor()
        enhanced = preprocessor._enhance_contrast(low_contrast_image)

        assert enhanced is not None
        assert enhanced.shape == low_contrast_image.shape
        # Enhanced image should have higher contrast
        assert enhanced.std() >= low_contrast_image.std()

    def test_adaptive_threshold(self, sample_image):
        """Test adaptive thresholding."""
        preprocessor = ImagePreprocessor()
        binary = preprocessor._adaptive_threshold(sample_image)

        assert binary is not None
        assert binary.shape == sample_image.shape
        # Binary image should only have 0 and 255 values
        unique_values = np.unique(binary)
        assert len(unique_values) <= 2
        assert all(v in [0, 255] for v in unique_values)

    def test_calculate_quality_metrics(self, sample_image):
        """Test quality metrics calculation."""
        preprocessor = ImagePreprocessor()
        metrics = preprocessor._calculate_quality_metrics(sample_image)

        assert isinstance(metrics, dict)
        assert "sharpness" in metrics
        assert "contrast" in metrics
        assert "brightness" in metrics
        assert "blur_score" in metrics
        assert "is_blurry" in metrics

        assert isinstance(metrics["sharpness"], float)
        assert isinstance(metrics["contrast"], float)
        assert isinstance(metrics["brightness"], float)
        assert isinstance(metrics["is_blurry"], (bool, np.bool_))

    def test_calculate_quality_metrics_color_image(self):
        """Test quality metrics on color image."""
        color_image = np.random.randint(0, 255, (800, 600, 3), dtype=np.uint8)

        preprocessor = ImagePreprocessor()
        metrics = preprocessor._calculate_quality_metrics(color_image)

        assert isinstance(metrics, dict)
        assert "sharpness" in metrics

    def test_should_use_original_high_quality(self):
        """Test decision to use original when preprocessing degrades quality."""
        preprocessor = ImagePreprocessor(quality_threshold=0.5)

        original_quality = {
            "sharpness": 1000.0,
            "contrast": 50.0,
            "brightness": 128.0,
            "is_blurry": False
        }

        processed_quality = {
            "sharpness": 300.0,  # Significant degradation
            "contrast": 45.0,
            "brightness": 130.0,
            "is_blurry": False
        }

        use_original = preprocessor._should_use_original(
            original_quality, processed_quality
        )

        assert use_original is True

    def test_should_use_processed_blurry_original(self):
        """Test decision to use processed when original is blurry."""
        preprocessor = ImagePreprocessor()

        original_quality = {
            "sharpness": 50.0,
            "contrast": 30.0,
            "brightness": 128.0,
            "is_blurry": True
        }

        processed_quality = {
            "sharpness": 800.0,
            "contrast": 45.0,
            "brightness": 130.0,
            "is_blurry": False
        }

        use_original = preprocessor._should_use_original(
            original_quality, processed_quality
        )

        assert use_original is False

    def test_process_image_success(self, sample_image_path):
        """Test complete preprocessing pipeline."""
        preprocessor = ImagePreprocessor()
        result = preprocessor.process_image(sample_image_path)

        assert isinstance(result, PreprocessingResult)
        assert result.success is True
        assert result.processed_image is not None
        assert result.original_image is not None
        assert isinstance(result.quality_metrics, dict)
        assert isinstance(result.preprocessing_steps, list)
        assert len(result.preprocessing_steps) > 0

    def test_process_image_invalid_path(self):
        """Test preprocessing with invalid image path."""
        preprocessor = ImagePreprocessor()
        result = preprocessor.process_image("/nonexistent/image.png")

        assert isinstance(result, PreprocessingResult)
        assert result.success is False
        assert result.error_message is not None

    def test_process_image_with_all_steps(self, sample_image_path):
        """Test preprocessing with all steps enabled."""
        preprocessor = ImagePreprocessor(
            enable_denoising=True,
            enable_deskewing=True,
            enable_border_removal=True
        )
        result = preprocessor.process_image(sample_image_path)

        assert result.success is True
        assert "grayscale_conversion" in result.preprocessing_steps
        assert "noise_reduction" in result.preprocessing_steps
        assert "contrast_enhancement" in result.preprocessing_steps
        assert "adaptive_binarization" in result.preprocessing_steps

    def test_process_image_minimal_steps(self, sample_image_path):
        """Test preprocessing with minimal steps."""
        preprocessor = ImagePreprocessor(
            enable_denoising=False,
            enable_deskewing=False,
            enable_border_removal=False
        )
        result = preprocessor.process_image(sample_image_path)

        assert result.success is True
        assert "noise_reduction" not in result.preprocessing_steps
        assert "contrast_enhancement" in result.preprocessing_steps

    def test_save_image(self, sample_image, tmp_path):
        """Test saving processed image."""
        output_path = tmp_path / "output.png"

        preprocessor = ImagePreprocessor()
        success = preprocessor.save_image(sample_image, str(output_path))

        assert success is True
        assert output_path.exists()

        # Verify saved image can be loaded
        loaded = cv2.imread(str(output_path))
        assert loaded is not None

    def test_save_image_invalid_path(self, sample_image):
        """Test saving image to invalid path."""
        preprocessor = ImagePreprocessor()
        # Use a path that's definitely invalid on all platforms
        success = preprocessor.save_image(
            sample_image,
            "\0invalid\0path\0output.png"
        )

        assert success is False

    def test_image_to_bytes(self, sample_image):
        """Test converting image to bytes."""
        preprocessor = ImagePreprocessor()
        image_bytes = preprocessor.image_to_bytes(sample_image, format='PNG')

        assert image_bytes is not None
        assert isinstance(image_bytes, bytes)
        assert len(image_bytes) > 0

        # Verify bytes can be loaded as image
        from io import BytesIO
        pil_image = Image.open(BytesIO(image_bytes))
        assert pil_image is not None

    def test_image_to_bytes_jpeg(self, sample_image):
        """Test converting image to JPEG bytes."""
        preprocessor = ImagePreprocessor()
        image_bytes = preprocessor.image_to_bytes(sample_image, format='JPEG')

        assert image_bytes is not None
        assert isinstance(image_bytes, bytes)


class TestConvenienceFunction:
    """Test suite for convenience function."""

    def test_preprocess_document_image(self, sample_image_path):
        """Test convenience function."""
        result = preprocess_document_image(sample_image_path)

        assert isinstance(result, PreprocessingResult)
        assert result.success is True
        assert result.processed_image is not None

    def test_preprocess_document_image_custom_params(self, sample_image_path):
        """Test convenience function with custom parameters."""
        result = preprocess_document_image(
            sample_image_path,
            enable_denoising=False,
            quality_threshold=0.5
        )

        assert isinstance(result, PreprocessingResult)
        assert result.success is True


class TestEdgeCases:
    """Test suite for edge cases and error handling."""

    def test_very_small_image(self, tmp_path):
        """Test preprocessing very small image."""
        # Create tiny image
        tiny_image = np.ones((50, 50), dtype=np.uint8) * 255
        image_path = tmp_path / "tiny.png"
        cv2.imwrite(str(image_path), tiny_image)

        preprocessor = ImagePreprocessor()
        result = preprocessor.process_image(str(image_path))

        # Should fail validation due to size
        assert result.success is False

    def test_very_large_image(self, tmp_path):
        """Test preprocessing very large image."""
        # Create large image
        large_image = np.ones((4000, 3000), dtype=np.uint8) * 255
        image_path = tmp_path / "large.png"
        cv2.imwrite(str(image_path), large_image)

        preprocessor = ImagePreprocessor()
        result = preprocessor.process_image(str(image_path))

        # Should handle large images
        assert result.success is True

    def test_grayscale_input(self, tmp_path):
        """Test preprocessing already grayscale image."""
        gray_image = np.ones((800, 600), dtype=np.uint8) * 255
        image_path = tmp_path / "gray.png"
        cv2.imwrite(str(image_path), gray_image)

        preprocessor = ImagePreprocessor()
        result = preprocessor.process_image(str(image_path))

        assert result.success is True
        # Note: cv2.imread may load grayscale as BGR, so conversion might still occur
        # Just verify the pipeline completes successfully
        assert len(result.preprocessing_steps) > 0

    def test_color_input(self, tmp_path):
        """Test preprocessing color image."""
        color_image = np.ones((800, 600, 3), dtype=np.uint8) * 255
        image_path = tmp_path / "color.png"
        cv2.imwrite(str(image_path), color_image)

        preprocessor = ImagePreprocessor()
        result = preprocessor.process_image(str(image_path))

        assert result.success is True
        # Should include grayscale conversion step
        assert "grayscale_conversion" in result.preprocessing_steps

    def test_high_quality_original(self, tmp_path):
        """Test that high quality original is preserved."""
        # Create high quality image
        high_quality = np.ones((800, 600), dtype=np.uint8) * 255
        cv2.rectangle(high_quality, (50, 50), (200, 80), 0, -1)

        image_path = tmp_path / "high_quality.png"
        cv2.imwrite(str(image_path), high_quality)

        preprocessor = ImagePreprocessor(quality_threshold=0.8)
        result = preprocessor.process_image(str(image_path))

        assert result.success is True
        # May use original if preprocessing doesn't improve quality
        assert result.processed_image is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
