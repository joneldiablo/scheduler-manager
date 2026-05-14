import { Knex } from 'knex';
import cron from 'node-cron';
import { AppConfig } from '../env.js';
import { WsService } from './ws-service.js';
import { TriggerService } from './trigger-service.js';
import { PlannerResult, Task, ExecutionBuffer } from '../types.js';

export interface PlannerService {
  start(): void;
  stop(): void;
  executePlanningCycle(): Promise<PlannerResult>;
}

export function createPlannerService(
  db: Knex,
  ws: WsService,
  trigger: TriggerService,
  config: AppConfig
): PlannerService {
  let cronTask: cron.ScheduledTask | null = null;

  const planner: PlannerService = {
    start() {
      if (cronTask) return;
      cronTask = cron.schedule(config.PLANNER_CRON, () => {
        planner.executePlanningCycle().catch((err) => {
          console.error('[Planner] Planning cycle error:', err);
        });
      });
    },

    stop() {
      if (cronTask) {
        cronTask.stop();
        cronTask = null;
      }
    },

    async executePlanningCycle() {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 5 * 60 * 1000);
      const nowISO = now.toISOString();
      const windowEndISO = windowEnd.toISOString();

      const tasks: Task[] = await db('tasks').where('active', 1);
      const toInsert: Array<{ task_id: number; planned_at: string; status: string }> = [];

      for (const task of tasks) {
        if (task.expiration_datetime && new Date(task.expiration_datetime) <= now) continue;
        if (task.times_total > 0 && task.times_called >= task.times_total) continue;

        if (task.schedule_datetime) {
          const schedDate = new Date(task.schedule_datetime);
          if (schedDate >= now && schedDate <= windowEnd) {
            const existing = await db('execution_buffer')
              .where('task_id', task.id)
              .where('planned_at', task.schedule_datetime)
              .where('status', 'pending')
              .first();
            if (!existing) {
              toInsert.push({ task_id: task.id!, planned_at: task.schedule_datetime, status: 'pending' });
            }
          }
        }

        if (task.recursive_timestamp && task.recursive_timestamp > 0) {
          const lastEntry: ExecutionBuffer | undefined = await db('execution_buffer')
            .where('task_id', task.id)
            .whereIn('status', ['pending', 'fired'])
            .orderBy('planned_at', 'desc')
            .first();

          let baseDate: Date;
          if (lastEntry) {
            baseDate = new Date(new Date(lastEntry.planned_at).getTime() + task.recursive_timestamp);
          } else if (task.schedule_datetime) {
            baseDate = new Date(task.schedule_datetime);
          } else {
            baseDate = now;
          }

          if (baseDate >= now && baseDate <= windowEnd) {
            const plannedStr = baseDate.toISOString();
            const existing = await db('execution_buffer')
              .where('task_id', task.id)
              .where('planned_at', plannedStr)
              .where('status', 'pending')
              .first();
            if (!existing) {
              toInsert.push({ task_id: task.id!, planned_at: plannedStr, status: 'pending' });
            }
          }
        }
      }

      let inserted = 0;
      if (toInsert.length > 0) {
        const result = await db('execution_buffer').insert(toInsert);
        inserted = Array.isArray(result) ? result.length : 0;
        await trigger.scheduleBuffer();
      }

      ws.broadcast({
        type: 'buffer_updated',
        payload: { inserted, windowStart: nowISO, windowEnd: windowEndISO },
        timestamp: new Date().toISOString(),
      });

      return { inserted, window_start: nowISO, window_end: windowEndISO };
    },
  };

  return planner;
}
