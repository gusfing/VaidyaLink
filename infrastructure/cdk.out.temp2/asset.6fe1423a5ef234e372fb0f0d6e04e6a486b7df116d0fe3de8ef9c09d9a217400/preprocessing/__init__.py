"""
Image preprocessing module for document OCR.

Provides comprehensive image enhancement pipeline to improve OCR accuracy
on medical documents with varying quality and conditions.
"""

from .image_processor import (
    ImagePreprocessor,
    PreprocessingResult,
    preprocess_document_image
)

__all__ = [
    'ImagePreprocessor',
    'PreprocessingResult',
    'preprocess_document_image'
]
