import { Model } from 'objection';
import { Task } from './Task.js';

export class ExecutionBuffer extends Model {
  static get tableName() { return 'execution_buffer'; }

  id!: number;
  task_id!: number;
  planned_at!: string;
  status!: 'pending' | 'fired' | 'cancelled';
  created_at!: string;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['task_id', 'planned_at'],
      properties: {
        id: { type: 'integer' },
        task_id: { type: 'integer' },
        planned_at: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'fired', 'cancelled'], default: 'pending' },
        created_at: { type: 'string' },
      },
    };
  }

  static get relationMappings() {
    return {
      task: {
        relation: Model.BelongsToOneRelation,
        modelClass: Task,
        join: { from: 'execution_buffer.task_id', to: 'tasks.id' },
      },
    };
  }

  $beforeInsert() {
    this.created_at = new Date().toISOString();
    if (!this.status) {
      this.status = 'pending';
    }
  }
}
