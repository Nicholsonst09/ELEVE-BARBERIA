# Elevé Barbería — Sistema Web de Reservas y Gestión

Aplicación web para una peluquería/barbería que permite a los clientes reservar turnos en línea y al equipo interno gestionar la agenda y la información relacionada mediante un panel administrativo.

---

## ¿Qué hace esta aplicación?

Ofrece un flujo de **reserva pública** (selección de servicio, profesional, fecha y hora) y un **dashboard de gestión** con agenda visual, estadísticas orientadas al negocio y herramientas para administrar clientes, servicios, empleados y usuarios del sistema según los permisos definidos por rol.

---

## Arquitectura general

- **Frontend:** aplicación multipágina construida con HTML, CSS y JavaScript modular (sin framework obligatorio evidente). Se comunica con el backend mediante `fetch` a una API REST.
- **Backend:** API REST desarrollada con **Node.js** y **Express**, orientada al despliegue serverless (**Vercel**). La persistencia y consultas contra base de datos se realizan mediante el cliente oficial de **Supabase**.

Las dos aplicaciones pueden desplegarse de forma independiente; la URL base de la API se configura en el frontend para apuntar al backend desplegado.

---

## Funcionalidades principales

### Reservas (clientes)
- Flujo guiado por pasos: servicio → profesional → fecha → horario → datos de contacto → confirmación.
- Integración con la API para listar servicios, empleados por servicio, horarios disponibles y creación del turno.

### Panel administrativo
- Agenda del día con vista por profesional u opción orientada a turnos pendientes.
- Gestión de clientes y estadísticas/resúmenes en el panel (según la versión de cada módulo, parte del contenido puede provenir de datos de demostración o almacenamiento local del navegador).
- Áreas diferenciadas para servicios, empleados, usuarios del sistema y análisis del negocio.

---

## Stack tecnológico

| Área | Tecnología |
|------|------------|
| Backend runtime | Node.js (módulos ES) |
| API | Express |
| Base de datos / BaaS | Supabase (cliente servidor con rol de servicio) |
| Despliegue backend | Vercel (configuración típica) |
| Frontend | HTML5, CSS3, JavaScript (módulos ES) |
| Entorno backend | Variables de entorno (p. ej. `dotenv`) |

---

## Estructura del repositorio (alto nivel)

```
ELEVE-BARBERIA/
├── BACKEND/                 # API REST, lógica de negocio, acceso a Supabase
│   ├── index.mjs            # Punto de entrada de la aplicación Express
│   ├── db/                  # Cliente Supabase
│   └── modulos/             # Rutas, controladores y modelos por dominio
├── FRONTEND/
│   ├── Configuracion/       # URLs y constantes compartidas (p. ej. API)
│   ├── Reservas/            # Página pública de reservas (HTML/CSS/JS)
│   └── Dashboard/           # Panel interno de gestión (HTML/CSS/JS)
├── DOCS/                    # Documentación adicional del proyecto
└── README.md
```

La raíz puede incluir archivos auxiliares (p. ej. locks de npm) según cómo mantenga cada equipo las dependencias.

---

## Requisitos previos

- **Node.js** (versión compatible con ES modules recomendada; ver documentación oficial de Node si hace falta fijar LTS).
- Cuenta y proyecto **Supabase** con las tablas y políticas configuradas para el modelo de datos esperado por el backend.

---

## Instalación rápida (backend)

1. Clonar o copiar el repositorio.

2. En la carpeta `BACKEND`:
   ```bash
   npm install
   ```

3. Configurar variables de entorno (por ejemplo mediante un archivo `.env` que no debe versionarse con secretos reales):

   | Variable típica | Uso |
   |-----------------|-----|
   | `SUPABASE_URL` | URL del proyecto Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo servidor; nunca en el navegador) |

4. Ajustar en el frontend la constante **`API_BASE_URL`** en `FRONTEND/Configuracion/config.js` para que apunte a la URL base de esta API desplegada (incluyendo prefijo `/api/v1` si así está definido en el proyecto).

---

## Cómo ejecutar el proyecto

### Backend

En `BACKEND` (consultar scripts en `package.json`):

```bash
npm run dev
```

Esto suele levantar el servidor en modo desarrollo con recarga ante cambios. El puerto y el modo (`listen` vs despliegue serverless) dependen de cómo ejecutes la app localmente vs en Vercel.

### Frontend

No es obligatorio un bundler único si la app sirve archivos estáticos. Opciones típicas:

- Abrir los `index.html` de `FRONTEND/Dashboard/` o `FRONTEND/Reservas/` con un servidor estático simple (por ejemplo `npx serve` o la extensión “Live Server” del editor), desde la carpeta **`FRONTEND`** o desde la carpeta específica, según rutas relativas definidas.

Mantén el mismo protocolo/host que use la política **CORS** del backend cuando pruebas en local.

---

## Comportamiento del backend / API

La API está organizada bajo rutas tipo **`/api/v1/...`** e incluye, entre otros, recursos coherentes con el dominio de la peluquería:

| Dominio orientativo | Ejemplos de uso |
|---------------------|-------------------|
| **Turnos** | Listado, alta, modificación, baja, consulta por id, vistas con detalle para agenda, disponibilidad de horarios por empleado, servicio y fecha. |
| **Servicios** | Listado, detalle por id, profesionales habilitados para un servicio. |
| **Empleados** | Listado y consulta por id. |
| **Clientes** | CRUD habitual y operación tipo “buscar por teléfono o crear” para agilizar reservas. |

Los detalles exactos de validaciones de negocio y permisos evolucionan con el proyecto; ante dudas, revisar los controladores y los modelos bajo `BACKEND/modulos/`.

---

## Personalización posterior

Este documento está pensado para ser ampliable: conviene enlazar políticas RLS en Supabase, credenciales de despliegue, guías específicas de la facultad en `DOCS/` y cualquier decisión de arquitectura que el equipo documente aparte del código.
