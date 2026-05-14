# Mocks para pruebas unitarias

## Mock de Knex
- `__mocks__/knex.ts` - Mock de Knex query builder que retorna cadenas de llamadas con `jest.fn().mockReturnThis()`
- Todos los métodos de query builder retornan `this` para permitir encadenamiento
- `knex.schema.hasTable` mockeado
- `knex.destroy` mockeado

## Mock de jsonwebtoken
- `__mocks__/jsonwebtoken.ts` - Mock de JWT
- `sign()` retorna `'mock-jwt-token'`
- `verify()` retorna `{ username: 'admin', role: 'superadmin', iat: 123, exp: 456 }`

## Mock de ws
- `__mocks__/ws.ts` - Mock de WebSocket y WebSocketServer
- `WebSocket` class con métodos mockeados (send, close, ping, terminate)
- `WebSocketServer` class con clients Set y on/close

## Mock de node-cron
- `__mocks__/node-cron.ts` - Mock de node-cron
- `schedule()` retorna objeto con start/stop mockeados
