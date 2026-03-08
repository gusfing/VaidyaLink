# Clinical Entity Extraction - Quick Start Guide

## Overview

The Clinical Entity Extractor uses Amazon Bedrock (Claude 3.5 Sonnet) to extract structured clinical information from voice transcriptions in 22 Indian languages.

## Features

- **Multilingual Support**: Processes transcriptions in English and 22 scheduled Indian languages
- **Comprehensive Entity Extraction**: Extracts symptoms, medications, allergies, vital signs, medical history, and more
- **Confidence Scoring**: Provides field-level and overall confidence scores
- **FHIR-Ready Output**: Structured data ready for FHIR transformation
- **Validation**: Built-in validation for medical data quality

## Quick Start

### 1. Installation

```bash
cd backend/voice-processing
npm install
```

### 2. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Configure Bedrock settings
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_REGION=us-east-1
BEDROCK_MAX_TOKENS=2048
BEDROCK_TEMPERATURE=0.1
```

### 3. Basic Usage

```javascript
const { createClinicalExtractor } = require('./utils/clinical-extractor');

// Create extractor instance
const extractor = createClinicalExtractor();

// Extract entities from transcription
const transcription = 'I have been having fever and headache for the past 3 days';
const result = await extractor.extractEntities(transcription, 'en');

console.log('Extracted entities:', result.entities);
console.log('Confidence scores:', result.confidence);
```

### 4. Example Output

```json
{
  "entities": {
    "chiefComplaint": "Fever and headache",
    "symptoms": [
      {
        "name": "Fever",
        "description": "High temperature",
        "location": null,
        "onset": "3 days ago"
      },
      {
        "name": "Headache",
        "description": "Severe pain",
        "location": "forehead",
        "onset": "3 days ago"
      }
    ],
    "duration": "3 days",
    "severity": "moderate",
    "currentMedications": [],
    "allergies": [],
    "vitalSigns": {}
  },
  "confidence": {
    "overall": 0.847,
    "byEntity": {
      "chiefComplaint": 0.92,
      "symptoms": 0.885,
      "duration": 0.78,
      "severity": 0.8
    }
  },
  "metadata": {
    "language": "en",
    "transcriptionLength": 58,
    "extractedAt": "2024-01-15T10:30:00.000Z",
    "modelId": "anthropic.claude-3-5-sonnet-20241022-v2:0"
  }
}
```

## Supported Entity Types

| Entity Type          | Description                     | Example                                                            |
| -------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `chiefComplaint`     | Primary reason for consultation | "Fever and cough"                                                  |
| `symptoms`           | List of symptoms with details   | [{ name: "Fever", description: "High temperature" }]               |
| `duration`           | How long symptoms present       | "3 days"                                                           |
| `severity`           | Mild, moderate, or severe       | "moderate"                                                         |
| `previousTreatments` | Past treatments tried           | [{ treatment: "Paracetamol", outcome: "Temporary relief" }]        |
| `allergies`          | Known allergies                 | [{ allergen: "Penicillin", reaction: "Rash" }]                     |
| `medicalHistory`     | Past conditions                 | [{ condition: "Diabetes", status: "chronic" }]                     |
| `currentMedications` | Current medications             | [{ name: "Metformin", dosage: "500mg", frequency: "twice daily" }] |
| `vitalSigns`         | Vital sign measurements         | { bloodPressure: "120/80", pulse: "72" }                           |
| `familyHistory`      | Family medical history          | [{ relation: "father", condition: "Hypertension" }]                |
| `lifestyle`          | Lifestyle factors               | { smoking: "no", alcohol: "occasional" }                           |
| `additionalNotes`    | Other relevant information      | "Patient appears anxious"                                          |

## Multilingual Support

### Supported Languages

The extractor supports all 22 scheduled Indian languages:

- English (en)
- Hindi (hi)
- Bengali (bn)
- Telugu (te)
- Marathi (mr)
- Tamil (ta)
- Gujarati (gu)
- Kannada (kn)
- Malayalam (ml)
- Punjabi (pa)
- Odia (or)
- Assamese (as)
- Urdu (ur)
- Sanskrit (sa)
- Kashmiri (ks)
- Sindhi (sd)
- Nepali (ne)
- Konkani (kok)
- Maithili (mai)
- Bodo (bodo)
- Dogri (doi)
- Manipuri (mni)

### Example: Hindi Transcription

```javascript
const transcription = 'मुझे तीन दिन से बुखार और सिरदर्द है';
const result = await extractor.extractEntities(transcription, 'hi');

// Output will be in English for FHIR compatibility
console.log(result.entities.chiefComplaint); // "Fever and headache"
```

## Confidence Scoring

### Understanding Confidence Scores

- **Overall Confidence**: Average confidence across all extracted entities
- **Entity-Level Confidence**: Individual confidence for each field
- **Range**: 0.0 (no confidence) to 1.0 (high confidence)

### Confidence Thresholds

```javascript
const { confidence } = result;

if (confidence.overall >= 0.8) {
  console.log('High confidence - auto-process');
} else if (confidence.overall >= 0.6) {
  console.log('Medium confidence - review recommended');
} else {
  console.log('Low confidence - human verification required');
}
```

### Language Impact

Non-English languages have a 5% confidence reduction to account for translation uncertainty:

```javascript
// English transcription
const enResult = await extractor.extractEntities('Fever for 3 days', 'en');
console.log(enResult.confidence.overall); // e.g., 0.850

// Hindi transcription
const hiResult = await extractor.extractEntities('तीन दिन से बुखार', 'hi');
console.log(hiResult.confidence.overall); // e.g., 0.807 (5% lower)
```

## Validation

### Validate Extracted Entities

```javascript
const validation = extractor.validateEntities(result.entities);

if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}

if (validation.warnings.length > 0) {
  console.warn('Validation warnings:', validation.warnings);
}
```

### Validation Rules

- **Severity**: Must be "mild", "moderate", or "severe"
- **Medications**: Must have a name field
- **Vital Signs**: Checks for unusual values (e.g., pulse < 40 or > 200)
- **Oxygen Saturation**: Must be between 70-100%

## Integration with Lambda Handler

```javascript
// In your Lambda handler
const { createClinicalExtractor } = require('./utils/clinical-extractor');

exports.handler = async (event) => {
  const extractor = createClinicalExtractor();

  const { transcription, language } = JSON.parse(event.body);

  try {
    // Extract clinical entities
    const result = await extractor.extractEntities(transcription, language);

    // Validate entities
    const validation = extractor.validateEntities(result.entities);

    if (!validation.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Validation failed',
          details: validation.errors,
        }),
      };
    }

    // Return structured data
    return {
      statusCode: 200,
      body: JSON.stringify({
        entities: result.entities,
        confidence: result.confidence,
        validation: validation.warnings,
      }),
    };
  } catch (error) {
    console.error('Extraction error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

## Testing

### Run Unit Tests

```bash
npm test -- clinical-extractor.test.js
```

### Test Coverage

The test suite covers:

- ✅ Entity extraction from English transcriptions
- ✅ Multilingual support (Hindi, Bengali, etc.)
- ✅ Medication extraction with dosage
- ✅ Vital signs extraction
- ✅ Allergy extraction
- ✅ Confidence score calculation
- ✅ Validation rules
- ✅ Error handling
- ✅ Markdown response parsing

## Performance Considerations

### Latency

- **Average extraction time**: 2-4 seconds
- **Bedrock API call**: 1.5-3 seconds
- **Parsing and validation**: < 0.5 seconds

### Cost Optimization

```javascript
// Use lower max tokens for simple transcriptions
const extractor = createClinicalExtractor({
  maxTokens: 1024, // Reduces cost for short transcriptions
});

// Use higher temperature for creative extraction (not recommended for medical)
const extractor = createClinicalExtractor({
  temperature: 0.1, // Keep low for consistent medical extraction
});
```

### Caching

Consider caching results for identical transcriptions:

```javascript
const cache = new Map();

async function extractWithCache(transcription, language) {
  const cacheKey = `${language}:${transcription}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const result = await extractor.extractEntities(transcription, language);
  cache.set(cacheKey, result);

  return result;
}
```

## Error Handling

### Common Errors

```javascript
try {
  const result = await extractor.extractEntities(transcription, language);
} catch (error) {
  if (error.message.includes('Transcription text is required')) {
    // Handle empty input
  } else if (error.message.includes('Bedrock API error')) {
    // Handle Bedrock service errors
  } else if (error.message.includes('Failed to parse')) {
    // Handle JSON parsing errors
  } else {
    // Handle unexpected errors
  }
}
```

### Retry Logic

```javascript
async function extractWithRetry(transcription, language, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await extractor.extractEntities(transcription, language);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      console.log(`Retry attempt ${attempt} after error:`, error.message);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

## Best Practices

1. **Always validate extracted entities** before storing in database
2. **Use appropriate confidence thresholds** for your use case
3. **Handle multilingual input** by detecting language first
4. **Log extraction failures** for debugging and improvement
5. **Monitor Bedrock costs** and optimize token usage
6. **Cache results** for identical transcriptions
7. **Implement retry logic** for transient failures
8. **Sanitize input** before sending to Bedrock

## Troubleshooting

### Issue: Low confidence scores

**Solution**: Check transcription quality and language detection

```javascript
if (result.confidence.overall < 0.6) {
  console.log('Low confidence - possible causes:');
  console.log('- Poor audio quality');
  console.log('- Incorrect language detection');
  console.log('- Ambiguous medical terminology');
  console.log('- Code-mixed speech');
}
```

### Issue: Missing entities

**Solution**: Verify entities are explicitly mentioned in transcription

```javascript
// The extractor only extracts explicitly mentioned information
const transcription = 'I have fever'; // ✅ Will extract fever
const transcription = "I'm not feeling well"; // ❌ Too vague
```

### Issue: Bedrock timeout

**Solution**: Increase timeout or reduce max tokens

```javascript
const extractor = createClinicalExtractor({
  maxTokens: 1024, // Reduce from 2048
  timeout: 30000, // 30 seconds
});
```

## Next Steps

- See [CLINICAL_EXTRACTION.md](./CLINICAL_EXTRACTION.md) for detailed documentation
- Review [Voice Processing Integration](./README.md) for full workflow
- Check [FHIR Transformation](../fhir-transformer/README.md) for next steps

## Support

For issues or questions:

- Check test files for usage examples
- Review CloudWatch logs for runtime errors
- Consult AWS Bedrock documentation for API limits
