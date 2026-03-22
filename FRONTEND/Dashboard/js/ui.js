// js/ui.js
import { estado } from './estado.js';
import { formatCurrency, generateTimeSlots } from './utilidades.js';
import { fetchDashboardStats } from './api.js';

// --- Selectores del Modal Legacy ---
const modalCita = document.getElementById("appointment-modal");
const formularioCita = document.getElementById("appointment-form");
let currentEditingAppointment = null; // Estado local del modal legacy
let isEditMode = false; // Estado local del modal legacy

/**
 * Actualiza la fecha mostrada en el dashboard.
 */
export function initializeDate() {
  const elementoFechaActual = document.getElementById("current-date");
  const selectorFecha = document.getElementById("date-picker");
  
  const today = new Date();
  const formattedDate = today.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  elementoFechaActual.textContent = formattedDate;
  selectorFecha.value = today.toISOString().split("T")[0];
}

/**
 * Cambia entre las pestañas principales (Agenda, Finanzas).
 * @param {string} tabId - El ID de la pestaña a mostrar.
 */
export function switchTab(tabId) {
  const botonesNavegacion = document.querySelectorAll(".boton-navegacion");
  const contenidosPestana = document.querySelectorAll(".contenido-pestana");

  botonesNavegacion.forEach((btn) => btn.classList.remove("activo"));
  document.querySelector(`[data-tab="${tabId}"]`).classList.add("activo");

  contenidosPestana.forEach((content) => content.classList.remove("activo"));
  document.getElementById(tabId).classList.add("activo");
}

/**
 * Actualiza las 4 tarjetas de estadísticas del dashboard.
 */
export function updateStats() {
  const { total, confirmados, pendientes, ingresos } = estado.dashboardStats;
  document.getElementById("total-appointments").textContent = total;
  document.getElementById("confirmed-appointments").textContent = confirmados;
  document.getElementById("pending-appointments").textContent = pendientes;
  document.getElementById("daily-revenue").textContent = formatCurrency(ingresos);
}

/**
 * Vuelve a cargar las estadísticas del dashboard y actualiza la UI.
 */
export async function recargarDashboardStats() {
  try {
    estado.dashboardStats = await fetchDashboardStats(estado.fechaActual);
  } catch (error) {
    console.error('No se pudieron recargar las estadísticas', error);
  } finally {
    updateStats();
  }
}

// --- Funciones del Modal "Nuevo Turno" (legacy) ---

/**
 * Rellena el <select> de servicios en el modal legacy.
 */
export function populateServiceOptions() {
  const serviceSelect = document.getElementById("service-type");
  serviceSelect.innerHTML = '<option value="">Seleccionar servicio</option>';

  estado.servicios.forEach((service) => {
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = `${service.nombre} - $${service.precio}`;
    option.setAttribute("data-price", service.precio);
    option.setAttribute("data-duration", service.duracion);
    serviceSelect.appendChild(option);
  });
}

/**
 * Rellena las ranuras de tiempo en el modal legacy.
 */
export function populateTimeSlots() {
  const timeSelect = document.getElementById("appointment-time");
  if (timeSelect) {
    const timeSlots = generateTimeSlots();
    timeSlots.forEach((time) => {
      const option = document.createElement("option");
      option.value = time;
      option.textContent = time;
      timeSelect.appendChild(option);
    });
  }
}

export function updateDurationAndPrice() {
  // Lógica futura para el modal legacy
  console.log("Actualizando duración y precio (modal legacy)");
}

export function openNewAppointmentModal() {
  isEditMode = false;
  currentEditingAppointment = null;
  document.querySelector("#appointment-modal .encabezado-modal h3").textContent = "Programar Nuevo Turno";
  document.querySelector('#appointment-modal button[type="submit"]').textContent = "Programar Turno";
  formularioCita.reset();
  populateServiceOptions();
  // TODO: Rellenar dropdown de profesionales aquí
  modalCita.classList.add("activo");
  document.body.style.overflow = "hidden";
  setTimeout(() => { document.getElementById("client-name").focus(); }, 100);
}

export function closeAppointmentModal() {
  modalCita.classList.remove("activo");
  document.body.style.overflow = "";
  formularioCita.reset();
  isEditMode = false;
  currentEditingAppointment = null;
}