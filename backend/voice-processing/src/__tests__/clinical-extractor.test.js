/**
 * Unit tests for Clinical Entity Extractor
 */

const {
  ClinicalExtractor,
  createClinicalExtractor,
  ENTITY_TYPES,
  SEVERITY_LEVELS,
} = require('../utils/clinical-extractor');
const { mockClient } = require('aws-sdk-client-mock');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// Mock Bedrock client
const bedrockMock = mockClient(BedrockRuntimeClient);

describe('ClinicalExtractor', () => {
  let extractor;

  beforeEach(() => {
    bedrockMock.reset();
    extractor = new ClinicalExtractor({
      modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      region: 'us-east-1',
      maxTokens: 2048,
      temperature: 0.1,
    });
  });

  afterEach(() => {
    bedrockMock.restore();
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const defaultExtractor = new ClinicalExtractor();
      expect(defaultExtractor.modelId).toBe('anthropic.claude-3-5-sonnet-20241022-v2:0');
      expect(defaultExtractor.region).toBe('us-east-1');
      expect(defaultExtractor.maxTokens).toBe(2048);
      expect(defaultExtractor.temperature).toBe(0.1);
    });

    it('should initialize with custom options', () => {
      const customExtractor = new ClinicalExtractor({
        modelId: 'custom-model',
        region: 'ap-south-1',
        maxTokens: 4096,
        temperature: 0.5,
      });
      expect(customExtractor.modelId).toBe('custom-model');
      expect(customExtractor.region).toBe('ap-south-1');
      expect(customExtractor.maxTokens).toBe(4096);
      expect(customExtractor.temperature).toBe(0.5);
    });
  });

  describe('extractEntities', () => {
    it('should extract clinical entities from English transcription', async () => {
      const mockResponse = {
        chiefComplaint: 'Fever and headache',
        symptoms: [
          {
            name: 'Fever',
            description: 'High temperature',
            location: null,
            onset: '3 days ago',
          },
          {
            name: 'Headache',
            description: 'Severe pain in forehead',
            location: 'forehead',
            onset: '3 days ago',
          },
        ],
        duration: '3 days',
        severity: 'moderate',
        previousTreatments: [
          {
            treatment: 'Paracetamol',
            outcome: 'Temporary relief',
          },
        ],
        allergies: [],
        medicalHistory: [],
        currentMedications: [],
        vitalSigns: {},
        familyHistory: [],
        lifestyle: {},
        additionalNotes: null,
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify(mockResponse),
              },
            ],
          })
        ),
      });

      const transcription = 'I have been having fever and headache for the past 3 days';
      const result = await extractor.extractEntities(transcription, 'en');

      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('metadata');
      expect(result.entities.chiefComplaint).toBe('Fever and headache');
      expect(result.entities.symptoms).toHaveLength(2);
      expect(result.entities.severity).toBe('moderate');
      expect(result.confidence.overall).toBeGreaterThan(0);
    });

    it('should extract entities from Hindi transcription', async () => {
      const mockResponse = {
        chiefComplaint: 'Stomach pain',
        symptoms: [
          {
            name: 'Abdominal pain',
            description: 'Sharp pain in stomach',
            location: 'abdomen',
            onset: '2 days ago',
          },
        ],
        duration: '2 days',
        severity: 'severe',
        previousTreatments: [],
        allergies: [],
        medicalHistory: [],
        currentMedications: [],
        vitalSigns: {},
        familyHistory: [],
        lifestyle: {},
        additionalNotes: null,
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify(mockResponse),
              },
            ],
          })
        ),
      });

      const transcription = 'मुझे दो दिन से पेट में दर्द हो रहा है';
      const result = await extractor.extractEntities(transcription, 'hi');

      expect(result.entities.chiefComplaint).toBe('Stomach pain');
      expect(result.entities.severity).toBe('severe');
      expect(result.metadata.language).toBe('hi');
    });

    it('should handle medications with dosage information', async () => {
      const mockResponse = {
        chiefComplaint: 'Diabetes management',
        symptoms: [],
        duration: null,
        severity: null,
        previousTreatments: [],
        allergies: [],
        medicalHistory: [
          {
            condition: 'Type 2 Diabetes',
            diagnosedDate: '2020',
            status: 'chronic',
          },
        ],
        currentMedications: [
          {
            name: 'Metformin',
            dosage: '500mg tablet',
            frequency: 'twice daily',
            duration: 'ongoing',
          },
          {
            name: 'Glimepiride',
            dosage: '2mg tablet',
            frequency: 'once daily before breakfast',
            duration: 'ongoing',
          },
        ],
        vitalSigns: {},
        familyHistory: [],
        lifestyle: {},
        additionalNotes: null,
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify(mockResponse),
              },
            ],
          })
        ),
      });

      const transcription =
        'I am taking Metformin 500mg twice daily and Glimepiride 2mg once daily for my diabetes';
      const result = await extractor.extractEntities(transcription, 'en');

      expect(result.entities.currentMedications).toHaveLength(2);
      expect(result.entities.currentMedications[0].name).toBe('Metformin');
      expect(result.entities.currentMedications[0].dosage).toBe('500mg tablet');
      expect(result.entities.currentMedications[1].name).toBe('Glimepiride');
    });

    it('should handle vital signs extraction', async () => {
      const mockResponse = {
        chiefComplaint: 'Routine checkup',
        symptoms: [],
        duration: null,
        severity: null,
        previousTreatments: [],
        allergies: [],
        medicalHistory: [],
        currentMedications: [],
        vitalSigns: {
          bloodPressure: '140/90',
          temperature: '98.6°F',
          pulse: '78',
          respiratoryRate: null,
          oxygenSaturation: '98%',
          weight: '75kg',
          height: null,
        },
        familyHistory: [],
        lifestyle: {},
        additionalNotes: null,
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify(mockResponse),
              },
            ],
          })
        ),
      });

      const transcription =
        'My blood pressure is 140 over 90, pulse is 78, and oxygen saturation is 98 percent';
      const result = await extractor.extractEntities(transcription, 'en');

      expect(result.entities.vitalSigns.bloodPressure).toBe('140/90');
      expect(result.entities.vitalSigns.pulse).toBe('78');
      expect(result.entities.vitalSigns.oxygenSaturation).toBe('98%');
    });

    it('should handle allergies extraction', async () => {
      const mockResponse = {
        chiefComplaint: null,
        symptoms: [],
        duration: null,
        severity: null,
        previousTreatments: [],
        allergies: [
          {
            allergen: 'Penicillin',
            reaction: 'Rash and itching',
          },
          {
            allergen: 'Peanuts',
            reaction: 'Anaphylaxis',
          },
        ],
        medicalHistory: [],
        currentMedications: [],
        vitalSigns: {},
        familyHistory: [],
        lifestyle: {},
        additionalNotes: null,
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify(mockResponse),
              },
            ],
          })
        ),
      });

      const transcription = 'I am allergic to Penicillin and peanuts';
      const result = await extractor.extractEntities(transcription, 'en');

      expect(result.entities.allergies).toHaveLength(2);
      expect(result.entities.allergies[0].allergen).toBe('Penicillin');
      expect(result.entities.allergies[1].allergen).toBe('Peanuts');
    });

    it('should handle markdown code blocks in Bedrock response', async () => {
      const mockResponse = {
        chiefComplaint: 'Cough',
        symptoms: [],
        duration: '1 week',
        severity: 'mild',
        previousTreatments: [],
        allergies: [],
        medicalHistory: [],
        currentMedications: [],
        vitalSigns: {},
        familyHistory: [],
        lifestyle: {},
        additionalNotes: null,
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: '```json\n' + JSON.stringify(mockResponse) + '\n```',
              },
            ],
          })
        ),
      });

      const transcription = 'I have had a mild cough for one week';
      const result = await extractor.extractEntities(transcription, 'en');

      expect(result.entities.chiefComplaint).toBe('Cough');
      expect(result.entities.severity).toBe('mild');
    });

    it('should throw error for empty transcription', async () => {
      await expect(extractor.extractEntities('', 'en')).rejects.toThrow(
        'Transcription text is required'
      );
    });

    it('should handle Bedrock API errors gracefully', async () => {
      bedrockMock.on(InvokeModelCommand).rejects(new Error('Bedrock API error'));

      const transcription = 'Test transcription';
      await expect(extractor.extractEntities(transcription, 'en')).rejects.toThrow(
        'Clinical entity extraction failed'
      );
    });
  });

  describe('validateEntities', () => {
    it('should validate valid entities', () => {
      const entities = {
        chiefComplaint: 'Fever',
        symptoms: [{ name: 'Fever', description: 'High temperature' }],
        severity: 'moderate',
        currentMedications: [{ name: 'Paracetamol', dosage: '500mg' }],
        vitalSigns: { pulse: '80', oxygenSaturation: '98' },
      };

      const validation = extractor.validateEntities(entities);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid severity level', () => {
      const entities = {
        severity: 'extreme',
      };

      const validation = extractor.validateEntities(entities);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid severity level: extreme');
    });

    it('should warn about medications missing name', () => {
      const entities = {
        currentMedications: [{ dosage: '500mg' }, { name: 'Aspirin', dosage: '100mg' }],
      };

      const validation = extractor.validateEntities(entities);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('missing name');
    });

    it('should warn about unusual pulse values', () => {
      const entities = {
        vitalSigns: { pulse: '250' },
      };

      const validation = extractor.validateEntities(entities);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('Unusual pulse value');
    });

    it('should warn about unusual oxygen saturation', () => {
      const entities = {
        vitalSigns: { oxygenSaturation: '110' },
      };

      const validation = extractor.validateEntities(entities);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('Unusual oxygen saturation');
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate confidence scores for extracted entities', async () => {
      const mockResponse = {
        chiefComplaint: 'Fever and headache',
        symptoms: [{ name: 'Fever', description: 'High temperature' }],
        duration: '3 days',
        severity: 'moderate',
        previousTreatments: [],
        allergies: [],
        medicalHistory: [],
        currentMedications: [],
        vitalSigns: {},
        familyHistory: [],
        lifestyle: {},
        additionalNotes: null,
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify(mockResponse),
              },
            ],
          })
        ),
      });

      const transcription = 'I have fever and headache for 3 days';
      const result = await extractor.extractEntities(transcription, 'en');

      expect(result.confidence).toHaveProperty('overall');
      expect(result.confidence).toHaveProperty('byEntity');
      expect(result.confidence.overall).toBeGreaterThan(0);
      expect(result.confidence.overall).toBeLessThanOrEqual(1);
      expect(result.confidence.byEntity.chiefComplaint).toBeGreaterThan(0);
    });

    it('should apply language multiplier for non-English languages', async () => {
      const mockResponse = {
        chiefComplaint: 'Stomach pain',
        symptoms: [],
        duration: '2 days',
        severity: 'moderate',
        previousTreatments: [],
        allergies: [],
        medicalHistory: [],
        currentMedications: [],
        vitalSigns: {},
        familyHistory: [],
        lifestyle: {},
        additionalNotes: null,
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                text: JSON.stringify(mockResponse),
              },
            ],
          })
        ),
      });

      const transcription = 'पेट में दर्द';
      const result = await extractor.extractEntities(transcription, 'hi');

      // Non-English should have slightly lower confidence
      expect(result.confidence.overall).toBeLessThan(1.0);
    });
  });

  describe('Factory Function', () => {
    it('should create extractor with environment variables', () => {
      process.env.BEDROCK_MODEL_ID = 'test-model';
      process.env.BEDROCK_REGION = 'ap-south-1';
      process.env.BEDROCK_MAX_TOKENS = '4096';
      process.env.BEDROCK_TEMPERATURE = '0.2';

      const extractor = createClinicalExtractor();

      expect(extractor.modelId).toBe('test-model');
      expect(extractor.region).toBe('ap-south-1');
      expect(extractor.maxTokens).toBe(4096);
      expect(extractor.temperature).toBe(0.2);

      // Cleanup
      delete process.env.BEDROCK_MODEL_ID;
      delete process.env.BEDROCK_REGION;
      delete process.env.BEDROCK_MAX_TOKENS;
      delete process.env.BEDROCK_TEMPERATURE;
    });

    it('should create extractor with custom options overriding env vars', () => {
      process.env.BEDROCK_MODEL_ID = 'env-model';

      const extractor = createClinicalExtractor({
        modelId: 'custom-model',
      });

      expect(extractor.modelId).toBe('custom-model');

      delete process.env.BEDROCK_MODEL_ID;
    });
  });

  describe('Constants', () => {
    it('should export ENTITY_TYPES', () => {
      expect(ENTITY_TYPES).toBeDefined();
      expect(ENTITY_TYPES.CHIEF_COMPLAINT).toBe('chiefComplaint');
      expect(ENTITY_TYPES.SYMPTOMS).toBe('symptoms');
      expect(ENTITY_TYPES.ALLERGIES).toBe('allergies');
    });

    it('should export SEVERITY_LEVELS', () => {
      expect(SEVERITY_LEVELS).toBeDefined();
      expect(SEVERITY_LEVELS).toContain('mild');
      expect(SEVERITY_LEVELS).toContain('moderate');
      expect(SEVERITY_LEVELS).toContain('severe');
    });
  });
});
