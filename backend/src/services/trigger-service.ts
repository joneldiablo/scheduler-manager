import { Knex } from 'knex';
import { exec } from 'child_process';
import { WsService } from './ws-service.js';
import { CrudService } from './crud-service.js';
import { TriggerResult, ExecutionBuffer, Task } from '../types.js';

export interface TriggerService {
  scheduleBuffer(): Promise<void>;
  fireTask(executionId: number): Promise<TriggerResult>;
  clearTimeouts(): void;
  resetAndReload(): Promise<void>;
}

export function createTriggerService(
  db: Knex,
  ws: WsService,
  crud: CrudService
): TriggerService {
  const activeTimeouts = new Map<number, NodeJS.Timeout>();

  const trigger: TriggerService = {
    async scheduleBuffer() {
      const now = new Date().toISOString();
      const entries: ExecutionBuffer[] = await db('execution_buffer')
        .where('status', 'pending')
        .where('planned_at', '>', now);

      for (const entry of entries) {
        const delay = new Date(entry.planned_at).getTime() - Date.now();
        if (delay <= 0) {
          trigger.fireTask(entry.id!).catch((err) => {
            console.error(`[Trigger] Error firing task ${entry.id}:`, err);
          });
        } else {
          const timeout = setTimeout(() => {
            trigger.fireTask(entry.id!).catch((err) => {
              console.error(`[Trigger] Error firing task ${entry.id}:`, err);
            });
            activeTimeouts.delete(entry.id!);
          }, delay);
          activeTimeouts.set(entry.id!, timeout);
        }
      }
    },

    async fireTask(executionId) {
      const now = new Date();
      const firedAt = now.toISOString();

      const execution = await db('execution_buffer').where('id', executionId).first() as ExecutionBuffer | undefined;
      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      const task = await db('tasks').where('id', execution.task_id).first() as Task | undefined;
      if (!task) {
        throw new Error(`Task ${execution.task_id} not found`);
      }

      if (!task.active) {
        await db('execution_buffer').where('id', executionId).update({ status: 'cancelled' });
        return { task_id: task.id!, execution_id: executionId, planned_at: execution.planned_at, fired_at: firedAt };
      }

      if (task.script.startsWith('http')) {
        fetch(task.script, { method: 'POST' }).catch((err) => {
          console.error(`[Trigger] HTTP POST failed [${task.name}]: ${task.script}`, err);
        });
      } else {
        exec(task.script, (err) => {
          if (err) {
            console.error(`[Trigger] Shell exec failed [${task.name}]: ${task.script}`, err);
          }
        });
      }

      await db('execution_buffer').where('id', executionId).update({ status: 'fired' });

      const newTimesCalled = task.times_called + 1;
      await db('tasks').where('id', task.id).update({
        times_called: newTimesCalled,
        last_ejecution_datetime: firedAt,
      });

      if (task.recursive_timestamp && task.recursive_timestamp > 0) {
        let shouldReplan = true;

        if (task.expiration_datetime && now >= new Date(task.expiration_datetime)) {
          shouldReplan = false;
        }
        if (task.times_total > 0 && newTimesCalled >= task.times_total) {
          shouldReplan = false;
        }

        if (shouldReplan) {
          const nextPlannedAt = new Date(now.getTime() + task.recursive_timestamp);
          const nextPlannedISO = nextPlannedAt.toISOString();
          const [newId] = await db('execution_buffer').insert({
            task_id: task.id,
            planned_at: nextPlannedISO,
            status: 'pending',
          });

          const delay = nextPlannedAt.getTime() - Date.now();
          if (delay > 0) {
            const timeout = setTimeout(() => {
              trigger.fireTask(newId).catch((err) => {
                console.error(`[Trigger] Error firing recursive task ${newId}:`, err);
              });
              activeTimeouts.delete(newId);
            }, delay);
            activeTimeouts.set(newId, timeout);
          } else {
            trigger.fireTask(newId).catch((err) => {
              console.error(`[Trigger] Error firing recursive task ${newId}:`, err);
            });
          }
        }
      }

      ws.broadcast({
        type: 'task_fired',
        payload: { executionId, taskId: task.id, plannedAt: execution.planned_at, firedAt },
        timestamp: firedAt,
      });

      return {
        task_id: task.id!,
        execution_id: executionId,
        planned_at: execution.planned_at,
        fired_at: firedAt,
      };
    },

    clearTimeouts() {
      for (const [id, timeout] of activeTimeouts) {
        clearTimeout(timeout);
      }
      activeTimeouts.clear();
    },

    async resetAndReload() {
      trigger.clearTimeouts();
      await trigger.scheduleBuffer();
    },
  };

  return trigger;
}
