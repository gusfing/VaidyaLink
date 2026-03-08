"""
Image Preprocessing Pipeline for Medical Document OCR

Implements comprehensive image enhancement techniques to improve OCR accuracy:
- Grayscale conversion
- Noise reduction (Gaussian blur, bilateral filtering)
- Adaptive thresholding for binarization
- Deskewing (rotation correction)
- Contrast enhancement (histogram equalization, CLAHE)
- Border removal
- Resolution normalization (300 DPI equivalent)
"""

import logging
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass, field
import numpy as np
import cv2
from PIL import Image
import io

logger = logging.getLogger(__name__)


@dataclass
class PreprocessingResult:
    """Result of image preprocessing operation"""
    success: bool
    processed_image: Optional[np.ndarray] = None
    original_image: Optional[np.ndarray] = None
    quality_metrics: Dict[str, float] = field(default_factory=dict)
    preprocessing_steps: list = field(default_factory=list)
    error_message: Optional[str] = None
    used_original: bool = False


class ImagePreprocessor:
    """
    Comprehensive image preprocessing pipeline for medical document OCR.

    Applies multiple enhancement techniques to improve OCR accuracy while
    maintaining the ability to fallback to original image if preprocessing
    degrades quality.
    """

    def __init__(
        self,
        target_dpi: int = 300,
        enable_denoising: bool = True,
        enable_deskewing: bool = True,
        enable_border_removal: bool = True,
        quality_threshold: float = 0.3
    ):
        """
        Initialize the image preprocessor.

        Args:
            target_dpi: Target DPI for resolution normalization
            enable_denoising: Whether to apply noise reduction
            enable_deskewing: Whether to correct document rotation
            enable_border_removal: Whether to remove scan borders
            quality_threshold: Minimum quality score to accept preprocessing
        """
        self.target_dpi = target_dpi
        self.enable_denoising = enable_denoising
        self.enable_deskewing = enable_deskewing
        self.enable_border_removal = enable_border_removal
        self.quality_threshold = quality_threshold

    def process_image(self, image_path: str) -> PreprocessingResult:
        """
        Main preprocessing pipeline entry point.

        Args:
            image_path: Path to the image file

        Returns:
            PreprocessingResult with processed image and metadata
        """
        try:
            # Load and validate image
            original_image = self._load_image(image_path)
            if original_image is None:
                return PreprocessingResult(
                    success=False,
                    error_message="Failed to load image"
                )

            # Calculate original quality metrics
            original_quality = self._calculate_quality_metrics(original_image)

            # Apply preprocessing pipeline
            processed_image = original_image.copy()
            steps = []

            # Step 1: Grayscale conversion
            if len(processed_image.shape) == 3:
                processed_image = cv2.cvtColor(processed_image, cv2.COLOR_BGR2GRAY)
                steps.append("grayscale_conversion")

            # Step 2: Noise reduction
            if self.enable_denoising:
                processed_image = self._reduce_noise(processed_image)
                steps.append("noise_reduction")

            # Step 3: Deskewing
            if self.enable_deskewing:
                processed_image, angle = self._deskew_image(processed_image)
                if abs(angle) > 0.5:  # Only log if significant rotation
                    steps.append(f"deskew_rotation_{angle:.2f}deg")

            # Step 4: Border removal
            if self.enable_border_removal:
                processed_image = self._remove_borders(processed_image)
                steps.append("border_removal")

            # Step 5: Contrast enhancement
            processed_image = self._enhance_contrast(processed_image)
            steps.append("contrast_enhancement")

            # Step 6: Adaptive binarization
            processed_image = self._adaptive_threshold(processed_image)
            steps.append("adaptive_binarization")

            # Calculate processed quality metrics
            processed_quality = self._calculate_quality_metrics(processed_image)

            # Decide whether to use processed or original image
            use_original = self._should_use_original(
                original_quality,
                processed_quality
            )

            final_image = original_image if use_original else processed_image

            return PreprocessingResult(
                success=True,
                processed_image=final_image,
                original_image=original_image,
                quality_metrics={
                    "original": original_quality,
                    "processed": processed_quality
                },
                preprocessing_steps=steps,
                used_original=use_original
            )

        except Exception as e:
            logger.error(f"Preprocessing failed: {str(e)}", exc_info=True)
            return PreprocessingResult(
                success=False,
                error_message=str(e)
            )

    def _load_image(self, image_path: str) -> Optional[np.ndarray]:
        """
        Load and validate image from file path.

        Args:
            image_path: Path to image file

        Returns:
            Numpy array of image or None if loading fails
        """
        try:
            # Try loading with OpenCV first
            image = cv2.imread(image_path)

            if image is None:
                # Fallback to PIL for better format support
                pil_image = Image.open(image_path)
                image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

            # Validate image dimensions
            if image.shape[0] < 100 or image.shape[1] < 100:
                logger.warning(f"Image too small: {image.shape}")
                return None

            # Validate image is not corrupted
            if not self._validate_image(image):
                logger.warning("Image validation failed")
                return None

            return image

        except Exception as e:
            logger.error(f"Failed to load image: {str(e)}")
            return None

    def _validate_image(self, image: np.ndarray) -> bool:
        """
        Validate that image is not corrupted.

        Args:
            image: Image array to validate

        Returns:
            True if image is valid, False otherwise
        """
        try:
            # Check for valid shape
            if len(image.shape) not in [2, 3]:
                return False

            # Check for valid data type
            if image.dtype not in [np.uint8, np.uint16, np.float32]:
                return False

            # Check for non-empty image
            if image.size == 0:
                return False

            # Check for reasonable value range
            if np.isnan(image).any() or np.isinf(image).any():
                return False

            return True

        except Exception:
            return False

    def _reduce_noise(self, image: np.ndarray) -> np.ndarray:
        """
        Apply noise reduction using bilateral filtering.

        Bilateral filtering preserves edges while reducing noise,
        which is important for maintaining text clarity.

        Args:
            image: Grayscale image

        Returns:
            Denoised image
        """
        # Apply bilateral filter (preserves edges better than Gaussian)
        denoised = cv2.bilateralFilter(image, d=9, sigmaColor=75, sigmaSpace=75)
        return denoised

    def _deskew_image(self, image: np.ndarray) -> Tuple[np.ndarray, float]:
        """
        Detect and correct document rotation (deskewing).

        Uses Hough line transform to detect dominant text lines
        and calculate rotation angle.

        Args:
            image: Grayscale image

        Returns:
            Tuple of (deskewed image, rotation angle in degrees)
        """
        try:
            # Detect edges
            edges = cv2.Canny(image, 50, 150, apertureSize=3)

            # Detect lines using Hough transform
            lines = cv2.HoughLines(edges, 1, np.pi / 180, 200)

            if lines is None or len(lines) == 0:
                return image, 0.0

            # Calculate angles of detected lines
            angles = []
            for line in lines:
                rho, theta = line[0]
                angle = (theta * 180 / np.pi) - 90
                # Filter out vertical lines
                if -45 < angle < 45:
                    angles.append(angle)

            if not angles:
                return image, 0.0

            # Use median angle to avoid outliers
            rotation_angle = np.median(angles)

            # Only rotate if angle is significant (> 0.5 degrees)
            if abs(rotation_angle) < 0.5:
                return image, 0.0

            # Rotate image
            (h, w) = image.shape[:2]
            center = (w // 2, h // 2)
            rotation_matrix = cv2.getRotationMatrix2D(center, rotation_angle, 1.0)
            rotated = cv2.warpAffine(
                image,
                rotation_matrix,
                (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE
            )

            return rotated, rotation_angle

        except Exception as e:
            logger.warning(f"Deskewing failed: {str(e)}")
            return image, 0.0

    def _remove_borders(self, image: np.ndarray) -> np.ndarray:
        """
        Remove scan borders and artifacts.

        Detects the main document region and crops out borders.

        Args:
            image: Grayscale image

        Returns:
            Image with borders removed
        """
        try:
            # Apply threshold to detect document
            _, thresh = cv2.threshold(
                image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
            )

            # Find contours
            contours, _ = cv2.findContours(
                thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )

            if not contours:
                return image

            # Find largest contour (assumed to be document)
            largest_contour = max(contours, key=cv2.contourArea)

            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(largest_contour)

            # Add small margin (2% of dimensions)
            margin_x = int(w * 0.02)
            margin_y = int(h * 0.02)

            x = max(0, x - margin_x)
            y = max(0, y - margin_y)
            w = min(image.shape[1] - x, w + 2 * margin_x)
            h = min(image.shape[0] - y, h + 2 * margin_y)

            # Crop image
            cropped = image[y:y+h, x:x+w]

            # Only use cropped version if it's significantly smaller
            original_area = image.shape[0] * image.shape[1]
            cropped_area = cropped.shape[0] * cropped.shape[1]

            if cropped_area > 0.5 * original_area:
                return cropped
            else:
                return image

        except Exception as e:
            logger.warning(f"Border removal failed: {str(e)}")
            return image

    def _enhance_contrast(self, image: np.ndarray) -> np.ndarray:
        """
        Enhance image contrast using CLAHE.

        CLAHE (Contrast Limited Adaptive Histogram Equalization)
        improves local contrast without over-amplifying noise.

        Args:
            image: Grayscale image

        Returns:
            Contrast-enhanced image
        """
        # Create CLAHE object
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

        # Apply CLAHE
        enhanced = clahe.apply(image)

        return enhanced

    def _adaptive_threshold(self, image: np.ndarray) -> np.ndarray:
        """
        Apply adaptive thresholding for binarization.

        Adaptive thresholding handles varying lighting conditions
        better than global thresholding.

        Args:
            image: Grayscale image

        Returns:
            Binarized image
        """
        # Apply adaptive Gaussian thresholding
        binary = cv2.adaptiveThreshold(
            image,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=11,
            C=2
        )

        return binary

    def _calculate_quality_metrics(self, image: np.ndarray) -> Dict[str, float]:
        """
        Calculate image quality metrics.

        Metrics include:
        - Sharpness (Laplacian variance)
        - Contrast (standard deviation)
        - Brightness (mean intensity)

        Args:
            image: Image to analyze

        Returns:
            Dictionary of quality metrics
        """
        try:
            # Convert to grayscale if needed
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image

            # Calculate sharpness using Laplacian variance
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            sharpness = laplacian.var()

            # Calculate contrast (standard deviation)
            contrast = gray.std()

            # Calculate brightness (mean intensity)
            brightness = gray.mean()

            # Detect blur using Laplacian
            blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
            is_blurry = blur_score < 100

            return {
                "sharpness": float(sharpness),
                "contrast": float(contrast),
                "brightness": float(brightness),
                "blur_score": float(blur_score),
                "is_blurry": is_blurry
            }

        except Exception as e:
            logger.warning(f"Quality metric calculation failed: {str(e)}")
            return {
                "sharpness": 0.0,
                "contrast": 0.0,
                "brightness": 0.0,
                "blur_score": 0.0,
                "is_blurry": True
            }

    def _should_use_original(
        self,
        original_quality: Dict[str, float],
        processed_quality: Dict[str, float]
    ) -> bool:
        """
        Determine whether to use original or processed image.

        Compares quality metrics and returns original if preprocessing
        degraded quality significantly.

        Args:
            original_quality: Quality metrics of original image
            processed_quality: Quality metrics of processed image

        Returns:
            True if original should be used, False if processed is better
        """
        # If original is very blurry, prefer processed
        if original_quality.get("is_blurry", False):
            return False

        # Compare sharpness
        original_sharpness = original_quality.get("sharpness", 0)
        processed_sharpness = processed_quality.get("sharpness", 0)

        # If processed image lost significant sharpness, use original
        if processed_sharpness < original_sharpness * self.quality_threshold:
            logger.info("Using original image due to sharpness degradation")
            return True

        # Compare contrast
        original_contrast = original_quality.get("contrast", 0)
        processed_contrast = processed_quality.get("contrast", 0)

        # If processed image lost significant contrast, use original
        if processed_contrast < original_contrast * self.quality_threshold:
            logger.info("Using original image due to contrast degradation")
            return True

        # Default to using processed image
        return False

    def save_image(self, image: np.ndarray, output_path: str) -> bool:
        """
        Save processed image to file.

        Args:
            image: Image array to save
            output_path: Path to save image

        Returns:
            True if save successful, False otherwise
        """
        try:
            cv2.imwrite(output_path, image)
            return True
        except Exception as e:
            logger.error(f"Failed to save image: {str(e)}")
            return False

    def image_to_bytes(self, image: np.ndarray, format: str = 'PNG') -> Optional[bytes]:
        """
        Convert image array to bytes for storage or transmission.

        Args:
            image: Image array
            format: Image format (PNG, JPEG, etc.)

        Returns:
            Image bytes or None if conversion fails
        """
        try:
            # Convert to PIL Image
            if len(image.shape) == 2:
                pil_image = Image.fromarray(image, mode='L')
            else:
                pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

            # Convert to bytes
            buffer = io.BytesIO()
            pil_image.save(buffer, format=format)
            return buffer.getvalue()

        except Exception as e:
            logger.error(f"Failed to convert image to bytes: {str(e)}")
            return None


def preprocess_document_image(
    image_path: str,
    **kwargs
) -> PreprocessingResult:
    """
    Convenience function for preprocessing a document image.

    Args:
        image_path: Path to image file
        **kwargs: Additional arguments for ImagePreprocessor

    Returns:
        PreprocessingResult with processed image and metadata
    """
    preprocessor = ImagePreprocessor(**kwargs)
    return preprocessor.process_image(image_path)
