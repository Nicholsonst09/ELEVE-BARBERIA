-- ================================================================
-- ELEVÉ BARBERÍA — Script 2: Tablas de Estado y Normalización
-- Archivo : 02_tablas_estado_normalizacion.sql
-- Destino : Supabase SQL Editor → ejecutar completo
-- ================================================================
--
-- PREREQUISITO: 
--   - El Script 1 (01_auth_pagos_auditoria.sql) ya debe estar
--     ejecutado (porque este script referencia 'usuarios').
--   - Las tablas turnos, clientes, empleados, servicios deben
--     existir con su estructura actual.
--
-- QUÉ HACE ESTE SCRIPT:
--   1. Crea las tablas de estado (estado_turno, estado_cliente,
--      estado_empleado, estado_servicio) con sus datos iniciales.
--   2. Agrega columnas estado_id a las tablas que hoy usan
--      string directo (turnos) o boolean (empleados, servicios).
--   3. Migra los datos existentes al nuevo esquema.
--   4. Agrega columnas faltantes según los diagramas de la tesis
--      (email en clientes, estado_id en clientes, etc.).
--
-- ⚠️ IMPORTANTE: Si ya tenés datos en las tablas, este script
-- los migra automáticamente. No se pierde información.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. TABLA: estado_turno
--    Estados del ciclo de vida de un turno.
--    El campo permite_cambios indica si el turno en ese estado
--    puede ser modificado (false para estados finales).
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estado_turno (
  id               SERIAL PRIMARY KEY,
  codigo           VARCHAR(20) UNIQUE NOT NULL,
  nombre           VARCHAR(50) NOT NULL,
  descripcion      VARCHAR(255),
  permite_cambios  BOOLEAN NOT NULL DEFAULT TRUE,
  creado           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  modificado       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO estado_turno (codigo, nombre, descripcion, permite_cambios) VALUES
  ('pendiente',  'Pendiente',  'Turno creado, pendiente de confirmación', TRUE),
  ('confirmado', 'Confirmado', 'Turno confirmado por el personal',       TRUE),
  ('completado', 'Completado', 'Turno atendido y finalizado',            FALSE),
  ('cancelado',  'Cancelado',  'Turno cancelado',                        FALSE)
ON CONFLICT (codigo) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 2. TABLA: estado_cliente
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estado_cliente (
  id           SERIAL PRIMARY KEY,
  codigo       VARCHAR(20) UNIQUE NOT NULL,
  nombre       VARCHAR(50) NOT NULL,
  descripcion  VARCHAR(255),
  creado       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  modificado   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO estado_cliente (codigo, nombre, descripcion) VALUES
  ('activo',   'Activo',   'Cliente activo en el sistema'),
  ('inactivo', 'Inactivo', 'Cliente dado de baja')
ON CONFLICT (codigo) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 3. TABLA: estado_empleado
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estado_empleado (
  id           SERIAL PRIMARY KEY,
  codigo       VARCHAR(20) UNIQUE NOT NULL,
  nombre       VARCHAR(50) NOT NULL,
  descripcion  VARCHAR(255),
  creado       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  modificado   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO estado_empleado (codigo, nombre, descripcion) VALUES
  ('activo',   'Activo',   'Empleado activo, puede recibir turnos'),
  ('inactivo', 'Inactivo', 'Empleado dado de baja')
ON CONFLICT (codigo) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 4. TABLA: estado_servicio
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estado_servicio (
  id           SERIAL PRIMARY KEY,
  codigo       VARCHAR(20) UNIQUE NOT NULL,
  nombre       VARCHAR(50) NOT NULL,
  descripcion  VARCHAR(255),
  creado       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  modificado   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO estado_servicio (codigo, nombre, descripcion) VALUES
  ('activo',   'Activo',   'Servicio disponible para reservas'),
  ('inactivo', 'Inactivo', 'Servicio dado de baja')
ON CONFLICT (codigo) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 5. MIGRACIÓN: tabla turnos
--    - Agregar columna estado_id (FK a estado_turno)
--    - Migrar datos del campo 'estado' (varchar) al nuevo estado_id
--    - El campo 'estado' (varchar) se conserva temporalmente
--      para no romper el backend actual. Se eliminará cuando
--      el backend esté refactorizado.
-- ────────────────────────────────────────────────────────────────

-- 5.1 Agregar columna estado_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'turnos' AND column_name = 'estado_id'
  ) THEN
    ALTER TABLE turnos ADD COLUMN estado_id INTEGER REFERENCES estado_turno(id);
  END IF;
END $$;

-- 5.2 Migrar datos existentes: mapear string → id
UPDATE turnos t
SET estado_id = et.id
FROM estado_turno et
WHERE LOWER(t.estado) = et.codigo
  AND t.estado_id IS NULL;

-- 5.3 Los turnos que no matchearon (estado NULL o raro) → pendiente
UPDATE turnos
SET estado_id = (SELECT id FROM estado_turno WHERE codigo = 'pendiente')
WHERE estado_id IS NULL;

-- Nota: NO eliminamos la columna 'estado' varchar todavía.
-- El backend actual la usa. Cuando el refactor esté listo,
-- se ejecutará: ALTER TABLE turnos DROP COLUMN estado;


-- ────────────────────────────────────────────────────────────────
-- 6. MIGRACIÓN: tabla clientes
--    - Agregar columna email (faltante en BD actual)
--    - Agregar columna estado_id (FK a estado_cliente)
--    - Todos los clientes existentes → estado 'activo'
-- ────────────────────────────────────────────────────────────────

-- 6.1 Agregar email si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'email'
  ) THEN
    ALTER TABLE clientes ADD COLUMN email VARCHAR(255);
  END IF;
END $$;

-- 6.2 Agregar estado_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'estado_id'
  ) THEN
    ALTER TABLE clientes ADD COLUMN estado_id INTEGER REFERENCES estado_cliente(id);
  END IF;
END $$;

-- 6.3 Migrar: todos los clientes existentes → activo
UPDATE clientes
SET estado_id = (SELECT id FROM estado_cliente WHERE codigo = 'activo')
WHERE estado_id IS NULL;


-- ────────────────────────────────────────────────────────────────
-- 7. MIGRACIÓN: tabla empleados
--    - Agregar columna estado_id (FK a estado_empleado)
--    - Agregar columna usuario_id (FK a usuarios, del diagrama)
--    - Migrar: activo=true → estado 'activo', activo=false → 'inactivo'
--    - El campo 'activo' (boolean) se conserva temporalmente.
-- ────────────────────────────────────────────────────────────────

-- 7.1 Agregar estado_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'empleados' AND column_name = 'estado_id'
  ) THEN
    ALTER TABLE empleados ADD COLUMN estado_id INTEGER REFERENCES estado_empleado(id);
  END IF;
END $$;

-- 7.2 Agregar usuario_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'empleados' AND column_name = 'usuario_id'
  ) THEN
    ALTER TABLE empleados ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7.3 Migrar datos del boolean 'activo' al nuevo estado_id
UPDATE empleados
SET estado_id = (SELECT id FROM estado_empleado WHERE codigo = 'activo')
WHERE activo = TRUE AND estado_id IS NULL;

UPDATE empleados
SET estado_id = (SELECT id FROM estado_empleado WHERE codigo = 'inactivo')
WHERE activo = FALSE AND estado_id IS NULL;

-- Los que no tenían valor → activo por defecto
UPDATE empleados
SET estado_id = (SELECT id FROM estado_empleado WHERE codigo = 'activo')
WHERE estado_id IS NULL;


-- ────────────────────────────────────────────────────────────────
-- 8. MIGRACIÓN: tabla servicios
--    - Agregar columna estado_id (FK a estado_servicio)
--    - Migrar: activo=true → 'activo', activo=false → 'inactivo'
-- ────────────────────────────────────────────────────────────────

-- 8.1 Agregar estado_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servicios' AND column_name = 'estado_id'
  ) THEN
    ALTER TABLE servicios ADD COLUMN estado_id INTEGER REFERENCES estado_servicio(id);
  END IF;
END $$;

-- 8.2 Migrar
UPDATE servicios
SET estado_id = (SELECT id FROM estado_servicio WHERE codigo = 'activo')
WHERE activo = TRUE AND estado_id IS NULL;

UPDATE servicios
SET estado_id = (SELECT id FROM estado_servicio WHERE codigo = 'inactivo')
WHERE activo = FALSE AND estado_id IS NULL;

UPDATE servicios
SET estado_id = (SELECT id FROM estado_servicio WHERE codigo = 'activo')
WHERE estado_id IS NULL;


-- ────────────────────────────────────────────────────────────────
-- 9. RLS para las tablas de estado (solo lectura desde service_role)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE estado_turno    ENABLE ROW LEVEL SECURITY;
ALTER TABLE estado_cliente  ENABLE ROW LEVEL SECURITY;
ALTER TABLE estado_empleado ENABLE ROW LEVEL SECURITY;
ALTER TABLE estado_servicio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backend_estado_turno_all"    ON estado_turno;
DROP POLICY IF EXISTS "backend_estado_cliente_all"   ON estado_cliente;
DROP POLICY IF EXISTS "backend_estado_empleado_all"  ON estado_empleado;
DROP POLICY IF EXISTS "backend_estado_servicio_all"  ON estado_servicio;

CREATE POLICY "backend_estado_turno_all"
  ON estado_turno FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "backend_estado_cliente_all"
  ON estado_cliente FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "backend_estado_empleado_all"
  ON estado_empleado FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "backend_estado_servicio_all"
  ON estado_servicio FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ────────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-EJECUCIÓN
-- Copiar y pegar en una query aparte:
--
--   -- Verificar que las 4 tablas de estado existen
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   AND table_name IN ('estado_turno', 'estado_cliente',
--                      'estado_empleado', 'estado_servicio');
--
--   -- Verificar datos de estado_turno
--   SELECT * FROM estado_turno ORDER BY id;
--
--   -- Verificar que turnos tiene estado_id poblado
--   SELECT id, estado, estado_id FROM turnos LIMIT 10;
--
--   -- Verificar que empleados tiene estado_id y usuario_id
--   SELECT id, nombre, activo, estado_id, usuario_id
--   FROM empleados LIMIT 10;
--
--   -- Verificar columnas nuevas en clientes
--   SELECT id, nombre, email, estado_id FROM clientes LIMIT 10;
-- ────────────────────────────────────────────────────────────────