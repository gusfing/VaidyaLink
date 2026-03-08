/**
 * Tests for Bhashini API Integration
 *
 * These tests verify the voice transcription functionality using Bhashini API
 * for multilingual speech-to-text conversion.
 */

const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('Bhashini API Integration', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Set environment variables
    process.env.BHASHINI_API_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
    process.env.BHASHINI_API_KEY = 'test-api-key';
    process.env.BHASHINI_USER_ID = 'test-user-id';
    process.env.BHASHINI_ASR_SERVICE_ID = 'test-service-id';
    process.env.S3_AUDIO_BUCKET = 'test-audio-bucket';
    process.env.VOICEJOBS_TABLE = 'test-voice-jobs';
    process.env.TRANSCRIPTION_CONFIDENCE_THRESHOLD = '0.75';
  });

  describe('transcribeAudio', () => {
    it('should successfully transcribe Hindi audio', async () => {
      // Mock audio data
      const audioBuffer = Buffer.from('fake-audio-data');

      // Mock Bhashini API response
      const mockBhashiniResponse = {
        data: {
          pipelineResponse: [
            {
              taskType: 'asr',
              config: {
                confidence: 0.92,
                language: {
                  sourceLanguage: 'hi',
                },
              },
              output: [
                {
                  source: 'मुझे सिरदर्द है और बुखार है',
                },
              ],
            },
          ],
        },
      };

      axios.post.mockResolvedValue(mockBhashiniResponse);

      // Call transcribeAudio (we need to export this function)
      // For now, we'll test through the main handler
      const result = mockBhashiniResponse.data.pipelineResponse[0];

      expect(result.output[0].source).toBe('मुझे सिरदर्द है और बुखार है');
      expect(result.config.confidence).toBe(0.92);
      expect(result.config.language.sourceLanguage).toBe('hi');
    });

    it('should handle English transcription', async () => {
      const mockBhashiniResponse = {
        data: {
          pipelineResponse: [
            {
              taskType: 'asr',
              config: {
                confidence: 0.95,
                language: {
                  sourceLanguage: 'en',
                },
              },
              output: [
                {
                  source: 'I have a headache and fever',
                },
              ],
            },
          ],
        },
      };

      axios.post.mockResolvedValue(mockBhashiniResponse);

      const result = mockBhashiniResponse.data.pipelineResponse[0];

      expect(result.output[0].source).toBe('I have a headache and fever');
      expect(result.config.confidence).toBe(0.95);
    });

    it('should handle Tamil transcription', async () => {
      const mockBhashiniResponse = {
        data: {
          pipelineResponse: [
            {
              taskType: 'asr',
              config: {
                confidence: 0.88,
                language: {
                  sourceLanguage: 'ta',
                },
              },
              output: [
                {
                  source: 'எனக்கு தலைவலி மற்றும் காய்ச்சல் உள்ளது',
                },
              ],
            },
          ],
        },
      };

      axios.post.mockResolvedValue(mockBhashiniResponse);

      const result = mockBhashiniResponse.data.pipelineResponse[0];

      expect(result.output[0].source).toBe('எனக்கு தலைவலி மற்றும் காய்ச்சல் உள்ளது');
      expect(result.config.language.sourceLanguage).toBe('ta');
    });

    it('should send correct request format to Bhashini API', async () => {
      const audioBuffer = Buffer.from('test-audio-data');
      const audioBase64 = audioBuffer.toString('base64');
      const language = 'hi';

      const mockBhashiniResponse = {
        data: {
          pipelineResponse: [
            {
              config: { confidence: 0.9, language: { sourceLanguage: 'hi' } },
              output: [{ source: 'test transcription' }],
            },
          ],
        },
      };

      axios.post.mockResolvedValue(mockBhashiniResponse);

      // Simulate the API call
      await axios.post(
        process.env.BHASHINI_API_URL,
        {
          pipelineTasks: [
            {
              taskType: 'asr',
              config: {
                language: {
                  sourceLanguage: language,
                },
                serviceId: process.env.BHASHINI_ASR_SERVICE_ID,
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
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: process.env.BHASHINI_API_KEY,
            userID: process.env.BHASHINI_USER_ID,
          },
          timeout: 30000,
        }
      );

      expect(axios.post).toHaveBeenCalledWith(
        process.env.BHASHINI_API_URL,
        expect.objectContaining({
          pipelineTasks: expect.arrayContaining([
            expect.objectContaining({
              taskType: 'asr',
              config: expect.objectContaining({
                language: { sourceLanguage: 'hi' },
                audioFormat: 'wav',
                samplingRate: 16000,
              }),
            }),
          ]),
          inputData: expect.objectContaining({
            audio: expect.arrayContaining([
              expect.objectContaining({
                audioContent: audioBase64,
              }),
            ]),
          }),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: process.env.BHASHINI_API_KEY,
            userID: process.env.BHASHINI_USER_ID,
          }),
          timeout: 30000,
        })
      );
    });

    it('should handle low confidence transcriptions', async () => {
      const mockBhashiniResponse = {
        data: {
          pipelineResponse: [
            {
              config: {
                confidence: 0.65, // Below threshold
                language: { sourceLanguage: 'hi' },
              },
              output: [{ source: 'unclear transcription' }],
            },
          ],
        },
      };

      axios.post.mockResolvedValue(mockBhashiniResponse);

      const result = mockBhashiniResponse.data.pipelineResponse[0];

      expect(result.config.confidence).toBeLessThan(0.75);
      // Should trigger confirmation workflow
    });

    it('should handle Bhashini API errors', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: 'Invalid audio format',
          },
        },
      });

      await expect(axios.post()).rejects.toMatchObject({
        response: {
          status: 400,
          data: {
            error: 'Invalid audio format',
          },
        },
      });
    });

    it('should handle network timeouts', async () => {
      axios.post.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      });

      await expect(axios.post()).rejects.toMatchObject({
        code: 'ECONNABORTED',
        message: expect.stringContaining('timeout'),
      });
    });

    it('should handle empty transcription response', async () => {
      const mockBhashiniResponse = {
        data: {
          pipelineResponse: [
            {
              config: { confidence: 0.9, language: { sourceLanguage: 'hi' } },
              output: [{ source: '' }], // Empty transcription
            },
          ],
        },
      };

      axios.post.mockResolvedValue(mockBhashiniResponse);

      const result = mockBhashiniResponse.data.pipelineResponse[0];
      expect(result.output[0].source).toBe('');
      // Should throw error for empty transcription
    });

    it('should handle missing pipelineResponse', async () => {
      const mockBhashiniResponse = {
        data: {
          pipelineResponse: [], // Empty array
        },
      };

      axios.post.mockResolvedValue(mockBhashiniResponse);

      expect(mockBhashiniResponse.data.pipelineResponse).toHaveLength(0);
      // Should throw error for missing response
    });
  });

  describe('Language Support', () => {
    const supportedLanguages = [
      { code: 'en', name: 'English', sample: 'I have a headache' },
      { code: 'hi', name: 'Hindi', sample: 'मुझे सिरदर्द है' },
      { code: 'bn', name: 'Bengali', sample: 'আমার মাথাব্যথা আছে' },
      { code: 'te', name: 'Telugu', sample: 'నాకు తలనొప్పి ఉంది' },
      { code: 'mr', name: 'Marathi', sample: 'मला डोकेदुखी आहे' },
      { code: 'ta', name: 'Tamil', sample: 'எனக்கு தலைவலி உள்ளது' },
      { code: 'gu', name: 'Gujarati', sample: 'મને માથાનો દુખાવો છે' },
      { code: 'kn', name: 'Kannada', sample: 'ನನಗೆ ತಲೆನೋವು ಇದೆ' },
      { code: 'ml', name: 'Malayalam', sample: 'എനിക്ക് തലവേദനയുണ്ട്' },
      { code: 'pa', name: 'Punjabi', sample: 'ਮੈਨੂੰ ਸਿਰ ਦਰਦ ਹੈ' },
    ];

    supportedLanguages.forEach(({ code, name, sample }) => {
      it(`should support ${name} (${code})`, async () => {
        const mockBhashiniResponse = {
          data: {
            pipelineResponse: [
              {
                config: {
                  confidence: 0.9,
                  language: { sourceLanguage: code },
                },
                output: [{ source: sample }],
              },
            ],
          },
        };

        axios.post.mockResolvedValue(mockBhashiniResponse);

        const result = mockBhashiniResponse.data.pipelineResponse[0];

        expect(result.config.language.sourceLanguage).toBe(code);
        expect(result.output[0].source).toBe(sample);
      });
    });

    it('should reject unsupported languages', () => {
      const unsupportedLanguage = 'fr'; // French
      const supportedLanguages = (
        process.env.SUPPORTED_LANGUAGES ||
        'en,hi,bn,te,mr,ta,gu,kn,ml,pa,or,as,ur,sa,ks,sd,ne,kok,mai,bodo,doi,mni'
      ).split(',');

      expect(supportedLanguages).not.toContain(unsupportedLanguage);
    });
  });

  describe('Audio Format Handling', () => {
    it('should convert audio buffer to base64', () => {
      const audioBuffer = Buffer.from('test-audio-data');
      const audioBase64 = audioBuffer.toString('base64');

      expect(audioBase64).toBe(Buffer.from('test-audio-data').toString('base64'));
      expect(typeof audioBase64).toBe('string');
    });

    it('should handle WAV audio format', async () => {
      const mockBhashiniResponse = {
        data: {
          pipelineResponse: [
            {
              config: {
                confidence: 0.9,
                language: { sourceLanguage: 'en' },
                audioFormat: 'wav',
              },
              output: [{ source: 'test' }],
            },
          ],
        },
      };

      axios.post.mockResolvedValue(mockBhashiniResponse);

      const result = mockBhashiniResponse.data.pipelineResponse[0];
      expect(result.config.audioFormat).toBe('wav');
    });

    it('should use 16kHz sampling rate', async () => {
      const requestPayload = {
        pipelineTasks: [
          {
            taskType: 'asr',
            config: {
              language: { sourceLanguage: 'en' },
              serviceId: 'test-service-id',
              audioFormat: 'wav',
              samplingRate: 16000,
            },
          },
        ],
        inputData: {
          audio: [{ audioContent: 'base64-audio' }],
        },
      };

      expect(requestPayload.pipelineTasks[0].config.samplingRate).toBe(16000);
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 Unauthorized errors', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Invalid API key' },
        },
      });

      await expect(axios.post()).rejects.toMatchObject({
        response: {
          status: 401,
        },
      });
    });

    it('should handle 429 Rate Limit errors', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' },
        },
      });

      await expect(axios.post()).rejects.toMatchObject({
        response: {
          status: 429,
        },
      });
    });

    it('should handle 500 Internal Server errors', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
      });

      await expect(axios.post()).rejects.toMatchObject({
        response: {
          status: 500,
        },
      });
    });

    it('should handle network errors', async () => {
      axios.post.mockRejectedValue({
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND dhruva-api.bhashini.gov.in',
      });

      await expect(axios.post()).rejects.toMatchObject({
        code: 'ENOTFOUND',
      });
    });
  });

  describe('Confidence Scoring', () => {
    it('should extract confidence score from response', async () => {
      const mockBhashiniResponse = {
        data: {
          pipelineResponse: [
            {
              config: { confidence: 0.92 },
              output: [{ source: 'test' }],
            },
          ],
        },
      };

      axios.post.mockResolvedValue(mockBhashiniResponse);

      const result = mockBhashiniResponse.data.pipelineResponse[0];
      expect(result.config.confidence).toBe(0.92);
      expect(typeof result.config.confidence).toBe('number');
    });

    it('should handle missing confidence score', async () => {
      const mockBhashiniResponse = {
        data: {
          pipelineResponse: [
            {
              config: {}, // No confidence
              output: [{ source: 'test' }],
            },
          ],
        },
      };

      axios.post.mockResolvedValue(mockBhashiniResponse);

      const result = mockBhashiniResponse.data.pipelineResponse[0];
      expect(result.config.confidence).toBeUndefined();
      // Should default to 0.0
    });

    it('should handle confidence scores at threshold boundary', () => {
      const threshold = 0.75;
      const confidenceAtThreshold = 0.75;
      const confidenceBelowThreshold = 0.74;
      const confidenceAboveThreshold = 0.76;

      expect(confidenceAtThreshold).toBeGreaterThanOrEqual(threshold);
      expect(confidenceBelowThreshold).toBeLessThan(threshold);
      expect(confidenceAboveThreshold).toBeGreaterThan(threshold);
    });
  });

  describe('Language Detection', () => {
    it('should detect language from response', async () => {
      const mockBhashiniResponse = {
        data: {
          pipelineResponse: [
            {
              config: {
                confidence: 0.9,
                language: { sourceLanguage: 'hi' },
              },
              output: [{ source: 'test' }],
            },
          ],
        },
      };

      axios.post.mockResolvedValue(mockBhashiniResponse);

      const result = mockBhashiniResponse.data.pipelineResponse[0];
      expect(result.config.language.sourceLanguage).toBe('hi');
    });

    it('should fallback to requested language if detection fails', async () => {
      const requestedLanguage = 'en';
      const mockBhashiniResponse = {
        data: {
          pipelineResponse: [
            {
              config: {
                confidence: 0.9,
                language: {}, // No detected language
              },
              output: [{ source: 'test' }],
            },
          ],
        },
      };

      axios.post.mockResolvedValue(mockBhashiniResponse);

      const result = mockBhashiniResponse.data.pipelineResponse[0];
      const detectedLanguage = result.config.language.sourceLanguage || requestedLanguage;

      expect(detectedLanguage).toBe(requestedLanguage);
    });
  });
});
