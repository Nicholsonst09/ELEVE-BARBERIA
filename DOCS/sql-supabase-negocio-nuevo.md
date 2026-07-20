# SQL base para negocio nuevo (Supabase)

Este script crea la base completa para levantar el proyecto en un negocio nuevo, con:
- Estados de turno normalizados: reservado, completado, cancelado, anulado.
- Alcance acotado a gestión de turnos: no incluye caja/punto de venta ni catálogo de productos (fuera del alcance de la tesis).
- Autenticacion con Supabase Auth: los usuarios del dashboard se vinculan via `auth_user_id` (sin username ni tokens de reset propios).
- Configuracion del negocio gobernada desde BD (`negocio_config`): horarios por dia, dias no laborables y datos publicos (nombre, logo, redes, contacto, ubicacion). La politica de validacion al completar turnos es una variable de entorno del backend (`VALIDAR_HORARIO_AL_COMPLETAR_TURNO`).
- Turnos con `cliente_id` opcional: el admin puede cargar turnos sin cliente.
- Turnos con `recordatorio_enviado`: marca si ya se le mando el email de recordatorio (2hs antes) a ese turno, para que el cron de recordatorios no lo duplique si se corre mas de una vez.
- Bucket de Storage `imagenes` para avatares de empleados, logo del negocio e imagen de reservas.

## Script unico (pegar en SQL Editor)

```sql
BEGIN;

-- ============================================================================
-- 0) Funcion para columna modificado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_modificado_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.modificado = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1) Catalogos de estado
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.estado_turno (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo varchar(40) NOT NULL UNIQUE,
  nombre varchar(80) NOT NULL,
  descripcion varchar(255),
  permite_cambios boolean NOT NULL DEFAULT true,
  creado timestamptz NOT NULL DEFAULT now(),
  modificado timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estado_turno_codigo_permitido_chk
    CHECK (codigo IN ('reservado', 'completado', 'cancelado', 'anulado'))
);

CREATE TABLE IF NOT EXISTS public.estado_empleado (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo varchar(40) NOT NULL UNIQUE,
  nombre varchar(80) NOT NULL,
  descripcion varchar(255),
  creado timestamptz NOT NULL DEFAULT now(),
  modificado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estado_cliente (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo varchar(40) NOT NULL UNIQUE,
  nombre varchar(80) NOT NULL,
  descripcion varchar(255),
  creado timestamptz NOT NULL DEFAULT now(),
  modificado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estado_servicio (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo varchar(40) NOT NULL UNIQUE,
  nombre varchar(80) NOT NULL,
  descripcion varchar(255),
  creado timestamptz NOT NULL DEFAULT now(),
  modificado timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.estado_turno (codigo, nombre, descripcion, permite_cambios)
VALUES
  ('reservado', 'Reservado', 'Turno reservado y vigente', true),
  ('completado', 'Completado', 'Turno finalizado', false),
  ('cancelado', 'Cancelado', 'Turno cancelado', false),
  ('anulado', 'Anulado', 'Turno anulado administrativamente', false)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.estado_empleado (codigo, nombre, descripcion)
VALUES
  ('activo', 'Activo', 'Empleado activo'),
  ('inactivo', 'Inactivo', 'Empleado inactivo'),
  ('anulado', 'Anulado', 'Empleado dado de baja')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.estado_cliente (codigo, nombre, descripcion)
VALUES
  ('activo', 'Activo', 'Cliente activo'),
  ('inactivo', 'Inactivo', 'Cliente inactivo'),
  ('anulado', 'Anulado', 'Cliente dado de baja')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.estado_servicio (codigo, nombre, descripcion)
VALUES
  ('activo', 'Activo', 'Servicio activo'),
  ('inactivo', 'Inactivo', 'Servicio inactivo'),
  ('anulado', 'Anulado', 'Servicio dado de baja')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================================
-- 2) Configuracion de negocio
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.negocio_config (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timezone varchar(64) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  horarios_por_dia jsonb NOT NULL DEFAULT '{}'::jsonb,
  dias_no_laborables jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Datos publicos del negocio (Reservas y Dashboard)
  nombre varchar(180) NOT NULL DEFAULT 'ELEVÉ Barbería',
  logo_url text,
  reserva_imagen_url text,
  telefono varchar(80),
  email varchar(180),
  whatsapp varchar(40),
  instagram varchar(400),
  facebook varchar(400),
  direccion varchar(400),
  maps_embed text,
  maps_link text,
  creado timestamptz NOT NULL DEFAULT now(),
  modificado timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.negocio_config (timezone, horarios_por_dia, dias_no_laborables, nombre)
SELECT
  'America/Argentina/Buenos_Aires',
  jsonb_build_object(
    '0', jsonb_build_object('activo', false, 'inicio', '09:00', 'fin', '21:00'),
    '1', jsonb_build_object('activo', true,  'inicio', '13:00', 'fin', '21:00'),
    '2', jsonb_build_object('activo', true,  'inicio', '09:00', 'fin', '21:00'),
    '3', jsonb_build_object('activo', true,  'inicio', '09:00', 'fin', '21:00'),
    '4', jsonb_build_object('activo', true,  'inicio', '09:00', 'fin', '21:00'),
    '5', jsonb_build_object('activo', true,  'inicio', '09:00', 'fin', '21:00'),
    '6', jsonb_build_object('activo', true,  'inicio', '09:00', 'fin', '21:00')
  ),
  '[]'::jsonb,
  'ELEVÉ Barbería'
WHERE NOT EXISTS (SELECT 1 FROM public.negocio_config);

-- ============================================================================
-- 3) Entidades principales
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.empleados (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre varchar(120) NOT NULL,
  email varchar(180),
  especialidades text,
  horarios_disponibles jsonb,
  avatar_url varchar(500),
  estado_id integer NOT NULL REFERENCES public.estado_empleado(id),
  comision_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (comision_pct >= 0 AND comision_pct <= 100),
  creado timestamptz NOT NULL DEFAULT now(),
  modificado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.servicios (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre varchar(120) NOT NULL,
  precio numeric(12,2) NOT NULL CHECK (precio >= 0),
  duracion_min integer NOT NULL CHECK (duracion_min > 0),
  descripcion text,
  estado_id integer NOT NULL REFERENCES public.estado_servicio(id),
  creado timestamptz NOT NULL DEFAULT now(),
  modificado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clientes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre varchar(120) NOT NULL,
  telefono varchar(40),
  email varchar(180),
  preferencias text,
  estado_id integer NOT NULL REFERENCES public.estado_cliente(id),
  creado timestamptz NOT NULL DEFAULT now(),
  modificado timestamptz NOT NULL DEFAULT now()
);

-- Usuarios del dashboard. La autenticacion es via Supabase Auth:
-- auth_user_id vincula con auth.users y password_hash queda como
-- marcador ('supabase-auth'); la password real vive en Supabase Auth.
CREATE TABLE IF NOT EXISTS public.usuarios (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_user_id uuid,
  email varchar(180) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL DEFAULT 'supabase-auth',
  nombre varchar(120) NOT NULL,
  rol varchar(20) NOT NULL CHECK (rol IN ('administrador', 'empleado')),
  empleado_id integer REFERENCES public.empleados(id),
  ultimo_login timestamptz,
  activo boolean NOT NULL DEFAULT true,
  creado timestamptz NOT NULL DEFAULT now(),
  modificado timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_auth_user_id
  ON public.usuarios (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.empleados_servicios (
  empleado_id integer NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  servicio_id integer NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
  PRIMARY KEY (empleado_id, servicio_id)
);

-- cliente_id es opcional: el panel de gestion permite crear turnos sin cliente.
CREATE TABLE IF NOT EXISTS public.turnos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id integer REFERENCES public.clientes(id) ON DELETE SET NULL,
  empleado_id integer NOT NULL REFERENCES public.empleados(id),
  servicio_id integer NOT NULL REFERENCES public.servicios(id),
  fecha date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  estado_id integer NOT NULL REFERENCES public.estado_turno(id),
  observaciones text,
  precio numeric(12,2) NOT NULL CHECK (precio >= 0),
  recordatorio_enviado boolean NOT NULL DEFAULT false,
  creado timestamptz NOT NULL DEFAULT now(),
  modificado timestamptz NOT NULL DEFAULT now(),
  CHECK (hora_fin > hora_inicio)
);

CREATE TABLE IF NOT EXISTS public.metodos_pago (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre varchar(80) NOT NULL UNIQUE,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.pagos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  turno_id integer NOT NULL REFERENCES public.turnos(id) ON DELETE CASCADE,
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  metodo_pago_id integer NOT NULL REFERENCES public.metodos_pago(id),
  registrado_por integer REFERENCES public.usuarios(id),
  creado timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.logs_auditoria (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer REFERENCES public.usuarios(id),
  rol varchar(20),
  accion varchar(80) NOT NULL,
  entidad varchar(80) NOT NULL,
  entidad_id integer,
  detalle jsonb,
  ip varchar(64),
  creado timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5) Indices
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_turnos_fecha_empleado
  ON public.turnos (fecha, empleado_id);

CREATE INDEX IF NOT EXISTS idx_turnos_cliente
  ON public.turnos (cliente_id);

CREATE INDEX IF NOT EXISTS idx_turnos_estado
  ON public.turnos (estado_id);

CREATE INDEX IF NOT EXISTS idx_turnos_fecha_hora
  ON public.turnos (fecha, hora_inicio);

-- Usado por el cron de recordatorios: busca turnos reservados con
-- recordatorio_enviado = false dentro de una ventana de horas.
CREATE INDEX IF NOT EXISTS idx_turnos_recordatorio_pendiente
  ON public.turnos (estado_id, recordatorio_enviado, fecha);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_telefono_no_nulo
  ON public.clientes (telefono)
  WHERE telefono IS NOT NULL AND telefono <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_email_no_nulo
  ON public.clientes (email)
  WHERE email IS NOT NULL AND email <> '';

CREATE INDEX IF NOT EXISTS idx_pagos_turno
  ON public.pagos (turno_id);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_entidad
  ON public.logs_auditoria (entidad, entidad_id);

-- ============================================================================
-- 6) Seeds base
-- ============================================================================
INSERT INTO public.metodos_pago (nombre, activo)
VALUES
  ('Efectivo', true),
  ('Transferencia', true),
  ('Mercado Pago', true),
  ('Tarjeta', true)
ON CONFLICT (nombre) DO UPDATE
SET activo = EXCLUDED.activo;

-- ============================================================================
-- 7) Triggers modificado
-- ============================================================================
DROP TRIGGER IF EXISTS trg_estado_turno_modificado ON public.estado_turno;
CREATE TRIGGER trg_estado_turno_modificado
BEFORE UPDATE ON public.estado_turno
FOR EACH ROW
EXECUTE FUNCTION public.set_modificado_timestamp();

DROP TRIGGER IF EXISTS trg_estado_empleado_modificado ON public.estado_empleado;
CREATE TRIGGER trg_estado_empleado_modificado
BEFORE UPDATE ON public.estado_empleado
FOR EACH ROW
EXECUTE FUNCTION public.set_modificado_timestamp();

DROP TRIGGER IF EXISTS trg_estado_cliente_modificado ON public.estado_cliente;
CREATE TRIGGER trg_estado_cliente_modificado
BEFORE UPDATE ON public.estado_cliente
FOR EACH ROW
EXECUTE FUNCTION public.set_modificado_timestamp();

DROP TRIGGER IF EXISTS trg_estado_servicio_modificado ON public.estado_servicio;
CREATE TRIGGER trg_estado_servicio_modificado
BEFORE UPDATE ON public.estado_servicio
FOR EACH ROW
EXECUTE FUNCTION public.set_modificado_timestamp();

DROP TRIGGER IF EXISTS trg_negocio_config_modificado ON public.negocio_config;
CREATE TRIGGER trg_negocio_config_modificado
BEFORE UPDATE ON public.negocio_config
FOR EACH ROW
EXECUTE FUNCTION public.set_modificado_timestamp();

DROP TRIGGER IF EXISTS trg_empleados_modificado ON public.empleados;
CREATE TRIGGER trg_empleados_modificado
BEFORE UPDATE ON public.empleados
FOR EACH ROW
EXECUTE FUNCTION public.set_modificado_timestamp();

DROP TRIGGER IF EXISTS trg_servicios_modificado ON public.servicios;
CREATE TRIGGER trg_servicios_modificado
BEFORE UPDATE ON public.servicios
FOR EACH ROW
EXECUTE FUNCTION public.set_modificado_timestamp();

DROP TRIGGER IF EXISTS trg_clientes_modificado ON public.clientes;
CREATE TRIGGER trg_clientes_modificado
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.set_modificado_timestamp();

DROP TRIGGER IF EXISTS trg_usuarios_modificado ON public.usuarios;
CREATE TRIGGER trg_usuarios_modificado
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.set_modificado_timestamp();

DROP TRIGGER IF EXISTS trg_turnos_modificado ON public.turnos;
CREATE TRIGGER trg_turnos_modificado
BEFORE UPDATE ON public.turnos
FOR EACH ROW
EXECUTE FUNCTION public.set_modificado_timestamp();

COMMIT;
```

## Storage: bucket de imagenes (pegar en SQL Editor)

Bucket unico `imagenes` para todas las imagenes del sistema: avatares de empleados
(`empleados/{id}/...`) y logo e imagen de reservas del negocio (`negocio/...`). El
backend lo resuelve por las variables `SUPABASE_IMAGES_BUCKET` / `SUPABASE_STORAGE_BUCKET`
(default: `imagenes`).

```sql
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'imagenes',
  'imagenes',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lectura publica de objetos del bucket
DROP POLICY IF EXISTS "imagenes_public_read" ON storage.objects;
CREATE POLICY "imagenes_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'imagenes');

-- Permitir subida a usuarios autenticados (ademas del service_role)
DROP POLICY IF EXISTS "imagenes_auth_insert" ON storage.objects;
CREATE POLICY "imagenes_auth_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'imagenes');

-- Permitir update/delete para usuarios autenticados en el bucket
DROP POLICY IF EXISTS "imagenes_auth_update" ON storage.objects;
CREATE POLICY "imagenes_auth_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'imagenes')
WITH CHECK (bucket_id = 'imagenes');

DROP POLICY IF EXISTS "imagenes_auth_delete" ON storage.objects;
CREATE POLICY "imagenes_auth_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'imagenes');

COMMIT;
```

## Script de baja: Caja y Productos (solo si tu base ya tenia esas tablas)

El alcance del proyecto quedo acotado a gestión de turnos: los módulos de Caja
(punto de venta) y Productos (catálogo) se sacaron del código. Si tu base de
datos viene de antes de este cambio, corré esto una sola vez en el SQL Editor
de Supabase para eliminar esas tablas (el script único de arriba ya no las crea).

```sql
BEGIN;

DROP TABLE IF EXISTS public.caja_ventas_items CASCADE;
DROP TABLE IF EXISTS public.caja_ventas CASCADE;
DROP TABLE IF EXISTS public.productos CASCADE;
DROP TABLE IF EXISTS public.categorias_productos CASCADE;

COMMIT;
```

`CASCADE` se lleva puestos los índices, triggers y FKs asociados a esas 4 tablas,
así que no hace falta borrarlos a mano. `metodos_pago` (la usa `pagos` de turnos),
`empleados.comision_pct` (comisión sobre turnos completados) y el bucket de
Storage `imagenes` quedan sin cambios.

## Nota de uso

- Para el primer acceso del dashboard con Supabase Auth, primero crea el administrador inicial llamando a `POST /api/v1/auth/bootstrap-admin` con `nombre`, `email` y `password`.
- Desde ese momento, los siguientes usuarios se crean desde el módulo Usuarios del dashboard y quedan vinculados a Supabase Auth más la tabla `public.usuarios`.
- La tabla `usuarios` no tiene `username` ni tokens de reset propios: el login y el reset de password los maneja Supabase Auth por email.
- Los horarios del negocio, días no laborables y datos públicos (nombre, logo, redes, contacto, ubicación) se editan desde el dashboard y viven en `negocio_config`; no hay valores hardcodeados en el código. La validación de horario al completar turnos se activa con la variable de entorno `VALIDAR_HORARIO_AL_COMPLETAR_TURNO=true` en el backend.
- `logs_auditoria` queda creada como tabla de auditoría; hoy el backend no escribe en ella.
- El cron de recordatorios (`GET /api/v1/turnos/notificaciones/recordatorios`, sin sesión, autorizado por `REMINDERS_CRON_TOKEN` o el header de Vercel Cron) busca turnos reservados a 2hs o menos de empezar con `recordatorio_enviado = false` y, tras enviar cada email, marca esa columna en `true` para no reenviarlo en la próxima corrida.
- Con estos dos scripts (schema + storage) alcanza para arrancar de cero; las migraciones incrementales viejas ya no existen en el repo porque este documento es la fuente única del schema.
