# Frontend Architecture

## Stack

| Componente | Tecnología | Carga |
|-----------|------------|-------|
| Framework | Vue 3 (Global build) | CDN |
| UI Kit | Bootstrap 5.3 | CDN |
| Icons | Bootstrap Icons | CDN |
| Tabla | Tabulator 5.5 | CDN |
| Runtime | JavaScript (ES Modules) | Nativo del navegador |

**Sin build step.** No webpack, no vite, no compilación. Todo se sirve como archivos estáticos.

## Patrón Arquitectónico

**Modular Vue SPA** con fragmentos HTML cargados dinámicamente.

### Estructura de Módulos

```
index.html (SPA Shell)
  │
  ├── <script src="endpoint-config.js">   → Global: window.EndpointConfig
  ├── <script src="app-state.js">          → Export: appState { data() }
  ├── <script src="app-computed.js">       → Export: appComputed { ... }
  ├── <script src="app-methods-auth.js">   → Export: appMethodsAuth
  ├── <script src="app-methods-ui.js">     → Export: appMethodsUI
  ├── <script src="app-methods-tasks.js">  → Export: appMethodsTasks
  ├── <script src="app-methods-scheduler.js"> → Export: appMethodsScheduler
  └── <script src="script.js">             → Entry point (console interceptor + Vue bootstrap)
       │
       ▼
   Vue.createApp({
     data: appState.data,
     computed: { ...appComputed },
     methods: { ...appMethodsAuth, ...appMethodsUI, ...appMethodsTasks, ...appMethodsScheduler },
     mounted() { ... }
   }).mount('#app')
```

### Fragment System

```
fragments/
├── dashboard.html    → Stats cards + próximas ejecuciones
├── tasks.html        → Tabulator table + modales CRUD
└── scheduler.html    → Timeline del buffer de ejecución
```

Cada fragmento:
1. Se carga con `fetch('fragments/{name}.html')` → raw HTML template
2. Se asigna a `fragmentTemplates[name]`
3. Se renderiza en `fragmentHtml[name]` via `v-html="activeFragment"`
4. Contiene directivas Vue (`v-model`, `@click`, `{{ }}`) que Vue procesa al insertarse

### Data Flow

```
WebSocket Events (task_fired, buffer_updated, task_updated)
       │
       ▼
┌──────────────────┐
│  auth.connectWS() │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  refreshAll()     │──→ loadTasks() → Tabulator update
│  (on WS event)    │──→ loadBuffer() → Timeline update
└──────────────────┘──→ loadStats() → Dashboard cards update
         │
         │   User Actions (click, form submit)
         ▼
┌──────────────────┐
│  apiFetch()       │──→ HTTP Request → Backend API
│  (wrapper)        │──→ On 401 → clearSession() + login modal
└──────────────────┘
```

## Componentes

### Vue App (data)

Ver `app-state.js` para la lista completa de propiedades reactivas.

### Métodos por Área

| Archivo | Responsabilidad |
|---------|----------------|
| `app-methods-auth.js` | login, logout, session, WebSocket connection |
| `app-methods-ui.js` | fragment loader, apiFetch, modals, navigation, toasts |
| `app-methods-tasks.js` | Tabulator init, CRUD operations, task form management |
| `app-methods-scheduler.js` | Buffer loading, stats, timeline rendering |

### Tabulator (tasks view)

Configuración:
- Columnas: id, name, label, active (tickCross), schedule_datetime, recursive_timestamp (formateado), times_called/times_total, script
- Edición inline via cellEdited → auto-save
- Row click → detail modal
- Context menu: Edit, Trigger, Delete
- Filtros: headerFilter por columna

## WebSocket Client

```
connectWebSocket():
  ws = new WebSocket(`ws://${host}/api/ws?token=${this.token}`)
  
  ws.onopen → this.wsConnected = true
  ws.onmessage:
    'task_fired' → showToast(), refresh tasks if visible
    'buffer_updated' → refresh stats, refresh timeline if visible
    'task_updated' → refresh tasks list
  ws.onclose → this.wsConnected = false, reconnect after 5s
  ws.onerror → console.error
```

## Convenciones

- Archivos JS: ES Modules (`export const ...`, `import {...} from ...`)
- Sin transpilación: usar `import` que el navegador entiende nativamente
- Endpoints: todos centralizados en `endpoint-config.js`
- Fetch wrapper: `apiFetch()` en `app-methods-ui.js` maneja auth headers y 401
- Estado: todo en el objeto data de Vue (no store externo)
- Persistencia: localStorage para sesión (token + user)
- Modales: Bootstrap JS API (`new bootstrap.Modal()`)
- Componentes reutilizables: en `components/` (ej: `app-button.js`)
