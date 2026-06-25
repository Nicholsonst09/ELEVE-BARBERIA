import { estado } from "./estado.js"
import { showNotification, confirmarAccion, setBtnLoading } from "./utilidades.js"
import { fetchProfesionales, fetchServicios, createOrUpdateEmpleado, deleteEmpleado, fetchHistorial } from "./api.js"

let empleadosFiltrados = []
let historialTurnos = []

const DIAS = [
  { key: 'lunes', label: 'Lunes', finSemana: false },
  { key: 'martes', label: 'Martes', finSemana: false },
  { key: 'miercoles', label: 'Miércoles', finSemana: false },
  { key: 'jueves', label: 'Jueves', finSemana: false },
  { key: 'viernes', label: 'Viernes', finSemana: false },
  { key: 'sabado', label: 'Sábado', finSemana: true },
  { key: 'domingo', label: 'Domingo', finSemana: true },
]

const HORARIO_DEFAULT = {
  lunes: { activo: true, desde: '09:00', hasta: '18:00' },
  martes: { activo: true, desde: '09:00', hasta: '18:00' },
  miercoles: { activo: true, desde: '09:00', hasta: '18:00' },
  jueves: { activo: true, desde: '09:00', hasta: '18:00' },
  viernes: { activo: true, desde: '09:00', hasta: '18:00' },
  sabado: { activo: true, desde: '09:00', hasta: '14:00' },
  domingo: { activo: false, desde: '09:00', hasta: '14:00' },
}

const COLORES_AVATAR = ["#1a1a1a", "#2f6d4e", "#a34b20", "#2c4ea3", "#6b2fa0", "#b5461a", "#1e6a7c", "#7a3030"]

function colorParaId(id) {
  return COLORES_AVATAR[id % COLORES_AVATAR.length]
}

function obtenerIniciales(nombre) {
  return nombre
    .split(' ')
    .map(palabra => palabra[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

export async function inicializarEmpleados() {
  await cargarEmpleados()
  setupEmpleadosEventListeners()
  renderizarEmpleados()
  renderizarMetricasEmpleados()
}

async function cargarEmpleados() {
  try {
    const profesionalesAPI = await fetchProfesionales()
    estado.profesionales = profesionalesAPI.map((profesional, index) => ({
      ...profesional,
      color: colorParaId(profesional.id ?? index)
    }))
    empleadosFiltrados = [...estado.profesionales]

    if (!estado.servicios.length) {
      estado.servicios = await fetchServicios()
    }

    historialTurnos = await fetchHistorial()
  } catch (error) {
    console.error("Error al cargar empleados", error)
    estado.profesionales = []
    empleadosFiltrados = []
    historialTurnos = []
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
          (empleado.email || '').toLowerCase().includes(termino) ||
          (empleado.especialidades || '').toLowerCase().includes(termino),
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

  const btnCancelarModal = document.querySelector('#modal-empleado .btn-cancelar-empleado')
  if (btnCancelarModal) {
    btnCancelarModal.addEventListener('click', cerrarModalEmpleado)
  }

  const formEmpleado = document.getElementById('form-empleado')
  if (formEmpleado) {
    formEmpleado.addEventListener('submit', guardarEmpleado)
  }
}

function formatearResumenHorario(horario) {
  if (!horario) return []
  return DIAS.filter(d => horario[d.key]?.activo)
}

function buildServiciosHTML(empleado) {
  const servicios = empleado.servicios_asignados || []
  if (!servicios.length) return '<span class="label-sin-pros">Sin servicios asignados</span>'

  return servicios.map(servicio => `
    <span class="badge-dia-activo">${servicio.nombre}</span>
  `).join('')
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
    const diasActivos = formatearResumenHorario(empleado.horarios_disponibles)

    let horarioHTML = ''
    if (diasActivos.length > 0) {
      const badges = diasActivos.map(d =>
        `<span class="badge-dia-activo ${d.finSemana ? 'fin-semana' : ''}">${d.label.substring(0, 3)}</span>`
      ).join('')
      const primero = empleado.horarios_disponibles[diasActivos[0].key]
      horarioHTML = `<div class="resumen-horario-empleado">${badges}<span class="texto-horas-resumen">${primero.desde}–${primero.hasta}</span></div>`
    }

    return `
      <div class="elemento-lista">
        <div class="avatar-empleado">${iniciales}</div>
        <div class="info-elemento">
          <div class="nombre-con-estado">
            <h4>${empleado.nombre}</h4>
            <span class="indicador-estado ${claseEstado}" title="${estadoActivo ? 'Activo' : 'Inactivo'}"></span>
          </div>
          <p class="especialidades-empleado-card">${empleado.especialidades || 'Sin especialidades cargadas'}</p>
          ${empleado.email ? `<small class="email-empleado-card">${empleado.email}</small>` : '<small class="email-empleado-card">Sin email</small>'}
          ${horarioHTML}
          <div class="pros-asignados-lista">${buildServiciosHTML(empleado)}</div>
        </div>
        <div class="acciones-elemento">
          <button class="boton-icono editar" data-empleado-id="${empleado.id}" title="Editar">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button class="boton-icono eliminar" data-empleado-id="${empleado.id}" title="Dar de baja">
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

function actualizarPillHorario() {
  const pill = document.getElementById('pill-horario-empleado')
  if (!pill) return
  const activos = document.querySelectorAll('#horario-semanal-empleado .dia-fila.dia-activo').length
  if (activos === 0) {
    pill.textContent = 'Sin configurar'
    pill.classList.add('vacio')
  } else {
    pill.textContent = `${activos} día${activos > 1 ? 's' : ''} activo${activos > 1 ? 's' : ''}`
    pill.classList.remove('vacio')
  }
}

function poblarHorarioEmpleado(horarioConfigurado = null) {
  const contenedor = document.getElementById('horario-semanal-empleado')
  if (!contenedor) return

  const horario = horarioConfigurado || HORARIO_DEFAULT

  contenedor.innerHTML = DIAS.map(dia => {
    const cfg = horario[dia.key] || { activo: false, desde: '09:00', hasta: '18:00' }
    return `
      <div class="dia-fila ${cfg.activo ? 'dia-activo' : ''}" data-dia="${dia.key}">
        <span class="dia-etiqueta">${dia.label}</span>
        <div class="rango-horas">
          <input type="time" class="input-hora sel-desde" value="${cfg.desde}">
          <span class="sep-horas">→</span>
          <input type="time" class="input-hora sel-hasta" value="${cfg.hasta}">
        </div>
        <label class="toggle-switch" title="${cfg.activo ? 'Desactivar' : 'Activar'} día">
          <input type="checkbox" class="toggle-dia" data-dia="${dia.key}" ${cfg.activo ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </label>
      </div>`
  }).join('')

  contenedor.querySelectorAll('.toggle-dia').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const fila = toggle.closest('.dia-fila')
      fila.classList.toggle('dia-activo', toggle.checked)
      actualizarPillHorario()
    })
  })

  actualizarPillHorario()
}

function obtenerHorarioActual() {
  const horario = {}
  document.querySelectorAll('#horario-semanal-empleado .dia-fila').forEach(fila => {
    const key = fila.dataset.dia
    const activo = fila.classList.contains('dia-activo')
    const desde = fila.querySelector('.sel-desde')?.value || '09:00'
    const hasta = fila.querySelector('.sel-hasta')?.value || '18:00'
    horario[key] = { activo, desde, hasta }
  })
  return horario
}

function actualizarContadorServiciosEmpleado() {
  const pill = document.getElementById('contador-servicios-empleado')
  if (!pill) return
  const total = document.querySelectorAll('#selector-servicios-empleado .chip-profesional').length
  const sel = document.querySelectorAll('#selector-servicios-empleado .chip-profesional.seleccionado').length
  pill.textContent = sel === 0 ? '0 seleccionados' : `${sel} de ${total} seleccionados`
  pill.classList.toggle('vacio', sel === 0)
}

async function poblarSelectorServicios(empleado = null) {
  if (!estado.servicios.length) {
    estado.servicios = await fetchServicios()
  }

  const contenedor = document.getElementById('selector-servicios-empleado')
  if (!contenedor) return

  const servicios = estado.servicios || []
  if (!servicios.length) {
    contenedor.innerHTML = '<p class="sin-pros-mensaje"><i class="fas fa-cut"></i>No hay servicios activos registrados.</p>'
    actualizarContadorServiciosEmpleado()
    return
  }

  const asignados = empleado?.servicio_ids || []

  contenedor.innerHTML = servicios.map(servicio => {
    const seleccionado = asignados.includes(servicio.id) ? 'seleccionado' : ''
    return `
      <div class="chip-profesional ${seleccionado}" data-servicio-id="${servicio.id}">
        <span class="nombre-chip">${servicio.nombre}</span>
        <span class="chip-check-box"></span>
      </div>`
  }).join('')

  actualizarContadorServiciosEmpleado()

  contenedor.querySelectorAll('.chip-profesional').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('seleccionado')
      actualizarContadorServiciosEmpleado()
    })
  })
}

function obtenerServiciosSeleccionados() {
  return Array.from(
    document.querySelectorAll('#selector-servicios-empleado .chip-profesional.seleccionado')
  ).map(el => parseInt(el.dataset.servicioId))
}

export async function abrirModalEmpleado(empleadoId = null) {
  const modal = document.getElementById("modal-empleado")
  const titulo = document.getElementById("titulo-modal-empleado")
  const form = document.getElementById("form-empleado")

  let empleado = null
  if (empleadoId) {
    empleado = estado.profesionales.find((e) => e.id === empleadoId)
    if (!empleado) return

    titulo.textContent = "Editar Empleado"
    document.getElementById("empleado-id").value = empleado.id
    document.getElementById("empleado-nombre").value = empleado.nombre
    document.getElementById("empleado-email").value = empleado.email || ""
    document.getElementById("empleado-especialidad").value = empleado.especialidades || ""
  } else {
    titulo.textContent = "Nuevo Empleado"
    form.reset()
    document.getElementById("empleado-id").value = ""
  }

  await poblarSelectorServicios(empleado)
  poblarHorarioEmpleado(empleado?.horarios_disponibles || null)
  modal.classList.add("activo")
  document.body.style.overflow = "hidden"
}

export function cerrarModalEmpleado() {
  const modal = document.getElementById("modal-empleado")
  modal.classList.remove("activo")
  document.body.style.overflow = ""
  const contenedorHorario = document.getElementById('horario-semanal-empleado')
  if (contenedorHorario) contenedorHorario.innerHTML = ''
  const contenedorServicios = document.getElementById('selector-servicios-empleado')
  if (contenedorServicios) contenedorServicios.innerHTML = ''
}

export async function guardarEmpleado(e) {
  e.preventDefault()

  const btn = e.target.closest('form')?.querySelector('[type="submit"]') ||
               document.querySelector('#modal-empleado [type="submit"]')
  const restaurar = setBtnLoading(btn)

  const empleadoData = {
    id: document.getElementById("empleado-id").value || null,
    nombre: document.getElementById("empleado-nombre").value.trim(),
    email: document.getElementById("empleado-email").value.trim(),
    especialidades: document.getElementById("empleado-especialidad").value.trim(),
    horarios_disponibles: obtenerHorarioActual(),
    servicio_ids: obtenerServiciosSeleccionados(),
  }

  const resultado = await createOrUpdateEmpleado(empleadoData)
  restaurar()
  if (resultado) {
    showNotification(
      empleadoData.id ? "Empleado actualizado correctamente" : "Empleado creado correctamente",
      "success",
    )
    cerrarModalEmpleado()
    await cargarEmpleados()
    estado.servicios = await fetchServicios()
    renderizarEmpleados()
    renderizarMetricasEmpleados()
  } else {
    showNotification("Error al guardar empleado", "error")
  }
}

export async function eliminarEmpleadoConfirm(empleadoId) {
  const ok = await confirmarAccion(
    '¿Estás seguro? El empleado se dará de baja, dejará de recibir nuevos turnos y el historial se conservará.',
    'Dar de baja empleado',
    'Sí, dar de baja'
  )
  if (!ok) return

  const resultado = await deleteEmpleado(empleadoId)
  if (resultado) {
    showNotification("Empleado dado de baja correctamente", "success")
    await cargarEmpleados()
    estado.servicios = await fetchServicios()
    renderizarEmpleados()
    renderizarMetricasEmpleados()
  } else {
    showNotification("Error al dar de baja el empleado", "error")
  }
}

export function renderizarMetricasEmpleados() {
  calcularMetricasGenerales()
}

function calcularMetricasGenerales() {
  const totalEmpleados = estado.profesionales.length
  const empleadosActivos = estado.profesionales.filter(e => e.activo !== false).length
  const turnosValidos = (historialTurnos || []).filter(turno => !['cancelado', 'anulado'].includes(turno.estado))

  const hoy = new Date()
  const hoyLocal = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  const inicioSemana = new Date(hoy)
  inicioSemana.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  inicioSemana.setHours(0, 0, 0, 0)
  const finSemana = new Date(inicioSemana)
  finSemana.setDate(inicioSemana.getDate() + 7)

  const turnosHoy = turnosValidos.filter(turno => turno.fecha === hoyLocal).length
  const promedioServicios = empleadosActivos > 0 ? Math.round(turnosHoy / empleadosActivos) : 0
  const horasTrabajadas = turnosValidos.reduce((total, turno) => {
    if (!turno.fecha || !turno.hora_inicio || !turno.hora_fin) return total
    const fechaTurno = new Date(`${turno.fecha}T00:00:00`)
    if (fechaTurno < inicioSemana || fechaTurno >= finSemana) return total

    const inicio = convertirHoraEnMinutos(turno.hora_inicio)
    const fin = convertirHoraEnMinutos(turno.hora_fin)
    return total + Math.max(0, fin - inicio)
  }, 0)

  const totalEl = document.getElementById('total-empleados')
  const activosDetalleEl = document.getElementById('empleados-activos-detalle')
  const turnosHoyEl = document.getElementById('turnos-hoy')
  const promedioEl = document.getElementById('promedio-servicios')
  const horasEl = document.getElementById('horas-trabajadas')

  if (totalEl) totalEl.textContent = totalEmpleados
  if (activosDetalleEl) activosDetalleEl.textContent = `${empleadosActivos} activos`
  if (turnosHoyEl) turnosHoyEl.textContent = turnosHoy
  if (promedioEl) promedioEl.textContent = promedioServicios
  if (horasEl) horasEl.textContent = `${Math.round(horasTrabajadas / 60)}h`
}

function convertirHoraEnMinutos(hora) {
  const [hh, mm] = String(hora).substring(0, 5).split(':').map(Number)
  return (hh * 60) + mm
}
