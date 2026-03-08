// VaidyaLink TypeScript Interfaces

export interface PatientProfile {
  id: string;
  abhaId: string;
  name: string;
  age: number;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  photoUrl?: string;
  verified: boolean;
  bloodType: string;
  allergies: string[];
  chronicConditions: string[];
  emergencyContacts: EmergencyContact[];
  authorizedDoctors: Doctor[];
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  photoUrl?: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  title: string;
  category: 'prescription' | 'lab-report' | 'scan' | 'other';
  date: string;
  s3Key?: string;
  thumbnailUrl?: string;
  verified: boolean;
  processed: boolean;
  ocrText?: string;
  entities?: Entity[];
  fhirResource?: object;
  uploadedAt: string;
  processedAt?: string;
}

export interface Entity {
  text: string;
  type: string;
  confidence: number;
}

export interface ClinicalSummary {
  patientId: string;
  generatedAt: string;
  chiefComplaint: string;
  recentContext: string;
  criticalFlags: string[];
  vitals: VitalSign[];
  medications: Medication[];
  recentLabs: LabResult[];
  timeSavedMinutes: number;
  confidence: number;
}

export interface VitalSign {
  type: 'blood-pressure' | 'heart-rate' | 'temperature' | 'oxygen-saturation';
  value: string;
  unit: string;
  timestamp: string;
  normal: boolean;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  active: boolean;
}

export interface LabResult {
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  date: string;
}

export interface TimelineEvent {
  id: string;
  patientId: string;
  type: 'visit' | 'lab' | 'prescription' | 'scan';
  date: string;
  title: string;
  description: string;
  icon: string;
  structuredData?: object;
  fhirResource?: object;
  recordId?: string;
  doctorId?: string;
  createdAt: string;
}

export interface TrendData {
  date: string;
  value: number;
}
