import { estado } from "./estado.js"
import { showNotification } from "./utilidades.js"
import { fetchProfesionales, createOrUpdateEmpleado, deleteEmpleado } from "./api.js"

let empleadosFiltrados = []

export async function inicializarEmpleados() {
  await cargarEmpleados()
  setupEmpleadosEventListeners()
  renderizarEmpleados()
  renderizarMetricasEmpleados()
}

// MODIFICAR la función cargarEmpleados
async function cargarEmpleados() {
  try {
    estado.profesionales = await fetchProfesionales()
    empleadosFiltrados = [...estado.profesionales]
    renderizarMetricasEmpleados()
  } catch (error) {
    console.error("Error al cargar empleados", error)
    showNotification("Error al cargar empleados", "error")
  }
}

function setupEmpleadosEventListeners() {
  const buscadorEmpleados = document.getElementById("buscador-empleados")
  if (buscadorEmpleados) {
    buscadorEmpleados.addEventListener("input", (e) => {
      const termino = e.target.value.toLowerCase()
      empleadosFiltrados = estado.profesionales.filter(
        (empleado) =>
          empleado.nombre.toLowerCase().includes(termino) ||
          (empleado.especialidad && empleado.especialidad.toLowerCase().includes(termino)),
      )
      renderizarEmpleados()
    })
  }

  const btnNuevoEmpleado = document.getElementById("btn-nuevo-empleado")
  if (btnNuevoEmpleado) {
    btnNuevoEmpleado.addEventListener("click", () => abrirModalEmpleado())
  }

  const btnCerrarModal = document.querySelector('#modal-empleado .cerrar-modal')
  if (btnCerrarModal) {
    btnCerrarModal.addEventListener('click', cerrarModalEmpleado)
  }
}

function obtenerIniciales(nombre) {
  return nombre
    .split(' ')
    .map(palabra => palabra[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

function renderizarEmpleados() {
  const listaEmpleados = document.getElementById('lista-empleados')
  if (!listaEmpleados) return

  if (empleadosFiltrados.length === 0) {
    listaEmpleados.innerHTML = '<p class="sin-resultados">No hay empleados registrados</p>'
    return
  }

  listaEmpleados.innerHTML = empleadosFiltrados.map(empleado => {
    const iniciales = obtenerIniciales(empleado.nombre)
    const estadoActivo = empleado.activo !== false
    const claseEstado = estadoActivo ? 'activo' : 'inactivo'
    
    return `
      <div class="elemento-lista">
        <div class="avatar-empleado">${iniciales}</div>
        <div class="info-elemento">
          <div class="nombre-con-estado">
            <h4>${empleado.nombre}</h4>
            <span class="indicador-estado ${claseEstado}" title="${estadoActivo ? 'Activo' : 'Inactivo'}"></span>
          </div>
          <p>${empleado.especialidad || 'Sin especialidad'}</p>
          <small>${empleado.telefono || 'Sin teléfono'}</small>
        </div>
        <div class="acciones-elemento">
          <button class="boton-icono editar" data-empleado-id="${empleado.id}" title="Editar">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button class="boton-icono eliminar" data-empleado-id="${empleado.id}" title="Eliminar">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    `
  }).join('')

  listaEmpleados.querySelectorAll('.boton-icono').forEach(btn => {
    btn.addEventListener('click', () => {
      const empleadoId = parseInt(btn.dataset.empleadoId)
      
      if (btn.classList.contains('editar')) {
        abrirModalEmpleado(empleadoId)
      } else if (btn.classList.contains('eliminar')) {
        eliminarEmpleadoConfirm(empleadoId)
      }
    })
  })
}

export function abrirModalEmpleado(empleadoId = null) {
  const modal = document.getElementById("modal-empleado")
  const titulo = document.getElementById("titulo-modal-empleado")
  const form = document.getElementById("form-empleado")

  if (empleadoId) {
    const empleado = estado.profesionales.find((e) => e.id === empleadoId)
    if (!empleado) return

    titulo.textContent = "Editar Empleado"
    document.getElementById("empleado-id").value = empleado.id
    document.getElementById("empleado-nombre").value = empleado.nombre
    document.getElementById("empleado-telefono").value = empleado.telefono || ""
    document.getElementById("empleado-email").value = empleado.email || ""
    document.getElementById("empleado-especialidad").value = empleado.especialidad || ""
  } else {
    titulo.textContent = "Nuevo Empleado"
    form.reset()
    document.getElementById("empleado-id").value = ""
  }

  modal.classList.add("activo")
  document.body.style.overflow = "hidden"
}

export function cerrarModalEmpleado() {
  const modal = document.getElementById("modal-empleado")
  modal.classList.remove("activo")
  document.body.style.overflow = ""
}

export async function guardarEmpleado(e) {
  e.preventDefault()

  const empleadoData = {
    id: document.getElementById("empleado-id").value || null,
    nombre: document.getElementById("empleado-nombre").value.trim(),
    telefono: document.getElementById("empleado-telefono").value.trim(),
    email: document.getElementById("empleado-email").value.trim(),
    especialidad: document.getElementById("empleado-especialidad").value.trim(),
  }

  const resultado = await createOrUpdateEmpleado(empleadoData)
  if (resultado) {
    showNotification(
      empleadoData.id ? "Empleado actualizado correctamente" : "Empleado creado correctamente",
      "success",
    )
    cerrarModalEmpleado()
    await cargarEmpleados()
    renderizarEmpleados()
  } else {
    showNotification("Error al guardar empleado", "error")
  }
}

export async function eliminarEmpleadoConfirm(empleadoId) {
  if (!confirm("¿Estás seguro de que deseas eliminar este empleado?")) return

  const resultado = await deleteEmpleado(empleadoId)
  if (resultado) {
    showNotification("Empleado eliminado correctamente", "success")
    await cargarEmpleados()
    renderizarEmpleados()
  } else {
    showNotification("Error al eliminar empleado", "error")
  }
}
/**
 * Renderiza las métricas y KPIs de empleados
 */
export function renderizarMetricasEmpleados() {
  calcularMetricasGenerales();
}

/**
 * Calcula y muestra las métricas generales
 */
function calcularMetricasGenerales() {
  const totalEmpleados = estado.profesionales.length;
  const empleadosActivos = estado.profesionales.filter(e => e.activo !== false).length;
  
  // Datos simulados - reemplazar con datos reales de tu API
  const turnosHoy = 12;
  const promedioServicios = totalEmpleados > 0 ? Math.round(turnosHoy / totalEmpleados) : 0;
  const horasTrabajadas = 156;

  document.getElementById('total-empleados').textContent = totalEmpleados;
  document.getElementById('empleados-activos-detalle').textContent = `${empleadosActivos} activos`;
  document.getElementById('turnos-hoy').textContent = turnosHoy;
  document.getElementById('promedio-servicios').textContent = promedioServicios;
  document.getElementById('horas-trabajadas').textContent = `${horasTrabajadas}h`;
}

/**
 * Renderiza los indicadores de rendimiento
 */
function renderizarIndicadoresRendimiento() {
  const container = document.getElementById('indicadores-empleados');
  if (!container) return;

  // Datos simulados - reemplazar con datos reales
  const indicadores = [
    { titulo: 'Puntualidad', porcentaje: 95 },
    { titulo: 'Satisfacción Cliente', porcentaje: 88 },
    { titulo: 'Productividad', porcentaje: 92 },
    { titulo: 'Asistencia', porcentaje: 97 }
  ];

  container.innerHTML = indicadores.map(ind => `
    <div class="indicador-item">
      <div class="indicador-encabezado">
        <span class="indicador-titulo">${ind.titulo}</span>
        <span class="indicador-porcentaje">${ind.porcentaje}%</span>
      </div>
      <div class="barra-indicador">
        <div class="relleno-indicador" style="width: ${ind.porcentaje}%"></div>
      </div>
    </div>
  `).join('');
}

/**
 * Renderiza el ranking de empleados
 */
function renderizarRankingEmpleados() {
  const container = document.getElementById('ranking-empleados');
  if (!container) return;

  // Crear ranking basado en empleados existentes con datos simulados
  const ranking = estado.profesionales.slice(0, 5).map((emp, index) => ({
    nombre: emp.nombre,
    especialidad: emp.especialidad || 'Profesional',
    servicios: Math.floor(Math.random() * 50) + 20 // Simulado
  })).sort((a, b) => b.servicios - a.servicios);

  if (ranking.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #737373;">No hay datos de ranking disponibles</p>';
    return;
  }

  container.innerHTML = ranking.map((emp, index) => `
    <div class="fila-ranking">
      <div class="ranking-posicion ${index < 3 ? 'top' : ''}">${index + 1}</div>
      <div class="ranking-info">
        <div class="ranking-nombre">${emp.nombre}</div>
        <div class="ranking-detalle">${emp.especialidad}</div>
      </div>
      <div class="ranking-valor">${emp.servicios}</div>
    </div>
  `).join('');
}