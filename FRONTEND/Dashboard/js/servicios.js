import { estado } from "./estado.js"
import { showNotification, formatCurrency, confirmarAccion, setBtnLoading, capturarValoresFormulario, restaurarValoresFormulario } from "./utilidades.js"
import { fetchServicios, fetchProfesionales, createOrUpdateServicio, deleteServicio, cambiarEstadoServicio } from "./api.js"

let serviciosFiltrados = []

// Borrador por servicio (clave = id, o 'nuevo') para no perder lo tipeado si el
// modal se cierra sin guardar.
const CAMPOS_SERVICIO = ['servicio-nombre', 'servicio-descripcion', 'servicio-precio', 'servicio-duracion']
const _borradoresServicio = {}

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
    btnCancelarModal.addEventListener('click', cancelarModalServicio)
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

  listaServicios.innerHTML = serviciosFiltrados.map(servicio => {
    const estadoActivo = servicio.activo !== false
    return `
    <div class="elemento-lista" data-id="${servicio.id}">
      <div class="info-elemento">
        <h4>${servicio.nombre}</h4>
        <p class="meta-servicio-card">
          <span class="meta-servicio-desktop">Duración: ${servicio.duracion_min} min | Precio: ${formatCurrency(servicio.precio)}</span>
          <span class="meta-servicio-mobile">${servicio.duracion_min}min | ${formatearPrecioCompacto(servicio.precio)}</span>
        </p>
      </div>
      <div class="acciones-elemento">
        <label class="toggle-switch" title="${estadoActivo ? 'Desactivar' : 'Activar'} servicio">
          <input type="checkbox" class="toggle-estado-servicio" data-servicio-id="${servicio.id}" ${estadoActivo ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </label>
        <button class="boton-icono editar" data-servicio-id="${servicio.id}" title="Editar">
          <i class="fas fa-edit"></i>
        </button>
        <button class="boton-icono eliminar" data-servicio-id="${servicio.id}" title="Anular">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>
  `}).join('')

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

  listaServicios.querySelectorAll('.toggle-estado-servicio').forEach(toggle => {
    toggle.addEventListener('change', async () => {
      const servicioId = parseInt(toggle.dataset.servicioId)
      const activar = toggle.checked

      const ok = await confirmarAccion(
        activar
          ? '¿Estás seguro? El servicio volverá a ofrecerse en nuevas reservas.'
          : '¿Estás seguro? El servicio dejará de ofrecerse en nuevas reservas.',
        activar ? 'Activar servicio' : 'Desactivar servicio',
        activar ? 'Sí, activar' : 'Sí, desactivar'
      )
      if (!ok) {
        toggle.checked = !activar
        return
      }

      cambiarEstadoServicioUI(servicioId, activar)
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
  restaurarValoresFormulario(_borradoresServicio[String(servicioId || 'nuevo')])
  modal.classList.add("activo")
  document.body.style.overflow = "hidden"
}

export function cerrarModalServicio() {
  const idActual = document.getElementById("servicio-id")?.value || 'nuevo'
  _borradoresServicio[idActual] = capturarValoresFormulario(CAMPOS_SERVICIO)
  _ocultarModalServicio()
}

// Oculta el modal sin capturar borrador (se usa tras guardar con éxito).
function _ocultarModalServicio() {
  const modal = document.getElementById("modal-servicio")
  modal.classList.remove("activo")
  document.body.style.overflow = ""
  const contenedor = document.getElementById("selector-profesionales-servicio")
  if (contenedor) contenedor.innerHTML = ''
}

// "Cancelar" es una acción explícita de descarte: a diferencia de la X, borra
// cualquier borrador pendiente para este formulario.
function cancelarModalServicio() {
  const idActual = document.getElementById("servicio-id")?.value || 'nuevo'
  delete _borradoresServicio[idActual]
  _ocultarModalServicio()
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
    delete _borradoresServicio[servicioData.id || 'nuevo']
    showNotification(
      servicioData.id ? "Servicio actualizado correctamente" : "Servicio creado correctamente",
      "success",
    )
    _ocultarModalServicio()
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
    '¿Estás seguro? El servicio se va a eliminar: deja de ofrecerse en nuevas reservas y no se puede reactivar desde acá. El historial se conserva.',
    'Eliminar servicio',
    'Sí, eliminar'
  )
  if (!ok) return

  const resultado = await deleteServicio(servicioId)
  if (resultado) {
    showNotification("Servicio eliminar correctamente", "success")
    await cargarServicios()
    renderizarServicios()
    actualizarMetricasServicios()
  } else {
    showNotification("Error al eliminar el servicio", "error")
  }
}

async function cambiarEstadoServicioUI(servicioId, activo) {
  const resultado = await cambiarEstadoServicio(servicioId, activo)
  if (resultado) {
    showNotification(`Servicio ${activo ? 'activado' : 'desactivado'} correctamente`, "success")
    await cargarServicios()
    renderizarServicios()
    actualizarMetricasServicios()
  } else {
    showNotification(`Error al ${activo ? 'activar' : 'desactivar'} el servicio`, "error")
    renderizarServicios()
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
