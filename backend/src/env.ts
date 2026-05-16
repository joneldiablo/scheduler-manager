import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
// If we are in a subdirectory (like /backend), try to load .env from the parent directory
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

export interface AppConfig {
  HOST: string;
  PORT: number;
  API_PATH_PREFIX: string;
  SUPERUSER_USER: string;
  SUPERUSER_PASS: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  ENABLE_FRONTEND: boolean;
  DATA_ROOT: string;
  SQLITE_FILENAME: string;
  PLANNER_CRON: string;
  SEED_ON_BOOTSTRAP: boolean;
  ENV: string;
}

export function loadAppConfig(overrides?: Partial<AppConfig>): AppConfig {
  const config: AppConfig = {
    HOST: process.env.HOST || '0.0.0.0',
    PORT: parseInt(process.env.PORT || '3000', 10),
    API_PATH_PREFIX: process.env.API_PATH_PREFIX || '/api',
    SUPERUSER_USER: process.env.SUPERUSER_USER || '',
    SUPERUSER_PASS: process.env.SUPERUSER_PASS || '',
    JWT_SECRET: process.env.JWT_SECRET || 'default-secret',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    ENABLE_FRONTEND: process.env.ENABLE_FRONTEND !== 'false',
    DATA_ROOT: process.env.DATA_ROOT || './data',
    SQLITE_FILENAME: process.env.SQLITE_FILENAME || 'db.sqlite',
    PLANNER_CRON: process.env.PLANNER_CRON || '*/5 * * * *',
    SEED_ON_BOOTSTRAP: process.env.SEED_ON_BOOTSTRAP === 'true',
    ENV: process.env.ENV || 'development',
  };

  if (overrides) {
    Object.assign(config, overrides);
  }

  if (!config.SUPERUSER_USER || !config.SUPERUSER_PASS) {
    console.error('FATAL: SUPERUSER_USER and SUPERUSER_PASS environment variables are required.');
    process.exit(1);
  }

  return config;
}

export function ensureDataRoot(config: AppConfig): void {
  const dataDir = path.resolve(config.DATA_ROOT);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}
