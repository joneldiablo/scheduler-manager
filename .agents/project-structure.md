# Project Structure

```
scheduler-manager/
├── AGENT.md                 # Idea principal y resumen del proyecto
├── README.md                # Instrucciones de uso
├── package.json             # Monorepo root (npm workspaces)
├── .env.example             # Template de variables de entorno
├── .gitignore
├── data/                    # Datos runtime (SQLite, etc.)
│   └── .gitkeep
│
├── .agents/                 # Documentación de arquitectura para subagentes
│   ├── project-structure.md
│   ├── data-model.md
│   ├── auth-flow.md
│   ├── backend-architecture.md
│   ├── frontend-architecture.md
│   └── websocket-events.md
│
├── backend/                 # TypeScript + Express + Knex + Objection
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.cjs
│   ├── __tests__/
│   │   └── .gitkeep
│   └── src/
│       ├── index.ts              # Re-exporta todos los módulos públicos
│       ├── cli.ts                # CLI: yargs (serve, demo-data)
│       ├── types.ts              # Interfaces compartidas (Task, ExecutionBuffer, etc.)
│       ├── env.ts                # Loader de variables de entorno
│       ├── database.ts           # Knex setup + migraciones automáticas
│       ├── app.ts                # Express app factory + DI wiring
│       ├── models/
│       │   ├── Task.ts           # Objection.js model - tabla tasks
│       │   └── ExecutionBuffer.ts # Objection.js model - tabla execution_buffer
│       ├── middleware/
│       │   ├── auth.ts           # JWT auth middleware para HTTP
│       │   └── ws-auth.ts        # JWT auth middleware para WebSocket handshake
│       ├── services/
│       │   ├── auth-service.ts   # Login, JWT sign/verify, blacklist
│       │   ├── crud-service.ts   # CRUD para tasks y execution_buffer
│       │   ├── planner-service.ts # Gear A: cron cada 5min, puebla buffer
│       │   ├── trigger-service.ts # Gear B: setTimeout, ejecuta scripts
│       │   └── ws-service.ts     # WebSocket server, broadcast, heartbeat
│       └── routes/
│           ├── auth-routes.ts    # POST /login (público), GET /me, POST /logout
│           ├── task-routes.ts    # CRUD /api/tasks
│           ├── trigger-routes.ts # POST /api/trigger/:id, /api/trigger/batch
│           └── health-routes.ts  # GET /api/health
│
└── frontend/                # SPA sin build step (Vue 3 + Bootstrap 5 + Tabulator)
    ├── index.html           # Shell SPA con modales y navbar
    ├── favicon.svg
    ├── manifest.webmanifest
    └── assets/
        ├── style.css                # Estilos personalizados
        ├── script.js                # Entry point, console interceptor, Vue bootstrap
        ├── endpoint-config.js       # Registro centralizado de endpoints API
        ├── app-state.js             # Estado reactivo de Vue (data)
        ├── app-computed.js          # Propiedades computadas de Vue
        ├── app-methods-auth.js      # Métodos de autenticación
        ├── app-methods-ui.js        # Métodos de UI (fragmentos, modales, apiFetch)
        ├── app-methods-tasks.js     # Métodos CRUD de tareas + Tabulator
        ├── app-methods-scheduler.js # Métodos del planificador (buffer, stats)
        ├── components/
        │   └── app-button.js        # Componente Vue reutilizable
        ├── fragments/
        │   ├── dashboard.html       # Dashboard con stats y próximas ejecuciones
        │   ├── tasks.html           # Tabla Tabulator con CRUD
        │   └── scheduler.html       # Timeline del planificador
        └── mock/                    # JSON mock para desarrollo offline
            ├── auth-login.json
            ├── auth-me.json
            ├── tasks-list.json
            └── tasks-schema.json
```

## Responsabilidades por Carpeta

| Carpeta | Responsabilidad |
|---------|----------------|
| `backend/src/models/` | Definiciones de modelos Objection.js con jsonSchema y relations |
| `backend/src/services/` | Lógica de negocio pura (servicios singleton) |
| `backend/src/middleware/` | Middleware Express/WS para auth y validación |
| `backend/src/routes/` | Definición de rutas Express, conectan servicios con HTTP |
| `frontend/assets/` | Módulos ES6 del frontend Vue 3 |
| `frontend/assets/fragments/` | Templates HTML cargados dinámicamente |
| `.agents/` | Documentación de arquitectura para subagentes |
