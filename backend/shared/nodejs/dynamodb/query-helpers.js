/**
 * DynamoDB Query Helpers
 *
 * Optimized query utilities for VaidyaLink DynamoDB tables.
 * Uses GSIs efficiently and implements best practices for pagination and filtering.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  BatchGetCommand,
} = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

/**
 * Query all scan jobs for a specific patient
 * Uses PatientIndex GSI for efficient querying
 *
 * @param {string} patientId - Patient identifier
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum items to return (default: 20)
 * @param {boolean} options.ascending - Sort order (default: false = newest first)
 * @param {string} options.startDate - ISO 8601 date to filter from
 * @param {Object} options.lastEvaluatedKey - Pagination token
 * @returns {Promise<{items: Array, lastEvaluatedKey: Object}>}
 */
async function getPatientScans(patientId, options = {}) {
  const { limit = 20, ascending = false, startDate = null, lastEvaluatedKey = null } = options;

  const tableName = `vaidyalink-scanjobs-${process.env.ENVIRONMENT || 'dev'}`;

  let keyConditionExpression = 'patientId = :patientId';
  const expressionAttributeValues = {
    ':patientId': patientId,
  };

  // Add date range filter if provided
  if (startDate) {
    keyConditionExpression += ' AND createdAt >= :startDate';
    expressionAttributeValues[':startDate'] = startDate;
  }

  const params = {
    TableName: tableName,
    IndexName: 'PatientIndex',
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ScanIndexForward: ascending,
    Limit: limit,
  };

  if (lastEvaluatedKey) {
    params.ExclusiveStartKey = lastEvaluatedKey;
  }

  const command = new QueryCommand(params);
  const result = await docClient.send(command);

  return {
    items: result.Items || [],
    lastEvaluatedKey: result.LastEvaluatedKey,
    count: result.Count,
  };
}

/**
 * Query all scan jobs by status
 * Uses StatusIndex GSI for workflow management
 *
 * @param {string} status - Job status (pending, processing, completed, failed, hitl_required)
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum items to return (default: 50)
 * @param {boolean} options.ascending - Sort order (default: true = oldest first for FIFO)
 * @param {Object} options.lastEvaluatedKey - Pagination token
 * @returns {Promise<{items: Array, lastEvaluatedKey: Object}>}
 */
async function getScansByStatus(status, options = {}) {
  const {
    limit = 50,
    ascending = true, // FIFO processing for queues
    lastEvaluatedKey = null,
  } = options;

  const tableName = `vaidyalink-scanjobs-${process.env.ENVIRONMENT || 'dev'}`;

  const params = {
    TableName: tableName,
    IndexName: 'StatusIndex',
    KeyConditionExpression: '#status = :status',
    ExpressionAttributeNames: {
      '#status': 'status', // 'status' is a reserved word
    },
    ExpressionAttributeValues: {
      ':status': status,
    },
    ScanIndexForward: ascending,
    Limit: limit,
  };

  if (lastEvaluatedKey) {
    params.ExclusiveStartKey = lastEvaluatedKey;
  }

  const command = new QueryCommand(params);
  const result = await docClient.send(command);

  return {
    items: result.Items || [],
    lastEvaluatedKey: result.LastEvaluatedKey,
    count: result.Count,
  };
}

/**
 * Get HITL verification queue
 * Optimized query for jobs requiring human verification
 *
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum items to return (default: 20)
 * @returns {Promise<Array>}
 */
async function getHITLQueue(options = {}) {
  const { limit = 20 } = options;

  const result = await getScansByStatus('hitl_required', {
    limit,
    ascending: true, // Oldest first (FIFO)
  });

  return result.items;
}

/**
 * Find patient by ABHA ID
 * Uses ABHAIndex GSI for efficient lookup
 *
 * @param {string} abhaId - Ayushman Bharat Health Account ID
 * @returns {Promise<Object|null>} Patient object or null if not found
 */
async function getPatientByABHA(abhaId) {
  const tableName = `vaidyalink-patients-${process.env.ENVIRONMENT || 'dev'}`;

  const params = {
    TableName: tableName,
    IndexName: 'ABHAIndex',
    KeyConditionExpression: 'abhaId = :abhaId',
    ExpressionAttributeValues: {
      ':abhaId': abhaId,
    },
    Limit: 1, // Should only be one patient per ABHA ID
  };

  const command = new QueryCommand(params);
  const result = await docClient.send(command);

  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

/**
 * Query all voice jobs for a specific patient
 * Uses PatientIndex GSI
 *
 * @param {string} patientId - Patient identifier
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum items to return (default: 20)
 * @param {boolean} options.ascending - Sort order (default: false = newest first)
 * @returns {Promise<{items: Array, lastEvaluatedKey: Object}>}
 */
async function getPatientVoiceJobs(patientId, options = {}) {
  const { limit = 20, ascending = false, lastEvaluatedKey = null } = options;

  const tableName = `vaidyalink-voicejobs-${process.env.ENVIRONMENT || 'dev'}`;

  const params = {
    TableName: tableName,
    IndexName: 'PatientIndex',
    KeyConditionExpression: 'patientId = :patientId',
    ExpressionAttributeValues: {
      ':patientId': patientId,
    },
    ScanIndexForward: ascending,
    Limit: limit,
  };

  if (lastEvaluatedKey) {
    params.ExclusiveStartKey = lastEvaluatedKey;
  }

  const command = new QueryCommand(params);
  const result = await docClient.send(command);

  return {
    items: result.Items || [],
    lastEvaluatedKey: result.LastEvaluatedKey,
    count: result.Count,
  };
}

/**
 * Get a single scan job by ID
 * Direct primary key lookup (most efficient)
 *
 * @param {string} jobId - Scan job identifier
 * @returns {Promise<Object|null>} Scan job object or null if not found
 */
async function getScanJob(jobId) {
  const tableName = `vaidyalink-scanjobs-${process.env.ENVIRONMENT || 'dev'}`;

  const params = {
    TableName: tableName,
    Key: {
      PK: `JOB#${jobId}`,
      SK: 'METADATA',
    },
  };

  const command = new GetCommand(params);
  const result = await docClient.send(command);

  return result.Item || null;
}

/**
 * Get multiple scan jobs by IDs
 * Uses BatchGetItem for efficient parallel retrieval
 *
 * @param {Array<string>} jobIds - Array of job identifiers (max 25)
 * @returns {Promise<Array>} Array of scan job objects
 */
async function getBatchScanJobs(jobIds) {
  if (jobIds.length === 0) return [];
  if (jobIds.length > 25) {
    throw new Error('BatchGetItem supports maximum 25 items');
  }

  const tableName = `vaidyalink-scanjobs-${process.env.ENVIRONMENT || 'dev'}`;

  const keys = jobIds.map((jobId) => ({
    PK: `JOB#${jobId}`,
    SK: 'METADATA',
  }));

  const params = {
    RequestItems: {
      [tableName]: {
        Keys: keys,
      },
    },
  };

  const command = new BatchGetCommand(params);
  const result = await docClient.send(command);

  return result.Responses?.[tableName] || [];
}

/**
 * Get patient profile by ID
 * Direct primary key lookup
 *
 * @param {string} patientId - Patient identifier
 * @returns {Promise<Object|null>} Patient object or null if not found
 */
async function getPatient(patientId) {
  const tableName = `vaidyalink-patients-${process.env.ENVIRONMENT || 'dev'}`;

  const params = {
    TableName: tableName,
    Key: {
      PK: `PATIENT#${patientId}`,
      SK: 'PROFILE',
    },
  };

  const command = new GetCommand(params);
  const result = await docClient.send(command);

  return result.Item || null;
}

/**
 * Get recent scans across all patients (admin view)
 * Uses StatusIndex with 'completed' status
 *
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum items to return (default: 50)
 * @returns {Promise<Array>}
 */
async function getRecentCompletedScans(options = {}) {
  const { limit = 50 } = options;

  const result = await getScansByStatus('completed', {
    limit,
    ascending: false, // Most recent first
  });

  return result.items;
}

/**
 * Paginate through all items for a patient
 * Automatically handles pagination to fetch all items
 *
 * @param {string} patientId - Patient identifier
 * @param {Object} options - Query options
 * @param {number} options.maxItems - Maximum total items to fetch (default: 1000)
 * @returns {Promise<Array>} All scan jobs for the patient
 */
async function getAllPatientScans(patientId, options = {}) {
  const { maxItems = 1000 } = options;

  const allItems = [];
  let lastEvaluatedKey = null;

  do {
    const result = await getPatientScans(patientId, {
      limit: 100,
      lastEvaluatedKey,
    });

    allItems.push(...result.items);
    lastEvaluatedKey = result.lastEvaluatedKey;

    // Safety check to prevent infinite loops
    if (allItems.length >= maxItems) {
      break;
    }
  } while (lastEvaluatedKey);

  return allItems;
}

module.exports = {
  // Scan job queries
  getPatientScans,
  getScansByStatus,
  getHITLQueue,
  getScanJob,
  getBatchScanJobs,
  getAllPatientScans,
  getRecentCompletedScans,

  // Patient queries
  getPatient,
  getPatientByABHA,

  // Voice job queries
  getPatientVoiceJobs,

  // Export DynamoDB client for custom queries
  docClient,
};
