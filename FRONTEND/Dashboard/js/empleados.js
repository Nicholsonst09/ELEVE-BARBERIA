import { estado } from "./estado.js"
import { showNotification, confirmarAccion, setBtnLoading } from "./utilidades.js"
import { dbGetEmpleados, dbSaveEmpleado, dbDeleteEmpleado } from "./db.js"
import { fetchProfesionales } from "./api.js"

let empleadosFiltrados = []

// ─── Horario laboral — LocalStorage ───────────────────────────────────────────────
const LS_KEY_HORARIOS = 'eleve_empleado_horarios'

const DIAS = [
  { key: 'lunes',     label: 'Lunes',     finSemana: false },
  { key: 'martes',    label: 'Martes',    finSemana: false },
  { key: 'miercoles', label: 'Miércoles', finSemana: false },
  { key: 'jueves',    label: 'Jueves',    finSemana: false },
  { key: 'viernes',   label: 'Viernes',   finSemana: false },
  { key: 'sabado',    label: 'Sábado',    finSemana: true  },
  { key: 'domingo',   label: 'Domingo',   finSemana: true  },
]

const HORAS = Array.from({ length: 16 }, (_, i) =>
  `${(i + 7).toString().padStart(2, '0')}:00`
) // 07:00 → 22:00, solo horas enteras

const HORARIO_DEFAULT = {
  lunes:     { activo: true,  desde: '09:00', hasta: '18:00' },
  martes:    { activo: true,  desde: '09:00', hasta: '18:00' },
  miercoles: { activo: true,  desde: '09:00', hasta: '18:00' },
  jueves:    { activo: true,  desde: '09:00', hasta: '18:00' },
  viernes:   { activo: true,  desde: '09:00', hasta: '18:00' },
  sabado:    { activo: true,  desde: '09:00', hasta: '14:00' },
  domingo:   { activo: false, desde: '09:00', hasta: '14:00' },
}

function cargarHorariosLS() {
  try { return JSON.parse(localStorage.getItem(LS_KEY_HORARIOS) || '{}') }
  catch { return {} }
}

function guardarHorariosLS(data) {
  localStorage.setItem(LS_KEY_HORARIOS, JSON.stringify(data))
}

export function getHorarioEmpleado(empleadoId) {
  return cargarHorariosLS()[empleadoId] || null
}

function setHorarioEmpleado(empleadoId, horario) {
  const all = cargarHorariosLS()
  all[empleadoId] = horario
  guardarHorariosLS(all)
}

function formatearResumenHorario(horario) {
  if (!horario) return null
  return DIAS.filter(d => horario[d.key]?.activo)
}

function generarOpcionesHoras(selEl, valorActual) {
  selEl.innerHTML = HORAS.map(h =>
    `<option value="${h}" ${h === valorActual ? 'selected' : ''}>${h}</option>`
  ).join('')
}

export async function inicializarEmpleados() {
  await cargarEmpleados()
  setupEmpleadosEventListeners()
  renderizarEmpleados()
  renderizarMetricasEmpleados()
}

const COLORES_PROF = { 'bautista': '#1a1a1a', 'ciro': '#2f6d4e', 'felipe': '#a34b20', 'ricardo': '#2c4ea3' };
const PALETA_EMP = ['#1a1a1a', '#2f6d4e', '#a34b20', '#2c4ea3', '#6b2fa0', '#b5461a'];

async function cargarEmpleados() {
  try {
    const profesionalesAPI = await fetchProfesionales();
    if (profesionalesAPI.length > 0) {
      estado.profesionales = profesionalesAPI.map((p, i) => ({
        ...p,
        color: COLORES_PROF[p.nombre.split(' ')[0].toLowerCase()] || PALETA_EMP[i % PALETA_EMP.length]
      }));
    } else {
      estado.profesionales = dbGetEmpleados();
    }
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
    const horario = getHorarioEmpleado(empleado.id)
    const diasActivos = formatearResumenHorario(horario)

    let horarioHTML = ''
    if (diasActivos && diasActivos.length > 0) {
      const badges = diasActivos.map(d =>
        `<span class="badge-dia-activo ${d.finSemana ? 'fin-semana' : ''}">${d.label.substring(0, 3)}</span>`
      ).join('')
      // Calcular rango de horas más frecuente
      const primero = horario[diasActivos[0].key]
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
          <p>${empleado.especialidad || 'Sin especialidad'}</p>
          ${horarioHTML}
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

  poblarHorarioEmpleado(empleadoId)
  modal.classList.add("activo")
  document.body.style.overflow = "hidden"
}

export function cerrarModalEmpleado() {
  const modal = document.getElementById("modal-empleado")
  modal.classList.remove("activo")
  document.body.style.overflow = ""
  const contenedor = document.getElementById('horario-semanal-empleado')
  if (contenedor) contenedor.innerHTML = ''
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

function poblarHorarioEmpleado(empleadoId) {
  const contenedor = document.getElementById('horario-semanal-empleado')
  if (!contenedor) return

  const horarioGuardado = empleadoId ? getHorarioEmpleado(empleadoId) : null
  const horario = horarioGuardado || HORARIO_DEFAULT

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

  // Event listeners: toggle
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

export async function guardarEmpleado(e) {
  e.preventDefault()

  const btn = e.target.closest('form')?.querySelector('[type="submit"]') ||
               document.querySelector('#modal-empleado [type="submit"]')
  const restaurar = setBtnLoading(btn)

  const empleadoData = {
    id: document.getElementById("empleado-id").value || null,
    nombre: document.getElementById("empleado-nombre").value.trim(),
    telefono: document.getElementById("empleado-telefono").value.trim(),
    email: document.getElementById("empleado-email").value.trim(),
    especialidad: document.getElementById("empleado-especialidad").value.trim(),
  }

  const resultado = dbSaveEmpleado(empleadoData)
  restaurar()
  if (resultado) {
    const idFinal = resultado.id || empleadoData.id
    if (idFinal) {
      setHorarioEmpleado(idFinal, obtenerHorarioActual())
    }
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
  const ok = await confirmarAccion(
    '¿Estás seguro de que deseas eliminar este empleado? Esta acción no se puede deshacer.',
    'Eliminar empleado',
    'Sí, eliminar'
  )
  if (!ok) return

  const resultado = dbDeleteEmpleado(empleadoId)
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