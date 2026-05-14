import { Model } from 'objection';
import type { Knex } from 'knex';
import { ExecutionBuffer } from './ExecutionBuffer.js';

export class Task extends Model {
  static get tableName() { return 'tasks'; }

  id!: number;
  name!: string;
  label!: string;
  description!: string;
  schedule_datetime!: string | null;
  recursive_timestamp!: number | null;
  expiration_datetime!: string | null;
  times_total!: number;
  times_called!: number;
  last_ejecution_datetime!: string | null;
  script!: string;
  active!: boolean;
  updated_at!: string;
  created_at!: string;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['name', 'label', 'script'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string', minLength: 1, maxLength: 255 },
        label: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string', default: '' },
        schedule_datetime: { type: ['string', 'null'] },
        recursive_timestamp: { type: ['integer', 'null'] },
        expiration_datetime: { type: ['string', 'null'] },
        times_total: { type: 'integer', default: 0, minimum: 0 },
        times_called: { type: 'integer', default: 0, minimum: 0 },
        last_ejecution_datetime: { type: ['string', 'null'] },
        script: { type: 'string', minLength: 1 },
        active: { type: 'boolean', default: true },
      },
    };
  }

  static get relationMappings() {
    return {
      executionBuffer: {
        relation: Model.HasManyRelation,
        modelClass: ExecutionBuffer,
        join: { from: 'tasks.id', to: 'execution_buffer.task_id' },
      },
    };
  }

  $beforeInsert() {
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
    if (this.active === undefined || this.active === null) {
      this.active = true;
    }
    if (this.times_called === undefined || this.times_called === null) {
      this.times_called = 0;
    }
  }

  $beforeUpdate() {
    this.updated_at = new Date().toISOString();
  }
}

export function bindTaskModels(knex: Knex): void {
  Model.knex(knex);
}
