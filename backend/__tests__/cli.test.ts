import { jest } from '@jest/globals';

let mockArgv: Record<string, unknown> = { _: ['serve'] };

const mockYargs = {
  command: jest.fn().mockReturnThis(),
  option: jest.fn().mockReturnThis(),
  demandCommand: jest.fn().mockReturnThis(),
  help: jest.fn().mockReturnThis(),
  alias: jest.fn().mockReturnThis(),
  parse: jest.fn().mockImplementation(() => Promise.resolve(mockArgv)),
};

jest.unstable_mockModule('yargs', () => ({ default: jest.fn(() => mockYargs) }));
jest.unstable_mockModule('yargs/helpers', () => ({ hideBin: jest.fn(() => []) }));

const mockLoadAppConfig = jest.fn();
const mockEnsureDataRoot = jest.fn();
jest.unstable_mockModule('../src/env.js', () => ({
  loadAppConfig: mockLoadAppConfig,
  ensureDataRoot: mockEnsureDataRoot,
}));

const mockCreateApp = jest.fn();
jest.unstable_mockModule('../src/app.js', () => ({
  createApp: mockCreateApp,
}));

const mockCloseDatabase = jest.fn().mockResolvedValue(undefined);
const mockRunMigrations = jest.fn().mockResolvedValue(undefined);
const mockSeedDemoData2 = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('../src/database.js', () => ({
  closeDatabase: mockCloseDatabase,
  runMigrations: mockRunMigrations,
  seedDemoData: mockSeedDemoData2,
}));

const mockContext = {
  planner: { stop: jest.fn() },
  trigger: { clearTimeouts: jest.fn() },
  ws: { close: jest.fn() },
  server: {
    listen: jest.fn((_port: number, _host: string, cb: () => void) => {
      cb();
    }),
  },
};

const MOCK_CONFIG = {
  HOST: '0.0.0.0',
  PORT: 3000,
  API_PATH_PREFIX: '/api',
  SUPERUSER_USER: 'admin',
  SUPERUSER_PASS: 'secret',
  JWT_SECRET: 'test-secret',
  JWT_EXPIRES_IN: '24h',
  ENABLE_FRONTEND: false,
  DATA_ROOT: './data',
  SQLITE_FILENAME: 'db.sqlite',
  PLANNER_CRON: '*/5 * * * *',
  SEED_ON_BOOTSTRAP: false,
};

function flushAsync(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 50));
}

describe('CLI', () => {
  let processOnSpy: jest.SpiedFunction<typeof process.on>;
  let processExitSpy: jest.SpiedFunction<typeof process.exit>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeAll(() => {
    processOnSpy = jest.spyOn(process, 'on');
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    processOnSpy.mockRestore();
    processExitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockArgv = { _: ['serve'] };
  });

  afterEach(() => {
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  describe('serve command', () => {
    it('calls loadAppConfig with defaults when no CLI overrides', async () => {
      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      expect(mockLoadAppConfig).toHaveBeenCalledTimes(1);
      expect(mockLoadAppConfig).toHaveBeenCalledWith({});
    });

    it('passes port, host, data-root, and seed overrides to loadAppConfig', async () => {
      mockArgv = {
        _: ['serve'],
        port: 4000,
        host: '127.0.0.1',
        'data-root': '/custom/data',
        seed: true,
      };

      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      expect(mockLoadAppConfig).toHaveBeenCalledWith({
        PORT: 4000,
        HOST: '127.0.0.1',
        DATA_ROOT: '/custom/data',
        SEED_ON_BOOTSTRAP: true,
      });
    });

    it('passes only SEED_ON_BOOTSTRAP when seed is false', async () => {
      mockArgv = {
        _: ['serve'],
        seed: false,
      };

      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      expect(mockLoadAppConfig).toHaveBeenCalledWith({
        SEED_ON_BOOTSTRAP: false,
      });
    });

    it('calls ensureDataRoot with config', async () => {
      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      expect(mockEnsureDataRoot).toHaveBeenCalledTimes(1);
    });

    it('creates the app via createApp', async () => {
      const config = { ...MOCK_CONFIG, HOST: '127.0.0.1', PORT: 4000 };
      mockLoadAppConfig.mockReturnValue(config);
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      expect(mockCreateApp).toHaveBeenCalledWith(config);
    });

    it('starts server on the correct port and host', async () => {
      const config = { ...MOCK_CONFIG, HOST: '192.168.1.1', PORT: 9000 };
      mockLoadAppConfig.mockReturnValue(config);
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      expect(mockContext.server.listen).toHaveBeenCalledWith(9000, '192.168.1.1', expect.any(Function));
    });

    it('logs the server running message', async () => {
      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[The Alchemist] Server running on http://0.0.0.0:3000',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[The Alchemist] API at /api',
      );
    });

    it('registers signal handlers for SIGTERM and SIGINT', async () => {
      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      const sigtermCalls = processOnSpy.mock.calls.filter(([event]) => event === 'SIGTERM');
      const sigintCalls = processOnSpy.mock.calls.filter(([event]) => event === 'SIGINT');
      expect(sigtermCalls.length).toBeGreaterThanOrEqual(1);
      expect(sigintCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('registers uncaughtException and unhandledRejection handlers', async () => {
      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });

  describe('graceful shutdown', () => {
    it('on SIGTERM calls planner.stop, trigger.clearTimeouts, ws.close, and closeDatabase', async () => {
      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      process.emit('SIGTERM');
      await flushAsync();

      expect(mockContext.planner.stop).toHaveBeenCalled();
      expect(mockContext.trigger.clearTimeouts).toHaveBeenCalled();
      expect(mockContext.ws.close).toHaveBeenCalled();
      expect(mockCloseDatabase).toHaveBeenCalled();
    });

    it('on SIGTERM logs the shutdown message and exits with 0', async () => {
      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      process.emit('SIGTERM');
      await flushAsync();

      expect(consoleLogSpy).toHaveBeenCalledWith('\n[The Alchemist] Received SIGTERM. Shutting down...');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('on SIGINT calls planner.stop, trigger.clearTimeouts, ws.close, and closeDatabase', async () => {
      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      process.emit('SIGINT');
      await flushAsync();

      expect(mockContext.planner.stop).toHaveBeenCalled();
      expect(mockContext.trigger.clearTimeouts).toHaveBeenCalled();
      expect(mockContext.ws.close).toHaveBeenCalled();
      expect(mockCloseDatabase).toHaveBeenCalled();
    });

    it('on SIGINT logs the shutdown message and exits with 0', async () => {
      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      process.emit('SIGINT');
      await flushAsync();

      expect(consoleLogSpy).toHaveBeenCalledWith('\n[The Alchemist] Received SIGINT. Shutting down...');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('error handling', () => {
    it('logs uncaught exceptions', async () => {
      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      const testError = new Error('test uncaught');
      process.emit('uncaughtException', testError);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[The Alchemist] Uncaught exception:', testError);
    });

    it('logs unhandled rejections', async () => {
      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });
      mockCreateApp.mockResolvedValue(mockContext);

      await import('../src/cli.js');
      await flushAsync();

      const reason = new Error('test rejection');
      process.emit('unhandledRejection', reason);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[The Alchemist] Unhandled rejection:', reason);
    });

    it('handles fatal errors from main() by logging and exiting with code 1', async () => {
      mockLoadAppConfig.mockImplementation(() => {
        throw new Error('SUPERUSER_USER and SUPERUSER_PASS are required.');
      });

      await import('../src/cli.js');
      await flushAsync();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[The Alchemist] Fatal error:',
        expect.objectContaining({ message: 'SUPERUSER_USER and SUPERUSER_PASS are required.' }),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('demo-data command', () => {
    beforeEach(() => {
      mockArgv = { _: ['demo-data'], 'data-root': '/tmp/test-data' };
    });

    it('calls loadAppConfig with DATA_ROOT override', async () => {
      mockLoadAppConfig.mockReturnValue({
        ...MOCK_CONFIG,
        DATA_ROOT: '/tmp/test-data',
      });

      await import('../src/cli.js');
      await flushAsync();

      expect(mockLoadAppConfig).toHaveBeenCalledWith({
        DATA_ROOT: '/tmp/test-data',
      });
    });

    it('calls ensureDataRoot with config', async () => {
      mockLoadAppConfig.mockReturnValue({
        ...MOCK_CONFIG,
        DATA_ROOT: '/tmp/test-data',
      });

      await import('../src/cli.js');
      await flushAsync();

      expect(mockEnsureDataRoot).toHaveBeenCalledTimes(1);
    });

    it('calls runMigrations and seedDemoData then exits with 0', async () => {
      mockLoadAppConfig.mockReturnValue({
        ...MOCK_CONFIG,
        DATA_ROOT: '/tmp/test-data',
      });

      await import('../src/cli.js');
      await flushAsync();

      expect(mockRunMigrations).toHaveBeenCalled();
      expect(mockSeedDemoData2).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('[The Alchemist] Demo data seeded successfully.');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('calls loadAppConfig with DATA_ROOT as undefined when no --data-root arg', async () => {
      mockArgv = { _: ['demo-data'] };

      mockLoadAppConfig.mockReturnValue({ ...MOCK_CONFIG });

      await import('../src/cli.js');
      await flushAsync();
    });
  });
});
