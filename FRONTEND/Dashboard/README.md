# ELEVÉ Barbería — Dashboard: Arquitectura Frontend

## 1. Estructura de archivos

```
Dashboard/
├── index.html       # SPA: contiene todos los paneles y el overlay de login
├── style.css        # Sistema de diseño (variables CSS, secciones 1-18)
└── js/
    ├── main.js      # Punto de entrada: imports, bootstrapping, listeners
    ├── estado.js    # Estado global mutable
    ├── auth.js      # Login, sesión (sessionStorage) y permisos por rol
    ├── ui.js        # UI pura: switchTab, updateStats, modales
    ├── api.js       # Llamadas fetch al backend
    ├── utilidades.js# Toasts, confirmarAccion, helpers
    ├── agenda.js / finanzas.js / clientes.js / servicios.js
    ├── empleados.js / usuarios.js   # Módulos ABM
```

---

## 2. Sistema de pestañas (renderizado de módulos)

Es una SPA sin router. Todos los módulos existen en el DOM como `<section class="contenido-pestana">`.
Solo el que tiene la clase `activo` es visible (el resto tiene `display: none` por CSS).

```html
<!-- sidebar -->
<button class="boton-navegacion" data-tab="clientes">Clientes</button>

<!-- panel -->
<section id="clientes" class="contenido-pestana"> ... </section>
```

El `data-tab` del botón debe coincidir con el `id` del panel.  
Al hacer clic, `main.js` llama a `ui.switchTab(tabId)`, que quita/agrega la clase `activo` en botones y paneles.

Cada módulo expone `inicializar*()` (registra listeners y renderizado inicial).
Se invocan al final de `setupPrincipalEventListeners()` en `main.js`, cuando el DOM ya está listo.

---

## 3. Autenticación (demo)

> Credenciales hardcodeadas en `auth.js`. Solo para desarrollo — no apto para producción.

**Flujo:**

```
DOMContentLoaded → inicializarAuth()
   ├── sessionStorage tiene sesión?
   │     SÍ → ocultar overlay → aplicar permisos → mostrar usuario en header
   │     NO → mostrar overlay de login
   └── registrar listeners de form y logout (siempre)
```

El overlay (`#login-overlay`) cubre toda la pantalla con `position: fixed; z-index: 9999`.
Se muestra/oculta con la clase `activo`. Al hacer login exitoso se anima con la clase `saliendo` antes de ocultarse.

La sesión se guarda en `sessionStorage` (se borra al cerrar la pestaña):
```js
{ usuario, nombre, rol, modulos: ['agenda', 'clientes', ...] }
```

| Usuario    | Contraseña    | Módulos accesibles                                            |
|------------|---------------|---------------------------------------------------------------|
| `admin`    | `admin123`    | agenda, financiero, clientes, servicios, empleados, usuarios  |
| `empleado` | `empleado123` | agenda, clientes                                              |

**Control por rol:** `_aplicarPermisos(sesion)` recorre todos los `.boton-navegacion[data-tab]`
y hace `display: none` en los que no están en `sesion.modulos`. Los paneles siguen en el DOM
(solo se ocultan los botones). Para producción, validar también en el backend.

---

## 4. Migración a JWT — próximos pasos

| #  | Qué hacer | Archivo |
|----|-----------|---------|
| 1  | Crear `POST /api/auth/login` → valida en BD, devuelve `{ token, usuario }` | `BACKEND/modulos/auth/` |
| 2  | En `_setupLoginForm()`: reemplazar la búsqueda en `USUARIOS_DEMO` por un `fetch` al endpoint | `js/auth.js` |
| 3  | Guardar el JWT: `sessionStorage.setItem('eleve_jwt', token)` | `js/auth.js` |
| 4  | En `api.js`: agregar `Authorization: Bearer <token>` en cada request | `js/api.js` |
| 5  | Leer `modulos` del payload del JWT (`atob(token.split('.')[1])`) en lugar del sessionStorage | `js/auth.js` |
| 6  | Chequear `claims.exp` al cargar la sesión; si venció → `cerrarSesion()` | `js/auth.js` |
| 7  | Aplicar `middlewareAuth` (ya existe) a todas las rutas protegidas del backend | `BACKEND/modulos/auth/middleware.auth.mjs` |

```
Login exitoso con JWT:
  fetch POST /api/auth/login
       ↓
  guardar token en sessionStorage
  _ocultarOverlay() → _aplicarPermisos()
       ↓
  Cada fetch a /api/* lleva Authorization: Bearer <token>
  El backend verifica firma + exp antes de responder
```
