/* ============================================================
   ELEVÉ BARBERÍA — Reservas Web
   Lógica de reserva multi-paso · Consume API de Vercel
   ============================================================ */

import { API_BASE_URL } from '../../Configuracion/config.js';

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
  cliente: null,
  total: null,
};
let fechasDisponibles = [];

// ---------------------------------------------------------------
// INICIALIZACIÓN
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('servicios-container')) return;

  generarFechasDisponibles();
  cargarServicios();

  document.getElementById('btn-continuar').addEventListener('click', guardarDatosCliente);
  document.getElementById('btn-confirmar-reserva').addEventListener('click', async () => {
    const btn = document.getElementById('btn-confirmar-reserva');
    btn.disabled = true;
    btn.textContent = 'Confirmando reserva...';

    const turnoCreado = await crearTurno();
    if (turnoCreado) {
      mostrarPasoConfirmado();
    } else {
      btn.disabled = false;
      btn.textContent = 'Confirmar reserva';
    }
  });

  document.querySelectorAll('.btn-volver').forEach(btn => btn.addEventListener('click', volver));
  document.getElementById('btn-nueva-reserva').addEventListener('click', volver);
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
    const res = await fetch(`${API_BASE_URL}/servicios`);
    if (!res.ok) throw new Error(res.statusText);
    const servicios = await res.json();

    contenedor.innerHTML = '';
    if (!servicios.length) {
      contenedor.innerHTML = '<p style="font-size:0.8rem;color:var(--color-text-muted)">Sin servicios disponibles.</p>';
      return;
    }

    servicios.forEach(servicio => {
      const card = document.createElement('div');
      card.className = 'tarjeta';
      card.onclick = () => seleccionarServicio(servicio);
      card.innerHTML = `
        <div class="tarjeta__encabezado">
          <h3 class="tarjeta__titulo">${servicio.nombre}</h3>
        </div>
        <div class="tarjeta__contenido">
          <p class="tarjeta-servicio__descripcion">${servicio.descripcion}</p>
          <div class="tarjeta-servicio__detalles">
            <span class="etiqueta etiqueta--precio">$${servicio.precio}</span>
            <span class="etiqueta">${servicio.duracion_min} min</span>
          </div>
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
    card.className = 'tarjeta';
    card.onclick = () => seleccionarBarbero(barbero);
    card.innerHTML = `
      <div class="tarjeta__contenido">
        <div class="barbero-info">
          <div class="barbero-avatar">✂</div>
          <div class="barbero-detalles">
            <h3>${barbero.nombre}</h3>
            <p class="barbero-especialidad">${barbero.especialidades}</p>
          </div>
        </div>
      </div>
    `;
    contenedor.appendChild(card);
  });
}

function cargarFechas() {
  const contenedor = document.getElementById('fechas-container');
  contenedor.innerHTML = '';
  fechasDisponibles.forEach(fecha => {
    const card = document.createElement('div');
    card.className = 'tarjeta';
    card.onclick = () => seleccionarFecha(fecha);
    card.innerHTML = `
      <div class="tarjeta__contenido">
        <div class="tarjeta-fecha">${formatearFecha(fecha)}</div>
      </div>
    `;
    contenedor.appendChild(card);
  });
}

function cargarHorarios(horarios) {
  const contenedor = document.getElementById('horarios-container');
  const sinHorarios = document.getElementById('sin-horarios');
  contenedor.innerHTML = '';
  sinHorarios.style.display = 'none';

  if (!Array.isArray(horarios) || !horarios.length) {
    sinHorarios.style.display = 'block';
    return;
  }

  const ahora = new Date();
  // Fecha local (no UTC) para comparar correctamente en cualquier zona horaria
  const hoyLocal = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`;
  const esHoy = reservaActual.fecha === hoyLocal;

  const disponibles = horarios.filter(h => {
    if (!h.disponible) return false;
    // Si es hoy, solo mostrar slots con al menos 15 minutos de anticipación
    if (esHoy) {
      const [hh, mm] = h.inicio.split(':').map(Number);
      const minutosSlot = hh * 60 + mm;
      const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
      if (minutosSlot - minutosAhora < 15) return false;
    }
    return true;
  });

  if (!disponibles.length) {
    sinHorarios.style.display = 'block';
    return;
  }

  disponibles.forEach(horario => {
    const card = document.createElement('div');
    card.className = 'tarjeta';
    card.onclick = () => seleccionarHora(horario);
    card.innerHTML = `
      <div class="tarjeta__contenido">
        <div class="tarjeta-horario">${horario.inicio}</div>
      </div>
    `;
    contenedor.appendChild(card);
  });
}

function cargarResumen() {
  document.getElementById('resumen-nombre').textContent = reservaActual.cliente.nombre;
  document.getElementById('resumen-telefono').textContent = reservaActual.cliente.telefono;
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
  const cliente_id = await obtenerOCrearClienteID(
    reservaActual.cliente.nombre,
    reservaActual.cliente.telefono
  );

  if (!cliente_id) {
    alert('Error al procesar los datos del cliente. Intentá de nuevo.');
    return null;
  }

  const turnoData = {
    cliente_id,
    empleado_id: reservaActual.barbero_id,
    servicio_id: reservaActual.servicio_id,
    fecha: reservaActual.fecha,
    hora_inicio: reservaActual.hora_inicio,
    hora_fin: reservaActual.hora_fin,
    estado: 'pendiente',
    observaciones: null,
    precio: reservaActual.total,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/turnos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(turnoData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || res.statusText);
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
    const res = await fetch(`${API_BASE_URL}/servicios/${servicio.id}/empleados`);
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
  cargarFechas();
  irAPaso(3);
}

async function seleccionarFecha(fecha) {
  reservaActual.fecha = fecha;
  try {
    const url = `${API_BASE_URL}/turnos/horarios-disponibles/${reservaActual.barbero_id}/${reservaActual.servicio_id}/${fecha}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    cargarHorarios(data.horarios_disponibles);
    irAPaso(4);
  } catch (err) {
    console.error('seleccionarFecha:', err);
    alert('Error al cargar horarios. Intentá de nuevo.');
  }
}

function seleccionarHora(horario) {
  reservaActual.hora_inicio = horario.inicio;
  reservaActual.hora_fin = horario.fin;
  irAPaso(5);
}

// ---------------------------------------------------------------
// FORMULARIO (paso 5)
// ---------------------------------------------------------------
function configurarValidacionFormulario() {
  const nombreInput = document.getElementById('nombre');
  const telefonoInput = document.getElementById('telefono');
  const continuarBtn = document.getElementById('btn-continuar');
  const nombreError = document.getElementById('nombre-error');
  const telefonoError = document.getElementById('telefono-error');

  const regexNombre = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]{3,}$/;
  const regexTelefono = /^\d{8,}$/;

  function validarNombre() {
    const val = nombreInput.value.trim();
    if (!val) { nombreError.textContent = ''; nombreInput.classList.remove('invalido'); return false; }
    if (regexNombre.test(val)) { nombreError.textContent = ''; nombreInput.classList.remove('invalido'); return true; }
    nombreError.textContent = 'Mínimo 3 letras, sin números.';
    nombreInput.classList.add('invalido');
    return false;
  }

  function validarTelefono() {
    const val = telefonoInput.value.trim();
    if (!val) { telefonoError.textContent = ''; telefonoInput.classList.remove('invalido'); return false; }
    if (regexTelefono.test(val)) { telefonoError.textContent = ''; telefonoInput.classList.remove('invalido'); return true; }
    telefonoError.textContent = 'Solo números, mínimo 8 dígitos.';
    telefonoInput.classList.add('invalido');
    return false;
  }

  function sincronizarBoton() {
    continuarBtn.disabled = !(validarNombre() && validarTelefono());
  }

  nombreInput.addEventListener('input', sincronizarBoton);
  telefonoInput.addEventListener('input', sincronizarBoton);
  sincronizarBoton();
}

function guardarDatosCliente() {
  const nombre = document.getElementById('nombre').value.trim();
  const telefono = document.getElementById('telefono').value.trim();
  const telefonoCompleto = telefono.startsWith('+') ? telefono : `+54${telefono}`;
  if (nombre && telefono) {
    reservaActual.cliente = { nombre, telefono: telefonoCompleto };
    cargarResumen();
    irAPaso(6);
  }
}

// ---------------------------------------------------------------
// CONFIRMACIÓN VISUAL (in-place en paso 6)
// ---------------------------------------------------------------
let reservaConfirmada = false;

function mostrarPasoConfirmado() {
  reservaConfirmada = true;
  const r = reservaActual;

  // Cambiar tema del panel
  document.querySelector('.reserva-panel').classList.add('reserva-panel--confirmada');

  // Ocultar barra de progreso y paso-6
  document.querySelector('.progreso').style.display = 'none';
  document.getElementById('paso-6').style.display = 'none';

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

    // Restaurar progreso y paso-6
    document.querySelector('.progreso').style.display = '';
    document.getElementById('paso-6').style.display = '';

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
    4: () => { reservaActual.fecha = null; },
    5: () => { reservaActual.hora_inicio = null; reservaActual.hora_fin = null; },
    6: () => { reservaActual.cliente = null; },
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
