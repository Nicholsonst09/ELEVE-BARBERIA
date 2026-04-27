# Deploy — Elevé Barbería

## Contexto actual

El sistema está funcionando en este momento porque el frontend apunta a las rutas de un backend que fue subido previamente como parte de una **demo (demo-2)** del proyecto. Ese backend es temporal y no es el de este repositorio.

---

## Qué hay que hacer

Hay que realizar el deploy completo del proyecto en **dos partes independientes**, ambas dentro de este mismo repositorio pero apuntando a carpetas raíz distintas:

### 1. Deploy del Backend

- Carpeta raíz: `BACKEND/`
- Una vez deployado, se obtiene la URL del servidor de este proyecto.

#### Variables de entorno (Backend)

Vercel permite importar un archivo `.env` directamente desde la configuración del proyecto. Las variables necesarias son:

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto en Supabase |
| `BASE_SERVICE_ROLE_KEY` | Service role key de Supabase |

> Sin estas variables el backend no puede conectarse a la base de datos.

### 2. Deploy del Frontend

- Carpeta raíz: `FRONTEND/`
- Una vez deployado el backend, hay que **actualizar todas las rutas del frontend** para que dejen de apuntar al backend de la demo y pasen a apuntar al backend de este proyecto.

---

## Pasos resumidos

1. Hacer deploy del `BACKEND/` desde `main` y copiar la URL generada.
3. Cargar las variables de entorno en Vercel (importar el `.env` o cargarlas manualmente).
4. Actualizar la URL del backend en `FRONTEND/Configuracion/config.js` → variable `API_BASE_URL`. **Es el único lugar que hay que cambiar**, todos los módulos del frontend la consumen desde ahí.
5. Hacer deploy del `FRONTEND/` con la ruta ya actualizada.

---

## Pendientes antes del deploy final

Estas funcionalidades deben estar completas antes de hacer el deploy definitivo:

### ABM completo desde el backend y la base de datos
- Completar los endpoints faltantes del backend para cada módulo (clientes, empleados, servicios, turnos).
- Crear las tablas necesarias en Supabase si aún no existen.

### Inicio de sesión con designación de rol
- Implementar el login con asignación de rol al usuario.
- Según el rol asignado, mostrar u ocultar los módulos correspondientes en el Dashboard.

### Integración de Resend para mails automáticos
- Adaptar el servicio de Resend para el envío de mails de confirmación de reserva.
- Se deben enviar **dos correos** por cada reserva confirmada:
  - Uno al **cliente** que reservó el turno.
  - Uno al **barbero / negocio** para notificar la nueva reserva.

### Nueva página de reservas
- Se reemplazó la página de reservas anterior por una nueva versión en `FRONTEND/Reservas/`.
- El nuevo diseño es más simple y resumido, manteniendo el mismo flujo de reserva pero con una interfaz más limpia.

### Transferencia del proyecto Supabase
- El proyecto de Supabase está actualmente vinculado a una cuenta personal de desarrollo.
- Hay que transferirlo (o recrearlo) bajo una cuenta de Gmail propia del proyecto antes del deploy final.
- Esto implica actualizar las variables de entorno `SUPABASE_URL` y `BASE_SERVICE_ROLE_KEY` con los nuevos valores del proyecto transferido.

---

## Notas

- Los dos deploys se hacen desde el **mismo repositorio**, solo cambia la carpeta raíz configurada en cada deploy.
- No deployar hasta tener los pendientes de arriba resueltos y todo mergeado a `main`.
