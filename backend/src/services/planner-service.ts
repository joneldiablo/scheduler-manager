import { Knex } from 'knex';
import cron from 'node-cron';
import { AppConfig } from '../env.js';
import { WsService } from './ws-service.js';
import { TriggerService } from './trigger-service.js';
import { PlannerResult, Task } from '../types.js';

function toSec(date: Date): string {
  return date.toISOString().slice(0, 19) + 'Z';
}

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
  let cronHourly: cron.ScheduledTask | null = null;
  let cronSchedule: cron.ScheduledTask | null = null;

  const planner: PlannerService = {
    start() {
      if (cronHourly) return;

      // On startup: clear buffer and populate immediately
      (async () => {
        trigger.clearTimeouts();
        await db('execution_buffer').delete();
        await planner.executePlanningCycle();
      })();

      // Hourly: full buffer recalculation (heavy)
      cronHourly = cron.schedule('0 * * * *', () => {
        planner.executePlanningCycle().catch((err) => {
          console.error('[Planner] Hourly cycle error:', err);
        });
      });

      // Every 5 min: just set timeouts for pending entries (lightweight)
      cronSchedule = cron.schedule(config.PLANNER_CRON, () => {
        trigger.scheduleBuffer().catch((err) => {
          console.error('[Planner] Schedule error:', err);
        });
      });
    },

    stop() {
      if (cronHourly) { cronHourly.stop(); cronHourly = null; }
      if (cronSchedule) { cronSchedule.stop(); cronSchedule = null; }
    },

    async executePlanningCycle() {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);
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
            toInsert.push({ task_id: task.id!, planned_at: toSec(schedDate), status: 'pending' });
          }
        }

        if (task.recursive_timestamp && task.recursive_timestamp > 0) {
          const origin = task.schedule_datetime
            ? new Date(task.schedule_datetime)
            : new Date(task.updated_at || now);

          const interval = task.recursive_timestamp;
          let cursor = new Date(origin.getTime() + Math.ceil((now.getTime() - origin.getTime()) / interval) * interval);

          while (cursor >= now && cursor <= windowEnd) {
            toInsert.push({ task_id: task.id!, planned_at: toSec(cursor), status: 'pending' });
            cursor = new Date(cursor.getTime() + interval);
          }
        }
      }

      let inserted = 0;
      if (toInsert.length > 0) {
        const placeholders = toInsert.map(() => '(?, ?, ?)').join(', ');
        const values = toInsert.flatMap(r => [r.task_id, r.planned_at, r.status]);
        const result = await db.raw(
          `INSERT OR IGNORE INTO execution_buffer (task_id, planned_at, status) VALUES ${placeholders}`,
          values
        );
        inserted = typeof result.changes === 'number' ? result.changes : toInsert.length;
        await trigger.scheduleBuffer();
      }

      const cleaned = await db('execution_buffer').whereIn('status', ['fired', 'cancelled']).delete();
      await db('execution_buffer').where('status', 'pending').where('planned_at', '<', toSec(now)).delete();

      ws.broadcast({
        type: 'buffer_updated',
        payload: { inserted, cleaned, windowStart: nowISO, windowEnd: windowEndISO },
        timestamp: new Date().toISOString(),
      });

      return { inserted, window_start: nowISO, window_end: windowEndISO };
    },
  };

  return planner;
}
