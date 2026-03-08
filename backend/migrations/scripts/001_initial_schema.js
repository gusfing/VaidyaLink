/**
 * Migration 001: Initial Schema Baseline
 *
 * This migration establishes the baseline schema for all DynamoDB tables.
 * It doesn't modify any data but documents the initial state.
 */

const description = 'Initial schema baseline - documents existing table structure';

const affectedTables = [
  // Tables are already created by CDK, this is just documentation
];

/**
 * Apply migration (forward)
 * This is a no-op migration that just documents the initial schema
 */
async function up(context) {
  const { log } = context;

  log('Initial schema baseline:');
  log('');
  log('ScanJobs Table:');
  log('  - PK: JOB#{jobId}');
  log('  - SK: METADATA');
  log('  - GSI: PatientIndex (patientId, createdAt)');
  log('  - GSI: StatusIndex (status, createdAt)');
  log('');
  log('Patients Table:');
  log('  - PK: PATIENT#{patientId}');
  log('  - SK: PROFILE');
  log('  - GSI: ABHAIndex (abhaId)');
  log('');
  log('VoiceJobs Table:');
  log('  - PK: VOICE#{jobId}');
  log('  - SK: METADATA');
  log('  - GSI: PatientIndex (patientId, createdAt)');
  log('');
  log('✓ Schema baseline documented');
}

/**
 * Rollback migration (backward)
 * No-op for baseline migration
 */
async function down(context) {
  const { log } = context;
  log('✓ Baseline migration rollback (no-op)');
}

module.exports = {
  description,
  affectedTables,
  up,
  down,
};
