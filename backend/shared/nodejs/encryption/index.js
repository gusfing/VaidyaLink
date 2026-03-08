/**
 * Encryption utilities for VaidyaLink
 * Provides KMS-based encryption for sensitive PHI data
 */

const { KMSEncryption } = require('./kms-encryption');
const { FieldEncryption } = require('./field-encryption');

module.exports = {
  KMSEncryption,
  FieldEncryption,
};
