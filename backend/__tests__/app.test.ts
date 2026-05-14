import { jest } from '@jest/globals';

const mockExpressApp = { use: jest.fn().mockReturnThis(), get: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis() };
const mockExpressRouter = { use: jest.fn().mockReturnThis(), get: jest.fn().mockReturnThis(), post: jest.fn().mockReturnThis() };
const mockJsonFn = jest.fn();
const mockUrlencodedFn = jest.fn();
const mockStaticFn = jest.fn();
const mockExpressFn = Object.assign(
  () => mockExpressApp,
  { Router: () => mockExpressRouter, json: () => mockJsonFn, urlencoded: () => mockUrlencodedFn, static: () => mockStaticFn }
);

const mockHttpCreateServer = jest.fn((_app: unknown) => ({ address: () => null }));
const mockCreateAuthMiddleware = jest.fn(() => jest.fn());
const mockCreateWsServer = jest.fn(() => ({
  broadcast: jest.fn(), getConnectionsCount: jest.fn(() => 0), close: jest.fn(),
}));
const mockCreatePlannerService = jest.fn(() => ({
  start: jest.fn(), stop: jest.fn(), executePlanningCycle: jest.fn(),
}));
const mockCreateTriggerService = jest.fn(() => ({
  scheduleBuffer: jest.fn(), fireTask: jest.fn(), clearTimeouts: jest.fn(), resetAndReload: jest.fn(),
}));
const mockCreateAuthService = jest.fn(() => ({
  login: jest.fn(), verifyToken: jest.fn(), revokeToken: jest.fn(),
}));
const mockCreateCrudService = jest.fn(() => ({
  listTasks: jest.fn(), getTask: jest.fn(), createTask: jest.fn(),
  updateTask: jest.fn(), deleteTask: jest.fn(), getBufferForTask: jest.fn(),
  cancelPendingExecutions: jest.fn(), createExecution: jest.fn(),
}));
const mockRegisterAuthRoutes = jest.fn();
const mockRegisterTaskRoutes = jest.fn();
const mockRegisterTriggerRoutes = jest.fn();
const mockRegisterHealthRoutes = jest.fn();
const mockBindTaskModels = jest.fn();

const mockDb = {};
const mockGetDatabase = jest.fn(() => mockDb);
const mockRunMigrations = jest.fn();
const mockSeedDemoData = jest.fn();

jest.unstable_mockModule('express', () => ({ default: mockExpressFn }));
jest.unstable_mockModule('http', () => ({ default: { createServer: mockHttpCreateServer } }));
jest.unstable_mockModule('../src/database.js', () => ({
  getDatabase: mockGetDatabase,
  runMigrations: mockRunMigrations,
  seedDemoData: mockSeedDemoData,
}));
jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  createAuthMiddleware: mockCreateAuthMiddleware,
}));
jest.unstable_mockModule('../src/services/ws-service.js', () => ({
  createWsServer: mockCreateWsServer,
}));
jest.unstable_mockModule('../src/services/planner-service.js', () => ({
  createPlannerService: mockCreatePlannerService,
}));
jest.unstable_mockModule('../src/services/trigger-service.js', () => ({
  createTriggerService: mockCreateTriggerService,
}));
jest.unstable_mockModule('../src/services/auth-service.js', () => ({
  createAuthService: mockCreateAuthService,
}));
jest.unstable_mockModule('../src/services/crud-service.js', () => ({
  createCrudService: mockCreateCrudService,
}));
jest.unstable_mockModule('../src/routes/auth-routes.js', () => ({
  registerAuthRoutes: mockRegisterAuthRoutes,
}));
jest.unstable_mockModule('../src/routes/task-routes.js', () => ({
  registerTaskRoutes: mockRegisterTaskRoutes,
}));
jest.unstable_mockModule('../src/routes/trigger-routes.js', () => ({
  registerTriggerRoutes: mockRegisterTriggerRoutes,
}));
jest.unstable_mockModule('../src/routes/health-routes.js', () => ({
  registerHealthRoutes: mockRegisterHealthRoutes,
}));
jest.unstable_mockModule('../src/models/Task.js', () => ({
  bindTaskModels: mockBindTaskModels,
}));

let createApp: (config: Record<string, unknown>) => Promise<Record<string, unknown>>;

const defaultConfig = {
  HOST: '0.0.0.0',
  PORT: 3000,
  API_PATH_PREFIX: '/api',
  SUPERUSER_USER: 'admin',
  SUPERUSER_PASS: 'secret',
  JWT_SECRET: 'test-secret',
  JWT_EXPIRES_IN: '1h',
  ENABLE_FRONTEND: false,
  DATA_ROOT: './data',
  SQLITE_FILENAME: 'db.sqlite',
  PLANNER_CRON: '* * * * *',
  SEED_ON_BOOTSTRAP: false,
};

beforeAll(async () => {
  const appModule = await import('../src/app.js');
  createApp = appModule.createApp;
});

describe('createApp', () => {
  let config: typeof defaultConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = { ...defaultConfig };
  });

  it('initializes database and runs migrations', async () => {
    const ctx = await createApp(config);
    expect(mockGetDatabase).toHaveBeenCalledWith(config);
    expect(mockRunMigrations).toHaveBeenCalledWith(mockDb);
    expect(mockBindTaskModels).toHaveBeenCalledWith(mockDb);
  });

  it('calls seedDemoData when SEED_ON_BOOTSTRAP is true', async () => {
    config.SEED_ON_BOOTSTRAP = true;
    await createApp(config);
    expect(mockSeedDemoData).toHaveBeenCalled();
  });

  it('does not call seedDemoData when SEED_ON_BOOTSTRAP is false', async () => {
    config.SEED_ON_BOOTSTRAP = false;
    await createApp(config);
    expect(mockSeedDemoData).not.toHaveBeenCalled();
  });

  it('creates all services with correct dependencies', async () => {
    const ctx = await createApp(config);
    expect(mockCreateAuthService).toHaveBeenCalledWith(config);
    expect(mockCreateCrudService).toHaveBeenCalledWith(mockDb);
    expect(mockCreateWsServer).toHaveBeenCalled();
    expect(mockCreateTriggerService).toHaveBeenCalled();
    expect(mockCreatePlannerService).toHaveBeenCalled();
  });

  it('registers JSON and URL-encoded body parsers', async () => {
    await createApp(config);
    expect(mockExpressApp.use).toHaveBeenCalledWith(expect.any(Function));
  });

  it('registers health routes on the app', async () => {
    await createApp(config);
    expect(mockRegisterHealthRoutes).toHaveBeenCalled();
  });

  it('registers auth routes on the app', async () => {
    await createApp(config);
    expect(mockRegisterAuthRoutes).toHaveBeenCalled();
  });

  it('creates api router with authMiddleware and /me endpoint', async () => {
    await createApp(config);
    expect(mockCreateAuthMiddleware).toHaveBeenCalledWith(config, expect.any(Object));
  });

  it('registers task and trigger routes on apiRouter', async () => {
    await createApp(config);
    expect(mockRegisterTaskRoutes).toHaveBeenCalled();
    expect(mockRegisterTriggerRoutes).toHaveBeenCalled();
  });

  it('mounts apiRouter under API_PATH_PREFIX', async () => {
    await createApp(config);
    expect(mockExpressApp.use).toHaveBeenCalledWith(config.API_PATH_PREFIX, expect.any(Object));
  });

  it('registers error handler middleware with 4 parameters', async () => {
    await createApp(config);
    expect(mockExpressApp.use.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('error handler returns 500 internal-server-error', async () => {
    await createApp(config);
    const calls = mockExpressApp.use.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const lastCall = calls[calls.length - 1];
    const errorHandler = lastCall[0] as (err: Error, req: unknown, res: {
      status: jest.Mock; json: jest.Mock;
    }, next: jest.Mock) => void;

    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(new Error('test'), {}, mockRes, jest.fn());

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false, error: true, status: 500, code: 0, description: 'internal-server-error',
    });
  });

  it('calls planner.start()', async () => {
    await createApp(config);
    const plannerService = mockCreatePlannerService.mock.results[0].value;
    expect(plannerService.start).toHaveBeenCalled();
  });

  it('returns AppContext with all properties', async () => {
    const ctx = await createApp(config);
    expect(ctx).toHaveProperty('config');
    expect(ctx).toHaveProperty('app');
    expect(ctx).toHaveProperty('server');
    expect(ctx).toHaveProperty('db');
    expect(ctx).toHaveProperty('auth');
    expect(ctx).toHaveProperty('crud');
    expect(ctx).toHaveProperty('ws');
    expect(ctx).toHaveProperty('planner');
    expect(ctx).toHaveProperty('trigger');
  });

  it('auth middleware is created with config and auth service', async () => {
    await createApp(config);
    expect(mockCreateAuthMiddleware).toHaveBeenCalledWith(config, expect.any(Object));
  });
});
