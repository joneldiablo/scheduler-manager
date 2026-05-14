# WebSocket Events

## Conexión

```
URL: ws://{host}:{port}/api/ws?token={jwt}
```

El token JWT se pasa como query param `token`. El servidor valida el token antes de aceptar la conexión. Si es inválido, cierra con código 4001.

## Eventos del Servidor → Cliente

### `task_fired`

Una tarea ha sido ejecutada por Gear B.

```json
{
  "type": "task_fired",
  "payload": {
    "execution_id": 123,
    "task_id": 1,
    "task_name": "daily-report",
    "planned_at": "2025-01-15T08:00:00.000Z",
    "fired_at": "2025-01-15T08:00:01.000Z",
    "script": "http://localhost:4000/reports/daily"
  },
  "timestamp": "2025-01-15T08:00:01.000Z"
}
```

**Frontend reaction:**
- Actualizar la tabla de tareas (times_called, last_ejecution_datetime)
- Si estamos en dashboard, actualizar stats y próximas ejecuciones
- Si estamos en timeline del scheduler, mover item de pending a fired
- Mostrar toast notification

### `buffer_updated`

El planificador (Gear A) ha repoblado el buffer.

```json
{
  "type": "buffer_updated",
  "payload": {
    "inserted": 5,
    "window_start": "2025-01-15T08:00:00.000Z",
    "window_end": "2025-01-15T08:05:00.000Z",
    "total_pending": 12
  },
  "timestamp": "2025-01-15T08:00:00.000Z"
}
```

**Frontend reaction:**
- Actualizar dashboard stats
- Si estamos en scheduler view, recargar timeline

### `task_updated`

Una tarea fue creada, modificada o eliminada vía CRUD.

```json
{
  "type": "task_updated",
  "payload": {
    "action": "create",
    "task": { "id": 5, "name": "new-task", ... }
  },
  "timestamp": "2025-01-15T08:00:00.000Z"
}
```

**Acciones:** `create`, `update`, `delete`

**Frontend reaction:**
- Recargar lista de tareas
- Si la tarea afectada está visible en otra vista, actualizar

### `connected` (confirmación)

Enviado inmediatamente después del handshake exitoso.

```json
{
  "type": "connected",
  "payload": {
    "username": "admin",
    "connections_count": 3
  },
  "timestamp": "2025-01-15T08:00:00.000Z"
}
```

## Heartbeat

El servidor envía ping cada 30 segundos. El cliente debe responder con pong. Si no responde en 10 segundos, el servidor cierra la conexión.

```
Servidor → Cliente: { "type": "ping" }
Cliente → Servidor: { "type": "pong" }
```

## Formato General

Todos los eventos siguen esta estructura:

```json
{
  "type": "string",        // Tipo de evento
  "payload": {},           // Datos del evento
  "timestamp": "ISO8601"   // Timestamp del servidor
}
```

## Implementación

### Backend (`ws-service.ts`)

- WebSocketServer integrado con HTTP server
- Autenticación en handshake vía query param `token`
- Tracking de clientes conectados (Set)
- broadcast(): itera todos los clientes y envía JSON.stringify
- Ping interval: 30s
- Pong timeout: 10s

### Frontend (`app-methods-auth.js`)

- Conexión después de login exitoso
- Reconexión automática con backoff de 5s
- Manejo de eventos: parse JSON y despachar a métodos correspondientes
- Indicador visual de conexión (wsConnected)
