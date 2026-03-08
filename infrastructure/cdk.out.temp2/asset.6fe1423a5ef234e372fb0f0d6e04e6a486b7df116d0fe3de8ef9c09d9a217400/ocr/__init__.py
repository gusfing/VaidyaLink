"""
OCR Module for VaidyaLink Document Processing

This module provides text extraction capabilities using PaddleOCR
with support for multiple Indian languages.
"""

from .paddle_ocr import PaddleOCRExtractor, OCRResult, BoundingBox

__all__ = ['PaddleOCRExtractor', 'OCRResult', 'BoundingBox']
