import { estado } from "./estado.js"
import { showNotification, formatCurrency, confirmarAccion, setBtnLoading } from "./utilidades.js"
import { dbGetServicios, dbSaveServicio, dbDeleteServicio } from "./db.js"
import { fetchServicios } from "./api.js"

let serviciosFiltrados = []

// ─── LocalStorage helpers para profesionales por servicio ────────────────────
const LS_KEY = "eleve_servicio_profesionales"

function cargarAsignacionesLS() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}")
  } catch {
    return {}
  }
}

function guardarAsignacionesLS(asignaciones) {
  localStorage.setItem(LS_KEY, JSON.stringify(asignaciones))
}

export function getProfesionalesDeServicio(servicioId) {
  const all = cargarAsignacionesLS()
  return all[servicioId] || []
}

function setProfesionalesDeServicio(servicioId, empleadoIds) {
  const all = cargarAsignacionesLS()
  all[servicioId] = empleadoIds
  guardarAsignacionesLS(all)
}

// ─── Paleta de colores para avatares ─────────────────────────────────────────
const COLORES_AVATAR = ["#1a1a1a", "#2f6d4e", "#a34b20", "#2c4ea3", "#6b2fa0", "#b5461a", "#1e6a7c", "#7a3030"]

function colorParaId(id) {
  return COLORES_AVATAR[id % COLORES_AVATAR.length]
}

function obtenerIniciales(nombre) {
  return nombre.split(" ").map(p => p[0]).join("").toUpperCase().substring(0, 2)
}

export async function inicializarServicios() {
  await cargarServicios()
  setupServiciosEventListeners()
  renderizarServicios()
  actualizarMetricasServicios()
}

async function cargarServicios() {
  try {
    const serviciosAPI = await fetchServicios();
    estado.servicios = serviciosAPI.length > 0 ? serviciosAPI : dbGetServicios();
    serviciosFiltrados = [...estado.servicios]
    actualizarMetricasServicios()
  } catch (error) {
    console.error("Error al cargar servicios", error)
    estado.servicios = dbGetServicios();
    serviciosFiltrados = [...estado.servicios]
    showNotification("Error al cargar servicios", "error")
  }
}

function setupServiciosEventListeners() {
  const buscadorServicios = document.getElementById("buscador-servicios")
  if (buscadorServicios) {
    buscadorServicios.addEventListener("input", (e) => {
      const termino = e.target.value.toLowerCase()
      serviciosFiltrados = estado.servicios.filter(
        (servicio) =>
          servicio.nombre.toLowerCase().includes(termino) ||
          (servicio.descripcion && servicio.descripcion.toLowerCase().includes(termino)),
      )
      renderizarServicios()
    })
  }

  const btnNuevoServicio = document.getElementById("btn-nuevo-servicio")
  if (btnNuevoServicio) {
    btnNuevoServicio.addEventListener("click", () => abrirModalServicio())
  }

  const btnCerrarModal = document.querySelector('#modal-servicio .cerrar-modal')
  if (btnCerrarModal) {
    btnCerrarModal.addEventListener('click', cerrarModalServicio)
  }
}

function buildProsHTML(servicioId) {
  const ids = getProfesionalesDeServicio(servicioId)
  if (!ids.length) return '<span class="label-sin-pros">Sin profesionales asignados</span>'
  const pros = estado.profesionales.filter(p => ids.includes(p.id))
  if (!pros.length) return '<span class="label-sin-pros">Sin profesionales asignados</span>'
  return pros.map(p => {
    const color = colorParaId(p.id)
    const iniciales = obtenerIniciales(p.nombre)
    return `<span class="badge-pro-servicio" style="background:${color}">
      <span class="mini-avatar">${iniciales}</span>${p.nombre.split(' ')[0]}
    </span>`
  }).join('')
}

function renderizarServicios() {
  const listaServicios = document.getElementById('lista-servicios')
  if (!listaServicios) return

  if (serviciosFiltrados.length === 0) {
    listaServicios.innerHTML = '<p class="sin-resultados">No hay servicios registrados</p>'
    return
  }

  listaServicios.innerHTML = serviciosFiltrados.map(servicio => `
    <div class="elemento-lista" data-id="${servicio.id}">
      <div class="info-elemento">
        <h4>${servicio.nombre}</h4>
        <p>Duración: ${servicio.duracion_min ?? servicio.duracion} min | Precio: $${servicio.precio}</p>
        <div class="pros-asignados-lista">${buildProsHTML(servicio.id)}</div>
      </div>
      <div class="acciones-elemento">
        <button class="boton-icono editar" data-servicio-id="${servicio.id}" title="Editar">
          <i class="fas fa-pencil-alt"></i>
        </button>
        <button class="boton-icono eliminar" data-servicio-id="${servicio.id}" title="Eliminar">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>
  `).join('')

  listaServicios.querySelectorAll('.boton-icono').forEach(btn => {
    btn.addEventListener('click', () => {
      const servicioId = parseInt(btn.dataset.servicioId)

      if (btn.classList.contains('editar')) {
        abrirModalServicio(servicioId)
      } else if (btn.classList.contains('eliminar')) {
        eliminarServicioConfirm(servicioId)
      }
    })
  })
}

function actualizarContadorPros() {
  const pill = document.getElementById('contador-pros-servicio')
  if (!pill) return
  const total = document.querySelectorAll('#selector-profesionales-servicio .chip-profesional').length
  const sel   = document.querySelectorAll('#selector-profesionales-servicio .chip-profesional.seleccionado').length
  pill.textContent = sel === 0 ? '0 seleccionados' : `${sel} de ${total} seleccionados`
  pill.classList.toggle('vacio', sel === 0)
}

function poblarSelectorProfesionales(servicioId) {
  const contenedor = document.getElementById("selector-profesionales-servicio")
  if (!contenedor) return

  const profesionales = estado.profesionales || []
  if (profesionales.length === 0) {
    contenedor.innerHTML = '<p class="sin-pros-mensaje"><i class="fas fa-user-slash"></i>No hay profesionales registrados.</p>'
    actualizarContadorPros()
    return
  }

  const asignados = servicioId ? getProfesionalesDeServicio(servicioId) : []

  contenedor.innerHTML = profesionales.map(pro => {
    const color = colorParaId(pro.id)
    const seleccionado = asignados.includes(pro.id) ? 'seleccionado' : ''
    const nombreCorto = pro.nombre.split(' ').slice(0, 2).join(' ')
    return `
      <div class="chip-profesional ${seleccionado}" data-pro-id="${pro.id}" style="--chip-color:${color}">
        <span class="nombre-chip">${nombreCorto}</span>
        <span class="chip-check-box"></span>
      </div>`
  }).join('')

  actualizarContadorPros()

  contenedor.querySelectorAll('.chip-profesional').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('seleccionado')
      actualizarContadorPros()
    })
  })
}

function obtenerIdsSeleccionados() {
  return Array.from(
    document.querySelectorAll('#selector-profesionales-servicio .chip-profesional.seleccionado')
  ).map(el => parseInt(el.dataset.proId))
}

export function abrirModalServicio(servicioId = null) {
  const modal = document.getElementById("modal-servicio")
  const titulo = document.getElementById("titulo-modal-servicio")
  const form = document.getElementById("form-servicio")

  if (servicioId) {
    const servicio = estado.servicios.find((s) => s.id === servicioId)
    if (!servicio) return

    titulo.textContent = "Editar Servicio"
    document.getElementById("servicio-id").value = servicio.id
    document.getElementById("servicio-nombre").value = servicio.nombre
    document.getElementById("servicio-descripcion").value = servicio.descripcion || ""
    document.getElementById("servicio-precio").value = servicio.precio
    document.getElementById("servicio-duracion").value = servicio.duracion_min ?? servicio.duracion
  } else {
    titulo.textContent = "Nuevo Servicio"
    form.reset()
    document.getElementById("servicio-id").value = ""
  }

  poblarSelectorProfesionales(servicioId)
  modal.classList.add("activo")
  document.body.style.overflow = "hidden"
}

export function cerrarModalServicio() {
  const modal = document.getElementById("modal-servicio")
  modal.classList.remove("activo")
  document.body.style.overflow = ""
  // Limpiar chips
  const contenedor = document.getElementById("selector-profesionales-servicio")
  if (contenedor) contenedor.innerHTML = ''
}

export async function guardarServicio(e) {
  e.preventDefault()

  const btn = e.target.closest('form')?.querySelector('[type="submit"]') ||
               document.querySelector('#modal-servicio [type="submit"]')
  const restaurar = setBtnLoading(btn)

  const servicioData = {
    id: document.getElementById("servicio-id").value || null,
    nombre: document.getElementById("servicio-nombre").value.trim(),
    descripcion: document.getElementById("servicio-descripcion").value.trim(),
    precio: Number.parseFloat(document.getElementById("servicio-precio").value),
    duracion: Number.parseInt(document.getElementById("servicio-duracion").value),
  }

  // Capturar profesionales seleccionados antes de cerrar el modal
  const idsSeleccionados = obtenerIdsSeleccionados()

  const resultado = dbSaveServicio(servicioData)
  restaurar()
  if (resultado) {
    // Usar el id devuelto por el storage si es creación, o el existente si es edición
    const idFinal = resultado.id || servicioData.id
    if (idFinal) {
      setProfesionalesDeServicio(idFinal, idsSeleccionados)
    }
    showNotification(
      servicioData.id ? "Servicio actualizado correctamente" : "Servicio creado correctamente",
      "success",
    )
    cerrarModalServicio()
    await cargarServicios()
    renderizarServicios()
    actualizarMetricasServicios()
  } else {
    showNotification("Error al guardar servicio", "error")
  }
}

export async function eliminarServicioConfirm(servicioId) {
  const ok = await confirmarAccion(
    '¿Estás seguro de que deseas eliminar este servicio? Esta acción no se puede deshacer.',
    'Eliminar servicio',
    'Sí, eliminar'
  )
  if (!ok) return

  const resultado = dbDeleteServicio(servicioId)
  if (resultado) {
    showNotification("Servicio eliminado correctamente", "success")
    await cargarServicios()
    renderizarServicios()
    actualizarMetricasServicios()
  } else {
    showNotification("Error al eliminar servicio", "error")
  }
}
/**
 * Actualiza las métricas de servicios
 */
function actualizarMetricasServicios() {
  const servicios = estado.servicios || [];
  const totalServicios = servicios.length;

  const precioPromedio = servicios.length > 0
    ? servicios.reduce((sum, s) => sum + (s.precio || 0), 0) / servicios.length
    : 0;

  const duracionPromedio = servicios.length > 0
    ? Math.round(servicios.reduce((sum, s) => sum + (s.duracion || 0), 0) / servicios.length)
    : 0;

  const totalServiciosEl = document.getElementById('total-servicios');
  const precioPromedioEl = document.getElementById('precio-promedio');
  const duracionPromedioEl = document.getElementById('duracion-promedio');

  if (totalServiciosEl) totalServiciosEl.textContent = totalServicios;
  if (precioPromedioEl) precioPromedioEl.textContent = `$${precioPromedio.toFixed(0)}`;
  if (duracionPromedioEl) duracionPromedioEl.textContent = `${duracionPromedio}min`;
}