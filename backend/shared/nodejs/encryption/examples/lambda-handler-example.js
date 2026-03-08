/**
 * Example Lambda handler demonstrating encryption utilities usage
 */

const { FieldEncryption, KMSEncryption } = require('../index');

// Initialize encryption services (reuse across invocations)
const fieldEncryption = new FieldEncryption();
const kmsEncryption = new KMSEncryption();

/**
 * Lambda handler to store encrypted patient records
 *
 * Example event:
 * {
 *   "body": "{\"patient_name\": \"Rajesh Kumar\", \"age\": 45, ...}",
 *   "pathParameters": {"patientId": "123"}
 * }
 */
exports.storePatientRecord = async (event, context) => {
  try {
    // Parse request
    const patientRecord = JSON.parse(event.body);
    const patientId = event.pathParameters.patientId;

    // Encrypt sensitive fields
    const encryptedRecord = await fieldEncryption.encryptRecord(patientRecord, patientId, {
      operation: 'store_record',
      source: 'api_gateway',
    });

    // Add metadata
    encryptedRecord.patient_id = patientId;
    encryptedRecord.encrypted_at = context.awsRequestId;

    // Store in DynamoDB (pseudo-code)
    // await dynamodb.putItem({
    //   TableName: 'Patients',
    //   Item: encryptedRecord
    // });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Patient record stored successfully',
        patient_id: patientId,
      }),
    };
  } catch (error) {
    console.error('Error storing patient record:', error);
    return {
      statusCode: error.message.includes('Invalid') ? 400 : 500,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
};

/**
 * Lambda handler to retrieve and decrypt patient records
 *
 * Example event:
 * {
 *   "pathParameters": {"patientId": "123"},
 *   "queryStringParameters": {"fields": "patient_name,age"}
 * }
 */
exports.retrievePatientRecord = async (event) => {
  try {
    const patientId = event.pathParameters.patientId;

    // Get requested fields (optional partial decryption)
    const queryParams = event.queryStringParameters || {};
    let requestedFields = null;
    if (queryParams.fields) {
      requestedFields = queryParams.fields.split(',');
    }

    // Retrieve from DynamoDB (pseudo-code)
    // const result = await dynamodb.getItem({
    //   TableName: 'Patients',
    //   Key: { patient_id: patientId }
    // });
    // const encryptedRecord = result.Item;

    // Mock encrypted record for example
    const encryptedRecord = {
      patient_id: patientId,
      patient_name: 'AQICAHh...encrypted...',
      patient_name_encrypted: true,
      age: 45,
      medical_history: 'AQICAHh...encrypted...',
      medical_history_encrypted: true,
    };

    // Decrypt record (partial or full)
    const decryptedRecord = await fieldEncryption.decryptRecord(
      encryptedRecord,
      patientId,
      null,
      requestedFields
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(decryptedRecord),
    };
  } catch (error) {
    console.error('Error retrieving patient record:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Lambda handler to encrypt medical document metadata
 * Uses direct KMS encryption for individual fields
 */
exports.encryptMedicalDocument = async (event) => {
  try {
    const documentMetadata = JSON.parse(event.body);
    const patientId = documentMetadata.patient_id;

    // Encrypt specific sensitive fields using KMS directly
    const encryptionContext = {
      patient_id: patientId,
      service: 'vaidyalink',
      data_type: 'document_metadata',
    };

    const encryptedMetadata = {
      document_id: documentMetadata.document_id,
      patient_id: patientId,
      document_type: documentMetadata.document_type,
      encrypted_notes: await kmsEncryption.encrypt(
        documentMetadata.doctor_notes,
        encryptionContext
      ),
      encrypted_diagnosis: await kmsEncryption.encrypt(
        documentMetadata.diagnosis,
        encryptionContext
      ),
      upload_date: documentMetadata.upload_date,
    };

    // Store metadata
    // await dynamodb.putItem({
    //   TableName: 'Documents',
    //   Item: encryptedMetadata
    // });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Document metadata encrypted and stored',
        document_id: documentMetadata.document_id,
      }),
    };
  } catch (error) {
    console.error('Error encrypting document:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Lambda handler to re-encrypt data with new KMS key
 * Used during key rotation
 */
exports.rotateEncryptionKeys = async (event) => {
  try {
    // Get records to re-encrypt
    const patientId = event.pathParameters.patientId;
    const newKeyId = process.env.NEW_KMS_KEY_ID;

    if (!newKeyId) {
      throw new Error('NEW_KMS_KEY_ID not configured');
    }

    // Retrieve encrypted record
    // const result = await dynamodb.getItem(...);
    // const encryptedRecord = result.Item;

    // Re-encrypt each encrypted field
    const oldContext = {
      patient_id: patientId,
      service: 'vaidyalink',
      data_type: 'phi',
    };

    const newContext = {
      ...oldContext,
      key_version: 'v2',
    };

    // Re-encrypt sensitive fields
    // for (const field of encryptedFields) {
    //   const oldCiphertext = encryptedRecord[field];
    //   const newCiphertext = await kmsEncryption.reEncrypt(
    //     oldCiphertext,
    //     newKeyId,
    //     oldContext,
    //     newContext
    //   );
    //   encryptedRecord[field] = newCiphertext;
    // }

    // Update record
    // await dynamodb.putItem(...);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Keys rotated successfully',
        patient_id: patientId,
      }),
    };
  } catch (error) {
    console.error('Error rotating keys:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Example: Batch encryption for multiple records
 */
exports.batchEncryptRecords = async (event) => {
  try {
    const records = JSON.parse(event.body).records;

    const encryptedRecords = await Promise.all(
      records.map(async (record) => {
        return await fieldEncryption.encryptRecord(record, record.patient_id);
      })
    );

    // Store batch
    // await dynamodb.batchWriteItem(...);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `${encryptedRecords.length} records encrypted successfully`,
      }),
    };
  } catch (error) {
    console.error('Error batch encrypting:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Example: Generate data key for envelope encryption
 */
exports.generateDataKeyForFile = async (event) => {
  try {
    const { patient_id, file_type } = JSON.parse(event.body);

    // Generate data key for encrypting large file
    const dataKey = await kmsEncryption.generateDataKey('AES_256', {
      patient_id,
      file_type,
      service: 'vaidyalink',
    });

    // Return encrypted data key (store with file)
    // Use plaintext key to encrypt file locally
    // Securely delete plaintext key after use

    return {
      statusCode: 200,
      body: JSON.stringify({
        encrypted_data_key: dataKey.ciphertext.toString('base64'),
        // Never return plaintext key in response!
      }),
    };
  } catch (error) {
    console.error('Error generating data key:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
