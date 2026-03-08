# Clinical Entity Extraction with Amazon Bedrock

## Overview

The Clinical Entity Extraction module is a core component of VaidyaLink's voice processing pipeline. It transforms unstructured voice transcriptions into structured clinical data using Amazon Bedrock's Claude 3.5 Sonnet model. The module supports multilingual input from 22 Indian languages and generates FHIR-ready structured output with confidence scores.

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Voice Processing Lambda                     │
│                                                              │
│  ┌────────────────┐      ┌──────────────────┐              │
│  │   Bhashini     │─────▶│  Transcription   │              │
│  │   API Client   │      │     Text         │              │
│  └────────────────┘      └──────────────────┘              │
│                                   │                          │
│                                   ▼                          │
│                    ┌──────────────────────────┐             │
│                    │  Clinical Extractor      │             │
│                    │  (Bedrock Integration)   │             │
│                    └──────────────────────────┘             │
│                                   │                          │
│                    ┌──────────────┴──────────────┐          │
│                    │                             │          │
│                    ▼                             ▼          │
│         ┌──────────────────┐         ┌──────────────────┐  │
│         │  Structured      │         │  Confidence      │  │
│         │  Clinical Data   │         │  Scores          │  │
│         └──────────────────┘         └──────────────────┘  │
│                    │                             │          │
│                    └──────────────┬──────────────┘          │
│                                   ▼                          │
│                         ┌──────────────────┐                │
│                         │   Validation     │                │
│                         └──────────────────┘                │
│                                   │                          │
└───────────────────────────────────┼──────────────────────────┘
                                    ▼
                         ┌──────────────────┐
                         │ FHIR Transformer │
                         │     Lambda       │
                         └──────────────────┘
```

### Data Flow

1. **Input**: Voice transcription text from Bhashini API
2. **Prompt Construction**: Build extraction prompt with language context
3. **Bedrock Invocation**: Call Claude 3.5 Sonnet with structured prompt
4. **Response Parsing**: Extract JSON from Bedrock response
5. **Normalization**: Ensure consistent data structure
6. **Confidence Calculation**: Compute field-level and overall confidence
7. **Validation**: Apply business rules and medical constraints
8. **Output**: Structured clinical data ready for FHIR transformation

## Implementation Details

### Core Class: ClinicalExtractor

```javascript
class ClinicalExtractor {
  constructor(options = {}) {
    this.modelId = options.modelId || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    this.region = options.region || 'us-east-1';
    this.maxTokens = options.maxTokens || 2048;
    this.temperature = options.temperature || 0.1;
    this.bedrockClient = new BedrockRuntimeClient({ region: this.region });
  }

  async extractEntities(transcription, language, context) {
    // Main extraction logic
  }
}
```

### Key Methods

#### 1. extractEntities()

Main entry point for clinical entity extraction.

**Parameters:**

- `transcription` (string): Voice transcription text
- `language` (string): ISO 639-1 language code (e.g., 'en', 'hi')
- `context` (object, optional): Additional context for extraction

**Returns:**

```javascript
{
  entities: {
    chiefComplaint: string | null,
    symptoms: Array<Symptom>,
    duration: string | null,
    severity: 'mild' | 'moderate' | 'severe' | null,
    previousTreatments: Array<Treatment>,
    allergies: Array<Allergy>,
    medicalHistory: Array<Condition>,
    currentMedications: Array<Medication>,
    vitalSigns: VitalSigns,
    familyHistory: Array<FamilyCondition>,
    lifestyle: Lifestyle,
    additionalNotes: string | null
  },
  confidence: {
    overall: number,
    byEntity: Record<string, number>
  },
  metadata: {
    language: string,
    transcriptionLength: number,
    extractedAt: string,
    modelId: string
  }
}
```

#### 2. validateEntities()

Validates extracted entities against business rules.

**Parameters:**

- `entities` (object): Extracted clinical entities

**Returns:**

```javascript
{
  isValid: boolean,
  errors: Array<string>,
  warnings: Array<string>
}
```

### Prompt Engineering

The extraction prompt is carefully engineered to:

1. **Specify Output Format**: JSON schema with all entity types
2. **Handle Multilingual Input**: Explicit language context
3. **Preserve Medical Terminology**: Avoid over-simplification
4. **Extract Only Explicit Information**: No assumptions or inferences
5. **Include Descriptive Details**: Capture context and nuances

#### Prompt Template

```
You are a medical AI assistant specialized in extracting structured clinical
information from patient voice recordings. Extract clinical entities from the
following patient transcription.

Language: {language}
Note: The transcription is in {language_name}. Extract information and respond
in English.

Transcription: "{transcription}"

Extract the following clinical information if explicitly mentioned:

1. Chief Complaint: Primary reason for consultation
2. Symptoms: List of symptoms with descriptions
3. Duration: How long symptoms have been present
4. Severity: Mild, moderate, or severe
5. Previous Treatments: Past treatments or medications tried
6. Allergies: Known allergies (medications, food, environmental)
7. Medical History: Past medical conditions or surgeries
8. Current Medications: Medications currently taking
9. Vital Signs: Any mentioned vital signs (BP, temperature, pulse, etc.)
10. Family History: Relevant family medical history
11. Lifestyle: Smoking, alcohol, diet, exercise habits
12. Additional Notes: Any other relevant clinical information

Important Guidelines:
- Only extract information explicitly mentioned in the transcription
- Use null for missing fields and empty arrays for missing lists
- Preserve medical terminology when possible
- For medications, include dosage and frequency if mentioned
- For symptoms, include descriptive details
- Be precise and avoid assumptions
- Handle multilingual medical terms appropriately

Respond in JSON format: {...}

Respond with ONLY the JSON object, no additional text.
```

### Confidence Scoring Algorithm

The confidence scoring algorithm considers multiple factors:

#### 1. Base Confidence by Data Type

- **Null/Undefined**: 0.0
- **Empty Arrays**: 0.0
- **Populated Arrays**: 0.7 + (average item richness / 100)
- **Objects**: 0.6 + (populated fields / total fields) \* 0.3
- **Strings**: 0.5 + (length score) + (presence in transcription score)

#### 2. Language Multiplier

- **English**: 1.0 (no adjustment)
- **Non-English**: 0.95 (5% reduction for translation uncertainty)

#### 3. Item Richness Score

For array items (symptoms, medications, etc.):

```javascript
const avgItemLength =
  items.reduce((sum, item) => {
    const itemStr = typeof item === 'object' ? JSON.stringify(item) : String(item);
    return sum + itemStr.length;
  }, 0) / items.length;

const baseScore = Math.min(0.7 + avgItemLength / 100, 0.95);
```

#### 4. String Presence Score

For string fields:

```javascript
const presenceScore = transcriptionLower.includes(value.toLowerCase()) ? 0.2 : 0.0;
const lengthScore = Math.min(valueLength / 50, 0.7);
const baseScore = 0.5 + lengthScore + presenceScore;
```

#### 5. Overall Confidence

```javascript
const validScores = Object.values(scores).filter((score) => score > 0);
const overallConfidence =
  validScores.length > 0
    ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
    : 0.0;
```

### Validation Rules

#### Severity Validation

```javascript
const SEVERITY_LEVELS = ['mild', 'moderate', 'severe'];

if (entities.severity && !SEVERITY_LEVELS.includes(entities.severity)) {
  errors.push(`Invalid severity level: ${entities.severity}`);
}
```

#### Medication Validation

```javascript
entities.currentMedications.forEach((med, index) => {
  if (!med.name) {
    warnings.push(`Medication at index ${index} missing name`);
  }
});
```

#### Vital Signs Validation

```javascript
// Pulse validation
if (pulse) {
  const pulseNum = parseInt(pulse);
  if (pulseNum < 40 || pulseNum > 200) {
    warnings.push(`Unusual pulse value: ${pulse}`);
  }
}

// Oxygen saturation validation
if (oxygenSaturation) {
  const spo2 = parseInt(oxygenSaturation);
  if (spo2 < 70 || spo2 > 100) {
    warnings.push(`Unusual oxygen saturation: ${oxygenSaturation}`);
  }
}
```

## Entity Types

### 1. Chief Complaint

Primary reason for medical consultation.

**Type**: `string | null`

**Example**:

```json
"chiefComplaint": "Fever and headache for 3 days"
```

### 2. Symptoms

List of symptoms with detailed descriptions.

**Type**: `Array<Symptom>`

**Symptom Structure**:

```typescript
interface Symptom {
  name: string;
  description: string;
  location?: string;
  onset?: string;
}
```

**Example**:

```json
"symptoms": [
  {
    "name": "Fever",
    "description": "High temperature with chills",
    "location": null,
    "onset": "3 days ago"
  },
  {
    "name": "Headache",
    "description": "Throbbing pain",
    "location": "forehead",
    "onset": "2 days ago"
  }
]
```

### 3. Duration

How long symptoms have been present.

**Type**: `string | null`

**Example**:

```json
"duration": "3 days"
```

### 4. Severity

Severity level of symptoms.

**Type**: `'mild' | 'moderate' | 'severe' | null`

**Example**:

```json
"severity": "moderate"
```

### 5. Previous Treatments

Past treatments or medications tried.

**Type**: `Array<Treatment>`

**Treatment Structure**:

```typescript
interface Treatment {
  treatment: string;
  outcome?: string;
}
```

**Example**:

```json
"previousTreatments": [
  {
    "treatment": "Paracetamol 500mg",
    "outcome": "Temporary relief for 4-6 hours"
  }
]
```

### 6. Allergies

Known allergies to medications, food, or environmental factors.

**Type**: `Array<Allergy>`

**Allergy Structure**:

```typescript
interface Allergy {
  allergen: string;
  reaction: string;
}
```

**Example**:

```json
"allergies": [
  {
    "allergen": "Penicillin",
    "reaction": "Rash and itching"
  },
  {
    "allergen": "Peanuts",
    "reaction": "Anaphylaxis"
  }
]
```

### 7. Medical History

Past medical conditions or surgeries.

**Type**: `Array<Condition>`

**Condition Structure**:

```typescript
interface Condition {
  condition: string;
  diagnosedDate?: string;
  status: 'active' | 'resolved' | 'chronic';
}
```

**Example**:

```json
"medicalHistory": [
  {
    "condition": "Type 2 Diabetes",
    "diagnosedDate": "2020",
    "status": "chronic"
  },
  {
    "condition": "Appendectomy",
    "diagnosedDate": "2015",
    "status": "resolved"
  }
]
```

### 8. Current Medications

Medications currently being taken.

**Type**: `Array<Medication>`

**Medication Structure**:

```typescript
interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
}
```

**Example**:

```json
"currentMedications": [
  {
    "name": "Metformin",
    "dosage": "500mg tablet",
    "frequency": "twice daily after meals",
    "duration": "ongoing"
  },
  {
    "name": "Lisinopril",
    "dosage": "10mg tablet",
    "frequency": "once daily in the morning",
    "duration": "ongoing"
  }
]
```

### 9. Vital Signs

Measured vital signs.

**Type**: `VitalSigns`

**VitalSigns Structure**:

```typescript
interface VitalSigns {
  bloodPressure?: string;
  temperature?: string;
  pulse?: string;
  respiratoryRate?: string;
  oxygenSaturation?: string;
  weight?: string;
  height?: string;
}
```

**Example**:

```json
"vitalSigns": {
  "bloodPressure": "140/90",
  "temperature": "101.5°F",
  "pulse": "88",
  "respiratoryRate": null,
  "oxygenSaturation": "97%",
  "weight": "75kg",
  "height": null
}
```

### 10. Family History

Relevant family medical history.

**Type**: `Array<FamilyCondition>`

**FamilyCondition Structure**:

```typescript
interface FamilyCondition {
  relation: string;
  condition: string;
}
```

**Example**:

```json
"familyHistory": [
  {
    "relation": "father",
    "condition": "Hypertension"
  },
  {
    "relation": "mother",
    "condition": "Type 2 Diabetes"
  }
]
```

### 11. Lifestyle

Lifestyle factors affecting health.

**Type**: `Lifestyle`

**Lifestyle Structure**:

```typescript
interface Lifestyle {
  smoking?: 'yes' | 'no' | 'former' | null;
  alcohol?: 'yes' | 'no' | 'occasional' | null;
  exercise?: string | null;
  diet?: string | null;
}
```

**Example**:

```json
"lifestyle": {
  "smoking": "no",
  "alcohol": "occasional",
  "exercise": "walks 30 minutes daily",
  "diet": "vegetarian"
}
```

### 12. Additional Notes

Any other relevant clinical information.

**Type**: `string | null`

**Example**:

```json
"additionalNotes": "Patient appears anxious and reports difficulty sleeping"
```

## Multilingual Support

### Language Detection

The extractor relies on upstream language detection from the Bhashini integration:

```javascript
const { detectLanguage } = require('./language-detector');

const detectedLanguage = await detectLanguage(audioBuffer);
const result = await extractor.extractEntities(transcription, detectedLanguage);
```

### Supported Languages

All 22 scheduled Indian languages per the Indian Constitution:

| Code | Language  | Native Name |
| ---- | --------- | ----------- |
| en   | English   | English     |
| hi   | Hindi     | हिन्दी      |
| bn   | Bengali   | বাংলা       |
| te   | Telugu    | తెలుగు      |
| mr   | Marathi   | मराठी       |
| ta   | Tamil     | தமிழ்       |
| gu   | Gujarati  | ગુજરાતી     |
| kn   | Kannada   | ಕನ್ನಡ       |
| ml   | Malayalam | മലയാളം      |
| pa   | Punjabi   | ਪੰਜਾਬੀ      |
| or   | Odia      | ଓଡ଼ିଆ       |
| as   | Assamese  | অসমীয়া     |
| ur   | Urdu      | اردو        |
| sa   | Sanskrit  | संस्कृतम्   |
| ks   | Kashmiri  | कॉशुर       |
| sd   | Sindhi    | سنڌي        |
| ne   | Nepali    | नेपाली      |
| kok  | Konkani   | कोंकणी      |
| mai  | Maithili  | मैथिली      |
| bodo | Bodo      | बड़ो        |
| doi  | Dogri     | डोगरी       |
| mni  | Manipuri  | মৈতৈলোন্    |

### Translation Strategy

The extractor uses a "translate-to-English" strategy:

1. **Input**: Transcription in any supported language
2. **Prompt**: Instructs model to extract and respond in English
3. **Output**: Structured data in English for FHIR compatibility
4. **Confidence**: Adjusted for non-English languages (0.95x multiplier)

### Code-Mixed Speech

The extractor handles code-mixed speech (e.g., Hindi-English):

```javascript
// Example: Hindi-English code-mixed transcription
const transcription = 'मुझे fever है और headache भी है';
const result = await extractor.extractEntities(transcription, 'hi');

// Output will correctly extract both Hindi and English terms
console.log(result.entities.symptoms);
// [{ name: "Fever", ... }, { name: "Headache", ... }]
```

## Performance Optimization

### Latency Breakdown

| Operation              | Average Time | Optimization             |
| ---------------------- | ------------ | ------------------------ |
| Prompt construction    | 10-20ms      | Minimal - template-based |
| Bedrock API call       | 1.5-3s       | Use on-demand pricing    |
| Response parsing       | 50-100ms     | Efficient JSON parsing   |
| Confidence calculation | 20-50ms      | Optimized algorithms     |
| Validation             | 10-20ms      | Rule-based checks        |
| **Total**              | **2-4s**     |                          |

### Cost Optimization

#### Token Usage

```javascript
// Typical token usage per extraction
const inputTokens = 800 - 1200; // Prompt + transcription
const outputTokens = 400 - 800; // Structured JSON response

// Cost calculation (Claude 3.5 Sonnet on-demand)
const inputCost = (inputTokens * 0.003) / 1000; // $0.003 per 1K tokens
const outputCost = (outputTokens * 0.015) / 1000; // $0.015 per 1K tokens
const totalCost = inputCost + outputCost; // ~$0.015 per extraction
```

#### Optimization Strategies

1. **Reduce Max Tokens**: Use 1024 for short transcriptions
2. **Batch Processing**: Process multiple transcriptions in parallel
3. **Caching**: Cache results for identical transcriptions
4. **Prompt Optimization**: Minimize prompt length while maintaining quality

### Concurrency

The extractor supports concurrent processing:

```javascript
const transcriptions = [
  { text: 'Fever for 3 days', language: 'en' },
  { text: 'पेट में दर्द', language: 'hi' },
  { text: 'தலைவலி', language: 'ta' },
];

const results = await Promise.all(
  transcriptions.map(({ text, language }) => extractor.extractEntities(text, language))
);
```

## Error Handling

### Error Types

#### 1. Input Validation Errors

```javascript
// Empty transcription
await extractor.extractEntities('', 'en');
// Error: Transcription text is required
```

#### 2. Bedrock API Errors

```javascript
// Bedrock service unavailable
await extractor.extractEntities(transcription, 'en');
// Error: Clinical entity extraction failed: Bedrock API error: Service unavailable
```

#### 3. Parsing Errors

```javascript
// Invalid JSON response from Bedrock
await extractor.extractEntities(transcription, 'en');
// Error: Clinical entity extraction failed: Failed to parse Bedrock response: Unexpected token
```

### Retry Strategy

Implement exponential backoff for transient failures:

```javascript
async function extractWithRetry(transcription, language, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await extractor.extractEntities(transcription, language);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const isRetryable =
        error.message.includes('Bedrock API error') || error.message.includes('timeout');

      if (!isRetryable) throw error;

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
```

## Integration Points

### 1. Voice Processing Lambda

```javascript
// In voice-processing Lambda handler
const { createClinicalExtractor } = require('./utils/clinical-extractor');
const { transcribeAudio } = require('./utils/bhashini-client');

exports.handler = async (event) => {
  const { audioS3Key, language } = event;

  // Step 1: Transcribe audio
  const transcription = await transcribeAudio(audioS3Key, language);

  // Step 2: Extract clinical entities
  const extractor = createClinicalExtractor();
  const result = await extractor.extractEntities(transcription.text, transcription.language);

  // Step 3: Validate
  const validation = extractor.validateEntities(result.entities);

  // Step 4: Store and forward to FHIR transformer
  return {
    transcription: transcription.text,
    entities: result.entities,
    confidence: result.confidence,
    validation,
  };
};
```

### 2. FHIR Transformer Lambda

The extracted entities are passed to the FHIR Transformer:

```javascript
// Invoke FHIR Transformer with extracted entities
const lambda = new LambdaClient({ region: process.env.AWS_REGION });

await lambda.send(
  new InvokeCommand({
    FunctionName: process.env.FHIR_TRANSFORMER_LAMBDA_ARN,
    InvocationType: 'Event',
    Payload: JSON.stringify({
      patientId: event.patientId,
      voiceJobId: event.jobId,
      clinicalData: result.entities,
      confidence: result.confidence,
      source: 'voice-recording',
    }),
  })
);
```

### 3. DynamoDB Storage

Store extraction results in DynamoDB:

```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

await dynamodb.send(
  new UpdateCommand({
    TableName: process.env.DYNAMODB_VOICE_JOBS_TABLE,
    Key: {
      PK: `VOICE#${jobId}`,
      SK: 'METADATA',
    },
    UpdateExpression:
      'SET extractedEntities = :entities, confidence = :confidence, extractedAt = :timestamp',
    ExpressionAttributeValues: {
      ':entities': result.entities,
      ':confidence': result.confidence,
      ':timestamp': new Date().toISOString(),
    },
  })
);
```

## Monitoring and Observability

### CloudWatch Metrics

```javascript
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });

// Emit custom metrics
await cloudwatch.send(
  new PutMetricDataCommand({
    Namespace: 'VaidyaLink/VoiceProcessing',
    MetricData: [
      {
        MetricName: 'ClinicalExtractionConfidence',
        Value: result.confidence.overall,
        Unit: 'None',
        Dimensions: [{ Name: 'Language', Value: language }],
      },
      {
        MetricName: 'ClinicalExtractionLatency',
        Value: extractionTime,
        Unit: 'Milliseconds',
      },
    ],
  })
);
```

### Structured Logging

```javascript
console.log(
  JSON.stringify({
    event: 'clinical_extraction_completed',
    jobId: event.jobId,
    language: language,
    confidence: result.confidence.overall,
    entityCount: Object.keys(result.entities).filter((k) => result.entities[k]).length,
    latency: extractionTime,
    timestamp: new Date().toISOString(),
  })
);
```

### X-Ray Tracing

```javascript
const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

// Bedrock calls will be automatically traced
const extractor = createClinicalExtractor();
const result = await extractor.extractEntities(transcription, language);
```

## Testing

### Unit Tests

See `src/__tests__/clinical-extractor.test.js` for comprehensive test coverage:

- Constructor initialization
- Entity extraction from English transcriptions
- Multilingual support (Hindi, Bengali, etc.)
- Medication extraction with dosage
- Vital signs extraction
- Allergy extraction
- Markdown response parsing
- Error handling
- Confidence score calculation
- Validation rules

### Integration Tests

```javascript
// Test end-to-end extraction with real Bedrock API
describe('Clinical Extractor Integration', () => {
  it('should extract entities from real transcription', async () => {
    const extractor = createClinicalExtractor();
    const transcription = 'I have been having fever and headache for 3 days';

    const result = await extractor.extractEntities(transcription, 'en');

    expect(result.entities.chiefComplaint).toBeTruthy();
    expect(result.confidence.overall).toBeGreaterThan(0.7);
  });
});
```

## Security Considerations

### 1. Data Privacy

- All transcriptions and extracted data are encrypted at rest (S3, DynamoDB)
- Bedrock API calls use TLS 1.3 encryption in transit
- PHI data is never logged in plaintext

### 2. Access Control

- Lambda execution role has minimum required permissions
- Bedrock access restricted to specific model IDs
- S3 bucket policies enforce encryption

### 3. Audit Logging

- All extraction operations logged to CloudWatch
- CloudTrail captures Bedrock API calls
- Extraction results include metadata for audit trail

## Future Enhancements

### 1. Custom Medical Terminology

Add support for Indian medical terminology and Ayurvedic concepts:

```javascript
const context = {
  medicalSystem: 'ayurveda',
  terminology: ['dosha', 'vata', 'pitta', 'kapha'],
};

const result = await extractor.extractEntities(transcription, 'hi', context);
```

### 2. Temporal Reasoning

Extract temporal relationships between symptoms and events:

```json
{
  "symptoms": [
    {
      "name": "Fever",
      "onset": "3 days ago",
      "progression": "worsening",
      "temporalRelation": "started after headache"
    }
  ]
}
```

### 3. Severity Scoring

Implement automated severity scoring based on symptom combinations:

```javascript
const severityScore = calculateSeverityScore(result.entities);
// Returns: { score: 7.5, level: 'moderate', factors: [...] }
```

### 4. Medical Code Mapping

Automatically map extracted entities to medical codes:

```json
{
  "symptoms": [
    {
      "name": "Fever",
      "codes": {
        "icd10": "R50.9",
        "snomed": "386661006"
      }
    }
  ]
}
```

## References

- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Claude 3.5 Sonnet Model Card](https://www.anthropic.com/claude)
- [HL7 FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [Bhashini API Documentation](https://bhashini.gov.in/en/documentation)
- [VaidyaLink Requirements Document](../../.kiro/specs/vaidyalink/requirements.md)
- [VaidyaLink Design Document](../../.kiro/specs/vaidyalink/design.md)
