# Data Model

## Tabla: `tasks`

Almacena la definición de cada tarea programable.

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| id | INTEGER PK | NO | AUTOINCREMENT | Identificador único |
| name | TEXT | NO | - | Nombre único de la tarea (identificador) |
| label | TEXT | NO | - | Etiqueta visible en UI |
| description | TEXT | SI | '' | Descripción detallada |
| schedule_datetime | TEXT | SI | NULL | Fecha/hora programada (ISO 8601) |
| recursive_timestamp | INTEGER | SI | NULL | Intervalo en ms para tareas recursivas |
| expiration_datetime | TEXT | SI | NULL | Fecha de expiración (ISO 8601) |
| times_total | INTEGER | NO | 0 | Máximo de ejecuciones (0 = ilimitado) |
| times_called | INTEGER | NO | 0 | Contador de ejecuciones |
| last_ejecution_datetime | TEXT | SI | NULL | Última ejecución (ISO 8601) |
| script | TEXT | NO | - | URL (http...) o ruta local al script |
| active | INTEGER | NO | 1 | 0 = inactivo, 1 = activo |
| updated_at | TEXT | NO | datetime('now') | Última modificación |
| created_at | TEXT | NO | datetime('now') | Fecha de creación |

### Índices
- `idx_tasks_active` ON `tasks(active)`
- `idx_tasks_name` UNIQUE ON `tasks(name)`

### Reglas de Negocio

1. **Tarea programada (one-shot):** `schedule_datetime` tiene valor, `recursive_timestamp` es NULL
2. **Tarea recursiva:** `recursive_timestamp` > 0, puede tener o no `schedule_datetime`
3. **Tarea combinada:** `schedule_datetime` + `recursive_timestamp` > 0 → primera ejecución en `schedule_datetime`, luego cada `recursive_timestamp`ms
4. **Con expiración:** Si `expiration_datetime` se alcanza, no se programan más ejecuciones
5. **Con límite:** Si `times_total` > 0 y `times_called` >= `times_total`, no se programan más
6. **Inactiva:** Si `active` = 0, el planificador ignora la tarea

## Tabla: `execution_buffer`

Buffer de ejecuciones planificadas, poblado cada 5 minutos por Gear A.

| Columna | Tipo | Nulable | Default | Descripción |
|---------|------|---------|---------|-------------|
| id | INTEGER PK | NO | AUTOINCREMENT | Identificador único |
| task_id | INTEGER FK | NO | - | Referencia a tasks.id (CASCADE DELETE) |
| planned_at | TEXT | NO | - | Fecha/hora planificada (ISO 8601) |
| status | TEXT | NO | 'pending' | pending \| fired \| cancelled |
| created_at | TEXT | NO | datetime('now') | Fecha de creación |

### Índices
- `idx_buffer_status` ON `execution_buffer(status)`
- `idx_buffer_planned` ON `execution_buffer(planned_at)`
- `idx_buffer_task_status` ON `execution_buffer(task_id, status)`

### Reglas de Negocio

1. **pending:** Recién insertada por el planificador, esperando ejecución
2. **fired:** Ya fue ejecutada por Gear B
3. **cancelled:** La tarea fue desactivada/eliminada antes de ejecutarse
4. Al iniciar el servidor, todos los `pending` con `planned_at < now` se marcan `cancelled`
5. Gear A inserta en lotes cada 5 minutos
6. Gear B crea `setTimeout` para cada `pending`

## Relaciones

```
tasks 1 ──── * execution_buffer
  (task_id FK)
```

## Consideraciones de Diseño

- SQLite como motor: simple, embebido, sin servidor
- Fechas en formato ISO 8601 (TEXT) para compatibilidad
- `recursive_timestamp` en milisegundos para precisión
- `script` puede ser URL (webhook) o ruta local (shell)
- No hay relación con logs de ejecución — eso es responsabilidad del script ejecutado
