/**
 * Field-Level Encryption for PHI Data
 * Encrypts specific fields in patient records using KMS
 */

const { KMSEncryption } = require('./kms-encryption');

class FieldEncryption {
  /**
   * Fields that require encryption (PHI data)
   * Based on HIPAA requirements and VaidyaLink data models
   */
  static SENSITIVE_FIELDS = new Set([
    // Patient Demographics (Patient table)
    'patient_name',
    'name',
    'abha_id',
    'phone_number',
    'phone',
    'email',
    'address',
    'date_of_birth',
    'dateOfBirth',
    'emergency_contact',
    'emergencyContact',

    // Medical Information (ScanJobs, VoiceJobs)
    'medical_history',
    'medicalHistory',
    'diagnosis',
    'prescription_details',
    'prescriptionDetails',
    'lab_results',
    'labResults',
    'doctor_notes',
    'doctorNotes',
    'extracted_data',
    'extractedData',
    'transcription',
    'transcribed_text',
    'transcribedText',

    // Insurance and Financial
    'insurance_details',
    'insuranceDetails',

    // Other PHI
    'clinical_notes',
    'clinicalNotes',
    'treatment_plan',
    'treatmentPlan',
    'medication_list',
    'medicationList',
  ]);

  /**
   * Initialize field encryption service
   *
   * @param {KMSEncryption} kmsEncryption - Optional KMSEncryption instance (creates new if not provided)
   */
  constructor(kmsEncryption = null) {
    this.kms = kmsEncryption || new KMSEncryption();
  }

  /**
   * Encrypt sensitive fields in a record
   *
   * @param {Object} record - Object containing patient data
   * @param {string} patientId - Optional patient ID for encryption context
   * @param {Object} additionalContext - Additional encryption context key-value pairs
   * @returns {Promise<Object>} Record with sensitive fields encrypted
   *
   * @example
   * const record = {
   *   patient_id: '123',
   *   patient_name: 'Rajesh Kumar',
   *   age: 45,
   *   medical_history: 'Diabetes Type 2'
   * };
   * const encrypted = await fieldEnc.encryptRecord(record, '123');
   * // patient_name and medical_history are encrypted, age remains plaintext
   */
  async encryptRecord(record, patientId = null, additionalContext = null) {
    const encryptedRecord = { ...record };

    // Build encryption context
    const encryptionContext = {
      service: 'vaidyalink',
      data_type: 'phi',
    };

    if (patientId) {
      encryptionContext.patient_id = patientId;
    }

    if (additionalContext) {
      Object.assign(encryptionContext, additionalContext);
    }

    // Encrypt sensitive fields
    for (const [fieldName, fieldValue] of Object.entries(record)) {
      if (FieldEncryption.SENSITIVE_FIELDS.has(fieldName) && fieldValue != null) {
        // Convert to string if not already
        const plaintext = String(fieldValue);

        // Add field name to context for audit trail
        const fieldContext = { ...encryptionContext, field_name: fieldName };

        // Encrypt the field
        const encryptedValue = await this.kms.encrypt(plaintext, fieldContext);
        encryptedRecord[fieldName] = encryptedValue;

        // Mark field as encrypted
        encryptedRecord[`${fieldName}_encrypted`] = true;
      }
    }

    return encryptedRecord;
  }

  /**
   * Decrypt sensitive fields in a record
   *
   * @param {Object} encryptedRecord - Object with encrypted fields
   * @param {string} patientId - Optional patient ID (must match encryption context)
   * @param {Object} additionalContext - Additional context (must match encryption)
   * @param {Array<string>} fieldsToDecrypt - Optional list of specific fields to decrypt (decrypts all if null)
   * @returns {Promise<Object>} Record with sensitive fields decrypted
   *
   * @example
   * const decrypted = await fieldEnc.decryptRecord(encryptedRecord, '123');
   * // All encrypted fields are decrypted
   *
   * // Decrypt only specific fields
   * const partial = await fieldEnc.decryptRecord(
   *   encryptedRecord,
   *   '123',
   *   null,
   *   ['patient_name']
   * );
   */
  async decryptRecord(
    encryptedRecord,
    patientId = null,
    additionalContext = null,
    fieldsToDecrypt = null
  ) {
    const decryptedRecord = { ...encryptedRecord };

    // Build encryption context
    const encryptionContext = {
      service: 'vaidyalink',
      data_type: 'phi',
    };

    if (patientId) {
      encryptionContext.patient_id = patientId;
    }

    if (additionalContext) {
      Object.assign(encryptionContext, additionalContext);
    }

    // Decrypt fields
    for (const [fieldName, fieldValue] of Object.entries(encryptedRecord)) {
      // Check if field is marked as encrypted
      const isEncrypted = encryptedRecord[`${fieldName}_encrypted`] === true;

      // Skip if not encrypted or not in fields to decrypt
      if (!isEncrypted) {
        continue;
      }

      if (fieldsToDecrypt && !fieldsToDecrypt.includes(fieldName)) {
        continue;
      }

      if (fieldValue != null) {
        // Add field name to context
        const fieldContext = { ...encryptionContext, field_name: fieldName };

        // Decrypt the field
        const decryptedValue = await this.kms.decrypt(fieldValue, fieldContext);
        decryptedRecord[fieldName] = decryptedValue;

        // Remove encryption marker
        delete decryptedRecord[`${fieldName}_encrypted`];
      }
    }

    return decryptedRecord;
  }

  /**
   * Encrypt a single field value
   *
   * @param {string} fieldName - Name of the field being encrypted
   * @param {string} fieldValue - Value to encrypt
   * @param {string} patientId - Optional patient ID for context
   * @param {Object} additionalContext - Additional encryption context
   * @returns {Promise<string>} Encrypted field value
   */
  async encryptField(fieldName, fieldValue, patientId = null, additionalContext = null) {
    if (!fieldValue) {
      throw new Error('Field value cannot be empty');
    }

    // Build encryption context
    const encryptionContext = {
      service: 'vaidyalink',
      data_type: 'phi',
      field_name: fieldName,
    };

    if (patientId) {
      encryptionContext.patient_id = patientId;
    }

    if (additionalContext) {
      Object.assign(encryptionContext, additionalContext);
    }

    return this.kms.encrypt(String(fieldValue), encryptionContext);
  }

  /**
   * Decrypt a single field value
   *
   * @param {string} fieldName - Name of the field being decrypted
   * @param {string} encryptedValue - Encrypted value
   * @param {string} patientId - Optional patient ID (must match encryption context)
   * @param {Object} additionalContext - Additional context (must match encryption)
   * @returns {Promise<string>} Decrypted field value
   */
  async decryptField(fieldName, encryptedValue, patientId = null, additionalContext = null) {
    if (!encryptedValue) {
      throw new Error('Encrypted value cannot be empty');
    }

    // Build encryption context (must match encryption)
    const encryptionContext = {
      service: 'vaidyalink',
      data_type: 'phi',
      field_name: fieldName,
    };

    if (patientId) {
      encryptionContext.patient_id = patientId;
    }

    if (additionalContext) {
      Object.assign(encryptionContext, additionalContext);
    }

    return this.kms.decrypt(encryptedValue, encryptionContext);
  }

  /**
   * Check if a field should be encrypted
   *
   * @param {string} fieldName - Name of the field to check
   * @returns {boolean} True if field is sensitive and should be encrypted
   */
  isSensitiveField(fieldName) {
    return FieldEncryption.SENSITIVE_FIELDS.has(fieldName);
  }

  /**
   * Add a field to the sensitive fields list
   *
   * @param {string} fieldName - Name of the field to mark as sensitive
   */
  addSensitiveField(fieldName) {
    FieldEncryption.SENSITIVE_FIELDS.add(fieldName);
  }

  /**
   * Remove a field from the sensitive fields list
   *
   * @param {string} fieldName - Name of the field to unmark as sensitive
   */
  removeSensitiveField(fieldName) {
    FieldEncryption.SENSITIVE_FIELDS.delete(fieldName);
  }
}

module.exports = { FieldEncryption };
