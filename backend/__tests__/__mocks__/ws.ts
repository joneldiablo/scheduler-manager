import { jest } from '@jest/globals';

class MockWebSocket {
  readyState = 1;
  send = jest.fn();
  close = jest.fn();
  ping = jest.fn();
  terminate = jest.fn();
  on = jest.fn();
  addListener = jest.fn();
}

class MockWebSocketServer {
  clients = new Set<MockWebSocket>();
  on = jest.fn();
  close = jest.fn();
}

export { MockWebSocket as WebSocket, MockWebSocketServer as WebSocketServer };
