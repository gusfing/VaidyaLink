/**
 * Data Transformation Utilities
 *
 * Common data transformation functions for migrations.
 */

/**
 * Rename an attribute in an item
 */
function renameAttribute(item, oldName, newName) {
  if (item[oldName] !== undefined) {
    return {
      ...item,
      [newName]: item[oldName],
      [oldName]: undefined, // Remove old attribute
    };
  }
  return item;
}

/**
 * Add a new attribute with a default value
 */
function addAttribute(item, attributeName, defaultValue) {
  if (item[attributeName] === undefined) {
    return {
      ...item,
      [attributeName]: typeof defaultValue === 'function' ? defaultValue(item) : defaultValue,
    };
  }
  return item;
}

/**
 * Remove an attribute from an item
 */
function removeAttribute(item, attributeName) {
  const { [attributeName]: removed, ...rest } = item;
  return rest;
}

/**
 * Transform attribute value
 */
function transformAttribute(item, attributeName, transformFn) {
  if (item[attributeName] !== undefined) {
    return {
      ...item,
      [attributeName]: transformFn(item[attributeName], item),
    };
  }
  return item;
}

/**
 * Convert date format (e.g., from Unix timestamp to ISO 8601)
 */
function convertDateFormat(item, attributeName, fromFormat, toFormat) {
  if (item[attributeName] === undefined) {
    return item;
  }

  let date;

  // Parse from format
  if (fromFormat === 'unix') {
    date = new Date(item[attributeName] * 1000);
  } else if (fromFormat === 'unix-ms') {
    date = new Date(item[attributeName]);
  } else if (fromFormat === 'iso8601') {
    date = new Date(item[attributeName]);
  } else {
    throw new Error(`Unsupported from format: ${fromFormat}`);
  }

  // Convert to format
  let converted;
  if (toFormat === 'unix') {
    converted = Math.floor(date.getTime() / 1000);
  } else if (toFormat === 'unix-ms') {
    converted = date.getTime();
  } else if (toFormat === 'iso8601') {
    converted = date.toISOString();
  } else {
    throw new Error(`Unsupported to format: ${toFormat}`);
  }

  return {
    ...item,
    [attributeName]: converted,
  };
}

/**
 * Normalize string attribute (trim, lowercase, etc.)
 */
function normalizeString(item, attributeName, options = {}) {
  const { trim = true, lowercase = false, uppercase = false, removeSpaces = false } = options;

  if (item[attributeName] === undefined || typeof item[attributeName] !== 'string') {
    return item;
  }

  let value = item[attributeName];

  if (trim) value = value.trim();
  if (lowercase) value = value.toLowerCase();
  if (uppercase) value = value.toUpperCase();
  if (removeSpaces) value = value.replace(/\s+/g, '');

  return {
    ...item,
    [attributeName]: value,
  };
}

/**
 * Split a string attribute into an array
 */
function splitStringToArray(item, attributeName, delimiter = ',') {
  if (item[attributeName] === undefined || typeof item[attributeName] !== 'string') {
    return item;
  }

  return {
    ...item,
    [attributeName]: item[attributeName]
      .split(delimiter)
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  };
}

/**
 * Join an array attribute into a string
 */
function joinArrayToString(item, attributeName, delimiter = ',') {
  if (item[attributeName] === undefined || !Array.isArray(item[attributeName])) {
    return item;
  }

  return {
    ...item,
    [attributeName]: item[attributeName].join(delimiter),
  };
}

/**
 * Merge multiple attributes into one
 */
function mergeAttributes(item, targetAttribute, sourceAttributes, mergeFn) {
  const values = sourceAttributes.map((attr) => item[attr]).filter((val) => val !== undefined);

  if (values.length === 0) {
    return item;
  }

  const merged = mergeFn ? mergeFn(values, item) : values.join(' ');

  // Remove source attributes
  const result = { ...item, [targetAttribute]: merged };
  sourceAttributes.forEach((attr) => {
    result[attr] = undefined;
  });

  return result;
}

/**
 * Split one attribute into multiple
 */
function splitAttribute(item, sourceAttribute, targetAttributes, splitFn) {
  if (item[sourceAttribute] === undefined) {
    return item;
  }

  const values = splitFn(item[sourceAttribute], item);

  if (values.length !== targetAttributes.length) {
    throw new Error(
      `Split function returned ${values.length} values, ` + `expected ${targetAttributes.length}`
    );
  }

  const result = { ...item, [sourceAttribute]: undefined };
  targetAttributes.forEach((attr, index) => {
    result[attr] = values[index];
  });

  return result;
}

/**
 * Add computed attribute based on other attributes
 */
function addComputedAttribute(item, attributeName, computeFn) {
  return {
    ...item,
    [attributeName]: computeFn(item),
  };
}

/**
 * Validate and fix data types
 */
function enforceDataType(item, attributeName, targetType) {
  if (item[attributeName] === undefined) {
    return item;
  }

  let value = item[attributeName];

  switch (targetType) {
    case 'string':
      value = String(value);
      break;
    case 'number':
      value = Number(value);
      if (isNaN(value)) {
        throw new Error(`Cannot convert ${item[attributeName]} to number`);
      }
      break;
    case 'boolean':
      if (typeof value === 'string') {
        value = value.toLowerCase() === 'true' || value === '1';
      } else {
        value = Boolean(value);
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        value = [value];
      }
      break;
    default:
      throw new Error(`Unsupported target type: ${targetType}`);
  }

  return {
    ...item,
    [attributeName]: value,
  };
}

/**
 * Flatten nested object into top-level attributes
 */
function flattenObject(item, objectAttribute, prefix = '') {
  if (item[objectAttribute] === undefined || typeof item[objectAttribute] !== 'object') {
    return item;
  }

  const result = { ...item };
  const nested = item[objectAttribute];

  Object.keys(nested).forEach((key) => {
    const newKey = prefix ? `${prefix}${key}` : key;
    result[newKey] = nested[key];
  });

  result[objectAttribute] = undefined;

  return result;
}

/**
 * Nest attributes into an object
 */
function nestAttributes(item, targetAttribute, sourceAttributes, removeSource = true) {
  const nested = {};

  sourceAttributes.forEach((attr) => {
    if (item[attr] !== undefined) {
      nested[attr] = item[attr];
    }
  });

  const result = {
    ...item,
    [targetAttribute]: nested,
  };

  if (removeSource) {
    sourceAttributes.forEach((attr) => {
      result[attr] = undefined;
    });
  }

  return result;
}

/**
 * Apply multiple transformations in sequence
 */
function applyTransformations(item, transformations) {
  return transformations.reduce((acc, transform) => {
    return transform(acc);
  }, item);
}

/**
 * Conditional transformation
 */
function conditionalTransform(item, condition, transformFn) {
  if (condition(item)) {
    return transformFn(item);
  }
  return item;
}

/**
 * Backfill missing attribute from another table
 * (Requires external lookup function)
 */
async function backfillFromLookup(item, attributeName, lookupFn) {
  if (item[attributeName] !== undefined) {
    return item;
  }

  const value = await lookupFn(item);

  return {
    ...item,
    [attributeName]: value,
  };
}

/**
 * Sanitize sensitive data (for testing/development)
 */
function sanitizeAttribute(item, attributeName, sanitizeFn) {
  if (item[attributeName] === undefined) {
    return item;
  }

  return {
    ...item,
    [attributeName]: sanitizeFn ? sanitizeFn(item[attributeName]) : '***REDACTED***',
  };
}

/**
 * Add audit fields (createdAt, updatedAt)
 */
function addAuditFields(item, options = {}) {
  const {
    createdAtField = 'createdAt',
    updatedAtField = 'updatedAt',
    timestamp = new Date().toISOString(),
  } = options;

  const result = { ...item };

  if (!result[createdAtField]) {
    result[createdAtField] = timestamp;
  }

  result[updatedAtField] = timestamp;

  return result;
}

/**
 * Validate attribute against a schema
 */
function validateAttribute(item, attributeName, validator) {
  if (item[attributeName] === undefined) {
    return item;
  }

  const isValid = validator(item[attributeName], item);

  if (!isValid) {
    throw new Error(`Validation failed for ${attributeName} in item ${item.PK}`);
  }

  return item;
}

/**
 * Generate unique ID for an attribute
 */
function generateId(item, attributeName, generator) {
  if (item[attributeName] !== undefined) {
    return item;
  }

  return {
    ...item,
    [attributeName]: generator ? generator(item) : crypto.randomUUID(),
  };
}

module.exports = {
  renameAttribute,
  addAttribute,
  removeAttribute,
  transformAttribute,
  convertDateFormat,
  normalizeString,
  splitStringToArray,
  joinArrayToString,
  mergeAttributes,
  splitAttribute,
  addComputedAttribute,
  enforceDataType,
  flattenObject,
  nestAttributes,
  applyTransformations,
  conditionalTransform,
  backfillFromLookup,
  sanitizeAttribute,
  addAuditFields,
  validateAttribute,
  generateId,
};
