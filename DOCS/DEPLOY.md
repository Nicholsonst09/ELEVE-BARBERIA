# Deploy — Elevé Barbería

## Estado actual (en producción)

El sistema ya está deployado y en vivo en dos partes independientes, dentro del mismo repositorio pero con carpeta raíz distinta cada una:

| App | Carpeta raíz | Dominio |
|---|---|---|
| Backend (API) | `BACKEND/` | (Vercel, ver variable `API_BASE_URL` en el frontend) |
| Reservas (público) | `FRONTEND/Reservas/` | `https://elevebarberia.surweb.com.ar` |
| Dashboard (backoffice) | `FRONTEND/Dashboard/` | `https://admin.elevebarberia.surweb.com.ar` |

---

## Variables de entorno (Backend)

Vercel permite importar el `.env` directamente desde la configuración del proyecto. Variables usadas hoy (ver `BACKEND/.env`):

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto en Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key de Supabase (solo servidor) |
| `RESEND_API_KEY` | API key de Resend para el envío de mails |
| `RESEND_FROM_EMAIL` | Remitente de los mails salientes |
| `ADMIN_NOTIFICATION_EMAIL` | Mail interno que recibe copia de reservas/cancelaciones |
| `EMAIL_NOTIFICATIONS_ENABLED` | `true`/`false` — apaga el envío de mails sin tocar código |
| `EMAIL_LOGO_URL` | (opcional) URL del logo usado en el header de los mails; si no se define usa el logo del Dashboard por default |
| `WHATSAPP_CONTACT_NUMBER` | Número usado en los links `wa.me` de los mails de turnos |
| `SUPABASE_AUTH_REDIRECT_TO` | URL de redirect para el mail de recuperación de contraseña de Supabase Auth |
| `REMINDERS_CRON_TOKEN` | Token para el endpoint de recordatorios por cron (actualmente desactivado, ver Pendientes) |
| `PUERTO` | Puerto local (no usado en Vercel, que asigna el propio) |

> Sin `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` el backend no puede conectarse a la base de datos.

---

## Configuración del frontend (API_BASE_URL)

**No existe un único archivo de configuración compartido.** Cada app tiene su propia constante `API_BASE_URL`, hay que actualizar ambas si cambia el backend:

- `FRONTEND/Dashboard/js/config.js`
- `FRONTEND/Reservas/js/config.js`

(Existió un `FRONTEND/Configuracion/config.js` pensado como fuente única, pero nunca se conectó — se eliminó por no estar en uso real.)

---

## CORS

El backend restringe CORS a una whitelist (`BACKEND/index.mjs`): los dos dominios de producción de arriba + cualquier `localhost`/`127.0.0.1` en cualquier puerto para desarrollo local. Si se agrega un dominio nuevo (ej. `www.`, staging), hay que sumarlo ahí.

---

## Rutas de Vercel (Frontend)

Al deployar el frontend en Vercel con Root Directory `FRONTEND`, los assets (CSS, JS, imágenes) se resolvían desde la raíz del dominio en vez de desde su subcarpeta. Se corrigió agregando `<base href="...">` en cada HTML:

- `Dashboard/index.html` → `<base href="/Dashboard/">`
- `Reservas/index.html` → `<base href="/Reservas/">`

---

## Pendientes conocidos

- **Recordatorios por cron**: el endpoint `GET /api/v1/turnos/notificaciones/recordatorios` está desactivado a propósito (`controlador.turno.mjs`, `procesarRecordatoriosTurnos`). La lógica ya existe pero está comentada — reactivar cuando se quiera mandar el recordatorio de "falta 1 hora" y configurar el Cron Job en Vercel.
- **KPIs del Dashboard (pestaña "Dashboard"/finanzas)**: hoy muestra datos de ejemplo hardcodeados (`FRONTEND/Dashboard/js/finanzas.js`), no hay endpoint de indicadores reales todavía. Ver `DOCS/plan-nuevas-funcionalidades.md`.
- **Logs de auditoría**: no implementado — no queda registro de quién hizo qué cambio en el sistema.
- **Sin tests automatizados** y **sin rate limiting** en rutas públicas (`/api/v1/reservas`, `/api/v1/auth/recover`).
