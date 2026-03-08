/**
 * Audio Generation Module using Amazon Polly
 *
 * This module generates playback audio from transcribed text for user confirmation.
 * It supports multilingual text-to-speech for all 22 Indian languages using Amazon Polly.
 *
 * Key Features:
 * - Text-to-speech generation for confirmation playback
 * - Multilingual support for Indian languages
 * - Neural voice selection for natural speech
 * - Audio format optimization for web playback
 * - S3 storage integration
 */

const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Voice mapping for supported languages
 * Maps ISO 639-1 language codes to Amazon Polly voice IDs
 */
const LANGUAGE_VOICE_MAP = {
  en: { voiceId: 'Kajal', engine: 'neural', languageCode: 'en-IN' }, // Indian English
  hi: { voiceId: 'Kajal', engine: 'neural', languageCode: 'hi-IN' }, // Hindi
  bn: { voiceId: 'Kajal', engine: 'standard', languageCode: 'en-IN' }, // Bengali (fallback to English)
  te: { voiceId: 'Kajal', engine: 'standard', languageCode: 'en-IN' }, // Telugu (fallback)
  mr: { voiceId: 'Kajal', engine: 'standard', languageCode: 'en-IN' }, // Marathi (fallback)
  ta: { voiceId: 'Kajal', engine: 'standard', languageCode: 'en-IN' }, // Tamil (fallback)
  gu: { voiceId: 'Kajal', engine: 'standard', languageCode: 'en-IN' }, // Gujarati (fallback)
  kn: { voiceId: 'Kajal', engine: 'standard', languageCode: 'en-IN' }, // Kannada (fallback)
  ml: { voiceId: 'Kajal', engine: 'standard', languageCode: 'en-IN' }, // Malayalam (fallback)
  pa: { voiceId: 'Kajal', engine: 'standard', languageCode: 'en-IN' }, // Punjabi (fallback)
  or: { voiceId: 'Kajal', engine: 'standard', languageCode: 'en-IN' }, // Odia (fallback)
  as: { voiceId: 'Kajal', engine: 'standard', languageCode: 'en-IN' }, // Assamese (fallback)
  ur: { voiceId: 'Kajal', engine: 'standard', languageCode: 'en-IN' }, // Urdu (fallback)
};

/**
 * Audio Generator class
 */
class AudioGenerator {
  /**
   * Initialize the audio generator
   *
   * @param {Object} options - Configuration options
   * @param {string} options.region - AWS region
   * @param {string} options.s3Bucket - S3 bucket for audio storage
   * @param {string} options.outputFormat - Audio output format (mp3, ogg_vorbis, pcm)
   * @param {string} options.sampleRate - Audio sample rate (8000, 16000, 22050, 24000)
   */
  constructor(options = {}) {
    this.region = options.region || process.env.AWS_REGION || 'us-east-1';
    this.s3Bucket = options.s3Bucket || process.env.S3_AUDIO_BUCKET;
    this.outputFormat = options.outputFormat || 'mp3';
    this.sampleRate = options.sampleRate || '22050';

    // Initialize AWS clients
    this.pollyClient = new PollyClient({ region: this.region });
    this.s3Client = new S3Client({ region: this.region });

    console.log(
      `AudioGenerator initialized (format: ${this.outputFormat}, rate: ${this.sampleRate})`
    );
  }

  /**
   * Generate playback audio from transcription text
   *
   * @param {string} text - Transcription text to convert to speech
   * @param {string} language - Language code (ISO 639-1)
   * @param {string} jobId - Voice job ID for S3 storage
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Audio generation result with S3 URL
   */
  async generatePlaybackAudio(text, language, jobId, options = {}) {
    try {
      console.log(`Generating playback audio for job ${jobId} (language: ${language})`);

      // Validate input
      if (!text || text.trim().length === 0) {
        throw new Error('Text is required for audio generation');
      }

      if (!jobId) {
        throw new Error('Job ID is required for audio generation');
      }

      // Get voice configuration for language
      const voiceConfig = this._getVoiceConfig(language);

      // Prepare text for speech synthesis
      const preparedText = this._prepareTextForSpeech(text, language);

      // Generate speech using Amazon Polly
      const audioBuffer = await this._synthesizeSpeech(preparedText, voiceConfig, options);

      // Upload audio to S3
      const s3Key = `playback/${jobId}/confirmation.${this.outputFormat}`;
      const s3Url = await this._uploadToS3(audioBuffer, s3Key);

      console.log(`Playback audio generated successfully: ${s3Url}`);

      return {
        success: true,
        s3Url,
        s3Key,
        s3Bucket: this.s3Bucket,
        format: this.outputFormat,
        sampleRate: this.sampleRate,
        language,
        voiceId: voiceConfig.voiceId,
        textLength: text.length,
        audioSize: audioBuffer.length,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error generating playback audio:', error);
      throw new Error(`Audio generation failed: ${error.message}`);
    }
  }

  /**
   * Get voice configuration for language
   *
   * @private
   * @param {string} language - Language code
   * @returns {Object} Voice configuration
   */
  _getVoiceConfig(language) {
    // Get voice config or fallback to English
    const config = LANGUAGE_VOICE_MAP[language] || LANGUAGE_VOICE_MAP['en'];

    console.log(`Using voice: ${config.voiceId} (${config.languageCode}, ${config.engine})`);

    return config;
  }

  /**
   * Prepare text for speech synthesis
   *
   * @private
   * @param {string} text - Original text
   * @param {string} language - Language code
   * @returns {string} Prepared text with SSML if needed
   */
  _prepareTextForSpeech(text, language) {
    // Trim and clean text
    let preparedText = text.trim();

    // Limit text length (Polly has a 3000 character limit for standard, 6000 for neural)
    const maxLength = 2500; // Safe limit
    if (preparedText.length > maxLength) {
      console.warn(`Text truncated from ${preparedText.length} to ${maxLength} characters`);
      preparedText = preparedText.substring(0, maxLength) + '...';
    }

    // Add confirmation prefix in appropriate language
    const confirmationPrefix = this._getConfirmationPrefix(language);
    preparedText = `${confirmationPrefix} ${preparedText}`;

    return preparedText;
  }

  /**
   * Get confirmation prefix in appropriate language
   *
   * @private
   * @param {string} language - Language code
   * @returns {string} Confirmation prefix
   */
  _getConfirmationPrefix(language) {
    const prefixes = {
      en: 'Please confirm if this is correct:',
      hi: 'कृपया पुष्टि करें कि यह सही है:',
      bn: 'অনুগ্রহ করে নিশ্চিত করুন এটি সঠিক কিনা:',
      te: 'దయచేసి ఇది సరైనదో నిర్ధారించండి:',
      mr: 'कृपया हे बरोबर आहे का याची पुष्टी करा:',
      ta: 'இது சரியானதா என்பதை உறுதிப்படுத்தவும்:',
      gu: 'કૃપા કરીને પુષ્ટિ કરો કે આ સાચું છે:',
      kn: 'ದಯವಿಟ್ಟು ಇದು ಸರಿಯಾಗಿದೆಯೇ ಎಂದು ದೃಢೀಕರಿಸಿ:',
      ml: 'ഇത് ശരിയാണോ എന്ന് ദയവായി സ്ഥിരീകരിക്കുക:',
      pa: 'ਕਿਰਪਾ ਕਰਕੇ ਪੁਸ਼ਟੀ ਕਰੋ ਕਿ ਇਹ ਸਹੀ ਹੈ:',
      or: 'ଦୟାକରି ନିଶ୍ଚିତ କରନ୍ତୁ ଏହା ସଠିକ୍ କି ନୁହେଁ:',
      as: 'অনুগ্ৰহ কৰি নিশ্চিত কৰক এইটো শুদ্ধ নে:',
      ur: 'براہ کرم تصدیق کریں کہ یہ درست ہے:',
    };

    return prefixes[language] || prefixes['en'];
  }

  /**
   * Synthesize speech using Amazon Polly
   *
   * @private
   * @param {string} text - Text to synthesize
   * @param {Object} voiceConfig - Voice configuration
   * @param {Object} options - Additional options
   * @returns {Promise<Buffer>} Audio buffer
   */
  async _synthesizeSpeech(text, voiceConfig, options = {}) {
    try {
      const command = new SynthesizeSpeechCommand({
        Text: text,
        OutputFormat: this.outputFormat,
        VoiceId: voiceConfig.voiceId,
        Engine: voiceConfig.engine,
        LanguageCode: voiceConfig.languageCode,
        SampleRate: this.sampleRate,
        TextType: options.useSSML ? 'ssml' : 'text',
      });

      const response = await this.pollyClient.send(command);

      // Convert audio stream to buffer
      const chunks = [];
      for await (const chunk of response.AudioStream) {
        chunks.push(chunk);
      }

      const audioBuffer = Buffer.concat(chunks);

      console.log(`Speech synthesized: ${audioBuffer.length} bytes`);

      return audioBuffer;
    } catch (error) {
      console.error('Polly synthesis error:', error);
      throw new Error(`Speech synthesis failed: ${error.message}`);
    }
  }

  /**
   * Upload audio to S3
   *
   * @private
   * @param {Buffer} audioBuffer - Audio data
   * @param {string} key - S3 object key
   * @returns {Promise<string>} S3 URL
   */
  async _uploadToS3(audioBuffer, key) {
    try {
      const contentType = this._getContentType(this.outputFormat);

      const command = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
        Body: audioBuffer,
        ContentType: contentType,
        ServerSideEncryption: 'aws:kms',
        Metadata: {
          generatedBy: 'vaidyalink-audio-generator',
          generatedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);

      const s3Url = `s3://${this.s3Bucket}/${key}`;
      console.log(`Audio uploaded to S3: ${s3Url}`);

      return s3Url;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload audio to S3: ${error.message}`);
    }
  }

  /**
   * Get content type for audio format
   *
   * @private
   * @param {string} format - Audio format
   * @returns {string} MIME type
   */
  _getContentType(format) {
    const contentTypes = {
      mp3: 'audio/mpeg',
      ogg_vorbis: 'audio/ogg',
      pcm: 'audio/pcm',
    };

    return contentTypes[format] || 'audio/mpeg';
  }

  /**
   * Generate pre-signed URL for audio playback
   *
   * @param {string} s3Key - S3 object key
   * @param {number} expiresIn - URL expiration in seconds (default: 3600)
   * @returns {Promise<string>} Pre-signed URL
   */
  async generatePresignedUrl(s3Key, expiresIn = 3600) {
    try {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      const { GetObjectCommand } = require('@aws-sdk/client-s3');

      const command = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: s3Key,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      console.log(`Pre-signed URL generated (expires in ${expiresIn}s)`);

      return presignedUrl;
    } catch (error) {
      console.error('Error generating pre-signed URL:', error);
      throw new Error(`Failed to generate pre-signed URL: ${error.message}`);
    }
  }
}

/**
 * Factory function to create AudioGenerator instance
 *
 * @param {Object} options - Configuration options
 * @returns {AudioGenerator} Generator instance
 */
function createAudioGenerator(options = {}) {
  const config = {
    region: options.region || process.env.AWS_REGION,
    s3Bucket: options.s3Bucket || process.env.S3_AUDIO_BUCKET,
    outputFormat: options.outputFormat || process.env.AUDIO_OUTPUT_FORMAT || 'mp3',
    sampleRate: options.sampleRate || process.env.AUDIO_SAMPLE_RATE || '22050',
  };

  return new AudioGenerator(config);
}

module.exports = {
  AudioGenerator,
  createAudioGenerator,
  LANGUAGE_VOICE_MAP,
};
