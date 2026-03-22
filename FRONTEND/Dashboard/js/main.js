// 1. Importar Estado y Utilidades
import { estado } from './estado.js';
import { formatearFechaParaAPI, showNotification } from './utilidades.js';
import { inicializarAuth } from './auth.js';
import { sembrarDB, dbGetEmpleados, dbGetServicios } from './db.js';

// 2. Importar Servicios API
import * as api from './api.js';

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