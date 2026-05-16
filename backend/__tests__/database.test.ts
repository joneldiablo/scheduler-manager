import { jest } from '@jest/globals';
import * as knexMockModule from './__mocks__/knex.js';

const { mockQueryBuilder, mockSchema, mockDbInstance, mockRaw } = knexMockModule;

jest.unstable_mockModule('knex', () => knexMockModule);

let getDatabase: any;
let runMigrations: any;
let seedDemoData: any;
let closeDatabase: any;

beforeAll(async () => {
  const mod = await import('../src/database.js');
  getDatabase = mod.getDatabase;
  runMigrations = mod.runMigrations;
  seedDemoData = mod.seedDemoData;
  closeDatabase = mod.closeDatabase;
});

import type { AppConfig } from '../src/env.js';

const BASE_CONFIG: AppConfig = {
  HOST: '0.0.0.0',
  PORT: 3000,
  API_PATH_PREFIX: '/api',
  SUPERUSER_USER: 'admin',
  SUPERUSER_PASS: 'secret',
  JWT_SECRET: 'default-secret',
  JWT_EXPIRES_IN: '24h',
  ENABLE_FRONTEND: false,
  DATA_ROOT: './data',
  SQLITE_FILENAME: 'db.sqlite',
  PLANNER_CRON: '*/5 * * * *',
  SEED_ON_BOOTSTRAP: false,
};

describe('getDatabase', () => {
  let config: AppConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = { ...BASE_CONFIG };
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('creates a knex instance and returns it', () => {
    const db = getDatabase(config);
    expect(db).toBeDefined();
    expect(mockDbInstance).toBeDefined();
  });

  it('returns same instance on second call (singleton)', () => {
    const db1 = getDatabase(config);
    const db2 = getDatabase(config);
    expect(db1).toBe(db2);
  });
});

describe('runMigrations', () => {
  let config: AppConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = { ...BASE_CONFIG };
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('creates tasks table when it does not exist', async () => {
    mockSchema.hasTable.mockResolvedValue(false);
    const db = getDatabase(config);
    await runMigrations(db);
    expect(mockSchema.hasTable).toHaveBeenCalledWith('tasks');
    expect(mockSchema.createTable).toHaveBeenCalledWith('tasks', expect.any(Function));
  });

  it('creates execution_buffer table with indexes when it does not exist', async () => {
    mockSchema.hasTable.mockResolvedValue(false);
    const db = getDatabase(config);
    await runMigrations(db);
    expect(mockSchema.hasTable).toHaveBeenCalledWith('execution_buffer');
    expect(mockSchema.createTable).toHaveBeenCalledWith('execution_buffer', expect.any(Function));
    expect(mockRaw).toHaveBeenCalledWith('CREATE INDEX IF NOT EXISTS idx_buffer_status ON execution_buffer(status)');
    expect(mockRaw).toHaveBeenCalledWith('CREATE INDEX IF NOT EXISTS idx_buffer_planned ON execution_buffer(planned_at)');
    expect(mockRaw).toHaveBeenCalledWith('CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(active)');
    expect(mockRaw).toHaveBeenCalledWith('CREATE INDEX IF NOT EXISTS idx_history_task ON execution_history(task_id)');
    expect(mockRaw).toHaveBeenCalledWith('CREATE INDEX IF NOT EXISTS idx_history_executed ON execution_history(executed_at)');
    expect(mockRaw).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM execution_buffer'));
    expect(mockRaw).toHaveBeenCalledWith('CREATE UNIQUE INDEX IF NOT EXISTS idx_buffer_unique ON execution_buffer(task_id, planned_at)');
    expect(mockRaw).toHaveBeenCalledTimes(8);
  });

  it('skips creating tables if they already exist', async () => {
    mockSchema.hasTable.mockResolvedValue(true);
    const db = getDatabase(config);
    await runMigrations(db);
    expect(mockSchema.hasTable).toHaveBeenCalledWith('tasks');
    expect(mockSchema.hasTable).toHaveBeenCalledWith('execution_buffer');
    expect(mockSchema.createTable).not.toHaveBeenCalled();
    expect(mockRaw).toHaveBeenCalledWith(expect.stringContaining('SELECT name FROM sqlite_master'));
    expect(mockRaw).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM execution_buffer'));
    expect(mockRaw).toHaveBeenCalledWith('CREATE UNIQUE INDEX IF NOT EXISTS idx_buffer_unique ON execution_buffer(task_id, planned_at)');
    expect(mockRaw).toHaveBeenCalledTimes(3);
  });

  it('creates only execution_buffer when tasks exists but buffer does not', async () => {
    mockSchema.hasTable
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const db = getDatabase(config);
    await runMigrations(db);
    expect(mockSchema.createTable).toHaveBeenCalledTimes(1);
    expect(mockSchema.createTable).toHaveBeenCalledWith('execution_buffer', expect.any(Function));
    expect(mockRaw).toHaveBeenCalledTimes(6);
  });

  it('passes correct column definitions to tasks table builder', async () => {
    mockSchema.hasTable.mockResolvedValue(false);
    const db = getDatabase(config);
    await runMigrations(db);

    const tasksCall = mockSchema.createTable.mock.calls.find(
      ([name]: [string]) => name === 'tasks'
    );
    expect(tasksCall).toBeDefined();

    const tableBuilder = {
      increments: jest.fn().mockReturnThis(),
      primary: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      notNullable: jest.fn().mockReturnThis(),
      unique: jest.fn().mockReturnThis(),
      defaultTo: jest.fn().mockReturnThis(),
      integer: jest.fn().mockReturnThis(),
    };

    const callback = tasksCall![1] as (t: typeof tableBuilder) => void;
    callback(tableBuilder);

    expect(tableBuilder.increments).toHaveBeenCalledWith('id');
    expect(tableBuilder.text).toHaveBeenCalledWith('name');
    expect(tableBuilder.text).toHaveBeenCalledWith('label');
    expect(tableBuilder.text).toHaveBeenCalledWith('description');
    expect(tableBuilder.text).toHaveBeenCalledWith('schedule_datetime');
    expect(tableBuilder.integer).toHaveBeenCalledWith('recursive_timestamp');
    expect(tableBuilder.text).toHaveBeenCalledWith('expiration_datetime');
    expect(tableBuilder.integer).toHaveBeenCalledWith('times_total');
    expect(tableBuilder.integer).toHaveBeenCalledWith('times_called');
    expect(tableBuilder.text).toHaveBeenCalledWith('last_ejecution_datetime');
    expect(tableBuilder.text).toHaveBeenCalledWith('script');
    expect(tableBuilder.integer).toHaveBeenCalledWith('active');
    expect(tableBuilder.text).toHaveBeenCalledWith('updated_at');
    expect(tableBuilder.text).toHaveBeenCalledWith('created_at');
  });

  it('passes correct column definitions to execution_buffer table builder', async () => {
    mockSchema.hasTable
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const db = getDatabase(config);
    await runMigrations(db);

    const bufferCall = mockSchema.createTable.mock.calls.find(
      ([name]: [string]) => name === 'execution_buffer'
    );
    expect(bufferCall).toBeDefined();

    const tableBuilder = {
      increments: jest.fn().mockReturnThis(),
      primary: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      notNullable: jest.fn().mockReturnThis(),
      defaultTo: jest.fn().mockReturnThis(),
      integer: jest.fn().mockReturnThis(),
      references: jest.fn().mockReturnThis(),
      inTable: jest.fn().mockReturnThis(),
      onDelete: jest.fn().mockReturnThis(),
    };

    const callback = bufferCall![1] as (t: typeof tableBuilder) => void;
    callback(tableBuilder);

    expect(tableBuilder.increments).toHaveBeenCalledWith('id');
    expect(tableBuilder.integer).toHaveBeenCalledWith('task_id');
    expect(tableBuilder.references).toHaveBeenCalledWith('id');
    expect(tableBuilder.inTable).toHaveBeenCalledWith('tasks');
    expect(tableBuilder.onDelete).toHaveBeenCalledWith('CASCADE');
    expect(tableBuilder.text).toHaveBeenCalledWith('planned_at');
    expect(tableBuilder.text).toHaveBeenCalledWith('status');
  });
});

describe('seedDemoData', () => {
  let config: AppConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = { ...BASE_CONFIG };
    mockQueryBuilder.first!.mockResolvedValue(undefined);
    mockQueryBuilder.insert!.mockResolvedValue([1, 2, 3, 4]);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('inserts 4 demo tasks when table is empty', async () => {
    const db = getDatabase(config);
    await seedDemoData(db);

    expect(mockQueryBuilder.count).toHaveBeenCalledWith({ count: '*' });
    expect(mockQueryBuilder.first).toHaveBeenCalled();
    expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);

    const data = mockQueryBuilder.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(data).toHaveLength(4);
    expect(data[0]).toMatchObject({ name: 'daily-report', script: 'http://localhost:4000/reports/daily' });
    expect(data[1]).toMatchObject({ name: 'cleanup-temp', script: '/usr/local/bin/cleanup-temp.sh' });
    expect(data[2]).toMatchObject({ name: 'ping-healthcheck', script: 'http://localhost:4000/health/ping' });
    expect(data[3]).toMatchObject({ name: 'backup-db', script: '/usr/local/bin/backup-db.sh' });
  });

  it('skips inserting when tasks already exist', async () => {
    mockQueryBuilder.first.mockResolvedValue({ count: 5 });
    const db = getDatabase(config);
    await seedDemoData(db);
    expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
  });

  it('inserts when count is "0" string because "0" is not > 0', async () => {
    mockQueryBuilder.first.mockResolvedValue({ count: '0' });
    const db = getDatabase(config);
    await seedDemoData(db);
    expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
  });

  it('inserts when count is 0 number because 0 is not > 0', async () => {
    mockQueryBuilder.first.mockResolvedValue({ count: 0 });
    const db = getDatabase(config);
    await seedDemoData(db);
    expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
  });

  it('skips when count is 0 and row is falsy (undefined)', async () => {
    mockQueryBuilder.first.mockResolvedValue({ count: 0 });
    const db = getDatabase(config);

    mockQueryBuilder.first.mockResolvedValue(undefined);
    const row = await db('tasks').count({ count: '*' }).first();
    expect(row).toBeUndefined();
  });

  it('creates unique task names in demo data', async () => {
    const db = getDatabase(config);
    await seedDemoData(db);

    const data = mockQueryBuilder.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
    const names = data.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all demo tasks have required fields', async () => {
    const db = getDatabase(config);
    await seedDemoData(db);

    const data = mockQueryBuilder.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
    for (const task of data) {
      expect(task.name).toBeDefined();
      expect(task.label).toBeDefined();
      expect(task.script).toBeDefined();
      expect(task.active).toBe(1);
      expect(task.times_total).toBe(0);
      expect(task.times_called).toBe(0);
    }
  });
});

describe('closeDatabase', () => {
  let config: AppConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = { ...BASE_CONFIG };
  });

  it('calls db.destroy() and resets singleton', async () => {
    getDatabase(config);
    expect(mockDbInstance.destroy).not.toHaveBeenCalled();

    await closeDatabase();

    expect(mockDbInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it('does nothing if db is null (never called getDatabase)', async () => {
    await closeDatabase();
    expect(mockDbInstance.destroy).not.toHaveBeenCalled();
  });
});
