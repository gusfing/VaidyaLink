/**
 * Clinical Entity Extraction Module using Amazon Bedrock
 *
 * This module extracts structured clinical entities from voice transcriptions
 * using Amazon Bedrock (Claude 3.5 Sonnet). It supports multilingual input
 * from 22 Indian languages and generates confidence scores for extracted data.
 *
 * Key Features:
 * - Clinical entity extraction (symptoms, medications, conditions, etc.)
 * - Multilingual support for Indian languages
 * - Confidence score calculation
 * - FHIR-ready structured output
 * - Comprehensive error handling
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

/**
 * Clinical entity types supported by the extractor
 */
const ENTITY_TYPES = {
  CHIEF_COMPLAINT: 'chiefComplaint',
  SYMPTOMS: 'symptoms',
  DURATION: 'duration',
  SEVERITY: 'severity',
  PREVIOUS_TREATMENTS: 'previousTreatments',
  ALLERGIES: 'allergies',
  MEDICAL_HISTORY: 'medicalHistory',
  CURRENT_MEDICATIONS: 'currentMedications',
  VITAL_SIGNS: 'vitalSigns',
  FAMILY_HISTORY: 'familyHistory',
  LIFESTYLE: 'lifestyle',
  ADDITIONAL_NOTES: 'additionalNotes',
};

/**
 * Severity levels for symptoms
 */
const SEVERITY_LEVELS = ['mild', 'moderate', 'severe'];

/**
 * Clinical Entity Extractor class
 */
class ClinicalExtractor {
  /**
   * Initialize the clinical extractor
   *
   * @param {Object} options - Configuration options
   * @param {string} options.modelId - Bedrock model ID
   * @param {string} options.region - AWS region
   * @param {number} options.maxTokens - Maximum tokens for response
   * @param {number} options.temperature - Model temperature (0.0-1.0)
   */
  constructor(options = {}) {
    this.modelId = options.modelId || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    this.region = options.region || 'us-east-1';
    this.maxTokens = options.maxTokens || 2048;
    this.temperature = options.temperature || 0.1;

    // Initialize Bedrock client
    this.bedrockClient = new BedrockRuntimeClient({
      region: this.region,
    });

    console.log(`ClinicalExtractor initialized with model: ${this.modelId}`);
  }

  /**
   * Extract clinical entities from transcription
   *
   * @param {string} transcription - Voice transcription text
   * @param {string} language - Language code (ISO 639-1)
   * @param {Object} context - Additional context (optional)
   * @returns {Promise<Object>} Structured clinical data with confidence scores
   */
  async extractEntities(transcription, language = 'en', context = {}) {
    try {
      console.log(`Extracting clinical entities (language: ${language})`);

      // Validate input
      if (!transcription || transcription.trim().length === 0) {
        throw new Error('Transcription text is required');
      }

      // Build extraction prompt
      const prompt = this._buildExtractionPrompt(transcription, language, context);

      // Invoke Bedrock
      const response = await this._invokeBedrockModel(prompt);

      // Parse and validate response
      const structuredData = this._parseBedrockResponse(response);

      // Calculate confidence scores
      const confidenceScores = this._calculateConfidenceScores(
        structuredData,
        transcription,
        language
      );

      // Build final result
      const result = {
        entities: structuredData,
        confidence: confidenceScores,
        metadata: {
          language,
          transcriptionLength: transcription.length,
          extractedAt: new Date().toISOString(),
          modelId: this.modelId,
        },
      };

      console.log('Clinical entity extraction completed successfully');
      return result;
    } catch (error) {
      console.error('Error extracting clinical entities:', error);
      throw new Error(`Clinical entity extraction failed: ${error.message}`);
    }
  }

  /**
   * Build extraction prompt for Bedrock
   *
   * @private
   * @param {string} transcription - Voice transcription
   * @param {string} language - Language code
   * @param {Object} context - Additional context
   * @returns {string} Formatted prompt
   */
  _buildExtractionPrompt(transcription, language, context) {
    const languageNote =
      language !== 'en'
        ? `\nNote: The transcription is in ${this._getLanguageName(language)}. Extract information and respond in English.`
        : '';

    const contextNote =
      Object.keys(context).length > 0 ? `\n\nContext: ${JSON.stringify(context)}` : '';

    return `You are a medical AI assistant specialized in extracting structured clinical information from patient voice recordings. Extract clinical entities from the following patient transcription.

Language: ${language}${languageNote}
Transcription: "${transcription}"${contextNote}

Extract the following clinical information if explicitly mentioned:

1. **Chief Complaint**: Primary reason for consultation
2. **Symptoms**: List of symptoms with descriptions
3. **Duration**: How long symptoms have been present
4. **Severity**: Mild, moderate, or severe
5. **Previous Treatments**: Past treatments or medications tried
6. **Allergies**: Known allergies (medications, food, environmental)
7. **Medical History**: Past medical conditions or surgeries
8. **Current Medications**: Medications currently taking
9. **Vital Signs**: Any mentioned vital signs (BP, temperature, pulse, etc.)
10. **Family History**: Relevant family medical history
11. **Lifestyle**: Smoking, alcohol, diet, exercise habits
12. **Additional Notes**: Any other relevant clinical information

Important Guidelines:
- Only extract information explicitly mentioned in the transcription
- Use null for missing fields and empty arrays for missing lists
- Preserve medical terminology when possible
- For medications, include dosage and frequency if mentioned
- For symptoms, include descriptive details
- Be precise and avoid assumptions
- Handle multilingual medical terms appropriately

Respond in JSON format:
{
  "chiefComplaint": "string or null",
  "symptoms": [
    {
      "name": "symptom name",
      "description": "detailed description",
      "location": "body location if mentioned",
      "onset": "when it started"
    }
  ],
  "duration": "string or null",
  "severity": "mild|moderate|severe|null",
  "previousTreatments": [
    {
      "treatment": "treatment name",
      "outcome": "result if mentioned"
    }
  ],
  "allergies": [
    {
      "allergen": "substance name",
      "reaction": "reaction type"
    }
  ],
  "medicalHistory": [
    {
      "condition": "condition name",
      "diagnosedDate": "date if mentioned",
      "status": "active|resolved|chronic"
    }
  ],
  "currentMedications": [
    {
      "name": "medication name",
      "dosage": "strength and form",
      "frequency": "how often",
      "duration": "how long taking it"
    }
  ],
  "vitalSigns": {
    "bloodPressure": "systolic/diastolic",
    "temperature": "value with unit",
    "pulse": "bpm",
    "respiratoryRate": "breaths/min",
    "oxygenSaturation": "percentage",
    "weight": "value with unit",
    "height": "value with unit"
  },
  "familyHistory": [
    {
      "relation": "family member",
      "condition": "medical condition"
    }
  ],
  "lifestyle": {
    "smoking": "yes|no|former|null",
    "alcohol": "yes|no|occasional|null",
    "exercise": "description or null",
    "diet": "description or null"
  },
  "additionalNotes": "string or null"
}

Respond with ONLY the JSON object, no additional text.`;
  }

  /**
   * Invoke Bedrock model with prompt
   *
   * @private
   * @param {string} prompt - Formatted prompt
   * @returns {Promise<string>} Model response text
   */
  async _invokeBedrockModel(prompt) {
    try {
      const requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      });

      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (!responseBody.content || responseBody.content.length === 0) {
        throw new Error('Empty response from Bedrock');
      }

      return responseBody.content[0].text;
    } catch (error) {
      console.error('Bedrock invocation error:', error);
      throw new Error(`Bedrock API error: ${error.message}`);
    }
  }

  /**
   * Parse Bedrock response into structured data
   *
   * @private
   * @param {string} responseText - Raw response from Bedrock
   * @returns {Object} Parsed structured data
   */
  _parseBedrockResponse(responseText) {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = responseText.trim();

      // Remove markdown code block markers
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.substring(7);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.substring(3);
      }

      if (jsonText.endsWith('```')) {
        jsonText = jsonText.substring(0, jsonText.length - 3);
      }

      jsonText = jsonText.trim();

      // Parse JSON
      const data = JSON.parse(jsonText);

      // Validate and normalize structure
      return this._normalizeStructuredData(data);
    } catch (error) {
      console.error('Error parsing Bedrock response:', error);
      console.error('Response text:', responseText);
      throw new Error(`Failed to parse Bedrock response: ${error.message}`);
    }
  }

  /**
   * Normalize structured data to ensure consistent format
   *
   * @private
   * @param {Object} data - Raw parsed data
   * @returns {Object} Normalized data
   */
  _normalizeStructuredData(data) {
    return {
      chiefComplaint: data.chiefComplaint || null,
      symptoms: Array.isArray(data.symptoms) ? data.symptoms : [],
      duration: data.duration || null,
      severity: SEVERITY_LEVELS.includes(data.severity) ? data.severity : null,
      previousTreatments: Array.isArray(data.previousTreatments) ? data.previousTreatments : [],
      allergies: Array.isArray(data.allergies) ? data.allergies : [],
      medicalHistory: Array.isArray(data.medicalHistory) ? data.medicalHistory : [],
      currentMedications: Array.isArray(data.currentMedications) ? data.currentMedications : [],
      vitalSigns: data.vitalSigns || {},
      familyHistory: Array.isArray(data.familyHistory) ? data.familyHistory : [],
      lifestyle: data.lifestyle || {},
      additionalNotes: data.additionalNotes || null,
    };
  }

  /**
   * Calculate confidence scores for extracted entities
   *
   * @private
   * @param {Object} structuredData - Extracted structured data
   * @param {string} transcription - Original transcription
   * @param {string} language - Language code
   * @returns {Object} Confidence scores by entity type
   */
  _calculateConfidenceScores(structuredData, transcription, language) {
    const scores = {};
    const transcriptionLower = transcription.toLowerCase();
    const transcriptionLength = transcription.length;

    // Base confidence adjustment for non-English languages
    const languageMultiplier = language === 'en' ? 1.0 : 0.95;

    // Calculate confidence for each entity type
    Object.entries(structuredData).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        scores[key] = 0.0;
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          scores[key] = 0.0;
        } else {
          // Calculate based on array content richness
          const avgItemLength =
            value.reduce((sum, item) => {
              const itemStr = typeof item === 'object' ? JSON.stringify(item) : String(item);
              return sum + itemStr.length;
            }, 0) / value.length;

          // Higher confidence for more detailed items
          const baseScore = Math.min(0.7 + avgItemLength / 100, 0.95);
          scores[key] = baseScore * languageMultiplier;
        }
      } else if (typeof value === 'object') {
        // For objects (vitalSigns, lifestyle), check how many fields are populated
        const populatedFields = Object.values(value).filter(
          (v) => v !== null && v !== undefined
        ).length;
        const totalFields = Object.keys(value).length;

        if (populatedFields === 0) {
          scores[key] = 0.0;
        } else {
          const baseScore = 0.6 + (populatedFields / totalFields) * 0.3;
          scores[key] = baseScore * languageMultiplier;
        }
      } else if (typeof value === 'string') {
        // For strings, check length and presence in transcription
        const valueLength = value.length;
        const presenceScore = transcriptionLower.includes(value.toLowerCase()) ? 0.2 : 0.0;
        const lengthScore = Math.min(valueLength / 50, 0.7);
        const baseScore = 0.5 + lengthScore + presenceScore;

        scores[key] = Math.min(baseScore * languageMultiplier, 0.98);
      } else {
        // Default confidence for other types
        scores[key] = 0.8 * languageMultiplier;
      }
    });

    // Calculate overall confidence
    const validScores = Object.values(scores).filter((score) => score > 0);
    const overallConfidence =
      validScores.length > 0
        ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
        : 0.0;

    return {
      overall: parseFloat(overallConfidence.toFixed(3)),
      byEntity: Object.fromEntries(
        Object.entries(scores).map(([key, value]) => [key, parseFloat(value.toFixed(3))])
      ),
    };
  }

  /**
   * Get language name from ISO code
   *
   * @private
   * @param {string} code - ISO 639-1 language code
   * @returns {string} Language name
   */
  _getLanguageName(code) {
    const languageNames = {
      en: 'English',
      hi: 'Hindi',
      bn: 'Bengali',
      te: 'Telugu',
      mr: 'Marathi',
      ta: 'Tamil',
      gu: 'Gujarati',
      kn: 'Kannada',
      ml: 'Malayalam',
      pa: 'Punjabi',
      or: 'Odia',
      as: 'Assamese',
      ur: 'Urdu',
      sa: 'Sanskrit',
      ks: 'Kashmiri',
      sd: 'Sindhi',
      ne: 'Nepali',
      kok: 'Konkani',
      mai: 'Maithili',
      bodo: 'Bodo',
      doi: 'Dogri',
      mni: 'Manipuri',
    };

    return languageNames[code] || code;
  }

  /**
   * Validate extracted entities against business rules
   *
   * @param {Object} entities - Extracted entities
   * @returns {Object} Validation result with errors/warnings
   */
  validateEntities(entities) {
    const errors = [];
    const warnings = [];

    // Validate severity
    if (entities.severity && !SEVERITY_LEVELS.includes(entities.severity)) {
      errors.push(`Invalid severity level: ${entities.severity}`);
    }

    // Validate medications structure
    if (entities.currentMedications && Array.isArray(entities.currentMedications)) {
      entities.currentMedications.forEach((med, index) => {
        if (!med.name) {
          warnings.push(`Medication at index ${index} missing name`);
        }
      });
    }

    // Validate vital signs ranges
    if (entities.vitalSigns) {
      const { bloodPressure, temperature, pulse, oxygenSaturation } = entities.vitalSigns;

      if (pulse) {
        const pulseNum = parseInt(pulse);
        if (pulseNum < 40 || pulseNum > 200) {
          warnings.push(`Unusual pulse value: ${pulse}`);
        }
      }

      if (oxygenSaturation) {
        const spo2 = parseInt(oxygenSaturation);
        if (spo2 < 70 || spo2 > 100) {
          warnings.push(`Unusual oxygen saturation: ${oxygenSaturation}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Factory function to create ClinicalExtractor instance
 *
 * @param {Object} options - Configuration options
 * @returns {ClinicalExtractor} Extractor instance
 */
function createClinicalExtractor(options = {}) {
  const config = {
    modelId: options.modelId || process.env.BEDROCK_MODEL_ID,
    region: options.region || process.env.BEDROCK_REGION || process.env.AWS_REGION,
    maxTokens: options.maxTokens || parseInt(process.env.BEDROCK_MAX_TOKENS || '2048'),
    temperature: options.temperature || parseFloat(process.env.BEDROCK_TEMPERATURE || '0.1'),
  };

  return new ClinicalExtractor(config);
}

module.exports = {
  ClinicalExtractor,
  createClinicalExtractor,
  ENTITY_TYPES,
  SEVERITY_LEVELS,
};
