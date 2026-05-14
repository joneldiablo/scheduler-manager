import { jest } from '@jest/globals';
import type { Knex } from 'knex';

jest.unstable_mockModule('objection', () => {
  class MockModel {
    static knex = jest.fn();
    static get tableName() { return 'tasks'; }
    static get jsonSchema() { return {}; }
    static get relationMappings() { return {}; }
    $beforeInsert() {}
    $beforeUpdate() {}
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

describe('Task model', () => {
  let Model: any;
  let Task: any;
  let bindTaskModels: any;

  beforeAll(async () => {
    const objection = await import('objection');
    Model = objection.Model;
    const taskMod = await import('../../src/models/Task.js');
    Task = taskMod.Task;
    bindTaskModels = taskMod.bindTaskModels;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tableName', () => {
    it('returns "tasks"', () => {
      expect(Task.tableName).toBe('tasks');
    });
  });

  describe('jsonSchema', () => {
    let schema: Record<string, any>;

    beforeEach(() => {
      schema = Task.jsonSchema;
    });

    it('requires name, label, and script', () => {
      expect(schema.required).toEqual(['name', 'label', 'script']);
    });

    it('has name as string with minLength 1 and maxLength 255', () => {
      expect(schema.properties.name).toEqual({ type: 'string', minLength: 1, maxLength: 255 });
    });

    it('has label as string with minLength 1 and maxLength 255', () => {
      expect(schema.properties.label).toEqual({ type: 'string', minLength: 1, maxLength: 255 });
    });

    it('has description with default empty string', () => {
      expect(schema.properties.description).toEqual({ type: 'string', default: '' });
    });

    it('has schedule_datetime as string or null', () => {
      expect(schema.properties.schedule_datetime).toEqual({ type: ['string', 'null'] });
    });

    it('has recursive_timestamp as integer or null', () => {
      expect(schema.properties.recursive_timestamp).toEqual({ type: ['integer', 'null'] });
    });

    it('has expiration_datetime as string or null', () => {
      expect(schema.properties.expiration_datetime).toEqual({ type: ['string', 'null'] });
    });

    it('has times_total as integer with default 0 and minimum 0', () => {
      expect(schema.properties.times_total).toEqual({ type: 'integer', default: 0, minimum: 0 });
    });

    it('has times_called as integer with default 0 and minimum 0', () => {
      expect(schema.properties.times_called).toEqual({ type: 'integer', default: 0, minimum: 0 });
    });

    it('has last_ejecution_datetime as string or null', () => {
      expect(schema.properties.last_ejecution_datetime).toEqual({ type: ['string', 'null'] });
    });

    it('has script as string with minLength 1', () => {
      expect(schema.properties.script).toEqual({ type: 'string', minLength: 1 });
    });

    it('has active as boolean with default true', () => {
      expect(schema.properties.active).toEqual({ type: 'boolean', default: true });
    });

    it('has id as integer', () => {
      expect(schema.properties.id).toEqual({ type: 'integer' });
    });
  });

  describe('relationMappings', () => {
    let mappings: Record<string, any>;

    beforeEach(() => {
      mappings = Task.relationMappings;
    });

    it('has executionBuffer with HasManyRelation', () => {
      expect(mappings.executionBuffer).toBeDefined();
      expect(mappings.executionBuffer.relation).toBe(Model.HasManyRelation);
    });

    it('has correct join from tasks.id to execution_buffer.task_id', () => {
      expect(mappings.executionBuffer.join.from).toBe('tasks.id');
      expect(mappings.executionBuffer.join.to).toBe('execution_buffer.task_id');
    });
  });

  describe('$beforeInsert', () => {
    it('sets created_at and updated_at', () => {
      const before = Date.now();
      const task = new Task();
      task.$beforeInsert();
      const createdAt = new Date(task.created_at).getTime();
      const updatedAt = new Date(task.updated_at).getTime();
      expect(createdAt).toBeGreaterThanOrEqual(before - 100);
      expect(createdAt).toBeLessThanOrEqual(Date.now() + 100);
      expect(updatedAt).toBeGreaterThanOrEqual(before - 100);
      expect(updatedAt).toBeLessThanOrEqual(Date.now() + 100);
    });

    it('defaults active to true when undefined', () => {
      const task = new Task();
      task.$beforeInsert();
      expect(task.active).toBe(true);
    });

    it('defaults active to true when null', () => {
      const task = new Task() as any;
      task.active = null;
      task.$beforeInsert();
      expect(task.active).toBe(true);
    });

    it('preserves active when set to false', () => {
      const task = new Task();
      task.active = false;
      task.$beforeInsert();
      expect(task.active).toBe(false);
    });

    it('defaults times_called to 0 when undefined', () => {
      const task = new Task();
      task.$beforeInsert();
      expect(task.times_called).toBe(0);
    });

    it('defaults times_called to 0 when null', () => {
      const task = new Task() as any;
      task.times_called = null;
      task.$beforeInsert();
      expect(task.times_called).toBe(0);
    });

    it('preserves times_called when set', () => {
      const task = new Task();
      task.times_called = 42;
      task.$beforeInsert();
      expect(task.times_called).toBe(42);
    });
  });

  describe('$beforeUpdate', () => {
    it('sets updated_at', () => {
      const before = Date.now();
      const task = new Task();
      task.$beforeUpdate();
      const updatedAt = new Date(task.updated_at).getTime();
      expect(updatedAt).toBeGreaterThanOrEqual(before - 100);
      expect(updatedAt).toBeLessThanOrEqual(Date.now() + 100);
    });
  });

  describe('bindTaskModels', () => {
    it('calls Model.knex with the knex instance', () => {
      const knexMock = {} as Knex;
      bindTaskModels(knexMock);
      expect(Model.knex).toHaveBeenCalledWith(knexMock);
    });
  });
});
