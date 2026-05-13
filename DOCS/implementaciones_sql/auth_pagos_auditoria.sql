-- ================================================================
-- ELEVÉ BARBERÍA — Script 1: Autenticación, Pagos y Auditoría
-- Archivo : 01_auth_pagos_auditoria.sql
-- Destino : Supabase SQL Editor → ejecutar completo
-- ================================================================
-- PREREQUISITO: las tablas turnos, clientes, empleados, servicios
-- y empleados_servicios ya deben existir en Supabase.
-- Este script NO las modifica.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. FUNCIÓN AUXILIAR — actualiza 'modificado' en cada UPDATE
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_modificado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.modificado = NOW();
  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────────
-- 2. TABLA: usuarios
--    Reemplaza el archivo usuarios.json y la autenticación por
--    localStorage. Las contraseñas se almacenan como hash bcrypt
--    (costo 12), nunca en texto plano ni en base64.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (

  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre        VARCHAR(255) NOT NULL,

  -- RBAC: dos roles posibles
  rol           VARCHAR(20) NOT NULL
                  CHECK (rol IN ('administrador', 'empleado')),

  activo        BOOLEAN NOT NULL DEFAULT TRUE,

  -- Vínculo opcional con la tabla empleados
  -- NULL cuando el usuario es administrador puro
  empleado_id   INTEGER REFERENCES empleados(id) ON DELETE SET NULL,

  -- Recuperación de contraseña
  reset_token_hash       VARCHAR(255),
  reset_token_expires_at TIMESTAMP WITH TIME ZONE,

  -- Auditoría de sesión
  ultimo_login  TIMESTAMP WITH TIME ZONE,
  creado        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  modificado    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email  ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol    ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

DROP TRIGGER IF EXISTS trg_usuarios_modificado ON usuarios;
CREATE TRIGGER trg_usuarios_modificado
  BEFORE UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_modificado();


-- ────────────────────────────────────────────────────────────────
-- 3. TABLA: metodos_pago
--    Tabla normalizada para los métodos de pago disponibles.
--    Si el día de mañana se agrega "Tarjeta" o "Mercado Pago",
--    solo se inserta una fila nueva.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metodos_pago (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(50) UNIQUE NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- Datos iniciales (solo Efectivo y Transferencia por ahora)
INSERT INTO metodos_pago (nombre) VALUES ('Efectivo'), ('Transferencia')
ON CONFLICT (nombre) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- 4. TABLA: pagos
--    Registra cada cobro asociado a un turno.
--    Relaciones:
--      pagos.turno_id       → turnos.id
--      pagos.metodo_pago_id → metodos_pago.id
--      pagos.registrado_por → usuarios.id
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagos (

  id              SERIAL PRIMARY KEY,
  turno_id        INTEGER NOT NULL
                    REFERENCES turnos(id) ON DELETE RESTRICT,
  monto           DECIMAL(10, 2) NOT NULL
                    CHECK (monto > 0),
  metodo_pago_id  INTEGER NOT NULL
                    REFERENCES metodos_pago(id),
  registrado_por  INTEGER
                    REFERENCES usuarios(id) ON DELETE SET NULL,
  creado          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_turno ON pagos(turno_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(creado);


-- ────────────────────────────────────────────────────────────────
-- 5. TABLA: logs_auditoria
--    Registra operaciones de escritura (fire-and-forget).
--    Un fallo al insertar un log nunca interrumpe la operación
--    principal — el try/catch en el backend lo garantiza.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs_auditoria (

  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  rol         VARCHAR(20),
  accion      VARCHAR(50) NOT NULL,
  entidad     VARCHAR(50) NOT NULL,
  entidad_id  INTEGER,
  detalle     JSONB,
  ip          VARCHAR(45),
  creado      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_entidad  ON logs_auditoria(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_logs_fecha    ON logs_auditoria(creado);
CREATE INDEX IF NOT EXISTS idx_logs_usuario  ON logs_auditoria(usuario_id);


-- ────────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY (RLS)
--    Solo el service_role (backend) puede operar estas tablas.
--    El navegador no puede acceder directamente.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE usuarios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_auditoria  ENABLE ROW LEVEL SECURITY;
ALTER TABLE metodos_pago    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backend_usuarios_all"    ON usuarios;
DROP POLICY IF EXISTS "backend_pagos_all"        ON pagos;
DROP POLICY IF EXISTS "backend_logs_all"         ON logs_auditoria;
DROP POLICY IF EXISTS "backend_metodos_pago_all" ON metodos_pago;

CREATE POLICY "backend_usuarios_all"
  ON usuarios FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "backend_pagos_all"
  ON pagos FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "backend_logs_all"
  ON logs_auditoria FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "backend_metodos_pago_all"
  ON metodos_pago FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ────────────────────────────────────────────────────────────────
-- 7. USUARIO ADMINISTRADOR INICIAL
--
--    ⚠️ ANTES DE EJECUTAR ESTE BLOQUE:
--    Generá el hash bcrypt real con este comando en la terminal:
--
--    node -e "import('bcryptjs').then(b => b.default.hash('TU_PASSWORD_REAL', 12).then(console.log))"
--
--    Copiá el hash que devuelve (empieza con $2b$12$...) y
--    reemplazalo abajo donde dice REEMPLAZAR_CON_HASH.
--    NO uses 'TU_PASSWORD_REAL', elegí una contraseña segura.
-- ────────────────────────────────────────────────────────────────
INSERT INTO usuarios (email, password_hash, nombre, rol)
VALUES (
  'admin@eleve.com',
  '$2b$12$REEMPLAZAR_CON_HASH',
  'Administrador Elevé',
  'administrador'
)
ON CONFLICT (email) DO NOTHING;


-- ────────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-EJECUCIÓN
-- Copiar y pegar esto en una query aparte para confirmar:
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   AND table_name IN ('usuarios', 'metodos_pago', 'pagos', 'logs_auditoria');
--
-- Debe devolver 4 filas.
--
-- Para verificar los métodos de pago:
--   SELECT * FROM metodos_pago;
-- Debe devolver: Efectivo, Transferencia.
-- ────────────────────────────────────────────────────────────────