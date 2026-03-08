/**
 * Joi Validation Schemas
 * Centralized validation schemas for all API endpoints
 */

const Joi = require('joi');

// Presigned URL validation schemas
const documentPresignedUrlSchema = Joi.object({
  filename: Joi.string()
    .max(255)
    .required()
    .pattern(/\.(jpg|jpeg|png|pdf)$/i)
    .messages({
      'string.pattern.base': 'File must be JPEG, PNG, or PDF format',
      'string.max': 'Filename must not exceed 255 characters',
      'any.required': 'Filename is required',
    }),
});

const audioPresignedUrlSchema = Joi.object({
  filename: Joi.string()
    .max(255)
    .required()
    .pattern(/\.wav$/i)
    .messages({
      'string.pattern.base': 'File must be WAV format',
      'string.max': 'Filename must not exceed 255 characters',
      'any.required': 'Filename is required',
    }),
});

// Job management validation schemas
const processJobSchema = Joi.object({
  s3Key: Joi.string().required().messages({
    'any.required': 's3Key is required',
  }),
});

const transcribeJobSchema = Joi.object({
  s3Key: Joi.string().required().messages({
    'any.required': 's3Key is required',
  }),
  language: Joi.string()
    .valid('hi', 'en', 'ta', 'te', 'kn', 'ml', 'bn', 'mr', 'gu')
    .required()
    .messages({
      'any.required': 'language is required',
      'any.only': 'language must be one of: hi, en, ta, te, kn, ml, bn, mr, gu',
    }),
});

const transcriptionCorrectionSchema = Joi.object({
  correctedText: Joi.string().required().messages({
    'any.required': 'correctedText is required',
  }),
});

/**
 * Validation middleware factory
 * Creates middleware that validates request body against a schema
 */
function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: details.length === 1 ? details[0].message : details,
        requestId: req.id,
      });
    }

    // Replace req.body with validated and sanitized value
    req.body = value;
    next();
  };
}

module.exports = {
  documentPresignedUrlSchema,
  audioPresignedUrlSchema,
  processJobSchema,
  transcribeJobSchema,
  transcriptionCorrectionSchema,
  validateRequest,
};
