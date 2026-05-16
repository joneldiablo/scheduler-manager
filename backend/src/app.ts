import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { AppConfig } from './env.js';
import { getDatabase, runMigrations, seedDemoData } from './database.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createWsServer, WsService } from './services/ws-service.js';
import { createPlannerService, PlannerService } from './services/planner-service.js';
import { createTriggerService, TriggerService } from './services/trigger-service.js';
import { createAuthService, AuthService } from './services/auth-service.js';
import { createCrudService, CrudService } from './services/crud-service.js';
import { registerAuthRoutes } from './routes/auth-routes.js';
import { registerTaskRoutes } from './routes/task-routes.js';
import { registerTriggerRoutes } from './routes/trigger-routes.js';
import { registerHealthRoutes } from './routes/health-routes.js';
import { bindTaskModels } from './models/Task.js';
import { ApiResponse } from './types.js';
import { AuthenticatedRequest } from './middleware/auth.js';
import type { Knex } from 'knex';

export interface AppContext {
  config: AppConfig;
  app: express.Application;
  server: http.Server;
  db: Knex;
  auth: AuthService;
  crud: CrudService;
  ws: WsService;
  planner: PlannerService;
  trigger: TriggerService;
}

export async function createApp(config: AppConfig): Promise<AppContext> {
  const db = getDatabase(config);
  await runMigrations(db);
  if (config.SEED_ON_BOOTSTRAP) {
    await seedDemoData(db);
  }

  bindTaskModels(db);

  const auth = createAuthService(config);
  const crud = createCrudService(db);
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  registerHealthRoutes(app, config);
  registerAuthRoutes(app, config, auth);

  if (config.ENABLE_FRONTEND) {
    const possiblePaths = [
      path.resolve(process.cwd(), '../frontend'),
      path.resolve(process.cwd(), '../../frontend'),
    ];
    let frontendDir = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        frontendDir = p;
        break;
      }
    }
    if (frontendDir) {
      app.use(express.static(frontendDir));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith(config.API_PATH_PREFIX)) return next();
        res.sendFile(path.join(frontendDir, 'index.html'));
      });
    }
  }

  const server = http.createServer(app);
  const ws = createWsServer(server, config, auth);
  const trigger = createTriggerService(db, ws, crud, config.ENV);
  const planner = createPlannerService(db, ws, trigger, config);

  const apiRouter = express.Router();
  apiRouter.use(createAuthMiddleware(config, auth));
  apiRouter.get('/me', (req, res) => {
    const authReq = req as AuthenticatedRequest;
    res.json({
      success: true, error: false, status: 200, code: 0, description: 'ok',
      data: { username: authReq.auth!.username, role: authReq.auth!.role },
    });
  });
  registerTaskRoutes(apiRouter, config, crud);
  registerTriggerRoutes(apiRouter, config, crud, trigger);
  app.use(config.API_PATH_PREFIX, apiRouter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[App] Unhandled error:', err);
    const response: ApiResponse = {
      success: false, error: true, status: 500, code: 0, description: 'internal-server-error',
    };
    res.status(500).json(response);
  });

  planner.start();

  return { config, app, server, db, auth, crud, ws, planner, trigger };
}
