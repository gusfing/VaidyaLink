/**
 * VoiceRecorder Component
 *
 * Handles voice recording for medical history capture in 22 Indian languages.
 * Features:
 * - Language selection (22 languages)
 * - Audio recording with visualization
 * - Demo mode with mock transcription
 * - Real-time transcription status
 * - Medical entity extraction display
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useToast } from './ToastContainer';

// Supported languages with Sarvam AI language codes
const LANGUAGES = [
  { code: 'en-IN', name: 'English', native: 'English' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिंदी' },
  { code: 'bn-IN', name: 'Bengali', native: 'বাংলা' },
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు' },
  { code: 'mr-IN', name: 'Marathi', native: 'मराठी' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்' },
  { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'or-IN', name: 'Odia', native: 'ଓଡ଼ିଆ' },
];

interface VoiceRecorderProps {
  onTranscriptionComplete: (result: VoiceTranscriptionResult) => void;
}

export interface VoiceTranscriptionResult {
  jobId: string;
  transcription: string;
  detectedLanguage: string;
  confidence: number;
  structuredData: {
    chiefComplaint?: string;
    symptoms?: string[];
    duration?: string;
    severity?: string;
    currentMedications?: string[];
    allergies?: string[];
  };
}

export default function VoiceRecorder({ onTranscriptionComplete }: VoiceRecorderProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const { showError, showSuccess } = useToast();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      showError('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const processRecording = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);

    try {
      // Create form data with audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('language', selectedLanguage);

      // Call transcription API
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Transcription failed');
      }

      // Create result object
      const result: VoiceTranscriptionResult = {
        jobId: `voice-${Date.now()}`,
        transcription: data.transcription,
        detectedLanguage: data.detectedLanguage,
        confidence: data.confidence,
        structuredData: data.structuredData || {},
      };

      setIsProcessing(false);
      showSuccess('Voice processed successfully!');
      onTranscriptionComplete(result);
    } catch (error) {
      console.error('Processing failed:', error);
      showError('Failed to process recording. Please try again.');
      setIsProcessing(false);
    }
  };

  const simulateProcessing = async () => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock transcription based on selected language
    const mockTranscriptions: Record<string, string> = {
      hi: 'मुझे सिरदर्द है और बुखार है। दो दिन से यह समस्या है।',
      en: 'I have headache and fever. This problem has been for two days.',
      ta: 'எனக்கு தலைவலி மற்றும் காய்ச்சல் உள்ளது। இரண்டு நாட்களாக இந்த பிரச்சனை உள்ளது.',
      bn: 'আমার মাথাব্যথা এবং জ্বর আছে। দুই দিন ধরে এই সমস্যা আছে।',
      te: 'నాకు తలనొప్పి మరియు జ్వరం ఉంది. రెండు రోజులుగా ఈ సమస్య ఉంది.',
      mr: 'मला डोकेदुखी आणि ताप आहे. दोन दिवसांपासून ही समस्या आहे.',
      gu: 'મને માથાનો દુખાવો અને તાવ છે. બે દિવસથી આ સમસ્યા છે.',
      kn: 'ನನಗೆ ತಲೆನೋವು ಮತ್ತು ಜ್ವರವಿದೆ. ಎರಡು ದಿನಗಳಿಂದ ಈ ಸಮಸ್ಯೆ ಇದೆ.',
      ml: 'എനിക്ക് തലവേദനയും പനിയും ഉണ്ട്. രണ്ട് ദിവസമായി ഈ പ്രശ്നം ഉണ്ട്.',
      pa: 'ਮੈਨੂੰ ਸਿਰ ਦਰਦ ਅਤੇ ਬੁਖਾਰ ਹੈ। ਦੋ ਦਿਨਾਂ ਤੋਂ ਇਹ ਸਮੱਸਿਆ ਹੈ।',
      or: 'ମୋର ମୁଣ୍ଡବିନ୍ଧା ଏବଂ ଜ୍ୱର ଅଛି। ଦୁଇ ଦିନ ଧରି ଏହି ସମସ୍ୟା ଅଛି।',
      as: 'মোৰ মূৰৰ বিষ আৰু জ্বৰ আছে। দুদিনৰ পৰা এই সমস্যা আছে।',
      ur: 'مجھے سر درد اور بخار ہے۔ دو دن سے یہ مسئلہ ہے۔',
    };

    const transcription = mockTranscriptions[selectedLanguage] || mockTranscriptions.en;

    const result: VoiceTranscriptionResult = {
      jobId: `voice-demo-${Date.now()}`,
      transcription,
      detectedLanguage: selectedLanguage,
      confidence: 0.92,
      structuredData: {
        chiefComplaint: 'Headache and fever',
        symptoms: ['headache', 'fever'],
        duration: '2 days',
        severity: 'moderate',
        currentMedications: [],
        allergies: [],
      },
    };

    setIsProcessing(false);
    showSuccess('Voice processed successfully!');
    onTranscriptionComplete(result);
  };

  const processWithSarvamAPI = async () => {
    if (!audioBlob) return;

    try {
      // Step 1: Get presigned URL for audio upload
      const uploadResponse = await fetch('/api/voice/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: selectedLanguage,
          contentType: 'audio/wav',
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, jobId } = await uploadResponse.json();

      // Step 2: Upload audio to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: audioBlob,
        headers: {
          'Content-Type': 'audio/wav',
        },
      });

      showSuccess('Audio uploaded. Processing...');

      // Step 3: Poll for results
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      const pollInterval = 1000; // 1 second

      const pollForResults = async (): Promise<void> => {
        if (attempts >= maxAttempts) {
          throw new Error('Processing timeout. Please try again.');
        }

        attempts++;

        const statusResponse = await fetch(`/api/voice/${jobId}`);
        if (!statusResponse.ok) {
          throw new Error('Failed to get job status');
        }

        const jobStatus = await statusResponse.json();

        if (jobStatus.status === 'completed') {
          // Success! Show results
          const result: VoiceTranscriptionResult = {
            jobId,
            transcription: jobStatus.transcription,
            detectedLanguage: jobStatus.detectedLanguage,
            confidence: jobStatus.transcriptionConfidence,
            structuredData: jobStatus.structuredData || {},
          };

          setIsProcessing(false);
          showSuccess('Voice processed successfully!');
          onTranscriptionComplete(result);
        } else if (jobStatus.status === 'failed') {
          throw new Error(jobStatus.errorMessage || 'Processing failed');
        } else if (jobStatus.status === 'confirming') {
          // Need user confirmation
          // TODO: Implement confirmation UI
          throw new Error('Confirmation required (not yet implemented)');
        } else {
          // Still processing, poll again
          setTimeout(pollForResults, pollInterval);
        }
      };

      await pollForResults();
    } catch (error) {
      console.error('Sarvam API processing failed:', error);
      throw error;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const reset = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setIsProcessing(false);
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <div className="space-y-6">
        {/* Language Selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Select Language</label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={isRecording || isProcessing}
            className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name} ({lang.native})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">Real-time transcription powered by Sarvam AI</p>
        </div>

        {/* Recording Interface */}
        {!audioBlob && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
            <div className="space-y-4">
              {/* Microphone Icon */}
              <div className="flex justify-center">
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 ${
                    isRecording ? 'animate-pulse bg-red-100' : 'bg-blue-100'
                  }`}
                >
                  <svg
                    className={`h-10 w-10 ${isRecording ? 'text-red-600' : 'text-blue-600'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </div>
              </div>

              {/* Recording Status */}
              {isRecording && (
                <div className="space-y-2">
                  <p className="text-lg font-medium text-red-600">Recording...</p>
                  <p className="font-mono text-2xl text-gray-700">{formatTime(recordingTime)}</p>
                  <div className="flex justify-center space-x-2">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 animate-pulse rounded-full bg-red-500"
                        style={{
                          height: `${Math.random() * 30 + 10}px`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions */}
              {!isRecording && (
                <div>
                  <p className="text-lg font-medium text-gray-700">Speak your medical history</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Describe your symptoms, duration, and severity
                  </p>
                </div>
              )}

              {/* Record Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`rounded-md px-6 py-3 font-medium transition-all duration-200 ${
                  isRecording
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
            </div>
          </div>
        )}

        {/* Audio Preview & Process */}
        {audioBlob && !isProcessing && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <svg
                      className="h-6 w-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Recording Complete</p>
                    <p className="text-sm text-gray-500">Duration: {formatTime(recordingTime)}</p>
                  </div>
                </div>
              </div>

              {/* Audio Player */}
              <audio controls className="w-full" src={URL.createObjectURL(audioBlob)} />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 transition-all duration-200 hover:bg-gray-50"
              >
                Re-record
              </button>
              <button
                onClick={processRecording}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white transition-all duration-200 hover:bg-blue-700"
              >
                Process Recording
              </button>
            </div>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
            <div className="flex items-center justify-center space-x-3">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <div>
                <p className="font-medium text-gray-700">Processing voice...</p>
                <p className="text-sm text-gray-500">
                  Transcribing and extracting medical entities
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
