import { showNotification, confirmarAccion } from './utilidades.js'
import { fetchNegocioConfig, updateNegocioConfig, uploadNegocioImagen, verificarConflictosHorarios } from './api.js'

const NEGOCIO_DEFAULT = {
  nombre: 'ELEVÉ Barbería',
  logoUrl: './img/logo-eleve-02.jpg',
  reservaImagenUrl: '',
  telefono: '+54 9 11 1234-5678',
  email: 'contacto@elevebarberia.com',
  whatsapp: '5491112345678',
  instagram: 'https://instagram.com/elevebarberia',
  facebook: '',
  direccion: 'Av. Corrientes 1234, CABA',
  mapsEmbed: '',
  mapsLink: 'https://maps.google.com',
  horarios: [
    { dia: 0, nombre: 'Domingo', apertura: '09:00', cierre: '21:00', activo: false },
    { dia: 1, nombre: 'Lunes', apertura: '13:00', cierre: '21:00', activo: true },
    { dia: 2, nombre: 'Martes', apertura: '09:00', cierre: '21:00', activo: true },
    { dia: 3, nombre: 'Miércoles', apertura: '09:00', cierre: '21:00', activo: true },
    { dia: 4, nombre: 'Jueves', apertura: '09:00', cierre: '21:00', activo: true },
    { dia: 5, nombre: 'Viernes', apertura: '09:00', cierre: '21:00', activo: true },
    { dia: 6, nombre: 'Sábado', apertura: '09:00', cierre: '21:00', activo: true },
  ],
  diasNoLaborables: [
    { fecha: '2026-12-25', motivo: 'Navidad' },
    { fecha: '2026-01-01', motivo: 'Año Nuevo' },
  ],
}

let negocioEnMemoria = JSON.parse(JSON.stringify(NEGOCIO_DEFAULT))

function construirMapsEmbedDesdeLink(link) {
  if (!link) return ''
  try {
    const url = new URL(link)
    const host = url.hostname.toLowerCase()
    if (!host.includes('google.') && !host.includes('goo.gl')) return ''

    if (url.pathname.includes('/maps/embed')) {
      return link
    }

    const q = url.searchParams.get('q')
    if (q) {
      return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`
    }

    const partes = url.pathname.split('/').filter(Boolean)
    const idxPlace = partes.findIndex((p) => p === 'place')
    if (idxPlace >= 0 && partes[idxPlace + 1]) {
      const lugar = decodeURIComponent(partes[idxPlace + 1]).replace(/\+/g, ' ')
      return `https://www.google.com/maps?q=${encodeURIComponent(lugar)}&output=embed`
    }

    return `https://www.google.com/maps?q=${encodeURIComponent(link)}&output=embed`
  } catch {
    return ''
  }
}

function extraerSrcDeIframe(valor) {
  const texto = String(valor || '').trim()
  if (!texto) return ''
  const match = texto.match(/src\s*=\s*["']([^"']+)["']/i)
  return match?.[1] || texto
}

function obtenerNegocioMock() {
  return JSON.parse(JSON.stringify(negocioEnMemoria))
}

function guardarNegocioMock(data) {
  negocioEnMemoria = JSON.parse(JSON.stringify(data || NEGOCIO_DEFAULT))
}

export function inicializarNegocio() {
  ;(async () => {
    const data = await obtenerNegocioConBackend()
    poblarFormularioNegocio(data)
    renderizarHorarios(data.horarios)
    renderizarDiasNoLaborables(data.diasNoLaborables)
    renderizarVistaPrevia(data)
    setupNegocioListeners()
  })()
}

async function obtenerNegocioConBackend() {
  const local = obtenerNegocioMock()
  const remoto = await fetchNegocioConfig()
  if (!remoto) return local

  const tomar = (valorRemoto, fallbackLocal) => (
    valorRemoto !== undefined && valorRemoto !== null ? valorRemoto : fallbackLocal
  )

  const horarioRemoto = Array.isArray(remoto.horarios) ? remoto.horarios : local.horarios
  const diasNoLaborablesRemoto = Array.isArray(remoto.diasNoLaborables)
    ? remoto.diasNoLaborables
    : local.diasNoLaborables

  const combinado = {
    ...local,
    nombre: tomar(remoto.nombre, local.nombre),
    logoUrl: tomar(remoto.logoUrl, local.logoUrl),
    reservaImagenUrl: tomar(remoto.reservaImagenUrl, local.reservaImagenUrl),
    telefono: tomar(remoto.telefono, local.telefono),
    email: tomar(remoto.email, local.email),
    whatsapp: tomar(remoto.whatsapp, local.whatsapp),
    instagram: tomar(remoto.instagram, local.instagram),
    facebook: tomar(remoto.facebook, local.facebook),
    direccion: tomar(remoto.direccion, local.direccion),
    mapsEmbed: tomar(remoto.mapsEmbed, local.mapsEmbed),
    mapsLink: tomar(remoto.mapsLink, local.mapsLink),
    horarios: horarioRemoto,
    diasNoLaborables: diasNoLaborablesRemoto,
  }

  guardarNegocioMock(combinado)
  return combinado
}

function setupNegocioListeners() {
  document.getElementById('form-negocio-general')?.addEventListener('submit', (e) => {
    e.preventDefault()
    guardarSeccionNegocio()
  })

  document.getElementById('form-negocio-redes')?.addEventListener('submit', (e) => {
    e.preventDefault()
    guardarSeccionNegocio()
  })

  document.getElementById('form-negocio-ubicacion')?.addEventListener('submit', (e) => {
    e.preventDefault()
    guardarSeccionNegocio()
  })

  document.getElementById('btn-guardar-horarios')?.addEventListener('click', guardarHorarios)

  document.getElementById('negocio-logo-input')?.addEventListener('change', (e) => subirImagenDesdeInput(e, 'logo'))
  document.getElementById('negocio-reserva-imagen-input')?.addEventListener('change', (e) => subirImagenDesdeInput(e, 'reserva'))

  document.getElementById('btn-agregar-dia-cerrado')?.addEventListener('click', agregarDiaCerrado)

  document.getElementById('lista-dias-cerrados')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quitar-dia]')
    if (btn) quitarDiaCerrado(btn.dataset.quitarDia)
  })

  document.querySelectorAll('.negocio-subnav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const seccion = btn.dataset.seccionNegocio
      document.querySelectorAll('.negocio-subnav button').forEach((b) => b.classList.remove('activo'))
      btn.classList.add('activo')
      document.querySelectorAll('.negocio-seccion-panel').forEach((p) => {
        p.classList.toggle('activo', p.id === `negocio-panel-${seccion}`)
      })
    })
  })
}

function poblarFormularioNegocio(data) {
  const campos = {
    'negocio-nombre': data.nombre,
    'negocio-reserva-imagen': data.reservaImagenUrl,
    'negocio-telefono': data.telefono,
    'negocio-email': data.email,
    'negocio-whatsapp': data.whatsapp,
    'negocio-instagram': data.instagram,
    'negocio-facebook': data.facebook,
    'negocio-direccion': data.direccion,
    'negocio-maps-link': data.mapsLink,
    'negocio-maps-embed': data.mapsEmbed,
  }
  Object.entries(campos).forEach(([id, val]) => {
    const el = document.getElementById(id)
    if (el) el.value = val || ''
  })

  const logoPreview = document.getElementById('negocio-logo-preview')
  if (logoPreview) logoPreview.src = data.logoUrl || NEGOCIO_DEFAULT.logoUrl
}

function renderizarHorarios(horarios) {
  const cont = document.getElementById('tabla-horarios-negocio')
  if (!cont) return

  cont.innerHTML = horarios.map((h) => `
    <div class="fila-horario-negocio" data-dia="${h.dia}">
      <label class="horario-dia-check">
        <input type="checkbox" class="horario-activo" ${h.activo ? 'checked' : ''}>
        <span>${h.nombre}</span>
      </label>
      <input type="time" class="horario-apertura form-input" value="${h.apertura}" ${h.activo ? '' : 'disabled'}>
      <span class="horario-separador">a</span>
      <input type="time" class="horario-cierre form-input" value="${h.cierre}" ${h.activo ? '' : 'disabled'}>
    </div>
  `).join('')

  cont.querySelectorAll('.horario-activo').forEach((chk) => {
    chk.addEventListener('change', (e) => {
      const fila = e.target.closest('.fila-horario-negocio')
      fila.querySelectorAll('input[type="time"]').forEach((inp) => {
        inp.disabled = !e.target.checked
      })
    })
  })
}

function renderizarDiasNoLaborables(dias) {
  const lista = document.getElementById('lista-dias-cerrados')
  if (!lista) return

  if (!dias?.length) {
    lista.innerHTML = '<p class="sin-resultados">No hay días cerrados configurados</p>'
    return
  }

  lista.innerHTML = dias.map((d) => `
    <div class="dia-cerrado-item">
      <div>
        <strong>${formatearFecha(d.fecha)}</strong>
        <span>${d.motivo || 'Cerrado'}</span>
      </div>
      <button type="button" class="boton-icono eliminar" data-quitar-dia="${d.fecha}" title="Quitar">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('')
}

function formatearFecha(fecha) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

// Si el cambio propuesto de horarios/dias-no-laborables deja turnos reservados
// fuera de atencion, muestra un cartel para confirmar la cancelacion en lote.
// Devuelve la lista de ids a cancelar (vacia si no hay conflictos), o null si
// el admin cancelo la operacion.
async function confirmarConflictosHorarios({ horarios, diasNoLaborables }) {
  const conflictos = await verificarConflictosHorarios({ horarios, diasNoLaborables })
  if (!conflictos || conflictos.length === 0) return []

  const MAX_LISTADOS = 8
  const listado = conflictos
    .slice(0, MAX_LISTADOS)
    .map((t) => `${formatearFecha(t.fecha)} ${t.hora_inicio} — ${t.cliente} con ${t.empleado}`)
    .join('\n')
  const extra = conflictos.length > MAX_LISTADOS ? `\n...y ${conflictos.length - MAX_LISTADOS} más` : ''

  const confirmado = await confirmarAccion(
    `${listado}${extra}`,
    `${conflictos.length} turno${conflictos.length === 1 ? '' : 's'} reservado${conflictos.length === 1 ? '' : 's'} quedaría${conflictos.length === 1 ? '' : 'n'} fuera de este horario`,
    'Cancelar turnos y guardar',
    'Se le va a enviar un email de cancelación a cada cliente afectado.'
  )

  return confirmado ? conflictos.map((t) => t.id) : null
}

function renderizarVistaPrevia(data) {
  const mapsFrame = document.getElementById('negocio-maps-preview')
  const mapsEmbed = data.mapsEmbed || construirMapsEmbedDesdeLink(data.mapsLink)
  if (mapsFrame) mapsFrame.src = mapsEmbed || ''

  const previewCard = document.getElementById('negocio-preview-card')
  if (previewCard) {
    previewCard.innerHTML = `
      <img src="${data.logoUrl || NEGOCIO_DEFAULT.logoUrl}" alt="Logo" class="negocio-preview-logo">
      <h3>${data.nombre}</h3>
      <div class="negocio-preview-links">
        ${data.whatsapp ? `<a href="https://wa.me/${data.whatsapp}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
        ${data.instagram ? `<a href="${data.instagram}" target="_blank" rel="noopener"><i class="fab fa-instagram"></i> Instagram</a>` : ''}
        ${data.mapsLink ? `<a href="${data.mapsLink}" target="_blank" rel="noopener"><i class="fas fa-map-marker-alt"></i> Ubicación</a>` : ''}
      </div>
      <p class="negocio-preview-dir"><i class="fas fa-location-dot"></i> ${data.direccion || ''}</p>
    `
  }
}

async function subirImagenDesdeInput(e, tipo = 'logo') {
  const file = e.target.files?.[0]
  if (!file) return

  const subida = await uploadNegocioImagen(file, tipo)
  if (!subida?.publicUrl) {
    const detalle = subida?.error ? ` ${subida.error}` : ''
    showNotification(`No se pudo subir la imagen.${detalle}`, 'error')
    return
  }

  const data = obtenerNegocioMock()
  const esLogo = tipo === 'logo'
  if (esLogo) {
    data.logoUrl = subida.publicUrl
    const logoPreview = document.getElementById('negocio-logo-preview')
    if (logoPreview) logoPreview.src = data.logoUrl
  } else {
    data.reservaImagenUrl = subida.publicUrl
    const inputReserva = document.getElementById('negocio-reserva-imagen')
    if (inputReserva) inputReserva.value = data.reservaImagenUrl
  }

  guardarNegocioMock(data)
  renderizarVistaPrevia(data)

  const persistido = await updateNegocioConfig(esLogo ? { logoUrl: data.logoUrl } : { reservaImagenUrl: data.reservaImagenUrl })
  if (!persistido) {
    showNotification('Imagen subida, pero no se pudo guardar la URL en la configuración.', 'warning')
    return
  }

  showNotification(esLogo ? 'Logo subido y guardado correctamente' : 'Imagen de reservas subida y guardada correctamente', 'success')
}

async function guardarSeccionNegocio() {
  const data = obtenerNegocioMock()
  data.nombre = document.getElementById('negocio-nombre')?.value.trim() || data.nombre
  data.reservaImagenUrl = document.getElementById('negocio-reserva-imagen')?.value.trim() || ''
  data.telefono = document.getElementById('negocio-telefono')?.value.trim() || ''
  data.email = document.getElementById('negocio-email')?.value.trim() || ''
  data.whatsapp = document.getElementById('negocio-whatsapp')?.value.trim() || ''
  data.instagram = document.getElementById('negocio-instagram')?.value.trim() || ''
  data.facebook = document.getElementById('negocio-facebook')?.value.trim() || ''
  data.direccion = document.getElementById('negocio-direccion')?.value.trim() || ''
  data.mapsLink = document.getElementById('negocio-maps-link')?.value.trim() || ''
  const mapsEmbedManual = extraerSrcDeIframe(document.getElementById('negocio-maps-embed')?.value)
  data.mapsEmbed = mapsEmbedManual || construirMapsEmbedDesdeLink(data.mapsLink)

  const actualizado = await updateNegocioConfig({
    nombre: data.nombre,
    logoUrl: data.logoUrl,
    reservaImagenUrl: data.reservaImagenUrl,
    telefono: data.telefono,
    email: data.email,
    whatsapp: data.whatsapp,
    instagram: data.instagram,
    facebook: data.facebook,
    direccion: data.direccion,
    mapsLink: data.mapsLink,
    mapsEmbed: data.mapsEmbed
  })

  if (actualizado) {
    Object.assign(data, {
      nombre: actualizado.nombre ?? data.nombre,
      logoUrl: actualizado.logoUrl ?? data.logoUrl,
      reservaImagenUrl: actualizado.reservaImagenUrl ?? data.reservaImagenUrl,
      telefono: actualizado.telefono ?? data.telefono,
      email: actualizado.email ?? data.email,
      whatsapp: actualizado.whatsapp ?? data.whatsapp,
      instagram: actualizado.instagram ?? data.instagram,
      facebook: actualizado.facebook ?? data.facebook,
      direccion: actualizado.direccion ?? data.direccion,
      mapsLink: actualizado.mapsLink ?? data.mapsLink,
      mapsEmbed: actualizado.mapsEmbed ?? data.mapsEmbed,
      horarios: actualizado.horarios ?? data.horarios,
      diasNoLaborables: actualizado.diasNoLaborables ?? data.diasNoLaborables,
    })
  }

  if (!actualizado) {
    showNotification('No se pudo guardar en servidor.', 'error')
    return
  }

  guardarNegocioMock(data)
  renderizarVistaPrevia(data)
  showNotification('Configuración guardada en servidor', 'success')
}

async function guardarHorarios() {
  const data = obtenerNegocioMock()
  const filas = document.querySelectorAll('.fila-horario-negocio')
  const horariosPropuestos = Array.from(filas).map((fila) => {
    const dia = Number(fila.dataset.dia)
    const nombre = NEGOCIO_DEFAULT.horarios.find((h) => h.dia === dia)?.nombre || ''
    return {
      dia,
      nombre,
      apertura: fila.querySelector('.horario-apertura').value,
      cierre: fila.querySelector('.horario-cierre').value,
      activo: fila.querySelector('.horario-activo').checked,
    }
  })

  const cancelarTurnosIds = await confirmarConflictosHorarios({ horarios: horariosPropuestos })
  if (cancelarTurnosIds === null) return // el admin cancelo la operacion

  data.horarios = horariosPropuestos

  const actualizado = await updateNegocioConfig({
    horarios: data.horarios,
    diasNoLaborables: data.diasNoLaborables || [],
    cancelarTurnosIds,
  })

  if (!actualizado) {
    showNotification('No se pudo guardar horarios en servidor.', 'error')
    return
  }

  data.horarios = actualizado.horarios || data.horarios
  data.diasNoLaborables = actualizado.diasNoLaborables || data.diasNoLaborables
  guardarNegocioMock(data)
  renderizarHorarios(data.horarios)

  const cancelados = actualizado.turnosCancelados?.length || 0
  showNotification(
    cancelados > 0
      ? `Horarios guardados. Se cancelaron ${cancelados} turno(s).`
      : 'Horarios guardados en servidor',
    'success'
  )
}

async function agregarDiaCerrado() {
  const fecha = document.getElementById('negocio-dia-cerrado-fecha')?.value
  const motivo = document.getElementById('negocio-dia-cerrado-motivo')?.value.trim()
  if (!fecha) {
    showNotification('Seleccioná una fecha', 'warning')
    return
  }
  const data = obtenerNegocioMock()
  if (!data.diasNoLaborables) data.diasNoLaborables = []
  if (data.diasNoLaborables.some((d) => d.fecha === fecha)) {
    showNotification('Esa fecha ya está registrada', 'warning')
    return
  }
  const diasNoLaborablesPropuestos = [...data.diasNoLaborables, { fecha, motivo: motivo || 'Cerrado' }]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  const cancelarTurnosIds = await confirmarConflictosHorarios({ diasNoLaborables: diasNoLaborablesPropuestos })
  if (cancelarTurnosIds === null) return // el admin cancelo la operacion

  data.diasNoLaborables = diasNoLaborablesPropuestos

  const actualizado = await updateNegocioConfig({
    horarios: data.horarios,
    diasNoLaborables: data.diasNoLaborables,
    cancelarTurnosIds,
  })

  if (actualizado) {
    data.horarios = actualizado.horarios || data.horarios
    data.diasNoLaborables = actualizado.diasNoLaborables || data.diasNoLaborables
  }

  guardarNegocioMock(data)
  renderizarDiasNoLaborables(data.diasNoLaborables)
  document.getElementById('negocio-dia-cerrado-fecha').value = ''
  document.getElementById('negocio-dia-cerrado-motivo').value = ''

  const cancelados = actualizado?.turnosCancelados?.length || 0
  showNotification(
    !actualizado
      ? 'No se pudo agregar dia cerrado en servidor'
      : cancelados > 0
        ? `Dia cerrado agregado. Se cancelaron ${cancelados} turno(s).`
        : 'Dia cerrado agregado',
    actualizado ? 'success' : 'error'
  )
}

async function quitarDiaCerrado(fecha) {
  const data = obtenerNegocioMock()
  data.diasNoLaborables = (data.diasNoLaborables || []).filter((d) => d.fecha !== fecha)

  const actualizado = await updateNegocioConfig({
    horarios: data.horarios,
    diasNoLaborables: data.diasNoLaborables,
  })

  if (actualizado) {
    data.horarios = actualizado.horarios || data.horarios
    data.diasNoLaborables = actualizado.diasNoLaborables || data.diasNoLaborables
  }

  guardarNegocioMock(data)
  renderizarDiasNoLaborables(data.diasNoLaborables)
  showNotification(actualizado ? 'Dia eliminado' : 'No se pudo eliminar dia en servidor', actualizado ? 'info' : 'error')
}
