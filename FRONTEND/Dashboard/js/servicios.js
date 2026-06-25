import { estado } from "./estado.js"
import { showNotification, formatCurrency, confirmarAccion, setBtnLoading } from "./utilidades.js"
import { fetchServicios, fetchProfesionales, createOrUpdateServicio, deleteServicio } from "./api.js"

let serviciosFiltrados = []

const COLORES_AVATAR = ["#1a1a1a", "#2f6d4e", "#a34b20", "#2c4ea3", "#6b2fa0", "#b5461a", "#1e6a7c", "#7a3030"]

function colorParaId(id) {
  return COLORES_AVATAR[id % COLORES_AVATAR.length]
}

function obtenerIniciales(nombre) {
  return nombre.split(" ").map(p => p[0]).join("").toUpperCase().substring(0, 2)
}

function formatearPrecioCompacto(precio) {
  return `$ ${Math.round(Number(precio) || 0)}`
}

export async function inicializarServicios() {
  await cargarServicios()
  setupServiciosEventListeners()
  renderizarServicios()
  actualizarMetricasServicios()
}

async function cargarServicios() {
  try {
    estado.servicios = await fetchServicios()
    serviciosFiltrados = [...estado.servicios]
    if (!estado.profesionales.length) {
      await cargarProfesionalesActivos()
    }
  } catch (error) {
    console.error("Error al cargar servicios", error)
    estado.servicios = []
    serviciosFiltrados = []
    showNotification("Error al cargar servicios", "error")
  }
}

async function cargarProfesionalesActivos() {
  const profesionales = await fetchProfesionales()
  estado.profesionales = profesionales.map((profesional, index) => ({
    ...profesional,
    color: colorParaId(profesional.id ?? index)
  }))
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

  const btnCancelarModal = document.querySelector('#modal-servicio .btn-cancelar-servicio')
  if (btnCancelarModal) {
    btnCancelarModal.addEventListener('click', cerrarModalServicio)
  }

  const formServicio = document.getElementById('form-servicio')
  if (formServicio) {
    formServicio.addEventListener('submit', guardarServicio)
  }
}

function buildProsHTML(servicio) {
  const profesionales = servicio.empleados_asignados || []
  if (!profesionales.length) return '<span class="label-sin-pros">Sin profesionales asignados</span>'

  return profesionales.map(pro => {
    const color = colorParaId(pro.id)
    const iniciales = obtenerIniciales(pro.nombre)
    return `<span class="badge-pro-servicio" style="background:${color}">
      <span class="mini-avatar">${iniciales}</span>${pro.nombre.split(' ')[0]}
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
        <p class="meta-servicio-card">
          <span class="meta-servicio-desktop">Duración: ${servicio.duracion_min} min | Precio: ${formatCurrency(servicio.precio)}</span>
          <span class="meta-servicio-mobile">${servicio.duracion_min}min | ${formatearPrecioCompacto(servicio.precio)}</span>
        </p>
        ${servicio.descripcion ? `<small class="descripcion-servicio-card">${servicio.descripcion}</small>` : ''}
        <div class="pros-asignados-lista">${buildProsHTML(servicio)}</div>
      </div>
      <div class="acciones-elemento">
        <button class="boton-icono editar" data-servicio-id="${servicio.id}" title="Editar">
          <i class="fas fa-pencil-alt"></i>
        </button>
        <button class="boton-icono eliminar" data-servicio-id="${servicio.id}" title="Dar de baja">
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

function actualizarContadorPros(totalSeleccionados = 0, totalDisponibles = 0) {
  const pill = document.getElementById('contador-pros-servicio')
  if (!pill) return
  pill.textContent = totalSeleccionados === 0 ? 'Sin asignados' : `${totalSeleccionados} asignados`
  pill.classList.toggle('vacio', totalSeleccionados === 0)
}

function poblarSelectorProfesionales(servicio = null) {
  const contenedor = document.getElementById("selector-profesionales-servicio")
  if (!contenedor) return

  const profesionales = estado.profesionales || []
  if (profesionales.length === 0) {
    contenedor.innerHTML = '<p class="sin-pros-mensaje"><i class="fas fa-user-slash"></i>No hay profesionales activos registrados.</p>'
    actualizarContadorPros(0, 0)
    return
  }

  const asignados = servicio?.empleados_asignados || []

  if (!asignados.length) {
    contenedor.innerHTML = '<p class="sin-pros-mensaje"><i class="fas fa-info-circle"></i>Asignación gestionada desde el módulo de empleados.</p>'
    actualizarContadorPros(0, profesionales.length)
    return
  }

  contenedor.innerHTML = asignados.map(pro => {
    const color = colorParaId(pro.id)
    const nombreCorto = pro.nombre.split(' ').slice(0, 2).join(' ')
    return `
      <div class="chip-profesional seleccionado chip-profesional--readonly" style="--chip-color:${color}">
        <span class="nombre-chip">${nombreCorto}</span>
        <span class="chip-check-box"></span>
      </div>`
  }).join('')

  actualizarContadorPros(asignados.length, profesionales.length)
}

export async function abrirModalServicio(servicioId = null) {
  await cargarProfesionalesActivos()

  const modal = document.getElementById("modal-servicio")
  const titulo = document.getElementById("titulo-modal-servicio")
  const form = document.getElementById("form-servicio")

  let servicio = null
  if (servicioId) {
    servicio = estado.servicios.find((s) => s.id === servicioId)
    if (!servicio) return

    titulo.textContent = "Editar Servicio"
    document.getElementById("servicio-id").value = servicio.id
    document.getElementById("servicio-nombre").value = servicio.nombre
    document.getElementById("servicio-descripcion").value = servicio.descripcion || ""
    document.getElementById("servicio-precio").value = servicio.precio
    document.getElementById("servicio-duracion").value = servicio.duracion_min
  } else {
    titulo.textContent = "Nuevo Servicio"
    form.reset()
    document.getElementById("servicio-id").value = ""
  }

  poblarSelectorProfesionales(servicio)
  modal.classList.add("activo")
  document.body.style.overflow = "hidden"
}

export function cerrarModalServicio() {
  const modal = document.getElementById("modal-servicio")
  modal.classList.remove("activo")
  document.body.style.overflow = ""
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
    duracion_min: Number.parseInt(document.getElementById("servicio-duracion").value, 10),
    empleado_ids: estado.servicios.find(s => String(s.id) === String(document.getElementById("servicio-id").value))?.empleado_ids || [],
  }

  const resultado = await createOrUpdateServicio(servicioData)
  restaurar()
  if (resultado) {
    showNotification(
      servicioData.id ? "Servicio actualizado correctamente" : "Servicio creado correctamente",
      "success",
    )
    cerrarModalServicio()
    await cargarServicios()
    await cargarProfesionalesActivos()
    renderizarServicios()
    actualizarMetricasServicios()
  } else {
    showNotification("Error al guardar servicio", "error")
  }
}

export async function eliminarServicioConfirm(servicioId) {
  const ok = await confirmarAccion(
    '¿Estás seguro? El servicio se dará de baja, dejará de ofrecerse en nuevas reservas y el historial se conservará.',
    'Dar de baja servicio',
    'Sí, dar de baja'
  )
  if (!ok) return

  const resultado = await deleteServicio(servicioId)
  if (resultado) {
    showNotification("Servicio dado de baja correctamente", "success")
    await cargarServicios()
    renderizarServicios()
    actualizarMetricasServicios()
  } else {
    showNotification("Error al dar de baja el servicio", "error")
  }
}

function actualizarMetricasServicios() {
  const servicios = estado.servicios || []
  const totalServicios = servicios.length

  const precioPromedio = servicios.length > 0
    ? servicios.reduce((sum, s) => sum + Number(s.precio || 0), 0) / servicios.length
    : 0

  const duracionPromedio = servicios.length > 0
    ? Math.round(servicios.reduce((sum, s) => sum + Number(s.duracion_min || 0), 0) / servicios.length)
    : 0

  const totalServiciosEl = document.getElementById('total-servicios')
  const precioPromedioEl = document.getElementById('precio-promedio')
  const duracionPromedioEl = document.getElementById('duracion-promedio')

  if (totalServiciosEl) totalServiciosEl.textContent = totalServicios
  if (precioPromedioEl) precioPromedioEl.textContent = formatCurrency(precioPromedio)
  if (duracionPromedioEl) duracionPromedioEl.textContent = `${duracionPromedio}min`
}
