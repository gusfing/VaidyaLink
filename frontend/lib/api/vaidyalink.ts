import apiClient from './client';
import type {
  DocumentMetadata,
  ScanJob,
  ScanStatus,
  ExtractedRecord,
  TranscriptionJob,
  FHIRBundle,
  ClinicalSummary,
  ABHALinkStatus,
} from './types';

export const vaidyalinkAPI = {
  // Document Scanning
  async uploadDocument(file: File, metadata: DocumentMetadata): Promise<ScanJob> {
    // First get pre-signed URL
    const { data: urlData } = await apiClient.post('/v1/scans/upload-url', {
      fileName: file.name,
      fileType: file.type,
      ...metadata,
    });

    // Upload to S3
    await fetch(urlData.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    // Create scan job
    const { data } = await apiClient.post('/v1/scans', {
      imageKey: urlData.key,
      ...metadata,
    });

    return data;
  },

  async getScanStatus(jobId: string): Promise<ScanStatus> {
    const { data } = await apiClient.get(`/v1/scans/${jobId}`);
    return data;
  },

  async getExtractedData(jobId: string): Promise<ExtractedRecord> {
    const { data } = await apiClient.get(`/v1/scans/${jobId}/data`);
    return data;
  },

  // Voice Interface
  async uploadVoiceRecording(audio: Blob, language: string): Promise<TranscriptionJob> {
    const { data: urlData } = await apiClient.post('/v1/voice/upload-url', {
      language,
    });

    await fetch(urlData.uploadUrl, {
      method: 'PUT',
      body: audio,
      headers: {
        'Content-Type': 'audio/wav',
      },
    });

    const { data } = await apiClient.post('/v1/voice/transcribe', {
      audioKey: urlData.key,
      language,
    });

    return data;
  },

  async confirmTranscription(jobId: string, confirmed: boolean): Promise<void> {
    await apiClient.post(`/v1/voice/${jobId}/confirm`, { confirmed });
  },

  // Patient Records
  async getPatientRecords(patientId: string): Promise<FHIRBundle> {
    const { data } = await apiClient.get(`/v1/patients/${patientId}/records`);
    return data;
  },

  async getClinicalSummary(patientId: string): Promise<ClinicalSummary> {
    const { data } = await apiClient.get(`/v1/patients/${patientId}/summary`);
    return data;
  },

  // FHIR Export
  async exportToFHIR(patientId: string, format: 'json' | 'xml'): Promise<Blob> {
    const { data } = await apiClient.get(`/v1/patients/${patientId}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return data;
  },

  // ABDM Integration
  async linkABHAId(abhaId: string, otp: string): Promise<ABHALinkStatus> {
    const { data } = await apiClient.post('/v1/abdm/link', { abhaId, otp });
    return data;
  },

  async fetchABDMRecords(abhaId: string): Promise<FHIRBundle> {
    const { data } = await apiClient.get('/v1/abdm/records', {
      params: { abhaId },
    });
    return data;
  },
};
