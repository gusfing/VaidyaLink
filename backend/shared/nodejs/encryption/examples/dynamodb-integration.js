/**
 * DynamoDB Integration Examples for VaidyaLink Data Models
 * Demonstrates field-level encryption for Patient, ScanJobs, and VoiceJobs tables
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { FieldEncryption } = require('../field-encryption');

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Initialize encryption
const fieldEncryption = new FieldEncryption();

/**
 * Patient Table Operations
 */

/**
 * Store encrypted patient record in DynamoDB
 */
async function storePatient(patientData) {
  try {
    const patientId = patientData.patientId;

    // Encrypt sensitive fields
    const encryptedPatient = await fieldEncryption.encryptRecord(patientData, patientId, {
      table: 'Patients',
      operation: 'create',
    });

    // Add DynamoDB keys
    const item = {
      PK: `PATIENT#${patientId}`,
      SK: 'PROFILE',
      ...encryptedPatient,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: process.env.PATIENTS_TABLE || 'VaidyaLink-Patients',
        Item: item,
      })
    );

    console.log(`Patient ${patientId} stored with encrypted PHI fields`);
    return { success: true, patientId };
  } catch (error) {
    console.error('Error storing patient:', error);
    throw error;
  }
}

/**
 * Retrieve and decrypt patient record from DynamoDB
 */
async function getPatient(patientId, fieldsToDecrypt = null) {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: process.env.PATIENTS_TABLE || 'VaidyaLink-Patients',
        Key: {
          PK: `PATIENT#${patientId}`,
          SK: 'PROFILE',
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    // Decrypt sensitive fields (partial or full)
    const decryptedPatient = await fieldEncryption.decryptRecord(
      result.Item,
      patientId,
      { table: 'Patients', operation: 'read' },
      fieldsToDecrypt
    );

    return decryptedPatient;
  } catch (error) {
    console.error('Error retrieving patient:', error);
    throw error;
  }
}

/**
 * Update patient record with encrypted fields
 */
async function updatePatient(patientId, updates) {
  try {
    // Encrypt any sensitive fields in updates
    const encryptedUpdates = await fieldEncryption.encryptRecord(updates, patientId, {
      table: 'Patients',
      operation: 'update',
    });

    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.entries(encryptedUpdates).forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    });

    // Add updatedAt
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    await docClient.send(
      new UpdateCommand({
        TableName: process.env.PATIENTS_TABLE || 'VaidyaLink-Patients',
        Key: {
          PK: `PATIENT#${patientId}`,
          SK: 'PROFILE',
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    console.log(`Patient ${patientId} updated with encrypted fields`);
    return { success: true, patientId };
  } catch (error) {
    console.error('Error updating patient:', error);
    throw error;
  }
}

/**
 * ScanJobs Table Operations
 */

/**
 * Store encrypted scan job with extracted data
 */
async function storeScanJob(scanJobData) {
  try {
    const jobId = scanJobData.jobId;
    const patientId = scanJobData.patientId;

    // Encrypt sensitive extracted data
    const encryptedJob = await fieldEncryption.encryptRecord(scanJobData, patientId, {
      table: 'ScanJobs',
      job_id: jobId,
      operation: 'create',
    });

    const item = {
      PK: `JOB#${jobId}`,
      SK: 'METADATA',
      ...encryptedJob,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: process.env.SCANJOBS_TABLE || 'VaidyaLink-ScanJobs',
        Item: item,
      })
    );

    console.log(`Scan job ${jobId} stored with encrypted extracted data`);
    return { success: true, jobId };
  } catch (error) {
    console.error('Error storing scan job:', error);
    throw error;
  }
}

/**
 * Retrieve and decrypt scan job
 */
async function getScanJob(jobId, patientId) {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: process.env.SCANJOBS_TABLE || 'VaidyaLink-ScanJobs',
        Key: {
          PK: `JOB#${jobId}`,
          SK: 'METADATA',
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    // Decrypt extracted data
    const decryptedJob = await fieldEncryption.decryptRecord(result.Item, patientId, {
      table: 'ScanJobs',
      job_id: jobId,
      operation: 'read',
    });

    return decryptedJob;
  } catch (error) {
    console.error('Error retrieving scan job:', error);
    throw error;
  }
}

/**
 * VoiceJobs Table Operations
 */

/**
 * Store encrypted voice job with transcription
 */
async function storeVoiceJob(voiceJobData) {
  try {
    const jobId = voiceJobData.jobId;
    const patientId = voiceJobData.patientId;

    // Encrypt transcription and extracted medical data
    const encryptedJob = await fieldEncryption.encryptRecord(voiceJobData, patientId, {
      table: 'VoiceJobs',
      job_id: jobId,
      operation: 'create',
    });

    const item = {
      PK: `VOICE#${jobId}`,
      SK: 'METADATA',
      ...encryptedJob,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: process.env.VOICEJOBS_TABLE || 'VaidyaLink-VoiceJobs',
        Item: item,
      })
    );

    console.log(`Voice job ${jobId} stored with encrypted transcription`);
    return { success: true, jobId };
  } catch (error) {
    console.error('Error storing voice job:', error);
    throw error;
  }
}

/**
 * Retrieve and decrypt voice job
 */
async function getVoiceJob(jobId, patientId) {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: process.env.VOICEJOBS_TABLE || 'VaidyaLink-VoiceJobs',
        Key: {
          PK: `VOICE#${jobId}`,
          SK: 'METADATA',
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    // Decrypt transcription
    const decryptedJob = await fieldEncryption.decryptRecord(result.Item, patientId, {
      table: 'VoiceJobs',
      job_id: jobId,
      operation: 'read',
    });

    return decryptedJob;
  } catch (error) {
    console.error('Error retrieving voice job:', error);
    throw error;
  }
}

/**
 * Example: Complete workflow for document processing
 */
async function completeDocumentProcessingWorkflow() {
  try {
    // 1. Create patient record
    const patientData = {
      patientId: 'patient-123',
      name: 'Rajesh Kumar',
      dateOfBirth: '1985-06-15',
      phone: '+91-9876543210',
      email: 'rajesh.kumar@example.com',
      abhaId: '12-3456-7890-1234',
      address: '123 MG Road, Mumbai, Maharashtra',
      preferredLanguage: 'hi',
    };

    await storePatient(patientData);

    // 2. Process document scan
    const scanJobData = {
      jobId: 'scan-456',
      patientId: 'patient-123',
      status: 'completed',
      imageS3Key: 'raw/patient-123/scan-456/original.jpg',
      extractedData: JSON.stringify({
        diagnosis: 'Type 2 Diabetes Mellitus',
        prescriptionDetails: 'Metformin 500mg twice daily',
        doctorNotes: 'Patient shows good compliance with medication',
      }),
      confidenceScores: {
        diagnosis: 0.95,
        prescriptionDetails: 0.92,
      },
    };

    await storeScanJob(scanJobData);

    // 3. Process voice recording
    const voiceJobData = {
      jobId: 'voice-789',
      patientId: 'patient-123',
      status: 'completed',
      audioS3Key: 'audio/patient-123/voice-789/recording.wav',
      language: 'hi',
      transcription: 'मुझे पिछले तीन महीनों से सिरदर्द हो रहा है',
      transcribedText: 'I have been having headaches for the past three months',
      transcriptionConfidence: 0.89,
    };

    await storeVoiceJob(voiceJobData);

    // 4. Retrieve patient with only name decrypted (for display)
    const patientSummary = await getPatient('patient-123', ['name']);
    console.log('Patient summary:', patientSummary);

    // 5. Retrieve full scan job data
    const scanJob = await getScanJob('scan-456', 'patient-123');
    console.log('Scan job with decrypted data:', scanJob);

    console.log('Complete workflow executed successfully');
  } catch (error) {
    console.error('Workflow error:', error);
    throw error;
  }
}

module.exports = {
  storePatient,
  getPatient,
  updatePatient,
  storeScanJob,
  getScanJob,
  storeVoiceJob,
  getVoiceJob,
  completeDocumentProcessingWorkflow,
};
