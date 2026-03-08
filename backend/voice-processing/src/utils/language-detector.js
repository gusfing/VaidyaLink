/**
 * Language Detection Utility
 *
 * Provides language detection capabilities for voice recordings:
 * 1. Automatic language detection from audio
 * 2. Confidence-based language validation
 * 3. Fallback to user-specified language
 * 4. Support for code-mixed speech detection
 */

const axios = require('axios');

// Language metadata
const LANGUAGE_METADATA = {
  en: { name: 'English', script: 'Latin', family: 'Indo-European' },
  hi: { name: 'Hindi', script: 'Devanagari', family: 'Indo-Aryan' },
  bn: { name: 'Bengali', script: 'Bengali', family: 'Indo-Aryan' },
  te: { name: 'Telugu', script: 'Telugu', family: 'Dravidian' },
  mr: { name: 'Marathi', script: 'Devanagari', family: 'Indo-Aryan' },
  ta: { name: 'Tamil', script: 'Tamil', family: 'Dravidian' },
  gu: { name: 'Gujarati', script: 'Gujarati', family: 'Indo-Aryan' },
  kn: { name: 'Kannada', script: 'Kannada', family: 'Dravidian' },
  ml: { name: 'Malayalam', script: 'Malayalam', family: 'Dravidian' },
  pa: { name: 'Punjabi', script: 'Gurmukhi', family: 'Indo-Aryan' },
  or: { name: 'Odia', script: 'Odia', family: 'Indo-Aryan' },
  as: { name: 'Assamese', script: 'Bengali', family: 'Indo-Aryan' },
  ur: { name: 'Urdu', script: 'Perso-Arabic', family: 'Indo-Aryan' },
  sa: { name: 'Sanskrit', script: 'Devanagari', family: 'Indo-Aryan' },
  ks: { name: 'Kashmiri', script: 'Perso-Arabic', family: 'Indo-Aryan' },
  sd: { name: 'Sindhi', script: 'Perso-Arabic', family: 'Indo-Aryan' },
  ne: { name: 'Nepali', script: 'Devanagari', family: 'Indo-Aryan' },
  kok: { name: 'Konkani', script: 'Devanagari', family: 'Indo-Aryan' },
  mai: { name: 'Maithili', script: 'Devanagari', family: 'Indo-Aryan' },
  bodo: { name: 'Bodo', script: 'Devanagari', family: 'Sino-Tibetan' },
  doi: { name: 'Dogri', script: 'Devanagari', family: 'Indo-Aryan' },
  mni: { name: 'Manipuri', script: 'Bengali', family: 'Sino-Tibetan' },
};

// Common code-mixing patterns
const CODE_MIXING_PATTERNS = [
  { languages: ['hi', 'en'], name: 'Hinglish' },
  { languages: ['ta', 'en'], name: 'Tanglish' },
  { languages: ['te', 'en'], name: 'Tenglish' },
  { languages: ['bn', 'en'], name: 'Benglish' },
  { languages: ['ml', 'en'], name: 'Manglish' },
  { languages: ['kn', 'en'], name: 'Kanglish' },
];

// Minimum confidence threshold for language detection
const LANGUAGE_DETECTION_CONFIDENCE_THRESHOLD = parseFloat(
  process.env.LANGUAGE_DETECTION_CONFIDENCE_THRESHOLD || '0.70'
);

// Enable automatic language detection
const ENABLE_AUTO_LANGUAGE_DETECTION = process.env.ENABLE_AUTO_LANGUAGE_DETECTION !== 'false';

// Enable code-mixed language detection
const ENABLE_CODE_MIXING_DETECTION = process.env.ENABLE_CODE_MIXING === 'true';

/**
 * Detect language from audio using Bhashini API
 *
 * @param {Buffer} audioData - Audio file buffer
 * @param {string} userSpecifiedLanguage - User's language preference (optional)
 * @returns {Promise<Object>} Detection result with language code and confidence
 */
async function detectLanguage(audioData, userSpecifiedLanguage = null) {
  console.log('Starting language detection...');

  const result = {
    detectedLanguage: null,
    confidence: 0.0,
    userSpecifiedLanguage,
    detectionMethod: null,
    isCodeMixed: false,
    codeMixedLanguages: [],
    fallbackUsed: false,
  };

  try {
    // If auto-detection is disabled, use user-specified language
    if (!ENABLE_AUTO_LANGUAGE_DETECTION && userSpecifiedLanguage) {
      console.log(
        `Auto-detection disabled, using user-specified language: ${userSpecifiedLanguage}`
      );
      result.detectedLanguage = userSpecifiedLanguage;
      result.confidence = 1.0;
      result.detectionMethod = 'user_specified';
      return result;
    }

    // Attempt automatic language detection
    if (ENABLE_AUTO_LANGUAGE_DETECTION) {
      const autoDetected = await detectLanguageFromAudio(audioData);

      if (autoDetected && autoDetected.confidence >= LANGUAGE_DETECTION_CONFIDENCE_THRESHOLD) {
        result.detectedLanguage = autoDetected.language;
        result.confidence = autoDetected.confidence;
        result.detectionMethod = 'automatic';

        // Check for code-mixing if enabled
        if (ENABLE_CODE_MIXING_DETECTION) {
          const codeMixing = await detectCodeMixing(audioData, autoDetected.language);
          if (codeMixing.isCodeMixed) {
            result.isCodeMixed = true;
            result.codeMixedLanguages = codeMixing.languages;
          }
        }

        console.log(
          `Language detected automatically: ${result.detectedLanguage} (confidence: ${result.confidence.toFixed(2)})`
        );
        return result;
      }

      console.log(
        `Auto-detection confidence too low: ${autoDetected?.confidence?.toFixed(2) || 'N/A'}`
      );
    }

    // Fallback to user-specified language
    if (userSpecifiedLanguage) {
      console.log(`Using user-specified language as fallback: ${userSpecifiedLanguage}`);
      result.detectedLanguage = userSpecifiedLanguage;
      result.confidence = 0.5; // Lower confidence for fallback
      result.detectionMethod = 'user_fallback';
      result.fallbackUsed = true;
      return result;
    }

    // Default to English if no other option
    console.log('No language detected or specified, defaulting to English');
    result.detectedLanguage = 'en';
    result.confidence = 0.3;
    result.detectionMethod = 'default';
    result.fallbackUsed = true;

    return result;
  } catch (error) {
    console.error('Error in language detection:', error);

    // Fallback on error
    result.detectedLanguage = userSpecifiedLanguage || 'en';
    result.confidence = 0.3;
    result.detectionMethod = 'error_fallback';
    result.fallbackUsed = true;
    result.error = error.message;

    return result;
  }
}

/**
 * Detect language from audio using Bhashini language identification API
 *
 * @param {Buffer} audioData - Audio file buffer
 * @returns {Promise<Object>} Language and confidence
 */
async function detectLanguageFromAudio(audioData) {
  try {
    const audioBase64 = audioData.toString('base64');

    // Bhashini language identification request
    const requestPayload = {
      pipelineTasks: [
        {
          taskType: 'lid', // Language Identification
          config: {
            audioFormat: 'wav',
            samplingRate: 16000,
          },
        },
      ],
      inputData: {
        audio: [
          {
            audioContent: audioBase64,
          },
        ],
      },
    };

    const response = await axios.post(
      process.env.BHASHINI_API_URL ||
        'https://dhruva-api.bhashini.gov.in/services/inference/pipeline',
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: process.env.BHASHINI_API_KEY,
          userID: process.env.BHASHINI_USER_ID,
        },
        timeout: 15000, // 15 second timeout for language detection
      }
    );

    const pipelineResponse = response.data.pipelineResponse;
    if (!pipelineResponse || pipelineResponse.length === 0) {
      throw new Error('No language identification result from Bhashini API');
    }

    const lidResult = pipelineResponse[0];
    const language = lidResult.output?.[0]?.language || null;
    const confidence = lidResult.config?.confidence || 0.0;

    return {
      language,
      confidence,
    };
  } catch (error) {
    console.error('Error detecting language from audio:', error);

    if (error.response) {
      console.error('Bhashini API error:', error.response.data);
    }

    return null;
  }
}

/**
 * Detect code-mixed speech (e.g., Hinglish, Tanglish)
 *
 * @param {Buffer} audioData - Audio file buffer
 * @param {string} primaryLanguage - Primary detected language
 * @returns {Promise<Object>} Code-mixing detection result
 */
async function detectCodeMixing(audioData, primaryLanguage) {
  try {
    // Check if primary language is commonly code-mixed with English
    const codeMixingPattern = CODE_MIXING_PATTERNS.find((pattern) =>
      pattern.languages.includes(primaryLanguage)
    );

    if (!codeMixingPattern) {
      return {
        isCodeMixed: false,
        languages: [primaryLanguage],
      };
    }

    // Perform multi-language transcription to detect code-mixing
    // This is a simplified approach - in production, you'd use more sophisticated methods
    const audioBase64 = audioData.toString('base64');

    const requestPayload = {
      pipelineTasks: [
        {
          taskType: 'asr',
          config: {
            language: {
              sourceLanguage: primaryLanguage,
            },
            audioFormat: 'wav',
            samplingRate: 16000,
            detectCodeMixing: true, // Bhashini feature flag
          },
        },
      ],
      inputData: {
        audio: [
          {
            audioContent: audioBase64,
          },
        ],
      },
    };

    const response = await axios.post(
      process.env.BHASHINI_API_URL ||
        'https://dhruva-api.bhashini.gov.in/services/inference/pipeline',
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: process.env.BHASHINI_API_KEY,
          userID: process.env.BHASHINI_USER_ID,
        },
        timeout: 15000,
      }
    );

    const pipelineResponse = response.data.pipelineResponse;
    if (!pipelineResponse || pipelineResponse.length === 0) {
      return {
        isCodeMixed: false,
        languages: [primaryLanguage],
      };
    }

    const asrResult = pipelineResponse[0];
    const codeMixingDetected = asrResult.config?.codeMixing || false;
    const detectedLanguages = asrResult.config?.languages || [primaryLanguage];

    return {
      isCodeMixed: codeMixingDetected,
      languages: detectedLanguages,
      pattern: codeMixingPattern?.name || null,
    };
  } catch (error) {
    console.error('Error detecting code-mixing:', error);

    // Return non-code-mixed result on error
    return {
      isCodeMixed: false,
      languages: [primaryLanguage],
    };
  }
}

/**
 * Validate language code
 *
 * @param {string} languageCode - ISO 639-1 language code
 * @returns {boolean} True if language is supported
 */
function isLanguageSupported(languageCode) {
  if (!languageCode) {
    return false;
  }
  return LANGUAGE_METADATA.hasOwnProperty(languageCode);
}

/**
 * Get language metadata
 *
 * @param {string} languageCode - ISO 639-1 language code
 * @returns {Object|null} Language metadata or null
 */
function getLanguageMetadata(languageCode) {
  return LANGUAGE_METADATA[languageCode] || null;
}

/**
 * Get language name from code
 *
 * @param {string} languageCode - ISO 639-1 language code
 * @returns {string} Language name or code if not found
 */
function getLanguageName(languageCode) {
  const metadata = LANGUAGE_METADATA[languageCode];
  return metadata ? metadata.name : languageCode;
}

/**
 * Detect language from text (for transcription validation)
 *
 * @param {string} text - Transcribed text
 * @returns {Object} Detected language and confidence
 */
function detectLanguageFromText(text) {
  if (!text || text.trim().length === 0) {
    return {
      language: 'unknown',
      confidence: 0.0,
    };
  }

  // Simple heuristic-based detection using Unicode ranges
  const devanagariRegex = /[\u0900-\u097F]/g;
  const bengaliRegex = /[\u0980-\u09FF]/g;
  const tamilRegex = /[\u0B80-\u0BFF]/g;
  const teluguRegex = /[\u0C00-\u0C7F]/g;
  const kannadaRegex = /[\u0C80-\u0CFF]/g;
  const malayalamRegex = /[\u0D00-\u0D7F]/g;
  const gurmukhiRegex = /[\u0A00-\u0A7F]/g;
  const gujaratiRegex = /[\u0A80-\u0AFF]/g;
  const odiaRegex = /[\u0B00-\u0B7F]/g;
  const arabicRegex = /[\u0600-\u06FF]/g;
  const latinRegex = /[A-Za-z]/g;

  const scriptCounts = {
    devanagari: (text.match(devanagariRegex) || []).length,
    bengali: (text.match(bengaliRegex) || []).length,
    tamil: (text.match(tamilRegex) || []).length,
    telugu: (text.match(teluguRegex) || []).length,
    kannada: (text.match(kannadaRegex) || []).length,
    malayalam: (text.match(malayalamRegex) || []).length,
    gurmukhi: (text.match(gurmukhiRegex) || []).length,
    gujarati: (text.match(gujaratiRegex) || []).length,
    odia: (text.match(odiaRegex) || []).length,
    arabic: (text.match(arabicRegex) || []).length,
    latin: (text.match(latinRegex) || []).length,
  };

  // Find dominant script
  const dominantScript = Object.keys(scriptCounts).reduce((a, b) =>
    scriptCounts[a] > scriptCounts[b] ? a : b
  );

  // Map script to language (simplified)
  const scriptToLanguage = {
    devanagari: 'hi', // Could be Hindi, Marathi, Sanskrit, etc.
    bengali: 'bn',
    tamil: 'ta',
    telugu: 'te',
    kannada: 'kn',
    malayalam: 'ml',
    gurmukhi: 'pa',
    gujarati: 'gu',
    odia: 'or',
    arabic: 'ur', // Could be Urdu, Kashmiri, Sindhi
    latin: 'en',
  };

  const detectedLanguage = scriptToLanguage[dominantScript] || 'unknown';
  const totalChars = text.length;
  const confidence = scriptCounts[dominantScript] / totalChars;

  return {
    language: detectedLanguage,
    confidence: Math.min(confidence, 1.0),
    script: dominantScript,
  };
}

/**
 * Get supported languages list
 *
 * @returns {Array} Array of supported language codes
 */
function getSupportedLanguages() {
  return Object.keys(LANGUAGE_METADATA);
}

/**
 * Format language detection result for logging
 *
 * @param {Object} result - Detection result
 * @returns {string} Formatted string
 */
function formatDetectionResult(result) {
  const languageName = getLanguageName(result.detectedLanguage);
  const confidence = (result.confidence * 100).toFixed(1);
  const method = result.detectionMethod;
  const codeMixed = result.isCodeMixed ? ' (code-mixed)' : '';

  return `${languageName} (${result.detectedLanguage})${codeMixed} - ${confidence}% confidence via ${method}`;
}

module.exports = {
  detectLanguage,
  detectLanguageFromAudio,
  detectCodeMixing,
  detectLanguageFromText,
  isLanguageSupported,
  getLanguageMetadata,
  getLanguageName,
  getSupportedLanguages,
  formatDetectionResult,
  LANGUAGE_METADATA,
  CODE_MIXING_PATTERNS,
};
