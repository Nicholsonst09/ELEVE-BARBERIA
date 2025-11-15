// 1. Importar Estado y Utilidades
import { estado } from './estado.js';
import { formatearFechaParaAPI, showNotification } from './utilidades.js';

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
// ===================================================
// INICIALIZACIÓN
// ===================================================

document.addEventListener("DOMContentLoaded", async () => {
  estado.isLoading = true;

  try {
    // Carga de datos iniciales en paralelo
    const [profesionales, servicios, dashboardStats, financialData] = await Promise.all([
      api.fetchProfesionales(),
      api.fetchServicios(),
      api.fetchDashboardStats(estado.fechaActual),
      api.fetchFinancialData('week')
    ]);

    // Mutamos el estado global con los datos cargados
    estado.profesionales = profesionales;
    estado.servicios = servicios;
    estado.dashboardStats = dashboardStats;
    estado.financialData = financialData;

    if (estado.profesionales.length > 0) {
      estado.profesionalSeleccionado = 'pendiente';
    }

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


  // Selector de período (Finanzas)
  if (selectorPeriodo) { // <-- COMPROBACIÓN AÑADIDA
    // Renderizado inicial de finanzas
    renderFinancialData(selectorPeriodo.value);

    selectorPeriodo.addEventListener("change", async function () {
      estado.isLoading = true;
      try {
        estado.financialData = await api.fetchFinancialData(this.value);
      } catch (error) {
        console.error('Error al cambiar período financiero', error);
      } finally {
        estado.isLoading = false;
        renderFinancialData(this.value);
      }
    });
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
}

// ===================================================
// GLOBALES (PARA onlick DE HTML)
// ===================================================

// Expone las funciones del modal legacy a la ventana global
// para que los botones 'onclick=""' en el HTML sigan funcionando.
window.openNewAppointmentModal = ui.openNewAppointmentModal;
window.closeNewAppointmentModal = ui.closeAppointmentModal;