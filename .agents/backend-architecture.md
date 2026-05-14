# Backend Architecture

## Stack

| Componente | Tecnología |
|-----------|------------|
| Runtime | Node.js 20+ |
| Lenguaje | TypeScript (ES2022, NodeNext) |
| Framework | Express.js 4 |
| ORM | Objection.js 3 |
| Query Builder | Knex.js 3 |
| DB | SQLite 3 |
| Auth | jsonwebtoken |
| Scheduler | node-cron (Gear A) |
| WebSocket | ws |
| CLI | yargs |
| Testing | Jest + supertest |

## Patrón Arquitectónico

**Service-Oriented Architecture** con inyección de dependencias manual (sin DI framework).

### Capas

```
┌──────────────────────────────────────────────┐
│                   CLI (cli.ts)                │
│           yargs commands + env merge          │
├──────────────────────────────────────────────┤
│              App Factory (app.ts)             │
│         Wire up: DB, Auth, Services, WS       │
├──────────────────────────────────────────────┤
│                  Routes                       │
│   auth-routes.ts                             │
│   task-routes.ts       Express Router         │
│   trigger-routes.ts    + Auth Middleware      │
│   health-routes.ts                           │
├──────────────────────────────────────────────┤
│               Services                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Auth    │ │  CRUD    │ │  Planner (A)  │  │
│  │ Service  │ │ Service  │ │  cron 5min    │  │
│  └──────────┘ └──────────┘ └──────┬───────┘  │
│  ┌──────────┐ ┌──────────┐        │          │
│  │ Trigger  │ │    WS    │◄───────┘          │
│  │ (B)      │ │ Service  │  broadcast events │
│  └────┬─────┘ └──────────┘                   │
│       │                                       │
│       ▼                                       │
│  Ejecuta script/webhook                       │
├──────────────────────────────────────────────┤
│              Middleware                       │
│   auth.ts (HTTP JWT)                         │
│   ws-auth.ts (WS JWT)                        │
├──────────────────────────────────────────────┤
│               Models                          │
│   Task.ts + ExecutionBuffer.ts               │
│   (Objection.js)                              │
├──────────────────────────────────────────────┤
│            Database Layer                     │
│   Knex + SQLite + Auto-migration              │
└──────────────────────────────────────────────┘
```

## Gear A - Planner Service

```
Cada 5 minutos (node-cron):
  1. Leer todas las tareas activas de la DB
  2. Para cada tarea:
     a. Calcular próxima ejecución en ventana [now, now+5min]
     b. Si es programada (schedule_datetime en ventana) → buffer
     c. Si es recursiva (recursive_timestamp) → calcular próxima
     d. Si es combinada → primera ejecución programada, luego recursiva
     e. Verificar expiración y límite de ejecuciones
  3. Batch insert en execution_buffer
  4. Llamar TriggerService.scheduleBuffer() para crear timeouts
  5. Broadcast 'buffer_updated' por WebSocket
```

## Gear B - Trigger Service

```
En cada ciclo de planificación + al iniciar:
  1. Leer execution_buffer WHERE status='pending'
  2. Para cada item:
     a. delay = planned_at - now
     b. Si delay <= 0 → ejecutar inmediatamente
     c. Si delay > 0 → setTimeout(delay)
  3. Al ejecutar (fireTask):
     a. Marcar buffer como 'fired'
     b. Incrementar times_called en tasks
     c. Actualizar last_ejecution_datetime
     d. Ejecutar script (HTTP POST o child_process.exec)
     e. Si es recursiva → calcular próxima y agregar al buffer
     f. Broadcast 'task_fired' por WebSocket
```

## Flujo de Inicio

```
npm run serve
  │
  ▼
CLI (yargs) → loadAppConfig() → ensureDataRoot()
  │
  ▼
createApp(config):
  │
  ├── Knex.connect() → SQLite
  ├── runMigrations() → crear tablas si no existen
  ├── seedDemoData() → si está vacío
  ├── createAuthService()
  ├── createCrudService()
  ├── createWsServer() → WebSocket en HTTP server
  ├── createTriggerService()
  ├── createPlannerService()
  ├── Registrar rutas Express
  ├── Iniciar Planner (Gear A) cron
  │
  ▼
server.listen(PORT, HOST)
```

## Estructura de Archivos

```
backend/
├── src/
│   ├── index.ts              # Barrel export (re-exporta todo)
│   ├── cli.ts                # Entry point CLI
│   ├── types.ts              # Interfaces compartidas
│   ├── env.ts                # Config loader (env + CLI merge)
│   ├── database.ts           # Knex + migrations + seed
│   ├── app.ts                # Express app factory + DI wiring
│   ├── models/
│   │   ├── Task.ts           # Objection model
│   │   └── ExecutionBuffer.ts # Objection model
│   ├── middleware/
│   │   ├── auth.ts           # HTTP JWT middleware
│   │   └── ws-auth.ts        # WS JWT middleware
│   ├── services/
│   │   ├── auth-service.ts   # JWT sign/verify/login
│   │   ├── crud-service.ts   # CRUD operations
│   │   ├── planner-service.ts # Gear A
│   │   ├── trigger-service.ts # Gear B
│   │   └── ws-service.ts     # WebSocket server
│   └── routes/
│       ├── auth-routes.ts
│       ├── task-routes.ts
│       ├── trigger-routes.ts
│       └── health-routes.ts
└── package.json
```

## Convenciones

- Cada archivo exporta UNA función/clase principal
- Servicios retornan interfaces (no clases concretas)
- Inyección de dependencias manual via función factory
- `app.ts` es el "compositor" que conecta todo
- `index.ts` re-exporta todo para uso como librería
- Nombres de archivos: kebab-case.ts
- Tests: Jest + supertest, en `__tests__/`
