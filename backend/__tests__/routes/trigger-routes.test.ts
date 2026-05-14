import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { registerTriggerRoutes } from '../../src/routes/trigger-routes.js';
import type { CrudService } from '../../src/services/crud-service.js';
import type { TriggerService } from '../../src/services/trigger-service.js';

type Handler = (req: any, res: any) => void | Promise<void>;
type RouterMock = { get: jest.Mock; post: jest.Mock; put: jest.Mock; delete: jest.Mock };

function buildRes() {
  const res: Record<string, jest.Mock> = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  };
  return res as unknown as { json: jest.Mock; status: jest.Mock };
}

const mockTask = {
  id: 1,
  name: 'test-task',
  label: 'Test',
  description: '',
  schedule_datetime: null,
  recursive_timestamp: null,
  expiration_datetime: null,
  times_total: 0,
  times_called: 0,
  last_ejecution_datetime: null,
  script: 'echo hello',
  active: true,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

const mockExecution = {
  id: 10,
  task_id: 1,
  planned_at: '2024-06-01T00:00:00.000Z',
  status: 'pending' as const,
  created_at: '2024-01-01T00:00:00.000Z',
};

const mockTriggerResult = {
  task_id: 1,
  execution_id: 10,
  planned_at: '2024-06-01T00:00:00.000Z',
  fired_at: '2024-06-01T00:00:00.500Z',
};

describe('registerTriggerRoutes', () => {
  let mockRouter: RouterMock;
  let mockCrud: Record<string, jest.Mock>;
  let mockTrigger: Record<string, jest.Mock>;
  let mockConfig: Record<string, unknown>;

  function extractHandler(route: string, method: keyof RouterMock): Handler {
    const calls = mockRouter[method].mock.calls;
    const call = calls.find((c: unknown[]) => c[0] === route);
    if (!call) throw new Error(`Route ${method.toUpperCase()} ${route} not registered`);
    return call[1] as Handler;
  }

  beforeEach(() => {
    mockRouter = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };
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
    mockTrigger = {
      fireTask: jest.fn(),
      scheduleBuffer: jest.fn(),
      clearTimeouts: jest.fn(),
      resetAndReload: jest.fn(),
    };
    mockConfig = {};

    registerTriggerRoutes(
      mockRouter as any,
      mockConfig as any,
      mockCrud as unknown as CrudService,
      mockTrigger as unknown as TriggerService,
    );
  });

  describe('POST /trigger/:id', () => {
    it('triggers task and returns 200', async () => {
      mockCrud.getTask.mockResolvedValue(mockTask);
      mockCrud.createExecution.mockResolvedValue(mockExecution);
      mockTrigger.fireTask.mockResolvedValue(mockTriggerResult);
      const handler = extractHandler('/trigger/:id', 'post');
      const res = buildRes();

      await handler({ params: { id: '1' } }, res);

      expect(mockCrud.getTask).toHaveBeenCalledWith(1);
      expect(mockCrud.createExecution).toHaveBeenCalledWith(1, expect.any(String));
      expect(mockTrigger.fireTask).toHaveBeenCalledWith(10);
      expect(res.json).toHaveBeenCalledWith({
        success: true, error: false, status: 200, code: 0, description: 'triggered', data: mockTriggerResult,
      });
    });

    it('returns 404 when task not found', async () => {
      mockCrud.getTask.mockResolvedValue(null);
      const handler = extractHandler('/trigger/:id', 'post');
      const res = buildRes();

      await handler({ params: { id: '999' } }, res);

      expect(mockCrud.createExecution).not.toHaveBeenCalled();
      expect(mockTrigger.fireTask).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 404, code: 0, description: 'not-found',
      });
    });

    it('returns 400 when task is not active', async () => {
      mockCrud.getTask.mockResolvedValue({ ...mockTask, active: false });
      const handler = extractHandler('/trigger/:id', 'post');
      const res = buildRes();

      await handler({ params: { id: '1' } }, res);

      expect(mockCrud.createExecution).not.toHaveBeenCalled();
      expect(mockTrigger.fireTask).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 400, code: 0, description: 'task-not-active',
      });
    });

    it('returns 500 on exception', async () => {
      mockCrud.getTask.mockRejectedValue(new Error('db error'));
      const handler = extractHandler('/trigger/:id', 'post');
      const res = buildRes();

      await handler({ params: { id: '1' } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    });
  });

  describe('POST /trigger/batch', () => {
    it('triggers all tasks and returns counts', async () => {
      mockCrud.getTask
        .mockResolvedValueOnce(mockTask) // id=1, active
        .mockResolvedValueOnce({ ...mockTask, id: 2 }); // id=2, active
      mockCrud.createExecution
        .mockResolvedValueOnce({ ...mockExecution, id: 11 })
        .mockResolvedValueOnce({ ...mockExecution, id: 12 });
      mockTrigger.fireTask
        .mockResolvedValueOnce(mockTriggerResult)
        .mockResolvedValueOnce(mockTriggerResult);

      const handler = extractHandler('/trigger/batch', 'post');
      const res = buildRes();

      await handler({ body: { task_ids: [1, 2] } }, res);

      expect(mockTrigger.fireTask).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({
        success: true, error: false, status: 200, code: 0, description: 'ok',
        data: { triggered: 2, failed: 0 },
      });
    });

    it('skips inactive tasks and counts them as failed', async () => {
      mockCrud.getTask
        .mockResolvedValueOnce(mockTask) // active
        .mockResolvedValueOnce({ ...mockTask, active: false }) // inactive - skip
        .mockResolvedValueOnce(null); // not found - skip
      mockCrud.createExecution.mockResolvedValue(mockExecution);
      mockTrigger.fireTask.mockResolvedValue(mockTriggerResult);

      const handler = extractHandler('/trigger/batch', 'post');
      const res = buildRes();

      await handler({ body: { task_ids: [1, 2, 3] } }, res);

      expect(mockTrigger.fireTask).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({
        success: true, error: false, status: 200, code: 0, description: 'ok',
        data: { triggered: 1, failed: 2 },
      });
    });

    it('handles fireTask errors for individual tasks', async () => {
      mockCrud.getTask.mockResolvedValue(mockTask);
      mockCrud.createExecution.mockResolvedValue(mockExecution);
      mockTrigger.fireTask
        .mockResolvedValueOnce(mockTriggerResult)
        .mockRejectedValueOnce(new Error('fail'));

      const handler = extractHandler('/trigger/batch', 'post');
      const res = buildRes();

      await handler({ body: { task_ids: [1, 2] } }, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true, error: false, status: 200, code: 0, description: 'ok',
        data: { triggered: 1, failed: 1 },
      });
    });

    it('returns 400 when task_ids is not an array', async () => {
      const handler = extractHandler('/trigger/batch', 'post');
      const res = buildRes();

      await handler({ body: {} }, res);

      expect(mockCrud.getTask).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 400, code: 0,
        description: 'validation-error: task_ids array is required',
      });
    });

    it('returns 400 when task_ids is empty array', async () => {
      const handler = extractHandler('/trigger/batch', 'post');
      const res = buildRes();

      await handler({ body: { task_ids: [] } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('counts failed tasks when getTask throws', async () => {
      mockCrud.getTask.mockRejectedValue(new Error('db error'));
      const handler = extractHandler('/trigger/batch', 'post');
      const res = buildRes();

      await handler({ body: { task_ids: [1, 2] } }, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true, error: false, status: 200, code: 0, description: 'ok',
        data: { triggered: 0, failed: 2 },
      });
    });

    it('returns 500 on top-level exception in outer catch', async () => {
      mockCrud.getTask.mockResolvedValue(mockTask);
      mockCrud.createExecution.mockResolvedValue(mockExecution);
      mockTrigger.fireTask.mockResolvedValue(mockTriggerResult);
      const handler = extractHandler('/trigger/batch', 'post');
      const res = buildRes();
      res.json.mockImplementationOnce(() => { throw new Error('res error'); });

      await handler({ body: { task_ids: [1] } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    });
  });
});
