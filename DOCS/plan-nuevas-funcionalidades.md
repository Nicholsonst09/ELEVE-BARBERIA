# Planificación de Nuevas Funcionalidades - Elevé Barbería

Última revisión: 2026-07-09 (Fase 5 cerrada: endpoint de indicadores financieros real + eliminación de datos simulados)

## Objetivo original
Pasar de una base parcialmente mock/hardcodeada a un flujo real con Supabase, Resend y panel de gestión consistente, en 5 frentes.

## Estado por frente

### ✅ Fase 1 — Migraciones y modelo de datos — Completado
`negocio_config`, `caja_ventas`, `caja_ventas_items` y `empleados.comision_pct` existen y están en uso real (`BACKEND/modulos/negocio/modelo.negocio.mjs`, `BACKEND/modulos/caja/modelo.caja.mjs`).

### ✅ Fase 2 — Horarios de atención — Completado
El horario del negocio se lee de `negocio_config` (no hardcodeado). El alta/edición de horario de empleado valida contra el horario del negocio (`validarHorariosContraNegocio` en `BACKEND/modulos/turnos/controlador.turno.mjs`).

### ✅ Fase 3 — Caja integrada + historial de ventas — Completado
`BACKEND/modulos/caja/` tiene persistencia real (no localStorage): `POST /api/v1/caja/ventas`, `GET /api/v1/caja/ventas` con filtros, `PATCH /api/v1/caja/ventas/:id/anular`. El frontend (`FRONTEND/Dashboard/js/caja.js`) consume la API real.

### ✅ Fase 4 — Resend: email también al barbero — Completado
`destinatariosConfirmacion()` en `BACKEND/modulos/turnos/notificaciones.turno.mjs` ya incluye cliente + empleado + admin en confirmación y cancelación. También se agregó (fuera del plan original) el email de **reprogramación**.

### ✅ Fase 5 — Comisiones y KPIs reales en dashboard — Completado (2026-07-09)

- Campo `comision_pct` editable por empleado (`empleado-comision` en el modal de empleados).
- Endpoint real `GET /api/v1/indicadores/financieros?desde=&hasta=&empleado_id=` (`BACKEND/modulos/indicadores/`), protegido con `autenticarSesion` + `autorizarRoles('admin','administrador')`. Calcula bruto, comisión (por empleado, usando `comision_pct` sobre el subtotal de ítems tipo servicio) y neto agregando `caja_ventas` + `caja_ventas_items` en el servidor, en vez de traer hasta 5000 ventas al navegador como antes.
- `FRONTEND/Dashboard/js/api.js`: `fetchFinancialData()` ahora llama a `fetchIndicadoresFinancieros()` (período actual + previo, para el % de cambio) en vez de calcular todo client-side.
- `FRONTEND/Dashboard/js/finanzas.js`: se eliminó por completo `datosSimulados` (el dataset hardcodeado con empleados ficticios). Sin datos reales, la pestaña ahora muestra 0 / "Sin datos para este período" en vez de números inventados.
- Verificado: el endpoint responde 401 igual que el resto de rutas protegidas sin token válido, y la query corre sin errores contra el schema real de Supabase (mismos nombres de tabla/FK que usa `/caja/ventas`). No se probó el cálculo numérico con datos reales porque `caja_ventas` está vacía en el entorno usado y no se quiso insertar datos de prueba en la base de producción sin supervisión directa del usuario.

---

## Otro pendiente relevante (no estaba en las 5 fases, detectado en auditoría)

**Logs de auditoría**: no hay ningún registro de quién hizo qué cambio en el sistema (crear/modificar/eliminar turnos, usuarios, precios, etc.). Para un negocio real con más de un usuario con acceso, esto importa para poder reconstruir qué pasó ante un reclamo o error. No es bloqueante para probar el sistema, pero sí antes de darlo por "cerrado".

## Riesgos que siguen vigentes
- **Sin tests automatizados** en todo el proyecto.
- **Sin rate limiting** en rutas públicas (`/api/v1/reservas`, `/api/v1/auth/recover`).