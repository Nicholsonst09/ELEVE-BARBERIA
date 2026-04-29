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
 * Muestra una notificación Toast.
 * @param {string} message - El mensaje a mostrar.
 * @param {'info'|'success'|'error'|'warning'} type - El tipo de notificación.
 */
export function showNotification(message, type = "info") {
  // Elimina toasts existentes para evitar acumulación
  document.querySelectorAll(".toast").forEach((t) => t.remove())

  const iconos = {
    success: "fa-check-circle",
    error:   "fa-exclamation-circle",
    warning: "fa-exclamation-triangle",
    info:    "fa-info-circle",
  }

  const toast = document.createElement("div")
  toast.className = `toast toast-${type}`
  toast.innerHTML = `
    <i class="fas ${iconos[type] ?? iconos.info} toast-icon"></i>
    <span class="toast-mensaje">${message}</span>
    <button class="toast-cerrar" aria-label="Cerrar">
      <i class="fas fa-times"></i>
    </button>
  `

  document.body.appendChild(toast)

  // Forzar reflow para que la transición de entrada funcione
  toast.offsetHeight
  toast.classList.add("toast-visible")

  // Cerrar manual
  toast.querySelector(".toast-cerrar").addEventListener("click", () => cerrarToast(toast))

  // Auto-cierre a los 4 s
  setTimeout(() => cerrarToast(toast), 4000)
}

function cerrarToast(toast) {
  toast.classList.remove("toast-visible")
  toast.addEventListener("transitionend", () => toast.remove(), { once: true })
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

/**
 * Muestra un popup de confirmación y devuelve una Promise<boolean>.
 * Reemplaza al window.confirm() nativo.
 * @param {string} mensaje  - Texto descriptivo de la acción.
 * @param {string} titulo   - Título del popup (opcional).
 * @param {string} textoBtnOk - Texto del botón de confirmar (opcional).
 */
/**
 * Pone un botón en estado loading (deshabilita + cambia texto).
 * Devuelve una función para restaurarlo.
 * @param {HTMLButtonElement} btn
 * @param {string} texto - Texto mientras carga. Default "Guardando..."
 * @returns {() => void} restore - Llámala para volver al estado original.
 */
export function setBtnLoading(btn, texto = 'Guardando...') {
  if (!btn) return () => {}
  const textoOriginal = btn.innerHTML
  btn.disabled = true
  btn.innerHTML = `<span class="spinner-btn"></span>${texto}`
  return () => {
    btn.disabled = false
    btn.innerHTML = textoOriginal
  }
}

export function confirmarAccion(
  mensaje,
  titulo    = '¿Confirmar acción?',
  textoBtnOk = 'Confirmar',
  subtexto  = ''
) {
  return new Promise((resolve) => {
    const modal     = document.getElementById('modal-confirmar')
    const tituloEl  = document.getElementById('confirmar-titulo')
    const mensajeEl = document.getElementById('confirmar-mensaje')
    const btnOk     = document.getElementById('confirmar-ok')
    const btnCancel = document.getElementById('confirmar-cancelar')
    const btnCerrar = document.getElementById('confirmar-cerrar')

    // Fallback por si el HTML no tiene el modal todavía
    if (!modal) { resolve(window.confirm(mensaje)); return }

    tituloEl.textContent  = titulo
    mensajeEl.textContent = mensaje
    btnOk.textContent     = textoBtnOk

    let subtextoEl = document.getElementById('confirmar-subtexto')
    if (subtexto) {
      if (!subtextoEl) {
        subtextoEl = document.createElement('p')
        subtextoEl.id = 'confirmar-subtexto'
        subtextoEl.className = 'confirmar-subtexto'
        mensajeEl.insertAdjacentElement('afterend', subtextoEl)
      }
      subtextoEl.textContent = subtexto
      subtextoEl.style.display = ''
    } else if (subtextoEl) {
      subtextoEl.style.display = 'none'
    }

    modal.classList.add('activo')
    document.body.style.overflow = 'hidden'

    function cerrar(resultado) {
      modal.classList.remove('activo')
      document.body.style.overflow = ''
      btnOk.removeEventListener('click', onOk)
      btnCancel.removeEventListener('click', onCancel)
      if (btnCerrar) btnCerrar.removeEventListener('click', onCancel)
      modal.removeEventListener('click', onFondo)
      document.removeEventListener('keydown', onKey)
      resolve(resultado)
    }

    function onOk()     { cerrar(true) }
    function onCancel() { cerrar(false) }
    function onFondo(e) { if (e.target === modal) cerrar(false) }
    function onKey(e)   { if (e.key === 'Escape') cerrar(false) }

    btnOk.addEventListener('click',     onOk)
    btnCancel.addEventListener('click', onCancel)
    if (btnCerrar) btnCerrar.addEventListener('click', onCancel)
    modal.addEventListener('click',     onFondo)
    document.addEventListener('keydown', onKey)
  })
}