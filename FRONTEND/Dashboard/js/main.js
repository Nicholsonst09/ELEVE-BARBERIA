// 1. Importar Estado y Utilidades
import { estado } from './estado.js';
import { formatearFechaParaAPI, showNotification, confirmarAccion, setBtnLoading } from './utilidades.js';
import { inicializarAuth, obtenerSesion } from './auth.js';

// 2. Importar Servicios API
import * as api from './api.js';

// ─── HISTORIAL ───────────────────────────────────────────────────────────────
const ETIQUETAS_HISTORIAL = {
  reservado:  { txt: 'Reservado',  cls: 'estado-pendiente'  },
  completado: { txt: 'Completado', cls: 'estado-realizado'  },
  cancelado:  { txt: 'Cancelado',  cls: 'estado-cancelado'  },
  anulado:    { txt: 'Anulado',    cls: 'estado-anulado'    },
};

const DIAS_NOTIF_CANCELADOS = 7;

let _historialTurnos = [];
let _historialFiltro = 'todos';
let _historialBusqueda = '';
let _historialFecha = '';
let _historialTabActiva = 'listado';

function obtenerFechaHoraTurno(turno) {
  const hora = (turno.hora || turno.hora_inicio || '00:00').substring(0, 5);
  return new Date(`${turno.fecha}T${hora}:00`);
}

// Turnos reservados que ya pasaron 24hs de su horario y nunca se completaron,
// y cancelados de los últimos DIAS_NOTIF_CANCELADOS días (para no acumular
// años de cancelaciones en la solapa de notificaciones).
function calcularNotificaciones() {
  const ahoraMs = Date.now();
  const limiteCancelados = ahoraMs - DIAS_NOTIF_CANCELADOS * 24 * 60 * 60 * 1000;

  const vencidos = _historialTurnos
    .filter(t => t.estado === 'reservado' && (ahoraMs - obtenerFechaHoraTurno(t).getTime()) > 24 * 60 * 60 * 1000)
    .sort((a, b) => obtenerFechaHoraTurno(a) - obtenerFechaHoraTurno(b));

  const cancelados7d = _historialTurnos
    .filter(t => t.estado === 'cancelado' && obtenerFechaHoraTurno(t).getTime() >= limiteCancelados)
    .sort((a, b) => obtenerFechaHoraTurno(b) - obtenerFechaHoraTurno(a));

  return { vencidos, cancelados7d };
}

function actualizarBadgeNotificaciones() {
  const badge = document.getElementById('historialNotifBadge');
  if (!badge) return;
  const { vencidos, cancelados7d } = calcularNotificaciones();
  const total = vencidos.length + cancelados7d.length;
  badge.textContent = String(total);
  badge.hidden = total === 0;
}

function mostrarControlesListado(mostrar) {
  const filtros = document.getElementById('historialFiltros');
  const busqueda = document.getElementById('historialBusquedaFila');
  if (filtros) filtros.style.display = mostrar ? '' : 'none';
  if (busqueda) busqueda.style.display = mostrar ? '' : 'none';
}

function construirPayloadBase(turno) {
  return {
    ...turno,
    id: turno.id,
    cliente_id: turno.cliente_id,
    empleado_id: turno.empleado_id,
    servicio_id: turno.servicio_id,
    fecha: turno.fecha,
    hora_inicio: (turno.hora || turno.hora_inicio || '').substring(0, 5),
    hora_fin: (turno.hora_fin || '').substring(0, 5),
    precio: turno.precio,
  };
}

function actualizarTurnoLocal(turno) {
  const idx = _historialTurnos.findIndex(t => t.id === turno.id);
  if (idx !== -1) _historialTurnos[idx] = { ..._historialTurnos[idx], ...turno };
  actualizarBadgeNotificaciones();
}

async function cambiarEstadoTurnoHistorial(turno, nuevoEstado, btn, camposExtra = {}) {
  const restaurar = setBtnLoading(btn, 'Guardando...');
  try {
    const resultado = await api.createOrUpdateTurno({ ...construirPayloadBase(turno), estado: nuevoEstado });
    restaurar();
    if (resultado) {
      const turnoActualizado = { ...turno, estado: nuevoEstado, ...camposExtra };
      actualizarTurnoLocal(turnoActualizado);
      showNotification('Turno actualizado correctamente.', 'success');
      renderizarDetalleHistorial(turnoActualizado);
    } else {
      showNotification('No se pudo actualizar el turno.', 'error');
    }
  } catch (error) {
    restaurar();
    showNotification('Error al actualizar el turno.', 'error');
  }
}

async function registrarPagoHistorial(turno, metodo, monto, btn) {
  const restaurar = setBtnLoading(btn, 'Guardando...');
  try {
    const resultado = await api.registrarPagoTurno(turno.id, metodo, monto || null);
    restaurar();
    if (resultado) {
      const turnoActualizado = { ...turno, metodoPago: metodo };
      actualizarTurnoLocal(turnoActualizado);
      showNotification('Pago registrado. Ya podés marcar el turno como completado.', 'success');
      renderizarDetalleHistorial(turnoActualizado);
    } else {
      showNotification('No se pudo registrar el pago.', 'error');
    }
  } catch (error) {
    restaurar();
    showNotification('Error al registrar el pago.', 'error');
  }
}

// Anulado equivale a "eliminado": estado final absoluto, no se revierte ni
// siquiera un admin — por eso queda afuera de esta lista (a diferencia del
// backend, que sí distingue "estado final" de "revertible por admin").
const ESTADOS_REVERTIBLES_HISTORIAL = ['completado', 'cancelado'];

// Corrección manual de un estado final (completado/cancelado/anulado) por
// parte de un admin: se dispara desde el combo de la fila "Estado" cuando el
// destino elegido es 'completado' y el turno no tiene pago registrado.
let _historialCompletarPendiente = false;

// Solo un turno 'reservado' admite el flujo normal de cierre (completado
// exige pago primero / cancelado / anulado). El resto de las correcciones
// para estados finales se maneja desde el combo de la fila "Estado".
function renderizarAccionesDetalle(turno) {
  if (turno.estado !== 'reservado') return '';
  const esAdmin = obtenerSesion()?.rol === 'admin';

  const bloquePago = turno.metodoPago
    ? `<button type="button" class="boton-primario" id="btnHistCompletar">Marcar como completado</button>`
    : `<div class="historial-pago-form">
        <p class="historial-pago-aviso">Para completar el turno primero registrá el pago.</p>
        <select id="histPagoMetodo" class="historial-input">
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="tarjeta">Tarjeta</option>
        </select>
        <button type="button" class="boton-primario" id="btnHistRegistrarPago">Registrar pago</button>
      </div>`;

  return `
    <div class="historial-detalle-acciones" id="historialDetalleAcciones">
      ${bloquePago}
      <button type="button" class="boton-secundario eliminar" id="btnHistCancelar">Cancelar turno</button>
      ${esAdmin ? `<button type="button" class="boton-secundario eliminar" id="btnHistAnular">Anular turno</button>` : ''}
    </div>`;
}

function cablearAccionesDetalle(turno) {
  if (turno.estado !== 'reservado') return;

  document.getElementById('btnHistCompletar')?.addEventListener('click', async () => {
    const confirmado = await confirmarAccion(
      `¿Marcás el turno de ${turno.nombre_cliente} como completado?`,
      '¿Completar turno?',
      'Completar'
    );
    if (!confirmado) return;
    cambiarEstadoTurnoHistorial(turno, 'completado', document.getElementById('btnHistCompletar'));
  });

  document.getElementById('btnHistRegistrarPago')?.addEventListener('click', () => {
    const btn = document.getElementById('btnHistRegistrarPago');
    const metodo = document.getElementById('histPagoMetodo').value;
    registrarPagoHistorial(turno, metodo, null, btn);
  });

  document.getElementById('btnHistCancelar')?.addEventListener('click', async () => {
    const confirmado = await confirmarAccion(
      `¿Cancelás el turno de ${turno.nombre_cliente}?`,
      'Cancelar turno',
      'Sí, cancelar',
      'Motivo sugerido: el cliente canceló o no puede asistir.'
    );
    if (!confirmado) return;
    cambiarEstadoTurnoHistorial(turno, 'cancelado', document.getElementById('btnHistCancelar'));
  });

  document.getElementById('btnHistAnular')?.addEventListener('click', async () => {
    const confirmado = await confirmarAccion(
      `¿Anulás el turno de ${turno.nombre_cliente}? Usalo solo para turnos cargados por error.`,
      'Anular turno',
      'Sí, anular'
    );
    if (!confirmado) return;
    cambiarEstadoTurnoHistorial(turno, 'anulado', document.getElementById('btnHistAnular'));
  });
}

// Fila "Estado" del detalle: para un admin viendo un turno completado o
// cancelado, se reemplaza la simple insignia por un combo que permite
// corregirlo. Anulado equivale a "eliminado" y nunca se revierte.
function renderizarFilaEstado(turno, esAdmin) {
  const e = ETIQUETAS_HISTORIAL[turno.estado] || { txt: turno.estado, cls: '' };
  const puedeRevertir = esAdmin && ESTADOS_REVERTIBLES_HISTORIAL.includes(turno.estado);

  if (!puedeRevertir) {
    return `<div class="historial-detalle-fila"><span>Estado</span><span class="insignia-estado ${e.cls}">${e.txt}</span></div>`;
  }

  // Un cancelado solo se corrige a anulado (turno cargado por error); no
  // vuelve a quedar reservado ni se completa desde el historial.
  const opciones = turno.estado === 'cancelado'
    ? ['anulado']
    : ['reservado', 'completado', 'cancelado', 'anulado'].filter(x => x !== turno.estado);
  return `<div class="historial-detalle-fila">
    <span>Estado</span>
    <span class="historial-estado-combo-wrap">
      <span class="insignia-estado ${e.cls}">${e.txt}</span>
      <select id="histEstadoCombo" class="historial-estado-combo" aria-label="Cambiar estado del turno">
        <option value="" selected>Cambiar a...</option>
        ${opciones.map(x => `<option value="${x}">${ETIQUETAS_HISTORIAL[x].txt}</option>`).join('')}
      </select>
    </span>
  </div>`;
}

function cablearFilaEstado(turno, esAdmin) {
  if (!esAdmin || !ESTADOS_REVERTIBLES_HISTORIAL.includes(turno.estado)) return;

  document.getElementById('histEstadoCombo')?.addEventListener('change', async (ev) => {
    const nuevoEstado = ev.target.value;
    if (!nuevoEstado) return;

    if (nuevoEstado === 'completado' && !turno.metodoPago) {
      _historialCompletarPendiente = true;
      renderizarDetalleHistorial(turno);
      return;
    }

    const avisoPago = nuevoEstado !== 'completado' ? ' Si había un pago registrado, se va a eliminar.' : '';
    const confirmado = await confirmarAccion(
      `¿Cambiás el estado del turno de ${turno.nombre_cliente} a "${ETIQUETAS_HISTORIAL[nuevoEstado].txt}"?${avisoPago}`,
      'Cambiar estado',
      'Sí, cambiar'
    );
    if (!confirmado) {
      renderizarDetalleHistorial(turno);
      return;
    }
    const camposExtra = nuevoEstado === 'completado' ? {} : { metodoPago: null };
    cambiarEstadoTurnoHistorial(turno, nuevoEstado, ev.target, camposExtra);
  });
}

function renderizarBloquePagoParaCompletar() {
  return `
    <div class="historial-detalle-acciones" id="historialDetalleAcciones">
      <div class="historial-pago-form">
        <p class="historial-pago-aviso">Para completar el turno primero registrá el pago.</p>
        <select id="histPagoMetodoFinal" class="historial-input">
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="tarjeta">Tarjeta</option>
        </select>
        <button type="button" class="boton-primario" id="btnHistCompletarConPago">Completar</button>
      </div>
      <button type="button" class="boton-secundario" id="btnHistCancelarPagoFinal">Cancelar</button>
    </div>`;
}

function cablearBloquePagoParaCompletar(turno) {
  document.getElementById('btnHistCompletarConPago')?.addEventListener('click', async () => {
    const metodo = document.getElementById('histPagoMetodoFinal').value;
    const confirmado = await confirmarAccion(
      `¿Marcás el turno de ${turno.nombre_cliente} como completado?`,
      '¿Completar turno?',
      'Completar'
    );
    if (!confirmado) return;
    completarDesdeEstadoFinalConPago(turno, metodo, document.getElementById('btnHistCompletarConPago'));
  });

  document.getElementById('btnHistCancelarPagoFinal')?.addEventListener('click', () => {
    _historialCompletarPendiente = false;
    renderizarDetalleHistorial(turno);
  });
}

async function completarDesdeEstadoFinalConPago(turno, metodo, btn) {
  const restaurar = setBtnLoading(btn, 'Completando...');
  try {
    const resultadoPago = await api.registrarPagoTurno(turno.id, metodo, null);
    if (!resultadoPago) {
      restaurar();
      showNotification('No se pudo registrar el pago.', 'error');
      return;
    }
    const resultadoEstado = await api.createOrUpdateTurno({ ...construirPayloadBase(turno), estado: 'completado' });
    restaurar();
    if (resultadoEstado) {
      _historialCompletarPendiente = false;
      const turnoActualizado = { ...turno, estado: 'completado', metodoPago: metodo };
      actualizarTurnoLocal(turnoActualizado);
      showNotification('Turno completado correctamente.', 'success');
      renderizarDetalleHistorial(turnoActualizado);
    } else {
      showNotification('Pago registrado, pero no se pudo completar el turno.', 'error');
    }
  } catch (error) {
    restaurar();
    showNotification('Error al completar el turno.', 'error');
  }
}

function renderizarNotificaciones() {
  const cuerpo = document.getElementById('historialCuerpo');
  if (!cuerpo) return;
  const { vencidos, cancelados7d } = calcularNotificaciones();

  const item = (t) => {
    const e = ETIQUETAS_HISTORIAL[t.estado] || { txt: t.estado, cls: '' };
    return `<button type="button" class="historial-notif-item" data-id="${t.id}">
      <div class="historial-notif-item-info">
        <strong>${t.nombre_cliente}</strong>
        <span>${t.nombre_servicio} · ${t.nombre_empleado}</span>
        <span>${t.fecha} ${(t.hora || '').substring(0, 5)}</span>
      </div>
      <span class="insignia-estado ${e.cls}">${e.txt}</span>
    </button>`;
  };

  cuerpo.innerHTML = `
    <div class="historial-notif-seccion">
      <h4>Reservados vencidos sin completar (+24hs)</h4>
      ${vencidos.length
        ? `<div class="historial-notif-lista">${vencidos.map(item).join('')}</div>`
        : `<p class="historial-vacio">No hay turnos reservados vencidos.</p>`}
    </div>
    <div class="historial-notif-seccion">
      <h4>Cancelados recientes (últimos ${DIAS_NOTIF_CANCELADOS} días)</h4>
      ${cancelados7d.length
        ? `<div class="historial-notif-lista">${cancelados7d.map(item).join('')}</div>`
        : `<p class="historial-vacio">No hay cancelaciones recientes.</p>`}
    </div>`;

  cuerpo.querySelectorAll('.historial-notif-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const turno = _historialTurnos.find(t => t.id === Number(btn.dataset.id));
      if (turno) {
        _historialCompletarPendiente = false;
        renderizarDetalleHistorial(turno);
      }
    });
  });
}

function renderizarTablaHistorial() {
  const cuerpo = document.getElementById('historialCuerpo');
  if (!cuerpo) return;

  const porEstado = _historialFiltro === 'todos'
    ? _historialTurnos
    : _historialTurnos.filter(t => {
        if (_historialFiltro === 'completado') {
          return t.estado === 'completado';
        }
        return t.estado === _historialFiltro;
      });

  const texto = _historialBusqueda.trim().toLowerCase();
  const filtrados = porEstado.filter(t => {
    const coincideFecha = !_historialFecha || t.fecha === _historialFecha;
    if (!coincideFecha) return false;

    if (!texto) return true;
    const bolsa = [t.nombre_cliente, t.nombre_servicio, t.nombre_empleado, t.estado, t.fecha]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return bolsa.includes(texto);
  });

  if (filtrados.length === 0) {
    cuerpo.innerHTML = `<p class="historial-vacio">No hay turnos para mostrar con esos filtros.</p>`;
    return;
  }

  const filas = filtrados.map(t => {
    const e = ETIQUETAS_HISTORIAL[t.estado] || { txt: t.estado, cls: '' };
    const idx = _historialTurnos.indexOf(t);
    return `<tr>
      <td>${t.fecha}</td>
      <td class="col-hora">${(t.hora || '').substring(0, 5)}</td>
      <td class="col-servicio">${t.nombre_servicio}</td>
      <td class="col-barbero">${t.nombre_empleado}</td>
      <td><span class="insignia-estado col-estado ${e.cls}">${e.txt}</span></td>
      <td class="col-ojo">
        <button type="button" class="btn-ojo-historial" data-idx="${idx}" aria-label="Ver detalle del turno">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:15px;height:15px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');

  cuerpo.innerHTML = `
    <div class="historial-tabla-wrap">
      <table class="historial-tabla">
        <thead>
          <tr>
            <th>Fecha</th>
            <th class="col-hora">Hora</th>
            <th class="col-servicio">Servicio</th>
            <th class="col-barbero">Barbero</th>
            <th class="col-estado">Estado</th>
            <th class="col-ojo"></th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;

  cuerpo.querySelectorAll('.btn-ojo-historial').forEach(btn => {
    btn.addEventListener('click', () => {
      _historialCompletarPendiente = false;
      renderizarDetalleHistorial(_historialTurnos[Number(btn.dataset.idx)]);
    });
  });
}

function renderizarDetalleHistorial(turno) {
  const cuerpo = document.getElementById('historialCuerpo');
  const hora = (turno.hora || '').substring(0, 5);
  const horaFin = (turno.hora_fin || '').substring(0, 5);
  const esAdmin = obtenerSesion()?.rol === 'admin';

  cuerpo.innerHTML = `
    <button type="button" class="historial-volver" id="btnVolverHistorial">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      Volver ${_historialTabActiva === 'notificaciones' ? 'a notificaciones' : 'al historial'}
    </button>
    <div class="historial-detalle">
      <div class="historial-detalle-fila"><span>Cliente</span><strong>${turno.nombre_cliente}</strong></div>
      <div class="historial-detalle-fila"><span>Servicio</span><strong>${turno.nombre_servicio}</strong></div>
      <div class="historial-detalle-fila"><span>Barbero</span><strong>${turno.nombre_empleado}</strong></div>
      <div class="historial-detalle-fila"><span>Fecha</span><strong>${turno.fecha}</strong></div>
      <div class="historial-detalle-fila"><span>Hora</span><strong>${hora}${horaFin ? ` - ${horaFin}` : ''}</strong></div>
      ${renderizarFilaEstado(turno, esAdmin)}
      ${turno.precio ? `<div class="historial-detalle-fila"><span>Precio</span><strong>$ ${Number(turno.precio).toLocaleString('es-AR')}</strong></div>` : ''}
      ${turno.observaciones ? `<div class="historial-detalle-fila"><span>Notas</span><span>${turno.observaciones}</span></div>` : ''}
    </div>
    ${_historialCompletarPendiente ? renderizarBloquePagoParaCompletar() : renderizarAccionesDetalle(turno)}`;

  document.getElementById('btnVolverHistorial').addEventListener('click', () => {
    _historialCompletarPendiente = false;
    if (_historialTabActiva === 'notificaciones') renderizarNotificaciones();
    else renderizarTablaHistorial();
  });

  cablearFilaEstado(turno, esAdmin);
  if (_historialCompletarPendiente) {
    cablearBloquePagoParaCompletar(turno);
  } else {
    cablearAccionesDetalle(turno);
  }
}

async function abrirHistorial() {
  const modal = document.getElementById('modalHistorial');
  if (!modal) return;
  modal.hidden = false;
  document.getElementById('historialCuerpo').innerHTML = `<p class="historial-cargando">Cargando...</p>`;

  // El backend devuelve los turnos ordenados por fecha/hora ascendente (lo
  // que necesita la agenda del día); para el historial invertimos el orden
  // acá nomás para que se vea el más reciente primero.
  _historialTurnos = (await api.fetchHistorial()).reverse();
  _historialFiltro = 'todos';
  _historialBusqueda = '';
  _historialFecha = '';
  _historialTabActiva = 'listado';
  _historialCompletarPendiente = false;

  const inputBuscar = document.getElementById('historialBuscar');
  const inputFecha = document.getElementById('historialFecha');
  if (inputBuscar) inputBuscar.value = '';
  if (inputFecha) inputFecha.value = '';

  // Resetear chips
  document.querySelectorAll('#historialFiltros .chip-filtro').forEach(btn => {
    btn.classList.toggle('activo', btn.dataset.estado === 'todos');
  });

  // Resetear tabs (Listado / Notificaciones)
  document.querySelectorAll('#historialTabs .historial-tab').forEach(btn => {
    btn.classList.toggle('activo', btn.dataset.tab === 'listado');
  });
  mostrarControlesListado(true);

  actualizarBadgeNotificaciones();
  renderizarTablaHistorial();
}

function setupHistorialListeners() {
  const btnAbrir = document.getElementById('btnHistorial');
  const btnCerrar = document.getElementById('btnCerrarHistorial');
  const overlay = document.getElementById('modalHistorial');

  if (btnAbrir) btnAbrir.addEventListener('click', abrirHistorial);

  if (btnCerrar) btnCerrar.addEventListener('click', () => { overlay.hidden = true; });

  if (overlay) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.hidden) overlay.hidden = true;
    });
  }

  document.getElementById('historialTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.historial-tab');
    if (!tab) return;
    document.querySelectorAll('#historialTabs .historial-tab').forEach(b => b.classList.remove('activo'));
    tab.classList.add('activo');
    _historialTabActiva = tab.dataset.tab;
    if (_historialTabActiva === 'notificaciones') {
      mostrarControlesListado(false);
      renderizarNotificaciones();
    } else {
      mostrarControlesListado(true);
      renderizarTablaHistorial();
    }
  });

  document.getElementById('historialFiltros')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-filtro');
    if (!chip) return;
    document.querySelectorAll('#historialFiltros .chip-filtro').forEach(b => b.classList.remove('activo'));
    chip.classList.add('activo');
    _historialFiltro = chip.dataset.estado;
    renderizarTablaHistorial();
  });

  document.getElementById('historialBuscar')?.addEventListener('input', (e) => {
    _historialBusqueda = e.target.value || '';
    renderizarTablaHistorial();
  });

  document.getElementById('historialFecha')?.addEventListener('change', (e) => {
    _historialFecha = e.target.value || '';
    renderizarTablaHistorial();
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// 3. Importar Módulos de Funcionalidad
import { renderizar, recargarTurnosYAgenda, setupAgendaEventListeners, renderizarModal } from './agenda.js';
import { renderFinancialData } from './finanzas.js'


import * as ui from './ui.js'; // ui.initializeDate, ui.updateStats, etc.
const botonesNavegacion = document.querySelectorAll(".boton-navegacion");
const selectorFecha = document.getElementById("date-picker");
const selectorPeriodo = document.getElementById("period-selector");
const modalCita = document.getElementById("appointment-modal"); // Legacy
const formularioCita = document.getElementById("appointment-form"); // Legacy


import { inicializarClientes } from './clientes.js';
import { inicializarServicios } from './servicios.js';
import { inicializarEmpleados } from './empleados.js';
import { inicializarUsuarios } from './usuarios.js';
import { inicializarProductos } from './productos.js';
import { inicializarCaja, refrescarCaja } from './caja.js';
import { inicializarNegocio } from './negocio.js';

const DURACION_MINIMA_SPLASH_MS = 3300;
const DURACION_SALIDA_SPLASH_MS = 350;
let splashInicioTs = 0;

// El backend informa en /negocio/config si el modulo de ventas (Caja +
// Productos) esta activo (env var MODULO_VENTAS_ENABLED). Si esta apagado se
// ocultan las pestañas y no se inicializan esos modulos. Ante duda (config
// no disponible), se asume activo.
let moduloVentasActivo = true;

function ocultarModuloVentas() {
  // Saca el grupo entero del sidebar (título "Ventas" + botones Caja/Productos),
  // no solo los botones: si no, queda el título de sección colgado sin nada abajo.
  document.getElementById('grupo-navegacion-ventas')?.remove();
  ['caja', 'productos'].forEach((tabId) => {
    document.getElementById(tabId)?.remove();
  });
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mostrarSplashCarga() {
  const splash = document.getElementById('pantalla-carga');
  if (!splash) return;
  // La capa ya está visible por defecto desde el primer pintado (CSS), así
  // que acá solo hace falta arrancar el cronómetro de duración mínima y
  // asegurarse de que no quede alguna clase de un ciclo anterior.
  splash.classList.remove('saliendo', 'oculta');
  splashInicioTs = Date.now();
  document.body.style.overflow = 'hidden';
}

async function ocultarSplashCarga({ omitirMinimo = false } = {}) {
  const splash = document.getElementById('pantalla-carga');
  if (!splash || splash.classList.contains('oculta')) return;

  if (!omitirMinimo && splashInicioTs > 0) {
    const transcurrido = Date.now() - splashInicioTs;
    const restante = DURACION_MINIMA_SPLASH_MS - transcurrido;
    if (restante > 0) await esperar(restante);
  }

  splash.classList.add('saliendo');
  await esperar(DURACION_SALIDA_SPLASH_MS);
  splash.classList.add('oculta');
  splash.classList.remove('saliendo');
  document.body.style.overflow = '';
}
// ===================================================
// INICIALIZACIÓN
// ===================================================

document.addEventListener("DOMContentLoaded", async () => {
  const habiaSesionGuardada = Boolean(obtenerSesion()?.accessToken);
  if (habiaSesionGuardada) {
    mostrarSplashCarga();
  }

  try {
    // Auth siempre primero — valida la sesión o redirige a login.html
    await inicializarAuth();

    if (!obtenerSesion()?.accessToken) {
      // inicializarAuth() ya está redirigiendo a login.html
      return;
    }

    await inicializarUsuarios();

    estado.isLoading = true;

    // Colores asignados por nombre (el backend no devuelve color)
    const COLORES_PROF = { 'bautista': '#1a1a1a', 'ciro': '#2f6d4e', 'felipe': '#a34b20', 'ricardo': '#2c4ea3' };
    const PALETA = ['#1a1a1a', '#2f6d4e', '#a34b20', '#2c4ea3', '#6b2fa0', '#b5461a'];

    // Cargar profesionales, servicios y config del negocio desde el backend
    const [profesionalesAPI, serviciosAPI, configNegocio] = await Promise.all([
      api.fetchProfesionales().catch(() => []),
      api.fetchServicios().catch(() => []),
      api.fetchNegocioConfig().catch(() => null)
    ]);

    moduloVentasActivo = configNegocio?.moduloVentas !== false;
    estado.moduloVentasActivo = moduloVentasActivo;
    if (!moduloVentasActivo) ocultarModuloVentas();

    // Ante duda (config no disponible) se asume apagado: es una capacidad que
    // relaja una validación de seguridad, así que por defecto queda cerrada.
    estado.permitirTurnosAtrasados = configNegocio?.permitirTurnosAtrasados === true;

    // Días cerrados según el horario semanal real del negocio (mismo criterio
    // que empleados.js: un día sin entrada o con activo:false se considera
    // cerrado). Sin config disponible, se asume domingo cerrado como antes.
    const horariosNegocio = Array.isArray(configNegocio?.horarios) ? configNegocio.horarios : [];
    if (horariosNegocio.length) {
      const diasAbiertos = new Set();
      horariosNegocio.forEach(h => {
        const dia = Number(h?.dia);
        if (!Number.isNaN(dia) && h?.activo !== false) diasAbiertos.add(dia);
      });
      estado.diasCerradosSemana = new Set([0, 1, 2, 3, 4, 5, 6].filter(d => !diasAbiertos.has(d)));
    }

    estado.profesionales = profesionalesAPI.map((p, i) => ({
      ...p,
      color: COLORES_PROF[p.nombre.split(' ')[0].toLowerCase()] || PALETA[i % PALETA.length]
    }));
    estado.servicios = serviciosAPI;

    if (estado.profesionales.length > 0) {
      estado.profesionalSeleccionado = 'reservado';
    }

    try {
      // Carga de stats y finanzas (pueden fallar en modo demo)
      const [dashboardStats, financialData] = await Promise.all([
        api.fetchDashboardStats(estado.fechaActual),
        api.fetchFinancialData('week')
      ]);

      // Mutamos el estado global con los datos cargados
      estado.dashboardStats = dashboardStats;
      estado.financialData = financialData;

      // Carga de turnos (depende de la fecha y profesional)
      const [turnos, turnosPendientesCount] = await Promise.all([
        api.fetchTurnos(),
        api.fetchTurnosPendientesCount(estado.fechaActual)
      ]);
      estado.turnos = turnos;
      estado.turnosPendientesCount = turnosPendientesCount;

    } catch (error) {
      console.error('Error en la carga inicial de datos', error);
    } finally {
      estado.isLoading = false;
    }

    // Configuración inicial de UI y listeners
    if (document.getElementById("current-date")) ui.initializeDate();
    if (botonesNavegacion.length > 0) setupPrincipalEventListeners();
    if (document.getElementById("total-appointments")) ui.updateStats();
    // El renderizado financiero se hace dentro de setupPrincipalEventListeners si selectorPeriodo existe.

    // Rellenar modales
    if (document.getElementById("service-type")) ui.populateServiceOptions(); // Legacy
    if (document.getElementById("appointment-time")) ui.populateTimeSlots(); // Legacy

    // Renderizado inicial de la agenda (si existe)
    if (document.getElementById("navPestanas")) {
      renderizar();
      setupAgendaEventListeners(ui.recargarDashboardStats); // Inyecta la dependencia
    }

    setupHistorialListeners();
  } finally {
    if (habiaSesionGuardada) {
      await ocultarSplashCarga({ omitirMinimo: !obtenerSesion()?.accessToken });
    }
  }
});

// ===================================================
// LISTENERS PRINCIPALES (No-Agenda)
// ===================================================

function setupPrincipalEventListeners() {

  // Botón "Nuevo Turno"
  const btnNuevoTurno = document.getElementById("btnNuevoTurno");
  if (btnNuevoTurno) {
    btnNuevoTurno.addEventListener("click", () => {

      // Abre el modal avanzado en "modo creación"
      estado.turnoSeleccionado = {}; // Objeto vacío para "abrir"
      estado.modoEdicion = false;
      estado.modoCreacion = true; // El nuevo estado
      renderizarModal(); // Llama a la función importada de agenda.js
    });
  }

  // Navegación principal (Agenda, Finanzas...)
  // Los ítems del aside que no son pestañas (Ver Reservas, Cerrar sesión) no
  // tienen data-tab y manejan su propio click en otro lado.
  botonesNavegacion.forEach((button) => {
    const tabId = button.getAttribute("data-tab");
    if (!tabId) return;
    button.addEventListener("click", () => {
      ui.switchTab(tabId);
    });
  });

  // Selector de fecha del dashboard
  if (selectorFecha) { // <-- COMPROBACIÓN AÑADIDA
    selectorFecha.addEventListener("change", async function () {
      const selectedDate = new Date(this.value + "T00:00:00");
      const formattedDate = selectedDate.toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      document.getElementById("current-date").textContent = formattedDate;
      estado.fechaActual = selectedDate;

      // Recarga tanto la grilla de turnos como las stats
      await Promise.all([
        recargarTurnosYAgenda(),
        ui.recargarDashboardStats()
      ]);
    });
  }


  // Selector de período (Finanzas) — botones
  const grupoPeriodo = document.getElementById('period-selector')
  if (grupoPeriodo) {
    const btnsPeriodo = grupoPeriodo.querySelectorAll('.btn-periodo')
    const periodoActivo = () => grupoPeriodo.querySelector('.btn-periodo.activo')?.dataset.periodo || 'week'

    // Renderizado inicial
    renderFinancialData(periodoActivo())

    btnsPeriodo.forEach((btn) => {
      btn.addEventListener('click', async () => {
        btnsPeriodo.forEach((b) => b.classList.remove('activo'))
        btn.classList.add('activo')
        const periodo = btn.dataset.periodo
        estado.isLoading = true
        try {
          estado.financialData = await api.fetchFinancialData(periodo)
        } catch (error) {
          console.error('Error al cambiar período financiero', error)
        } finally {
          estado.isLoading = false
          renderFinancialData(periodo)
        }
      })
    })
  }

  // --- Listeners del Modal "Nuevo Turno" (legacy) ---

  if (formularioCita) { // Comprobación añadida para el formulario legacy
    formularioCita.addEventListener("submit", async (e) => {
      e.preventDefault();
      const clientName = document.getElementById("client-name").value.trim();
      const clientPhone = document.getElementById("client-phone").value.trim();
      const serviceType = document.getElementById("service-type").value;
      const appointmentTime = document.getElementById("appointment-time").value;

      const turnoData = {
        nombreCliente: clientName,
        telefono: clientPhone,
        servicioId: serviceType,
        horaInicio: appointmentTime,
        fecha: formatearFechaParaAPI(estado.fechaActual),
      };

      const resultado = await api.createOrUpdateTurno(turnoData);
      if (resultado) {
        showNotification("Turno creado (desde modal antiguo)", "success");
        ui.closeAppointmentModal();
        recargarTurnosYAgenda();
        ui.recargarDashboardStats();
      } else {
        showNotification("Error al crear turno", "error");
      }
    });
  }

  if (document.getElementById("service-type")) {
    document.getElementById("service-type").addEventListener("change", () => {
      ui.updateDurationAndPrice();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (document.body.classList.contains('menu-nav-abierto')) {
        ui.cerrarMenuMobile();
        return;
      }
      if (modalCita && modalCita.classList.contains("activo")) {
        ui.closeAppointmentModal();
      }
    }
  });
  ui.inicializarMenuMobile();
  inicializarClientes();
  inicializarServicios();
  inicializarEmpleados();
  if (moduloVentasActivo) {
    inicializarProductos();
    inicializarCaja();
  }
  inicializarNegocio();
  // inicializarUsuarios ya fue llamado al inicio del DOMContentLoaded
}

// ===================================================
// GLOBALES (PARA onlick DE HTML)
// ===================================================

// Expone las funciones del modal legacy a la ventana global
// para que los botones 'onclick=""' en el HTML sigan funcionando.
window.openNewAppointmentModal = ui.openNewAppointmentModal;
window.closeNewAppointmentModal = ui.closeAppointmentModal;