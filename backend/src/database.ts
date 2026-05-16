import knex, { Knex } from 'knex';
import path from 'path';
import { AppConfig } from './env.js';

let db: Knex | null = null;

export function getDatabase(config: AppConfig): Knex {
  if (db) return db;

  const dbPath = path.resolve(config.DATA_ROOT, config.SQLITE_FILENAME);

  db = knex({
    client: 'sqlite3',
    connection: { filename: dbPath },
    useNullAsDefault: true,
  });

  return db;
}

export async function runMigrations(database: Knex): Promise<void> {
  const hasTasks = await database.schema.hasTable('tasks');
  if (!hasTasks) {
    await database.schema.createTable('tasks', (table) => {
      table.increments('id').primary();
      table.text('name').notNullable().unique();
      table.text('label').notNullable();
      table.text('description').defaultTo('');
      table.text('schedule_datetime');
      table.integer('recursive_timestamp');
      table.text('expiration_datetime');
      table.integer('times_total').defaultTo(0);
      table.integer('times_called').defaultTo(0);
      table.text('last_ejecution_datetime');
      table.text('script').notNullable();
      table.integer('active').notNullable().defaultTo(1);
      table.text('updated_at').defaultTo(database.fn.now());
      table.text('created_at').defaultTo(database.fn.now());
    });
  }

  const hasBuffer = await database.schema.hasTable('execution_buffer');
  if (!hasBuffer) {
    await database.schema.createTable('execution_buffer', (table) => {
      table.increments('id').primary();
      table.integer('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
      table.text('planned_at').notNullable();
      table.text('status').notNullable().defaultTo('pending');
      table.text('created_at').defaultTo(database.fn.now());
    });

    await database.raw('CREATE INDEX IF NOT EXISTS idx_buffer_status ON execution_buffer(status)');
    await database.raw('CREATE INDEX IF NOT EXISTS idx_buffer_planned ON execution_buffer(planned_at)');
    await database.raw('CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(active)');
  }

  const hasUniqueOnBuffer = await database.raw(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_buffer_unique'"
  );
  if (!hasUniqueOnBuffer || !hasUniqueOnBuffer.length) {
    await database.raw(`
      DELETE FROM execution_buffer WHERE id NOT IN (
        SELECT MIN(id) FROM execution_buffer GROUP BY task_id, substr(planned_at, 1, 19)
      )
    `);
    await database.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_buffer_unique ON execution_buffer(task_id, planned_at)');
  }

  const hasHistory = await database.schema.hasTable('execution_history');
  if (!hasHistory) {
    await database.schema.createTable('execution_history', (table) => {
      table.increments('id').primary();
      table.integer('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
      table.text('script').notNullable();
      table.text('executed_at').notNullable();
      table.integer('duration').notNullable().defaultTo(0);
      table.text('response').defaultTo('');
      table.text('created_at').defaultTo(database.fn.now());
    });

    await database.raw('CREATE INDEX IF NOT EXISTS idx_history_task ON execution_history(task_id)');
    await database.raw('CREATE INDEX IF NOT EXISTS idx_history_executed ON execution_history(executed_at)');
  }
}

export async function seedDemoData(database: Knex): Promise<void> {
  const row = await database('tasks').count({ count: '*' }).first();
  if (row && Number(row.count) > 0) return;

  await database('tasks').insert([
    {
      name: 'daily-report',
      label: 'Daily Report',
      description: 'Generates the daily report every 24 hours',
      schedule_datetime: null,
      recursive_timestamp: 86400000,
      expiration_datetime: null,
      times_total: 0,
      times_called: 0,
      last_ejecution_datetime: null,
      script: 'http://localhost:4000/reports/daily',
      active: 1,
    },
    {
      name: 'cleanup-temp',
      label: 'Cleanup Temp Files',
      description: 'Cleans temporary files, starts at 2025-12-31 then every hour',
      schedule_datetime: '2025-12-31 23:00:00',
      recursive_timestamp: 3600000,
      expiration_datetime: '2026-12-31 23:00:00',
      times_total: 0,
      times_called: 0,
      last_ejecution_datetime: null,
      script: '/usr/local/bin/cleanup-temp.sh',
      active: 1,
    },
    {
      name: 'ping-healthcheck',
      label: 'Ping Healthcheck',
      description: 'Pings the health endpoint every 5 minutes',
      schedule_datetime: null,
      recursive_timestamp: 300000,
      expiration_datetime: null,
      times_total: 0,
      times_called: 0,
      last_ejecution_datetime: null,
      script: 'http://localhost:4000/health/ping',
      active: 1,
    },
    {
      name: 'backup-db',
      label: 'Database Backup',
      description: 'Runs database backup daily at 03:00',
      schedule_datetime: null,
      recursive_timestamp: 86400000,
      expiration_datetime: null,
      times_total: 0,
      times_called: 0,
      last_ejecution_datetime: null,
      script: '/usr/local/bin/backup-db.sh',
      active: 1,
    },
  ]);
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}
