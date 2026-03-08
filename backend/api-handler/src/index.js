/**
 * Lambda Handler for API Gateway
 * Uses serverless-http to wrap Express app
 */

const serverless = require('serverless-http');
const app = require('./app');

// Wrap Express app with serverless-http
const handler = serverless(app);

exports.handler = async (event, context) => {
  // Log request for debugging
  console.log('Incoming request:', {
    path: event.path,
    method: event.httpMethod,
    requestId: event.requestContext?.requestId,
  });

  try {
    const response = await handler(event, context);
    return response;
  } catch (error) {
    console.error('Lambda handler error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        code: 'LAMBDA_ERROR',
        details: 'An unexpected error occurred',
        requestId: event.requestContext?.requestId,
      }),
    };
  }
};
