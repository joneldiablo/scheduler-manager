import { Router, Request, Response } from 'express';
import { AppConfig } from '../env.js';
import { CrudService } from '../services/crud-service.js';
import { TriggerService } from '../services/trigger-service.js';

export function registerTriggerRoutes(router: Router, config: AppConfig, crud: CrudService, trigger: TriggerService): void {
  router.post('/trigger/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const task = await crud.getTask(id);

      if (!task) {
        res.status(404).json({
          success: false, error: true, status: 404, code: 0, description: 'not-found',
        });
        return;
      }

      if (!task.active) {
        res.status(400).json({
          success: false, error: true, status: 400, code: 0, description: 'task-not-active',
        });
        return;
      }

      const plannedAt = new Date().toISOString();
      const execution = await crud.createExecution(id, plannedAt);
      const result = await trigger.fireTask(execution.id!);

      res.json({
        success: true, error: false, status: 200, code: 0, description: 'triggered', data: result,
      });
    } catch {
      res.status(500).json({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    }
  });

  router.post('/trigger/batch', async (req: Request, res: Response) => {
    try {
      const { task_ids } = req.body as { task_ids?: number[] };

      if (!Array.isArray(task_ids) || task_ids.length === 0) {
        res.status(400).json({
          success: false, error: true, status: 400, code: 0,
          description: 'validation-error: task_ids array is required',
        });
        return;
      }

      let triggered = 0;
      let failed = 0;

      for (const id of task_ids) {
        try {
          const task = await crud.getTask(id);
          if (!task || !task.active) {
            failed++;
            continue;
          }

          const plannedAt = new Date().toISOString();
          const execution = await crud.createExecution(id, plannedAt);
          await trigger.fireTask(execution.id!);
          triggered++;
        } catch {
          failed++;
        }
      }

      res.json({
        success: true, error: false, status: 200, code: 0, description: 'ok',
        data: { triggered, failed },
      });
    } catch {
      res.status(500).json({
        success: false, error: true, status: 500, code: 0, description: 'internal-error',
      });
    }
  });
}
