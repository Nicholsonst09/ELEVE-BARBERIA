# ELEVÉ Barbería — Dashboard: Arquitectura Frontend

## 1. Estructura de archivos

```
Dashboard/
├── index.html       # SPA del panel: todos los módulos (requiere sesión)
├── login.html       # Página de login independiente (sin sesión)
├── style.css        # Sistema de diseño (variables CSS, secciones 1-18)
└── js/
    ├── main.js      # Punto de entrada del panel: imports, bootstrapping, listeners
    ├── login.js     # Lógica del formulario de login.html (login + recuperar contraseña)
    ├── estado.js    # Estado global mutable
    ├── auth.js      # Sesión (sessionStorage), validación contra backend y permisos por rol
    ├── ui.js        # UI pura: switchTab, updateStats, modales
    ├── api.js       # Llamadas fetch al backend
    ├── utilidades.js# Toasts, confirmarAccion, helpers
    ├── agenda.js / finanzas.js / clientes.js / servicios.js
    ├── empleados.js / usuarios.js   # Módulos ABM completos
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

## 3. Autenticación

**Login y panel viven en páginas HTML separadas** (`login.html` / `index.html`) para que el
backoffice nunca llegue a pintarse en el navegador de alguien sin sesión — antes, con el login
como overlay dentro de `index.html`, había una ventana de tiempo (mientras cargaban los módulos
JS) en la que se alcanzaba a ver el panel de fondo.

**Flujo:**

```
index.html (<head>, script síncrono, antes de cualquier otro recurso)
   └── ¿sessionStorage tiene accessToken?
         NO  → location.replace('login.html')  (nunca se llega a pintar el panel)
         SÍ  → continúa cargando la página

DOMContentLoaded (main.js) → inicializarAuth()  [js/auth.js]
   ├── valida el accessToken contra el backend (GET /auth/me)
   │     inválido → limpia sessionStorage → location.replace('login.html')
   │     válido   → aplica permisos → muestra usuario en header
   └── registra el listener de logout

login.html (<head>, script síncrono)
   └── ¿ya hay sesión guardada? → location.replace('index.html')

DOMContentLoaded (js/login.js) → registra el form de login y el flujo de recuperar contraseña
```

La sesión se guarda en `sessionStorage` (se borra al cerrar la pestaña):
```js
{ usuario, nombre, rol, modulos: ['agenda', 'clientes', ...] }
```

Login y recuperación de contraseña se validan contra el backend (`POST /auth/login`,
`POST /auth/recover`, `POST /auth/reset-password`) — no hay credenciales hardcodeadas en el
frontend. `login.js` guarda `{ usuario, nombre, rol, modulos, accessToken, refreshToken, ... }`
con el `accessToken` que devuelve el backend.

**Control por rol:** `_aplicarPermisos(sesion)` recorre todos los `.boton-navegacion[data-tab]`
y hace `display: none` en los que no están en `sesion.modulos`. Los paneles siguen en el DOM
(solo se ocultan los botones). El backend también debe validar el rol en cada endpoint protegido
(`middlewareAuth` en `BACKEND/modulos/auth/middleware.auth.mjs`).
