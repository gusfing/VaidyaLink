/**
 * Language Detection Tests
 *
 * Tests for language detection functionality
 */

const {
  detectLanguageFromText,
  isLanguageSupported,
  getLanguageMetadata,
  getLanguageName,
  getSupportedLanguages,
  formatDetectionResult,
  LANGUAGE_METADATA,
  CODE_MIXING_PATTERNS,
} = require('../utils/language-detector');

describe('Language Detection', () => {
  describe('detectLanguageFromText', () => {
    it('should detect English from Latin script', () => {
      const text = 'The patient has a headache and fever';
      const result = detectLanguageFromText(text);

      expect(result.language).toBe('en');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.script).toBe('latin');
    });

    it('should detect Hindi from Devanagari script', () => {
      const text = 'मरीज को सिरदर्द और बुखार है';
      const result = detectLanguageFromText(text);

      expect(result.language).toBe('hi');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.script).toBe('devanagari');
    });

    it('should detect Tamil from Tamil script', () => {
      const text = 'நோயாளிக்கு தலைவலி மற்றும் காய்ச்சல் உள்ளது';
      const result = detectLanguageFromText(text);

      expect(result.language).toBe('ta');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.script).toBe('tamil');
    });

    it('should detect Telugu from Telugu script', () => {
      const text = 'రోగికి తలనొప్పి మరియు జ్వరం ఉంది';
      const result = detectLanguageFromText(text);

      expect(result.language).toBe('te');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.script).toBe('telugu');
    });

    it('should detect Bengali from Bengali script', () => {
      const text = 'রোগীর মাথাব্যথা এবং জ্বর আছে';
      const result = detectLanguageFromText(text);

      expect(result.language).toBe('bn');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.script).toBe('bengali');
    });

    it('should detect Kannada from Kannada script', () => {
      const text = 'ರೋಗಿಗೆ ತಲೆನೋವು ಮತ್ತು ಜ್ವರವಿದೆ';
      const result = detectLanguageFromText(text);

      expect(result.language).toBe('kn');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.script).toBe('kannada');
    });

    it('should detect Malayalam from Malayalam script', () => {
      const text = 'രോഗിക്ക് തലവേദനയും പനിയും ഉണ്ട്';
      const result = detectLanguageFromText(text);

      expect(result.language).toBe('ml');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.script).toBe('malayalam');
    });

    it('should detect Gujarati from Gujarati script', () => {
      const text = 'દર્દીને માથાનો દુખાવો અને તાવ છે';
      const result = detectLanguageFromText(text);

      expect(result.language).toBe('gu');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.script).toBe('gujarati');
    });

    it('should detect Punjabi from Gurmukhi script', () => {
      const text = 'ਮਰੀਜ਼ ਨੂੰ ਸਿਰ ਦਰਦ ਅਤੇ ਬੁਖ਼ਾਰ ਹੈ';
      const result = detectLanguageFromText(text);

      expect(result.language).toBe('pa');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.script).toBe('gurmukhi');
    });

    it('should detect Urdu from Arabic script', () => {
      const text = 'مریض کو سر درد اور بخار ہے';
      const result = detectLanguageFromText(text);

      expect(result.language).toBe('ur');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.script).toBe('arabic');
    });

    it('should handle empty text', () => {
      const result = detectLanguageFromText('');

      expect(result.language).toBe('unknown');
      expect(result.confidence).toBe(0.0);
    });

    it('should handle null text', () => {
      const result = detectLanguageFromText(null);

      expect(result.language).toBe('unknown');
      expect(result.confidence).toBe(0.0);
    });

    it('should handle mixed script text', () => {
      const text = 'Patient को headache है';
      const result = detectLanguageFromText(text);

      // Should detect dominant script
      expect(result.language).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(isLanguageSupported('en')).toBe(true);
      expect(isLanguageSupported('hi')).toBe(true);
      expect(isLanguageSupported('ta')).toBe(true);
      expect(isLanguageSupported('te')).toBe(true);
      expect(isLanguageSupported('bn')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(isLanguageSupported('fr')).toBe(false);
      expect(isLanguageSupported('de')).toBe(false);
      expect(isLanguageSupported('zh')).toBe(false);
      expect(isLanguageSupported('ja')).toBe(false);
    });

    it('should return false for invalid input', () => {
      expect(isLanguageSupported(null)).toBe(false);
      expect(isLanguageSupported(undefined)).toBe(false);
      expect(isLanguageSupported('')).toBe(false);
    });
  });

  describe('getLanguageMetadata', () => {
    it('should return metadata for supported languages', () => {
      const hindiMetadata = getLanguageMetadata('hi');
      expect(hindiMetadata).toEqual({
        name: 'Hindi',
        script: 'Devanagari',
        family: 'Indo-Aryan',
      });

      const tamilMetadata = getLanguageMetadata('ta');
      expect(tamilMetadata).toEqual({
        name: 'Tamil',
        script: 'Tamil',
        family: 'Dravidian',
      });
    });

    it('should return null for unsupported languages', () => {
      expect(getLanguageMetadata('fr')).toBeNull();
      expect(getLanguageMetadata('xyz')).toBeNull();
    });
  });

  describe('getLanguageName', () => {
    it('should return language name for supported languages', () => {
      expect(getLanguageName('en')).toBe('English');
      expect(getLanguageName('hi')).toBe('Hindi');
      expect(getLanguageName('ta')).toBe('Tamil');
      expect(getLanguageName('te')).toBe('Telugu');
      expect(getLanguageName('bn')).toBe('Bengali');
    });

    it('should return language code for unsupported languages', () => {
      expect(getLanguageName('fr')).toBe('fr');
      expect(getLanguageName('xyz')).toBe('xyz');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return array of supported language codes', () => {
      const languages = getSupportedLanguages();

      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBe(22);
      expect(languages).toContain('en');
      expect(languages).toContain('hi');
      expect(languages).toContain('ta');
      expect(languages).toContain('te');
    });

    it('should include all 22 scheduled Indian languages', () => {
      const languages = getSupportedLanguages();

      const expectedLanguages = [
        'en',
        'hi',
        'bn',
        'te',
        'mr',
        'ta',
        'gu',
        'kn',
        'ml',
        'pa',
        'or',
        'as',
        'ur',
        'sa',
        'ks',
        'sd',
        'ne',
        'kok',
        'mai',
        'bodo',
        'doi',
        'mni',
      ];

      expectedLanguages.forEach((lang) => {
        expect(languages).toContain(lang);
      });
    });
  });

  describe('formatDetectionResult', () => {
    it('should format detection result correctly', () => {
      const result = {
        detectedLanguage: 'hi',
        confidence: 0.92,
        detectionMethod: 'automatic',
        isCodeMixed: false,
      };

      const formatted = formatDetectionResult(result);

      expect(formatted).toContain('Hindi');
      expect(formatted).toContain('hi');
      expect(formatted).toContain('92.0%');
      expect(formatted).toContain('automatic');
    });

    it('should indicate code-mixed languages', () => {
      const result = {
        detectedLanguage: 'hi',
        confidence: 0.85,
        detectionMethod: 'automatic',
        isCodeMixed: true,
        codeMixedLanguages: ['hi', 'en'],
      };

      const formatted = formatDetectionResult(result);

      expect(formatted).toContain('code-mixed');
    });

    it('should handle low confidence results', () => {
      const result = {
        detectedLanguage: 'en',
        confidence: 0.35,
        detectionMethod: 'default',
        isCodeMixed: false,
      };

      const formatted = formatDetectionResult(result);

      expect(formatted).toContain('35.0%');
      expect(formatted).toContain('default');
    });
  });

  describe('LANGUAGE_METADATA', () => {
    it('should contain all 22 languages', () => {
      expect(Object.keys(LANGUAGE_METADATA)).toHaveLength(22);
    });

    it('should have correct structure for each language', () => {
      Object.entries(LANGUAGE_METADATA).forEach(([code, metadata]) => {
        expect(metadata).toHaveProperty('name');
        expect(metadata).toHaveProperty('script');
        expect(metadata).toHaveProperty('family');
        expect(typeof metadata.name).toBe('string');
        expect(typeof metadata.script).toBe('string');
        expect(typeof metadata.family).toBe('string');
      });
    });

    it('should include Indo-Aryan languages', () => {
      const indoAryanLanguages = Object.entries(LANGUAGE_METADATA)
        .filter(([_, metadata]) => metadata.family === 'Indo-Aryan')
        .map(([code, _]) => code);

      expect(indoAryanLanguages).toContain('hi');
      expect(indoAryanLanguages).toContain('bn');
      expect(indoAryanLanguages).toContain('mr');
      expect(indoAryanLanguages).toContain('pa');
      expect(indoAryanLanguages).toContain('gu');
    });

    it('should include Dravidian languages', () => {
      const dravidianLanguages = Object.entries(LANGUAGE_METADATA)
        .filter(([_, metadata]) => metadata.family === 'Dravidian')
        .map(([code, _]) => code);

      expect(dravidianLanguages).toContain('ta');
      expect(dravidianLanguages).toContain('te');
      expect(dravidianLanguages).toContain('kn');
      expect(dravidianLanguages).toContain('ml');
    });
  });

  describe('CODE_MIXING_PATTERNS', () => {
    it('should define common code-mixing patterns', () => {
      expect(Array.isArray(CODE_MIXING_PATTERNS)).toBe(true);
      expect(CODE_MIXING_PATTERNS.length).toBeGreaterThan(0);
    });

    it('should include Hinglish pattern', () => {
      const hinglish = CODE_MIXING_PATTERNS.find((p) => p.name === 'Hinglish');
      expect(hinglish).toBeDefined();
      expect(hinglish.languages).toContain('hi');
      expect(hinglish.languages).toContain('en');
    });

    it('should include Tanglish pattern', () => {
      const tanglish = CODE_MIXING_PATTERNS.find((p) => p.name === 'Tanglish');
      expect(tanglish).toBeDefined();
      expect(tanglish.languages).toContain('ta');
      expect(tanglish.languages).toContain('en');
    });

    it('should have correct structure for each pattern', () => {
      CODE_MIXING_PATTERNS.forEach((pattern) => {
        expect(pattern).toHaveProperty('languages');
        expect(pattern).toHaveProperty('name');
        expect(Array.isArray(pattern.languages)).toBe(true);
        expect(pattern.languages.length).toBe(2);
        expect(typeof pattern.name).toBe('string');
      });
    });
  });

  describe('Language Families', () => {
    it('should group languages by family correctly', () => {
      const families = {};

      Object.entries(LANGUAGE_METADATA).forEach(([code, metadata]) => {
        if (!families[metadata.family]) {
          families[metadata.family] = [];
        }
        families[metadata.family].push(code);
      });

      expect(families['Indo-Aryan'].length).toBeGreaterThan(0);
      expect(families['Dravidian'].length).toBe(4);
      expect(families['Indo-European'].length).toBe(1);
      expect(families['Sino-Tibetan'].length).toBe(2);
    });
  });

  describe('Script Systems', () => {
    it('should have multiple languages using Devanagari script', () => {
      const devanagariLanguages = Object.entries(LANGUAGE_METADATA)
        .filter(([_, metadata]) => metadata.script === 'Devanagari')
        .map(([code, _]) => code);

      expect(devanagariLanguages.length).toBeGreaterThan(1);
      expect(devanagariLanguages).toContain('hi');
      expect(devanagariLanguages).toContain('mr');
      expect(devanagariLanguages).toContain('sa');
    });

    it('should have unique scripts for Dravidian languages', () => {
      const dravidianScripts = Object.entries(LANGUAGE_METADATA)
        .filter(([_, metadata]) => metadata.family === 'Dravidian')
        .map(([_, metadata]) => metadata.script);

      expect(new Set(dravidianScripts).size).toBe(4);
    });
  });
});
