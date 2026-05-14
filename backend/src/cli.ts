#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadAppConfig, ensureDataRoot, AppConfig } from './env.js';
import { createApp } from './app.js';
import { closeDatabase } from './database.js';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command('serve', 'Start the Express server', (y) => {
      y.option('port', { alias: 'p', type: 'number', description: 'Port to listen on' });
      y.option('host', { alias: 'H', type: 'string', description: 'Host to bind to' });
      y.option('data-root', { alias: 'd', type: 'string', description: 'Data directory' });
      y.option('seed', { type: 'boolean', description: 'Seed demo data' });
    })
    .command('demo-data', 'Seed demo data and exit', (y) => {
      y.option('data-root', { alias: 'd', type: 'string', description: 'Data directory' });
    })
    .demandCommand(1, 'Use "serve" or "demo-data"')
    .help()
    .alias('help', 'h')
    .parse();

  const cmd = argv._[0] as string;

  if (cmd === 'demo-data') {
    const config = loadAppConfig({ DATA_ROOT: (argv['data-root'] as string) || undefined });
    ensureDataRoot(config);
    const { default: knex } = await import('knex');
    const path = await import('path');
    const dbPath = path.resolve(config.DATA_ROOT, config.SQLITE_FILENAME);
    const db = knex.default({ client: 'sqlite3', connection: { filename: dbPath }, useNullAsDefault: true });
    const { runMigrations, seedDemoData } = await import('./database.js');
    await runMigrations(db);
    await seedDemoData(db);
    console.log('[The Alchemist] Demo data seeded successfully.');
    await db.destroy();
    process.exit(0);
  }

  if (cmd === 'serve') {
    const overrides: Partial<AppConfig> = {};
    if (argv['port']) overrides.PORT = argv['port'] as number;
    if (argv['host']) overrides.HOST = argv['host'] as string;
    if (argv['data-root']) overrides.DATA_ROOT = argv['data-root'] as string;
    if (argv['seed'] !== undefined) overrides.SEED_ON_BOOTSTRAP = argv['seed'] as boolean;

    const config = loadAppConfig(overrides);
    ensureDataRoot(config);

    const context = await createApp(config);

    const shutdown = async (signal: string) => {
      console.log(`\n[The Alchemist] Received ${signal}. Shutting down...`);
      context.planner.stop();
      context.trigger.clearTimeouts();
      context.ws.close();
      await closeDatabase();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
      console.error('[The Alchemist] Uncaught exception:', err);
    });
    process.on('unhandledRejection', (reason) => {
      console.error('[The Alchemist] Unhandled rejection:', reason);
    });

    context.server.listen(config.PORT, config.HOST, () => {
      console.log(`[The Alchemist] Server running on http://${config.HOST}:${config.PORT}`);
      console.log(`[The Alchemist] API at ${config.API_PATH_PREFIX}`);
    });
  }
}

main().catch((err) => {
  console.error('[The Alchemist] Fatal error:', err);
  process.exit(1);
});
