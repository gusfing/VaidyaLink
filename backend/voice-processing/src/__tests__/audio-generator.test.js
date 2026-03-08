/**
 * Tests for Audio Generator Module
 */

const {
  AudioGenerator,
  createAudioGenerator,
  LANGUAGE_VOICE_MAP,
} = require('../utils/audio-generator');
const { mockClient } = require('aws-sdk-client-mock');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Mock AWS clients
const pollyMock = mockClient(PollyClient);
const s3Mock = mockClient(S3Client);

describe('AudioGenerator', () => {
  let audioGenerator;

  beforeEach(() => {
    // Reset mocks
    pollyMock.reset();
    s3Mock.reset();

    // Create generator instance
    audioGenerator = new AudioGenerator({
      region: 'us-east-1',
      s3Bucket: 'test-audio-bucket',
      outputFormat: 'mp3',
      sampleRate: '22050',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePlaybackAudio', () => {
    it('should generate playback audio successfully', async () => {
      const mockAudioStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('mock-audio-data');
        },
      };

      pollyMock.on(SynthesizeSpeechCommand).resolves({
        AudioStream: mockAudioStream,
      });

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await audioGenerator.generatePlaybackAudio(
        'Patient has fever and headache',
        'en',
        'job-123'
      );

      expect(result.success).toBe(true);
      expect(result.s3Key).toBe('playback/job-123/confirmation.mp3');
      expect(result.s3Bucket).toBe('test-audio-bucket');
      expect(result.format).toBe('mp3');
      expect(result.language).toBe('en');
      expect(result.voiceId).toBe('Kajal');
    });

    it('should handle Hindi language', async () => {
      const mockAudioStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('mock-audio-data');
        },
      };

      pollyMock.on(SynthesizeSpeechCommand).resolves({
        AudioStream: mockAudioStream,
      });

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await audioGenerator.generatePlaybackAudio(
        'मरीज को बुखार और सिरदर्द है',
        'hi',
        'job-456'
      );

      expect(result.success).toBe(true);
      expect(result.language).toBe('hi');
      expect(result.voiceId).toBe('Kajal');
    });

    it('should throw error for empty text', async () => {
      await expect(audioGenerator.generatePlaybackAudio('', 'en', 'job-123')).rejects.toThrow(
        'Text is required for audio generation'
      );
    });

    it('should throw error for missing job ID', async () => {
      await expect(audioGenerator.generatePlaybackAudio('Test text', 'en', '')).rejects.toThrow(
        'Job ID is required for audio generation'
      );
    });

    it('should truncate long text', async () => {
      const longText = 'a'.repeat(3000);

      const mockAudioStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('mock-audio-data');
        },
      };

      pollyMock.on(SynthesizeSpeechCommand).resolves({
        AudioStream: mockAudioStream,
      });

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await audioGenerator.generatePlaybackAudio(longText, 'en', 'job-789');

      expect(result.success).toBe(true);
      expect(result.textLength).toBe(3000);
    });

    it('should handle Polly API errors', async () => {
      pollyMock.on(SynthesizeSpeechCommand).rejects(new Error('Polly API error'));

      await expect(
        audioGenerator.generatePlaybackAudio('Test text', 'en', 'job-123')
      ).rejects.toThrow('Audio generation failed');
    });

    it('should handle S3 upload errors', async () => {
      const mockAudioStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('mock-audio-data');
        },
      };

      pollyMock.on(SynthesizeSpeechCommand).resolves({
        AudioStream: mockAudioStream,
      });

      s3Mock.on(PutObjectCommand).rejects(new Error('S3 upload failed'));

      await expect(
        audioGenerator.generatePlaybackAudio('Test text', 'en', 'job-123')
      ).rejects.toThrow('Audio generation failed');
    });
  });

  describe('_getVoiceConfig', () => {
    it('should return correct voice config for English', () => {
      const config = audioGenerator._getVoiceConfig('en');

      expect(config.voiceId).toBe('Kajal');
      expect(config.engine).toBe('neural');
      expect(config.languageCode).toBe('en-IN');
    });

    it('should return correct voice config for Hindi', () => {
      const config = audioGenerator._getVoiceConfig('hi');

      expect(config.voiceId).toBe('Kajal');
      expect(config.languageCode).toBe('hi-IN');
    });

    it('should fallback to English for unsupported language', () => {
      const config = audioGenerator._getVoiceConfig('xyz');

      expect(config.voiceId).toBe('Kajal');
      expect(config.languageCode).toBe('en-IN');
    });
  });

  describe('_prepareTextForSpeech', () => {
    it('should add confirmation prefix in English', () => {
      const prepared = audioGenerator._prepareTextForSpeech('Patient has fever', 'en');

      expect(prepared).toContain('Please confirm if this is correct:');
      expect(prepared).toContain('Patient has fever');
    });

    it('should add confirmation prefix in Hindi', () => {
      const prepared = audioGenerator._prepareTextForSpeech('मरीज को बुखार है', 'hi');

      expect(prepared).toContain('कृपया पुष्टि करें कि यह सही है:');
      expect(prepared).toContain('मरीज को बुखार है');
    });

    it('should trim whitespace', () => {
      const prepared = audioGenerator._prepareTextForSpeech('  Test text  ', 'en');

      expect(prepared).not.toMatch(/^\s+/);
      expect(prepared).not.toMatch(/\s+$/);
    });

    it('should truncate text exceeding max length', () => {
      const longText = 'a'.repeat(3000);
      const prepared = audioGenerator._prepareTextForSpeech(longText, 'en');

      expect(prepared.length).toBeLessThan(3000);
      expect(prepared).toContain('...');
    });
  });

  describe('_getConfirmationPrefix', () => {
    it('should return English prefix', () => {
      const prefix = audioGenerator._getConfirmationPrefix('en');
      expect(prefix).toBe('Please confirm if this is correct:');
    });

    it('should return Hindi prefix', () => {
      const prefix = audioGenerator._getConfirmationPrefix('hi');
      expect(prefix).toBe('कृपया पुष्टि करें कि यह सही है:');
    });

    it('should return Tamil prefix', () => {
      const prefix = audioGenerator._getConfirmationPrefix('ta');
      expect(prefix).toBe('இது சரியானதா என்பதை உறுதிப்படுத்தவும்:');
    });

    it('should fallback to English for unsupported language', () => {
      const prefix = audioGenerator._getConfirmationPrefix('xyz');
      expect(prefix).toBe('Please confirm if this is correct:');
    });
  });

  describe('_getContentType', () => {
    it('should return correct content type for mp3', () => {
      const contentType = audioGenerator._getContentType('mp3');
      expect(contentType).toBe('audio/mpeg');
    });

    it('should return correct content type for ogg_vorbis', () => {
      const contentType = audioGenerator._getContentType('ogg_vorbis');
      expect(contentType).toBe('audio/ogg');
    });

    it('should return correct content type for pcm', () => {
      const contentType = audioGenerator._getContentType('pcm');
      expect(contentType).toBe('audio/pcm');
    });

    it('should fallback to audio/mpeg for unknown format', () => {
      const contentType = audioGenerator._getContentType('unknown');
      expect(contentType).toBe('audio/mpeg');
    });
  });

  describe('createAudioGenerator', () => {
    it('should create AudioGenerator instance with default config', () => {
      const generator = createAudioGenerator();

      expect(generator).toBeInstanceOf(AudioGenerator);
    });

    it('should create AudioGenerator instance with custom config', () => {
      const generator = createAudioGenerator({
        region: 'ap-south-1',
        s3Bucket: 'custom-bucket',
        outputFormat: 'ogg_vorbis',
        sampleRate: '16000',
      });

      expect(generator).toBeInstanceOf(AudioGenerator);
      expect(generator.region).toBe('ap-south-1');
      expect(generator.s3Bucket).toBe('custom-bucket');
      expect(generator.outputFormat).toBe('ogg_vorbis');
      expect(generator.sampleRate).toBe('16000');
    });
  });

  describe('LANGUAGE_VOICE_MAP', () => {
    it('should have voice config for English', () => {
      expect(LANGUAGE_VOICE_MAP.en).toBeDefined();
      expect(LANGUAGE_VOICE_MAP.en.voiceId).toBe('Kajal');
    });

    it('should have voice config for Hindi', () => {
      expect(LANGUAGE_VOICE_MAP.hi).toBeDefined();
      expect(LANGUAGE_VOICE_MAP.hi.voiceId).toBe('Kajal');
    });

    it('should have voice configs for all major Indian languages', () => {
      const languages = ['en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml', 'pa'];

      languages.forEach((lang) => {
        expect(LANGUAGE_VOICE_MAP[lang]).toBeDefined();
        expect(LANGUAGE_VOICE_MAP[lang].voiceId).toBeTruthy();
        expect(LANGUAGE_VOICE_MAP[lang].languageCode).toBeTruthy();
      });
    });
  });
});
