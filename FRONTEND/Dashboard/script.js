import { 
  profesionales, 
  turnos, 
  buscarTurnosPorProfesional, 
  buscarTurnosPendientes,
  buscarProfesionalPorId,
  actualizarTurno
} from './datos.js';

// ===================================================
// SECCIÓN 2: DATOS (de script.js original)
// ===================================================
let appointments = [
  {
    id: "1",
    time: "09:00",
    client: "Carlos Mendoza",
    service: "Corte + Barba",
    duration: 45,
    price: 25,
    phone: "+1234567890",
    status: "confirmado",
  },
  {
    id: "2",
    time: "10:00",
    client: "Ana García",
    service: "Corte Mujer",
    duration: 60,
    price: 30,
    phone: "+1234567891",
    status: "pendiente",
  },
  {
    id: "3",
    time: "11:30",
    client: "Luis Rodríguez",
    service: "Corte Clásico",
    duration: 30,
    price: 18,
    phone: "+1234567892",
    status: "confirmado",
  },
  {
    id: "4",
    time: "14:00",
    client: "María López",
    service: "Peinado",
    duration: 90,
    price: 40,
    phone: "+1234567893",
    status: "completado",
  },
]

const financialData = {
  week: {
    period: "Esta Semana",
    services: { total: 45, revenue: 1125, growth: 12.5 },
    products: { total: 18, revenue: 540, growth: 8.3 },
    totalRevenue: 1665,
    totalGrowth: 10.8,
  },
  month: {
    period: "Este Mes",
    services: { total: 180, revenue: 4500, growth: 15.2 },
    products: { total: 72, revenue: 2160, growth: 22.1 },
    totalRevenue: 6660,
    totalGrowth: 17.5,
  },
}

const serviceBreakdown = [
  { name: "Corte Clásico", count: 25, revenue: 450, percentage: 40 },
  { name: "Corte + Barba", count: 15, revenue: 375, percentage: 33 },
  { name: "Corte Mujer", count: 8, revenue: 240, percentage: 18 },
  { name: "Peinado", count: 5, revenue: 200, percentage: 11 },
]

const productSales = [
  { name: "Shampoo Premium", units: 8, revenue: 240, percentage: 44 },
  { name: "Cera para Cabello", units: 6, revenue: 180, percentage: 33 },
  { name: "Aceite para Barba", units: 4, revenue: 120, percentage: 22 },
]

const serviceOptions = [
  { value: "corte-clasico", name: "Corte Clásico", price: 18, duration: 30 },
  { value: "corte-barba", name: "Corte + Barba", price: 25, duration: 45 },
  { value: "corte-mujer", name: "Corte Mujer", price: 30, duration: 60 },
  { value: "peinado", name: "Peinado", price: 40, duration: 90 },
]

// ===================================================
// SECCIÓN 3: ESTADO GLOBAL Y SELECTORES
// ===================================================

// Estado (de script.js original)
let currentEditingAppointment = null
let isEditMode = false

// Selectores DOM (de script.js original)
const botonesNavegacion = document.querySelectorAll(".boton-navegacion")
const contenidosPestana = document.querySelectorAll(".contenido-pestana")
const elementoFechaActual = document.getElementById("current-date")
const selectorFecha = document.getElementById("date-picker")
const selectorPeriodo = document.getElementById("period-selector")
const modalCita = document.getElementById("appointment-modal")
const formularioCita = document.getElementById("appointment-form")

// Estado (del nuevo fragmento)
let estado = {
  profesionalSeleccionado: profesionales[0].id,
  fechaActual: new Date(),
  turnoSeleccionado: null,
  modoEdicion: false,
}

// Horarios (del nuevo fragmento)
const horariosDelDia = Array.from({ length: 13 }, (_, i) => {
  const hora = i + 9
  return `${hora.toString().padStart(2, "0")}:00`
})

// ===================================================
// SECCIÓN 4: INICIALIZACIÓN UNIFICADA
// ===================================================

document.addEventListener("DOMContentLoaded", () => {
  // --- Inicialización del Dashboard (script.js original) ---
  if (elementoFechaActual) initializeDate()
  if (botonesNavegacion.length > 0) setupEventListeners() // Llama a los listeners del dashboard
  if (document.getElementById("total-appointments")) updateStats()
  if (selectorPeriodo) renderFinancialData("week")
  if (document.getElementById("service-type")) populateServiceOptions()

  // --- Inicialización del generador de horas (script.js original) ---
  const timeSelect = document.getElementById("appointment-time")
  if (timeSelect) {
    const timeSlots = generateTimeSlots()
    timeSlots.forEach((time) => {
      const option = document.createElement("option")
      option.value = time
      option.textContent = time
      timeSelect.appendChild(option)
    })
  }

  // --- Inicialización de la Agenda/Grilla (nuevo fragmento) ---
  // Comprobamos si los elementos de la agenda existen antes de renderizar
  if (document.getElementById("navPestanas")) {
    renderizar() // Renderizado inicial de la agenda
    setupAgendaEventListeners() // Llama a los listeners de la agenda
  }
})

// ===================================================
// SECCIÓN 5: FUNCIONES DEL DASHBOARD (script.js original)
// ===================================================

function initializeDate() {
  const today = new Date()
  const formattedDate = today.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  elementoFechaActual.textContent = formattedDate
  selectorFecha.value = today.toISOString().split("T")[0]
}

function setupEventListeners() {
  botonesNavegacion.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.getAttribute("data-tab")
      switchTab(tabId)
    })
  })

  selectorFecha.addEventListener("change", function () {
    const selectedDate = new Date(this.value)
    const formattedDate = selectedDate.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    elementoFechaActual.textContent = formattedDate
  })

  selectorPeriodo.addEventListener("change", function () {
    renderFinancialData(this.value)
  })

  formularioCita.addEventListener("submit", (e) => {
    e.preventDefault()
    if (isEditMode) {
      updateAppointment()
    } else {
      addNewAppointment()
    }
  })

  document.getElementById("service-type").addEventListener("change", () => {
    updateDurationAndPrice()
  })

  modalCita.addEventListener("click", (e) => {
    if (e.target === modalCita) {
      closeAppointmentModal()
    }
  })

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalCita.classList.contains("activo")) {
      closeAppointmentModal()
    }
  })
}

// Tab Navigation
function switchTab(tabId) {
  botonesNavegacion.forEach((btn) => btn.classList.remove("activo"))
  document.querySelector(`[data-tab="${tabId}"]`).classList.add("activo")

  contenidosPestana.forEach((content) => content.classList.remove("activo"))
  document.getElementById(tabId).classList.add("activo")
}

// Service Options
function populateServiceOptions() {
  const serviceSelect = document.getElementById("service-type")
  serviceSelect.innerHTML = '<option value="">Seleccionar servicio</option>'

  serviceOptions.forEach((service) => {
    const option = document.createElement("option")
    option.value = service.value
    option.textContent = `${service.name} - $${service.price}`
    option.setAttribute("data-price", service.price)
    option.setAttribute("data-duration", service.duration)
    serviceSelect.appendChild(option)
  })
}

function updateDurationAndPrice() {
  const serviceSelect = document.getElementById("service-type")
  const selectedOption = serviceSelect.options[serviceSelect.selectedIndex]

  if (selectedOption && selectedOption.value) {
    const duration = selectedOption.getAttribute("data-duration")
    console.log(`Selected service duration: ${duration} minutes`)
  }
}

function updateStats() {
  const totalAppointments = appointments.length
  const confirmedAppointments = appointments.filter((a) => a.status === "confirmado").length
  const pendingAppointments = appointments.filter((a) => a.status === "pendiente").length
  const completedAppointments = appointments.filter((a) => a.status === "completado").length
  const dailyRevenue = appointments.reduce((sum, a) => sum + a.price, 0)

  document.getElementById("total-appointments").textContent = totalAppointments
  document.getElementById("confirmed-appointments").textContent = confirmedAppointments
  document.getElementById("pending-appointments").textContent = pendingAppointments
  document.getElementById("daily-revenue").textContent = `$${dailyRevenue}`
}

function openNewAppointmentModal() {
  isEditMode = false
  currentEditingAppointment = null

  document.querySelector(".encabezado-modal h3").textContent = "Programar Nuevo Turno"
  document.querySelector('button[type="submit"]').textContent = "Programar Turno"

  formularioCita.reset()

  modalCita.classList.add("activo")
  document.body.style.overflow = "hidden"

  setTimeout(() => {
    document.getElementById("client-name").focus()
  }, 100)
}

function editAppointment(id) {
  const appointment = appointments.find((a) => a.id === id)
  if (!appointment) {
    showNotification("Cita no encontrada", "error")
    return
  }

  isEditMode = true
  currentEditingAppointment = appointment

  document.querySelector(".encabezado-modal h3").textContent = "Editar Cita"
  document.querySelector('button[type="submit"]').textContent = "Actualizar Cita"

  document.getElementById("client-name").value = appointment.client
  document.getElementById("client-phone").value = appointment.phone
  document.getElementById("appointment-time").value = appointment.time

  const serviceSelect = document.getElementById("service-type")
  const serviceOption = serviceOptions.find((s) => s.name === appointment.service)
  if (serviceOption) {
    serviceSelect.value = serviceOption.value
  }

  modalCita.classList.add("activo")
  document.body.style.overflow = "hidden"

  setTimeout(() => {
    document.getElementById("client-name").focus()
  }, 100)
}

function closeAppointmentModal() {
  modalCita.classList.remove("activo")
  document.body.style.overflow = ""
  formularioCita.reset()
  isEditMode = false
  currentEditingAppointment = null
}

function addNewAppointment() {
  const clientName = document.getElementById("client-name").value.trim()
  const clientPhone = document.getElementById("client-phone").value.trim()
  const serviceType = document.getElementById("service-type").value
  const appointmentTime = document.getElementById("appointment-time").value

  if (!clientName || !clientPhone || !serviceType || !appointmentTime) {
    showNotification("Por favor completa todos los campos", "error")
    return
  }

  const existingAppointment = appointments.find((a) => a.time === appointmentTime)
  if (existingAppointment) {
    showNotification("Ya existe una cita programada para esa hora", "error")
    return
  }

  const serviceOption = serviceOptions.find((s) => s.value === serviceType)
  if (!serviceOption) {
    showNotification("Servicio no válido", "error")
    return
  }

  const newAppointment = {
    id: Date.now().toString(),
    time: appointmentTime,
    client: clientName,
    service: serviceOption.name,
    duration: serviceOption.duration,
    price: serviceOption.price,
    phone: clientPhone,
    status: "pendiente",
  }

  appointments.push(newAppointment)

  updateStats()
  closeAppointmentModal()

  showNotification(`Cita programada para ${clientName} a las ${appointmentTime}`, "success")
}

function updateAppointment() {
  if (!currentEditingAppointment) {
    showNotification("Error: No se encontró la cita a editar", "error")
    return
  }

  const clientName = document.getElementById("client-name").value.trim()
  const clientPhone = document.getElementById("client-phone").value.trim()
  const serviceType = document.getElementById("service-type").value
  const appointmentTime = document.getElementById("appointment-time").value

  if (!clientName || !clientPhone || !serviceType || !appointmentTime) {
    showNotification("Por favor completa todos los campos", "error")
    return
  }

  const existingAppointment = appointments.find(
    (a) => a.time === appointmentTime && a.id !== currentEditingAppointment.id,
  )
  if (existingAppointment) {
    showNotification("Ya existe una cita programada para esa hora", "error")
    return
  }

  const serviceOption = serviceOptions.find((s) => s.value === serviceType)
  if (!serviceOption) {
    showNotification("Servicio no válido", "error")
    return
  }

  const appointmentIndex = appointments.findIndex((a) => a.id === currentEditingAppointment.id)
  if (appointmentIndex !== -1) {
    appointments[appointmentIndex] = {
      ...currentEditingAppointment,
      time: appointmentTime,
      client: clientName,
      service: serviceOption.name,
      duration: serviceOption.duration,
      price: serviceOption.price,
      phone: clientPhone,
    }

    updateStats()
    closeAppointmentModal()

    showNotification(`Cita de ${clientName} actualizada correctamente`, "success")
  } else {
    showNotification("Error al actualizar la cita", "error")
  }
}

function toggleAppointmentStatus(id) {
  const appointment = appointments.find((a) => a.id === id)
  if (!appointment) {
    showNotification("Cita no encontrada", "error")
    return
  }

  const statusCycle = {
    pendiente: "confirmado",
    confirmado: "completado",
    completado: "pendiente",
  }

  appointment.status = statusCycle[appointment.status] || "pendiente"

  updateStats()

  const statusNames = {
    pendiente: "Pendiente",
    confirmado: "Confirmado",
    completado: "Completado",
  }

  showNotification(`Estado cambiado a: ${statusNames[appointment.status]}`, "info")
}

function deleteAppointment(id) {
  const appointment = appointments.find((a) => a.id === id)
  if (!appointment) {
    showNotification("Cita no encontrada", "error")
    return
  }

  if (
    confirm(
      `¿Estás seguro de que quieres eliminar la cita de ${appointment.client} a las ${appointment.time}?`,
    )
  ) {
    appointments = appointments.filter((a) => a.id !== id)
    updateStats()
    showNotification(`Cita de ${appointment.client} eliminada`, "success")
  }
}

function renderFinancialData(period) {
  const data = financialData[period]

  document.getElementById("total-revenue").textContent = formatCurrency(data.totalRevenue)
  document.getElementById("services-count").textContent = data.services.total
  document.getElementById("services-revenue").textContent = formatCurrency(data.services.revenue)
  document.getElementById("products-count").textContent = data.products.total
  document.getElementById("products-revenue").textContent = formatCurrency(data.products.revenue)

  document.getElementById("avg-service").textContent = formatCurrency(
    data.services.revenue / data.services.total,
  )
  document.getElementById("avg-product").textContent = formatCurrency(
    data.products.revenue / data.products.total,
  )
  document.getElementById("services-per-day").textContent = Math.round(
    data.services.total / (period === "week" ? 7 : 30),
  )
  document.getElementById("revenue-per-day").textContent = formatCurrency(
    data.totalRevenue / (period === "week" ? 7 : 30),
  )

  renderServicesBreakdown()
  renderProductsBreakdown()
}

function renderServicesBreakdown() {
  const container = document.getElementById("services-breakdown")
  container.innerHTML = ""

  serviceBreakdown.forEach((service) => {
    const div = document.createElement("div")
    div.className = "elemento-desglose"
    div.innerHTML = `
            <div class="encabezado-desglose">
                <span class="nombre-desglose">${service.name}</span>
                <span class="contador-desglose">${service.count} servicios</span>
            </div>
            <div class="pie-desglose">
                <div class="barra-progreso">
                    <div class="relleno-progreso servicios" style="width: ${service.percentage}%"></div>
                </div>
                <span class="ingresos-desglose">${formatCurrency(service.revenue)}</span>
            </div>
        `
    container.appendChild(div)
  })
}

function renderProductsBreakdown() {
  const container = document.getElementById("products-breakdown")
  container.innerHTML = ""

  productSales.forEach((product) => {
    const div = document.createElement("div")
    div.className = "elemento-desglose"
    div.innerHTML = `
            <div class="encabezado-desglose">
                <span class="nombre-desglose">${product.name}</span>
                <span class="contador-desglose">${product.units} unidades</span>
            </div>
            <div class="pie-desglose">
                <div class="barra-progreso">
                    <div class="relleno-progreso productos" style="width: ${product.percentage}%"></div>
                </div>
                <span class="ingresos-desglose">${formatCurrency(product.revenue)}</span>
            </div>
        `
    container.appendChild(div)
  })
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
    case "success":
      return "fa-check-circle"
    case "error":
      return "fa-exclamation-circle"
    case "warning":
      return "fa-exclamation-triangle"
    default:
      return "fa-info-circle"
  }
}

function getNotificationColor(type) {
  switch (type) {
    case "success":
      return "#48bb78"
    case "error":
      return "#e53e3e"
    case "warning":
      return "#ed8936"
    default:
      return "#4299e1"
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function generateTimeSlots() {
  const slots = []
  for (let hour = 8; hour < 20; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
      slots.push(timeString)
    }
  }
  return slots
}

// ===================================================
// SECCIÓN 6: FUNCIONES DE LA AGENDA (nuevo fragmento)
// ===================================================

// Funciones de utilidad
function formatearFecha(fecha) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha)
}

function esHoy(fecha) {
  const hoy = new Date()
  return (
    fecha.getDate() === hoy.getDate() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getFullYear() === hoy.getFullYear()
  )
}

function esFechaPasada(fecha) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const comparar = new Date(fecha)
  comparar.setHours(0, 0, 0, 0)
  return comparar < hoy
}

function puedeDiaAnterior() {
  const diaAnterior = new Date(estado.fechaActual)
  diaAnterior.setDate(diaAnterior.getDate() - 1)
  return !esFechaPasada(diaAnterior)
}

function obtenerEstiloTurno(horaInicio, horaFin) {
  const [horaI, minI] = horaInicio.split(":").map(Number)
  const [horaF, minF] = horaFin.split(":").map(Number)

  const minutosInicio = (horaI - 9) * 60 + minI
  const minutosFin = (horaF - 9) * 60 + minF
  const duracion = minutosFin - minutosInicio

  return {
    top: `${(minutosInicio / 60) * 130}px`,
    height: `${(duracion / 60) * 130 - 6}px`,
  }
}

function obtenerEtiquetaEstado(estado) {
  const etiquetas = {
    confirmado: "Confirmado",
    pendiente: "Pendiente",
    completado: "Completado",
    cancelado: "Cancelado",
  }
  return etiquetas[estado] || estado
}

// Función para obtener turnos filtrados
function obtenerTurnosFiltrados() {
  if (estado.profesionalSeleccionado === "pendiente") {
    return buscarTurnosPendientes(estado.fechaActual)
  }
  const profesional = buscarProfesionalPorId(estado.profesionalSeleccionado)

  return buscarTurnosPorProfesional(
    estado.profesionalSeleccionado,
    profesional?.nombre,
    estado.fechaActual,
  )
}

// Renderizar navegación de profesionales
function renderizarNavegacion() {
  const navPestanas = document.getElementById("navPestanas")
  const turnosPendientes = buscarTurnosPendientes(estado.fechaActual).length

  let html = `
        <button class="pestana-navegacion pendiente ${
          estado.profesionalSeleccionado === "pendiente" ? "activo" : ""
        }" 
                data-id="pendiente">
          <svg class="icono" style="color: var(  --color-primario);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round"/>
            <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>Turnos Pendientes</span>
          ${turnosPendientes > 0 ? `<span class="insignia">${turnosPendientes}</span>` : ""}
        </button>
      `

  profesionales.forEach((prof) => {
    html += `
          <button class="pestana-navegacion ${
            estado.profesionalSeleccionado === prof.id ? "activo" : ""
          }" 
                  data-id="${prof.id}">
            <div class="punto-color" style="background-color: ${prof.color};"></div>
            ${prof.nombre}
          </button>
        `
  })

  navPestanas.innerHTML = html

  // Agregar event listeners
  navPestanas.querySelectorAll(".pestana-navegacion").forEach((pestana) => {
    pestana.addEventListener("click", () => {
      estado.profesionalSeleccionado = pestana.dataset.id
      renderizar()
    })
  })
}

// Renderizar encabezado
function renderizarEncabezado() {
  const turnosFiltrados = obtenerTurnosFiltrados()
  const profesional = buscarProfesionalPorId(estado.profesionalSeleccionado)

  const titulo =
    estado.profesionalSeleccionado === "pendiente" ? "Turnos Pendientes" : profesional?.nombre

  document.getElementById("tituloEncabezado").textContent =
    `${formatearFecha(estado.fechaActual)} - ${titulo}`
  document.getElementById(
    "subtituloEncabezado",
  ).textContent = `${turnosFiltrados.length} turnos programados`

  // Actualizar botones de navegación de fecha
  const btnDiaAnterior = document.getElementById("btnDiaAnterior")
  const btnHoy = document.getElementById("btnHoy")

  btnDiaAnterior.disabled = !puedeDiaAnterior()
  btnHoy.disabled = esHoy(estado.fechaActual)
}

// Renderizar grilla de turnos
function renderizarGrilla() {
  const cuerpoGrilla = document.getElementById("cuerpoGrilla")
  const turnosFiltrados = obtenerTurnosFiltrados()

  // Crear ranuras de tiempo
  let ranuraHtml = ""
  horariosDelDia.forEach((hora) => {
    ranuraHtml += `
          <div class="ranura-tiempo">
            <div class="etiqueta-tiempo">${hora}</div>
            <div class="contenido-tiempo"></div>
          </div>
        `
  })

  cuerpoGrilla.innerHTML = ranuraHtml

  // Crear capa de turnos
  const capaTurnos = document.createElement("div")
  capaTurnos.className = "capa-turnos"
  capaTurnos.innerHTML = `
      <div class="grilla-turnos">
        <div></div>
        <div class="contenedor-turnos" id="contenedorTurnos"></div>
      </div>
    `
  cuerpoGrilla.appendChild(capaTurnos)

  // Renderizar turnos
  const contenedor = document.getElementById("contenedorTurnos")
  turnosFiltrados.forEach((turno) => {
    const profesional = buscarProfesionalPorId(turno.profesionalId)
    const estilo = obtenerEstiloTurno(turno.horaInicio, turno.horaFin)

    const tarjeta = document.createElement("div")
    tarjeta.className = "tarjeta-turno"
    tarjeta.style.top = estilo.top
    tarjeta.style.backgroundColor = profesional?.color || "var(  --color-primario)"
    tarjeta.style.borderColor = profesional?.color || "var(  --color-primario)"

    tarjeta.innerHTML = `
          <div class="info-turno">
            <div class="cliente-turno">${turno.nombreCliente}</div>
            <div class="servicio-turno">${turno.servicio}</div>
            ${
              profesional
                ? `
              <div class="profesional-turno">
                <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="7" r="4" stroke-width="2"/>
                </svg>
                <span>${profesional.nombre}</span>
              </div>
            `
                : ""
            }
          </div>
          <div class="pie-turno">
            <div class="hora-turno">
              <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke-width="2"/>
                <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span>${turno.horaInicio} - ${turno.horaFin}</span>
            </div>
            <div class="editar-turno">
              <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        `

    tarjeta.addEventListener("click", () => {
      estado.turnoSeleccionado = turno
      estado.modoEdicion = false
      renderizarModal()
    })

    contenedor.appendChild(tarjeta)
  })
}

// Renderizar modal
function renderizarModal() {
  const modal = document.getElementById("modalSuperpuesto")
  const cuerpoModal = document.getElementById("cuerpoModal")
  const tituloModal = document.getElementById("tituloModal")

  if (!estado.turnoSeleccionado) {
    modal.classList.remove("activo")
    return
  }

  modal.classList.add("activo")
  const turno = estado.turnoSeleccionado
  const profesional = buscarProfesionalPorId(turno.profesionalId)

  if (estado.modoEdicion) {
    tituloModal.textContent = "Modificar Turno"
    cuerpoModal.innerHTML = `
          <form id="formEdicion">
            <div class="grupo-formulario">
              <label class="form-label" for="nombreCliente">Nombre del Cliente</label>
              <input type="text" id="nombreCliente" class="form-input" value="${
                turno.nombreCliente
              }" required>
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="telefono">Teléfono</label>
              <input type="tel" id="telefono" class="form-input" value="${turno.telefono || ""}">
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="email">Email</label>
              <input type="email" id="email" class="form-input" value="${turno.email || ""}">
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="servicio">Servicio</label>
              <input type="text" id="servicio" class="form-input" value="${turno.servicio}" required>
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="profesionalId">Profesional</label>
              <select id="profesionalId" class="form-select" required>
                ${profesionales
                  .map(
                    (p) => `
                  <option value="${p.id}" ${p.id === turno.profesionalId ? "selected" : ""}>
                    ${p.nombre}
                  </option>
                `,
                  )
                  .join("")}
              </select>
            </div>

            <div class="form-row-2col">
              <div class="grupo-formulario">
                <label class="form-label" for="horaInicio">Hora de Inicio</label>
                <input type="time" id="horaInicio" class="form-input" value="${
                  turno.horaInicio
                }" required>
              </div>

              <div class="grupo-formulario">
                <label class="form-label" for="horaFin">Hora de Fin</label>
                <input type="time" id="horaFin" class="form-input" value="${turno.horaFin}" required>
              </div>
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="estado">Estado</label>
              <select id="estado" class="form-select" required>
                <option value="confirmado" ${
                  turno.estado === "confirmado" ? "selected" : ""
                }>Confirmado</option>
                <option value="pendiente" ${
                  turno.estado === "pendiente" ? "selected" : ""
                }>Pendiente</option>
                <option value="completado" ${
                  turno.estado === "completado" ? "selected" : ""
                }>Completado</option>
                <option value="cancelado" ${
                  turno.estado === "cancelado" ? "selected" : ""
                }>Cancelado</option>
              </select>
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="observaciones">Observaciones</label>
              <textarea id="observaciones" class="form-input" placeholder="Agregar notas u observaciones...">${
                turno.observaciones || ""
              }</textarea>
            </div>

            <div class="pie-modal">
              <button type="button" class="boton-secundario" id="btnCancelarEdicion">Cancelar</button>
              <button type="submit" class="boton-primario">Guardar Cambios</button>
            </div>
          </form>
        `

    // Event listeners para formulario
    document.getElementById("formEdicion").addEventListener("submit", (e) => {
      e.preventDefault()

      const turnoActualizado = {
        ...turno,
        nombreCliente: document.getElementById("nombreCliente").value,
        telefono: document.getElementById("telefono").value,
        email: document.getElementById("email").value,
        servicio: document.getElementById("servicio").value,
        profesionalId: document.getElementById("profesionalId").value,
        horaInicio: document.getElementById("horaInicio").value,
        horaFin: document.getElementById("horaFin").value,
        estado: document.getElementById("estado").value,
        observaciones: document.getElementById("observaciones").value,
      }

      actualizarTurno(turnoActualizado)
      estado.turnoSeleccionado = null
      estado.modoEdicion = false
      renderizar()
    })

    document.getElementById("btnCancelarEdicion").addEventListener("click", () => {
      estado.modoEdicion = false
      renderizarModal()
    })
  } else {
    tituloModal.textContent = "Detalles del Turno"
    cuerpoModal.innerHTML = `
          <div class="detalles-turno-container">
            <div class="detalles-turno-header">
              <div class="detalles-turno-nombre">${turno.nombreCliente}</div>
              <div class="insignia-estado estado-${turno.estado}">${obtenerEtiquetaEstado(
      turno.estado,
    )}</div>
            </div>
            <div class="detalles-turno-servicio">${turno.servicio}</div>
          </div>

          <div class="detalles-turno-info">
            <div class="detalles-turno-item">
              <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke-width="2"/>
                <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span>${turno.horaInicio} - ${turno.horaFin}</span>
            </div>

            ${
              profesional
                ? `
              <div class="detalles-turno-item">
                <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="7" r="4" stroke-width="2"/>
                </svg>
                <span>${profesional.nombre}</span>
              </div>
            `
                : ""
            }

            ${
              turno.telefono
                ? `
              <div class="detalles-turno-item">
                <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke-width="2"/>
                </svg>
                <a href="tel:${turno.telefono}">${turno.telefono}</a>
              </div>
            `
                : ""
            }

            ${
              turno.email
                ? `
              <div class="detalles-turno-item">
                <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke-width="2"/>
                  <polyline points="22,6 12,13 2,6" stroke-width="2"/>
                </svg>
                <a href="mailto:${turno.email}">${turno.email}</a>
              </div>
            `
                : ""
            }
          </div>

          ${
            turno.observaciones
              ? `
            <div class="detalles-turno-notas">
              <div class="detalles-turno-notas-titulo">Notas</div>
              <div class="detalles-turno-notas-texto">${turno.observaciones}</div>
            </div>
          `
              : ""
          }

          <div class="pie-modal">
            <button class="boton-secundario" id="btnModificar">Modificar</button>
            <button class="boton-secundario eliminar" id="btnCancelarTurno">Cancelar Turno</button>
          </div>
        `

    // Event listeners para botones
    document.getElementById("btnModificar").addEventListener("click", () => {
      estado.modoEdicion = true
      renderizarModal()
    })

    document.getElementById("btnCancelarTurno").addEventListener("click", () => {
      if (confirm("¿Está seguro que desea cancelar este turno?")) {
        const turnoActualizado = { ...turno, estado: "cancelado" }
        actualizarTurno(turnoActualizado)
        estado.turnoSeleccionado = null
        renderizar()
      }
    })
  }
}

// Función principal de renderizado
function renderizar() {
  renderizarNavegacion()
  renderizarEncabezado()
  renderizarGrilla()
  renderizarModal()
}

// ===================================================
// SECCIÓN 7: LISTENERS DE LA AGENDA (nuevo fragmento)
// ===================================================

// Los movimos a una función 'setupAgendaEventListeners'
// que se llama dentro del DOMContentLoaded
function setupAgendaEventListeners() {
  document.getElementById("btnDiaAnterior").addEventListener("click", () => {
    if (puedeDiaAnterior()) {
      estado.fechaActual.setDate(estado.fechaActual.getDate() - 1)
      renderizar()
    }
  })

  document.getElementById("btnDiaSiguiente").addEventListener("click", () => {
    estado.fechaActual.setDate(estado.fechaActual.getDate() + 1)
    renderizar()
  })

  document.getElementById("btnHoy").addEventListener("click", () => {
    estado.fechaActual = new Date()
    renderizar()
  })

  // Cerrar modal
  document.getElementById("btnCerrarModal").addEventListener("click", () => {
    estado.turnoSeleccionado = null
    estado.modoEdicion = false
    renderizar()
  })

  document.getElementById("modalSuperpuesto").addEventListener("click", (e) => {
    if (e.target.id === "modalSuperpuesto") {
      estado.turnoSeleccionado = null
      estado.modoEdicion = false
      renderizar()
    }
  })
}

// ===================================================
// SECCIÓN 8: EXPORTACIONES Y GLOBALES
// ===================================================

// Globales (de script.js original)
window.openNewAppointmentModal = openNewAppointmentModal
window.closeNewAppointmentModal = closeAppointmentModal
window.editAppointment = editAppointment
window.deleteAppointment = deleteAppointment
window.toggleAppointmentStatus = toggleAppointmentStatus

// Módulos (de script.js original)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    addNewAppointment,
    editAppointment,
    deleteAppointment,
    updateStats,
    formatCurrency,
  }
}