import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockWebSocketServer = jest.fn();
const mockWebSocket = { OPEN: 1 };

jest.unstable_mockModule('ws', () => ({
  WebSocketServer: mockWebSocketServer,
  WebSocket: mockWebSocket,
}));

jest.unstable_mockModule('url', () => ({
  default: { parse: jest.fn() },
  parse: jest.fn(),
}));

let createWsServer: any;

beforeAll(async () => {
  const mod = await import('../../src/services/ws-service.js');
  createWsServer = mod.createWsServer;
});

describe('WsService', () => {
  let mockAuth: { verifyToken: jest.Mock; login: jest.Mock; revokeToken: jest.Mock };
  let mockConfig: any;
  let mockServer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = {
      verifyToken: jest.fn().mockReturnValue({ username: 'admin', role: 'superadmin' }),
      login: jest.fn(),
      revokeToken: jest.fn(),
    };
    mockConfig = {};
    mockServer = {};

    mockWebSocketServer.prototype.on = jest.fn().mockReturnThis();
    mockWebSocketServer.prototype.close = jest.fn();
    mockWebSocketServer.mockImplementation(() => ({
      clients: new Set(),
      on: mockWebSocketServer.prototype.on,
      close: mockWebSocketServer.prototype.close,
    }));
  });

  describe('createWsServer', () => {
    it('creates WebSocketServer with the HTTP server', () => {
      const ws = createWsServer(mockServer, mockConfig, mockAuth);
      expect(ws).toHaveProperty('broadcast');
      expect(ws).toHaveProperty('getConnectionsCount');
      expect(ws).toHaveProperty('close');
    });

    it('registers connection handler on wss', () => {
      createWsServer(mockServer, mockConfig, mockAuth);
      expect(mockWebSocketServer.prototype.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('starts heartbeat interval', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      createWsServer(mockServer, mockConfig, mockAuth);
      expect(setIntervalSpy).toHaveBeenCalled();
      setIntervalSpy.mockRestore();
    });
  });

  describe('broadcast()', () => {
    it('can be called without errors', () => {
      const wsService = createWsServer(mockServer, mockConfig, mockAuth);
      expect(() => {
        wsService.broadcast({
          type: 'task_fired',
          payload: { executionId: 1 },
          timestamp: '2025-01-01T00:00:00Z',
        });
      }).not.toThrow();
    });
  });

  describe('getConnectionsCount()', () => {
    it('returns 0 when no clients', () => {
      const wsService = createWsServer(mockServer, mockConfig, mockAuth);
      expect(wsService.getConnectionsCount()).toBe(0);
    });
  });

  describe('close()', () => {
    it('closes the server and clears interval', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const wsService = createWsServer(mockServer, mockConfig, mockAuth);
      wsService.close();
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});
