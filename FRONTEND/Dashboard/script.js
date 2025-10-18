// ===================================================
// CONFIGURACIÓN Y ESTADO GLOBAL
// ===================================================

const API_BASE_URL = 'http://localhost:3000/api/v1';

// --- Selectores DOM ---
const botonesNavegacion = document.querySelectorAll(".boton-navegacion");
const contenidosPestana = document.querySelectorAll(".contenido-pestana");
const elementoFechaActual = document.getElementById("current-date");
const selectorFecha = document.getElementById("date-picker");
const selectorPeriodo = document.getElementById("period-selector");
const modalCita = document.getElementById("appointment-modal");
const formularioCita = document.getElementById("appointment-form");

// --- Estado para el modal "antiguo" (legacy) ---
let currentEditingAppointment = null;
let isEditMode = false;

// --- Estado Global de la Aplicación ---
let estado = {
  profesionalSeleccionado: null,
  fechaActual: new Date(),
  turnoSeleccionado: null,
  modoEdicion: false,
  profesionales: [],
  turnos: [],
  servicios: [],
  turnosPendientesCount: 0,
  dashboardStats: {
    total: 0,
    confirmados: 0,
    pendientes: 0,
    ingresos: 0
  },
  financialData: {
    totalRevenue: 0,
    services: { total: 0, revenue: 0 },
    products: { total: 0, revenue: 0 },
    serviceBreakdown: [],
    productSales: [],
    performance: {}
  },
  isLoading: true,
  error: null,
};

// Horarios fijos para la grilla
const horariosDelDia = Array.from({ length: 13 }, (_, i) => {
  const hora = i + 9;
  return `${hora.toString().padStart(2, "0")}:00`;
});

// ===================================================
// FUNCIONES DE API (FETCH)
// ===================================================

function manejarErrorFetch(mensaje, error) {
  console.error(mensaje, error);
  estado.error = mensaje;
}

async function fetchProfesionales() {
  try {
    const response = await fetch(`${API_BASE_URL}/empleados`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.empleados || data;
  } catch (error) {
    manejarErrorFetch('No se pudieron cargar los profesionales', error);
    return [];
  }
}

async function fetchTurnos() {
  const params = new URLSearchParams();
  params.append('fecha', formatearFechaParaAPI(estado.fechaActual));

  // Si no es "pendiente", agrega el filtro de empleadoId
  if (estado.profesionalSeleccionado && estado.profesionalSeleccionado !== 'pendiente') {
    params.append('empleadoId', estado.profesionalSeleccionado);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/turnos/detalles?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    // La API devuelve { data: [...] }
    return data.data || [];
  } catch (error) {
    manejarErrorFetch('No se pudieron cargar los turnos', error);
    return [];
  }
}

async function fetchTurnosPendientesCount(fecha) {
  try {
    const params = new URLSearchParams({
      fecha: formatearFechaParaAPI(fecha),
      estado: 'pendiente'
    });
    const response = await fetch(`${API_BASE_URL}/turnos/detalles?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    // La API devuelve 'total_registros'
    return data.total_registros || 0;
  } catch (error) {
    manejarErrorFetch('No se pudo obtener el conteo de pendientes', error);
    return 0;
  }
}

async function fetchServicios() {
  try {
    const response = await fetch(`${API_BASE_URL}/servicios`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.servicios || data;
  } catch (error) {
    manejarErrorFetch('No se pudieron cargar los servicios', error);
    return [];
  }
}

// (PROVISIONAL) Devuelve datos falsos para el dashboard
async function fetchDashboardStats(fecha) {
  console.log("Usando datos FALSOS para fetchDashboardStats");
  await new Promise(resolve => setTimeout(resolve, 50));
  return {
    total: 8,
    confirmados: 5,
    pendientes: 3,
    ingresos: 45000
  };
}

// (PROVISIONAL) Devuelve datos falsos para finanzas
async function fetchFinancialData(periodo) {
  console.log(`Usando datos FALSOS para fetchFinancialData (periodo: ${periodo})`);
  await new Promise(resolve => setTimeout(resolve, 50));
  return {
    totalRevenue: 6660,
    services: { total: 180, revenue: 4500 },
    products: { total: 72, revenue: 2160 },
    serviceBreakdown: [
      { nombre: "Corte Clásico", count: 25, revenue: 450, percentage: 40 },
      { nombre: "Corte + Barba", count: 15, revenue: 375, percentage: 33 },
      { nombre: "Corte Mujer", count: 8, revenue: 240, percentage: 18 },
    ],
    productSales: [
      { nombre: "Shampoo Premium", units: 8, revenue: 240, percentage: 44 },
      { nombre: "Cera para Cabello", units: 6, revenue: 180, percentage: 33 },
    ],
    performance: {
      avgService: 25,
      avgProduct: 30,
      servicesPerDay: 6,
      revenuePerDay: 238
    }
  };
}

async function createOrUpdateTurno(turnoData) {
  const esEdicion = !!turnoData.id;
  const url = esEdicion
    ? `${API_BASE_URL}/turnos/${turnoData.id}`
    : `${API_BASE_URL}/turnos`;
  const method = esEdicion ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(turnoData)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    manejarErrorFetch(`No se pudo ${esEdicion ? 'actualizar' : 'crear'} el turno`, error);
    return null;
  }
}

async function cancelarTurno(turnoId) {
  try {
    const response = await fetch(`${API_BASE_URL}/turnos/${turnoId}/cancelar`, {
      method: 'PUT'
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    manejarErrorFetch('No se pudo cancelar el turno', error);
    return null;
  }
}

// ===================================================
// INICIALIZACIÓN
// ===================================================

document.addEventListener("DOMContentLoaded", async () => {
  estado.isLoading = true;

  try {
    // Carga de datos iniciales en paralelo
    const [profesionales, servicios, dashboardStats, financialData] = await Promise.all([
      fetchProfesionales(),
      fetchServicios(),
      fetchDashboardStats(estado.fechaActual),
      fetchFinancialData('week')
    ]);

    estado.profesionales = profesionales;
    estado.servicios = servicios;
    estado.dashboardStats = dashboardStats;
    estado.financialData = financialData;

    if (estado.profesionales.length > 0) {
      estado.profesionalSeleccionado = 'pendiente';
    }

    // Carga de turnos (depende de la fecha y profesional)
    const [turnos, turnosPendientesCount] = await Promise.all([
      fetchTurnos(),
      fetchTurnosPendientesCount(estado.fechaActual)
    ]);
    estado.turnos = turnos;
    estado.turnosPendientesCount = turnosPendientesCount;

  } catch (error) {
    manejarErrorFetch('Error en la carga inicial de datos', error);
  } finally {
    estado.isLoading = false;
  }

  // Configuración inicial de UI y listeners
  if (elementoFechaActual) initializeDate();
  if (botonesNavegacion.length > 0) setupEventListeners();
  if (document.getElementById("total-appointments")) updateStats();
  if (selectorPeriodo) renderFinancialData("week");
  if (document.getElementById("service-type")) populateServiceOptions();

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

  if (document.getElementById("navPestanas")) {
    renderizar();
    setupAgendaEventListeners();
  }
});

// ===================================================
// FUNCIONES DE RECARGA
// ===================================================

async function recargarTurnosYAgenda() {
  estado.isLoading = true;
  try {
    const [turnos, turnosPendientesCount] = await Promise.all([
      fetchTurnos(),
      fetchTurnosPendientesCount(estado.fechaActual)
    ]);
    estado.turnos = turnos;
    estado.turnosPendientesCount = turnosPendientesCount;
  } catch (error) {
    manejarErrorFetch('No se pudieron recargar los turnos', error);
    estado.turnos = [];
    estado.turnosPendientesCount = 0;
  } finally {
    estado.isLoading = false;
    renderizar();
  }
}

async function recargarDashboardStats() {
  try {
    estado.dashboardStats = await fetchDashboardStats(estado.fechaActual);
  } catch (error) {
    manejarErrorFetch('No se pudieron recargar las estadísticas', error);
  } finally {
    updateStats();
  }
}

// ===================================================
// LISTENERS Y PESTAÑAS (DASHBOARD)
// ===================================================

function initializeDate() {
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

async function setupEventListeners() {

  // Botón "Nuevo Turno" (Modal legacy)
  const btnNuevoTurno = document.getElementById("btnNuevoTurno");
  if (btnNuevoTurno) {
    btnNuevoTurno.addEventListener("click", () => {
      openNewAppointmentModal();
    });
  }

  // Navegación principal (Agenda, Finanzas...)
  botonesNavegacion.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.getAttribute("data-tab");
      switchTab(tabId);
    });
  });

  // Selector de fecha del dashboard
  selectorFecha.addEventListener("change", async function () {
    const selectedDate = new Date(this.value + "T00:00:00");
    const formattedDate = selectedDate.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    elementoFechaActual.textContent = formattedDate;
    estado.fechaActual = selectedDate;

    // Recarga tanto la grilla de turnos como las stats
    await Promise.all([
      recargarTurnosYAgenda(),
      recargarDashboardStats()
    ]);
  });

  // Selector de período (Finanzas)
  selectorPeriodo.addEventListener("change", async function () {
    estado.isLoading = true;
    try {
      estado.financialData = await fetchFinancialData(this.value);
    } catch (error) {
      manejarErrorFetch('Error al cambiar período financiero', error);
    } finally {
      estado.isLoading = false;
      renderFinancialData(this.value);
    }
  });

  // Formulario del modal "Nuevo Turno" (legacy)
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

    const resultado = await createOrUpdateTurno(turnoData);
    if (resultado) {
      showNotification("Turno creado (desde modal antiguo)", "success");
      closeAppointmentModal();
      recargarTurnosYAgenda();
      recargarDashboardStats();
    } else {
      showNotification("Error al crear turno", "error");
    }
  });

  document.getElementById("service-type").addEventListener("change", () => {
    updateDurationAndPrice();
  });

  modalCita.addEventListener("click", (e) => {
    if (e.target === modalCita) {
      closeAppointmentModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalCita.classList.contains("activo")) {
      closeAppointmentModal();
    }
  });
}

function switchTab(tabId) {
  botonesNavegacion.forEach((btn) => btn.classList.remove("activo"));
  document.querySelector(`[data-tab="${tabId}"]`).classList.add("activo");

  contenidosPestana.forEach((content) => content.classList.remove("activo"));
  document.getElementById(tabId).classList.add("activo");
}

function populateServiceOptions() {
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

function updateDurationAndPrice() {
  // Lógica futura
}

function updateStats() {
  const { total, confirmados, pendientes, ingresos } = estado.dashboardStats;
  document.getElementById("total-appointments").textContent = total;
  document.getElementById("confirmed-appointments").textContent = confirmados;
  document.getElementById("pending-appointments").textContent = pendientes;
  document.getElementById("daily-revenue").textContent = formatCurrency(ingresos);
}

// --- Funciones del Modal "Nuevo Turno" (legacy) ---

function openNewAppointmentModal() {
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

function closeAppointmentModal() {
  modalCita.classList.remove("activo");
  document.body.style.overflow = "";
  formularioCita.reset();
  isEditMode = false;
  currentEditingAppointment = null;
}

// --- Funciones de Pestaña Finanzas ---

function renderFinancialData(period) {
  const data = estado.financialData;

  if (!data || !data.services) {
    console.warn('Datos financieros no disponibles para renderizar.');
    return;
  }

  document.getElementById("total-revenue").textContent = formatCurrency(data.totalRevenue || 0);
  document.getElementById("services-count").textContent = data.services.total || 0;
  document.getElementById("services-revenue").textContent = formatCurrency(data.services.revenue || 0);
  document.getElementById("products-count").textContent = data.products.total || 0;
  document.getElementById("products-revenue").textContent = formatCurrency(data.products.revenue || 0);

  const performance = data.performance || {};
  document.getElementById("avg-service").textContent = formatCurrency(performance.avgService || 0);
  document.getElementById("avg-product").textContent = formatCurrency(performance.avgProduct || 0);
  document.getElementById("services-per-day").textContent = Math.round(performance.servicesPerDay || 0);
  document.getElementById("revenue-per-day").textContent = formatCurrency(performance.revenuePerDay || 0);

  renderServicesBreakdown(data.serviceBreakdown || []);
  renderProductsBreakdown(data.productSales || []);
}

function renderServicesBreakdown(serviceBreakdown) {
  const container = document.getElementById("services-breakdown");
  container.innerHTML = "";

  if (!serviceBreakdown || serviceBreakdown.length === 0) {
    container.innerHTML = "<p>No hay datos de servicios.</p>";
    return;
  }

  serviceBreakdown.forEach((service) => {
    const div = document.createElement("div");
    div.className = "elemento-desglose";
    div.innerHTML = `
      <div class="encabezado-desglose">
        <span class="nombre-desglose">${service.nombre}</span>
        <span class="contador-desglose">${service.count} servicios</span>
      </div>
      <div class="pie-desglose">
        <div class="barra-progreso">
          <div class="relleno-progreso servicios" style="width: ${service.percentage}%"></div>
        </div>
        <span class="ingresos-desglose">${formatCurrency(service.revenue)}</span>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderProductsBreakdown(productSales) {
  const container = document.getElementById("products-breakdown");
  container.innerHTML = "";

  if (!productSales || productSales.length === 0) {
    container.innerHTML = "<p>No hay datos de productos.</p>";
    return;
  }

  productSales.forEach((product) => {
    const div = document.createElement("div");
    div.className = "elemento-desglose";
    div.innerHTML = `
      <div class="encabezado-desglose">
        <span class="nombre-desglose">${product.nombre}</span>
        <span class="contador-desglose">${product.units} unidades</span>
      </div>
      <div class="pie-desglose">
        <div class="barra-progreso">
          <div class="relleno-progreso productos" style="width: ${product.percentage}%"></div>
        </div>
        <span class="ingresos-desglose">${formatCurrency(product.revenue)}</span>
      </div>
    `;
    container.appendChild(div);
  });
}

// ===================================================
// FUNCIONES DE LA AGENDA (GRILLA Y MODAL)
// ===================================================

function formatearFecha(fecha) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

function formatearFechaParaAPI(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


function esHoy(fecha) {
  const hoy = new Date();
  return (
    fecha.getDate() === hoy.getDate() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getFullYear() === hoy.getFullYear()
  );
}

function esFechaPasada(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const comparar = new Date(fecha);
  comparar.setHours(0, 0, 0, 0);
  return comparar < hoy;
}

function puedeDiaAnterior() {
  const diaAnterior = new Date(estado.fechaActual);
  diaAnterior.setDate(diaAnterior.getDate() - 1);
  return !esFechaPasada(diaAnterior);
}

// Calcula el estilo de la tarjeta de turno
// Asume 60 min de duración porque la API no envía 'horaFin'
function obtenerEstiloTurno(horaInicio, horaFin) {
  const [horaI, minI] = (horaInicio || "09:00").split(":").map(Number);
  const minutosInicio = (horaI - 9) * 60 + minI;
  const duracionMinutos = 60; // Duración fija asumida

  return {
    top: `${(minutosInicio / 60) * 150}px`,
    height: `${(duracionMinutos / 60) * 150 - 6}px`
  };
}

function obtenerEtiquetaEstado(estado) {
  const etiquetas = {
    confirmado: "Confirmado",
    pendiente: "Pendiente",
    completado: "Completado",
    cancelado: "Cancelado",
  };
  return etiquetas[estado] || "Pendiente";
}

// --- Funciones de Renderizado de la Agenda ---

function renderizarNavegacion() {
  const navPestanas = document.getElementById("navPestanas");
  const turnosPendientes = estado.turnosPendientesCount;

  let html = `
    <button class="pestana-navegacion pendiente ${estado.profesionalSeleccionado === "pendiente" ? "activo" : ""}" data-id="pendiente">
      <svg class="icono" style="color: var(--color-primario);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke-width="2"/>
        <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>Turnos Pendientes</span>
      ${turnosPendientes > 0 ? `<span class="insignia">${turnosPendientes}</span>` : ""}
    </button>
  `;

  estado.profesionales.forEach((prof) => {
    html += `
      <button class="pestana-navegacion ${String(estado.profesionalSeleccionado) === String(prof.id) ? "activo" : ""}" data-id="${prof.id}">
        <div class="punto-color" style="background-color: ${prof.color || '#ccc'};"></div>
        ${prof.nombre}
      </button>
    `;
  });

  navPestanas.innerHTML = html;

  navPestanas.querySelectorAll(".pestana-navegacion").forEach((pestana) => {
    pestana.addEventListener("click", () => {
      estado.profesionalSeleccionado = pestana.dataset.id;
      recargarTurnosYAgenda();
    });
  });
}

function renderizarEncabezado() {
  const turnosFiltrados = estado.turnos;
  const profesional = estado.profesionales.find(p => p.id == estado.profesionalSeleccionado);
  const titulo = estado.profesionalSeleccionado === "pendiente" ? "Turnos Pendientes" : (profesional?.nombre || "Turnos del Día");

  document.getElementById("tituloEncabezado").textContent = `${formatearFecha(estado.fechaActual)} - ${titulo}`;
  document.getElementById("subtituloEncabezado").textContent = `${turnosFiltrados.length} turnos programados`;

  const btnDiaAnterior = document.getElementById("btnDiaAnterior");
  const btnHoy = document.getElementById("btnHoy");
  btnDiaAnterior.disabled = !puedeDiaAnterior();
  btnHoy.disabled = esHoy(estado.fechaActual);
}

function renderizarGrilla() {
  const cuerpoGrilla = document.getElementById("cuerpoGrilla");
  const turnosFiltrados = estado.turnos;
  let ranuraHtml = "";
  horariosDelDia.forEach((hora) => {
    ranuraHtml += `
      <div class="ranura-tiempo">
        <div class="etiqueta-tiempo">${hora}</div>
        <div class="contenido-tiempo"></div>
      </div>
    `;
  });
  cuerpoGrilla.innerHTML = ranuraHtml;

  const capaTurnos = document.createElement("div");
  capaTurnos.className = "capa-turnos";
  capaTurnos.innerHTML = `
    <div class="grilla-turnos">
      <div></div>
      <div class="contenedor-turnos" id="contenedorTurnos"></div>
    </div>
  `;
  cuerpoGrilla.appendChild(capaTurnos);

  const contenedor = document.getElementById("contenedorTurnos");

  if (!turnosFiltrados || turnosFiltrados.length === 0) {
    contenedor.innerHTML = `<p style="text-align: center; padding-top: 2rem; color: var(--color-secundario);">No hay turnos para mostrar.</p>`;
    return;
  }

  turnosFiltrados.forEach((turno) => {
    const profesional = estado.profesionales.find(p => p.nombre === turno.nombre_empleado);
    const estilo = obtenerEstiloTurno(turno.hora, null);
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-turno";
    tarjeta.style.top = estilo.top;
    tarjeta.style.height = estilo.height;

    const color = profesional?.color || 'var(--color-primario)';
    tarjeta.style.backgroundColor = color;
    tarjeta.style.borderColor = color;

    tarjeta.innerHTML = `
      <div class="info-turno">
        <div class="cliente-turno">${turno.nombre_cliente}</div>
        <div class="servicio-turno">${turno.nombre_servicio}</div> 
        ${profesional ? `
          <div class="profesional-turno">
            <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="7" r="4" stroke-width="2"/>
            </svg>
            <span>${turno.nombre_empleado}</span>
          </div>
        ` : ""}
      </div>
      <div class="pie-turno">
        <div class="hora-turno">
          <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>${turno.hora}</span>
        </div>
        <div class="editar-turno">
          <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `;

    tarjeta.addEventListener("click", () => {
      estado.turnoSeleccionado = turno;
      estado.modoEdicion = false;
      renderizarModal();
    });

    contenedor.appendChild(tarjeta);
  });
}

function renderizarModal() {
  const modal = document.getElementById("modalSuperpuesto");
  const cuerpoModal = document.getElementById("cuerpoModal");
  const tituloModal = document.getElementById("tituloModal");

  if (!estado.turnoSeleccionado) {
    modal.classList.remove("activo");
    return;
  }

  modal.classList.add("activo");
  const turno = estado.turnoSeleccionado;
  
  // Mapeo de datos planos de la API
  const profesional = { nombre: turno.nombre_empleado };
  const servicio = { nombre: turno.nombre_servicio };
  const cliente = { nombre: turno.nombre_cliente, telefono: turno.telefono_cliente };

  if (estado.modoEdicion) {
    tituloModal.textContent = "Modificar Turno";
    
    // (Provisional) Muestra el formulario sin funcionalidad de guardado,
    // ya que faltan IDs de la API.
    const servicioSeleccionado = estado.servicios.find(s => s.nombre === turno.nombre_servicio);
    const profesionalSeleccionado = estado.profesionales.find(p => p.nombre === turno.nombre_empleado);

     cuerpoModal.innerHTML = `
          <form id="formEdicion">
            <div class="grupo-formulario">
              <label class="form-label" for="nombreCliente">Nombre del Cliente</label>
              <input type="text" id="nombreCliente" class="form-input" value="${cliente.nombre || ''}" required>
            </div>
            <div class="form-row-2col">
              <div class="grupo-formulario">
                <label class="form-label" for="telefono">Teléfono</label>
                <input type="tel" id="telefono" class="form-input" value="${cliente.telefono || ''}">
              </div>
              <div class="grupo-formulario">
                <label class="form-label" for="email">Email</label>
                <input type="email" id="email" class="form-input" value="${turno.email || ''}" placeholder="ejemplo@email.com">
              </div>
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="servicioId">Servicio</label>
              <select id="servicioId" class="form-select" required>
                ${estado.servicios.map(s => `
                    <option value="${s.id}" ${servicioSeleccionado && s.id === servicioSeleccionado.id ? "selected" : ""}>
                      ${s.nombre}
                    </option>
                  `).join("")}
              </select>
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="profesionalId">Profesional</label>
              <select id="profesionalId" class="form-select" required>
                ${estado.profesionales.map(p => `
                    <option value="${p.id}" ${profesionalSeleccionado && p.id === profesionalSeleccionado.id ? "selected" : ""}>
                      ${p.nombre}
                    </option>
                  `).join("")}
              </select>
            </div>

            <div class="form-row-2col">
              <div class="grupo-formulario">
                <label class="form-label" for="horaInicio">Hora de Inicio</label>
                <input type="time" id="horaInicio" class="form-input" value="${turno.hora || ''}" required>
              </div>
              <div class="grupo-formulario">
                <label class="form-label" for="horaFin">Hora de Fin</label>
                <input type="time" id="horaFin" class="form-input" value="${turno.horaFin || ''}" placeholder="HH:MM (opcional)">
              </div>
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="estado">Estado</label>
              <select id="estado" class="form-select" required>
                <option value="confirmado" ${turno.estado === 'confirmado' ? 'selected' : ''}>Confirmado</option>
                <option value="pendiente" ${!turno.estado || turno.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                <option value="completado" ${turno.estado === 'completado' ? 'selected' : ''}>Completado</option>
                <option value="cancelado" ${turno.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
              </select>
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="observaciones">Observaciones</label>
              <textarea id="observaciones" class="form-input" placeholder="Agregar notas...">${turno.observaciones || ''}</textarea>
            </div>

            <div class="pie-modal">
              <button type="button" class="boton-secundario" id="btnCancelarEdicion">Cancelar</button>
              <button type="submit" class="boton-primario">Guardar Cambios</button>
            </div>
          </form>
        `;
    
     document.getElementById("formEdicion").addEventListener("submit", async (e) => {
        e.preventDefault();
        showNotification("Error: La API no envía los IDs para modificar.", "error");
     });
    
     document.getElementById("btnCancelarEdicion").addEventListener("click", () => {
      estado.modoEdicion = false;
      renderizarModal();
    });

  } else {
    // Vista de "Detalles del Turno"
    tituloModal.textContent = "Detalles del Turno";
    cuerpoModal.innerHTML = `
          <div class="detalles-turno-container">
            <div class="detalles-turno-header">
              <div class="detalles-turno-nombre">${cliente.nombre}</div>
              <div class="insignia-estado estado-${turno.estado || 'pendiente'}">${obtenerEtiquetaEstado(
      turno.estado || 'pendiente',
    )}</div>
            </div>
            <div class="detalles-turno-servicio">${servicio.nombre}</div>
          </div>
          <div class="detalles-turno-info">
            <div class="detalles-turno-item">
              <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span>${turno.hora}</span>
            </div>
            ${ profesional.nombre ? `
              <div class="detalles-turno-item">
                <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>${profesional.nombre}</span>
              </div>` : "" }
            ${ cliente.telefono ? `
              <div class="detalles-turno-item">
                <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81 .7A2 2 0 0 1 22 16.92z"/></svg>
                <a href="tel:${cliente.telefono}">${cliente.telefono}</a>
              </div>` : "" }
            ${ turno.email ? `
              <div class="detalles-turno-item">
                <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <a href="mailto:${turno.email}">${turno.email}</a>
              </div>` : "" }
          </div>
          ${turno.observaciones ? `
            <div class="detalles-turno-notas">
              <div class="detalles-turno-notas-titulo">Notas</div>
              <div class="detalles-turno-notas-texto">${turno.observaciones}</div>
            </div>` : ""}
          <div class="pie-modal">
            <button class="boton-secundario" id="btnModificar">Modificar</button>
            <button class="boton-secundario eliminar" id="btnCancelarTurno">Cancelar Turno</button>
          </div>
        `;

    document.getElementById("btnModificar").addEventListener("click", () => {
      estado.modoEdicion = true;
      renderizarModal();
    });

    document.getElementById("btnCancelarTurno").addEventListener("click", () => {
      // (Provisional) Muestra el error en lugar de cancelar
      if (!turno.id) {
        showNotification("Error: No se puede cancelar el turno porque falta el 'id' desde la API.", "error");
        return;
      }
      showNotification("Error: La API no envía los IDs para cancelar.", "error");
    });
  }
}

function renderizar() {
  renderizarNavegacion();
  renderizarEncabezado();
  renderizarGrilla();
  renderizarModal();
}

// ===================================================
// LISTENERS DE LA AGENDA
// ===================================================

function setupAgendaEventListeners() {
  document.getElementById("btnDiaAnterior").addEventListener("click", () => {
    if (puedeDiaAnterior()) {
      estado.fechaActual.setDate(estado.fechaActual.getDate() - 1);
      recargarTurnosYAgenda();
      recargarDashboardStats();
    }
  });

  document.getElementById("btnDiaSiguiente").addEventListener("click", () => {
    estado.fechaActual.setDate(estado.fechaActual.getDate() + 1);
    recargarTurnosYAgenda();
    recargarDashboardStats();
  });

  document.getElementById("btnHoy").addEventListener("click", () => {
    estado.fechaActual = new Date();
    recargarTurnosYAgenda();
    recargarDashboardStats();
  });

  document.getElementById("btnCerrarModal").addEventListener("click", () => {
    estado.turnoSeleccionado = null;
    estado.modoEdicion = false;
    renderizarModal();
  });

  document.getElementById("modalSuperpuesto").addEventListener("click", (e) => {
    if (e.target.id === "modalSuperpuesto") {
      estado.turnoSeleccionado = null;
      estado.modoEdicion = false;
      renderizarModal();
    }
  });
}

// ===================================================
// UTILIDADES
// ===================================================

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function generateTimeSlots() {
  const slots = [];
  for (let hour = 8; hour < 20; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      slots.push(timeString);
    }
  }
  return slots;
}

function showNotification(message, type = "info") {
  const existingNotifications = document.querySelectorAll(".notificacion")
  existingNotifications.forEach((notification) => notification.remove())

  const notification = document.createElement("div")
  notification.className = `notificacion notificacion-${type}`
  notification.innerHTML = `
        <div class="contenido-notificacion">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="cerrar-notificacion" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
    `
  notification.querySelector(".contenido-notificacion").style.cssText = `
        display: flex;
        align-items: center;
        gap: 0.75rem;
    `
  notification.querySelector(".cerrar-notificacion").style.cssText = `
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0.25rem;
        margin-left: auto;
    `

  document.body.appendChild(notification)

  setTimeout(() => {
    notification.style.transform = "translateX(0)"
  }, 100)

  setTimeout(() => {
    notification.style.transform = "translateX(100%)"
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove()
      }
    }, 300)
  }, 5000)
}

function getNotificationIcon(type) {
  switch (type) {
    case "success": return "fa-check-circle";
    case "error": return "fa-exclamation-circle";
    case "warning": return "fa-exclamation-triangle";
    default: return "fa-info-circle";
  }
}

function getNotificationColor(type) {
  switch (type) {
    case "success": return "#48bb78";
    case "error": return "#e53e3e";
    case "warning": return "#ed8936";
    default: return "#4299e1";
  }
}

// ===================================================
// GLOBALES (PARA onlick DE HTML)
// ===================================================

window.openNewAppointmentModal = openNewAppointmentModal;
window.closeNewAppointmentModal = closeNewAppointmentModal;