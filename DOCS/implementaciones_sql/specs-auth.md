# Especificaciones Técnicas — Autenticación y Roles (feat/auth)

---

## Decisión arquitectónica: JWT propio vs Supabase Auth

**Decisión: JWT propio con `bcryptjs` + `jsonwebtoken`.**

| Criterio | Supabase Auth nativo | JWT propio |
|---|---|---|
| Roles en 2 niveles (admin/empleado) | Requiere `app_metadata` + RLS por tabla | Campo `rol` directo en el token |
| Control del payload del JWT | Limitado (Supabase define el formato) | Total — incluís `id`, `email`, `rol` |
| Integración con Express actual | Requiere refactor hacia `supabase.auth.*` | Se añade como middleware sin tocar rutas existentes |
| Recuperación de contraseña | Incluida | Se implementa con Resend (ya documentado en plan-accion) |
| Dependencia de vendor | Alta (si Supabase Auth cambia, rompés el sistema) | Ninguna — portable a cualquier BD |
| Complejidad para este caso | Sobredimensionada | Exactamente la necesaria |

**Por qué no Supabase Auth:** con dos roles fijos y un backend Express ya funcionando, Supabase Auth añade una identidad dividida (`auth.users` + `public.usuarios`) sin aportar nada que no resuelva un middleware de 20 líneas. El JWT propio mantiene el rol en el token y el backend lo verifica en microsegundos sin tocar la base de datos.

---

## 1. Prerequisitos

### 1.1 Variables de entorno — agregar a `BACKEND/.env`

```env
JWT_SECRET=una_cadena_aleatoria_larga_minimo_32_caracteres
JWT_EXPIRES_IN=8h
```

Generar un secreto seguro:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 1.2 Dependencias — ejecutar en `BACKEND/`

```bash
npm install jsonwebtoken bcryptjs
```

> Usar `bcryptjs` (JavaScript puro), NO `bcrypt` (requiere compilación nativa y falla en Vercel).

### 1.3 Script SQL

Ejecutar `auth_pagos_auditoria.sql` en el SQL Editor de Supabase antes de cualquier desarrollo backend.

---

## 2. Estructura de archivos a crear

```
BACKEND/
└── modulos/
    ├── auth/
    │   └── middleware.auth.mjs       ← YA EXISTE VACÍO — completar
    └── usuarios/
        ├── modelo.usuario.mjs        ← CREAR
        ├── controlador.usuario.mjs   ← CREAR
        └── rutas.usuario.mjs         ← CREAR
```

---

## 3. Archivo: `middleware.auth.mjs`

```javascript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

export function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.usuario = jwt.verify(token, JWT_SECRET); // { id, email, rol }
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function soloAdmin(req, res, next) {
  if (req.usuario?.rol !== 'administrador') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}
```

---

## 4. Archivo: `modelo.usuario.mjs`

```javascript
import { supabaseAdmin } from '../../db/supabaseClient.mjs';
import bcrypt from 'bcryptjs';

export async function buscarPorEmail(email) {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, email, password_hash, nombre, rol, activo')
    .eq('email', email)
    .single();
  if (error) return null;
  return data;
}

export async function verificarPassword(passwordPlano, hash) {
  return bcrypt.compare(passwordPlano, hash);
}

export async function obtenerUsuarios() {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, email, nombre, rol, activo, creado, ultimo_login')
    .order('creado', { ascending: false });
  if (error) throw error;
  return data;
}

export async function crearUsuario({ email, password, nombre, rol, empleado_id }) {
  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .insert({ email, password_hash, nombre, rol, empleado_id: empleado_id || null })
    .select('id, email, nombre, rol, activo')
    .single();
  if (error) throw error;
  return data;
}

export async function modificarUsuario(id, campos) {
  // Si viene una nueva contraseña, hashearla
  if (campos.password) {
    campos.password_hash = await bcrypt.hash(campos.password, 12);
    delete campos.password;
  }
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update(campos)
    .eq('id', id)
    .select('id, email, nombre, rol, activo')
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarUsuario(id) {
  // Soft delete: marcar como inactivo, no borrar físicamente
  const { error } = await supabaseAdmin
    .from('usuarios')
    .update({ activo: false })
    .eq('id', id);
  if (error) throw error;
}

export async function actualizarUltimoLogin(id) {
  await supabaseAdmin
    .from('usuarios')
    .update({ ultimo_login: new Date().toISOString() })
    .eq('id', id);
}
```

---

## 5. Archivo: `controlador.usuario.mjs`

```javascript
import { generarToken } from '../auth/middleware.auth.mjs';
import {
  buscarPorEmail, verificarPassword, actualizarUltimoLogin,
  obtenerUsuarios, crearUsuario, modificarUsuario, eliminarUsuario
} from './modelo.usuario.mjs';

// POST /api/v1/auth/login
export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const usuario = await buscarPorEmail(email);
  if (!usuario || !usuario.activo) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const passwordOk = await verificarPassword(password, usuario.password_hash);
  if (!passwordOk) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  await actualizarUltimoLogin(usuario.id);

  const token = generarToken(usuario);
  return res.json({
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
  });
}

// GET /api/v1/usuarios — solo admin
export async function listarUsuarios(req, res) {
  try {
    const usuarios = await obtenerUsuarios();
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
}

// POST /api/v1/usuarios — solo admin
export async function agregarUsuario(req, res) {
  const { email, password, nombre, rol, empleado_id } = req.body;
  if (!email || !password || !nombre || !rol) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  try {
    const nuevo = await crearUsuario({ email, password, nombre, rol, empleado_id });
    res.status(201).json(nuevo);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
}

// PUT /api/v1/usuarios/:id — solo admin
export async function editarUsuario(req, res) {
  const { id } = req.params;
  try {
    const actualizado = await modificarUsuario(id, req.body);
    res.json(actualizado);
  } catch {
    res.status(500).json({ error: 'Error al modificar usuario' });
  }
}

// DELETE /api/v1/usuarios/:id — solo admin
export async function borrarUsuario(req, res) {
  const { id } = req.params;
  // No permitir que un admin se elimine a sí mismo
  if (parseInt(id) === req.usuario.id) {
    return res.status(400).json({ error: 'No podés desactivar tu propia cuenta' });
  }
  try {
    await eliminarUsuario(id);
    res.json({ mensaje: 'Usuario desactivado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
}
```

---

## 6. Archivo: `rutas.usuario.mjs`

```javascript
import { Router } from 'express';
import { login, listarUsuarios, agregarUsuario, editarUsuario, borrarUsuario } from './controlador.usuario.mjs';
import { verificarToken, soloAdmin } from '../auth/middleware.auth.mjs';

const router = Router();

// Ruta pública
router.post('/api/v1/auth/login', login);

// Rutas protegidas — solo administrador
router.get   ('/api/v1/usuarios',     verificarToken, soloAdmin, listarUsuarios);
router.post  ('/api/v1/usuarios',     verificarToken, soloAdmin, agregarUsuario);
router.put   ('/api/v1/usuarios/:id', verificarToken, soloAdmin, editarUsuario);
router.delete('/api/v1/usuarios/:id', verificarToken, soloAdmin, borrarUsuario);

export default router;
```

---

## 7. Modificar `BACKEND/index.mjs`

Agregar la importación y el uso de las nuevas rutas. También restringir CORS.

```javascript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import rutasApiTurnos    from './modulos/turnos/rutas.turno.mjs';
import rutasApiServicios from './modulos/servicios/rutas.servicio.mjs';
import rutasApiEmpleados from './modulos/empleados/rutas.empleado.mjs';
import rutasApiCliente   from './modulos/clientes/rutas.cliente.mjs';
import rutasUsuarios     from './modulos/usuarios/rutas.usuario.mjs';  // NUEVO

const app = express();

// CORS restringido a dominios reales
const corsOptions = {
  origin: [
    'https://eleve-barberia-xi.vercel.app',
    'https://eleve-dashboard.vercel.app',   // ajustar al dominio real del dashboard
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas de la API
app.use(rutasApiTurnos);
app.use(rutasApiServicios);
app.use(rutasApiEmpleados);
app.use(rutasApiCliente);
app.use(rutasUsuarios);   // NUEVO

export default app;

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

> **Nota sobre rutas públicas de turnos:** si el POST `/api/v1/turnos` (reserva desde la web pública) necesita funcionar sin token, creá una ruta separada `/api/v1/reservas` que no tenga `verificarToken`. No modifiques las rutas de turnos existentes hasta que el sistema de auth esté probado.

---

## 8. Cambios en el Frontend — `js/auth.js`

Reemplazar el bloque de login (líneas 101-118 del archivo actual) por un fetch al backend:

```javascript
// Reemplaza el bloque con localStorage
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email    = document.getElementById('login-usuario').value.trim();
  const password = inputPw ? inputPw.value : '';

  try {
    const res  = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      // Mostrar error
      if (errorDiv) {
        errorDiv.textContent = data.error || 'Credenciales inválidas';
        errorDiv.classList.add('visible');
      }
      return;
    }

    // Guardar token y datos de sesión
    sessionStorage.setItem('jwt_token', data.token);

    const sesionData = {
      usuario: data.usuario.email,
      nombre:  data.usuario.nombre,
      rol:     data.usuario.rol,                          // 'administrador' | 'empleado'
      modulos: MODULOS_POR_ROL[data.usuario.rol] || MODULOS_POR_ROL.empleado,
    };

    guardarSesion(sesionData);
    // ... resto del flujo de éxito (animación, aplicarPermisos, etc.)

  } catch {
    if (errorDiv) {
      errorDiv.textContent = 'Error de conexión con el servidor';
      errorDiv.classList.add('visible');
    }
  }
});
```

**Cambio en `MODULOS_POR_ROL`:** el rol que devuelve el backend es `'administrador'`, no `'admin'`. Actualizar la key:

```javascript
const MODULOS_POR_ROL = {
  administrador: ['agenda', 'financiero', 'clientes', 'servicios', 'empleados', 'usuarios'],
  empleado:      ['agenda', 'clientes'],
};
```

---

## 9. Cambios en el Frontend — `js/api.js`

Agregar el header `Authorization` a todas las peticiones del dashboard:

```javascript
function getHeaders() {
  const token = sessionStorage.getItem('jwt_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
}
```

Usar `getHeaders()` en cada fetch del módulo `api.js` (reemplazar `{ 'Content-Type': 'application/json' }` donde aparezca).

---

## 10. Orden de ejecución recomendado

```
[1]  Ejecutar schema_usuarios_roles.sql en Supabase SQL Editor
[2]  Generar el hash bcrypt del password admin y actualizar el INSERT
[3]  Agregar JWT_SECRET y JWT_EXPIRES_IN al .env del backend
[4]  npm install jsonwebtoken bcryptjs  (en BACKEND/)
[5]  Completar middleware.auth.mjs
[6]  Crear modelo.usuario.mjs
[7]  Crear controlador.usuario.mjs
[8]  Crear rutas.usuario.mjs
[9]  Modificar index.mjs (importar rutas, restringir CORS)
[10] Probar POST /api/v1/auth/login con curl o Postman → debe devolver JWT
[11] Probar GET /api/v1/usuarios sin token → debe devolver 401
[12] Probar GET /api/v1/usuarios con token de empleado → debe devolver 403
[13] Actualizar auth.js en el frontend (fetch al backend)
[14] Actualizar MODULOS_POR_ROL (cambiar 'admin' → 'administrador')
[15] Agregar getHeaders() con Authorization en api.js
[16] Probar flujo completo desde el navegador
```

---

## Confirmaciones finales (ver sección abajo del documento principal)

- **Arquitectura:** JWT propio — no Supabase Auth
- **Script SQL:** listo para copiar y pegar, con una excepción indicada en el paso 2 de la sección 10 (el hash bcrypt inicial debe generarse antes de ejecutar el INSERT)
