/**
 * Batch Operations Utilities
 *
 * Efficient batch read/write operations for DynamoDB migrations.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const docClient = DynamoDBDocumentClient.from(client);

/**
 * Process all items in a table with a transformation function
 *
 * @param {string} tableName - DynamoDB table name
 * @param {Function} transformFn - Function to transform each item
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Processing statistics
 */
async function batchTransformItems(tableName, transformFn, options = {}) {
  const {
    batchSize = 25, // DynamoDB BatchWriteItem limit
    delayMs = 100, // Delay between batches to avoid throttling
    maxRetries = 3,
    dryRun = false,
    filterFn = null, // Optional filter function
    onProgress = null, // Progress callback
  } = options;

  let processedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let lastEvaluatedKey = null;

  do {
    // Scan a segment of the table
    const scanParams = {
      TableName: tableName,
      Limit: batchSize * 4, // Scan more items to account for filtering
    };

    if (lastEvaluatedKey) {
      scanParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const scanCommand = new ScanCommand(scanParams);
    const scanResult = await docClient.send(scanCommand);

    const items = scanResult.Items || [];
    lastEvaluatedKey = scanResult.LastEvaluatedKey;

    // Filter items if filter function provided
    const itemsToProcess = filterFn ? items.filter(filterFn) : items;

    // Transform items
    const transformedItems = [];
    for (const item of itemsToProcess) {
      try {
        const transformed = await transformFn(item);
        if (transformed) {
          transformedItems.push(transformed);
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error transforming item ${item.PK}:`, error.message);
        errorCount++;
      }
    }

    // Write transformed items in batches
    if (!dryRun && transformedItems.length > 0) {
      const batches = chunkArray(transformedItems, batchSize);

      for (const batch of batches) {
        await writeBatchWithRetry(tableName, batch, maxRetries);
        updatedCount += batch.length;

        // Delay between batches to avoid throttling
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    } else if (dryRun) {
      updatedCount += transformedItems.length;
    }

    processedCount += items.length;

    // Call progress callback
    if (onProgress) {
      onProgress({
        processedCount,
        updatedCount,
        skippedCount,
        errorCount,
      });
    }
  } while (lastEvaluatedKey);

  return {
    processedCount,
    updatedCount,
    skippedCount,
    errorCount,
  };
}

/**
 * Update items in batches using UpdateItem (for conditional updates)
 *
 * @param {string} tableName - DynamoDB table name
 * @param {Array} items - Items to update
 * @param {Function} updateExpressionFn - Function to generate update expression
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Update statistics
 */
async function batchUpdateItems(tableName, items, updateExpressionFn, options = {}) {
  const { delayMs = 50, maxRetries = 3, dryRun = false, onProgress = null } = options;

  let updatedCount = 0;
  let errorCount = 0;

  for (const item of items) {
    try {
      const updateParams = updateExpressionFn(item);

      if (!dryRun) {
        const command = new UpdateCommand({
          TableName: tableName,
          ...updateParams,
        });

        await retryOperation(() => docClient.send(command), maxRetries);
      }

      updatedCount++;

      if (delayMs > 0) {
        await sleep(delayMs);
      }

      if (onProgress && updatedCount % 100 === 0) {
        onProgress({ updatedCount, errorCount });
      }
    } catch (error) {
      console.error(`Error updating item ${item.PK}:`, error.message);
      errorCount++;
    }
  }

  return { updatedCount, errorCount };
}

/**
 * Scan table and collect all items matching a filter
 *
 * @param {string} tableName - DynamoDB table name
 * @param {Function} filterFn - Filter function
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} Filtered items
 */
async function scanAndFilter(tableName, filterFn, options = {}) {
  const {
    limit = null,
    attributes = null, // Projection expression
  } = options;

  const items = [];
  let lastEvaluatedKey = null;

  do {
    const scanParams = {
      TableName: tableName,
    };

    if (lastEvaluatedKey) {
      scanParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    if (attributes) {
      scanParams.ProjectionExpression = attributes.join(', ');
    }

    const scanCommand = new ScanCommand(scanParams);
    const scanResult = await docClient.send(scanCommand);

    const scannedItems = scanResult.Items || [];
    const filtered = filterFn ? scannedItems.filter(filterFn) : scannedItems;
    items.push(...filtered);

    lastEvaluatedKey = scanResult.LastEvaluatedKey;

    if (limit && items.length >= limit) {
      break;
    }
  } while (lastEvaluatedKey);

  return limit ? items.slice(0, limit) : items;
}

/**
 * Write batch with retry logic
 */
async function writeBatchWithRetry(tableName, items, maxRetries) {
  let unprocessedItems = items;
  let retries = 0;

  while (unprocessedItems.length > 0 && retries < maxRetries) {
    const writeRequests = unprocessedItems.map((item) => ({
      PutRequest: { Item: item },
    }));

    const params = {
      RequestItems: {
        [tableName]: writeRequests,
      },
    };

    const command = new BatchWriteCommand(params);
    const result = await docClient.send(command);

    // Check for unprocessed items
    const unprocessed = result.UnprocessedItems?.[tableName] || [];
    unprocessedItems = unprocessed.map((req) => req.PutRequest.Item);

    if (unprocessedItems.length > 0) {
      retries++;
      // Exponential backoff
      await sleep(Math.pow(2, retries) * 100);
    }
  }

  if (unprocessedItems.length > 0) {
    throw new Error(`Failed to write ${unprocessedItems.length} items after ${maxRetries} retries`);
  }
}

/**
 * Delete items in batches
 *
 * @param {string} tableName - DynamoDB table name
 * @param {Array} keys - Array of {PK, SK} objects
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Deletion statistics
 */
async function batchDeleteItems(tableName, keys, options = {}) {
  const { batchSize = 25, delayMs = 100, maxRetries = 3, dryRun = false } = options;

  if (dryRun) {
    return { deletedCount: keys.length };
  }

  const batches = chunkArray(keys, batchSize);
  let deletedCount = 0;

  for (const batch of batches) {
    const writeRequests = batch.map((key) => ({
      DeleteRequest: { Key: key },
    }));

    const params = {
      RequestItems: {
        [tableName]: writeRequests,
      },
    };

    await retryOperation(async () => {
      const command = new BatchWriteCommand(params);
      await docClient.send(command);
    }, maxRetries);

    deletedCount += batch.length;

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return { deletedCount };
}

/**
 * Count items in a table
 */
async function countItems(tableName, filterFn = null) {
  let count = 0;
  let lastEvaluatedKey = null;

  do {
    const scanParams = {
      TableName: tableName,
      Select: 'COUNT',
    };

    if (lastEvaluatedKey) {
      scanParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const scanCommand = new ScanCommand(scanParams);
    const scanResult = await docClient.send(scanCommand);

    if (filterFn) {
      // Need to scan with items to filter
      scanParams.Select = 'ALL_ATTRIBUTES';
      const itemsResult = await docClient.send(new ScanCommand(scanParams));
      const filtered = (itemsResult.Items || []).filter(filterFn);
      count += filtered.length;
    } else {
      count += scanResult.Count || 0;
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return count;
}

/**
 * Helper: Chunk array into smaller arrays
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper: Retry operation with exponential backoff
 */
async function retryOperation(operation, maxRetries) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (
        error.name === 'ProvisionedThroughputExceededException' ||
        error.name === 'ThrottlingException'
      ) {
        // Exponential backoff
        await sleep(Math.pow(2, i) * 100);
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

module.exports = {
  batchTransformItems,
  batchUpdateItems,
  batchDeleteItems,
  scanAndFilter,
  countItems,
};
