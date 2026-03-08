#!/bin/bash

# Script to create Lambda layers for Document Processing Lambda
# This reduces deployment package size and improves cold start performance

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LAYERS_DIR="$PROJECT_DIR/layers"

echo "Creating Lambda layers for Document Processing..."
echo "Project directory: $PROJECT_DIR"

# Clean up existing layers
echo "Cleaning up existing layers..."
rm -rf "$LAYERS_DIR"
mkdir -p "$LAYERS_DIR"

# Create layer directories
mkdir -p "$LAYERS_DIR/aws-sdk/python"
mkdir -p "$LAYERS_DIR/image-processing/python"
mkdir -p "$LAYERS_DIR/paddleocr/python"

# Function to create a layer
create_layer() {
    local layer_name=$1
    local layer_dir=$2
    shift 2
    local packages=("$@")

    echo ""
    echo "========================================="
    echo "Creating $layer_name layer..."
    echo "========================================="

    # Install packages
    echo "Installing packages: ${packages[*]}"
    pip install --target "$layer_dir/python" --upgrade "${packages[@]}"

    # Create zip file
    local zip_file="$LAYERS_DIR/${layer_name}-layer.zip"
    echo "Creating zip file: $zip_file"
    cd "$layer_dir"
    zip -r "$zip_file" python -q

    # Get size
    local size=$(du -h "$zip_file" | cut -f1)
    echo "Layer size: $size"

    cd "$PROJECT_DIR"
}

# Layer 1: AWS SDK Layer
create_layer "aws-sdk" "$LAYERS_DIR/aws-sdk" \
    "boto3>=1.34.0" \
    "botocore>=1.34.0"

# Layer 2: Image Processing Layer
create_layer "image-processing" "$LAYERS_DIR/image-processing" \
    "Pillow>=10.1.0" \
    "opencv-python-headless>=4.8.0" \
    "numpy>=1.24.0"

# Layer 3: PaddleOCR Layer
create_layer "paddleocr" "$LAYERS_DIR/paddleocr" \
    "paddleocr>=2.7.0" \
    "paddlepaddle>=2.5.0"

# Layer 4: Utilities Layer (optional - for smaller dependencies)
create_layer "utilities" "$LAYERS_DIR/utilities" \
    "python-dotenv>=1.0.0" \
    "anthropic>=0.8.0" \
    "aws-xray-sdk>=2.12.0"

echo ""
echo "========================================="
echo "Layer creation complete!"
echo "========================================="
echo ""
echo "Layer files created:"
ls -lh "$LAYERS_DIR"/*.zip

echo ""
echo "Next steps:"
echo "1. Deploy layers to AWS Lambda:"
echo "   aws lambda publish-layer-version \\"
echo "     --layer-name vaidyalink-aws-sdk \\"
echo "     --zip-file fileb://$LAYERS_DIR/aws-sdk-layer.zip \\"
echo "     --compatible-runtimes python3.11"
echo ""
echo "2. Update Lambda function to use layers in CDK/CloudFormation"
echo "3. Remove layer dependencies from requirements.txt"
echo "4. Redeploy Lambda function with smaller deployment package"
echo ""
echo "For automated deployment, run:"
echo "  ./scripts/deploy-lambda-layers.sh"
