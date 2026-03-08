/**
 * Unit tests for field-level encryption
 */

const { FieldEncryption } = require('../field-encryption');
const { KMSEncryption } = require('../kms-encryption');

// Mock KMS encryption
jest.mock('../kms-encryption');

describe('FieldEncryption', () => {
  let mockKMS;
  let fieldEncryption;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock KMS methods
    mockKMS = {
      encrypt: jest.fn((text) => Promise.resolve(`encrypted_${text}`)),
      decrypt: jest.fn((text) => Promise.resolve(text.replace('encrypted_', ''))),
    };

    KMSEncryption.mockImplementation(() => mockKMS);

    fieldEncryption = new FieldEncryption(mockKMS);
  });

  describe('Initialization', () => {
    test('should initialize with provided KMS instance', () => {
      const customKMS = { encrypt: jest.fn(), decrypt: jest.fn() };
      const fieldEnc = new FieldEncryption(customKMS);

      expect(fieldEnc.kms).toBe(customKMS);
    });

    test('should create new KMS instance if not provided', () => {
      const fieldEnc = new FieldEncryption();

      expect(KMSEncryption).toHaveBeenCalled();
    });
  });

  describe('encryptRecord', () => {
    test('should encrypt only sensitive fields', async () => {
      const record = {
        patient_id: '123',
        patient_name: 'Rajesh Kumar',
        age: 45,
        medical_history: 'Diabetes Type 2',
      };

      const encrypted = await fieldEncryption.encryptRecord(record, '123');

      // Sensitive fields should be encrypted
      expect(encrypted.patient_name).toBe('encrypted_Rajesh Kumar');
      expect(encrypted.patient_name_encrypted).toBe(true);
      expect(encrypted.medical_history).toBe('encrypted_Diabetes Type 2');
      expect(encrypted.medical_history_encrypted).toBe(true);

      // Non-sensitive fields should remain unchanged
      expect(encrypted.patient_id).toBe('123');
      expect(encrypted.age).toBe(45);
      expect(encrypted.patient_id_encrypted).toBeUndefined();
      expect(encrypted.age_encrypted).toBeUndefined();
    });

    test('should include patient ID in encryption context', async () => {
      const record = { patient_name: 'John Doe' };

      await fieldEncryption.encryptRecord(record, '456');

      expect(mockKMS.encrypt).toHaveBeenCalledWith(
        'John Doe',
        expect.objectContaining({
          patient_id: '456',
          service: 'vaidyalink',
          data_type: 'phi',
          field_name: 'patient_name',
        })
      );
    });

    test('should merge additional context', async () => {
      const record = { patient_name: 'Jane Doe' };
      const additional = { department: 'cardiology', doctor_id: '789' };

      await fieldEncryption.encryptRecord(record, null, additional);

      expect(mockKMS.encrypt).toHaveBeenCalledWith(
        'Jane Doe',
        expect.objectContaining({
          department: 'cardiology',
          doctor_id: '789',
        })
      );
    });

    test('should skip null values', async () => {
      const record = {
        patient_name: 'Test',
        medical_history: null,
      };

      const encrypted = await fieldEncryption.encryptRecord(record);

      // Null field should not be encrypted
      expect(encrypted.medical_history).toBeNull();
      expect(encrypted.medical_history_encrypted).toBeUndefined();

      // Non-null field should be encrypted
      expect(encrypted.patient_name).toBe('encrypted_Test');
    });

    test('should handle empty record', async () => {
      const encrypted = await fieldEncryption.encryptRecord({});

      expect(encrypted).toEqual({});
    });

    test('should convert non-string values to strings', async () => {
      const record = {
        phone_number: 1234567890, // Number instead of string
      };

      await fieldEncryption.encryptRecord(record);

      expect(mockKMS.encrypt).toHaveBeenCalledWith('1234567890', expect.any(Object));
    });
  });

  describe('decryptRecord', () => {
    test('should decrypt encrypted fields', async () => {
      const encryptedRecord = {
        patient_id: '123',
        patient_name: 'encrypted_Rajesh Kumar',
        patient_name_encrypted: true,
        age: 45,
        medical_history: 'encrypted_Diabetes',
        medical_history_encrypted: true,
      };

      const decrypted = await fieldEncryption.decryptRecord(encryptedRecord, '123');

      // Encrypted fields should be decrypted
      expect(decrypted.patient_name).toBe('Rajesh Kumar');
      expect(decrypted.patient_name_encrypted).toBeUndefined();
      expect(decrypted.medical_history).toBe('Diabetes');
      expect(decrypted.medical_history_encrypted).toBeUndefined();

      // Non-encrypted fields unchanged
      expect(decrypted.patient_id).toBe('123');
      expect(decrypted.age).toBe(45);
    });

    test('should decrypt only specified fields', async () => {
      const encryptedRecord = {
        patient_name: 'encrypted_John',
        patient_name_encrypted: true,
        medical_history: 'encrypted_History',
        medical_history_encrypted: true,
      };

      const decrypted = await fieldEncryption.decryptRecord(encryptedRecord, null, null, [
        'patient_name',
      ]);

      // Only specified field should be decrypted
      expect(decrypted.patient_name).toBe('John');
      expect(decrypted.patient_name_encrypted).toBeUndefined();

      // Other encrypted fields remain encrypted
      expect(decrypted.medical_history).toBe('encrypted_History');
      expect(decrypted.medical_history_encrypted).toBe(true);
    });

    test('should use correct decryption context', async () => {
      const encryptedRecord = {
        patient_name: 'encrypted_Test',
        patient_name_encrypted: true,
      };

      await fieldEncryption.decryptRecord(encryptedRecord, '789', { department: 'neurology' });

      expect(mockKMS.decrypt).toHaveBeenCalledWith(
        'encrypted_Test',
        expect.objectContaining({
          patient_id: '789',
          department: 'neurology',
          field_name: 'patient_name',
        })
      );
    });

    test('should not modify non-encrypted fields', async () => {
      const record = {
        patient_name: 'Plain Text',
        age: 30,
      };

      const decrypted = await fieldEncryption.decryptRecord(record);

      expect(decrypted.patient_name).toBe('Plain Text');
      expect(decrypted.age).toBe(30);
    });

    test('should skip fields without encryption marker', async () => {
      const record = {
        patient_name: 'encrypted_Test',
        // Missing patient_name_encrypted marker
      };

      const decrypted = await fieldEncryption.decryptRecord(record);

      // Should not attempt to decrypt without marker
      expect(mockKMS.decrypt).not.toHaveBeenCalled();
      expect(decrypted.patient_name).toBe('encrypted_Test');
    });
  });

  describe('encryptField', () => {
    test('should encrypt single field', async () => {
      const result = await fieldEncryption.encryptField('patient_name', 'Rajesh Kumar', '123');

      expect(result).toBe('encrypted_Rajesh Kumar');
      expect(mockKMS.encrypt).toHaveBeenCalledWith(
        'Rajesh Kumar',
        expect.objectContaining({
          field_name: 'patient_name',
          patient_id: '123',
        })
      );
    });

    test('should throw error for empty value', async () => {
      await expect(fieldEncryption.encryptField('patient_name', '')).rejects.toThrow(
        'Field value cannot be empty'
      );
    });

    test('should include additional context', async () => {
      await fieldEncryption.encryptField('diagnosis', 'Hypertension', null, { doctor_id: '456' });

      expect(mockKMS.encrypt).toHaveBeenCalledWith(
        'Hypertension',
        expect.objectContaining({
          doctor_id: '456',
        })
      );
    });
  });

  describe('decryptField', () => {
    test('should decrypt single field', async () => {
      const result = await fieldEncryption.decryptField(
        'patient_name',
        'encrypted_Rajesh Kumar',
        '123'
      );

      expect(result).toBe('Rajesh Kumar');
      expect(mockKMS.decrypt).toHaveBeenCalledWith(
        'encrypted_Rajesh Kumar',
        expect.objectContaining({
          field_name: 'patient_name',
          patient_id: '123',
        })
      );
    });

    test('should throw error for empty value', async () => {
      await expect(fieldEncryption.decryptField('patient_name', '')).rejects.toThrow(
        'Encrypted value cannot be empty'
      );
    });
  });

  describe('Sensitive field management', () => {
    test('should identify sensitive fields', () => {
      expect(fieldEncryption.isSensitiveField('patient_name')).toBe(true);
      expect(fieldEncryption.isSensitiveField('medical_history')).toBe(true);
      expect(fieldEncryption.isSensitiveField('age')).toBe(false);
      expect(fieldEncryption.isSensitiveField('patient_id')).toBe(false);
    });

    test('should add field to sensitive list', () => {
      expect(fieldEncryption.isSensitiveField('custom_field')).toBe(false);

      fieldEncryption.addSensitiveField('custom_field');

      expect(fieldEncryption.isSensitiveField('custom_field')).toBe(true);
    });

    test('should remove field from sensitive list', () => {
      expect(fieldEncryption.isSensitiveField('patient_name')).toBe(true);

      fieldEncryption.removeSensitiveField('patient_name');

      expect(fieldEncryption.isSensitiveField('patient_name')).toBe(false);

      // Restore for subsequent tests
      fieldEncryption.addSensitiveField('patient_name');
    });

    test('should handle removing non-existent field gracefully', () => {
      // Should not throw error
      expect(() => {
        fieldEncryption.removeSensitiveField('non_existent_field');
      }).not.toThrow();
    });
  });

  describe('Integration', () => {
    test('should successfully encrypt and decrypt full record', async () => {
      const originalRecord = {
        patient_id: '123',
        patient_name: 'Rajesh Kumar',
        age: 45,
        medical_history: 'Diabetes Type 2',
        phone_number: '+91-9876543210',
      };

      // Encrypt
      const encrypted = await fieldEncryption.encryptRecord(originalRecord, '123');

      // Verify encryption
      expect(encrypted.patient_name).not.toBe(originalRecord.patient_name);
      expect(encrypted.patient_name_encrypted).toBe(true);
      expect(encrypted.age).toBe(45); // Non-sensitive unchanged

      // Decrypt
      const decrypted = await fieldEncryption.decryptRecord(encrypted, '123');

      // Verify decryption
      expect(decrypted.patient_name).toBe(originalRecord.patient_name);
      expect(decrypted.medical_history).toBe(originalRecord.medical_history);
      expect(decrypted.phone_number).toBe(originalRecord.phone_number);
      expect(decrypted.patient_name_encrypted).toBeUndefined();
    });

    test('should support partial field decryption', async () => {
      const record = {
        patient_name: 'John Doe',
        medical_history: 'Asthma',
        phone_number: '1234567890',
      };

      // Encrypt all
      const encrypted = await fieldEncryption.encryptRecord(record);

      // Decrypt only name
      const partial = await fieldEncryption.decryptRecord(encrypted, null, null, ['patient_name']);

      expect(partial.patient_name).toBe('John Doe');
      expect(partial.medical_history).not.toBe('Asthma'); // Still encrypted
      expect(partial.medical_history_encrypted).toBe(true);
    });
  });
});
