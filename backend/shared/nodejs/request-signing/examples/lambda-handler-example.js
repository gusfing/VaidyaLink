/**
 * Example Lambda handler using request signing middleware
 */

const { createSignatureMiddleware } = require('../index');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

/**
 * Retrieve signing secret from AWS Secrets Manager
 */
async function getSigningSecret(event) {
  // Extract user ID or API key from event to determine which secret to use
  const userId = event.requestContext?.authorizer?.claims?.sub;

  if (!userId) {
    throw new Error('User ID not found in request context');
  }

  // Retrieve user-specific signing secret
  const secretName = `vaidyalink/signing-secrets/${userId}`;

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command);

    if (response.SecretString) {
      const secret = JSON.parse(response.SecretString);
      return secret.signingKey;
    }

    throw new Error('Secret not found');
  } catch (error) {
    console.error('Failed to retrieve signing secret:', error);
    throw error;
  }
}

// Create signature verification middleware
const verifySignature = createSignatureMiddleware({
  getSecret: getSigningSecret,
  maxAgeSeconds: 300, // 5 minutes
  sensitiveOperations: ['/delete', '/update', '/export', '/abdm/consent', '/patients/merge'],
});

/**
 * Example: Delete patient record (sensitive operation)
 */
exports.deletePatientHandler = async (event) => {
  try {
    // Verify request signature
    const verification = await verifySignature(event);

    // If verification failed, return error response
    if (verification.statusCode) {
      return verification;
    }

    // Extract patient ID from path
    const patientId = event.pathParameters?.patientId;

    if (!patientId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'MISSING_PARAMETER',
          message: 'Patient ID is required',
        }),
      };
    }

    // Perform deletion logic
    console.log(`Deleting patient: ${patientId}`);

    // TODO: Implement actual deletion logic
    // - Delete from DynamoDB
    // - Delete from HealthLake
    // - Delete S3 objects
    // - Log audit trail

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Patient record deleted successfully',
        patientId,
      }),
    };
  } catch (error) {
    console.error('Error deleting patient:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete patient record',
      }),
    };
  }
};

/**
 * Example: Export patient data (sensitive operation)
 */
exports.exportPatientDataHandler = async (event) => {
  try {
    // Verify request signature
    const verification = await verifySignature(event);

    if (verification.statusCode) {
      return verification;
    }

    const patientId = event.pathParameters?.patientId;
    const format = event.queryStringParameters?.format || 'json';

    console.log(`Exporting patient data: ${patientId} in ${format} format`);

    // TODO: Implement export logic
    // - Query HealthLake for FHIR resources
    // - Generate FHIR bundle
    // - Convert to requested format
    // - Log audit trail

    return {
      statusCode: 200,
      headers: {
        'Content-Type': format === 'xml' ? 'application/xml' : 'application/json',
      },
      body: JSON.stringify({
        message: 'Export initiated',
        patientId,
        format,
      }),
    };
  } catch (error) {
    console.error('Error exporting patient data:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: 'Failed to export patient data',
      }),
    };
  }
};

/**
 * Example: Regular operation (no signature required)
 */
exports.getPatientHandler = async (event) => {
  try {
    const patientId = event.pathParameters?.patientId;

    console.log(`Fetching patient: ${patientId}`);

    // TODO: Implement fetch logic

    return {
      statusCode: 200,
      body: JSON.stringify({
        patientId,
        name: 'John Doe',
        // ... other patient data
      }),
    };
  } catch (error) {
    console.error('Error fetching patient:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch patient',
      }),
    };
  }
};
