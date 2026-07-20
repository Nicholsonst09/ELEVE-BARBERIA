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
  
  const today = new Date();
  const formattedDate = today.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  elementoFechaActual.textContent = formattedDate;
}

/**
 * Cierra el menú lateral mobile (hamburguesa).
 */
export function cerrarMenuMobile() {
  document.body.classList.remove('menu-nav-abierto')
  const overlay = document.getElementById('menu-nav-overlay')
  if (overlay) overlay.hidden = true
  const btn = document.getElementById('btn-menu-hamburguesa')
  if (btn) {
    btn.setAttribute('aria-expanded', 'false')
    const icon = btn.querySelector('i')
    if (icon) icon.className = 'fas fa-bars'
  }
}

function abrirMenuMobile() {
  document.body.classList.add('menu-nav-abierto')
  const overlay = document.getElementById('menu-nav-overlay')
  if (overlay) overlay.hidden = false
  const btn = document.getElementById('btn-menu-hamburguesa')
  if (btn) {
    btn.setAttribute('aria-expanded', 'true')
    const icon = btn.querySelector('i')
    if (icon) icon.className = 'fas fa-times'
  }
}

function toggleMenuMobile() {
  if (document.body.classList.contains('menu-nav-abierto')) cerrarMenuMobile()
  else abrirMenuMobile()
}

/**
 * Inicializa el menú hamburguesa en pantallas chicas.
 */
export function inicializarMenuMobile() {
  const btn = document.getElementById('btn-menu-hamburguesa')
  const overlay = document.getElementById('menu-nav-overlay')
  const btnCerrar = document.getElementById('btn-cerrar-menu-nav')

  btn?.addEventListener('click', toggleMenuMobile)
  overlay?.addEventListener('click', cerrarMenuMobile)
  btnCerrar?.addEventListener('click', cerrarMenuMobile)

  document.querySelectorAll('.boton-navegacion').forEach((navBtn) => {
    navBtn.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 768px)').matches) cerrarMenuMobile()
    })
  })
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

  const contenedor = document.querySelector('.contenido');
  if (contenedor && typeof contenedor.scrollTo === 'function') {
    contenedor.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cerrarMenuMobile();
}

/**
 * Actualiza las 4 tarjetas de estadísticas del dashboard.
 */
export function updateStats() {
  const turnos = estado.turnos || [];
  const total = turnos.filter(t => !['cancelado', 'anulado'].includes(t.estado)).length;
  const reservados = turnos.filter(t => t.estado === 'reservado').length;
  const completados = turnos.filter(t => t.estado === 'completado').length;
  const ingresos    = turnos
    .filter(t => t.estado === 'completado')
    .reduce((sum, t) => sum + (Number(t.precio) || 0), 0);
  document.getElementById("total-appointments").textContent = total;
  document.getElementById("reserved-appointments").textContent = reservados;
  document.getElementById("completed-appointments").textContent = completados;
  document.getElementById("daily-revenue").textContent = formatCurrency(ingresos);
}

/**
 * Vuelve a cargar las estadísticas del dashboard y actualiza la UI.
 */
export async function recargarDashboardStats() {
  updateStats();
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