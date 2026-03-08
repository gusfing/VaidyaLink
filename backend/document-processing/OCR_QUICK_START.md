# PaddleOCR Integration - Quick Start Guide

## Overview

This guide helps you quickly get started with the PaddleOCR integration for VaidyaLink document processing.

## Installation

### 1. Install Dependencies

```bash
cd backend/document-processing
pip install -r requirements.txt
```

### 2. Verify Installation

```python
python -c "from paddleocr import PaddleOCR; print('PaddleOCR installed successfully')"
```

## Basic Usage

### Extract Text from Image

```python
from ocr import create_ocr_extractor

# Create extractor with English and Hindi support
extractor = create_ocr_extractor(languages=['en', 'hi'])

# Load image
with open('prescription.jpg', 'rb') as f:
    image_data = f.read()

# Extract text
results = extractor.extract_text(image_data, language='en')

# Print results
for result in results:
    print(f"Text: {result.text}")
    print(f"Confidence: {result.confidence:.2%}")
    print(f"Position: {result.bounding_box.to_dict()}")
    print("---")
```

### Get Full Text

```python
# Combine all text regions into single string
full_text = extractor.get_full_text(results, min_confidence=0.5)
print(full_text)
```

### Check Confidence

```python
# Calculate average confidence
avg_confidence = extractor.get_average_confidence(results)
print(f"Average confidence: {avg_confidence:.2%}")

# Filter high-confidence results
high_conf = extractor.filter_by_confidence(results, min_confidence=0.80)
print(f"High confidence regions: {len(high_conf)}/{len(results)}")
```

## Lambda Integration

### Environment Variables

Set these in your Lambda configuration:

```bash
OCR_LANGUAGES=en,hi,ta,te
USE_GPU=false
CONFIDENCE_THRESHOLD=0.80
```

### Handler Code

```python
from ocr import create_ocr_extractor

# Global singleton for Lambda container reuse
ocr_extractor = None

def get_ocr_extractor():
    global ocr_extractor
    if ocr_extractor is None:
        languages = os.environ.get('OCR_LANGUAGES', 'en,hi').split(',')
        ocr_extractor = create_ocr_extractor(languages=languages)
    return ocr_extractor

def handler(event, context):
    # Get image from S3
    bucket = event['bucket']
    key = event['key']

    response = s3_client.get_object(Bucket=bucket, Key=key)
    image_data = response['Body'].read()

    # Extract text
    extractor = get_ocr_extractor()
    results = extractor.extract_text(image_data)

    # Process results
    full_text = extractor.get_full_text(results)
    avg_confidence = extractor.get_average_confidence(results)

    return {
        'text': full_text,
        'confidence': avg_confidence,
        'regions': len(results)
    }
```

## Supported Languages

### Primary Languages (Tier 1)

- **English** (en) - Default
- **Hindi** (hi) - Most common Indian language
- **Tamil** (ta) - South Indian
- **Telugu** (te) - South Indian
- **Bengali** (bn) - East Indian
- **Marathi** (mr) - West Indian
- **Gujarati** (gu) - West Indian
- **Kannada** (kn) - South Indian
- **Malayalam** (ml) - South Indian
- **Punjabi** (pa) - North Indian
- **Odia** (or) - East Indian
- **Assamese** (as) - Northeast Indian
- **Urdu** (ur) - North Indian
- **Sanskrit** (sa) - Classical

### Usage Example

```python
# Single language
extractor = create_ocr_extractor(languages=['hi'])
results = extractor.extract_text(image_data, language='hi')

# Multiple languages
extractor = create_ocr_extractor(languages=['en', 'hi', 'ta'])
results_by_lang = extractor.extract_text_multilingual(image_data)
```

## Configuration Options

### Detection Thresholds

```python
from ocr.paddle_ocr import PaddleOCRExtractor

extractor = PaddleOCRExtractor(
    languages=['en', 'hi'],
    use_gpu=False,
    use_angle_cls=True,        # Detect rotated text
    det_db_thresh=0.3,         # Detection threshold (lower = more sensitive)
    det_db_box_thresh=0.5,     # Box threshold (lower = more boxes)
    rec_batch_num=6            # Batch size for recognition
)
```

### GPU Acceleration

```python
# Enable GPU (requires CUDA-enabled Lambda)
extractor = create_ocr_extractor(
    languages=['en', 'hi'],
    use_gpu=True
)
```

## Testing

### Run Unit Tests

```bash
cd backend/document-processing
pytest src/__tests__/test_ocr.py -v
```

### Run Integration Tests

```bash
pytest src/__tests__/test_handler.py::TestExtractTextFromImage -v
```

### Test with Sample Image

```python
import sys
sys.path.insert(0, 'src')

from ocr import create_ocr_extractor
from PIL import Image
import io

# Create test image with text
img = Image.new('RGB', (400, 100), color='white')
# Add text using PIL ImageDraw if needed

# Convert to bytes
img_bytes = io.BytesIO()
img.save(img_bytes, format='PNG')
image_data = img_bytes.getvalue()

# Extract text
extractor = create_ocr_extractor(languages=['en'])
results = extractor.extract_text(image_data)

print(f"Extracted {len(results)} text regions")
for result in results:
    print(f"- {result.text} (confidence: {result.confidence:.2f})")
```

## Performance Tips

### 1. Use Singleton Pattern

```python
# Good: Reuse extractor across invocations
ocr_extractor = None

def get_ocr_extractor():
    global ocr_extractor
    if ocr_extractor is None:
        ocr_extractor = create_ocr_extractor()
    return ocr_extractor

# Bad: Create new extractor each time
def process_image(image_data):
    extractor = create_ocr_extractor()  # Slow!
    return extractor.extract_text(image_data)
```

### 2. Optimize Lambda Memory

- **Minimum**: 1024 MB (slow)
- **Recommended**: 2048 MB (balanced)
- **High-volume**: 3008 MB (fast)

### 3. Filter Low Confidence Early

```python
# Filter during extraction
results = extractor.extract_text(image_data)
high_conf = extractor.filter_by_confidence(results, 0.80)

# Use filtered results for downstream processing
full_text = extractor.get_full_text(high_conf)
```

### 4. Process Regions Selectively

```python
# Extract only header region
header_results = extractor.get_text_by_region(
    results,
    x_min=0, y_min=0,
    x_max=1000, y_max=200
)
```

## Troubleshooting

### Issue: "No module named 'paddleocr'"

**Solution**: Install dependencies

```bash
pip install paddleocr paddlepaddle
```

### Issue: Low accuracy on handwritten text

**Solution**:

1. Preprocess image (Task 8.3)
2. Use higher resolution images
3. Adjust detection thresholds
4. Route to HITL for manual verification

### Issue: Lambda timeout

**Solution**:

1. Increase Lambda timeout (max 900 seconds)
2. Increase memory allocation
3. Split large documents
4. Use provisioned concurrency

### Issue: High memory usage

**Solution**:

1. Increase Lambda memory
2. Process smaller images
3. Reduce batch size
4. Clear memory between invocations

## Next Steps

1. **Image Preprocessing** (Task 8.3): Enhance image quality before OCR
2. **Bedrock Integration** (Task 8.4): Structure extracted text into clinical fields
3. **Confidence Scoring** (Task 8.5): Advanced confidence calculation
4. **HITL Routing** (Task 8.6): Route low-confidence extractions for human review

## Resources

- [Full Documentation](./OCR_INTEGRATION.md)
- [Lambda Setup Guide](./LAMBDA_SETUP.md)
- [PaddleOCR GitHub](https://github.com/PaddlePaddle/PaddleOCR)
- [VaidyaLink Requirements](../../.kiro/specs/vaidyalink/requirements.md)

## Support

For issues or questions:

- Check CloudWatch Logs for errors
- Review [OCR_INTEGRATION.md](./OCR_INTEGRATION.md) for detailed troubleshooting
- Contact DevOps team for infrastructure support
