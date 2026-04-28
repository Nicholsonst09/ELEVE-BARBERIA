# Máquina de Estados — Turnos

Un turno solo puede moverse entre estados de forma ordenada. No puede saltar pasos ni retroceder.

## Estados

| Estado | ¿Final? |
|---|---|
| `pendiente` | No |
| `confirmado` | No |
| `realizado` | **Sí** (no se puede tocar más) |
| `cancelado` | **Sí** (no se puede tocar más) |

## Transiciones permitidas

```
pendiente  → confirmado | cancelado
confirmado → realizado  | cancelado
realizado  → (ninguna)
cancelado  → (ninguna)
```

---

## Dónde vive la lógica

### Backend — `controlador.turno.mjs`

```js
const TRANSICIONES_VALIDAS = {
  pendiente:  ['confirmado', 'cancelado'],
  confirmado: ['realizado',  'cancelado'],
  realizado:  [],
  cancelado:  []
};

function validarTransicionEstado(estadoActual, estadoNuevo) {
  if (estadoActual === estadoNuevo) return true;
  return (TRANSICIONES_VALIDAS[estadoActual] || []).includes(estadoNuevo);
}
```

Se ejecuta en cada `PUT /turnos/:id`. Si la transición no es válida o el turno ya está en estado final → `400 Bad Request`.

### Frontend — `agenda.js`

```js
const TRANSICIONES_VALIDAS = { /* mismo mapa */ };

function validarTransicion(estadoActual, estadoNuevo) { ... }
```

Se usa en dos lugares:
- **Al renderizar el `<select>`**: solo muestra las opciones a las que puede ir desde el estado actual.
- **Al guardar**: valida antes de llamar a la API y muestra una notificación amigable si no es válido.
