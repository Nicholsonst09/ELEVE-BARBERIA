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
 * Lee los valores actuales de un set de campos por id (para guardarlos como borrador).
 * @param {string[]} ids - IDs de los inputs/selects/textareas a capturar.
 * @returns {Object} - Mapa id -> valor (o booleano para checkboxes).
 */
export function capturarValoresFormulario(ids) {
  const valores = {}
  ids.forEach((id) => {
    const el = document.getElementById(id)
    if (!el) return
    valores[id] = el.type === 'checkbox' ? el.checked : el.value
  })
  return valores
}

/**
 * Aplica un mapa id -> valor (generado por capturarValoresFormulario) a los campos del DOM.
 * @param {Object|null} valores - Mapa id -> valor.
 */
export function restaurarValoresFormulario(valores) {
  if (!valores) return
  Object.entries(valores).forEach(([id, val]) => {
    const el = document.getElementById(id)
    if (!el) return
    if (el.type === 'checkbox') el.checked = val
    else el.value = val
  })
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

  // Auto-cierre a los 5 s
  setTimeout(() => cerrarToast(toast), 5000)
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
  // Permite retroceder hasta ayer para mantener consistencia visual en la agenda.
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  ayer.setHours(0, 0, 0, 0);

  const diaAnterior = new Date(fechaActual);
  diaAnterior.setDate(diaAnterior.getDate() - 1);
  diaAnterior.setHours(0, 0, 0, 0);

  return diaAnterior >= ayer;
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
  subtexto  = '',
  textoBtnCancel = 'Cancelar'
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
    btnCancel.textContent = textoBtnCancel
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
      document.removeEventListener('keydown', onKey)
      resolve(resultado)
    }

    function onOk()     { cerrar(true) }
    function onCancel() { cerrar(false) }
    function onKey(e)   { if (e.key === 'Escape') cerrar(false) }

    btnOk.addEventListener('click',     onOk)
    btnCancel.addEventListener('click', onCancel)
    if (btnCerrar) btnCerrar.addEventListener('click', onCancel)
    document.addEventListener('keydown', onKey)
  })
}

export function showPopupNotification(
  mensaje,
  titulo = 'Aviso',
  textoBtnOk = 'Entendido'
) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-confirmar')
    const tituloEl = document.getElementById('confirmar-titulo')
    const mensajeEl = document.getElementById('confirmar-mensaje')
    const btnOk = document.getElementById('confirmar-ok')
    const btnCancel = document.getElementById('confirmar-cancelar')
    const btnCerrar = document.getElementById('confirmar-cerrar')
    const subtextoEl = document.getElementById('confirmar-subtexto')

    if (!modal || !tituloEl || !mensajeEl || !btnOk || !btnCancel) {
      window.alert(mensaje)
      resolve(true)
      return
    }

    const cancelDisplay = btnCancel.style.display
    const closeDisplay = btnCerrar ? btnCerrar.style.display : ''
    const subtextoDisplay = subtextoEl ? subtextoEl.style.display : ''

    tituloEl.textContent = titulo
    mensajeEl.textContent = mensaje
    btnOk.textContent = textoBtnOk
    btnCancel.style.display = 'none'
    if (btnCerrar) btnCerrar.style.display = 'none'
    if (subtextoEl) subtextoEl.style.display = 'none'

    modal.classList.add('activo')
    document.body.style.overflow = 'hidden'

    function cerrar() {
      modal.classList.remove('activo')
      document.body.style.overflow = ''
      btnCancel.style.display = cancelDisplay
      if (btnCerrar) btnCerrar.style.display = closeDisplay
      if (subtextoEl) subtextoEl.style.display = subtextoDisplay
      btnOk.removeEventListener('click', onOk)
      document.removeEventListener('keydown', onKey)
      resolve(true)
    }

    function onOk() { cerrar() }
    function onKey(e) { if (e.key === 'Escape') cerrar() }

    btnOk.addEventListener('click', onOk)
    document.addEventListener('keydown', onKey)
  })
}