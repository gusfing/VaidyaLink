/**
 * Tests for migration validators
 */

const {
  validateMigration,
  validateTableName,
  validateGSIConfig,
  validateBatchConfig,
  validateTransformFunction,
  validateContext,
  validateDynamoDBItem,
  validateVersion,
} = require('../framework/validators');

describe('Migration Validators', () => {
  describe('validateMigration', () => {
    it('should validate a correct migration', () => {
      const migration = {
        description: 'Test migration',
        affectedTables: ['vaidyalink-scanjobs-dev'],
        up: async () => {},
        down: async () => {},
      };

      expect(() => validateMigration(migration, 'up')).not.toThrow();
    });

    it('should throw if up function is missing', () => {
      const migration = {
        description: 'Test migration',
        affectedTables: ['vaidyalink-scanjobs-dev'],
        down: async () => {},
      };

      expect(() => validateMigration(migration, 'up')).toThrow('must export an "up" function');
    });

    it('should throw if down function is missing', () => {
      const migration = {
        description: 'Test migration',
        affectedTables: ['vaidyalink-scanjobs-dev'],
        up: async () => {},
      };

      expect(() => validateMigration(migration, 'down')).toThrow('must export a "down" function');
    });

    it('should throw if description is missing', () => {
      const migration = {
        affectedTables: ['vaidyalink-scanjobs-dev'],
        up: async () => {},
        down: async () => {},
      };

      expect(() => validateMigration(migration, 'up')).toThrow(
        'must export a "description" string'
      );
    });

    it('should throw if affectedTables is missing', () => {
      const migration = {
        description: 'Test migration',
        up: async () => {},
        down: async () => {},
      };

      expect(() => validateMigration(migration, 'up')).toThrow(
        'must export an "affectedTables" array'
      );
    });

    it('should throw if affectedTables is empty', () => {
      const migration = {
        description: 'Test migration',
        affectedTables: [],
        up: async () => {},
        down: async () => {},
      };

      expect(() => validateMigration(migration, 'up')).toThrow(
        'must specify at least one affected table'
      );
    });
  });

  describe('validateTableName', () => {
    it('should validate correct table names', () => {
      expect(() => validateTableName('vaidyalink-scanjobs-dev')).not.toThrow();
      expect(() => validateTableName('vaidyalink-patients-prod')).not.toThrow();
      expect(() => validateTableName('vaidyalink-voicejobs-staging')).not.toThrow();
    });

    it('should throw for invalid table names', () => {
      expect(() => validateTableName('invalid-table')).toThrow('Invalid table name format');
      expect(() => validateTableName('vaidyalink-only')).toThrow('Invalid table name format');
      expect(() => validateTableName('')).toThrow('Table name must be a non-empty string');
    });
  });

  describe('validateGSIConfig', () => {
    it('should validate correct GSI config', () => {
      const config = {
        indexName: 'TestIndex',
        partitionKey: 'testKey',
        projectionType: 'ALL',
      };

      expect(() => validateGSIConfig(config)).not.toThrow();
    });

    it('should throw if indexName is missing', () => {
      const config = {
        partitionKey: 'testKey',
        projectionType: 'ALL',
      };

      expect(() => validateGSIConfig(config)).toThrow('must have an indexName string');
    });

    it('should throw if partitionKey is missing', () => {
      const config = {
        indexName: 'TestIndex',
        projectionType: 'ALL',
      };

      expect(() => validateGSIConfig(config)).toThrow('must have a partitionKey string');
    });

    it('should throw for invalid projectionType', () => {
      const config = {
        indexName: 'TestIndex',
        partitionKey: 'testKey',
        projectionType: 'INVALID',
      };

      expect(() => validateGSIConfig(config)).toThrow('Invalid projectionType');
    });

    it('should require nonKeyAttributes for INCLUDE projection', () => {
      const config = {
        indexName: 'TestIndex',
        partitionKey: 'testKey',
        projectionType: 'INCLUDE',
      };

      expect(() => validateGSIConfig(config)).toThrow('must specify nonKeyAttributes array');
    });
  });

  describe('validateBatchConfig', () => {
    it('should validate correct batch config', () => {
      const config = {
        batchSize: 25,
        delayMs: 100,
        maxRetries: 3,
      };

      expect(() => validateBatchConfig(config)).not.toThrow();
    });

    it('should throw for invalid batchSize', () => {
      const config = { batchSize: -1 };
      expect(() => validateBatchConfig(config)).toThrow('batchSize must be a positive number');
    });

    it('should throw for invalid delayMs', () => {
      const config = { delayMs: -1 };
      expect(() => validateBatchConfig(config)).toThrow('delayMs must be a non-negative number');
    });
  });

  describe('validateTransformFunction', () => {
    it('should validate a correct transform function', () => {
      const fn = (item) => item;
      expect(() => validateTransformFunction(fn)).not.toThrow();
    });

    it('should throw if not a function', () => {
      expect(() => validateTransformFunction('not a function')).toThrow(
        'Transform must be a function'
      );
    });

    it('should throw if function has no parameters', () => {
      const fn = () => {};
      expect(() => validateTransformFunction(fn)).toThrow('must accept at least one parameter');
    });
  });

  describe('validateContext', () => {
    it('should validate correct context', () => {
      const context = {
        environment: 'dev',
        dryRun: false,
        log: () => {},
      };

      expect(() => validateContext(context)).not.toThrow();
    });

    it('should throw if environment is missing', () => {
      const context = {
        dryRun: false,
        log: () => {},
      };

      expect(() => validateContext(context)).toThrow('must have an environment string');
    });

    it('should throw if dryRun is not boolean', () => {
      const context = {
        environment: 'dev',
        dryRun: 'false',
        log: () => {},
      };

      expect(() => validateContext(context)).toThrow('must have a dryRun boolean');
    });

    it('should throw if log is not a function', () => {
      const context = {
        environment: 'dev',
        dryRun: false,
        log: 'not a function',
      };

      expect(() => validateContext(context)).toThrow('must have a log function');
    });
  });

  describe('validateDynamoDBItem', () => {
    it('should validate correct DynamoDB item', () => {
      const item = {
        PK: 'JOB#123',
        SK: 'METADATA',
        data: 'test',
      };

      expect(() => validateDynamoDBItem(item)).not.toThrow();
    });

    it('should throw if PK is missing', () => {
      const item = {
        SK: 'METADATA',
        data: 'test',
      };

      expect(() => validateDynamoDBItem(item)).toThrow('must have a PK');
    });

    it('should throw if SK is missing', () => {
      const item = {
        PK: 'JOB#123',
        data: 'test',
      };

      expect(() => validateDynamoDBItem(item)).toThrow('must have an SK');
    });
  });

  describe('validateVersion', () => {
    it('should validate correct version formats', () => {
      expect(() => validateVersion('001')).not.toThrow();
      expect(() => validateVersion('042')).not.toThrow();
      expect(() => validateVersion('999')).not.toThrow();
    });

    it('should throw for invalid version formats', () => {
      expect(() => validateVersion('1')).toThrow('Invalid version format');
      expect(() => validateVersion('01')).toThrow('Invalid version format');
      expect(() => validateVersion('1000')).toThrow('Invalid version format');
      expect(() => validateVersion('abc')).toThrow('Invalid version format');
    });
  });
});
