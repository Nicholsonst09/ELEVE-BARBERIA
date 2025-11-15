import { estado } from "./estado.js"
import { showNotification, formatCurrency } from "./utilidades.js"
import { fetchServicios, createOrUpdateServicio, deleteServicio } from "./api.js"

let serviciosFiltrados = []

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
    actualizarMetricasServicios()
  } catch (error) {
    console.error("Error al cargar servicios", error)
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
        <p>Duración: ${servicio.duracion} min | Precio: $${servicio.precio}</p>
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
    document.getElementById("servicio-duracion").value = servicio.duracion
  } else {
    titulo.textContent = "Nuevo Servicio"
    form.reset()
    document.getElementById("servicio-id").value = ""
  }

  modal.classList.add("activo")
  document.body.style.overflow = "hidden"
}

export function cerrarModalServicio() {
  const modal = document.getElementById("modal-servicio")
  modal.classList.remove("activo")
  document.body.style.overflow = ""
}

export async function guardarServicio(e) {
  e.preventDefault()

  const servicioData = {
    id: document.getElementById("servicio-id").value || null,
    nombre: document.getElementById("servicio-nombre").value.trim(),
    descripcion: document.getElementById("servicio-descripcion").value.trim(),
    precio: Number.parseFloat(document.getElementById("servicio-precio").value),
    duracion: Number.parseInt(document.getElementById("servicio-duracion").value),
  }

  const resultado = await createOrUpdateServicio(servicioData)
  if (resultado) {
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
  if (!confirm("¿Estás seguro de que deseas eliminar este servicio?")) return

  const resultado = await deleteServicio(servicioId)
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