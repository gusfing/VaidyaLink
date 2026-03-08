/**
 * Voice Transcription API Route
 *
 * Handles direct transcription using Sarvam AI API
 * No S3 or Lambda required - processes audio directly
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const language = formData.get('language') as string;

    console.log('Received transcription request:', {
      hasAudio: !!audioFile,
      language,
      audioSize: audioFile?.size,
    });

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Get Sarvam API key from environment
    const sarvamApiKey = process.env.NEXT_PUBLIC_SARVAM_API_KEY;

    if (!sarvamApiKey) {
      console.error('Sarvam API key not configured');
      return NextResponse.json(
        { error: 'Voice transcription service not configured' },
        { status: 500 }
      );
    }

    console.log('Sarvam API key found, processing audio...');

    // Convert audio file to buffer for Sarvam API
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });

    // Create form data for Sarvam API
    const sarvamFormData = new FormData();
    sarvamFormData.append('file', audioBlob, 'audio.wav');
    sarvamFormData.append('language_code', language || 'hi-IN');
    sarvamFormData.append('model', 'saarika:v2.5');

    console.log('Calling Sarvam API...');

    // Call Sarvam AI API
    const sarvamResponse = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': sarvamApiKey,
      },
      body: sarvamFormData,
    });

    console.log('Sarvam API response status:', sarvamResponse.status);

    if (!sarvamResponse.ok) {
      const errorText = await sarvamResponse.text();
      console.error('Sarvam API error:', errorText);
      return NextResponse.json(
        { error: 'Transcription failed', details: errorText },
        { status: sarvamResponse.status }
      );
    }

    const sarvamData = await sarvamResponse.json();
    console.log('Sarvam API response:', sarvamData);

    // Extract transcription from Sarvam response
    const transcription = sarvamData.transcript || '';

    if (!transcription) {
      console.error('No transcription in response:', sarvamData);
      return NextResponse.json({ error: 'No transcription returned' }, { status: 500 });
    }

    // Simple medical entity extraction (basic pattern matching)
    const structuredData = extractMedicalEntities(transcription);

    console.log('Transcription successful:', {
      transcriptionLength: transcription.length,
      language,
    });

    return NextResponse.json({
      success: true,
      transcription,
      detectedLanguage: language || 'hi',
      confidence: 0.9,
      structuredData,
    });
  } catch (error) {
    console.error('Voice transcription error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Extract medical entities from transcription text
 * Simple pattern matching for common medical terms
 */
function extractMedicalEntities(text: string) {
  const lowerText = text.toLowerCase();

  // Common symptoms
  const symptomPatterns = [
    'headache',
    'fever',
    'cough',
    'cold',
    'pain',
    'nausea',
    'vomiting',
    'diarrhea',
    'fatigue',
    'weakness',
    'dizziness',
    'chest pain',
    'सिरदर्द',
    'बुखार',
    'खांसी',
    'दर्द',
    'कमजोरी',
  ];

  const symptoms: string[] = [];
  symptomPatterns.forEach((symptom) => {
    if (lowerText.includes(symptom)) {
      symptoms.push(symptom);
    }
  });

  // Duration patterns
  let duration = '';
  const durationMatch = text.match(/(\d+)\s*(day|days|week|weeks|month|months|दिन|सप्ताह|महीने)/i);
  if (durationMatch) {
    duration = durationMatch[0];
  }

  // Severity patterns
  let severity = 'moderate';
  if (lowerText.includes('severe') || lowerText.includes('गंभीर') || lowerText.includes('बहुत')) {
    severity = 'severe';
  } else if (lowerText.includes('mild') || lowerText.includes('हल्का')) {
    severity = 'mild';
  }

  // Chief complaint (first sentence or first 100 chars)
  const chiefComplaint = text.split('.')[0].trim() || text.substring(0, 100);

  return {
    chiefComplaint,
    symptoms: symptoms.length > 0 ? symptoms : undefined,
    duration: duration || undefined,
    severity,
    currentMedications: [],
    allergies: [],
  };
}
