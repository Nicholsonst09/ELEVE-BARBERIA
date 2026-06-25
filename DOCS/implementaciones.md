# Implementaciones — Sistema Elevé Barbería

---

## 1. Máquina de estados de turnos

Un turno solo puede moverse entre estados de forma ordenada. No puede saltar pasos ni retroceder.

### Diferencia entre `cancelado` y `anulado`

| Estado | Quién lo genera | Motivo |
|---|---|---|
| `cancelado` | El cliente o el negocio | El turno existía correctamente pero no se va a realizar |
| `anulado` | El sistema / un admin | El turno fue creado por error y debe dejarse sin efecto |

Los turnos `anulados` **no deben mostrarse en la agenda** ni contar en reportes de asistencia. Son equivalentes a una eliminación lógica.

### Transiciones permitidas

```
pendiente  → confirmado | cancelado | anulado
confirmado → realizado  | cancelado | anulado
realizado  → (ninguna)
cancelado  → (ninguna)
anulado    → (ninguna)
```

> `anulado` solo puede ser disparado por un usuario con rol de administrador, nunca desde el flujo normal del cliente.

### La lógica

**Backend — `controlador.turno.mjs`**

```js
const TRANSICIONES_VALIDAS = {
  pendiente:  ['confirmado', 'cancelado', 'anulado'],
  confirmado: ['realizado',  'cancelado', 'anulado'],
  realizado:  [],
  cancelado:  [],
  anulado:    []
};

function validarTransicionEstado(estadoActual, estadoNuevo) {
  if (estadoActual === estadoNuevo) return true;
  return (TRANSICIONES_VALIDAS[estadoActual] || []).includes(estadoNuevo);
}
```

> ⚠️ Pendiente de implementar: verificar que el usuario que dispara `anulado` tenga rol `admin` antes de permitir la transición. Los demás roles no deben poder anular.

Se ejecuta en cada `PUT /turnos/:id`. Si la transición no es válida o el turno ya está en estado final → `400 Bad Request`.

**Frontend — `agenda.js`**

Mismo mapa `TRANSICIONES_VALIDAS`. Se usa en dos lugares:
- **Al renderizar el `<select>`**: solo muestra las opciones válidas desde el estado actual. La opción `anulado` debe mostrarse visualmente diferenciada (ej. color rojo/gris) y solo si el usuario es admin.
- **Al guardar**: valida antes de llamar a la API y muestra una notificación amigable si no es válido.

> ⚠️ Pendiente de implementar: los turnos con estado `anulado` deben filtrarse al renderizar la agenda (no deben aparecer como tarjetas). Actualmente se filtran `cancelado`; extender ese filtro para incluir `anulado`.

---

## 2. Anti-solapamiento de turnos

Antes de crear o modificar un turno, el backend verifica que el profesional no tenga otro turno que se superponga en el mismo horario.

### La lógica

**Backend — `modelo.turno.mjs`**

```js
async function verificarSolapamiento(empleado_id, fecha, hora_inicio, hora_fin, turno_id_excluir = null) {
  // Busca turnos del mismo empleado, misma fecha, que no estén cancelados ni anulados
  // Al modificar, excluye el turno actual para no bloquearse a sí mismo
  // Un conflicto existe si: hora_inicio < fin_otro && hora_fin > inicio_otro
}
```

> ⚠️ Pendiente de implementar: asegurarse de que el filtro de solapamiento excluya también los turnos con estado `anulado`, igual que hace con los `cancelado`.

**Backend — `controlador.turno.mjs`**

Se aplica en `POST /turnos` y `PUT /turnos/:id`:
- Si hay conflicto → `409 Conflict` con mensaje indicando el horario que choca.
- Si la fecha es anterior a hoy → `400 Bad Request`.
- Si la fecha es hoy y la hora está a menos de 60 min de la hora actual → `400 Bad Request`.

### Comportamiento

| Caso | Resultado |
|---|---|
| Mismo empleado, mismo horario | `409` — conflicto de horario |
| Mismo empleado, horario parcialmente superpuesto | `409` — conflicto de horario |
| Distinto empleado, mismo horario | `201` ✅ — permitido |
| Mismo empleado, turno cancelado existente | `201` ✅ — los cancelados no bloquean |
| Mismo empleado, turno anulado existente | `201` ✅ — los anulados no bloquean |
| Fecha anterior a hoy | `400` — fecha inválida |
| Hoy, menos de 1h de anticipación | `400` — requiere mínimo 1 hora |

---

## 3. Validación de anticipación mínima en reservas (Frontend)

En la página de reservas pública (`reserva.js`), los horarios del día actual se filtran automáticamente para que el cliente solo vea slots con al menos 1 hora de anticipación respecto a la hora actual.

### La lógica

**Frontend — `reserva.js`**

En `cargarHorarios()`, al renderizar los slots del paso 4:

```js
const esHoy = reservaActual.fecha === ahora.toISOString().split('T')[0];
// Si es hoy, filtra slots que estén a menos de 60 min de la hora actual
if (esHoy) {
  const minutosSlot = hh * 60 + mm;
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  if (minutosSlot - minutosAhora < 60) return false;
}
```

Si todos los slots del día quedan filtrados, se muestra "Sin horarios disponibles".

---

## 4. Horarios de la barbería

Configurados en `BACKEND/modulos/modelo.mjs`, en el objeto `HORARIOS_POR_DIA`.

| Día | Apertura | Cierre | Activo |
|---|---|---|---|
| Lunes | 09:00 | 21:00 | ✅ |
| Martes | 09:00 | 21:00 | ✅ |
| Miércoles | 09:00 | 21:00 | ✅ |
| Jueves | 09:00 | 21:00 | ✅ |
| Viernes | 09:00 | 21:00 | ✅ |
| Sábado | 09:00 | 21:00 | ✅ |
| Domingo | — | — | ❌ cerrado |

---

## 5. Visualización de solapamientos en agenda (Dashboard)

Cuando hay múltiples turnos simultáneos en el mismo slot horario, la agenda los muestra en columnas paralelas dentro de ese bloque. El nombre del profesional se adapta al espacio disponible:

- **1 a 4 turnos simultáneos**: muestra el primer nombre (`Carlos`, `Lucas`).
- **5 o más turnos simultáneos**: muestra solo la inicial con punto (`C.`, `L.`).

### Dónde vive la lógica

**Frontend — `agenda.js`**

```js
// Cálculo de columnas (ya existente)
const anchoColumna = 100 / turno.totalColumnas;
tarjeta.style.width = `calc(${anchoColumna}% - 8px)`;
tarjeta.style.left = `${anchoColumna * turno.columna}%`;

// Nombre adaptativo (nuevo)
turno.totalColumnas > 4
  ? turno.nombre_empleado.charAt(0).toUpperCase() + '.'
  : turno.nombre_empleado.split(' ')[0]
```

