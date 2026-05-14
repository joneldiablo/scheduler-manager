# Authentication Flow

## Resumen

El sistema usa **JWT (JSON Web Tokens)** para proteger todos los endpoints excepto `/login` y `/health`. Solo existe un usuario: el **superadmin** definido en variables de entorno.

## Variables de Entorno Requeridas

```
SUPERUSER_USER=admin
SUPERUSER_PASS=your-super-secret-password
JWT_SECRET=change-this-to-a-random-secret
JWT_EXPIRES_IN=24h
```

**Fatal Error:** Si `SUPERUSER_USER` o `SUPERUSER_PASS` están vacías, el backend falla y termina el proceso.

## Flujo de Login

```
Cliente                        Servidor
  │                               │
  │  POST /api/auth/login         │
  │  { username, password }       │
  │ ──────────────────────────>   │
  │                               │
  │    ┌──────────────────────┐   │
  │    │ Validar contra       │   │
  │    │ SUPERUSER_USER/PASS  │   │
  │    └──────────────────────┘   │
  │                               │
  │    Si inválido: 401           │
  │    { description: 'invalid-   │
  │      credentials' }           │
  │                               │
  │    Si válido:                 │
  │    ┌──────────────────────┐   │
  │    │ Firmar JWT con        │   │
  │    │ { username, role,     │   │
  │    │   iat, exp }          │   │
  │    └──────────────────────┘   │
  │                               │
  │  200 { token, user }          │
  │ <──────────────────────────   │
```

## Protección de Rutas

### HTTP (Express Middleware)

```
Request → [Public Path Check] → [Auth Middleware] → [Route Handler]
                │                       │
                │ Si es /login          │ Extrae Bearer token
                │ o /health             │ Verifica JWT
                │ → next()              │ Si inválido → 401
                                        │ Si válido → req.auth = payload
                                        │ → next()
```

### WebSocket Handshake

```
Cliente                              Servidor
  │                                     │
  │ GET /api/ws?token=xxx              │
  │ ────────────────────────────────>   │
  │                                     │
  │   ┌───────────────────────────┐     │
  │   │ Extraer token de query    │     │
  │   │ Verificar JWT             │     │
  │   │ Si inválido → close(4001) │     │
  │   │ Si válido → auth = payload│     │
  │   └───────────────────────────┘     │
  │                                     │
  │ Connection established              │
  │ <────────────────────────────────   │
```

## Formato de Respuesta API

Todas las respuestas siguen este formato consistente:

```json
{
  "success": true,
  "error": false,
  "status": 200,
  "code": 0,
  "description": "ok",
  "data": { }
}
```

Errores:
```json
{
  "success": false,
  "error": true,
  "status": 401,
  "code": 1,
  "description": "unauthorized"
}
```

## Tokens en Frontend

1. Login exitoso → `saveSession(token, user)`:
   - Almacena en memoria Vue (this.token, this.user)
   - Persiste en localStorage como `alchemist-session`
2. Cada request API usa `Authorization: Bearer <token>` header
3. `apiFetch()` wrapper agrega el header automáticamente
4. On 401 → `clearSession()` + mostrar login modal
5. On app load → `loadSession()` restaura desde localStorage
6. WebSocket se conecta con `?token=<jwt>` en query param
