import { jest } from '@jest/globals';

jest.mock('dotenv', () => ({ config: jest.fn() }));

import { loadAppConfig, ensureDataRoot } from '../src/env.js';
import type { AppConfig } from '../src/env.js';
import path from 'path';
import fs from 'fs';

const ORIG_EXIT = process.exit;
const ORIG_ENV = { ...process.env };

function mockEnv(vars: Record<string, string | undefined>): void {
  process.env = { ...ORIG_ENV, ...vars } as Record<string, string>;
}

describe('loadAppConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.exit = jest.fn(() => {
      throw new Error('process.exit called');
    }) as unknown as typeof process.exit;
  });

  afterEach(() => {
    process.exit = ORIG_EXIT;
  });

  afterAll(() => {
    process.env = ORIG_ENV;
  });

  it('returns defaults when only SUPERUSER_USER and SUPERUSER_PASS are set', () => {
    mockEnv({ SUPERUSER_USER: 'admin', SUPERUSER_PASS: 'secret' });
    delete process.env.HOST;
    delete process.env.PORT;
    delete process.env.API_PATH_PREFIX;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.ENABLE_FRONTEND;
    delete process.env.DATA_ROOT;
    delete process.env.SQLITE_FILENAME;
    delete process.env.PLANNER_CRON;
    delete process.env.SEED_ON_BOOTSTRAP;

    const config = loadAppConfig();

    expect(config.HOST).toBe('0.0.0.0');
    expect(config.PORT).toBe(3000);
    expect(config.API_PATH_PREFIX).toBe('/api');
    expect(config.SUPERUSER_USER).toBe('admin');
    expect(config.SUPERUSER_PASS).toBe('secret');
    expect(config.JWT_SECRET).toBe('default-secret');
    expect(config.JWT_EXPIRES_IN).toBe('24h');
    expect(config.ENABLE_FRONTEND).toBe(true);
    expect(config.DATA_ROOT).toBe('./data');
    expect(config.SQLITE_FILENAME).toBe('db.sqlite');
    expect(config.PLANNER_CRON).toBe('*/5 * * * *');
    expect(config.SEED_ON_BOOTSTRAP).toBe(false);
  });

  it('reads SUPERUSER_USER and SUPERUSER_PASS from process.env', () => {
    mockEnv({ SUPERUSER_USER: 'myadmin', SUPERUSER_PASS: 'mypassword' });
    const config = loadAppConfig();
    expect(config.SUPERUSER_USER).toBe('myadmin');
    expect(config.SUPERUSER_PASS).toBe('mypassword');
  });

  it('calls process.exit(1) when SUPERUSER_USER is empty', () => {
    mockEnv({ SUPERUSER_USER: '', SUPERUSER_PASS: 'mypass' });
    expect(() => loadAppConfig()).toThrow('process.exit called');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('calls process.exit(1) when SUPERUSER_PASS is empty', () => {
    mockEnv({ SUPERUSER_USER: 'myuser', SUPERUSER_PASS: '' });
    expect(() => loadAppConfig()).toThrow('process.exit called');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('calls process.exit(1) when both credentials are empty', () => {
    mockEnv({ SUPERUSER_USER: '', SUPERUSER_PASS: '' });
    expect(() => loadAppConfig()).toThrow('process.exit called');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('merges overrides correctly', () => {
    mockEnv({ SUPERUSER_USER: 'admin', SUPERUSER_PASS: 'pass' });
    const config = loadAppConfig({ HOST: '1.2.3.4', PORT: 9090, JWT_SECRET: 'custom-secret' });
    expect(config.HOST).toBe('1.2.3.4');
    expect(config.PORT).toBe(9090);
    expect(config.JWT_SECRET).toBe('custom-secret');
    expect(config.API_PATH_PREFIX).toBe('/api');
  });

  it('parses PORT as integer', () => {
    mockEnv({ PORT: '8080', SUPERUSER_USER: 'admin', SUPERUSER_PASS: 'pass' });
    const config = loadAppConfig();
    expect(config.PORT).toBe(8080);
  });

  it('handles PORT parse failure gracefully (NaN)', () => {
    mockEnv({ PORT: 'not-a-number', SUPERUSER_USER: 'admin', SUPERUSER_PASS: 'pass' });
    const config = loadAppConfig();
    expect(config.PORT).toBeNaN();
  });

  it('ENABLE_FRONTEND defaults to true', () => {
    mockEnv({ SUPERUSER_USER: 'admin', SUPERUSER_PASS: 'pass' });
    delete process.env.ENABLE_FRONTEND;
    const config = loadAppConfig();
    expect(config.ENABLE_FRONTEND).toBe(true);
  });

  it('ENABLE_FRONTEND is false when env var is "false"', () => {
    mockEnv({ ENABLE_FRONTEND: 'false', SUPERUSER_USER: 'admin', SUPERUSER_PASS: 'pass' });
    const config = loadAppConfig();
    expect(config.ENABLE_FRONTEND).toBe(false);
  });

  it('ENABLE_FRONTEND is true when env var is "true"', () => {
    mockEnv({ ENABLE_FRONTEND: 'true', SUPERUSER_USER: 'admin', SUPERUSER_PASS: 'pass' });
    const config = loadAppConfig();
    expect(config.ENABLE_FRONTEND).toBe(true);
  });

  it('SEED_ON_BOOTSTRAP defaults to false', () => {
    mockEnv({ SUPERUSER_USER: 'admin', SUPERUSER_PASS: 'pass' });
    delete process.env.SEED_ON_BOOTSTRAP;
    const config = loadAppConfig();
    expect(config.SEED_ON_BOOTSTRAP).toBe(false);
  });

  it('SEED_ON_BOOTSTRAP is true when env var is "true"', () => {
    mockEnv({ SEED_ON_BOOTSTRAP: 'true', SUPERUSER_USER: 'admin', SUPERUSER_PASS: 'pass' });
    const config = loadAppConfig();
    expect(config.SEED_ON_BOOTSTRAP).toBe(true);
  });

  it('reads all env vars from process.env', () => {
    mockEnv({
      HOST: '10.0.0.1',
      PORT: '5000',
      API_PATH_PREFIX: '/api/v2',
      SUPERUSER_USER: 'root',
      SUPERUSER_PASS: 's3cret',
      JWT_SECRET: 'my-jwt-secret',
      JWT_EXPIRES_IN: '48h',
      ENABLE_FRONTEND: 'false',
      DATA_ROOT: '/opt/data',
      SQLITE_FILENAME: 'scheduler.db',
      PLANNER_CRON: '0 * * * *',
      SEED_ON_BOOTSTRAP: 'true',
    });
    const config = loadAppConfig();
    expect(config.HOST).toBe('10.0.0.1');
    expect(config.PORT).toBe(5000);
    expect(config.API_PATH_PREFIX).toBe('/api/v2');
    expect(config.SUPERUSER_USER).toBe('root');
    expect(config.SUPERUSER_PASS).toBe('s3cret');
    expect(config.JWT_SECRET).toBe('my-jwt-secret');
    expect(config.JWT_EXPIRES_IN).toBe('48h');
    expect(config.ENABLE_FRONTEND).toBe(false);
    expect(config.DATA_ROOT).toBe('/opt/data');
    expect(config.SQLITE_FILENAME).toBe('scheduler.db');
    expect(config.PLANNER_CRON).toBe('0 * * * *');
    expect(config.SEED_ON_BOOTSTRAP).toBe(true);
  });

  it('overrides take precedence over env vars', () => {
    mockEnv({
      HOST: '10.0.0.1',
      PORT: '5000',
      SUPERUSER_USER: 'admin',
      SUPERUSER_PASS: 'pass',
    });
    const config = loadAppConfig({ HOST: 'OVERRIDDEN', PORT: 1234 });
    expect(config.HOST).toBe('OVERRIDDEN');
    expect(config.PORT).toBe(1234);
  });
});

describe('ensureDataRoot', () => {
  const testRoot = '/tmp/opencode-env-test';

  beforeEach(() => {
    jest.clearAllMocks();
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('creates directory when it does not exist', () => {
    const dirPath = path.join(testRoot, 'new-dir');
    expect(fs.existsSync(dirPath)).toBe(false);

    const config = { DATA_ROOT: dirPath } as AppConfig;
    ensureDataRoot(config);

    expect(fs.existsSync(dirPath)).toBe(true);
    expect(fs.statSync(dirPath).isDirectory()).toBe(true);
  });

  it('does nothing when directory already exists', () => {
    const dirPath = path.join(testRoot, 'existing-dir');
    fs.mkdirSync(dirPath, { recursive: true });
    expect(fs.existsSync(dirPath)).toBe(true);

    const config = { DATA_ROOT: dirPath } as AppConfig;
    ensureDataRoot(config);

    expect(fs.existsSync(dirPath)).toBe(true);
  });
});
