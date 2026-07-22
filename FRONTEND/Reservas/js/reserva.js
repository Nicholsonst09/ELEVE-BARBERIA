/* ============================================================
   ELEVÉ BARBERÍA — Reservas Web
   Lógica de reserva multi-paso · Consume API de Vercel
   ============================================================ */

import { API_BASE_URL } from './config.js?v=2';

// Reintenta el fetch ante fallos de red transitorios (p.ej. cold start del
// backend en Vercel) y ante respuestas 5xx/429, que suelen ser hiccups
// pasajeros del backend o de Supabase — a diferencia de un 4xx (esos no se
// reintentan, porque repetir el mismo pedido no los va a arreglar).
// Backoff 1s/2s/4s: un cold start de Vercel puede tardar varios segundos en
// levantar la función, así que las esperas entre intentos son exponenciales
// en vez de lineales. Cada intento corta a los 10s con AbortSignal.timeout
// para no quedar colgado esperando una conexión que nunca va a responder.
async function fetchConReintento(url, opciones, intentos = 4, esperaBaseMs = 1000) {
  let ultimoError;
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const respuesta = await fetch(url, { ...opciones, signal: AbortSignal.timeout(10000) });
      const esErrorTransitorio = !respuesta.ok && (respuesta.status >= 500 || respuesta.status === 429);
      if (esErrorTransitorio && intento < intentos) {
        await new Promise((resolve) => setTimeout(resolve, esperaBaseMs * 2 ** (intento - 1)));
        continue;
      }
      return respuesta;
    } catch (error) {
      ultimoError = error;
      if (intento === intentos) throw error;
      await new Promise((resolve) => setTimeout(resolve, esperaBaseMs * 2 ** (intento - 1)));
    }
  }
  throw ultimoError;
}

// Deshabilita un botón y le muestra un spinner + texto mientras dura un
// proceso async (guardar, confirmar reserva, etc). Devuelve la función para
// restaurarlo a su estado original.
function setBtnLoading(btn, texto = 'Guardando...') {
  if (!btn) return () => {};
  const textoOriginal = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-btn"></span>${texto}`;
  return () => {
    btn.disabled = false;
    btn.innerHTML = textoOriginal;
  };
}

// --- Estado de la reserva ---
let pasoActual = 1;
let reservaActual = {
  servicio: null,
  duracion: null,
  servicio_id: null,
  barbero_id: null,
  barbero: null,
  fecha: null,
  hora_inicio: null,
  hora_fin: null,
  cliente: null,  // { nombre, telefono, email }
  total: null,
};
let fechasDisponibles = [];
// Fechas ("YYYY-MM-DD") en las que ya se comprobó que el barbero elegido no
// tiene horarios libres — se usa para pintar la card gris sin tener que
// volver a consultar la API cada vez que se re-renderizan las cards.
let fechasSinHorarios = new Set();

function normalizarTexto(valor, fallback = '') {
  if (typeof valor !== 'string') return fallback;
  const limpio = valor.trim();
  return limpio || fallback;
}

function construirMapsEmbedDesdeLink(link) {
  const limpio = normalizarTexto(link);
  if (!limpio) return '';

  try {
    const url = new URL(limpio);
    const host = url.hostname.toLowerCase();
    if (!host.includes('google.') && !host.includes('goo.gl')) return '';

    if (url.pathname.includes('/maps/embed')) return limpio;

    const q = url.searchParams.get('q');
    if (q) {
      return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    }

    const partes = url.pathname.split('/').filter(Boolean);
    const idxPlace = partes.findIndex((p) => p === 'place');
    if (idxPlace >= 0 && partes[idxPlace + 1]) {
      const lugar = decodeURIComponent(partes[idxPlace + 1]).replace(/\+/g, ' ');
      return `https://www.google.com/maps?q=${encodeURIComponent(lugar)}&output=embed`;
    }

    return `https://www.google.com/maps?q=${encodeURIComponent(limpio)}&output=embed`;
  } catch {
    return '';
  }
}

function formatearHora(hora = '') {
  const valor = String(hora || '').substring(0, 5)
  return /^\d{2}:\d{2}$/.test(valor) ? valor : ''
}

function capitalizar(texto = '') {
  if (!texto) return ''
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase()
}

// Orden de despliegue: semana empieza el lunes, domingo al final.
const DIAS_ORDEN_DISPLAY = [1, 2, 3, 4, 5, 6, 0]

function construirLineasHorario(horarios = []) {
  if (!Array.isArray(horarios) || horarios.length === 0) {
    return ['Lunes – Sábado: 11:00 – 19:00', 'Domingo: Cerrado']
  }

  const porDia = new Map(horarios.map((h) => [Number(h?.dia), h]))
  const ordenados = DIAS_ORDEN_DISPLAY.map((dia) => porDia.get(dia)).filter(Boolean)

  if (ordenados.length === 0) {
    return ['Sin horario publicado', 'Consultanos por WhatsApp para coordinar.']
  }

  // Agrupa días consecutivos que comparten el mismo estado (abierto con el
  // mismo horario, o cerrado) en vez de asumir que todo el rango tiene el
  // horario del primer día activo.
  const grupos = []
  ordenados.forEach((h) => {
    const activo = h?.activo !== false
    const clave = activo ? `${formatearHora(h?.apertura)}-${formatearHora(h?.cierre)}` : 'cerrado'
    const ultimoGrupo = grupos[grupos.length - 1]
    if (ultimoGrupo && ultimoGrupo.clave === clave) {
      ultimoGrupo.dias.push(h)
    } else {
      grupos.push({ clave, activo, dias: [h] })
    }
  })

  const lineas = grupos.map((grupo) => {
    const nombres = grupo.dias.map((d) => capitalizar(d?.nombre || '')).filter(Boolean)
    const etiqueta = nombres.length > 1 ? `${nombres[0]} – ${nombres[nombres.length - 1]}` : nombres[0]

    if (!grupo.activo) return `${etiqueta}: Cerrado`

    const primero = grupo.dias[0]
    const desde = formatearHora(primero?.apertura)
    const hasta = formatearHora(primero?.cierre)
    const rango = (desde && hasta) ? `${desde} – ${hasta}` : ''
    return rango ? `${etiqueta}: ${rango}` : etiqueta
  })

  return lineas.length > 0 ? lineas : ['Sin horario publicado', 'Consultanos por WhatsApp para coordinar.']
}

function aplicarConfigPublicaNegocio(config = {}) {
  const imagenReserva = normalizarTexto(config.reservaImagenUrl);
  const direccion = normalizarTexto(config.direccion);
  const mapsLink = normalizarTexto(config.mapsLink);
  const mapsEmbed = normalizarTexto(config.mapsEmbed) || construirMapsEmbedDesdeLink(mapsLink);
  const telefono = normalizarTexto(config.telefono);
  const email = normalizarTexto(config.email);
  const whatsapp = normalizarTexto(config.whatsapp);
  const instagram = normalizarTexto(config.instagram);
  const facebook = normalizarTexto(config.facebook);
  const horarios = Array.isArray(config.horarios) ? config.horarios : [];

  const imgReserva = document.getElementById('reserva-imagen-principal');
  if (imgReserva && imagenReserva) imgReserva.src = imagenReserva;

  const elDireccion = document.getElementById('contacto-direccion-texto');
  if (elDireccion && direccion) elDireccion.textContent = direccion;

  const elTel = document.getElementById('contacto-telefono-texto');
  if (elTel && telefono) elTel.textContent = telefono;

  const elMail = document.getElementById('contacto-email-texto');
  if (elMail && email) elMail.textContent = email;

  const lineasHorario = construirLineasHorario(horarios)
  const contenedorHorario = document.getElementById('contacto-horario-lineas')
  if (contenedorHorario) {
    contenedorHorario.innerHTML = ''
    lineasHorario.forEach((linea) => {
      const p = document.createElement('p')
      p.textContent = linea
      contenedorHorario.appendChild(p)
    })
  }

  const mapaLink = document.getElementById('contacto-mapa-link');
  if (mapaLink && mapsLink) mapaLink.href = mapsLink;

  const mapaIframe = document.getElementById('contacto-mapa-iframe');
  if (mapaIframe && mapsEmbed) mapaIframe.src = mapsEmbed;

  const mensaje = 'Hola buenas! Me gustaría reservar un turno., gracias.';
  const whatsUrl = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}` : '';
  const navWhatsapp = document.getElementById('nav-whatsapp-link');
  const contactoWhatsapp = document.getElementById('contacto-whatsapp-link');
  const fabWhatsapp = document.getElementById('whatsapp-fab-link');
  if (navWhatsapp && whatsUrl) navWhatsapp.href = whatsUrl;
  if (contactoWhatsapp && whatsUrl) contactoWhatsapp.href = whatsUrl;
  if (fabWhatsapp && whatsUrl) fabWhatsapp.href = whatsUrl;

  const instagramLink = document.getElementById('contacto-instagram-link');
  if (instagramLink) {
    if (instagram) {
      instagramLink.href = instagram;
      instagramLink.style.display = '';
    } else {
      instagramLink.style.display = 'none';
    }
  }

  const facebookLink = document.getElementById('contacto-facebook-link');
  if (facebookLink) {
    if (facebook) {
      facebookLink.href = facebook;
      facebookLink.style.display = '';
    } else {
      facebookLink.style.display = 'none';
    }
  }
}

async function cargarConfigPublicaNegocio() {
  try {
    const res = await fetchConReintento(`${API_BASE_URL}/negocio/publico`);
    if (!res.ok) throw new Error(res.statusText);
    const config = await res.json();
    aplicarConfigPublicaNegocio(config);
  } catch (err) {
    console.warn('No se pudo cargar config publica del negocio:', err);
  }
}

// ---------------------------------------------------------------
// INICIALIZACIÓN
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('servicios-container')) return;

  cargarConfigPublicaNegocio();
  generarFechasDisponibles();
  cargarServicios();

  document.getElementById('btn-continuar').addEventListener('click', guardarDatosCliente);
  document.getElementById('btn-confirmar-reserva').addEventListener('click', async () => {
    const btn = document.getElementById('btn-confirmar-reserva');
    const restaurar = setBtnLoading(btn, 'Confirmando reserva...');

    const turnoCreado = await crearTurno();
    if (turnoCreado) {
      mostrarPasoConfirmado();
    } else {
      restaurar();
    }
  });

  document.querySelectorAll('.btn-volver').forEach(btn => btn.addEventListener('click', volver));
  document.getElementById('btn-nueva-reserva').addEventListener('click', volver);
  document.getElementById('btn-siguiente-fecha-disponible').addEventListener('click', irAProximaFechaDisponible);
  configurarValidacionFormulario();
});

// ---------------------------------------------------------------
// GENERACIÓN DE FECHAS (7 días, sin domingos)
// ---------------------------------------------------------------
function generarFechasDisponibles() {
  fechasDisponibles = [];
  const hoy = new Date();
  for (let i = 0; i < 8; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + i);
    if (fecha.getDay() === 0) continue; // sin domingos
    fechasDisponibles.push(fecha.toISOString().split('T')[0]);
    if (fechasDisponibles.length === 6) break;
  }
}

// ---------------------------------------------------------------
// CARGA Y RENDERIZADO DE PASOS
// ---------------------------------------------------------------
async function cargarServicios() {
  const contenedor = document.getElementById('servicios-container');
  contenedor.innerHTML = '<p style="font-size:0.8rem;color:var(--color-text-muted)">Cargando servicios...</p>';
  try {
    const res = await fetchConReintento(`${API_BASE_URL}/reservas/servicios`);
    if (!res.ok) throw new Error(res.statusText);
    const servicios = await res.json();

    contenedor.innerHTML = '';
    if (!servicios.length) {
      contenedor.innerHTML = '<p style="font-size:0.8rem;color:var(--color-text-muted)">Sin servicios disponibles.</p>';
      return;
    }

    servicios.forEach(servicio => {
      const descripcion = (servicio.descripcion || '').trim();
      const card = document.createElement('div');
      card.className = 'tarjeta tarjeta--servicio';
      card.onclick = () => seleccionarServicio(servicio);
      card.innerHTML = `
        <div class="tarjeta__encabezado">
          <h3 class="tarjeta__titulo">${servicio.nombre}</h3>
        </div>
        <div class="tarjeta__contenido">
          <p class="tarjeta-servicio__descripcion">${descripcion}</p>
          <div class="tarjeta-servicio__detalles">
            <span class="etiqueta etiqueta--precio">$${servicio.precio}</span>
            <span class="etiqueta">${servicio.duracion_min} min</span>
          </div>
          <button type="button" class="btn-agendar-servicio">
            Reservar
          </button>
        </div>
      `;
      contenedor.appendChild(card);
    });
  } catch (err) {
    contenedor.innerHTML = '<p style="font-size:0.8rem;color:var(--color-error)">Error al cargar servicios. Recargá la página.</p>';
    console.error('cargarServicios:', err);
  }
}

function cargarBarberos(barberos) {
  const contenedor = document.getElementById('barberos-container');
  contenedor.innerHTML = '';
  barberos.forEach(barbero => {
    const card = document.createElement('div');
    card.className = 'tarjeta tarjeta--barbero';
    card.onclick = () => seleccionarBarbero(barbero);
    card.innerHTML = `
      <div class="tarjeta__contenido">
        <div class="barbero-info">
          <div class="barbero-avatar">
            ${barbero.avatar_url
              ? `<img src="${barbero.avatar_url}" alt="Avatar de ${barbero.nombre}" class="barbero-avatar-img">`
              : '<span class="barbero-avatar-fallback" aria-hidden="true">✂</span>'
            }
          </div>
          <div class="barbero-detalles">
            <h3>${barbero.nombre}</h3>
            <p class="barbero-especialidad">${barbero.especialidades}</p>
          </div>
        </div>
      </div>
      <button type="button" class="btn-agendar-servicio">
        Elegir <i class="ti ti-chevron-right"></i>
      </button>
    `;
    contenedor.appendChild(card);
  });
}

function cargarFechas() {
  const contenedor = document.getElementById('fechas-container');
  contenedor.innerHTML = '';
  fechasDisponibles.forEach(fecha => {
    const card = document.createElement('div');
    card.className = 'tarjeta' + (fechasSinHorarios.has(fecha) ? ' tarjeta--vacia' : '');
    card.dataset.fecha = fecha;
    card.onclick = () => seleccionarFecha(fecha);
    card.innerHTML = `
      <div class="tarjeta__contenido">
        <div class="tarjeta-fecha">${formatearFecha(fecha)}</div>
      </div>
    `;
    contenedor.appendChild(card);
  });
}

// Pinta de gris la card de la fecha (si está en pantalla) y recuerda que ese
// día no tiene horarios, para no tener que re-consultar la API si el usuario
// vuelve a pasar por ahí.
function marcarFechaSinHorarios(fecha) {
  fechasSinHorarios.add(fecha);
  const card = document.querySelector(`#fechas-container [data-fecha="${fecha}"]`);
  if (card) card.classList.add('tarjeta--vacia');
}

function marcarFechaConHorarios(fecha) {
  fechasSinHorarios.delete(fecha);
  const card = document.querySelector(`#fechas-container [data-fecha="${fecha}"]`);
  if (card) card.classList.remove('tarjeta--vacia');
}

function mostrarSinHorarios() {
  marcarFechaSinHorarios(reservaActual.fecha);
  const sinHorarios = document.getElementById('sin-horarios');
  const btn = document.getElementById('btn-siguiente-fecha-disponible');
  btn.disabled = false;
  btn.textContent = 'Ir a la próxima fecha disponible';
  sinHorarios.style.display = 'flex';
}

function cargarHorarios(horarios) {
  const contenedor = document.getElementById('horarios-container');
  const sinHorarios = document.getElementById('sin-horarios');
  contenedor.innerHTML = '';
  sinHorarios.style.display = 'none';

  if (!Array.isArray(horarios) || !horarios.length) {
    mostrarSinHorarios();
    return;
  }

  const ahora = new Date();
  // Fecha local (no UTC) para comparar correctamente en cualquier zona horaria
  const hoyLocal = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`;
  const esHoy = reservaActual.fecha === hoyLocal;

  const disponibles = horarios.filter(h => {
    if (!h.disponible) return false;
    // Si es hoy, ocultar solo los horarios que ya pasaron (misma regla que el admin)
    if (esHoy) {
      const [hh, mm] = h.inicio.split(':').map(Number);
      const minutosSlot = hh * 60 + mm;
      const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
      if (minutosSlot < minutosAhora) return false;
    }
    return true;
  });

  if (!disponibles.length) {
    mostrarSinHorarios();
    return;
  }

  marcarFechaConHorarios(reservaActual.fecha);

  const grupos = [
    { titulo: 'Mañana', horarios: [] },
    { titulo: 'Tarde', horarios: [] },
    { titulo: 'Noche', horarios: [] },
  ];
  disponibles.forEach(horario => {
    const [hh] = horario.inicio.split(':').map(Number);
    if (hh < 12) grupos[0].horarios.push(horario);
    else if (hh < 19) grupos[1].horarios.push(horario);
    else grupos[2].horarios.push(horario);
  });

  grupos.filter(g => g.horarios.length).forEach(grupo => {
    const seccion = document.createElement('div');
    seccion.className = 'horarios-grupo';
    seccion.innerHTML = `<h4 class="horarios-grupo__titulo">${grupo.titulo}</h4>`;

    const grid = document.createElement('div');
    grid.className = 'horarios-grid';
    grupo.horarios.forEach(horario => {
      const card = document.createElement('div');
      card.className = 'tarjeta';
      card.onclick = () => seleccionarHora(horario);
      card.innerHTML = `
        <div class="tarjeta__contenido">
          <div class="tarjeta-horario">${horario.inicio}</div>
        </div>
      `;
      grid.appendChild(card);
    });

    seccion.appendChild(grid);
    contenedor.appendChild(seccion);
  });
}

function cargarResumen() {
  document.getElementById('resumen-nombre').textContent   = reservaActual.cliente.nombre;
  document.getElementById('resumen-telefono').textContent = reservaActual.cliente.telefono;
  const emailFila = document.getElementById('resumen-email-fila');
  if (reservaActual.cliente.email) {
    document.getElementById('resumen-email').textContent = reservaActual.cliente.email;
    emailFila.style.display = '';
  } else {
    emailFila.style.display = 'none';
  }
  document.getElementById('resumen-servicio').textContent = reservaActual.servicio;
  document.getElementById('resumen-barbero').textContent = reservaActual.barbero;
  document.getElementById('resumen-fecha').textContent = formatearFecha(reservaActual.fecha);
  document.getElementById('resumen-hora').textContent = reservaActual.hora_inicio;
  document.getElementById('resumen-duracion').textContent = `${reservaActual.duracion} min`;
  document.getElementById('resumen-precio').textContent = `$${reservaActual.total}`;
}

// ---------------------------------------------------------------
// LLAMADAS A LA API
// ---------------------------------------------------------------
async function obtenerOCrearClienteID(nombre, telefono) {
  // Mantenida por compatibilidad — el flujo principal ya usa /api/v1/reservas
  try {
    const res = await fetch(`${API_BASE_URL}/clientes/obtener-o-crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, telefono }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.cliente_id;
  } catch (err) {
    console.error('obtenerOCrearClienteID:', err);
    return null;
  }
}

async function crearTurno() {
  const { nombre, telefono, email } = reservaActual.cliente;

  const turnoData = {
    nombre,
    telefono,
    email:        email || null,
    servicio_id:  reservaActual.servicio_id,
    empleado_id:  reservaActual.barbero_id,
    fecha:        reservaActual.fecha,
    hora_inicio:  reservaActual.hora_inicio,
    observaciones: null,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/reservas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(turnoData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.mensaje || res.statusText);
    }
    return await res.json();
  } catch (err) {
    console.error('crearTurno:', err);
    alert(`No se pudo crear el turno: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------
// SELECCIÓN EN CADA PASO
// ---------------------------------------------------------------
async function seleccionarServicio(servicio) {
  reservaActual.servicio = servicio.nombre;
  reservaActual.servicio_id = servicio.id;
  reservaActual.total = servicio.precio;
  reservaActual.duracion = servicio.duracion_min;

  try {
    const res = await fetchConReintento(`${API_BASE_URL}/servicios/${servicio.id}/empleados`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    const barberos = data.empleados;

    if (!Array.isArray(barberos) || !barberos.length) {
      document.getElementById('barberos-container').innerHTML =
        '<p style="font-size:0.8rem;color:var(--color-text-muted)">Sin barberos disponibles para este servicio.</p>';
    } else {
      cargarBarberos(barberos);
    }
    irAPaso(2);
  } catch (err) {
    console.error('seleccionarServicio:', err);
    alert('Error al cargar barberos. Intentá de nuevo.');
  }
}

function seleccionarBarbero(barbero) {
  reservaActual.barbero = barbero.nombre;
  reservaActual.barbero_id = barbero.id;
  reservaActual.fecha = null;
  reservaActual.hora_inicio = null;
  reservaActual.hora_fin = null;
  // La disponibilidad "sin horarios" y las fechas extra agregadas por "Ir a
  // la próxima fecha disponible" son específicas del barbero anterior.
  fechasSinHorarios = new Set();
  generarFechasDisponibles();
  cargarFechas();
  irAPaso(3);
  // Precarga la primera fecha disponible (hoy) para no obligar a un click extra.
  if (fechasDisponibles.length) {
    seleccionarFecha(fechasDisponibles[0]);
  }
}

async function seleccionarFecha(fecha) {
  reservaActual.fecha = fecha;
  reservaActual.hora_inicio = null;
  reservaActual.hora_fin = null;

  document.querySelectorAll('#fechas-container .tarjeta').forEach(card => {
    card.classList.toggle('tarjeta--seleccionada', card.dataset.fecha === fecha);
  });

  const contenedorHorarios = document.getElementById('horarios-container');
  contenedorHorarios.innerHTML = '<p class="cargando-horarios">Buscando horarios...</p>';
  document.getElementById('sin-horarios').style.display = 'none';

  try {
    const url = `${API_BASE_URL}/turnos/horarios-disponibles/${reservaActual.barbero_id}/${reservaActual.servicio_id}/${fecha}?origen=web`;
    const res = await fetchConReintento(url);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    cargarHorarios(data.horarios_disponibles);
  } catch (err) {
    console.error('seleccionarFecha:', err);
    contenedorHorarios.innerHTML = '';
    alert('Error al cargar horarios. Intentá de nuevo.');
  }
}

// Busca, día por día a partir de la fecha actual (saltando domingos), el
// próximo día con al menos un horario libre para el barbero/servicio
// elegidos. Si lo encuentra fuera de la ventana de fechas visible, la agrega
// como card extra. Corta a los 45 días para no buscar indefinidamente.
async function irAProximaFechaDisponible() {
  const btn = document.getElementById('btn-siguiente-fecha-disponible');
  const restaurar = setBtnLoading(btn, 'Buscando...');

  const LIMITE_DIAS = 45;
  const base = new Date(`${reservaActual.fecha}T00:00:00`);

  for (let i = 1; i <= LIMITE_DIAS; i++) {
    const candidata = new Date(base);
    candidata.setDate(base.getDate() + i);
    if (candidata.getDay() === 0) continue; // sin domingos

    const fecha = candidata.toISOString().split('T')[0];
    if (fechasSinHorarios.has(fecha)) continue; // ya se sabe que está vacía

    try {
      const url = `${API_BASE_URL}/turnos/horarios-disponibles/${reservaActual.barbero_id}/${reservaActual.servicio_id}/${fecha}?origen=web`;
      const res = await fetchConReintento(url);
      if (!res.ok) continue;
      const data = await res.json();
      const hayLibres = Array.isArray(data.horarios_disponibles) && data.horarios_disponibles.some(h => h.disponible);

      if (hayLibres) {
        if (!fechasDisponibles.includes(fecha)) {
          fechasDisponibles.push(fecha);
          cargarFechas();
        }
        restaurar();
        await seleccionarFecha(fecha);
        document.querySelector(`#fechas-container [data-fecha="${fecha}"]`)
          ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        return;
      }
      fechasSinHorarios.add(fecha);
    } catch (err) {
      console.error('irAProximaFechaDisponible:', err);
    }
  }

  restaurar();
  btn.disabled = true;
  btn.textContent = 'No encontramos fechas disponibles próximamente';
}

function seleccionarHora(horario) {
  reservaActual.hora_inicio = horario.inicio;
  reservaActual.hora_fin = horario.fin;
  irAPaso(4);
}

// ---------------------------------------------------------------
// FORMULARIO (paso 4)
// ---------------------------------------------------------------
function configurarValidacionFormulario() {
  const nombreInput   = document.getElementById('nombre');
  const telefonoInput = document.getElementById('telefono');
  const emailInput    = document.getElementById('email');
  const continuarBtn  = document.getElementById('btn-continuar');
  const nombreError   = document.getElementById('nombre-error');
  const telefonoError = document.getElementById('telefono-error');
  const emailError    = document.getElementById('email-error');

  const regexNombre = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]{3,}$/;
  const regexEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const tocado = { nombre: false, telefono: false, email: false };

  function validar(mostrarErrores = false) {
    const nombreOk   = regexNombre.test(nombreInput.value.trim());
    const telefonoOk = telefonoInput.value.trim().length >= 8;
    const emailVal   = emailInput.value.trim();
    const emailOk    = regexEmail.test(emailVal);

    const mostrarNombre = mostrarErrores || tocado.nombre;
    const mostrarTelefono = mostrarErrores || tocado.telefono;
    const mostrarEmail = mostrarErrores || tocado.email;

    nombreError.textContent   = !mostrarNombre || nombreOk ? '' : 'Ingresá un nombre válido (mín. 3 letras).';
    telefonoError.textContent = !mostrarTelefono || telefonoOk ? '' : 'Ingresá un teléfono válido.';
    emailError.textContent    = !mostrarEmail || emailOk ? '' : 'El email es obligatorio y debe tener formato válido (ej: juan@mail.com).';

    continuarBtn.disabled = !(nombreOk && telefonoOk && emailOk);
    return nombreOk && telefonoOk && emailOk;
  }

  nombreInput.addEventListener('input', () => { tocado.nombre = true; validar(false); });
  telefonoInput.addEventListener('input', () => { tocado.telefono = true; validar(false); });
  emailInput.addEventListener('input', () => { tocado.email = true; validar(false); });

  nombreInput.addEventListener('blur', () => { tocado.nombre = true; validar(false); });
  telefonoInput.addEventListener('blur', () => { tocado.telefono = true; validar(false); });
  emailInput.addEventListener('blur', () => { tocado.email = true; validar(false); });

  validar(false);

  document.getElementById('btn-continuar').addEventListener('click', (e) => {
    const ok = validar(true);
    if (!ok) e.preventDefault();
  });
}

function guardarDatosCliente() {
  const nombre   = document.getElementById('nombre').value.trim();
  const telefono = document.getElementById('telefono').value.trim();
  const email    = document.getElementById('email').value.trim();
  const regexNombre = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]{3,}$/;
  const regexEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const telefonoCompleto = telefono.startsWith('+') ? telefono : `+54${telefono}`;
  const datosValidos = regexNombre.test(nombre) && telefono.length >= 8 && regexEmail.test(email);
  if (datosValidos) {
    reservaActual.cliente = { nombre, telefono: telefonoCompleto, email };
    cargarResumen();
    irAPaso(5);
  }
}

// ---------------------------------------------------------------
// CONFIRMACIÓN VISUAL (in-place en paso 5)
// ---------------------------------------------------------------
let reservaConfirmada = false;

function mostrarPasoConfirmado() {
  reservaConfirmada = true;
  const r = reservaActual;

  // Cambiar tema del panel
  document.querySelector('.reserva-panel').classList.add('reserva-panel--confirmada');

  // Ocultar barra de progreso y paso-5
  document.querySelector('.progreso').style.display = 'none';
  document.getElementById('paso-5').style.display = 'none';

  // Rellenar datos de la confirmación
  document.getElementById('confirmacion-detalle').innerHTML = `
    <div class="confirmacion__fila">
      <span class="confirmacion__lbl">Nombre</span>
      <span class="confirmacion__val">${r.cliente.nombre}</span>
    </div>
    <div class="confirmacion__sep"></div>
    <div class="confirmacion__fila">
      <span class="confirmacion__lbl">Servicio</span>
      <span class="confirmacion__val">${r.servicio}</span>
    </div>
    <div class="confirmacion__fila">
      <span class="confirmacion__lbl">Barbero</span>
      <span class="confirmacion__val">${r.barbero}</span>
    </div>
    <div class="confirmacion__sep"></div>
    <div class="confirmacion__fila">
      <span class="confirmacion__lbl">Fecha</span>
      <span class="confirmacion__val">${formatearFecha(r.fecha)}</span>
    </div>
    <div class="confirmacion__fila">
      <span class="confirmacion__lbl">Hora</span>
      <span class="confirmacion__val">${r.hora_inicio}</span>
    </div>
    <div class="confirmacion__total-fila">
      <span class="confirmacion__total-lbl">Total</span>
      <span class="confirmacion__precio">$${r.total.toLocaleString('es-AR')}</span>
    </div>
  `;

  // Mostrar pantalla de confirmación
  document.getElementById('confirmacion-screen').style.display = 'flex';
}

function resetearReserva() {
  reservaActual = {
    servicio: null, duracion: null, servicio_id: null,
    barbero_id: null, barbero: null, fecha: null,
    hora_inicio: null, hora_fin: null, cliente: null, total: null,
  };
  document.getElementById('nombre').value = '';
  document.getElementById('telefono').value = '';
  document.getElementById('email').value = '';
  cargarServicios();
}

// ---------------------------------------------------------------
// NAVEGACIÓN ENTRE PASOS
// ---------------------------------------------------------------
function irAPaso(numero) {
  const pasoActualEl = document.getElementById(`paso-${pasoActual}`);
  const indicadorActual = document.querySelector(`[data-paso="${pasoActual}"]`);
  pasoActualEl.classList.remove('paso--activo');
  indicadorActual.classList.remove('progreso__paso--activo');
  indicadorActual.classList.add('progreso__paso--completado');

  pasoActual = numero;

  const nuevoPasoEl = document.getElementById(`paso-${pasoActual}`);
  const nuevoIndicador = document.querySelector(`[data-paso="${pasoActual}"]`);
  nuevoPasoEl.classList.add('paso--activo');
  nuevoIndicador.classList.remove('progreso__paso--completado');
  nuevoIndicador.classList.add('progreso__paso--activo');

  actualizarProgreso();
}

function volver() {
  // Si la reserva ya fue confirmada, volver al paso 1 y resetear todo
  if (reservaConfirmada) {
    reservaConfirmada = false;

    // Ocultar pantalla de confirmación
    document.getElementById('confirmacion-screen').style.display = 'none';

    // Restaurar panel al tema oscuro
    document.querySelector('.reserva-panel').classList.remove('reserva-panel--confirmada');

    // Restaurar progreso y paso-5
    document.querySelector('.progreso').style.display = '';
    document.getElementById('paso-5').style.display = '';

    // Restaurar botón confirmar
    const btnConfirmar = document.getElementById('btn-confirmar-reserva');
    btnConfirmar.style.display = '';
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = 'Confirmar reserva';

    resetearReserva();
    irAPaso(1);
    return;
  }

  if (pasoActual <= 1) return;

  // Limpiar datos del paso actual al retroceder
  const limpiar = {
    2: () => { reservaActual.servicio = null; reservaActual.servicio_id = null; reservaActual.total = null; reservaActual.duracion = null; },
    3: () => { reservaActual.barbero = null; reservaActual.barbero_id = null; },
    // No se limpia la fecha: al volver del paso de Datos, la card de fecha
    // sigue mostrándose seleccionada con sus horarios ya cargados, así que
    // el estado tiene que seguir reflejando esa misma fecha.
    4: () => { reservaActual.hora_inicio = null; reservaActual.hora_fin = null; },
    5: () => { reservaActual.cliente = null; },
  };
  if (limpiar[pasoActual]) limpiar[pasoActual]();

  irAPaso(pasoActual - 1);
}

function actualizarProgreso() {
  document.querySelectorAll('.progreso__paso').forEach((el, i) => {
    const n = i + 1;
    el.classList.remove('progreso__paso--activo', 'progreso__paso--completado');
    if (n < pasoActual) el.classList.add('progreso__paso--completado');
    else if (n === pasoActual) el.classList.add('progreso__paso--activo');
  });
}

// ---------------------------------------------------------------
// UTILIDADES
// ---------------------------------------------------------------
function formatearFecha(fecha) {
  const d = new Date(fecha + 'T00:00:00');
  return d.toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}
