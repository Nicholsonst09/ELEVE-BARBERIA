# Arquitectura del proyecto

Guía general del repositorio: qué hay en cada carpeta, qué variables de entorno necesita el backend y qué servicios externos usa el sistema.

## Estructura de carpetas

```
ELEVE-BARBERIA/
├── BACKEND/            API REST (Node + Express), desplegada en Vercel
├── FRONTEND/
│   ├── Reservas/       Página pública de reservas (clientes)
│   └── Dashboard/      Sistema de gestión interno (admin y empleados)
└── DOCS/               Documentación (schema SQL, deploy, planes)
```

### BACKEND — API REST

API en Node.js + Express (ESM, archivos `.mjs`). Expone todo bajo `/api/v1` y es consumida por los dos frontends. En producción corre como serverless function en Vercel (`vercel.json` + `export default app` en `index.mjs`).

| Carpeta | Contenido |
|---|---|
| `config/` | Utilidades de fecha/hora y horarios del negocio (timezone, tolerancias) |
| `db/` | Cliente de Supabase (`supabaseClient.mjs`: admin con service role + cliente anon para Auth) |
| `integraciones/resend/` | Cliente de Resend para envío de emails |
| `middleware/` | Rate limiter |
| `modulos/` | Un módulo por dominio, cada uno con `rutas`, `controlador` y `modelo` |

Módulos de `BACKEND/modulos/`:

- **auth** — Login, sesión y usuarios del dashboard vía Supabase Auth. Incluye `POST /api/v1/auth/bootstrap-admin` para crear el primer administrador.
- **reservas** — Endpoints públicos (sin autenticación) que consume la página de reservas: servicios activos, empleados por servicio, disponibilidad.
- **turnos** — CRUD de turnos, grilla de disponibilidad, estados (reservado/completado/cancelado/anulado), pagos del turno y notificaciones por email (confirmación, recordatorios vía cron).
- **servicios / empleados / clientes** — ABMs de las entidades principales. Empleados incluye avatar (Storage) y comisión.
- **negocio** — Configuración del negocio en BD (`negocio_config`): horarios por día, días no laborables y datos públicos (nombre, logo, redes, contacto, ubicación). Nada de esto está hardcodeado en el código.
- **indicadores** — Métricas para la pantalla de finanzas del dashboard (turnos, comisiones sobre turnos completados, ocupación).

> El sistema no incluye módulo de caja/punto de venta ni catálogo de productos: el alcance del proyecto es gestión de turnos.

### FRONTEND/Reservas — página pública de reservas

Web estática (HTML/CSS/JS vanilla) donde el cliente final reserva su turno: elige servicio, profesional, fecha y horario según la disponibilidad real. No requiere login; consume solo los endpoints públicos del backend.

- `js/config.js` — URL base de la API (detecta localhost vs producción).
- `js/reserva.js` — Flujo completo de la reserva.
- `js/nav.js` — Navegación / datos públicos del negocio (redes, contacto, ubicación desde `negocio_config`).

### FRONTEND/Dashboard — sistema de gestión interno

Web estática (HTML/CSS/JS vanilla) para administradores y empleados, con login vía Supabase Auth (`login.html` → `index.html`). Cada archivo de `js/` corresponde a una sección o responsabilidad:

| Archivo | Sección / rol |
|---|---|
| `agenda.js` | Agenda del día: turnos por empleado, carga y cambio de estado |
| `finanzas.js` | Indicadores: turnos, comisiones, métricas |
| `clientes.js`, `empleados.js`, `servicios.js` | ABMs de las entidades |
| `usuarios.js` | Gestión de usuarios del dashboard (roles administrador/empleado) |
| `negocio.js` | Configuración del negocio: horarios, días no laborables, datos públicos |
| `auth.js`, `login.js` | Sesión y login |
| `api.js`, `config.js` | Cliente HTTP y URL base de la API |
| `estado.js`, `ui.js`, `main.js`, `utilidades.js` | Estado global, componentes de UI y helpers |

## Variables de entorno (BACKEND/.env)

En local se cargan con `dotenv` desde `BACKEND/.env`; en producción se configuran en Vercel.

### Supabase (obligatorias)

| Variable | Para qué sirve |
|---|---|
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Key de service role — la usa el backend para BD y Storage (bypassa RLS) |
| `SUPABASE_ANON_KEY` | Key anónima — la usa el cliente de Supabase Auth para login |
| `SUPABASE_AUTH_REDIRECT_TO` | URL a la que redirige el email de recuperación de contraseña |

### Storage (opcionales)

| Variable | Para qué sirve |
|---|---|
| `SUPABASE_IMAGES_BUCKET` | Nombre del bucket de imágenes (default: `imagenes`) |
| `SUPABASE_STORAGE_BUCKET` | Fallback alternativo del nombre del bucket |

### Emails con Resend

| Variable | Para qué sirve |
|---|---|
| `RESEND_API_KEY` | API key de Resend; sin ella los emails se omiten (no rompe) |
| `RESEND_FROM_EMAIL` | Remitente (default: `onboarding@resend.dev`; en producción usar dominio propio verificado) |
| `EMAIL_NOTIFICATIONS_ENABLED` | `true`/`false` — interruptor general de envío de emails |
| `ADMIN_NOTIFICATION_EMAIL` | Email del negocio que recibe copia de las notificaciones |
| `EMAIL_LOGO_URL` | Logo que se muestra en los emails |


### Otras

| Variable | Para qué sirve |
|---|---|
| `PORT` | Puerto del servidor en local (default: 3000) |
| `REMINDERS_CRON_TOKEN` | Token que autoriza al cron externo a disparar el endpoint de recordatorios de turnos |
| `VALIDAR_HORARIO_AL_COMPLETAR_TURNO` | `true`/`false` (default: `false`) — con `true`, un turno solo puede marcarse como completado dentro de su ventana horaria (no antes de su inicio ni pasadas 24 hs) |
| `LIMITE_EMPLEADOS` | Número entero (default: sin límite) — tope de empleados (activos + inactivos, sin contar los dados de baja) que se pueden crear; pensado para limitar el uso según el plan contratado por cada negocio |
| `PERMITIR_REGISTRO_TURNOS_ATRASADOS` | `true`/`false` (default: `false`) — con `true`, el panel de gestión (admin/empleado logueado) puede cargar un turno con fecha/hora de hasta 24 hs atrás, para no perder uno que no se llegó a registrar a tiempo. Solo aplica al panel: la web pública de reservas nunca admite fechas pasadas |
| `WHATSAPP_CONTACT_NUMBER` | Número de contacto que figura en los emails al cliente |
| `ADMIN_PANEL_URL` | Link al dashboard incluido en los emails al negocio |
| `RESERVAS_URL` | Link a la página de reservas incluido en los emails al cliente |

> Los frontends no usan variables de entorno: la URL de la API está en `FRONTEND/Reservas/js/config.js` y `FRONTEND/Dashboard/js/config.js`, que detectan localhost y en producción apuntan al deploy de Vercel. Al montar el sistema para un negocio nuevo hay que actualizar esa URL.

## Servicios externos

| Servicio | Rol en el sistema |
|---|---|
| **Supabase** | Base de datos Postgres (schema en [sql-supabase-negocio-nuevo.md](sql-supabase-negocio-nuevo.md)), **Auth** (login y reset de contraseña de los usuarios del dashboard) y **Storage** (bucket `imagenes`: avatares, logo, imagen de reservas) |
| **Resend** | Envío de emails transaccionales: confirmación de reserva, notificación al negocio y recordatorios de turno |
| **Vercel** | Hosting serverless del backend (y deploy de los frontends estáticos) |
| **Cron externo** | Job programado que llama al endpoint de recordatorios con `REMINDERS_CRON_TOKEN` (ej: cron-job.org o Vercel Cron) |

Para el paso a paso del deploy ver [DEPLOY.md](../DEPLOY.md).
