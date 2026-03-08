/**
 * Express Application for API Lambda
 * Handles document-scan-demo API endpoints
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateRequest } = require('./middleware/auth');
const {
  checkRateLimit,
  createRateLimitResponse,
} = require('../../shared/nodejs/middleware/rate-limit');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
const presignedUrlRoutes = require('./routes/presigned-url');
const jobRoutes = require('./routes/jobs');

const app = express();

// Parse JSON bodies
app.use(express.json());

// Add request ID for tracing
app.use((req, res, next) => {
  req.id = uuidv4();
  next();
});

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Apply authentication middleware to all routes except health check
app.use(authenticateRequest);

// Apply rate limiting middleware
app.use(async (req, res, next) => {
  try {
    const rateLimitResult = await checkRateLimit({
      user: req.user,
      requestContext: {
        authorizer: {
          claims: req.user,
        },
      },
    });

    if (!rateLimitResult.allowed) {
      return res.status(429).json(createRateLimitResponse(rateLimitResult).body);
    }

    next();
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open - allow request on error
    next();
  }
});

// Mount routes
app.use('/upload', presignedUrlRoutes);
app.use('/jobs', jobRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

module.exports = app;
