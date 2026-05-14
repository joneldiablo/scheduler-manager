import { jest, describe, it, expect, beforeEach } from '@jest/globals';
jest.mock('knex');

import { createCrudService, CrudService } from '../../src/services/crud-service.js';

const mockTaskRow = {
  id: 1,
  name: 'test-task',
  label: 'Test',
  description: 'A test task',
  schedule_datetime: null,
  recursive_timestamp: null,
  expiration_datetime: null,
  times_total: 0,
  times_called: 0,
  last_ejecution_datetime: null,
  script: 'echo hello',
  active: 1,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

const mappedTask = { ...mockTaskRow, active: true };

const mockBufferRow = {
  id: 1,
  task_id: 1,
  planned_at: '2024-01-01T01:00:00.000Z',
  status: 'pending' as const,
  created_at: '2024-01-01T00:00:00.000Z',
};

describe('createCrudService', () => {
  let crud: CrudService;
  let qb: Record<string, jest.Mock>;
  let db: jest.Mock & Record<string, unknown>;
  let queryResolveValue: unknown;

  function setQueryResult(value: unknown) {
    queryResolveValue = value;
  }

  beforeEach(() => {
    queryResolveValue = undefined;

    const chainMethod = () => jest.fn().mockImplementation(() => qb);

    qb = {
      select: chainMethod(),
      where: jest.fn().mockImplementation((...args: unknown[]) => {
        if (typeof args[0] === 'function') {
          (args[0] as Function).call(qb);
        }
        return qb;
      }),
      whereIn: chainMethod(),
      orderBy: chainMethod(),
      limit: chainMethod(),
      offset: chainMethod(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue([1]),
      update: chainMethod(),
      delete: chainMethod(),
      clone: chainMethod(),
      clearSelect: chainMethod(),
      count: chainMethod(),
      orWhere: chainMethod(),
      then: jest.fn().mockImplementation((resolve: (v: unknown) => void) => {
        if (typeof resolve === 'function') resolve(queryResolveValue);
      }),
    };

    db = jest.fn().mockReturnValue(qb) as unknown as jest.Mock & Record<string, unknown>;
    (db as any).schema = { hasTable: jest.fn(), createTable: jest.fn(), raw: jest.fn() };
    (db as any).destroy = jest.fn();

    crud = createCrudService(db as any);
  });

  describe('listTasks', () => {
    it('builds correct query with no options (defaults)', async () => {
      setQueryResult([mockTaskRow]);
      qb.first = jest.fn().mockResolvedValueOnce({ count: 1 });

      const result = await crud.listTasks();

      expect(db).toHaveBeenCalledWith('tasks');
      expect(qb.select).toHaveBeenCalledWith('*');
      expect(qb.orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(qb.limit).toHaveBeenCalledWith(50);
      expect(qb.offset).toHaveBeenCalledWith(0);
      expect(qb.clone).toHaveBeenCalled();
      expect(qb.clearSelect).toHaveBeenCalled();
      expect(qb.count).toHaveBeenCalledWith({ count: '*' });
      expect(result).toEqual({ data: [mappedTask], total: 1 });
    });

    it('uses pagination (page, limit) with offset', async () => {
      setQueryResult([mockTaskRow]);
      qb.first = jest.fn().mockResolvedValueOnce({ count: 1 });

      const result = await crud.listTasks({ page: 3, limit: 10 });

      expect(qb.limit).toHaveBeenCalledWith(10);
      expect(qb.offset).toHaveBeenCalledWith(20);
      expect(result.data).toHaveLength(1);
    });

    it('filters by active status when true', async () => {
      setQueryResult([]);
      qb.first = jest.fn().mockResolvedValueOnce({ count: 0 });

      await crud.listTasks({ active: true });

      expect(qb.where).toHaveBeenCalledWith('active', 1);
    });

    it('filters by active status when false', async () => {
      setQueryResult([]);
      qb.first = jest.fn().mockResolvedValueOnce({ count: 0 });

      await crud.listTasks({ active: false });

      expect(qb.where).toHaveBeenCalledWith('active', 0);
    });

    it('searches by name/label/description with LIKE', async () => {
      setQueryResult([]);
      qb.first = jest.fn().mockResolvedValueOnce({ count: 0 });

      await crud.listTasks({ search: 'hello' });

      expect(qb.where).toHaveBeenCalledWith('name', 'like', '%hello%');
      expect(qb.orWhere).toHaveBeenCalledWith('label', 'like', '%hello%');
      expect(qb.orWhere).toHaveBeenCalledWith('description', 'like', '%hello%');
    });

    it('returns empty results when no tasks found', async () => {
      setQueryResult([]);
      qb.first = jest.fn().mockResolvedValueOnce({ count: 0 });

      const result = await crud.listTasks();

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('handles countResult being null/undefined', async () => {
      setQueryResult([]);
      qb.first = jest.fn().mockResolvedValueOnce(undefined);

      const result = await crud.listTasks();

      expect(result.total).toBe(0);
    });

    it('maps active field from 1 to true in results', async () => {
      const taskRow = { ...mockTaskRow, id: 2, name: 'second', active: 1 };
      setQueryResult([taskRow]);
      qb.first = jest.fn().mockResolvedValueOnce({ count: 1 });

      const result = await crud.listTasks();

      expect(result.data[0].active).toBe(true);
    });

    it('maps active field from 0 to false in results', async () => {
      const taskRow = { ...mockTaskRow, id: 3, name: 'third', active: 0 };
      setQueryResult([taskRow]);
      qb.first = jest.fn().mockResolvedValueOnce({ count: 1 });

      const result = await crud.listTasks();

      expect(result.data[0].active).toBe(false);
    });
  });

  describe('getTask', () => {
    it('returns task when found (with active mapped from 1 to true)', async () => {
      qb.first = jest.fn().mockResolvedValueOnce(mockTaskRow);

      const result = await crud.getTask(1);

      expect(db).toHaveBeenCalledWith('tasks');
      expect(qb.select).toHaveBeenCalledWith('*');
      expect(qb.where).toHaveBeenCalledWith('id', 1);
      expect(result).toEqual(mappedTask);
      expect(result!.active).toBe(true);
    });

    it('returns null when not found', async () => {
      qb.first = jest.fn().mockResolvedValueOnce(null);

      const result = await crud.getTask(999);

      expect(result).toBeNull();
    });

    it('maps active from 0 to false', async () => {
      qb.first = jest.fn().mockResolvedValueOnce({ ...mockTaskRow, active: 0 });

      const result = await crud.getTask(1);

      expect(result!.active).toBe(false);
    });
  });

  describe('createTask', () => {
    beforeEach(() => {
      qb.first = jest.fn().mockResolvedValueOnce(mockTaskRow);
    });

    it('inserts with all fields correctly mapped', async () => {
      qb.insert = jest.fn().mockResolvedValueOnce([42]);

      const result = await crud.createTask({
        name: 'new-task',
        label: 'New',
        description: 'A new task',
        schedule_datetime: '2024-06-01T00:00:00.000Z',
        recursive_timestamp: 3600000,
        expiration_datetime: '2025-01-01T00:00:00.000Z',
        times_total: 10,
        script: 'echo new',
        active: true,
      });

      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'new-task',
          label: 'New',
          description: 'A new task',
          schedule_datetime: '2024-06-01T00:00:00.000Z',
          recursive_timestamp: 3600000,
          expiration_datetime: '2025-01-01T00:00:00.000Z',
          times_total: 10,
          times_called: 0,
          last_ejecution_datetime: null,
          script: 'echo new',
          active: 1,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        }),
      );
      expect(result).toEqual(mappedTask);
    });

    it('defaults active to 1 when not provided', async () => {
      await crud.createTask({
        name: 'no-active',
        label: 'NoActive',
        description: '',
        script: 'echo test',
      });

      const insertCall = qb.insert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertCall.active).toBe(1);
    });

    it('sets active to 0 when false', async () => {
      await crud.createTask({
        name: 'inactive',
        label: 'Inactive',
        description: '',
        script: 'echo test',
        active: false,
      });

      const insertCall = qb.insert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertCall.active).toBe(0);
    });

    it('defaults description to empty string', async () => {
      await crud.createTask({
        name: 'no-desc',
        label: 'NoDesc',
        script: 'echo test',
      });

      const insertCall = qb.insert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertCall.description).toBe('');
    });

    it('defaults schedule_datetime and other nullable fields to null', async () => {
      await crud.createTask({
        name: 'defaults',
        label: 'Defaults',
        description: 'x',
        script: 'echo test',
      });

      const insertCall = qb.insert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertCall.schedule_datetime).toBeNull();
      expect(insertCall.recursive_timestamp).toBeNull();
      expect(insertCall.expiration_datetime).toBeNull();
    });

    it('defaults times_total to 0', async () => {
      await crud.createTask({
        name: 'times',
        label: 'Times',
        description: '',
        script: 'echo test',
      });

      const insertCall = qb.insert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertCall.times_total).toBe(0);
    });

    it('sets timestamps (created_at, updated_at)', async () => {
      const before = Date.now();

      await crud.createTask({
        name: 'timestamps',
        label: 'TS',
        description: '',
        script: 'echo test',
      });

      const insertCall = qb.insert.mock.calls[0][0] as Record<string, unknown>;
      const createdAt = new Date(insertCall.created_at as string).getTime();
      const updatedAt = new Date(insertCall.updated_at as string).getTime();
      expect(createdAt).toBeGreaterThanOrEqual(before - 100);
      expect(createdAt).toBeLessThanOrEqual(Date.now() + 100);
      expect(updatedAt).toBeGreaterThanOrEqual(before - 100);
      expect(updatedAt).toBeLessThanOrEqual(Date.now() + 100);
    });
  });

  describe('updateTask', () => {
    it('returns null when task not found', async () => {
      qb.first = jest.fn().mockResolvedValueOnce(null);

      const result = await crud.updateTask(999, { name: 'new' });

      expect(result).toBeNull();
    });

    it('updates only allowed fields', async () => {
      qb.first = jest.fn()
        .mockResolvedValueOnce(mockTaskRow) // existing fetch
        .mockResolvedValueOnce({ ...mockTaskRow, name: 'updated-name' }); // refetch

      const result = await crud.updateTask(1, { name: 'updated-name' });

      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'updated-name',
          updated_at: expect.any(String),
        }),
      );
      expect(result).toBeDefined();
      expect(result!.name).toBe('updated-name');
    });

    it('ignores non-allowed fields, only includes allowed ones in update', async () => {
      qb.first = jest.fn()
        .mockResolvedValueOnce(mockTaskRow)
        .mockResolvedValueOnce(mockTaskRow);

      await crud.updateTask(1, {
        times_called: 99,
        name: 'valid-update',
        label: 'valid-label',
      } as any);

      const updateData = qb.update.mock.calls[0][0] as Record<string, unknown>;
      expect(updateData.name).toBe('valid-update');
      expect(updateData.label).toBe('valid-label');
      expect(updateData.times_called).toBeUndefined();
      expect(updateData.last_ejecution_datetime).toBeUndefined();
    });

    it('maps active boolean to 0/1 (false -> 0)', async () => {
      qb.first = jest.fn()
        .mockResolvedValueOnce(mockTaskRow)
        .mockResolvedValueOnce({ ...mockTaskRow, active: 0 });

      await crud.updateTask(1, { active: false });

      const updateData = qb.update.mock.calls[0][0] as Record<string, unknown>;
      expect(updateData.active).toBe(0);
    });

    it('maps active boolean to 0/1 (true -> 1)', async () => {
      qb.first = jest.fn()
        .mockResolvedValueOnce(mockTaskRow)
        .mockResolvedValueOnce(mockTaskRow);

      await crud.updateTask(1, { active: true });

      const updateData = qb.update.mock.calls[0][0] as Record<string, unknown>;
      expect(updateData.active).toBe(1);
    });

    it('returns existing when no allowed fields changed', async () => {
      qb.first = jest.fn()
        .mockResolvedValueOnce(mockTaskRow);

      const result = await crud.updateTask(1, { times_called: 5 } as any);

      expect(qb.update).not.toHaveBeenCalled();
      expect(result).toEqual(mappedTask);
    });

    it('preserves existing values for unset fields', async () => {
      qb.first = jest.fn()
        .mockResolvedValueOnce(mockTaskRow)
        .mockResolvedValueOnce(mockTaskRow);

      await crud.updateTask(1, { label: 'only-label' });

      const updateData = qb.update.mock.calls[0][0] as Record<string, unknown>;
      expect(updateData.label).toBe('only-label');
      expect(updateData.name).toBeUndefined();
      expect(updateData.description).toBeUndefined();
      expect(updateData.updated_at).toEqual(expect.any(String));
    });
  });

  describe('deleteTask', () => {
    it('deletes buffer entries first, then task, returns true', async () => {
      qb.first = jest.fn().mockResolvedValueOnce({ id: 1 });

      const result = await crud.deleteTask(1);

      expect(qb.delete).toHaveBeenCalledTimes(2);
      expect(qb.where).toHaveBeenCalledWith('task_id', 1);
      expect(qb.where).toHaveBeenCalledWith('id', 1);
      expect(result).toBe(true);
    });

    it('returns false when task not found', async () => {
      qb.first = jest.fn().mockResolvedValueOnce(null);

      const result = await crud.deleteTask(999);

      expect(qb.delete).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('getBufferForTask', () => {
    it('returns ordered buffer entries for task_id', async () => {
      setQueryResult([mockBufferRow]);

      const result = await crud.getBufferForTask(1);

      expect(db).toHaveBeenCalledWith('execution_buffer');
      expect(qb.where).toHaveBeenCalledWith('task_id', 1);
      expect(qb.orderBy).toHaveBeenCalledWith('planned_at', 'asc');
      expect(result).toEqual([mockBufferRow]);
    });

    it('returns empty array when none found', async () => {
      setQueryResult([]);

      const result = await crud.getBufferForTask(99);

      expect(result).toEqual([]);
    });
  });

  describe('cancelPendingExecutions', () => {
    it('updates buffer status to cancelled where pending', async () => {
      setQueryResult(3);

      const count = await crud.cancelPendingExecutions(1);

      expect(db).toHaveBeenCalledWith('execution_buffer');
      expect(qb.update).toHaveBeenCalledWith({ status: 'cancelled' });
      expect(qb.where).toHaveBeenCalledWith('task_id', 1);
      expect(qb.where).toHaveBeenCalledWith('status', 'pending');
      expect(count).toBe(3);
    });

    it('returns 0 when no pending executions exist', async () => {
      setQueryResult(0);

      const count = await crud.cancelPendingExecutions(99);

      expect(count).toBe(0);
    });
  });

  describe('createExecution', () => {
    it('inserts with correct task_id, planned_at, status=pending', async () => {
      qb.insert = jest.fn().mockResolvedValueOnce([42]);
      qb.first = jest.fn().mockResolvedValueOnce(mockBufferRow);

      const result = await crud.createExecution(1, '2024-06-01T00:00:00.000Z');

      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          task_id: 1,
          planned_at: '2024-06-01T00:00:00.000Z',
          status: 'pending',
          created_at: expect.any(String),
        }),
      );
      expect(result).toEqual(mockBufferRow);
    });
  });

  describe('CrudService interface', () => {
    it('returns CrudService with all methods', () => {
      expect(crud).toBeDefined();
      expect(typeof crud.listTasks).toBe('function');
      expect(typeof crud.getTask).toBe('function');
      expect(typeof crud.createTask).toBe('function');
      expect(typeof crud.updateTask).toBe('function');
      expect(typeof crud.deleteTask).toBe('function');
      expect(typeof crud.getBufferForTask).toBe('function');
      expect(typeof crud.cancelPendingExecutions).toBe('function');
      expect(typeof crud.createExecution).toBe('function');
    });
  });
});
