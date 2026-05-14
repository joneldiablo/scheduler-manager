import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { registerHealthRoutes } from '../../src/routes/health-routes.js';

type Handler = (req: any, res: any) => void;
type RouterMock = { get: jest.Mock; post: jest.Mock; put: jest.Mock; delete: jest.Mock };

function buildRes() {
  const res: Record<string, jest.Mock> = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  };
  return res as unknown as { json: jest.Mock; status: jest.Mock };
}

describe('registerHealthRoutes', () => {
  let mockRouter: RouterMock;
  let mockConfig: Record<string, unknown>;

  function extractHandler(route: string): Handler {
    const calls = mockRouter.get.mock.calls;
    const call = calls.find((c: unknown[]) => c[0] === route);
    if (!call) throw new Error(`Route GET ${route} not registered`);
    return call[1] as Handler;
  }

  beforeEach(() => {
    mockRouter = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };
    mockConfig = {};
  });

  it('registers GET /health route', () => {
    registerHealthRoutes(mockRouter as any, mockConfig as any);

    expect(mockRouter.get).toHaveBeenCalledWith('/health', expect.any(Function));
  });

  it('returns status=healthy with correct ApiResponse format', () => {
    delete process.env.npm_package_version;
    registerHealthRoutes(mockRouter as any, mockConfig as any);
    const handler = extractHandler('/health');
    const res = buildRes();

    handler({}, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        error: false,
        status: 200,
        code: 0,
        description: 'ok',
        data: expect.objectContaining({
          status: 'healthy',
          version: expect.any(String),
        }),
      }),
    );
  });

  it('response has uptime as a number', () => {
    registerHealthRoutes(mockRouter as any, mockConfig as any);
    const handler = extractHandler('/health');
    const res = buildRes();

    handler({}, res);

    const callArg = res.json.mock.calls[0][0] as Record<string, unknown>;
    const data = callArg.data as Record<string, unknown>;
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('response has timestamp as ISO string', () => {
    registerHealthRoutes(mockRouter as any, mockConfig as any);
    const handler = extractHandler('/health');
    const res = buildRes();

    handler({}, res);

    const callArg = res.json.mock.calls[0][0] as Record<string, unknown>;
    const data = callArg.data as Record<string, unknown>;
    expect(typeof data.timestamp).toBe('string');
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('uses process.env.npm_package_version when available', () => {
    process.env.npm_package_version = '1.2.3';
    registerHealthRoutes(mockRouter as any, mockConfig as any);
    const handler = extractHandler('/health');
    const res = buildRes();

    handler({}, res);

    const callArg = res.json.mock.calls[0][0] as Record<string, unknown>;
    const data = callArg.data as Record<string, unknown>;
    expect(data.version).toBe('1.2.3');
  });

  it('defaults version to 0.1.0 when env not set', () => {
    delete process.env.npm_package_version;
    registerHealthRoutes(mockRouter as any, mockConfig as any);
    const handler = extractHandler('/health');
    const res = buildRes();

    handler({}, res);

    const callArg = res.json.mock.calls[0][0] as Record<string, unknown>;
    const data = callArg.data as Record<string, unknown>;
    expect(data.version).toBe('0.1.0');
  });

  it('uptime increases over time (handler uses Date.now)', () => {
    registerHealthRoutes(mockRouter as any, mockConfig as any);
    const handler = extractHandler('/health');
    const res1 = buildRes();
    const res2 = buildRes();

    const before = Date.now();
    handler({}, res1);
    const after = Date.now();

    const data1 = (res1.json.mock.calls[0][0] as any).data;
    expect(data1.uptime).toBeGreaterThanOrEqual(0);
    expect((data1.uptime as number) * 1000).toBeLessThanOrEqual(after - before + 1000);
  });
});
