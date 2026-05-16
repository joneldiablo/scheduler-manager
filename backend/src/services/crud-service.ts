import { Knex } from 'knex';
import { Task, ExecutionBuffer, ExecutionHistory } from '../types.js';

export interface CrudService {
  listTasks(options?: { active?: boolean; page?: number; limit?: number; search?: string }): Promise<{ data: Task[]; total: number }>;
  getTask(id: number): Promise<Task | null>;
  createTask(data: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task>;
  updateTask(id: number, data: Partial<Task>): Promise<Task | null>;
  deleteTask(id: number): Promise<boolean>;
  getBufferForTask(taskId: number): Promise<ExecutionBuffer[]>;
  cancelPendingExecutions(taskId: number): Promise<number>;
  cancelBufferExecution(executionId: number): Promise<boolean>;
  createExecution(taskId: number, plannedAt: string): Promise<ExecutionBuffer>;
  createHistory(data: { task_id: number; script: string; executed_at: string; duration: number; response: string }): Promise<ExecutionHistory>;
  listHistory(options?: { task_id?: number; page?: number; limit?: number }): Promise<{ data: ExecutionHistory[]; total: number }>;
}

function mapTask(row: Record<string, unknown>): Task {
  return { ...row, active: row.active === 1 || row.active === true } as unknown as Task;
}

function mapBuffer(row: Record<string, unknown>): ExecutionBuffer {
  return row as unknown as ExecutionBuffer;
}

function mapHistory(row: Record<string, unknown>): ExecutionHistory {
  return row as unknown as ExecutionHistory;
}

export function createCrudService(db: Knex): CrudService {
  return {
    async listTasks(options) {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 50;

      let query = db('tasks').select('*');

      if (options?.active !== undefined) {
        query = query.where('active', options.active ? 1 : 0);
      }

      if (options?.search) {
        query = query.where(function () {
          this.where('name', 'like', `%${options.search!}%`)
            .orWhere('label', 'like', `%${options.search!}%`)
            .orWhere('description', 'like', `%${options.search!}%`);
        });
      }

      const countQuery = query.clone().clearSelect().count({ count: '*' }).first();
      const offset = (page - 1) * limit;
      const rows = await query.clone().orderBy('created_at', 'desc').limit(limit).offset(offset);
      const totalResult = await countQuery;

      return { data: rows.map(mapTask), total: totalResult ? Number(totalResult.count) : 0 };
    },

    async getTask(id) {
      const row = await db('tasks').select('*').where('id', id).first();
      return row ? mapTask(row) : null;
    },

    async createTask(data) {
      const now = new Date().toISOString();
      const [id] = await db('tasks').insert({
        name: data.name,
        label: data.label,
        description: data.description ?? '',
        schedule_datetime: data.schedule_datetime ?? null,
        recursive_timestamp: data.recursive_timestamp ?? null,
        expiration_datetime: data.expiration_datetime ?? null,
        times_total: data.times_total ?? 0,
        times_called: 0,
        last_ejecution_datetime: null,
        script: data.script,
        active: data.active !== undefined ? (data.active ? 1 : 0) : 1,
        created_at: now,
        updated_at: now,
      });
      return this.getTask(id) as Promise<Task>;
    },

    async updateTask(id, data) {
      const existing = await this.getTask(id);
      if (!existing) return null;

      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = { updated_at: now };

      const allowed: (keyof Task)[] = [
        'name', 'label', 'description', 'schedule_datetime',
        'recursive_timestamp', 'expiration_datetime', 'times_total',
        'script', 'active',
      ];

      for (const field of allowed) {
        const val = (data as Record<string, unknown>)[field];
        if (val !== undefined) {
          updateData[field] = field === 'active' ? (val ? 1 : 0) : val;
        }
      }

      if (Object.keys(updateData).length <= 1) return existing;

      await db('tasks').update(updateData).where('id', id);
      return this.getTask(id) as Promise<Task>;
    },

    async deleteTask(id) {
      const row = await db('tasks').select('id').where('id', id).first();
      if (!row) return false;
      await db('execution_buffer').delete().where('task_id', id);
      await db('tasks').delete().where('id', id);
      return true;
    },

    async getBufferForTask(taskId) {
      const rows = await db('execution_buffer')
        .select('*')
        .where('task_id', taskId)
        .orderBy('planned_at', 'asc');
      return rows.map(mapBuffer);
    },

    async cancelPendingExecutions(taskId) {
      const count = await db('execution_buffer')
        .update({ status: 'cancelled' })
        .where('task_id', taskId)
        .where('status', 'pending');
      return count;
    },

    async cancelBufferExecution(executionId) {
      const row = await db('execution_buffer')
        .select('*')
        .where('id', executionId)
        .where('status', 'pending')
        .first();
      if (!row) return false;
      await db('execution_buffer').where('id', executionId).update({ status: 'cancelled' });
      return true;
    },

    async createExecution(taskId, plannedAt) {
      const now = new Date().toISOString();
      const [id] = await db('execution_buffer').insert({
        task_id: taskId,
        planned_at: plannedAt,
        status: 'pending',
        created_at: now,
      });
      const row = await db('execution_buffer').select('*').where('id', id).first();
      return mapBuffer(row!);
    },

    async createHistory(data) {
      const now = new Date().toISOString();
      const [id] = await db('execution_history').insert({
        task_id: data.task_id,
        script: data.script,
        executed_at: data.executed_at,
        duration: data.duration,
        response: data.response ?? '',
        created_at: now,
      });
      const row = await db('execution_history').select('*').where('id', id).first();
      return mapHistory(row!);
    },

    async listHistory(options) {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 50;
      const offset = (page - 1) * limit;

      let query = db('execution_history')
        .select('execution_history.*', db.raw('COALESCE(tasks.label, tasks.name) as task_name'))
        .leftJoin('tasks', 'execution_history.task_id', 'tasks.id');

      if (options?.task_id !== undefined) {
        query = query.where('execution_history.task_id', options.task_id);
      }

      const countQuery = db('execution_history');
      const totalResult = await (options?.task_id
        ? countQuery.where('task_id', options.task_id).count({ count: '*' }).first()
        : countQuery.count({ count: '*' }).first());

      const rows = await query.orderBy('executed_at', 'desc').limit(limit).offset(offset);
      return { data: rows.map(mapHistory), total: totalResult ? Number(totalResult.count) : 0 };
    },
  };
}
