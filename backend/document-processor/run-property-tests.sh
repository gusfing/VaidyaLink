#!/bin/bash
# Run property-based tests for document processor

set -e

echo "Running property-based tests for entity extraction..."
echo "=================================================="

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    exit 1
fi

# Check if pytest is installed
if ! python3 -c "import pytest" &> /dev/null; then
    echo "Installing test dependencies..."
    pip install -r requirements.txt
fi

# Run the property tests
echo ""
echo "Running Property 5: Entity Confidence Scores"
echo "Running Property 6: Medication Structure Completeness"
echo "Running Property 7: Lab Result Structure Completeness"
echo ""

python3 -m pytest src/__properties__/entity_extraction.properties.test.py \
    -v \
    --tb=short \
    --hypothesis-max-examples=100 \
    -m property

echo ""
echo "=================================================="
echo "Property tests completed successfully!"
