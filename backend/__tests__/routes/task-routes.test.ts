import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { registerTaskRoutes } from '../../src/routes/task-routes.js';
import type { CrudService } from '../../src/services/crud-service.js';

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
  description: 'A test task',
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

const mockBuffer = {
  id: 5,
  task_id: 1,
  planned_at: '2024-06-01T00:00:00.000Z',
  status: 'pending' as const,
  created_at: '2024-01-01T00:00:00.000Z',
};

const apiResponse = {
  success: true,
  error: false,
  status: 200,
  code: 0,
  description: 'ok',
};

describe('registerTaskRoutes', () => {
  let mockRouter: RouterMock;
  let mockCrud: Record<string, jest.Mock>;
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
    mockConfig = {};

    registerTaskRoutes(mockRouter as any, mockConfig as any, mockCrud as unknown as CrudService);
  });

  describe('GET /tasks', () => {
    it('returns paginated task list with defaults', async () => {
      mockCrud.listTasks.mockResolvedValue({ data: [mockTask], total: 1 });
      const handler = extractHandler('/tasks', 'get');
      const res = buildRes();

      await handler({ query: {} }, res);

      expect(mockCrud.listTasks).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith({
        ...apiResponse,
        data: { tasks: [mockTask], total: 1, page: 1, limit: 50 },
      });
    });

    it('passes query params to listTasks', async () => {
      mockCrud.listTasks.mockResolvedValue({ data: [], total: 0 });
      const handler = extractHandler('/tasks', 'get');
      const res = buildRes();

      await handler({ query: { active: 'true', page: '3', limit: '10', search: 'hello' } }, res);

      expect(mockCrud.listTasks).toHaveBeenCalledWith({
        active: true,
        page: 3,
        limit: 10,
        search: 'hello',
      });
    });

    it('parses active as true when "1"', async () => {
      mockCrud.listTasks.mockResolvedValue({ data: [], total: 0 });
      const handler = extractHandler('/tasks', 'get');
      const res = buildRes();

      await handler({ query: { active: '1' } }, res);

      expect(mockCrud.listTasks).toHaveBeenCalledWith({ active: true });
    });

    it('parses active as false when "false"', async () => {
      mockCrud.listTasks.mockResolvedValue({ data: [], total: 0 });
      const handler = extractHandler('/tasks', 'get');
      const res = buildRes();

      await handler({ query: { active: 'false' } }, res);

      expect(mockCrud.listTasks).toHaveBeenCalledWith({ active: false });
    });

    it('enforces minimum page of 1 (negative number)', async () => {
      mockCrud.listTasks.mockResolvedValue({ data: [], total: 0 });
      const handler = extractHandler('/tasks', 'get');
      const res = buildRes();

      await handler({ query: { page: '-5' } }, res);

      expect(mockCrud.listTasks).toHaveBeenCalledWith({ page: 1 });
    });

    it('falls back to default page when parsePage is 0', async () => {
      mockCrud.listTasks.mockResolvedValue({ data: [], total: 0 });
      const handler = extractHandler('/tasks', 'get');
      const res = buildRes();

      await handler({ query: { page: '0' } }, res);

      expect(mockCrud.listTasks).toHaveBeenCalledWith({ page: 1 });
    });

    it('enforces minimum limit of 1 (negative number)', async () => {
      mockCrud.listTasks.mockResolvedValue({ data: [], total: 0 });
      const handler = extractHandler('/tasks', 'get');
      const res = buildRes();

      await handler({ query: { limit: '-5' } }, res);

      expect(mockCrud.listTasks).toHaveBeenCalledWith({ limit: 1 });
    });

    it('falls back to default limit when parseInt is 0', async () => {
      mockCrud.listTasks.mockResolvedValue({ data: [], total: 0 });
      const handler = extractHandler('/tasks', 'get');
      const res = buildRes();

      await handler({ query: { limit: '0' } }, res);

      expect(mockCrud.listTasks).toHaveBeenCalledWith({ limit: 50 });
    });

    it('returns 500 on exception', async () => {
      mockCrud.listTasks.mockRejectedValue(new Error('db error'));
      const handler = extractHandler('/tasks', 'get');
      const res = buildRes();

      await handler({ query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    });
  });

  describe('GET /tasks/:id', () => {
    it('returns task when found', async () => {
      mockCrud.getTask.mockResolvedValue(mockTask);
      const handler = extractHandler('/tasks/:id', 'get');
      const res = buildRes();

      await handler({ params: { id: '1' } }, res);

      expect(mockCrud.getTask).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({
        ...apiResponse, data: mockTask,
      });
    });

    it('returns 404 when not found', async () => {
      mockCrud.getTask.mockResolvedValue(null);
      const handler = extractHandler('/tasks/:id', 'get');
      const res = buildRes();

      await handler({ params: { id: '999' } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 404, code: 0, description: 'not-found',
      });
    });

    it('returns 500 on exception', async () => {
      mockCrud.getTask.mockRejectedValue(new Error('db error'));
      const handler = extractHandler('/tasks/:id', 'get');
      const res = buildRes();

      await handler({ params: { id: '1' } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    });
  });

  describe('POST /tasks', () => {
    it('creates task and returns 201', async () => {
      mockCrud.createTask.mockResolvedValue(mockTask);
      const handler = extractHandler('/tasks', 'post');
      const res = buildRes();
      const body = { name: 'new', label: 'New', script: 'echo hi' };

      await handler({ body }, res);

      expect(mockCrud.createTask).toHaveBeenCalledWith(body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true, error: false, status: 201, code: 0, description: 'created', data: mockTask,
      });
    });

    it('returns 400 when name is missing', async () => {
      const handler = extractHandler('/tasks', 'post');
      const res = buildRes();

      await handler({ body: { label: 'New', script: 'echo hi' } }, res);

      expect(mockCrud.createTask).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 400, code: 0,
        description: 'validation-error: name, label, and script are required',
      });
    });

    it('returns 400 when label is missing', async () => {
      const handler = extractHandler('/tasks', 'post');
      const res = buildRes();

      await handler({ body: { name: 'new', script: 'echo hi' } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when script is missing', async () => {
      const handler = extractHandler('/tasks', 'post');
      const res = buildRes();

      await handler({ body: { name: 'new', label: 'New' } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('passes extra fields from body to createTask', async () => {
      mockCrud.createTask.mockResolvedValue(mockTask);
      const handler = extractHandler('/tasks', 'post');
      const res = buildRes();

      await handler({ body: { name: 'n', label: 'L', script: 's', description: 'extra field' } }, res);

      expect(mockCrud.createTask).toHaveBeenCalledWith({
        name: 'n', label: 'L', script: 's', description: 'extra field',
      });
    });

    it('returns 500 on exception', async () => {
      mockCrud.createTask.mockRejectedValue(new Error('db error'));
      const handler = extractHandler('/tasks', 'post');
      const res = buildRes();

      await handler({ body: { name: 'n', label: 'L', script: 's' } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    });
  });

  describe('PUT /tasks/:id', () => {
    it('updates task and returns updated data', async () => {
      mockCrud.updateTask.mockResolvedValue(mockTask);
      const handler = extractHandler('/tasks/:id', 'put');
      const res = buildRes();
      const body = { name: 'updated' };

      await handler({ params: { id: '1' }, body }, res);

      expect(mockCrud.updateTask).toHaveBeenCalledWith(1, body);
      expect(res.json).toHaveBeenCalledWith({
        ...apiResponse, description: 'updated', data: mockTask,
      });
    });

    it('returns 404 when task not found', async () => {
      mockCrud.updateTask.mockResolvedValue(null);
      const handler = extractHandler('/tasks/:id', 'put');
      const res = buildRes();

      await handler({ params: { id: '999' }, body: { name: 'x' } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 404, code: 0, description: 'not-found',
      });
    });

    it('returns 500 on exception', async () => {
      mockCrud.updateTask.mockRejectedValue(new Error('db error'));
      const handler = extractHandler('/tasks/:id', 'put');
      const res = buildRes();

      await handler({ params: { id: '1' }, body: {} }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('cancels pending executions, deletes task, returns 200', async () => {
      mockCrud.cancelPendingExecutions.mockResolvedValue(0);
      mockCrud.deleteTask.mockResolvedValue(true);
      const handler = extractHandler('/tasks/:id', 'delete');
      const res = buildRes();

      await handler({ params: { id: '1' } }, res);

      expect(mockCrud.cancelPendingExecutions).toHaveBeenCalledWith(1);
      expect(mockCrud.deleteTask).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({
        ...apiResponse, description: 'deleted',
      });
    });

    it('returns 404 when task not found', async () => {
      mockCrud.cancelPendingExecutions.mockResolvedValue(0);
      mockCrud.deleteTask.mockResolvedValue(false);
      const handler = extractHandler('/tasks/:id', 'delete');
      const res = buildRes();

      await handler({ params: { id: '999' } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 404, code: 0, description: 'not-found',
      });
    });

    it('returns 500 on exception', async () => {
      mockCrud.deleteTask.mockRejectedValue(new Error('db error'));
      const handler = extractHandler('/tasks/:id', 'delete');
      const res = buildRes();

      await handler({ params: { id: '1' } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    });
  });

  describe('GET /tasks/:id/buffer', () => {
    it('returns buffer entries for task', async () => {
      mockCrud.getBufferForTask.mockResolvedValue([mockBuffer]);
      const handler = extractHandler('/tasks/:id/buffer', 'get');
      const res = buildRes();

      await handler({ params: { id: '1' } }, res);

      expect(mockCrud.getBufferForTask).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({
        ...apiResponse, data: [mockBuffer],
      });
    });

    it('returns 500 on exception', async () => {
      mockCrud.getBufferForTask.mockRejectedValue(new Error('db error'));
      const handler = extractHandler('/tasks/:id/buffer', 'get');
      const res = buildRes();

      await handler({ params: { id: '1' } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    });
  });
});
