import { jest } from '@jest/globals';

jest.unstable_mockModule('objection', () => {
  class MockModel {
    static knex = jest.fn();
    static get tableName() { return 'dummy'; }
    static get jsonSchema() { return {}; }
    static get relationMappings() { return {}; }
    $beforeInsert() {}
  }

  (MockModel as any).HasManyRelation = 'HasManyRelation';
  (MockModel as any).BelongsToOneRelation = 'BelongsToOneRelation';

  return {
    Model: MockModel,
    compose: jest.fn(),
    ref: jest.fn(),
    raw: jest.fn(),
  };
});

describe('ExecutionBuffer model', () => {
  let Model: any;
  let ExecutionBuffer: any;

  beforeAll(async () => {
    const objection = await import('objection');
    Model = objection.Model;
    const mod = await import('../../src/models/ExecutionBuffer.js');
    ExecutionBuffer = mod.ExecutionBuffer;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tableName', () => {
    it('returns "execution_buffer"', () => {
      expect(ExecutionBuffer.tableName).toBe('execution_buffer');
    });
  });

  describe('jsonSchema', () => {
    let schema: Record<string, any>;

    beforeEach(() => {
      schema = ExecutionBuffer.jsonSchema;
    });

    it('requires task_id and planned_at', () => {
      expect(schema.required).toEqual(['task_id', 'planned_at']);
    });

    it('has id as integer', () => {
      expect(schema.properties.id).toEqual({ type: 'integer' });
    });

    it('has task_id as integer', () => {
      expect(schema.properties.task_id).toEqual({ type: 'integer' });
    });

    it('has planned_at as string', () => {
      expect(schema.properties.planned_at).toEqual({ type: 'string' });
    });

    it('has status with enum [pending, fired, cancelled] and default pending', () => {
      expect(schema.properties.status).toEqual({
        type: 'string',
        enum: ['pending', 'fired', 'cancelled'],
        default: 'pending',
      });
    });

    it('has created_at as string', () => {
      expect(schema.properties.created_at).toEqual({ type: 'string' });
    });
  });

  describe('relationMappings', () => {
    let mappings: Record<string, any>;

    beforeEach(() => {
      mappings = ExecutionBuffer.relationMappings;
    });

    it('has task with BelongsToOneRelation', () => {
      expect(mappings.task).toBeDefined();
      expect(mappings.task.relation).toBe(Model.BelongsToOneRelation);
    });

    it('has correct join from execution_buffer.task_id to tasks.id', () => {
      expect(mappings.task.join.from).toBe('execution_buffer.task_id');
      expect(mappings.task.join.to).toBe('tasks.id');
    });

    it('references Task as modelClass', async () => {
      const { Task } = await import('../../src/models/Task.js');
      expect(mappings.task.modelClass).toBe(Task);
    });
  });

  describe('$beforeInsert', () => {
    it('sets created_at', () => {
      const before = Date.now();
      const buffer = new ExecutionBuffer();
      buffer.$beforeInsert();
      const createdAt = new Date(buffer.created_at).getTime();
      expect(createdAt).toBeGreaterThanOrEqual(before - 100);
      expect(createdAt).toBeLessThanOrEqual(Date.now() + 100);
    });

    it('defaults status to "pending" when not set', () => {
      const buffer = new ExecutionBuffer();
      buffer.$beforeInsert();
      expect(buffer.status).toBe('pending');
    });

    it('defaults status to "pending" when empty string', () => {
      const buffer = new ExecutionBuffer() as any;
      buffer.status = '';
      buffer.$beforeInsert();
      expect(buffer.status).toBe('pending');
    });

    it('preserves status when set to "fired"', () => {
      const buffer = new ExecutionBuffer();
      buffer.status = 'fired';
      buffer.$beforeInsert();
      expect(buffer.status).toBe('fired');
    });

    it('preserves status when set to "cancelled"', () => {
      const buffer = new ExecutionBuffer();
      buffer.status = 'cancelled';
      buffer.$beforeInsert();
      expect(buffer.status).toBe('cancelled');
    });
  });
});
