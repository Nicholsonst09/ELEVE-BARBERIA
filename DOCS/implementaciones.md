# Implementaciones — Sistema Elevé Barbería

Última revisión: 2026-07-09.

---

## 1. Máquina de estados de turnos

Un turno solo puede moverse entre estados de forma ordenada. No puede saltar pasos ni retroceder.

Estados reales usados en el código: `reservado`, `completado`, `cancelado`, `anulado`.

### Diferencia entre `cancelado` y `anulado`

| Estado | Quién lo genera | Motivo |
|---|---|---|
| `cancelado` | El cliente o el negocio | El turno existía correctamente pero no se va a realizar |
| `anulado` | Un admin | El turno fue creado por error y debe dejarse sin efecto |

Los turnos `anulados` **no se muestran en la agenda** ni cuentan en reportes de asistencia — son equivalentes a una eliminación lógica.

### Transiciones permitidas

```
reservado  → completado | cancelado | anulado
completado → (ninguna)
cancelado  → (ninguna)
anulado    → (ninguna)
```

`anulado` solo puede ser disparado por un usuario con rol admin/administrador — validado en el backend (`controlador.turno.mjs`, chequeo de `x-user-role` antes de aceptar la transición), no solo en el frontend.

### La lógica

**Backend — `BACKEND/modulos/turnos/controlador.turno.mjs`**

```js
const TRANSICIONES_VALIDAS = {
  'reservado':  ['completado', 'cancelado', 'anulado'],
  'completado': [],
  'cancelado':  [],
  'anulado':    []
};

function validarTransicionEstado(estadoActual, estadoNuevo) {
  if (estadoActual === estadoNuevo) return true;
  return (TRANSICIONES_VALIDAS[estadoActual] || []).includes(estadoNuevo);
}
```

Se ejecuta en cada `PUT /turnos/:id`. Si la transición no es válida o el turno ya está en estado final → `400 Bad Request`. Si se intenta `anulado` sin rol admin → `403 Forbidden`.

**Frontend — `FRONTEND/Dashboard/js/agenda.js`**

Mismo mapa de transiciones. Se usa para:
- Filtrar la agenda: `estado.turnos.filter(t => t.estado !== 'cancelado' && t.estado !== 'anulado')` — ambos estados quedan afuera de la vista.
- Validar antes de guardar y mostrar notificación si la transición no es válida.

---

## 2. Anti-solapamiento de turnos

Antes de crear o modificar un turno, el backend verifica que el profesional no tenga otro turno que se superponga en el mismo horario.

### La lógica

**Backend — `BACKEND/modulos/turnos/modelo.turno.mjs`, función `verificarSolapamiento`**

Busca turnos del mismo empleado en la misma fecha, excluye `cancelado` y `anulado` (filtrado en JS sobre el resultado, no en la query SQL — más confiable que filtrar por FK en PostgREST), y detecta conflicto si `hora_inicio < fin_otro && hora_fin > inicio_otro`. Al modificar un turno existente, se excluye a sí mismo de la búsqueda.

**Backend — `controlador.turno.mjs`**

Se aplica en `POST /turnos` y `PUT /turnos/:id`:
- Si hay conflicto → `409 Conflict` con mensaje indicando el horario que choca.
- Si la fecha es anterior a hoy → `400 Bad Request`.
- Si la fecha es hoy y (viene de la web pública) la hora está a menos de 30 min de la hora actual → `400 Bad Request`. Desde el Dashboard (`origen: 'admin'`) no aplica ese mínimo de anticipación.

### Comportamiento

| Caso | Resultado |
|---|---|
| Mismo empleado, mismo horario | `409` — conflicto de horario |
| Mismo empleado, horario parcialmente superpuesto | `409` — conflicto de horario |
| Distinto empleado, mismo horario | `201` ✅ — permitido |
| Mismo empleado, turno cancelado o anulado existente | `201` ✅ — no bloquean |
| Fecha anterior a hoy | `400` — fecha inválida |
| Hoy, reserva web con menos de 30 min de anticipación | `400` — requiere mínimo 30 min |

---

## 3. Validación de anticipación mínima en reservas (Frontend)

En la página de reservas pública, los horarios del día actual se filtran para que el cliente solo vea slots con anticipación mínima respecto a la hora actual (ver validación equivalente del lado backend en la sección 2).

---

## 4. Horarios de la barbería

Ya **no están hardcodeados en código** — se configuran dinámicamente desde el panel de Negocio y se persisten en la tabla `negocio_config` de Supabase (`BACKEND/modulos/negocio/modelo.negocio.mjs`, campo `horarios_por_dia`). El horario de cada empleado se valida contra este horario del negocio al guardarse.

---

## 5. Visualización de solapamientos en agenda (Dashboard)

Cuando hay múltiples turnos simultáneos en el mismo slot horario, la agenda los muestra en columnas paralelas dentro de ese bloque. El nombre del profesional se adapta al espacio disponible:

- **1 a 4 turnos simultáneos**: muestra el primer nombre (`Carlos`, `Lucas`).
- **5 o más turnos simultáneos**: muestra solo la inicial con punto (`C.`, `L.`).

### Dónde vive la lógica

**Frontend — `FRONTEND/Dashboard/js/agenda.js`**

```js
// Cálculo de columnas
const anchoColumna = 100 / turno.totalColumnas;
tarjeta.style.width = `calc(${anchoColumna}% - 8px)`;
tarjeta.style.left = `${anchoColumna * turno.columna}%`;

// Nombre adaptativo
turno.totalColumnas > 4
  ? turno.nombre_empleado.charAt(0).toUpperCase() + '.'
  : turno.nombre_empleado.split(' ')[0]
```
