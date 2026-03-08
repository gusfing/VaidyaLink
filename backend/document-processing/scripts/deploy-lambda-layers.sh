#!/bin/bash

# Script to deploy Lambda layers to AWS
# Run this after create-lambda-layers.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LAYERS_DIR="$PROJECT_DIR/layers"

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
LAYER_PREFIX="vaidyalink"
RUNTIME="python3.11"

echo "Deploying Lambda layers to AWS..."
echo "Region: $AWS_REGION"
echo "Layer prefix: $LAYER_PREFIX"
echo "Runtime: $RUNTIME"
echo ""

# Check if layers exist
if [ ! -d "$LAYERS_DIR" ]; then
    echo "Error: Layers directory not found. Run create-lambda-layers.sh first."
    exit 1
fi

# Function to deploy a layer
deploy_layer() {
    local layer_name=$1
    local zip_file=$2
    local description=$3

    echo "========================================="
    echo "Deploying $layer_name..."
    echo "========================================="

    if [ ! -f "$zip_file" ]; then
        echo "Error: Layer zip file not found: $zip_file"
        return 1
    fi

    # Publish layer version
    local response=$(aws lambda publish-layer-version \
        --layer-name "$layer_name" \
        --description "$description" \
        --zip-file "fileb://$zip_file" \
        --compatible-runtimes "$RUNTIME" \
        --region "$AWS_REGION" \
        --output json)

    # Extract layer version ARN
    local layer_arn=$(echo "$response" | jq -r '.LayerVersionArn')
    local version=$(echo "$response" | jq -r '.Version')

    echo "✅ Layer deployed successfully!"
    echo "   ARN: $layer_arn"
    echo "   Version: $version"
    echo ""

    # Store ARN for later use
    echo "$layer_arn" > "$LAYERS_DIR/${layer_name}-arn.txt"
}

# Deploy layers
deploy_layer \
    "${LAYER_PREFIX}-aws-sdk" \
    "$LAYERS_DIR/aws-sdk-layer.zip" \
    "AWS SDK (boto3, botocore) for VaidyaLink"

deploy_layer \
    "${LAYER_PREFIX}-image-processing" \
    "$LAYERS_DIR/image-processing-layer.zip" \
    "Image processing libraries (Pillow, OpenCV, NumPy) for VaidyaLink"

deploy_layer \
    "${LAYER_PREFIX}-paddleocr" \
    "$LAYERS_DIR/paddleocr-layer.zip" \
    "PaddleOCR and PaddlePaddle for VaidyaLink"

deploy_layer \
    "${LAYER_PREFIX}-utilities" \
    "$LAYERS_DIR/utilities-layer.zip" \
    "Utility libraries (dotenv, anthropic, xray) for VaidyaLink"

echo "========================================="
echo "All layers deployed successfully!"
echo "========================================="
echo ""
echo "Layer ARNs saved to:"
ls -1 "$LAYERS_DIR"/*-arn.txt

echo ""
echo "Next steps:"
echo "1. Update your CDK/CloudFormation to use these layer ARNs"
echo "2. Remove layer dependencies from requirements.txt"
echo "3. Redeploy Lambda function"
echo ""
echo "Example CDK code:"
echo ""
cat << 'EOF'
const awsSdkLayer = lambda.LayerVersion.fromLayerVersionArn(
  this,
  'AwsSdkLayer',
  'arn:aws:lambda:us-east-1:123456789012:layer:vaidyalink-aws-sdk:1'
);

const documentProcessingLambda = new lambda.Function(this, 'DocumentProcessing', {
  // ... other config
  layers: [
    awsSdkLayer,
    imageProcessingLayer,
    paddleOcrLayer,
    utilitiesLayer
  ],
});
EOF

echo ""
echo "To get layer ARNs programmatically:"
echo "  cat $LAYERS_DIR/vaidyalink-aws-sdk-arn.txt"
