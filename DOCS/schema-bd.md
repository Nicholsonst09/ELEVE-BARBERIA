-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.empleados (
  email character varying,
  nombre character varying NOT NULL,
  especialidades text,
  horarios_disponibles json,
  id integer NOT NULL DEFAULT nextval('empleados_id_seq'::regclass),
  creado timestamp with time zone NOT NULL DEFAULT now(),
  modificado timestamp with time zone NOT NULL DEFAULT now(),
  estado_id integer,
  avatar_url character varying,
  CONSTRAINT empleados_pkey PRIMARY KEY (id),
  CONSTRAINT empleados_estado_id_fkey FOREIGN KEY (estado_id) REFERENCES public.estado_empleado(id)
);
CREATE TABLE public.servicios (
  nombre character varying NOT NULL,
  precio numeric NOT NULL,
  duracion_min integer NOT NULL,
  descripcion text,
  id integer NOT NULL DEFAULT nextval('servicios_id_seq'::regclass),
  creado timestamp with time zone NOT NULL DEFAULT now(),
  modificado timestamp with time zone NOT NULL DEFAULT now(),
  estado_id integer,
  CONSTRAINT servicios_pkey PRIMARY KEY (id),
  CONSTRAINT servicios_estado_id_fkey FOREIGN KEY (estado_id) REFERENCES public.estado_servicio(id)
);
CREATE TABLE public.clientes (
  nombre character varying NOT NULL,
  telefono character varying,
  preferencias text,
  id integer NOT NULL DEFAULT nextval('clientes_id_seq'::regclass),
  creado timestamp with time zone NOT NULL DEFAULT now(),
  modificado timestamp with time zone NOT NULL DEFAULT now(),
  email character varying,
  estado_id integer,
  CONSTRAINT clientes_pkey PRIMARY KEY (id),
  CONSTRAINT clientes_estado_id_fkey FOREIGN KEY (estado_id) REFERENCES public.estado_cliente(id)
);
CREATE TABLE public.turnos (
  cliente_id integer NOT NULL,
  empleado_id integer NOT NULL,
  servicio_id integer NOT NULL,
  fecha date NOT NULL,
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  observaciones text,
  precio numeric NOT NULL,
  id integer NOT NULL DEFAULT nextval('turnos_id_seq'::regclass),
  creado timestamp with time zone DEFAULT now(),
  modificado timestamp with time zone DEFAULT now(),
  estado_id integer,
  CONSTRAINT turnos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT fk_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT fk_servicio FOREIGN KEY (servicio_id) REFERENCES public.servicios(id),
  CONSTRAINT turnos_estado_id_fkey FOREIGN KEY (estado_id) REFERENCES public.estado_turno(id)
);
CREATE TABLE public.empleados_servicios (
  empleado_id integer NOT NULL,
  servicio_id integer NOT NULL,
  CONSTRAINT empleados_servicios_pkey PRIMARY KEY (empleado_id, servicio_id),
  CONSTRAINT fk_empleado FOREIGN KEY (empleado_id) REFERENCES public.empleados(id),
  CONSTRAINT fk_servicio FOREIGN KEY (servicio_id) REFERENCES public.servicios(id)
);
CREATE TABLE public.usuarios (
  email character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  nombre character varying NOT NULL,
  rol character varying NOT NULL CHECK (rol::text = ANY (ARRAY['administrador'::character varying, 'empleado'::character varying]::text[])),
  empleado_id integer,
  reset_token_hash character varying,
  reset_token_expires_at timestamp with time zone,
  ultimo_login timestamp with time zone,
  id integer NOT NULL DEFAULT nextval('usuarios_id_seq'::regclass),
  activo boolean NOT NULL DEFAULT true,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  modificado timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.empleados(id)
);
CREATE TABLE public.metodos_pago (
  nombre character varying NOT NULL UNIQUE,
  id integer NOT NULL DEFAULT nextval('metodos_pago_id_seq'::regclass),
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT metodos_pago_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pagos (
  turno_id integer NOT NULL,
  monto numeric NOT NULL CHECK (monto > 0::numeric),
  metodo_pago_id integer NOT NULL,
  registrado_por integer,
  id integer NOT NULL DEFAULT nextval('pagos_id_seq'::regclass),
  creado timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pagos_pkey PRIMARY KEY (id),
  CONSTRAINT pagos_turno_id_fkey FOREIGN KEY (turno_id) REFERENCES public.turnos(id),
  CONSTRAINT pagos_metodo_pago_id_fkey FOREIGN KEY (metodo_pago_id) REFERENCES public.metodos_pago(id),
  CONSTRAINT pagos_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuarios(id)
);
CREATE TABLE public.logs_auditoria (
  usuario_id integer,
  rol character varying,
  accion character varying NOT NULL,
  entidad character varying NOT NULL,
  entidad_id integer,
  detalle jsonb,
  ip character varying,
  id integer NOT NULL DEFAULT nextval('logs_auditoria_id_seq'::regclass),
  creado timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT logs_auditoria_pkey PRIMARY KEY (id),
  CONSTRAINT logs_auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.estado_turno (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  codigo character varying NOT NULL UNIQUE,
  nombre character varying NOT NULL,
  descripcion character varying,
  permite_cambios boolean NOT NULL DEFAULT true,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  modificado timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT estado_turno_pkey PRIMARY KEY (id)
);
CREATE TABLE public.estado_empleado (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  codigo character varying NOT NULL UNIQUE,
  nombre character varying NOT NULL,
  descripcion character varying,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  modificado timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT estado_empleado_pkey PRIMARY KEY (id)
);
CREATE TABLE public.estado_cliente (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  codigo character varying NOT NULL UNIQUE,
  nombre character varying NOT NULL,
  descripcion character varying,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  modificado timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT estado_cliente_pkey PRIMARY KEY (id)
);
CREATE TABLE public.estado_servicio (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  codigo character varying NOT NULL UNIQUE,
  nombre character varying NOT NULL,
  descripcion character varying,
  creado timestamp with time zone NOT NULL DEFAULT now(),
  modificado timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT estado_servicio_pkey PRIMARY KEY (id)
);

## Script de carga ficticia para turnos (Supabase)

Este script genera una agenda e historial de turnos para 2 meses de actividad.

- Rango simulado: 1 mes hacia atras hasta hoy.
- Volumen diario: entre 10 y 15 turnos por dia.
- Respeta claves foraneas: usa empleados, servicios, clientes y estados existentes.
- Evita superposicion de turnos para el mismo empleado.
- Es idempotente para esta simulacion: primero borra solo turnos creados por este script.

Ejecutar en SQL Editor de Supabase:

BEGIN;

DELETE FROM public.turnos
WHERE observaciones LIKE '[SIM] agenda+historial 2 meses%';

DO $$
DECLARE
  v_inicio date := (current_date - interval '1 month')::date;
  v_fin    date := current_date;

  v_dia date;
  v_objetivo int;
  v_creados int;
  v_intento int;

  arr_empleados int[];
  arr_clientes int[];

  v_servicio_id int;
  v_duracion int;
  v_precio numeric;

  v_cliente_id int;
  v_empleado_id int;

  v_hora time;
  v_hora_fin time;
  v_minutos int;
  v_hora_base int;

  id_estado_cliente_activo int;
  id_reservado int;
  id_completado int;
  id_cancelado int;
  id_realizado int;
  id_anulado int;

  v_estado_id int;
  v_r double precision;
BEGIN
  SELECT id INTO id_estado_cliente_activo
  FROM public.estado_cliente
  WHERE codigo = 'activo'
  LIMIT 1;

  IF id_estado_cliente_activo IS NULL THEN
    RAISE EXCEPTION 'Falta estado_cliente.codigo=activo';
  END IF;

  SELECT id INTO id_reservado
  FROM public.estado_turno
  WHERE codigo = 'reservado'
  LIMIT 1;

  SELECT id INTO id_completado
  FROM public.estado_turno
  WHERE codigo = 'completado'
  LIMIT 1;

  SELECT id INTO id_cancelado
  FROM public.estado_turno
  WHERE codigo = 'cancelado'
  LIMIT 1;

  SELECT id INTO id_realizado
  FROM public.estado_turno
  WHERE codigo = 'realizado'
  LIMIT 1;

  SELECT id INTO id_anulado
  FROM public.estado_turno
  WHERE codigo = 'anulado'
  LIMIT 1;

  IF id_reservado IS NULL OR id_completado IS NULL OR id_cancelado IS NULL THEN
    RAISE EXCEPTION 'Faltan estados_turno minimos: reservado/completado/cancelado';
  END IF;

  id_realizado := COALESCE(id_realizado, id_completado);
  id_anulado := COALESCE(id_anulado, id_cancelado);

  INSERT INTO public.clientes (nombre, telefono, email, preferencias, estado_id, modificado)
  SELECT
    'Cliente Demo ' || to_char(gs, 'FM000'),
    '11' || lpad((10000000 + gs)::text, 8, '0'),
    'demo.cliente.' || gs || '@mail.com',
    (ARRAY['Corte clasico', 'Fade', 'Barba', 'Sin preferencia'])[(1 + floor(random() * 4))::int],
    id_estado_cliente_activo,
    now()
  FROM generate_series(1, 140) gs
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.email = 'demo.cliente.' || gs || '@mail.com'
  );

  SELECT array_agg(c.id) INTO arr_clientes
  FROM public.clientes c
  LEFT JOIN public.estado_cliente ec ON ec.id = c.estado_id
  WHERE COALESCE(ec.codigo, 'activo') = 'activo';

  SELECT array_agg(e.id) INTO arr_empleados
  FROM public.empleados e
  JOIN public.estado_empleado ee ON ee.id = e.estado_id
  WHERE ee.codigo = 'activo';

  IF COALESCE(array_length(arr_clientes, 1), 0) = 0 THEN
    RAISE EXCEPTION 'No hay clientes activos para simular';
  END IF;

  IF COALESCE(array_length(arr_empleados, 1), 0) = 0 THEN
    RAISE EXCEPTION 'No hay empleados activos para simular';
  END IF;

  FOR v_dia IN
    SELECT generate_series(v_inicio, v_fin, interval '1 day')::date
  LOOP
    v_objetivo := 10 + floor(random() * 6)::int;
    v_creados := 0;
    v_intento := 0;

    WHILE v_creados < v_objetivo AND v_intento < (v_objetivo * 10) LOOP
      v_intento := v_intento + 1;

      SELECT s.id, s.duracion_min, s.precio
      INTO v_servicio_id, v_duracion, v_precio
      FROM public.servicios s
      JOIN public.estado_servicio es ON es.id = s.estado_id
      WHERE es.codigo = 'activo'
      ORDER BY random()
      LIMIT 1;

      IF v_servicio_id IS NULL THEN
        RAISE EXCEPTION 'No hay servicios activos para simular';
      END IF;

      v_cliente_id := arr_clientes[1 + floor(random() * array_length(arr_clientes, 1))::int];
      v_empleado_id := arr_empleados[1 + floor(random() * array_length(arr_empleados, 1))::int];

      v_hora_base := 9 + floor(random() * 12)::int;
      v_minutos := CASE WHEN random() < 0.5 THEN 0 ELSE 30 END;
      v_hora := make_time(v_hora_base, v_minutos, 0);

      IF (v_hora + make_interval(mins => v_duracion))::time > time '21:00' THEN
        v_hora := (time '21:00' - make_interval(mins => v_duracion))::time;
      END IF;

      v_hora_fin := (v_hora + make_interval(mins => v_duracion))::time;

      IF EXISTS (
        SELECT 1
        FROM public.turnos t
        WHERE t.fecha = v_dia
          AND t.empleado_id = v_empleado_id
          AND t.hora_inicio < v_hora_fin
          AND t.hora_fin > v_hora
      ) THEN
        CONTINUE;
      END IF;

      v_r := random();

      IF v_dia < current_date THEN
        v_estado_id := CASE
          WHEN v_r < 0.80 THEN id_realizado
          WHEN v_r < 0.92 THEN id_cancelado
          WHEN v_r < 0.97 THEN id_anulado
          ELSE id_reservado
        END;
      ELSIF v_dia = current_date THEN
        v_estado_id := CASE
          WHEN v_r < 0.50 THEN id_realizado
          WHEN v_r < 0.95 THEN id_reservado
          ELSE id_cancelado
        END;
      ELSE
        v_estado_id := CASE
          WHEN v_r < 0.95 THEN id_reservado
          ELSE id_cancelado
        END;
      END IF;

      INSERT INTO public.turnos (
        cliente_id,
        empleado_id,
        servicio_id,
        fecha,
        hora_inicio,
        hora_fin,
        observaciones,
        precio,
        estado_id,
        creado,
        modificado
      )
      VALUES (
        v_cliente_id,
        v_empleado_id,
        v_servicio_id,
        v_dia,
        v_hora,
        v_hora_fin,
        '[SIM] agenda+historial 2 meses',
        v_precio,
        v_estado_id,
        now(),
        now()
      );

      v_creados := v_creados + 1;
    END LOOP;
  END LOOP;
END $$;

SELECT fecha, count(*) AS total_turnos
FROM public.turnos
WHERE observaciones LIKE '[SIM] agenda+historial 2 meses%'
GROUP BY fecha
ORDER BY fecha;

COMMIT;

## Script de carga ficticia desde 25/06/2026 (+1 mes)

Este script es igual al anterior, pero genera turnos desde el 25/06/2026
hasta el 25/07/2026 (inclusive), con 10 a 15 turnos por dia.

BEGIN;

DELETE FROM public.turnos
WHERE observaciones LIKE '[SIM] agenda desde 2026-06-25%';

DO $$
DECLARE
  v_inicio date := date '2026-06-25';
  v_fin    date := (date '2026-06-25' + interval '1 month')::date;

  v_dia date;
  v_objetivo int;
  v_creados int;
  v_intento int;

  arr_empleados int[];
  arr_clientes int[];

  v_servicio_id int;
  v_duracion int;
  v_precio numeric;

  v_cliente_id int;
  v_empleado_id int;

  v_hora time;
  v_hora_fin time;
  v_minutos int;
  v_hora_base int;

  id_estado_cliente_activo int;
  id_reservado int;
  id_completado int;
  id_cancelado int;
  id_realizado int;
  id_anulado int;

  v_estado_id int;
  v_r double precision;
BEGIN
  SELECT id INTO id_estado_cliente_activo
  FROM public.estado_cliente
  WHERE codigo = 'activo'
  LIMIT 1;

  IF id_estado_cliente_activo IS NULL THEN
    RAISE EXCEPTION 'Falta estado_cliente.codigo=activo';
  END IF;

  SELECT id INTO id_reservado
  FROM public.estado_turno
  WHERE codigo = 'reservado'
  LIMIT 1;

  SELECT id INTO id_completado
  FROM public.estado_turno
  WHERE codigo = 'completado'
  LIMIT 1;

  SELECT id INTO id_cancelado
  FROM public.estado_turno
  WHERE codigo = 'cancelado'
  LIMIT 1;

  SELECT id INTO id_realizado
  FROM public.estado_turno
  WHERE codigo = 'realizado'
  LIMIT 1;

  SELECT id INTO id_anulado
  FROM public.estado_turno
  WHERE codigo = 'anulado'
  LIMIT 1;

  IF id_reservado IS NULL OR id_completado IS NULL OR id_cancelado IS NULL THEN
    RAISE EXCEPTION 'Faltan estados_turno minimos: reservado/completado/cancelado';
  END IF;

  id_realizado := COALESCE(id_realizado, id_completado);
  id_anulado := COALESCE(id_anulado, id_cancelado);

  INSERT INTO public.clientes (nombre, telefono, email, preferencias, estado_id, modificado)
  SELECT
    'Cliente Demo ' || to_char(gs, 'FM000'),
    '11' || lpad((10000000 + gs)::text, 8, '0'),
    'demo.cliente.' || gs || '@mail.com',
    (ARRAY['Corte clasico', 'Fade', 'Barba', 'Sin preferencia'])[(1 + floor(random() * 4))::int],
    id_estado_cliente_activo,
    now()
  FROM generate_series(1, 140) gs
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.email = 'demo.cliente.' || gs || '@mail.com'
  );

  SELECT array_agg(c.id) INTO arr_clientes
  FROM public.clientes c
  LEFT JOIN public.estado_cliente ec ON ec.id = c.estado_id
  WHERE COALESCE(ec.codigo, 'activo') = 'activo';

  SELECT array_agg(e.id) INTO arr_empleados
  FROM public.empleados e
  JOIN public.estado_empleado ee ON ee.id = e.estado_id
  WHERE ee.codigo = 'activo';

  IF COALESCE(array_length(arr_clientes, 1), 0) = 0 THEN
    RAISE EXCEPTION 'No hay clientes activos para simular';
  END IF;

  IF COALESCE(array_length(arr_empleados, 1), 0) = 0 THEN
    RAISE EXCEPTION 'No hay empleados activos para simular';
  END IF;

  FOR v_dia IN
    SELECT generate_series(v_inicio, v_fin, interval '1 day')::date
  LOOP
    v_objetivo := 10 + floor(random() * 6)::int;
    v_creados := 0;
    v_intento := 0;

    WHILE v_creados < v_objetivo AND v_intento < (v_objetivo * 10) LOOP
      v_intento := v_intento + 1;

      SELECT s.id, s.duracion_min, s.precio
      INTO v_servicio_id, v_duracion, v_precio
      FROM public.servicios s
      JOIN public.estado_servicio es ON es.id = s.estado_id
      WHERE es.codigo = 'activo'
      ORDER BY random()
      LIMIT 1;

      IF v_servicio_id IS NULL THEN
        RAISE EXCEPTION 'No hay servicios activos para simular';
      END IF;

      v_cliente_id := arr_clientes[1 + floor(random() * array_length(arr_clientes, 1))::int];
      v_empleado_id := arr_empleados[1 + floor(random() * array_length(arr_empleados, 1))::int];

      v_hora_base := 9 + floor(random() * 12)::int;
      v_minutos := CASE WHEN random() < 0.5 THEN 0 ELSE 30 END;
      v_hora := make_time(v_hora_base, v_minutos, 0);

      IF (v_hora + make_interval(mins => v_duracion))::time > time '21:00' THEN
        v_hora := (time '21:00' - make_interval(mins => v_duracion))::time;
      END IF;

      v_hora_fin := (v_hora + make_interval(mins => v_duracion))::time;

      IF EXISTS (
        SELECT 1
        FROM public.turnos t
        WHERE t.fecha = v_dia
          AND t.empleado_id = v_empleado_id
          AND t.hora_inicio < v_hora_fin
          AND t.hora_fin > v_hora
      ) THEN
        CONTINUE;
      END IF;

      v_r := random();

      IF v_dia < current_date THEN
        v_estado_id := CASE
          WHEN v_r < 0.80 THEN id_realizado
          WHEN v_r < 0.92 THEN id_cancelado
          WHEN v_r < 0.97 THEN id_anulado
          ELSE id_reservado
        END;
      ELSIF v_dia = current_date THEN
        v_estado_id := CASE
          WHEN v_r < 0.50 THEN id_realizado
          WHEN v_r < 0.95 THEN id_reservado
          ELSE id_cancelado
        END;
      ELSE
        v_estado_id := CASE
          WHEN v_r < 0.95 THEN id_reservado
          ELSE id_cancelado
        END;
      END IF;

      INSERT INTO public.turnos (
        cliente_id,
        empleado_id,
        servicio_id,
        fecha,
        hora_inicio,
        hora_fin,
        observaciones,
        precio,
        estado_id,
        creado,
        modificado
      )
      VALUES (
        v_cliente_id,
        v_empleado_id,
        v_servicio_id,
        v_dia,
        v_hora,
        v_hora_fin,
        '[SIM] agenda desde 2026-06-25 +1 mes',
        v_precio,
        v_estado_id,
        now(),
        now()
      );

      v_creados := v_creados + 1;
    END LOOP;
  END LOOP;
END $$;

SELECT fecha, count(*) AS total_turnos
FROM public.turnos
WHERE observaciones LIKE '[SIM] agenda desde 2026-06-25%'
GROUP BY fecha
ORDER BY fecha;

COMMIT;

## Migracion de estados de turnos (legacy -> nuevo)

Este script convierte estados antiguos al esquema actual:

- pendiente -> reservado
- confirmado -> reservado
- realizado -> completado

No modifica cancelado ni anulado.

BEGIN;

WITH estados AS (
  SELECT codigo, id
  FROM public.estado_turno
  WHERE codigo IN ('pendiente', 'confirmado', 'realizado', 'reservado', 'completado')
),
ids AS (
  SELECT
    MAX(CASE WHEN codigo = 'pendiente' THEN id END) AS id_pendiente,
    MAX(CASE WHEN codigo = 'confirmado' THEN id END) AS id_confirmado,
    MAX(CASE WHEN codigo = 'realizado' THEN id END) AS id_realizado,
    MAX(CASE WHEN codigo = 'reservado' THEN id END) AS id_reservado,
    MAX(CASE WHEN codigo = 'completado' THEN id END) AS id_completado
  FROM estados
)
UPDATE public.turnos t
SET
  estado_id = CASE
    WHEN t.estado_id IN (ids.id_pendiente, ids.id_confirmado) THEN ids.id_reservado
    WHEN t.estado_id = ids.id_realizado THEN ids.id_completado
    ELSE t.estado_id
  END,
  modificado = now()
FROM ids
WHERE (
  (ids.id_reservado IS NOT NULL AND t.estado_id IN (ids.id_pendiente, ids.id_confirmado))
  OR (ids.id_completado IS NOT NULL AND t.estado_id = ids.id_realizado)
);

COMMIT;

-- Verificacion sugerida
SELECT et.codigo, COUNT(*) AS cantidad
FROM public.turnos t
JOIN public.estado_turno et ON et.id = t.estado_id
GROUP BY et.codigo
ORDER BY cantidad DESC;

## Registro de pagos (tabla pagos)

Nota importante:

- Con el estado actual del proyecto, el modal de pago del dashboard no persiste en la tabla pagos.
- Para registrar pagos reales en BD, usar estas queries en Supabase.

### 1) Inicializar metodos de pago (una sola vez)

INSERT INTO public.metodos_pago (nombre, activo)
VALUES
  ('efectivo', true),
  ('transferencia', true),
  ('tarjeta', true)
ON CONFLICT (nombre) DO NOTHING;

### 2) Registrar un pago manual por turno

Reemplazar 123 por el id del turno y, si queres, el id del usuario que registra.

WITH metodo AS (
  SELECT id
  FROM public.metodos_pago
  WHERE nombre = 'efectivo'
  LIMIT 1
),
turno AS (
  SELECT id, precio
  FROM public.turnos
  WHERE id = 123
  LIMIT 1
)
INSERT INTO public.pagos (turno_id, monto, metodo_pago_id, registrado_por)
SELECT t.id, t.precio, m.id, NULL
FROM turno t
CROSS JOIN metodo m;

### 3) Cargar pagos masivos para turnos simulados

Esta query genera pagos para los turnos de la simulacion del ultimo mes,
solo cuando no tienen pago previo.

BEGIN;

INSERT INTO public.metodos_pago (nombre, activo)
VALUES
  ('efectivo', true),
  ('transferencia', true),
  ('tarjeta', true)
ON CONFLICT (nombre) DO NOTHING;

WITH metodos AS (
  SELECT id, nombre
  FROM public.metodos_pago
  WHERE activo = true
    AND nombre IN ('efectivo', 'transferencia', 'tarjeta')
),
turnos_objetivo AS (
  SELECT t.id, t.precio
  FROM public.turnos t
  JOIN public.estado_turno et ON et.id = t.estado_id
  WHERE t.observaciones LIKE '[SIM] agenda+historial 2 meses%'
    AND et.codigo IN ('completado', 'reservado')
),
sin_pago AS (
  SELECT tobj.id, tobj.precio
  FROM turnos_objetivo tobj
  LEFT JOIN public.pagos p ON p.turno_id = tobj.id
  WHERE p.id IS NULL
),
metodo_random AS (
  SELECT
    sp.id AS turno_id,
    sp.precio AS monto,
    (
      SELECT m.id
      FROM metodos m
      ORDER BY random()
      LIMIT 1
    ) AS metodo_pago_id
  FROM sin_pago sp
)
INSERT INTO public.pagos (turno_id, monto, metodo_pago_id, registrado_por)
SELECT turno_id, monto, metodo_pago_id, NULL
FROM metodo_random;

COMMIT;

### 4) Verificacion rapida

SELECT
  mp.nombre AS metodo,
  COUNT(*) AS cantidad_pagos,
  SUM(p.monto) AS total_cobrado
FROM public.pagos p
JOIN public.metodos_pago mp ON mp.id = p.metodo_pago_id
GROUP BY mp.nombre
ORDER BY cantidad_pagos DESC;