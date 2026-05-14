import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { AppConfig } from '../../src/env.js';

const mockSchedule = jest.fn();

jest.unstable_mockModule('node-cron', () => ({
  default: { schedule: mockSchedule },
}));

let createPlannerService: any;

beforeAll(async () => {
  const mod = await import('../../src/services/planner-service.js');
  createPlannerService = mod.createPlannerService;
});

describe('PlannerService', () => {
  let mockDb: any;
  let mockWs: { broadcast: jest.Mock; getConnectionsCount: jest.Mock; close: jest.Mock };
  let mockTrigger: { scheduleBuffer: jest.Mock; fireTask: jest.Mock; clearTimeouts: jest.Mock; resetAndReload: jest.Mock };
  let mockConfig: Partial<AppConfig>;
  let planner: any;

  function makeTask(overrides: any = {}): any {
    return {
      id: 1, name: 'test-task', label: 'Test Task', description: '',
      schedule_datetime: null, recursive_timestamp: null, expiration_datetime: null,
      times_total: 0, times_called: 0, last_ejecution_datetime: null,
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
    mockTrigger = {
      scheduleBuffer: jest.fn().mockResolvedValue(undefined),
      fireTask: jest.fn(),
      clearTimeouts: jest.fn(),
      resetAndReload: jest.fn(),
    };
    mockConfig = { PLANNER_CRON: '*/5 * * * *' };

    mockSchedule.mockReturnValue({ start: jest.fn(), stop: jest.fn() });

    planner = createPlannerService(mockDb as any, mockWs as any, mockTrigger as any, mockConfig as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('start()', () => {
    it('schedules cron with the configured expression', () => {
      planner.start();
      expect(mockSchedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
    });

    it('does not double-schedule if already started', () => {
      planner.start();
      const callsAfterFirst = mockSchedule.mock.calls.length;
      planner.start();
      expect(mockSchedule.mock.calls.length).toBe(callsAfterFirst);
    });

    it('cron callback calls executePlanningCycle', () => {
      const spy = jest.spyOn(planner, 'executePlanningCycle').mockResolvedValue({ inserted: 0, window_start: '', window_end: '' });
      planner.start();
      const cronFn = mockSchedule.mock.calls[0][1];
      cronFn();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('stop()', () => {
    it('stops the cron task', () => {
      const mockTask = { stop: jest.fn() };
      mockSchedule.mockReturnValue(mockTask);
      planner = createPlannerService(mockDb as any, mockWs as any, mockTrigger as any, mockConfig as any);
      planner.start();
      planner.stop();
      expect(mockTask.stop).toHaveBeenCalled();
    });

    it('is safe to call multiple times', () => {
      planner.stop();
      planner.stop();
    });
  });

  describe('executePlanningCycle()', () => {
    it('returns 0 inserted when no active tasks', async () => {
      const result = await planner.executePlanningCycle();
      expect(result.inserted).toBe(0);
    });

    it('inserts scheduled task when schedule_datetime is within window', async () => {
      const schedTime = new Date('2025-06-15T12:03:00Z').toISOString();
      mockDb().where.mockImplementation((field: string) => {
        const qb = createMockQueryBuilder();
        if (field === 'active') {
          qb.first = jest.fn().mockResolvedValue(undefined);
          return qb;
        }
        return createMockQueryBuilder();
      });
      mockDb().first = jest.fn().mockResolvedValue(null);
      mockDb().insert = jest.fn().mockResolvedValue([1]);

      const result = await planner.executePlanningCycle();
      expect(result.inserted).toBe(0);
    });

    it('skips expired task', async () => {
      const task = makeTask({ expiration_datetime: '2025-06-14T00:00:00Z' });
      const result = await planner.executePlanningCycle();
      expect(result.inserted).toBe(0);
    });

    it('skips exhausted task', async () => {
      const task = makeTask({ times_total: 10, times_called: 10 });
      const result = await planner.executePlanningCycle();
      expect(result.inserted).toBe(0);
    });

    it('broadcasts buffer_updated event', async () => {
      await planner.executePlanningCycle();
      expect(mockWs.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'buffer_updated' })
      );
    });

    it('broadcasts event with correct payload structure', async () => {
      await planner.executePlanningCycle();
      expect(mockWs.broadcast).toHaveBeenCalled();
      const call = mockWs.broadcast.mock.calls[0][0];
      expect(call.type).toBe('buffer_updated');
      expect(call.payload).toHaveProperty('inserted');
      expect(call.payload).toHaveProperty('windowStart');
      expect(call.payload).toHaveProperty('windowEnd');
      expect(call).toHaveProperty('timestamp');
    });
  });
});
