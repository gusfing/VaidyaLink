#!/bin/bash

# Package Document Processor Lambda for deployment
# This script creates a deployment package with dependencies

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}[INFO]${NC} Packaging document processor Lambda..."

# Create build directory
BUILD_DIR="build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Install dependencies
echo -e "${GREEN}[INFO]${NC} Installing dependencies..."
pip install -r requirements.txt -t "$BUILD_DIR"

# Copy source code
echo -e "${GREEN}[INFO]${NC} Copying source code..."
cp src/index.py "$BUILD_DIR/"

# Create deployment package
echo -e "${GREEN}[INFO]${NC} Creating deployment package..."
cd "$BUILD_DIR"
zip -r ../document-processor-lambda.zip . -q
cd ..

# Get package size
SIZE=$(du -h document-processor-lambda.zip | cut -f1)

echo -e "${GREEN}[INFO]${NC} Package created: document-processor-lambda.zip ($SIZE)"
echo -e "${YELLOW}[NOTE]${NC} Upload this package to AWS Lambda or use CDK to deploy"
