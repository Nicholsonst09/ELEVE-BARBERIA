// 1. Importar Estado y Utilidades
import { estado } from './estado.js';
import { formatearFechaParaAPI, showNotification } from './utilidades.js';
import { inicializarAuth } from './auth.js';
import { sembrarDB, dbGetEmpleados, dbGetServicios } from './db.js';

// 2. Importar Servicios API
import * as api from './api.js';

// ─── HISTORIAL ───────────────────────────────────────────────────────────────
const ETIQUETAS_HISTORIAL = {
  pendiente:  { txt: 'Pendiente',  cls: 'estado-pendiente'  },
  confirmado: { txt: 'Confirmado', cls: 'estado-confirmado' },
  realizado:  { txt: 'Realizado',  cls: 'estado-realizado'  },
  cancelado:  { txt: 'Cancelado',  cls: 'estado-cancelado'  },
  anulado:    { txt: 'Eliminado',  cls: 'estado-anulado'    },
};

let _historialTurnos = [];
let _historialFiltro = 'todos';
let _historialBusqueda = '';
let _historialFecha = '';

function renderizarTablaHistorial() {
  const cuerpo = document.getElementById('historialCuerpo');
  if (!cuerpo) return;

  const porEstado = _historialFiltro === 'todos'
    ? _historialTurnos
    : _historialTurnos.filter(t => t.estado === _historialFiltro);

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
      <td>${t.nombre_cliente}</td>
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
            <th>Cliente</th>
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
      renderizarDetalleHistorial(_historialTurnos[Number(btn.dataset.idx)]);
    });
  });
}

function renderizarDetalleHistorial(turno) {
  const e = ETIQUETAS_HISTORIAL[turno.estado] || { txt: turno.estado, cls: '' };
  const cuerpo = document.getElementById('historialCuerpo');
  const hora = (turno.hora || '').substring(0, 5);
  const horaFin = (turno.hora_fin || '').substring(0, 5);
  cuerpo.innerHTML = `
    <button type="button" class="historial-volver" id="btnVolverHistorial">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      Volver al historial
    </button>
    <div class="historial-detalle">
      <div class="historial-detalle-fila"><span>Cliente</span><strong>${turno.nombre_cliente}</strong></div>
      <div class="historial-detalle-fila"><span>Servicio</span><strong>${turno.nombre_servicio}</strong></div>
      <div class="historial-detalle-fila"><span>Barbero</span><strong>${turno.nombre_empleado}</strong></div>
      <div class="historial-detalle-fila"><span>Fecha</span><strong>${turno.fecha}</strong></div>
      <div class="historial-detalle-fila"><span>Hora</span><strong>${hora}${horaFin ? ` - ${horaFin}` : ''}</strong></div>
      <div class="historial-detalle-fila"><span>Estado</span><span class="insignia-estado ${e.cls}">${e.txt}</span></div>
      ${turno.precio ? `<div class="historial-detalle-fila"><span>Precio</span><strong>$ ${Number(turno.precio).toLocaleString('es-AR')}</strong></div>` : ''}
      ${turno.observaciones ? `<div class="historial-detalle-fila"><span>Notas</span><span>${turno.observaciones}</span></div>` : ''}
    </div>`;
  document.getElementById('btnVolverHistorial').addEventListener('click', renderizarTablaHistorial);
}

async function abrirHistorial() {
  const modal = document.getElementById('modalHistorial');
  if (!modal) return;
  modal.hidden = false;
  document.getElementById('historialCuerpo').innerHTML = `<p class="historial-cargando">Cargando...</p>`;

  _historialTurnos = await api.fetchHistorial();
  _historialFiltro = 'todos';
  _historialBusqueda = '';
  _historialFecha = '';

  const inputBuscar = document.getElementById('historialBuscar');
  const inputFecha = document.getElementById('historialFecha');
  if (inputBuscar) inputBuscar.value = '';
  if (inputFecha) inputFecha.value = '';

  // Resetear chips
  document.querySelectorAll('#historialFiltros .chip-filtro').forEach(btn => {
    btn.classList.toggle('activo', btn.dataset.estado === 'todos');
  });

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

// --- Selectores DOM Principales ---
const botonesNavegacion = document.querySelectorAll(".boton-navegacion");
const selectorFecha = document.getElementById("date-picker");
const selectorPeriodo = document.getElementById("period-selector");
const modalCita = document.getElementById("appointment-modal"); // Legacy
const formularioCita = document.getElementById("appointment-form"); // Legacy


import { inicializarClientes } from './clientes.js';
import { inicializarServicios } from './servicios.js';
import { inicializarEmpleados } from './empleados.js';
import { inicializarUsuarios } from './usuarios.js';
// ===================================================
// INICIALIZACIÓN
// ===================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Sembrar BD de usuarios desde JSON antes de mostrar el login
  await inicializarUsuarios();

  // Sembrar BD de clientes, servicios y empleados
  await sembrarDB();

  // Auth siempre primero — muestra el login o restaura la sesión
  inicializarAuth();

  estado.isLoading = true;

  // Colores asignados por nombre (el backend no devuelve color)
  const COLORES_PROF = { 'bautista': '#1a1a1a', 'ciro': '#2f6d4e', 'felipe': '#a34b20', 'ricardo': '#2c4ea3' };
  const PALETA = ['#1a1a1a', '#2f6d4e', '#a34b20', '#2c4ea3', '#6b2fa0', '#b5461a'];

  // Cargar profesionales y servicios desde el backend
  const [profesionalesAPI, serviciosAPI] = await Promise.all([
    api.fetchProfesionales().catch(() => []),
    api.fetchServicios().catch(() => [])
  ]);

  estado.profesionales = profesionalesAPI.map((p, i) => ({
    ...p,
    color: COLORES_PROF[p.nombre.split(' ')[0].toLowerCase()] || PALETA[i % PALETA.length]
  }));
  estado.servicios = serviciosAPI;

  if (estado.profesionales.length > 0) {
    estado.profesionalSeleccionado = 'pendiente';
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
  botonesNavegacion.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.getAttribute("data-tab");
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

  if (modalCita) { // Comprobación añadida para el modal legacy
    modalCita.addEventListener("click", (e) => {
      if (e.target === modalCita) {
        ui.closeAppointmentModal();
      }
    });
  }


  document.addEventListener("keydown", (e) => {
    // Solo comprueba el modal si existe
    if (e.key === "Escape" && modalCita && modalCita.classList.contains("activo")) {
      ui.closeAppointmentModal();
    }
  });
  inicializarClientes();
  inicializarServicios();
  inicializarEmpleados();
  // inicializarUsuarios ya fue llamado al inicio del DOMContentLoaded
}

// ===================================================
// GLOBALES (PARA onlick DE HTML)
// ===================================================

// Expone las funciones del modal legacy a la ventana global
// para que los botones 'onclick=""' en el HTML sigan funcionando.
window.openNewAppointmentModal = ui.openNewAppointmentModal;
window.closeNewAppointmentModal = ui.closeAppointmentModal;