/**
 * FHIR Observation Mapper
 *
 * Maps extracted clinical entities from voice transcriptions to FHIR Observation
 * and MedicationStatement payloads for the FHIR Transformer Lambda.
 *
 * This module prepares structured data for Task 10.8 (Create FHIR Observation from voice data).
 */

'use strict';

/**
 * Check if extracted entities contain mappable clinical data
 *
 * @param {Object} entities - Extracted clinical entities
 * @returns {boolean} True if entities can be mapped to FHIR resources
 */
function hasMappableEntities(entities) {
  if (!entities || typeof entities !== 'object') {
    return false;
  }

  // Check for any mappable entity types
  const hasSymptoms = Array.isArray(entities.symptoms) && entities.symptoms.length > 0;
  const hasMedications =
    Array.isArray(entities.currentMedications) && entities.currentMedications.length > 0;
  const hasVitals = entities.vitalSigns && Object.keys(entities.vitalSigns).length > 0;
  const hasAllergies = Array.isArray(entities.allergies) && entities.allergies.length > 0;
  const hasHistory = Array.isArray(entities.medicalHistory) && entities.medicalHistory.length > 0;
  const hasComplaint = entities.chiefComplaint && entities.chiefComplaint.trim().length > 0;

  return hasSymptoms || hasMedications || hasVitals || hasAllergies || hasHistory || hasComplaint;
}

/**
 * Build FHIR payload for the FHIR Transformer Lambda
 *
 * @param {Object} options - Payload options
 * @param {string} options.patientId - Patient identifier
 * @param {string} options.jobId - Voice job identifier
 * @param {Object} options.entities - Extracted clinical entities
 * @param {Object} options.confidence - Confidence scores
 * @returns {Object} FHIR transformation payload
 */
function buildFHIRPayload({ patientId, jobId, entities, confidence }) {
  if (!patientId) {
    throw new Error('patientId is required for FHIR payload');
  }

  if (!jobId) {
    throw new Error('jobId is required for FHIR payload');
  }

  if (!entities) {
    throw new Error('entities are required for FHIR payload');
  }

  const payload = {
    source: 'voice-processing',
    sourceJobId: jobId,
    patientId,
    timestamp: new Date().toISOString(),
    resources: [],
  };

  // Map symptoms to FHIR Observations
  if (Array.isArray(entities.symptoms) && entities.symptoms.length > 0) {
    for (const symptom of entities.symptoms) {
      payload.resources.push({
        resourceType: 'Observation',
        category: 'symptom',
        data: {
          symptomName: symptom.name,
          severity: symptom.severity || 'unknown',
          duration: symptom.duration || null,
          onset: symptom.onset || null,
          bodyLocation: symptom.location || null,
        },
        confidence: confidence?.byEntity?.symptoms || confidence?.overall || 0.0,
        sourceText: symptom.sourceText || null,
      });
    }
  }

  // Map vital signs to FHIR Observations
  if (entities.vitalSigns && typeof entities.vitalSigns === 'object') {
    const vitalSignMap = {
      bloodPressure: { code: '85354-9', display: 'Blood pressure' },
      heartRate: { code: '8867-4', display: 'Heart rate' },
      temperature: { code: '8310-5', display: 'Body temperature' },
      respiratoryRate: { code: '9279-1', display: 'Respiratory rate' },
      oxygenSaturation: { code: '2708-6', display: 'Oxygen saturation' },
      weight: { code: '29463-7', display: 'Body weight' },
      height: { code: '8302-2', display: 'Body height' },
    };

    for (const [vitalType, value] of Object.entries(entities.vitalSigns)) {
      if (value && vitalSignMap[vitalType]) {
        payload.resources.push({
          resourceType: 'Observation',
          category: 'vital-signs',
          data: {
            vitalType,
            value,
            loincCode: vitalSignMap[vitalType].code,
            display: vitalSignMap[vitalType].display,
          },
          confidence: confidence?.byEntity?.vitalSigns || confidence?.overall || 0.0,
        });
      }
    }
  }

  // Map medications to FHIR MedicationStatements
  if (Array.isArray(entities.currentMedications) && entities.currentMedications.length > 0) {
    for (const medication of entities.currentMedications) {
      payload.resources.push({
        resourceType: 'MedicationStatement',
        category: 'medication',
        data: {
          medicationName: medication.name,
          dosage: medication.dosage || null,
          frequency: medication.frequency || null,
          route: medication.route || null,
          duration: medication.duration || null,
          startDate: medication.startDate || null,
        },
        confidence: confidence?.byEntity?.currentMedications || confidence?.overall || 0.0,
        sourceText: medication.sourceText || null,
      });
    }
  }

  // Map allergies to FHIR AllergyIntolerance (via Observation for now)
  if (Array.isArray(entities.allergies) && entities.allergies.length > 0) {
    for (const allergy of entities.allergies) {
      payload.resources.push({
        resourceType: 'Observation',
        category: 'allergy',
        data: {
          allergen: allergy.allergen || allergy.name,
          reaction: allergy.reaction || null,
          severity: allergy.severity || 'unknown',
        },
        confidence: confidence?.byEntity?.allergies || confidence?.overall || 0.0,
        sourceText: allergy.sourceText || null,
      });
    }
  }

  // Map chief complaint to FHIR Observation
  if (entities.chiefComplaint && entities.chiefComplaint.trim().length > 0) {
    payload.resources.push({
      resourceType: 'Observation',
      category: 'chief-complaint',
      data: {
        complaint: entities.chiefComplaint,
      },
      confidence: confidence?.byEntity?.chiefComplaint || confidence?.overall || 0.0,
    });
  }

  // Map medical history to FHIR Observations
  if (Array.isArray(entities.medicalHistory) && entities.medicalHistory.length > 0) {
    for (const historyItem of entities.medicalHistory) {
      payload.resources.push({
        resourceType: 'Observation',
        category: 'medical-history',
        data: {
          condition: historyItem.condition || historyItem.name,
          diagnosedDate: historyItem.diagnosedDate || null,
          status: historyItem.status || 'unknown',
        },
        confidence: confidence?.byEntity?.medicalHistory || confidence?.overall || 0.0,
        sourceText: historyItem.sourceText || null,
      });
    }
  }

  // Add metadata
  payload.metadata = {
    overallConfidence: confidence?.overall || 0.0,
    confidenceByEntity: confidence?.byEntity || {},
    extractionMethod: 'voice-transcription',
    language: entities._metadata?.language || 'unknown',
    userConfirmed: entities._metadata?.userConfirmed || false,
  };

  return payload;
}

module.exports = {
  hasMappableEntities,
  buildFHIRPayload,
};
