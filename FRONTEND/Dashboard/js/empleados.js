import { estado } from "./estado.js"
import { showNotification, confirmarAccion, setBtnLoading, showPopupNotification, capturarValoresFormulario, restaurarValoresFormulario } from "./utilidades.js"
import { fetchProfesionales, fetchServicios, createOrUpdateEmpleado, deleteEmpleado, cambiarEstadoEmpleado, fetchHistorial, fetchNegocioConfig, uploadEmpleadoAvatar } from "./api.js"

let empleadosFiltrados = []
let historialTurnos = []
let horariosNegocioPorDia = null
let avatarPreviewObjectUrl = null

// Borrador por empleado (clave = id, o 'nuevo') para no perder lo tipeado si el
// modal se cierra sin guardar. El horario semanal y los servicios asignados se
// scrapean del DOM (no hay un archivo File que se pueda persistir para el avatar
// recién seleccionado: el navegador no permite restaurarlo en el <input type=file>).
const CAMPOS_EMPLEADO = ['empleado-nombre', 'empleado-email', 'empleado-especialidad', 'empleado-comision', 'empleado-avatar-url']
const _borradoresEmpleado = {}

const DIAS = [
  { key: 'lunes', label: 'Lunes', finSemana: false },
  { key: 'martes', label: 'Martes', finSemana: false },
  { key: 'miercoles', label: 'Miércoles', finSemana: false },
  { key: 'jueves', label: 'Jueves', finSemana: false },
  { key: 'viernes', label: 'Viernes', finSemana: false },
  { key: 'sabado', label: 'Sábado', finSemana: true },
  { key: 'domingo', label: 'Domingo', finSemana: true },
]

const DIA_A_NUMERO = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
}

// Preset del horario laboral de un empleado nuevo: arranca igual al horario
// del negocio para cada día (el admin lo ajusta después desde ahí), en vez
// de un horario fijo que no tiene relación con cuándo abre el local.
function construirHorarioDesdeNegocio(horariosNegocio) {
  const horario = {}
  for (const dia of DIAS) {
    const negocioDia = horariosNegocio[dia.key] || { activo: false, desde: '09:00', hasta: '18:00' }
    horario[dia.key] = { activo: negocioDia.activo, desde: negocioDia.desde, hasta: negocioDia.hasta }
  }
  return horario
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

function limpiarObjectUrlPreview() {
  if (avatarPreviewObjectUrl) {
    URL.revokeObjectURL(avatarPreviewObjectUrl)
    avatarPreviewObjectUrl = null
  }
}

function mostrarPreviewAvatar(src, esTemporal = false) {
  const preview = document.getElementById('empleado-avatar-preview')
  const placeholder = document.getElementById('avatar-preview-placeholder')
  const labelText = document.getElementById('avatar-uploader-label-text')
  if (!preview) return

  if (!src) {
    limpiarObjectUrlPreview()
    preview.removeAttribute('src')
    preview.hidden = true
    if (placeholder) placeholder.hidden = false
    if (labelText) labelText.textContent = 'Seleccionar imagen'
    return
  }

  if (!esTemporal) limpiarObjectUrlPreview()
  preview.src = src
  preview.hidden = false
  if (placeholder) placeholder.hidden = true
  if (labelText) labelText.textContent = 'Cambiar imagen'
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
    btnCancelarModal.addEventListener('click', cancelarModalEmpleado)
  }

  const formEmpleado = document.getElementById('form-empleado')
  if (formEmpleado) {
    formEmpleado.addEventListener('submit', guardarEmpleado)
  }

  const inputAvatarFile = document.getElementById('empleado-avatar-file')
  const avatarPreview = document.getElementById('empleado-avatar-preview')
  if (inputAvatarFile) {
    inputAvatarFile.addEventListener('change', () => {
      const archivo = inputAvatarFile.files?.[0]
      if (!archivo) {
        mostrarPreviewAvatar('')
        return
      }

      limpiarObjectUrlPreview()
      const urlLocal = URL.createObjectURL(archivo)
      avatarPreviewObjectUrl = urlLocal
      mostrarPreviewAvatar(urlLocal, true)
    })
  }

  if (avatarPreview) {
    avatarPreview.addEventListener('error', () => {
      mostrarPreviewAvatar('')
    })
  }
}

function formatearResumenHorario(horario) {
  if (!horario) return []
  return DIAS.filter(d => horario[d.key]?.activo)
}

function horaAMinutos(hora) {
  if (typeof hora !== 'string') return NaN
  const [h, m] = hora.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN
  return h * 60 + m
}

function normalizarHorariosNegocio(horarios = []) {
  const porDia = {}
  for (const dia of DIAS) {
    porDia[dia.key] = { activo: false, desde: '00:00', hasta: '00:00' }
  }

  ;(horarios || []).forEach((h) => {
    const diaKey = DIAS.find(d => DIA_A_NUMERO[d.key] === Number(h?.dia))?.key
    if (!diaKey) return
    porDia[diaKey] = {
      activo: h?.activo !== false,
      desde: h?.apertura || '09:00',
      hasta: h?.cierre || '21:00',
    }
  })

  return porDia
}

async function cargarHorariosNegocioPorDia() {
  if (horariosNegocioPorDia) return horariosNegocioPorDia

  try {
    const remoto = await fetchNegocioConfig()
    if (remoto?.horarios?.length) {
      horariosNegocioPorDia = normalizarHorariosNegocio(remoto.horarios)
      return horariosNegocioPorDia
    }
  } catch (error) {
    console.warn('No se pudieron cargar horarios del negocio desde API:', error)
  }

  horariosNegocioPorDia = normalizarHorariosNegocio([])
  return horariosNegocioPorDia
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
    const estadoActivo = empleado.activo !== false
    const claseEstado = estadoActivo ? 'activo' : 'inactivo'
    const especialidad = empleado.especialidades?.trim() || 'Sin especialidad'

    return `
      <div class="elemento-lista">
        <div class="avatar-empleado">
          ${empleado.avatar_url
            ? `<img src="${empleado.avatar_url}" alt="Avatar de ${empleado.nombre}" class="avatar-empleado-img">`
            : '<i class="fas fa-cut" aria-hidden="true"></i>'
          }
        </div>
        <div class="info-elemento">
          <div class="nombre-con-estado">
            <h4>${empleado.nombre}</h4>
            <span class="indicador-estado ${claseEstado}" title="${estadoActivo ? 'Activo' : 'Inactivo'}"></span>
          </div>
          <p class="especialidades-empleado-card">${especialidad}</p>
        </div>
        <div class="acciones-elemento">
          <label class="toggle-switch" title="${estadoActivo ? 'Desactivar' : 'Activar'} empleado">
            <input type="checkbox" class="toggle-estado-empleado" data-empleado-id="${empleado.id}" ${estadoActivo ? 'checked' : ''}>
            <span class="toggle-track"></span>
          </label>
          <button class="boton-icono editar" data-empleado-id="${empleado.id}" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="boton-icono eliminar" data-empleado-id="${empleado.id}" title="Anular">
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

  listaEmpleados.querySelectorAll('.toggle-estado-empleado').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const empleadoId = parseInt(toggle.dataset.empleadoId)
      cambiarEstadoEmpleadoUI(empleadoId, toggle.checked)
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

function aplicarRestriccionesDescanso(fila) {
  const desdeDia = fila.querySelector('.sel-desde')?.value || '09:00'
  const hastaDia = fila.querySelector('.sel-hasta')?.value || '18:00'
  const descansoDesde = fila.querySelector('.sel-descanso-desde')
  const descansoHasta = fila.querySelector('.sel-descanso-hasta')

  if (!descansoDesde || !descansoHasta) return

  descansoDesde.min = desdeDia
  descansoDesde.max = hastaDia
  descansoHasta.min = desdeDia
  descansoHasta.max = hastaDia

  if (descansoDesde.value < desdeDia) descansoDesde.value = desdeDia
  if (descansoHasta.value > hastaDia) descansoHasta.value = hastaDia
  if (descansoHasta.value <= descansoDesde.value) descansoHasta.value = descansoDesde.value
}

function poblarHorarioEmpleado(horarioConfigurado = null) {
  const contenedor = document.getElementById('horario-semanal-empleado')
  if (!contenedor) return

  const horariosNegocio = horariosNegocioPorDia || normalizarHorariosNegocio([])
  const horario = horarioConfigurado || construirHorarioDesdeNegocio(horariosNegocio)

  contenedor.innerHTML = DIAS.filter(dia => (horariosNegocio[dia.key] || { activo: false }).activo).map(dia => {
    const cfg = horario[dia.key] || { activo: false, desde: '09:00', hasta: '18:00' }
    const negocioDia = horariosNegocio[dia.key] || { activo: false, desde: '00:00', hasta: '00:00' }
    const descansoCfg = cfg.descanso || { activo: false, desde: cfg.desde || '13:00', hasta: cfg.hasta || '14:00' }
    const descansoHasta = descansoCfg.hasta && descansoCfg.hasta > descansoCfg.desde ? descansoCfg.hasta : descansoCfg.desde

    return `
      <div class="dia-fila ${cfg.activo ? 'dia-activo' : ''} ${cfg.activo && descansoCfg.activo ? 'descanso-activo' : ''}" data-dia="${dia.key}" data-negocio-activo="${negocioDia.activo ? '1' : '0'}">
        <span class="dia-etiqueta">${dia.label}</span>
        <div class="rango-horas">
          <span class="etiqueta-rango">Laboral</span>
          <div class="rango-horas-valores">
            <input type="time" class="input-hora sel-desde" value="${cfg.desde}" min="${negocioDia.desde}" max="${negocioDia.hasta}">
            <span class="sep-horas">→</span>
            <input type="time" class="input-hora sel-hasta" value="${cfg.hasta}" min="${negocioDia.desde}" max="${negocioDia.hasta}">
          </div>
        </div>
        <div class="bloque-descanso">
          <label class="descanso-check">
            <input type="checkbox" class="toggle-descanso" ${cfg.activo && descansoCfg.activo ? 'checked' : ''}>
            <span>Descanso</span>
          </label>
          <div class="rango-descanso">
            <input type="time" class="input-hora sel-descanso-desde" value="${descansoCfg.desde || cfg.desde}" min="${cfg.desde}" max="${cfg.hasta}">
            <span class="sep-horas">→</span>
            <input type="time" class="input-hora sel-descanso-hasta" value="${descansoHasta}" min="${cfg.desde}" max="${cfg.hasta}">
          </div>
        </div>
        <label class="toggle-switch" title="${cfg.activo ? 'Desactivar' : 'Activar'} día">
          <input type="checkbox" class="toggle-dia" data-dia="${dia.key}" ${cfg.activo ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </label>
        <small class="meta-horario-negocio">Negocio: ${negocioDia.activo ? `${negocioDia.desde}–${negocioDia.hasta}` : 'Cerrado'}</small>
      </div>`
  }).join('')

  contenedor.querySelectorAll('.toggle-dia').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const fila = toggle.closest('.dia-fila')
      fila.classList.toggle('dia-activo', toggle.checked)
      if (!toggle.checked) {
        const descansoToggle = fila.querySelector('.toggle-descanso')
        if (descansoToggle) descansoToggle.checked = false
        fila.classList.remove('descanso-activo')
      }
      actualizarPillHorario()
    })
  })

  contenedor.querySelectorAll('.toggle-descanso').forEach(toggleDescanso => {
    toggleDescanso.addEventListener('change', () => {
      const fila = toggleDescanso.closest('.dia-fila')
      const diaActivo = fila.classList.contains('dia-activo')
      if (!diaActivo && toggleDescanso.checked) {
        toggleDescanso.checked = false
        showNotification('Primero activá el día para configurar descanso.', 'warning')
      }
      fila.classList.toggle('descanso-activo', diaActivo && toggleDescanso.checked)
      aplicarRestriccionesDescanso(fila)
    })
  })

  contenedor.querySelectorAll('.sel-desde, .sel-hasta').forEach(inputHora => {
    inputHora.addEventListener('change', () => {
      const fila = inputHora.closest('.dia-fila')
      aplicarRestriccionesDescanso(fila)
    })
  })

  contenedor.querySelectorAll('.dia-fila').forEach(fila => aplicarRestriccionesDescanso(fila))

  actualizarPillHorario()
}

function obtenerHorarioActual() {
  const horario = {}
  document.querySelectorAll('#horario-semanal-empleado .dia-fila').forEach(fila => {
    const key = fila.dataset.dia
    const activo = fila.classList.contains('dia-activo')
    const desde = fila.querySelector('.sel-desde')?.value || '09:00'
    const hasta = fila.querySelector('.sel-hasta')?.value || '18:00'
    const descansoActivo = activo && !!fila.querySelector('.toggle-descanso')?.checked
    const descansoDesde = fila.querySelector('.sel-descanso-desde')?.value || desde
    const descansoHasta = fila.querySelector('.sel-descanso-hasta')?.value || descansoDesde
    horario[key] = {
      activo,
      desde,
      hasta,
      descanso: {
        activo: descansoActivo,
        desde: descansoDesde,
        hasta: descansoHasta,
      },
    }
  })
  return horario
}

function validarHorariosContraNegocio(horariosEmpleado, horariosNegocio = {}) {
  for (const dia of DIAS) {
    const cfg = horariosEmpleado?.[dia.key]
    if (!cfg?.activo) continue

    const negocioDia = horariosNegocio[dia.key] || { activo: false, desde: '00:00', hasta: '00:00' }
    if (!negocioDia.activo) {
      return `${dia.label}: el negocio está cerrado.`
    }

    const empDesde = horaAMinutos(cfg.desde)
    const empHasta = horaAMinutos(cfg.hasta)
    const negDesde = horaAMinutos(negocioDia.desde)
    const negHasta = horaAMinutos(negocioDia.hasta)

    if ([empDesde, empHasta, negDesde, negHasta].some(Number.isNaN)) {
      return `${dia.label}: hay horarios inválidos.`
    }

    if (empDesde >= empHasta) {
      return `${dia.label}: la hora de inicio del barbero debe ser menor que la hora de fin.`
    }

    if (empDesde < negDesde || empHasta > negHasta) {
      return `${dia.label}: el horario del barbero debe estar dentro del horario del negocio (${negocioDia.desde}–${negocioDia.hasta}).`
    }

    if (cfg.descanso?.activo) {
      const descDesde = horaAMinutos(cfg.descanso.desde)
      const descHasta = horaAMinutos(cfg.descanso.hasta)
      if ([descDesde, descHasta].some(Number.isNaN)) {
        return `${dia.label}: el descanso tiene una hora inválida.`
      }
      if (descDesde >= descHasta) {
        return `${dia.label}: la hora de inicio del descanso debe ser menor que la hora de fin.`
      }
      if (descDesde < empDesde || descHasta > empHasta) {
        return `${dia.label}: el descanso debe estar dentro del horario laboral del barbero (${cfg.desde}–${cfg.hasta}).`
      }
    }
  }

  return null
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
  const avatarFileInput = document.getElementById('empleado-avatar-file')
  const avatarUrlInput = document.getElementById('empleado-avatar-url')

  if (empleadoId) {
    empleado = estado.profesionales.find((e) => e.id === empleadoId)
    if (!empleado) return

    titulo.textContent = "Editar Empleado"
    document.getElementById("empleado-id").value = empleado.id
    document.getElementById("empleado-nombre").value = empleado.nombre
    document.getElementById("empleado-email").value = empleado.email || ""
    document.getElementById("empleado-especialidad").value = empleado.especialidades || ""
    if (avatarUrlInput) avatarUrlInput.value = empleado.avatar_url || ""
    document.getElementById("empleado-comision").value = Number(empleado.comision_pct ?? 0)

    mostrarPreviewAvatar(empleado.avatar_url || '')
  } else {
    titulo.textContent = "Nuevo Empleado"
    form.reset()
    document.getElementById("empleado-id").value = ""
    document.getElementById("empleado-comision").value = 0
    if (avatarUrlInput) avatarUrlInput.value = ''
    mostrarPreviewAvatar('')
  }

  if (avatarFileInput) avatarFileInput.value = ''

  horariosNegocioPorDia = await cargarHorariosNegocioPorDia()

  const borrador = _borradoresEmpleado[String(empleadoId || 'nuevo')]
  if (borrador) {
    restaurarValoresFormulario(borrador.campos)
    if (avatarUrlInput?.value) mostrarPreviewAvatar(avatarUrlInput.value)
  }

  await poblarSelectorServicios(borrador ? { servicio_ids: borrador.servicioIds } : empleado)
  poblarHorarioEmpleado(borrador ? borrador.horario : (empleado?.horarios_disponibles || null))
  modal.classList.add("activo")
  document.body.style.overflow = "hidden"
}

export function cerrarModalEmpleado() {
  const idActual = document.getElementById("empleado-id")?.value || 'nuevo'
  // Scrapea el horario y los servicios ANTES de vaciar sus contenedores.
  _borradoresEmpleado[idActual] = {
    campos: capturarValoresFormulario(CAMPOS_EMPLEADO),
    horario: obtenerHorarioActual(),
    servicioIds: obtenerServiciosSeleccionados(),
  }
  _ocultarModalEmpleado()
}

// "Cancelar" es una acción explícita de descarte: a diferencia de la X, borra
// cualquier borrador pendiente para este formulario.
function cancelarModalEmpleado() {
  const idActual = document.getElementById("empleado-id")?.value || 'nuevo'
  delete _borradoresEmpleado[idActual]
  _ocultarModalEmpleado()
}

// Oculta el modal sin capturar borrador (se usa tras guardar con éxito).
function _ocultarModalEmpleado() {
  const modal = document.getElementById("modal-empleado")
  modal.classList.remove("activo")
  document.body.style.overflow = ""
  const contenedorHorario = document.getElementById('horario-semanal-empleado')
  if (contenedorHorario) contenedorHorario.innerHTML = ''
  const contenedorServicios = document.getElementById('selector-servicios-empleado')
  if (contenedorServicios) contenedorServicios.innerHTML = ''

  const avatarFileInput = document.getElementById('empleado-avatar-file')
  const avatarUrlInput = document.getElementById('empleado-avatar-url')
  if (avatarFileInput) avatarFileInput.value = ''
  if (avatarUrlInput) avatarUrlInput.value = ''
  mostrarPreviewAvatar('')
}

export async function guardarEmpleado(e) {
  e.preventDefault()

  const btn = e.target.closest('form')?.querySelector('[type="submit"]') ||
               document.querySelector('#modal-empleado [type="submit"]')
  const restaurar = setBtnLoading(btn)

  const horariosEmpleado = obtenerHorarioActual()
  const horariosNegocio = await cargarHorariosNegocioPorDia()
  const errorHorario = validarHorariosContraNegocio(horariosEmpleado, horariosNegocio)
  if (errorHorario) {
    restaurar()
    await showPopupNotification(errorHorario, 'Horario fuera del rango del negocio', 'Entendido')
    return
  }

  const avatarFileInput = document.getElementById('empleado-avatar-file')
  const avatarUrlInput = document.getElementById('empleado-avatar-url')
  const avatarFile = avatarFileInput?.files?.[0] || null
  let avatarUrl = avatarUrlInput?.value?.trim() || ''

  if (avatarFile) {
    const subida = await uploadEmpleadoAvatar(avatarFile, document.getElementById("empleado-id").value || null)
    if (!subida?.publicUrl) {
      restaurar()
      const detalle = subida?.error ? ` ${subida.error}` : ''
      showNotification(`No se pudo subir la imagen de avatar.${detalle}`, 'error')
      return
    }
    avatarUrl = subida.publicUrl
    if (avatarUrlInput) avatarUrlInput.value = avatarUrl
  }

  const empleadoData = {
    id: document.getElementById("empleado-id").value || null,
    nombre: document.getElementById("empleado-nombre").value.trim(),
    email: document.getElementById("empleado-email").value.trim(),
    especialidades: document.getElementById("empleado-especialidad").value.trim(),
    avatar_url: avatarUrl || null,
    comision_pct: Number(document.getElementById("empleado-comision").value || 0),
    horarios_disponibles: horariosEmpleado,
    servicio_ids: obtenerServiciosSeleccionados(),
  }

  const resultado = await createOrUpdateEmpleado(empleadoData)
  restaurar()
  if (resultado) {
    delete _borradoresEmpleado[empleadoData.id || 'nuevo']
    showNotification(
      empleadoData.id ? "Empleado actualizado correctamente" : "Empleado creado correctamente",
      "success",
    )
    _ocultarModalEmpleado()
    await cargarEmpleados()
    estado.servicios = await fetchServicios()
    renderizarEmpleados()
    renderizarMetricasEmpleados()
  } else {
    showNotification(estado.error || "Error al guardar empleado", "error")
  }
}

export async function eliminarEmpleadoConfirm(empleadoId) {
  const ok = await confirmarAccion(
    '¿Estás seguro? El empleado se va a eliminar: deja de aparecer en el sistema y no se puede reactivar desde acá.',
    'Eliminar empleado',
    'Sí, eliminar'
  )
  if (!ok) return

  const resultado = await deleteEmpleado(empleadoId)
  if (resultado) {
    showNotification("Empleado anulado correctamente", "success")
    await cargarEmpleados()
    estado.servicios = await fetchServicios()
    renderizarEmpleados()
    renderizarMetricasEmpleados()
  } else {
    showNotification("Error al anular el empleado", "error")
  }
}

async function cambiarEstadoEmpleadoUI(empleadoId, activo) {
  const resultado = await cambiarEstadoEmpleado(empleadoId, activo)
  if (resultado) {
    showNotification(`Empleado ${activo ? 'activado' : 'desactivado'} correctamente`, "success")
    await cargarEmpleados()
    estado.servicios = await fetchServicios()
    renderizarEmpleados()
    renderizarMetricasEmpleados()
  } else {
    showNotification(`Error al ${activo ? 'activar' : 'desactivar'} el empleado`, "error")
    renderizarEmpleados()
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
