import { Router, Request, Response } from 'express';
import { AppConfig } from '../env.js';

const startTime = Date.now();

export function registerHealthRoutes(router: Router, config: AppConfig): void {
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      error: false,
      status: 200,
      code: 0,
      description: 'ok',
      data: {
        status: 'healthy',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
      },
    });
  });
}
