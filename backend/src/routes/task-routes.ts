import { Router, Request, Response } from 'express';
import { AppConfig } from '../env.js';
import { CrudService } from '../services/crud-service.js';

export function registerTaskRoutes(router: Router, config: AppConfig, crud: CrudService): void {
  router.get('/tasks', async (req: Request, res: Response) => {
    try {
      const { active, page, limit, search } = req.query;
      const options: { active?: boolean; page?: number; limit?: number; search?: string } = {};

      if (active !== undefined) options.active = active === 'true' || active === '1';
      if (page !== undefined) options.page = Math.max(1, parseInt(page as string, 10) || 1);
      if (limit !== undefined) options.limit = Math.max(1, parseInt(limit as string, 10) || 50);
      if (search !== undefined) options.search = search as string;

      const result = await crud.listTasks(options);

      res.json({
        success: true,
        error: false,
        status: 200,
        code: 0,
        description: 'ok',
        data: {
          tasks: result.data,
          total: result.total,
          page: options.page ?? 1,
          limit: options.limit ?? 50,
        },
      });
    } catch {
      res.status(500).json({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    }
  });

  router.get('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const task = await crud.getTask(id);

      if (!task) {
        res.status(404).json({
          success: false, error: true, status: 404, code: 0, description: 'not-found',
        });
        return;
      }

      res.json({
        success: true, error: false, status: 200, code: 0, description: 'ok', data: task,
      });
    } catch {
      res.status(500).json({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    }
  });

  router.post('/tasks', async (req: Request, res: Response) => {
    try {
      const { name, label, script, ...rest } = req.body;

      if (!name || !label || !script) {
        res.status(400).json({
          success: false, error: true, status: 400, code: 0,
          description: 'validation-error: name, label, and script are required',
        });
        return;
      }

      const task = await crud.createTask({ name, label, script, ...rest });

      res.status(201).json({
        success: true, error: false, status: 201, code: 0, description: 'created', data: task,
      });
    } catch {
      res.status(500).json({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    }
  });

  router.put('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const task = await crud.updateTask(id, req.body);

      if (!task) {
        res.status(404).json({
          success: false, error: true, status: 404, code: 0, description: 'not-found',
        });
        return;
      }

      res.json({
        success: true, error: false, status: 200, code: 0, description: 'updated', data: task,
      });
    } catch {
      res.status(500).json({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    }
  });

  router.delete('/tasks/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);

      await crud.cancelPendingExecutions(id);
      const deleted = await crud.deleteTask(id);

      if (!deleted) {
        res.status(404).json({
          success: false, error: true, status: 404, code: 0, description: 'not-found',
        });
        return;
      }

      res.json({
        success: true, error: false, status: 200, code: 0, description: 'deleted',
      });
    } catch {
      res.status(500).json({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    }
  });

  router.get('/tasks/:id/buffer', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const buffer = await crud.getBufferForTask(id);

      res.json({
        success: true, error: false, status: 200, code: 0, description: 'ok', data: buffer,
      });
    } catch {
      res.status(500).json({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    }
  });
}
