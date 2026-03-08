/**
 * Example Lambda handler demonstrating RBAC usage
 * This handler manages scan job operations with role-based access control
 */

const { createAuthMiddleware } = require('../auth');
const { requirePermission, requireOwnership, PERMISSIONS } = require('../rbac');

// Initialize auth middleware
const authMiddleware = createAuthMiddleware();

/**
 * GET /api/v1/scans/:jobId
 * Retrieve scan job details
 * Requires: scan:read:own or scan:read:all permission
 * Patients can only access their own scans
 */
exports.getScanJob = async (event, context) => {
  // Step 1: Authenticate user
  const authResult = await authMiddleware(event);
  if (!authResult.authorized) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized', message: authResult.error }),
    };
  }

  // Step 2: Check permissions
  const permCheck = requirePermission([PERMISSIONS.SCAN_READ_OWN, PERMISSIONS.SCAN_READ_ALL])(
    event
  );
  if (!permCheck.authorized) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Forbidden', message: permCheck.error }),
    };
  }

  // Step 3: Check resource ownership (for patients)
  const getResourceOwnerId = async (event) => {
    const jobId = event.pathParameters.jobId;
    // In real implementation, fetch from DynamoDB
    // const job = await dynamoDB.get({ TableName: 'ScanJobs', Key: { jobId } });
    // return job.Item.patientId;

    // Mock for example
    return 'patient-123';
  };

  const ownershipCheck = requireOwnership(getResourceOwnerId);
  const ownerResult = await ownershipCheck(event);

  if (!ownerResult.authorized) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Forbidden', message: ownerResult.error }),
    };
  }

  // Step 4: Business logic
  const jobId = event.pathParameters.jobId;
  const user = event.user;

  // Mock response
  const scanJob = {
    jobId,
    patientId: 'patient-123',
    status: 'completed',
    imageUrl: 's3://bucket/image.jpg',
    extractedData: {
      patientName: 'John Doe',
      medications: ['Aspirin 100mg'],
    },
    createdAt: '2024-01-15T10:30:00Z',
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      data: scanJob,
      requestedBy: user.username,
    }),
  };
};

/**
 * POST /api/v1/scans
 * Create new scan job
 * Requires: scan:upload permission
 */
exports.createScanJob = async (event, context) => {
  // Step 1: Authenticate user
  const authResult = await authMiddleware(event);
  if (!authResult.authorized) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized', message: authResult.error }),
    };
  }

  // Step 2: Check permissions
  const permCheck = requirePermission([PERMISSIONS.SCAN_UPLOAD])(event);
  if (!permCheck.authorized) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Forbidden', message: permCheck.error }),
    };
  }

  // Step 3: Check rate limit
  const user = event.user;
  console.log(`User ${user.username} rate limit:`, user.rateLimit);

  // Step 4: Business logic
  const body = JSON.parse(event.body);
  const jobId = `job-${Date.now()}`;

  // Mock response
  const scanJob = {
    jobId,
    patientId: user.sub,
    status: 'pending',
    imageS3Key: body.imageS3Key,
    createdAt: new Date().toISOString(),
  };

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      data: scanJob,
      message: 'Scan job created successfully',
    }),
  };
};

/**
 * DELETE /api/v1/scans/:jobId
 * Delete scan job
 * Requires: scan:delete:own or scan:delete:all permission
 * Patients can only delete their own scans
 */
exports.deleteScanJob = async (event, context) => {
  // Step 1: Authenticate user
  const authResult = await authMiddleware(event);
  if (!authResult.authorized) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized', message: authResult.error }),
    };
  }

  // Step 2: Check permissions
  const permCheck = requirePermission([PERMISSIONS.SCAN_DELETE_OWN, PERMISSIONS.SCAN_DELETE_ALL])(
    event
  );
  if (!permCheck.authorized) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Forbidden', message: permCheck.error }),
    };
  }

  // Step 3: Check resource ownership (for patients)
  const getResourceOwnerId = async (event) => {
    const jobId = event.pathParameters.jobId;
    // In real implementation, fetch from DynamoDB
    return 'patient-123';
  };

  const ownershipCheck = requireOwnership(getResourceOwnerId);
  const ownerResult = await ownershipCheck(event);

  if (!ownerResult.authorized) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Forbidden', message: ownerResult.error }),
    };
  }

  // Step 4: Business logic
  const jobId = event.pathParameters.jobId;

  // Mock deletion
  console.log(`Deleting scan job ${jobId}`);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      message: 'Scan job deleted successfully',
    }),
  };
};
