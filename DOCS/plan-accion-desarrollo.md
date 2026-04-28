# PLAN DE ACCIÓN DE DESARROLLO — SISTEMA ELEVÉ BARBERÍA

---

# ═══════════════════════════════════════════════════════════
# BLOQUE 1: PARA LA DEMO DE MAÑANA (29/4 — 21:00 hs)
# ═══════════════════════════════════════════════════════════

El profesor quiere ver tres cosas:
1. Control de estados de turno
2. Agenda con turnos simultáneos
3. Resolución de conflictos de horario

Todo lo demás puede esperar. Foco absoluto en estas tres cosas.

---

## PASO 1 — Máquina de estados en el backend (1-2 horas)

### Qué hacer

Crear un validador de transiciones de estado en el controlador de turnos.

### Archivo: `BACKEND/modulos/turnos/controlador.turno.mjs`

Agregar esta lógica ANTES de permitir cualquier PUT en turnos:

```javascript
// Transiciones válidas de estado
const TRANSICIONES_VALIDAS = {
  'pendiente':   ['confirmado', 'cancelado'],
  'confirmado':  ['completado', 'cancelado'],
  'completado':  [],   // estado final, no permite cambios
  'cancelado':   []    // estado final, no permite cambios
};

function validarTransicionEstado(estadoActual, estadoNuevo) {
  // Si no cambia el estado, está bien
  if (estadoActual === estadoNuevo) return true;
  
  const permitidos = TRANSICIONES_VALIDAS[estadoActual];
  if (!permitidos) return false;
  return permitidos.includes(estadoNuevo);
}
```

### Dónde aplicarlo

En la función de modificar turno (PUT), antes de hacer el update:

```javascript
// 1. Obtener el turno actual de la BD
const turnoActual = await obtenerTurnoPorId(id);

// 2. Si el turno está en estado final, rechazar TODA modificación
if (['completado', 'cancelado'].includes(turnoActual.estado)) {
  return res.status(400).json({ 
    error: `No se puede modificar un turno en estado "${turnoActual.estado}"` 
  });
}

// 3. Si viene un cambio de estado, validar la transición
if (estado && !validarTransicionEstado(turnoActual.estado, estado)) {
  return res.status(400).json({ 
    error: `No se puede pasar de "${turnoActual.estado}" a "${estado}"` 
  });
}
```

### También aplicar en DELETE

```javascript
// No permitir eliminar turnos completados
if (turnoActual.estado === 'completado') {
  return res.status(400).json({ 
    error: 'No se puede eliminar un turno completado' 
  });
}
```

### Verificación

Probar con Postman o desde el frontend:
- Crear turno → estado debe ser "pendiente" ✅ (ya funciona)
- PUT turno pendiente → confirmado ✅
- PUT turno confirmado → completado ✅
- PUT turno completado → cancelado ❌ (debe rechazar)
- PUT turno cancelado → pendiente ❌ (debe rechazar)
- Modificar datos de turno completado ❌ (debe rechazar)

---

## PASO 2 — Anti-solapamiento en creación/modificación de turnos (1-2 horas)

### Qué hacer

Validar en el backend que NO exista otro turno para el mismo empleado que se superponga en horario, antes de hacer INSERT o UPDATE.

### Archivo: `BACKEND/modulos/turnos/modelo.turno.mjs`

Agregar esta función:

```javascript
export async function verificarSolapamiento(empleado_id, fecha, hora_inicio, hora_fin, turno_id_excluir = null) {
  // Buscar turnos del mismo empleado, misma fecha, que NO estén cancelados
  let query = supabaseAdmin
    .from('turnos')
    .select('id, hora_inicio, hora_fin, estado')
    .eq('empleado_id', empleado_id)
    .eq('fecha', fecha)
    .neq('estado', 'cancelado');
  
  // Si estamos modificando, excluir el turno actual
  if (turno_id_excluir) {
    query = query.neq('id', turno_id_excluir);
  }

  const { data: turnosExistentes, error } = await query;
  
  if (error) throw error;
  
  // Verificar solapamiento: el nuevo turno se solapa si
  // su inicio es anterior al fin de otro Y su fin es posterior al inicio de otro
  const conflicto = turnosExistentes.find(t => 
    hora_inicio < t.hora_fin && hora_fin > t.hora_inicio
  );
  
  return conflicto || null; // null = sin conflicto
}
```

### Archivo: `BACKEND/modulos/turnos/controlador.turno.mjs`

En la función de CREAR turno (POST), agregar antes del insert:

```javascript
const conflicto = await verificarSolapamiento(empleado_id, fecha, hora_inicio, hora_fin);
if (conflicto) {
  return res.status(409).json({
    error: 'Conflicto de horario',
    mensaje: `El profesional ya tiene un turno de ${conflicto.hora_inicio} a ${conflicto.hora_fin}`,
    turno_conflicto: conflicto.id
  });
}
```

En la función de MODIFICAR turno (PUT), agregar lo mismo pero excluyendo el turno actual:

```javascript
const conflicto = await verificarSolapamiento(empleado_id, fecha, hora_inicio, hora_fin, id);
if (conflicto) {
  return res.status(409).json({
    error: 'Conflicto de horario',
    mensaje: `El profesional ya tiene un turno de ${conflicto.hora_inicio} a ${conflicto.hora_fin}`
  });
}
```

### También agregar: validación de fecha no pasada (RN-006)

```javascript
// En POST y PUT de turnos
const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
if (fecha < hoy) {
  return res.status(400).json({ 
    error: 'No se pueden crear turnos para fechas anteriores a hoy' 
  });
}
```

### Verificación para la demo

1. Crear turno para empleado X el día 30/4 de 10:00 a 10:30 ✅
2. Intentar crear otro turno para el MISMO empleado el 30/4 de 10:15 a 10:45 ❌ (debe rechazar con "Conflicto de horario")
3. Crear turno para OTRO empleado el 30/4 de 10:15 a 10:45 ✅ (no hay conflicto)
4. Mostrar en la agenda que ambos turnos aparecen simultáneamente (ya funciona en el frontend según Cursor)

---

## PASO 3 — Verificar que la agenda muestre turnos simultáneos (30 min)

Según el diagnóstico de Cursor, `agenda.js` ya tiene lógica de superposición visual. Solo necesitás verificar:

1. Que al cargar la agenda con GET /api/v1/turnos/detalles, los turnos de DISTINTOS empleados al mismo horario se muestren lado a lado.
2. Si la agenda filtra por empleado, que al ver "todos" se vean los solapamientos.

Si la visualización ya funciona, no toques nada. Solo probalo con datos reales para la demo.

### Datos de prueba sugeridos para la demo

Crear 3-4 turnos para el mismo día:
- Empleado A: 10:00-10:30 (Corte de pelo) — estado pendiente
- Empleado B: 10:00-11:00 (Corte + Barba) — estado confirmado  
- Empleado A: 11:00-11:30 (Corte de pelo) — estado completado
- Intentar crear Empleado A: 10:15-10:45 → debe RECHAZAR por conflicto

Así demostrás las tres cosas que pide el profesor en una sola secuencia.

---

## PASO 4 — Validación de empleado activo al crear turno (15 min)

### Archivo: `BACKEND/modulos/turnos/controlador.turno.mjs`

Agregar en POST y PUT:

```javascript
// Verificar que el empleado esté activo
const empleado = await supabaseAdmin
  .from('empleados')
  .select('id, activo')
  .eq('id', empleado_id)
  .single();

if (!empleado.data || !empleado.data.activo) {
  return res.status(400).json({ 
    error: 'El profesional seleccionado no está activo' 
  });
}
```

---

## RESUMEN BLOQUE 1 — Checklist para mañana

```
[ ] Paso 1: Máquina de estados (TRANSICIONES_VALIDAS + bloqueo estados finales)
[ ] Paso 2: Anti-solapamiento (verificarSolapamiento en POST y PUT)
[ ] Paso 2b: Validación fecha no pasada
[ ] Paso 3: Verificar agenda visual con turnos simultáneos
[ ] Paso 4: Validar empleado activo
[ ] Crear datos de prueba para la demo
[ ] Probar todo el flujo completo una vez
```

Tiempo estimado total: 3-5 horas de trabajo enfocado.

---
---

# ═══════════════════════════════════════════════════════════
# BLOQUE 2: POST-DEMO (desarrollo completo)
# ═══════════════════════════════════════════════════════════

Orden de ejecución priorizado por dependencias lógicas.

---

## FASE 1: BASE DE DATOS — Tablas y columnas nuevas en Supabase

### 1.1 Tabla `usuarios` (para autenticación real)

```sql
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('administrador', 'empleado')),
  activo BOOLEAN DEFAULT true,
  empleado_id INTEGER REFERENCES empleados(id),
  reset_token_hash VARCHAR(255),
  reset_token_expires_at TIMESTAMP WITH TIME ZONE,
  ultimo_login TIMESTAMP WITH TIME ZONE,
  creado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  modificado TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 1.2 Tabla `pagos`

```sql
CREATE TABLE pagos (
  id SERIAL PRIMARY KEY,
  turno_id INTEGER REFERENCES turnos(id) NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  metodo_pago VARCHAR(50) NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta')),
  registrado_por INTEGER REFERENCES usuarios(id),
  creado TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 1.3 Tabla `logs_auditoria`

```sql
CREATE TABLE logs_auditoria (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  rol VARCHAR(20),
  accion VARCHAR(50) NOT NULL,
  entidad VARCHAR(50) NOT NULL,
  entidad_id INTEGER,
  detalle JSONB,
  ip VARCHAR(45),
  creado TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para consultas frecuentes
CREATE INDEX idx_logs_entidad ON logs_auditoria(entidad, entidad_id);
CREATE INDEX idx_logs_fecha ON logs_auditoria(creado);
```

### 1.4 Columnas nuevas en tablas existentes

```sql
-- Agregar email a clientes (para notificaciones futuras)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Agregar campo de estado a empleados si no existe
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS estado_id INTEGER;

-- Agregar campo metodo_pago a turnos (alternativa simple sin tabla pagos)
-- SOLO si decidís no crear tabla pagos separada:
-- ALTER TABLE turnos ADD COLUMN metodo_pago VARCHAR(50);
-- ALTER TABLE turnos ADD COLUMN pago_registrado BOOLEAN DEFAULT false;
```

---

## FASE 2: SEGURIDAD — Autenticación real con JWT

### 2.1 Instalar dependencias

```bash
cd BACKEND
npm install jsonwebtoken bcryptjs
```

No usar `bcrypt` (requiere compilación nativa). Usar `bcryptjs` (JavaScript puro, funciona en Vercel sin problemas).

### 2.2 Crear módulo de autenticación

**Nuevo archivo: `BACKEND/modulos/auth/middleware.auth.mjs`**

```javascript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET; // Agregar en .env

export function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

export function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded; // { id, email, rol }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function soloAdmin(req, res, next) {
  if (req.usuario.rol !== 'administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol administrador.' });
  }
  next();
}
```

### 2.3 Crear módulo de usuarios (backend)

**Nuevos archivos:**
- `BACKEND/modulos/usuarios/rutas.usuario.mjs`
- `BACKEND/modulos/usuarios/controlador.usuario.mjs`
- `BACKEND/modulos/usuarios/modelo.usuario.mjs`

Endpoints:
```
POST   /api/v1/auth/login           → Login (devuelve JWT)
POST   /api/v1/auth/recuperar       → Solicitar reset de contraseña
POST   /api/v1/auth/restablecer     → Restablecer contraseña con token
GET    /api/v1/usuarios             → Listar usuarios (solo admin)
POST   /api/v1/usuarios             → Crear usuario (solo admin)
PUT    /api/v1/usuarios/:id         → Modificar usuario (solo admin)
DELETE /api/v1/usuarios/:id         → Eliminar usuario (solo admin)
```

### 2.4 Aplicar middleware a rutas protegidas

**Archivo: `BACKEND/index.mjs`**

```javascript
import { verificarToken, soloAdmin } from './modulos/auth/middleware.auth.mjs';

// Rutas públicas (sin token)
app.use('/api/v1/auth', rutasAuth);

// Rutas de la web pública (sin token)
// GET servicios, GET empleados por servicio, GET horarios disponibles, POST turnos

// Rutas protegidas (requieren token)
app.use('/api/v1/turnos', verificarToken, rutasTurno);
app.use('/api/v1/clientes', verificarToken, rutasCliente);
app.use('/api/v1/usuarios', verificarToken, soloAdmin, rutasUsuario);

// Excepción: POST /api/v1/turnos desde la web pública
// Para esto, crear una ruta separada /api/v1/reservas que NO requiera token
```

### 2.5 CORS — Restringir orígenes

**Archivo: `BACKEND/index.mjs`**

```javascript
const corsOptions = {
  origin: [
    'https://eleve-barberia.vercel.app',    // PaginaWeb
    'https://eleve-dashboard.vercel.app',    // Dashboard
    'http://localhost:5500',                  // Dev local
    'http://127.0.0.1:5500'                  // Dev local
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
```

---

## FASE 3: RECUPERACIÓN DE CONTRASEÑA — Servicio de email

### Servicio recomendado: Resend

Resend es la opción más simple para tu caso:
- Plan gratuito: 100 emails/día (más que suficiente para una barbería).
- SDK para Node.js muy simple.
- No requiere configurar servidor SMTP.
- Se integra en 10 minutos.

### 3.1 Instalar

```bash
npm install resend
```

### 3.2 Configurar

Agregar en `.env`:
```
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=noreply@tudominio.com
FRONTEND_URL=https://eleve-dashboard.vercel.app
```

### 3.3 Flujo en el controlador

```javascript
import { Resend } from 'resend';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/v1/auth/recuperar
export async function solicitarRecuperacion(req, res) {
  const { email } = req.body;
  
  // Buscar usuario por email
  const usuario = await buscarUsuarioPorEmail(email);
  
  // SEGURIDAD: siempre responder lo mismo (no revelar si existe o no)
  if (!usuario) {
    return res.json({ mensaje: 'Si el correo está registrado, recibirá un enlace.' });
  }

  // Generar token aleatorio
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(token, 10);
  const expiracion = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

  // Guardar en BD
  await actualizarTokenReset(usuario.id, tokenHash, expiracion);

  // Enviar email
  const enlace = `${process.env.FRONTEND_URL}/restablecer.html?token=${token}&id=${usuario.id}`;
  
  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Restablecer contraseña — Elevé Barbería',
    html: `
      <p>Hola ${usuario.nombre},</p>
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p><a href="${enlace}">Hacé clic aquí para crear una nueva contraseña</a></p>
      <p>Este enlace expira en 30 minutos.</p>
      <p>Si no solicitaste este cambio, ignorá este correo.</p>
    `
  });

  return res.json({ mensaje: 'Si el correo está registrado, recibirá un enlace.' });
}
```

---

## FASE 4: LOGS DE AUDITORÍA — Implementación limpia

### 4.1 Crear helper de auditoría

**Nuevo archivo: `BACKEND/modulos/auditoria/logger.mjs`**

```javascript
import { supabaseAdmin } from '../../db/supabaseClient.mjs';

export async function registrarLog({ usuario_id, rol, accion, entidad, entidad_id, detalle, ip }) {
  try {
    await supabaseAdmin.from('logs_auditoria').insert({
      usuario_id,
      rol,
      accion,
      entidad,
      entidad_id,
      detalle: detalle ? JSON.stringify(detalle) : null,
      ip
    });
  } catch (err) {
    // El log nunca debe romper la operación principal
    console.error('Error al registrar log de auditoría:', err);
  }
}
```

### 4.2 Usar en los controladores

Después de cada operación exitosa de escritura:

```javascript
// Ejemplo en controlador.turno.mjs, después de crear un turno
await registrarLog({
  usuario_id: req.usuario?.id || null,
  rol: req.usuario?.rol || 'cliente_web',
  accion: 'crear',
  entidad: 'turno',
  entidad_id: turnoCreado.id,
  detalle: { servicio_id, empleado_id, fecha, hora_inicio },
  ip: req.ip
});
```

Esto es no invasivo: una línea por operación, fire-and-forget (el try/catch interno evita que un fallo en el log rompa la operación principal).

---

## FASE 5: ENDPOINTS FALTANTES — ABM completo

### 5.1 Servicios (faltan POST, PUT, DELETE en backend)

**Archivo: `BACKEND/modulos/servicios/rutas.servicio.mjs`**

Agregar:
```
POST   /api/v1/servicios         → Crear servicio
PUT    /api/v1/servicios/:id     → Modificar servicio
DELETE /api/v1/servicios/:id     → Eliminar servicio (soft delete: activo=false)
```

### 5.2 Empleados (faltan POST, PUT, DELETE en backend)

**Archivo: `BACKEND/modulos/empleados/rutas.empleado.mjs`**

Agregar:
```
POST   /api/v1/empleados         → Crear empleado
PUT    /api/v1/empleados/:id     → Modificar empleado
DELETE /api/v1/empleados/:id     → Eliminar empleado (soft delete: activo=false)
```

Nota: POST /empleados ya existe parcialmente. Verificar que haga insert real en Supabase.

### 5.3 Pagos

**Nuevos archivos:** `BACKEND/modulos/pagos/rutas.pago.mjs`, controlador, modelo.

```
POST   /api/v1/pagos             → Registrar pago (vinculado a turno_id)
GET    /api/v1/pagos             → Listar pagos (para reportes)
```

### 5.4 Endpoint de indicadores para Dashboard

**Nuevo archivo: `BACKEND/modulos/dashboard/rutas.dashboard.mjs`**

```
GET /api/v1/dashboard/indicadores?desde=2026-04-01&hasta=2026-04-30
```

Respuesta esperada:

```json
{
  "ingresos_totales": 45000,
  "turnos_completados": 120,
  "tasa_ocupacion": 0.73,
  "clientes_nuevos": 15,
  "tasa_fidelidad": 0.62,
  "tasa_cancelacion": 0.08,
  "servicios_populares": [
    { "servicio": "Corte de pelo", "cantidad": 80 },
    { "servicio": "Barba", "cantidad": 30 }
  ],
  "rendimiento_empleados": [
    { "empleado": "Carlos", "turnos": 45, "ingresos": 18000 }
  ],
  "horas_pico": [
    { "hora": "10:00", "cantidad": 25 },
    { "hora": "17:00", "cantidad": 22 }
  ]
}
```

Todas estas queries se resuelven con consultas a la tabla `turnos` (joinando servicios, empleados, clientes). No necesitás tablas nuevas para los indicadores.

---

## FASE 6: FRONTEND — Conectar UI con API real

### 6.1 Dashboard — Eliminar dependencia de localStorage/demo

**Archivos a modificar:**
- `js/servicios.js` → Reemplazar llamadas a `db.js` por `api.js` (fetch a backend real)
- `js/empleados.js` → Ídem
- `js/usuarios.js` → Ídem (apuntar a nuevos endpoints /api/v1/usuarios)
- `js/finanzas.js` → Reemplazar datos simulados por fetch a /api/v1/dashboard/indicadores
- `js/auth.js` → Reemplazar login demo por POST /api/v1/auth/login (guardar JWT en sessionStorage)
- `js/api.js` → Agregar header Authorization: Bearer {token} en todas las peticiones

### 6.2 Dashboard — Agregar token JWT a las peticiones

En `js/api.js`, modificar la función base de fetch:

```javascript
function getHeaders() {
  const token = sessionStorage.getItem('jwt_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}
```

### 6.3 PaginaWeb/Reservas — No requiere cambios significativos

La web pública ya funciona contra la API real para reservas. Solo verificar que el flujo de reserva siga funcionando después de proteger las rutas (las rutas públicas de servicios, empleados por servicio, horarios disponibles y creación de turno deben quedar SIN middleware de auth).

---

## FASE 7: LIMPIEZA

- Eliminar `BACKEND/modulos/modelo.mjs`, `controlador.mjs`, `rutas.mjs` (legado).
- Limpiar código comentado en los módulos de turnos.
- Eliminar `BACKEND/.env` del repositorio si está commiteado (riesgo de seguridad crítico).
  ```bash
  git rm --cached BACKEND/.env
  echo "BACKEND/.env" >> .gitignore
  ```

---

# ═══════════════════════════════════════════════════════════
# ORDEN DE EJECUCIÓN COMPLETO (post-demo)
# ═══════════════════════════════════════════════════════════

```
PRIORIDAD MÁXIMA (demo 29/4):
  [1] Máquina de estados de turno en backend
  [2] Anti-solapamiento en POST/PUT turnos
  [3] Validación fecha no pasada
  [4] Verificar agenda visual con datos reales
  [5] Crear datos de prueba para la demo

POST-DEMO — Semana 1 (BD + Auth):
  [6]  Crear tablas en Supabase (usuarios, pagos, logs_auditoria)
  [7]  Instalar bcryptjs + jsonwebtoken
  [8]  Crear módulo auth (login, middleware, roles)
  [9]  Crear módulo usuarios (CRUD backend)
  [10] Aplicar middleware a rutas protegidas
  [11] Restringir CORS a dominios reales

POST-DEMO — Semana 2 (ABM + Dashboard real):
  [12] Completar endpoints ABM servicios (POST/PUT/DELETE)
  [13] Completar endpoints ABM empleados (POST/PUT/DELETE)
  [14] Crear módulo pagos (endpoint + tabla)
  [15] Crear endpoint /dashboard/indicadores con queries reales
  [16] Conectar frontend Dashboard con API real (eliminar localStorage)
  [17] Conectar finanzas.js con endpoint de indicadores

POST-DEMO — Semana 3 (Seguridad avanzada + Auditoría):
  [18] Implementar recuperación de contraseña (Resend + endpoint)
  [19] Crear página restablecer.html en Dashboard
  [20] Implementar logger de auditoría
  [21] Agregar logs en todos los controladores
  [22] Limpieza de código legado

POST-DEMO — Semana 4 (Cierre):
  [23] Testing completo de flujos
  [24] Verificar que todo lo documentado en la tesis está implementado
  [25] Deploy final en Vercel
```

---

# NOTAS FINALES

**Sobre el .env expuesto:** Si el archivo BACKEND/.env está commiteado en el
repositorio (según Cursor lo detectó), rotá las claves de Supabase lo antes
posible. Andá al panel de Supabase → Settings → API → regenerá la Service
Role Key, y actualizá el .env en Vercel. Esto es urgente independientemente
de la demo.

**Sobre Resend vs otras opciones:** Resend es la opción más rápida. Si
preferís otra, las alternativas viables son: Nodemailer con Gmail (gratis pero
requiere configurar App Password de Google, es más frágil), o SendGrid
(plan gratis de 100 emails/día, SDK similar a Resend). Cualquiera de las tres
funciona. Resend tiene la API más simple.

**Sobre la demo de mañana:** Solo necesitás el Bloque 1. Son cambios
exclusivamente en el backend (controlador.turno.mjs y modelo.turno.mjs).
No toques el frontend, no toques la base de datos, no toques la
autenticación. Hacé SOLO los pasos 1-4, probá, y andá a la demo tranquilo.