import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const mockExec = jest.fn();

jest.unstable_mockModule('child_process', () => ({
  exec: mockExec,
}));

let createTriggerService: any;
let TriggerService: any;

beforeAll(async () => {
  const mod = await import('../../src/services/trigger-service.js');
  createTriggerService = mod.createTriggerService;
  TriggerService = mod.TriggerService;
});

describe('TriggerService', () => {
  let mockDb: any;
  let mockWs: { broadcast: jest.Mock; getConnectionsCount: jest.Mock; close: jest.Mock };
  let mockCrud: any;
  let trigger: any;
  let originalFetch: any;

  function makeExecution(overrides: any = {}): any {
    return { id: 1, task_id: 1, planned_at: '2025-06-15T12:00:00Z', status: 'pending', created_at: '2025-06-15T11:00:00Z', ...overrides };
  }

  function makeTask(overrides: any = {}): any {
    return {
      id: 1, name: 'test-task', label: 'Test Task', description: '',
      schedule_datetime: null, recursive_timestamp: null, expiration_datetime: null,
      times_total: 0, times_called: 5, last_ejecution_datetime: null,
      script: 'http://localhost/test', active: true,
      updated_at: '2025-01-01T00:00:00Z', created_at: '2025-01-01T00:00:00Z',
      ...overrides,
    };
  }

  function createMockQueryBuilder(overrides: Record<string, any> = {}) {
    return {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue([1]),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(1),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      clearSelect: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      raw: jest.fn(),
      then: jest.fn().mockImplementation((resolve: (v: unknown) => void) => resolve([])),
      catch: jest.fn(),
      finally: jest.fn(),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    jest.clearAllMocks();

    const qb = createMockQueryBuilder();
    mockDb = jest.fn().mockReturnValue(qb);
    mockDb.schema = { hasTable: jest.fn(), createTable: jest.fn(), raw: jest.fn() };
    mockDb.raw = jest.fn();
    mockDb.fn = { now: jest.fn() };

    mockWs = { broadcast: jest.fn(), getConnectionsCount: jest.fn(), close: jest.fn() };
    mockCrud = {
      listTasks: jest.fn(),
      getTask: jest.fn(),
      createTask: jest.fn(),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
      getBufferForTask: jest.fn(),
      cancelPendingExecutions: jest.fn(),
      createExecution: jest.fn(),
    };

    originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

    trigger = createTriggerService(mockDb as any, mockWs as any, mockCrud as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  describe('clearTimeouts()', () => {
    it('clears all timeouts and resets', () => {
      expect(() => trigger.clearTimeouts()).not.toThrow();
    });
  });

  describe('resetAndReload()', () => {
    it('calls clearTimeouts then scheduleBuffer', async () => {
      const clearSpy = jest.spyOn(trigger, 'clearTimeouts');
      const schedSpy = jest.spyOn(trigger, 'scheduleBuffer').mockResolvedValue(undefined);
      await trigger.resetAndReload();
      expect(clearSpy).toHaveBeenCalled();
      expect(schedSpy).toHaveBeenCalled();
    });
  });

  describe('scheduleBuffer()', () => {
    it('queries pending future entries', async () => {
      await trigger.scheduleBuffer();
      expect(mockDb).toHaveBeenCalledWith('execution_buffer');
    });

    it('handles empty buffer gracefully', async () => {
      await trigger.scheduleBuffer();
    });
  });

  describe('fireTask()', () => {
    it('throws error when execution not found', async () => {
      mockDb().first = jest.fn().mockResolvedValue(undefined);
      await expect(trigger.fireTask(999)).rejects.toThrow('Execution 999 not found');
    });

    it('throws error when task not found', async () => {
      mockDb().first = jest.fn()
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(undefined);
      await expect(trigger.fireTask(1)).rejects.toThrow('Task 1 not found');
    });

    it('marks as cancelled when task is inactive', async () => {
      mockDb().first = jest.fn()
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeTask({ active: false }));

      const result = await trigger.fireTask(1);
      expect(result.task_id).toBe(1);
    });

    it('fires HTTP script with fetch POST', async () => {
      mockDb().first = jest.fn()
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeTask({ script: 'http://localhost/webhook' }));

      await trigger.fireTask(1);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost/webhook', { method: 'POST' });
    });

    it('fires shell script with exec', async () => {
      mockDb().first = jest.fn()
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeTask({ script: '/usr/local/bin/script.sh' }));

      await trigger.fireTask(1);
      expect(mockExec).toHaveBeenCalledWith('/usr/local/bin/script.sh', expect.any(Function));
    });

    it('updates buffer status to fired', async () => {
      mockDb().first = jest.fn()
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeTask());

      await trigger.fireTask(1);
      expect(mockDb().update).toHaveBeenCalled();
    });

    it('broadcasts task_fired event', async () => {
      mockDb().first = jest.fn()
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeTask());

      await trigger.fireTask(1);
      expect(mockWs.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'task_fired' })
      );
    });

    it('returns TriggerResult with correct data', async () => {
      mockDb().first = jest.fn()
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeTask());

      const result = await trigger.fireTask(1);
      expect(result).toHaveProperty('task_id', 1);
      expect(result).toHaveProperty('execution_id', 1);
      expect(result).toHaveProperty('planned_at');
      expect(result).toHaveProperty('fired_at');
    });

    it('replans recursive task', async () => {
      mockDb().first = jest.fn()
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeTask({ recursive_timestamp: 300000 }));
      mockDb().insert = jest.fn().mockResolvedValue([99]);

      await trigger.fireTask(1);
      expect(mockDb().insert).toHaveBeenCalled();
    });

    it('does not replan recursive task when expired', async () => {
      mockDb().first = jest.fn()
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeTask({
          recursive_timestamp: 300000,
          expiration_datetime: '2025-06-14T00:00:00Z',
        }));

      await trigger.fireTask(1);
      const insertCalls = mockDb().insert.mock.calls.filter(
        (c: any[]) => c[0] && typeof c[0] === 'object' && c[0].task_id
      );
      expect(insertCalls.length).toBe(0);
    });

    it('does not replan recursive task when exhausted', async () => {
      mockDb().first = jest.fn()
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeTask({
          recursive_timestamp: 300000,
          times_total: 10,
          times_called: 10,
        }));

      await trigger.fireTask(1);
      const insertCalls = mockDb().insert.mock.calls.filter(
        (c: any[]) => c[0] && typeof c[0] === 'object' && c[0].task_id
      );
      expect(insertCalls.length).toBe(0);
    });

    it('replans recursive task when conditions allow', async () => {
      mockDb().first = jest.fn()
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeTask({
          recursive_timestamp: 300000,
          times_total: 10,
          times_called: 5,
          expiration_datetime: '2025-12-31T00:00:00Z',
        }));
      mockDb().insert = jest.fn().mockResolvedValue([99]);

      await trigger.fireTask(1);
      expect(mockDb().insert).toHaveBeenCalled();
    });
  });
});
