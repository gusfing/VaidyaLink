/**
 * HITL Handler Lambda
 *
 * Manages human-in-the-loop verification workflow for low-confidence extractions.
 * Processes messages from SQS queue and coordinates verification tasks.
 *
 * Runtime: Node.js 18
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SQSClient, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const sqsClient = new SQSClient({});
const lambdaClient = new LambdaClient({});

// Environment variables
const SCANJOBS_TABLE = process.env.SCANJOBS_TABLE;
const DOCUMENTS_BUCKET = process.env.DOCUMENTS_BUCKET;
const FHIR_TRANSFORMER_LAMBDA_ARN = process.env.FHIR_TRANSFORMER_LAMBDA_ARN;

/**
 * Main Lambda handler for HITL queue processing
 */
exports.handler = async (event) => {
  console.log('Processing HITL queue messages:', JSON.stringify(event, null, 2));

  const results = [];

  try {
    // Process each SQS message
    for (const record of event.Records) {
      try {
        const result = await processHITLMessage(record);
        results.push(result);

        // Delete message from queue after successful processing
        await deleteMessage(record.receiptHandle, record.eventSourceARN);
      } catch (error) {
        console.error('Error processing HITL message:', error);
        // Message will be retried or moved to DLQ based on queue configuration
        results.push({
          messageId: record.messageId,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'HITL messages processed',
        results,
      }),
    };
  } catch (error) {
    console.error('Error in HITL handler:', error);
    throw error;
  }
};

/**
 * Process a single HITL message from the queue
 */
async function processHITLMessage(record) {
  const message = JSON.parse(record.body);
  const { jobId, structuredData, confidenceScores, routedAt } = message;

  console.log(`Processing HITL job: ${jobId}`);

  // Retrieve job details from DynamoDB
  const job = await getJob(jobId);

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // Save HITL data to S3 for verification interface
  await saveHITLData(jobId, {
    jobId,
    structuredData,
    confidenceScores,
    routedAt,
    originalImageKey: job.imageS3Key,
    patientId: job.patientId,
    status: 'pending_verification',
  });

  // Update job status in DynamoDB
  await updateJobStatus(jobId, 'hitl_required', {
    hitlQueuedAt: new Date().toISOString(),
    confidenceScores,
  });

  console.log(`HITL job ${jobId} queued for verification`);

  return {
    messageId: record.messageId,
    jobId,
    status: 'queued_for_verification',
  };
}

/**
 * Get job details from DynamoDB
 */
async function getJob(jobId) {
  try {
    const command = new GetCommand({
      TableName: SCANJOBS_TABLE,
      Key: {
        PK: `JOB#${jobId}`,
        SK: 'METADATA',
      },
    });

    const response = await docClient.send(command);
    return response.Item;
  } catch (error) {
    console.error('Error getting job from DynamoDB:', error);
    throw error;
  }
}

/**
 * Save HITL data to S3 for verification interface
 */
async function saveHITLData(jobId, hitlData) {
  try {
    const key = `hitl/${jobId}/verification-data.json`;

    const command = new PutObjectCommand({
      Bucket: DOCUMENTS_BUCKET,
      Key: key,
      Body: JSON.stringify(hitlData, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'aws:kms',
    });

    await s3Client.send(command);

    console.log(`HITL data saved to s3://${DOCUMENTS_BUCKET}/${key}`);
  } catch (error) {
    console.error('Error saving HITL data to S3:', error);
    throw error;
  }
}

/**
 * Update job status in DynamoDB
 */
async function updateJobStatus(jobId, status, additionalFields = {}) {
  try {
    const updateExpression = ['SET #status = :status', 'updatedAt = :updatedAt'];
    const expressionAttributeNames = { '#status': 'status' };
    const expressionAttributeValues = {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
    };

    // Add additional fields to update
    Object.entries(additionalFields).forEach(([key, value]) => {
      updateExpression.push(`${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = value;
    });

    const command = new UpdateCommand({
      TableName: SCANJOBS_TABLE,
      Key: {
        PK: `JOB#${jobId}`,
        SK: 'METADATA',
      },
      UpdateExpression: updateExpression.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await docClient.send(command);

    console.log(`Job ${jobId} status updated to ${status}`);
  } catch (error) {
    console.error('Error updating job status:', error);
    throw error;
  }
}

/**
 * Delete message from SQS queue
 */
async function deleteMessage(receiptHandle, queueArn) {
  try {
    // Extract queue URL from ARN
    const queueUrl = queueArn
      .replace('arn:aws:sqs:', 'https://sqs.')
      .replace(':queue:', '.amazonaws.com/');

    const command = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await sqsClient.send(command);

    console.log('Message deleted from queue');
  } catch (error) {
    console.error('Error deleting message from queue:', error);
    // Don't throw - message will be retried if deletion fails
  }
}

/**
 * Process verification result (called by verification API)
 */
exports.processVerification = async (event) => {
  console.log('Processing verification result:', JSON.stringify(event, null, 2));

  try {
    const { jobId, correctedData, verifiedBy, notes } = JSON.parse(event.body);

    if (!jobId || !correctedData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: jobId, correctedData' }),
      };
    }

    // Save corrected data to S3
    await saveCorrectedData(jobId, correctedData);

    // Update job status
    await updateJobStatus(jobId, 'verified', {
      verifiedBy,
      verifiedAt: new Date().toISOString(),
      verificationNotes: notes,
    });

    // Trigger FHIR transformation with corrected data
    if (FHIR_TRANSFORMER_LAMBDA_ARN) {
      await triggerFHIRTransformation(jobId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Verification processed successfully',
        jobId,
      }),
    };
  } catch (error) {
    console.error('Error processing verification:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

/**
 * Save corrected data to S3
 */
async function saveCorrectedData(jobId, correctedData) {
  try {
    const key = `processed/${jobId}/extracted.json`;

    const outputData = {
      jobId,
      extractedData: correctedData,
      source: 'human_verification',
      verifiedAt: new Date().toISOString(),
    };

    const command = new PutObjectCommand({
      Bucket: DOCUMENTS_BUCKET,
      Key: key,
      Body: JSON.stringify(outputData, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'aws:kms',
    });

    await s3Client.send(command);

    // Update job with S3 key
    await updateJobStatus(jobId, null, {
      extractedDataS3Key: key,
    });

    console.log(`Corrected data saved to s3://${DOCUMENTS_BUCKET}/${key}`);
  } catch (error) {
    console.error('Error saving corrected data:', error);
    throw error;
  }
}

/**
 * Trigger FHIR transformation Lambda
 */
async function triggerFHIRTransformation(jobId) {
  try {
    const payload = { jobId };

    const command = new InvokeCommand({
      FunctionName: FHIR_TRANSFORMER_LAMBDA_ARN,
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify(payload),
    });

    await lambdaClient.send(command);

    console.log(`FHIR transformation triggered for job ${jobId}`);
  } catch (error) {
    console.error('Error triggering FHIR transformation:', error);
    // Don't throw - FHIR transformation failure shouldn't fail verification
  }
}
