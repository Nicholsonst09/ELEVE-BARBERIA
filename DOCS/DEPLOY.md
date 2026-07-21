# Deploy — Elevé Barbería

## Estado actual (en producción)

El sistema ya está deployado y en vivo en dos proyectos de Vercel independientes, dentro del mismo repositorio pero con carpeta raíz distinta cada uno:

| App | Carpeta raíz (Root Directory en Vercel) | Dominio |
|---|---|---|
| Backend (API) | `BACKEND/` | `https://eleve-barberia-xi.vercel.app` (ver variable `API_BASE_URL` en el frontend) |
| Frontend (Reservas + Dashboard) | `FRONTEND/` | `https://eleve-barberia-app.vercel.app` |

El frontend es un solo proyecto de Vercel con Root Directory `FRONTEND`, que sirve las dos apps como subcarpetas del mismo dominio:

- Reservas (público): `https://eleve-barberia-app.vercel.app/Reservas`
- Dashboard (backoffice): `https://eleve-barberia-app.vercel.app/Dashboard/login.html`

---

## Variables de entorno (Backend)

Vercel permite importar el `.env` directamente desde la configuración del proyecto. Variables usadas hoy (ver `BACKEND/.env`):

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto en Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key de Supabase (solo servidor) |
| `SUPABASE_ANON_KEY` | Key anónima, la usa el cliente de Supabase Auth para login |
| `SUPABASE_AUTH_REDIRECT_TO` | URL de redirect para el mail de recuperación de contraseña de Supabase Auth — debe ser `https://eleve-barberia-app.vercel.app/Dashboard/login.html` **y** estar agregada en Supabase → Authentication → URL Configuration → Redirect URLs |
| `RESEND_API_KEY` | API key de Resend para el envío de mails |
| `RESEND_FROM_EMAIL` | Remitente de los mails salientes |
| `ADMIN_NOTIFICATION_EMAIL` | Mail interno que recibe copia de reservas/cancelaciones |
| `EMAIL_NOTIFICATIONS_ENABLED` | `true`/`false` — apaga el envío de mails sin tocar código |
| `EMAIL_LOGO_URL` | URL del logo usado en el header de los mails (`.../Dashboard/img/logo-eleve-02.jpg`) |
| `ADMIN_PANEL_URL` | Link al dashboard incluido en los mails al negocio (`https://eleve-barberia-app.vercel.app/Dashboard`) |
| `RESERVAS_URL` | Link a la página de reservas incluido en los mails al cliente (`https://eleve-barberia-app.vercel.app/Reservas`) |
| `WHATSAPP_CONTACT_NUMBER` | Número usado en los links `wa.me` de los mails de turnos |
| `REMINDERS_CRON_TOKEN` | Token que autoriza al cron externo a disparar `GET /api/v1/turnos/notificaciones/recordatorios` (sin sesión de usuario) |
| `VALIDAR_HORARIO_AL_COMPLETAR_TURNO` | `true`/`false` — con `true`, un turno solo puede marcarse completado dentro de su ventana horaria |
| `PERMITIR_REGISTRO_TURNOS_ATRASADOS` | `true`/`false` — con `true`, el panel puede cargar turnos con fecha/hora de hasta 24 hs atrás |
| `LIMITE_EMPLEADOS` | Tope de empleados que se pueden crear, según el plan del negocio |
| `PORT` | Puerto local (no usado en Vercel, que asigna el propio) |

> Sin `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` el backend no puede conectarse a la base de datos. Lista completa y detalle de cada variable en [arquitectura-proyecto.md](arquitectura-proyecto.md#variables-de-entorno-backendenv).

---

## Configuración del frontend (API_BASE_URL)

**No existe un único archivo de configuración compartido.** Cada app tiene su propia constante `API_BASE_URL`, hay que actualizar ambas si cambia el backend:

- `FRONTEND/Dashboard/js/config.js`
- `FRONTEND/Reservas/js/config.js`

(Existió un `FRONTEND/Configuracion/config.js` pensado como fuente única, pero nunca se conectó — se eliminó por no estar en uso real.)

---

## CORS

El backend restringe CORS a una whitelist (`BACKEND/index.mjs`): el dominio del frontend de arriba (`https://eleve-barberia-app.vercel.app`, que cubre Reservas y Dashboard porque son subcarpetas del mismo origen) + cualquier `localhost`/`127.0.0.1` en cualquier puerto para desarrollo local. Si se agrega un dominio nuevo (ej. `www.`, staging), hay que sumarlo ahí.

---

## Rutas de Vercel (Frontend)

Al deployar el frontend en Vercel con Root Directory `FRONTEND`, los assets (CSS, JS, imágenes) se resolvían desde la raíz del dominio en vez de desde su subcarpeta. Se corrigió agregando `<base href="...">` en cada HTML:

- `Dashboard/index.html` → `<base href="/Dashboard/">`
- `Reservas/index.html` → `<base href="/Reservas/">`

---

## Pendientes conocidos

- **Recordatorios por cron**: activo. `GET /api/v1/turnos/notificaciones/recordatorios` no lleva sesión de usuario (lo llama un cron externo) y se autoriza con `REMINDERS_CRON_TOKEN` por query param, o con el header propio de Vercel Cron. Manda el recordatorio 2 hs antes del turno y usa la columna `turnos.recordatorio_enviado` para no duplicar envíos si el cron corre más de una vez. Falta configurar el Cron Job en Vercel (o en un servicio externo como cron-job.org) para que efectivamente lo llame.
- **Logs de auditoría**: la tabla `logs_auditoria` existe en el schema pero el backend no escribe en ella todavía.
- **Sin tests automatizados** y **sin rate limiting** en rutas públicas (`/api/v1/reservas`, `/api/v1/auth/recover`).
- **Caja y Productos**: fuera del alcance del proyecto, se eliminaron del código y del schema (ver `sql-supabase-negocio-nuevo.md`).
