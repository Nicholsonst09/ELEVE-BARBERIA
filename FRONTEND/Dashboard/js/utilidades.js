// js/utilidades.js

/**
 * Formatea un monto numérico como moneda ARS.
 * @param {number} amount - El monto a formatear.
 * @returns {string} - El monto formateado.
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Genera ranuras de tiempo (ej. "08:00", "08:30") para el modal legacy.
 * @returns {string[]} - Array de strings de tiempo.
 */
export function generateTimeSlots() {
  const slots = [];
  for (let hour = 8; hour < 20; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      slots.push(timeString);
    }
  }
  return slots;
}

/**
 * Muestra una notificación emergente.
 * @param {string} message - El mensaje a mostrar.
 * @param {'info'|'success'|'error'|'warning'} type - El tipo de notificación.
 */
export function showNotification(message, type = "info") {
  // Elimina notificaciones existentes para evitar duplicados
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
  // Estilos en línea (como en tu script original)
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

  // Animación de entrada
  setTimeout(() => {
    notification.style.transform = "translateX(0)"
  }, 100)

  // Auto-cierre
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

// --- Utilidades de Fecha ---

/**
 * Formatea una fecha para mostrarla al usuario (ej. "lunes, 1 de enero de 2025").
 * @param {Date} fecha - El objeto Date a formatear.
 * @returns {string} - La fecha formateada.
 */
export function formatearFecha(fecha) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

/**
 * Formatea una fecha para enviarla a la API (ej. "2025-01-01").
 * @param {Date} fecha - El objeto Date a formatear.
 * @returns {string} - La fecha en formato YYYY-MM-DD.
 */
export function formatearFechaParaAPI(fecha) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Verifica si una fecha es el día de hoy.
 * @param {Date} fecha - La fecha a verificar.
 * @returns {boolean}
 */
export function esHoy(fecha) {
  const hoy = new Date();
  return (
    fecha.getDate() === hoy.getDate() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getFullYear() === hoy.getFullYear()
  );
}

/**
 * Verifica si una fecha es anterior al día de hoy.
 * @param {Date} fecha - La fecha a verificar.
 * @returns {boolean}
 */
export function esFechaPasada(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const comparar = new Date(fecha);
  comparar.setHours(0, 0, 0, 0);
  return comparar < hoy;
}

/**
 * Verifica si el botón "Día Anterior" debe estar habilitado.
 * @returns {boolean}
 */
export function puedeDiaAnterior(fechaActual) {
  const diaAnterior = new Date(fechaActual);
  diaAnterior.setDate(diaAnterior.getDate() - 1);
  return !esFechaPasada(diaAnterior);
}