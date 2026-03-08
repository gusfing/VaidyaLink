/**
 * Express Application for API Lambda
 * Handles document-scan-demo API endpoints
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateRequest } = require('./middleware/auth');
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

// NOTE: Rate limiting temporarily disabled for MVP
// Will be re-enabled after fixing shared module packaging

// Mount routes
app.use('/upload', presignedUrlRoutes);
app.use('/jobs', jobRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

module.exports = app;
