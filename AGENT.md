# THE ALCHEMIST - AGNOSTIC TASK SCHEDULER ORCHESTRATOR

## Resumen de la Idea

Creamos un sistema **agnóstico de programación de tareas** en un monorepo TypeScript.  
Este sistema actúa **SOLO como un disparador (trigger)** — es el "despertador".  
No ejecuta la lógica de las tareas; solo **"despierta a la bestia"** vía Webhook o Shell Command.

### Stack Técnico

- **Backend:** Express.js, Knex.js, Objection.js, SQLite, **ws** (WebSockets), node-cron
- **Frontend:** SPA en un solo `index.html` usando CDNs (Vue 3, Bootstrap 5, Tabulator JS)
- **Arquitectura:** Monorepo (carpetas `/backend` y `/frontend` separadas)

### Modalidades de Tareas

1. **Programada (one-shot):** Se ejecuta una sola vez en una fecha/hora específica (`schedule_datetime`)
2. **Recursiva (intervalo):** Se ejecuta cada N milisegundos (`recursive_timestamp`)
3. **Combinada:** Una tarea programada que, después de ejecutarse, se replanifica con un intervalo
4. **Con expiración:** Fecha tope (`expiration_datetime`) o número máximo de ejecuciones (`times_total`)
5. **Activable/Desactivabre:** Las tareas pueden habilitarse o inhabilitarse en cualquier momento

### Motor de dos engranajes (Gear A + Gear B)

**Gear A (El Planificador):**
- Se ejecuta cada 5 minutos mediante `node-cron`
- Lee la tabla `tasks` y calcula qué ejecuciones deben ocurrir en los próximos 5 minutos
- Puebla la tabla `execution_buffer` con las ejecuciones planificadas
- Emite evento WebSocket `"buffer_updated"` a todos los clientes conectados

**Gear B (El Disparador):**
- Mantiene un mapa de `setTimeout` activos para cada item en el buffer
- Cuando expira un timeout, ejecuta el script/configuración de la tarea
- Actualiza `times_called` y `last_ejecution_datetime` en la tarea original
- Si la tarea es recursiva, replanifica calculando la próxima ejecución
- Emite evento WebSocket `"task_fired"` con los detalles de la ejecución

### Lo que NO hace este sistema

- No ejecuta la lógica de negocio de las tareas
- No maneja logs de ejecución (eso es responsabilidad del script/webhook)
- No decide si una tarea debe ejecutarse o no (solo dispara)
- **Su única responsabilidad es "despertar a la bestia"**

### Seguridad

- **Superusuario estricto:** `SUPERUSER_USER` y `SUPERUSER_PASS` en variables de entorno
- **Error fatal si faltan:** El backend debe lanzar un error fatal y terminar el proceso
- **JWT obligatorio:** Todas las rutas CRUD, endpoints de trigger y handshake WebSocket protegidos con JWT
- **Única ruta pública:** `POST /api/login`

### Base de Datos

**Tabla `tasks`:**
- `id` (autoincrement)
- `name` (único, identificador)
- `label` (para mostrar en UI)
- `description`
- `schedule_datetime` (para tareas programadas)
- `recursive_timestamp` (ms, para tareas recursivas)
- `expiration_datetime` (fecha tope opcional)
- `times_total` (máximo de ejecuciones, 0 = ilimitado)
- `times_called` (contador de ejecuciones)
- `last_ejecution_datetime`
- `script` (URL del webhook o ruta local del script)
- `active` (booleano)
- `updated_at`, `created_at`

**Tabla `execution_buffer`:**
- `id` (autoincrement)
- `task_id` (FK → tasks.id)
- `planned_at` (datetime de ejecución planificada)
- `status` (pending / fired / cancelled)
- `created_at`

### Frontend

- **Modal de login** si no hay sesión (JWT guardado en localStorage)
- **Tabla Tabulator** con todas las tareas (CRUD completo + trigger manual)
- **Vista de Dashboard** con estadísticas y próximas ejecuciones
- **Conexión WebSocket** para actualizaciones en tiempo real
- **Diseño responsive, mobile-first, fluid design** con Bootstrap 5
- **Sin build step** — archivos estáticos servidos directamente por Express

### WebSockets en Tiempo Real

Eventos que el backend emite a todos los clientes conectados:
1. `"task_fired"` — cuando una tarea es disparada
2. `"buffer_updated"` — cuando el buffer es repoblado (cada 5 min)
3. `"task_updated"` — cuando una tarea es creada/modificada/eliminada vía CRUD

### Filosofía de Construcción

- **SOLID:** Cada archivo tiene una responsabilidad única
- **Orientado a subagentes:** La estructura permite que múltiples agentes AI trabajen en paralelo (ej: 4 en frontend, 2 en backend)
- **Documentación como guía:** Cada función tiene su firma y descripción de lo que debe hacer
- **Sin compilación/transpilación en frontend:** JS nativo del navegador, ES modules
- **Patrón de referencia:** Proyecto `pase-lista` (misma estructura modular, Vue 3 + Bootstrap 5 + Tabulator)

## Prompt Original del Usuario

"Usando typescript, cómo podríamos crear un sistema para ejecutar tareas programadas o recursivas, tengo una idea de dos modalidades, tareas programadas a determinada hora y tareas recursivas con un tiempo definido entre cada actividad..."

## Estructura del Proyecto

```
scheduler-manager/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Re-exporta todos los módulos
│   │   ├── cli.ts                # CLI con yargs (serve, etc.)
│   │   ├── types.ts              # Interfaces y tipos compartidos
│   │   ├── app.ts                # Fábrica de Express app
│   │   ├── env.ts                # Cargador de variables de entorno
│   │   ├── database.ts           # Knex setup + auto-migración
│   │   ├── models/
│   │   │   ├── Task.ts
│   │   │   └── ExecutionBuffer.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── ws-auth.ts
│   │   ├── services/
│   │   │   ├── auth-service.ts
│   │   │   ├── crud-service.ts
│   │   │   ├── planner-service.ts
│   │   │   ├── trigger-service.ts
│   │   │   └── ws-service.ts
│   │   ├── routes/
│   │   │   ├── auth-routes.ts
│   │   │   ├── task-routes.ts
│   │   │   ├── trigger-routes.ts
│   │   │   └── health-routes.ts
│   │   └── __tests__/
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── assets/
│   │   ├── style.css
│   │   ├── script.js
│   │   ├── endpoint-config.js
│   │   ├── app-state.js
│   │   ├── app-computed.js
│   │   ├── app-methods-auth.js
│   │   ├── app-methods-ui.js
│   │   ├── app-methods-tasks.js
│   │   ├── app-methods-scheduler.js
│   │   ├── components/
│   │   │   └── app-button.js
│   │   ├── fragments/
│   │   │   ├── dashboard.html
│   │   │   ├── tasks.html
│   │   │   └── scheduler.html
│   │   └── mock/
│   ├── favicon.svg
│   └── manifest.webmanifest
├── .agents/
│   ├── project-structure.md
│   ├── data-model.md
│   ├── auth-flow.md
│   ├── backend-architecture.md
│   ├── frontend-architecture.md
│   └── websocket-events.md
├── .env.example
├── .gitignore
└── package.json
```
