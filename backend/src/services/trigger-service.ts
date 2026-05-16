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

const HTTP_METHOD_RE = /^(GET|POST|PUT|PATCH|DELETE)\s+(https?:\/\/\S+)/;

function parseHttpScript(script: string): { method: string; url: string; headers?: Record<string, string>; body?: unknown } | null {
  const lines = script.trim().split('\n');
  const firstLine = lines[0].trim();
  const m = firstLine.match(HTTP_METHOD_RE);
  if (!m) return null;
  const method = m[1];
  const url = m[2];
  let headers: Record<string, string> | undefined;
  let body: unknown;
  if (lines.length > 1) {
    const rest = lines.slice(1).join('\n').trim();
    try {
      const parsed = JSON.parse(rest);
      if (parsed.headers && typeof parsed.headers === 'object') headers = parsed.headers;
      if (parsed.body !== undefined) body = parsed.body;
    } catch {
      // ignore invalid JSON
    }
  }
  return { method, url, headers, body };
}

export function createTriggerService(
  db: Knex,
  ws: WsService,
  crud: CrudService,
  env?: string
): TriggerService {
  const isProd = env === 'PROD';
  const activeTimeouts = new Map<number, NodeJS.Timeout>();

  const trigger: TriggerService = {
    async scheduleBuffer() {
      const now = new Date().toISOString();
      const entries: ExecutionBuffer[] = await db('execution_buffer')
        .where('status', 'pending')
        .where('planned_at', '>', now);

      for (const entry of entries) {
        if (activeTimeouts.has(entry.id!)) continue;
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

      let execResponse = '';
      const execStart = Date.now();

      const parsed = parseHttpScript(task.script);
      if (parsed) {
        const { method, url, headers, body } = parsed;
        const fetchOpts: RequestInit = { method, headers: headers as Record<string, string> | undefined };
        if (body !== undefined) fetchOpts.body = JSON.stringify(body);
        try {
          const response = await fetch(url, fetchOpts);
          const text = await response.text();
          execResponse = `${response.status} ${(text || '').slice(0, 1000)}`;
          if (!isProd) {
            console.log(`[Trigger] ${method} ${task.name} -> ${url}`);
            console.log(`[Trigger] Response ${response.status}: ${(text || '').slice(0, 500)}`);
          }
        } catch (err: any) {
          execResponse = `Error: ${err.message}`;
          console.error(`[Trigger] ${method} failed [${task.name}]: ${url}`, err);
        }
      } else if (task.script.startsWith('http')) {
        try {
          const response = await fetch(task.script, { method: 'POST' });
          const text = await response.text();
          execResponse = `${response.status} ${(text || '').slice(0, 1000)}`;
          if (!isProd) {
            console.log(`[Trigger] HTTP ${task.name} -> ${task.script}`);
            console.log(`[Trigger] Response ${response.status}: ${(text || '').slice(0, 500)}`);
          }
        } catch (err: any) {
          execResponse = `Error: ${err.message}`;
          console.error(`[Trigger] HTTP POST failed [${task.name}]: ${task.script}`, err);
        }
      } else {
        try {
          const result = await new Promise<{ err: Error | null; stdout: string; stderr: string }>((resolve) => {
            exec(task.script, (err, stdout, stderr) => resolve({ err, stdout, stderr }));
          });
          if (result.err) {
            execResponse = `Error: ${result.err.message}`;
            console.error(`[Trigger] Shell exec failed [${task.name}]: ${task.script}`, result.err);
          } else {
            execResponse = (result.stdout + result.stderr).trim().slice(0, 1000);
          }
          if (!isProd) {
            console.log(`[Trigger] EXEC ${task.name} -> ${task.script}`);
            if (result.stdout) console.log(`[Trigger] stdout: ${result.stdout.trim().slice(0, 500)}`);
            if (result.stderr) console.log(`[Trigger] stderr: ${result.stderr.trim().slice(0, 500)}`);
          }
        } catch (err: any) {
          execResponse = `Error: ${err.message}`;
          console.error(`[Trigger] Shell exec failed [${task.name}]: ${task.script}`, err);
        }
      }

      const execDuration = Date.now() - execStart;

      await db('execution_history').insert({
        task_id: task.id,
        script: task.script,
        executed_at: firedAt,
        duration: execDuration,
        response: execResponse.slice(0, 2000),
        created_at: new Date().toISOString(),
      });

      await db('execution_buffer').where('id', executionId).update({ status: 'fired' });

      const newTimesCalled = task.times_called + 1;
      await db('tasks').where('id', task.id).update({
        times_called: newTimesCalled,
        last_ejecution_datetime: firedAt,
      });

      // Recursive scheduling handled entirely by the planner (every 5 min cycle)

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
