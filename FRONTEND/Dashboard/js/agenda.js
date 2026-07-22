// js/agenda.js
import {
  estado,
  horariosDelDia
} from './estado.js';

import {
  fetchTurnos,
  fetchTurnosPendientesCount,
  eliminarTurno,
  createOrUpdateTurno,
  registrarPagoTurno,
  fetchProfesionalesPorServicio,
  fetchHorariosDisponibles,
  buscarOCrearCliente
} from './api.js';

import {
  formatearFecha,
  esHoy,
  puedeDiaAnterior,
  showNotification,
  formatearFechaParaAPI,
  setBtnLoading,
  formatCurrency,
  confirmarAccion,
  puedeMostrarCompletarTurno
} from './utilidades.js';
import { obtenerSesion } from './auth.js';


// Variable para guardar la función que refresca el dashboard
let _recargarDashboardStats = () => console.warn('recargarDashboardStats no inyectada');

// --- Máquina de estados de turnos ---
const TRANSICIONES_VALIDAS = {
  reservado:  ['completado', 'cancelado', 'anulado'],
  completado: [],
  cancelado:  [],
  anulado:    [],
};

const ETIQUETAS_ESTADO = {
  reservado:  'Reservado',
  completado: 'Completado',
  cancelado:  'Cancelado',
  anulado:    'Anulado',
};

const ESTADOS_RESERVADOS = ['reservado'];

function esEstadoReservado(estadoTurno) {
  return ESTADOS_RESERVADOS.includes(String(estadoTurno || '').toLowerCase());
}

function validarTransicion(estadoActual, estadoNuevo) {
  if (estadoActual === estadoNuevo) return true;
  const permitidos = TRANSICIONES_VALIDAS[estadoActual] || [];
  return permitidos.includes(estadoNuevo);
}


// --- Funciones de Lógica de Agenda (Privadas) ---
/* function obtenerEstiloTurno(horaInicio, horaFin) {
  const [horaI, minI] = (horaInicio || "09:00").split(":").map(Number);
  const minutosInicio = (horaI - 9) * 60 + minI;
  const duracionMinutos = 60; // Duración fija asumida (API no envía horaFin)

  return {
    top: `${(minutosInicio / 60) * 150}px`,
    height: `${(duracionMinutos / 60) * 150 - 6}px`
  };
} */

function obtenerEstiloTurno(horaInicio, horaFin, alturaSlot = 150) {
  // Descomponemos ambas horas (ej: "09:30")
  const [horaI, minI] = (horaInicio || "09:00").split(":").map(Number);
  const [horaF, minF] = (horaFin || "10:00").split(":").map(Number);

  // Calculamos minutos totales desde el inicio de la jornada (asumiendo 9:00)
  const minutosInicio = (horaI - 9) * 60 + minI;

  // Duración real en minutos
  const duracionMinutos = (horaF * 60 + minF) - (horaI * 60 + minI);

  return {
    top: `${(minutosInicio / 60) * alturaSlot}px`,
    height: `${Math.max((duracionMinutos / 60) * alturaSlot - 2, 20)}px`
  };
} 

function obtenerEtiquetaEstado(estado) {
  const etiquetas = {
    reservado: "Reservado",
    completado: "Completado",
    cancelado: "Cancelado",
    anulado:   "Anulado",
  };
  return etiquetas[estado] || "Reservado";
}



/**
 * Calcula la diferencia en minutos entre dos horas de un día específico.
 * @param {string} fecha - "YYYY-MM-DD"
 * @param {string} horaInicio - "HH:MM:SS"
 * @param {string} horaFin - "HH:MM:SS"
 * @returns {number} - La duración en minutos
 */
function calcularDuracionEnMinutos(fecha, horaInicio, horaFin) {
  const inicio = new Date(`${fecha}T${horaInicio}`);
  const fin = new Date(`${fecha}T${horaFin}`);

  if (isNaN(inicio) || isNaN(fin)) return '?';

  // Restamos las fechas (el resultado está en milisegundos)
  const diferenciaEnMilisegundos = fin.getTime() - inicio.getTime();

  // Convertimos milisegundos a minutos (1000ms * 60s)
  return diferenciaEnMilisegundos / 60000;
}


function yaComenzóElTurno(turno) {
  const horaStr = (turno.hora || turno.hora_inicio || '').substring(0, 5);
  const fechaTurno = new Date(`${turno.fecha}T${horaStr}:00`);
  const ahora = new Date();
  if (ahora < fechaTurno) return false; // todavía no empezó
  const diffHoras = (ahora - fechaTurno) / (1000 * 60 * 60);
  return diffHoras <= 24; // dentro de las 24h posteriores al turno
}

// --- Funciones de Renderizado de Agenda (Privadas) ---

function renderizarNavegacion() {
  const navPestanas = document.getElementById("navPestanas");
  const turnosDia = estado.turnosPendientesCount;

  let html = `
    <button class="pestana-navegacion pendiente ${estado.profesionalSeleccionado === "reservado" ? "activo" : ""}" data-id="reservado">
      <svg class="icono" style="color: var(--color-primario);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke-width="2"/>
        <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>Turnos del Día</span>
      ${turnosDia > 0 ? `<span class="insignia">${turnosDia}</span>` : ""}
    </button>
  `;

  const sesion = obtenerSesion();
  // Un usuario rol empleado SIN empleado asociado (ej: recepcionista) no tiene
  // una agenda propia que filtrar: ve todas las pestañas, igual que un admin.
  const esEmpleado = sesion?.rol === 'empleado' && !!sesion.empleadoId;
  // Los empleados dados de baja (inactivos) no se muestran como pestañas de la agenda
  const profesionalesActivos = estado.profesionales.filter((prof) => prof.activo !== false);
  const profesionalesVisibles = esEmpleado
    ? profesionalesActivos.filter((prof) => String(prof.id) === String(sesion.empleadoId))
    : profesionalesActivos;

  profesionalesVisibles.forEach((prof) => {
    const primerNombre = prof.nombre.split(' ')[0];
    const avatarTab = prof.avatar_url
      ? `<img src="${prof.avatar_url}" alt="${prof.nombre}" class="avatar-prof-tab">`
      : '<span class="avatar-prof-tab avatar-prof-tab-fallback" aria-hidden="true"><i class="fas fa-cut"></i></span>';

    html += `
      <button class="pestana-navegacion ${String(estado.profesionalSeleccionado) === String(prof.id) ? "activo" : ""}" data-id="${prof.id}">
        ${avatarTab}
        <span class="nombre-prof-tab">${primerNombre}</span>
      </button>
    `;
  });

  navPestanas.innerHTML = html;

  // Leyenda de estados
  const leyenda = document.getElementById("leyendaEstados");
  if (leyenda) {
    leyenda.innerHTML = `
      <span class="leyenda-item"><span class="leyenda-dot" style="background:#f59e0b;"></span>Reservado</span>
      <span class="leyenda-item"><span class="leyenda-dot" style="background:#111111;"></span>Completado</span>
    `;
  }

  // Asigna listeners (esto queda igual)
  navPestanas.querySelectorAll(".pestana-navegacion").forEach((pestana) => {
    pestana.addEventListener("click", () => {
      estado.profesionalSeleccionado = pestana.dataset.id;
      recargarTurnosYAgenda(); // Llama a la función pública de recarga
    });
  });
}

function renderizarEncabezado() {
  const turnosFiltrados = estado.turnos.filter(t => t.estado !== 'cancelado' && t.estado !== 'anulado');
  const profesional = estado.profesionales.find(p => p.id == estado.profesionalSeleccionado);
  const titulo = estado.profesionalSeleccionado === "reservado" ? "Turnos del Día" : (profesional?.nombre || "Turnos del Día");

  document.getElementById("tituloEncabezado").textContent = titulo;
  const fechaCorta = estado.fechaActual
    .toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'long' })
    .replace(/\./g, '');
  document.getElementById("subtituloEncabezado").textContent = `${fechaCorta} · ${turnosFiltrados.length} turnos`;

  const btnDiaAnterior = document.getElementById("btnDiaAnterior");
  const btnHoy = document.getElementById("btnHoy");
  btnDiaAnterior.disabled = !puedeDiaAnterior(estado.fechaActual);
  btnHoy.disabled = esHoy(estado.fechaActual);

  const inputFechaAgenda = document.getElementById("inputFechaAgenda");
  if (inputFechaAgenda) inputFechaAgenda.value = formatearFechaParaAPI(estado.fechaActual);
}

// Nueva función para detectar superposiciones de turnos

function detectarSuperposiciones(turnos) {
  const horaAMinutos = (hora) => {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  };

  if (!turnos.length) return [];

  const turnosConPosicion = turnos.map((turno, index) => ({
    ...turno,
    indiceOriginal: index,
    inicioMin: horaAMinutos(turno.hora),
    finMin: horaAMinutos(turno.hora_fin),
    columna: 0,
    totalColumnas: 1
  }));

  // Ordenar por inicio, luego por duración descendente (más largo primero)
  turnosConPosicion.sort((a, b) =>
    a.inicioMin - b.inicioMin || (b.finMin - b.inicioMin) - (a.finMin - a.inicioMin)
  );

  // Asignación greedy: columna más pequeña disponible
  const colEndTimes = [];
  for (const turno of turnosConPosicion) {
    let col = colEndTimes.findIndex(end => end <= turno.inicioMin);
    if (col === -1) {
      col = colEndTimes.length;
      colEndTimes.push(turno.finMin);
    } else {
      colEndTimes[col] = turno.finMin;
    }
    turno.columna = col;
  }

  // totalColumnas = max columna de los que se superponen con este + 1
  for (const turno of turnosConPosicion) {
    const superpuestos = turnosConPosicion.filter(
      o => o.inicioMin < turno.finMin && o.finMin > turno.inicioMin
    );
    const total = Math.max(...superpuestos.map(o => o.columna)) + 1;
    superpuestos.forEach(o => { if (total > o.totalColumnas) o.totalColumnas = total; });
  }

  return turnosConPosicion;
}

function renderizarGrilla() {
  const cuerpoGrilla = document.getElementById("cuerpoGrilla");
  const esAdmin = obtenerSesion()?.rol === 'admin';
  const turnosFiltrados = estado.turnos.filter(t => t.estado !== 'cancelado' && t.estado !== 'anulado');
  let ranuraHtml = "";
  horariosDelDia.forEach((hora) => {
    ranuraHtml += `
      <div class="ranura-tiempo">
        <div class="etiqueta-tiempo">${hora}</div>
        <div class="contenido-tiempo"></div>
      </div>
    `;
  });
  cuerpoGrilla.innerHTML = ranuraHtml;

  const capaTurnos = document.createElement("div");
  capaTurnos.className = "capa-turnos";
  capaTurnos.innerHTML = `
    <div class="grilla-turnos">
      <div></div>
      <div class="contenedor-turnos" id="contenedorTurnos"></div>
    </div>
  `;
  cuerpoGrilla.appendChild(capaTurnos);

  const contenedor = document.getElementById("contenedorTurnos");

  if (!turnosFiltrados || turnosFiltrados.length === 0) {
    contenedor.innerHTML = `<p style="text-align: center; padding-top: 2rem; color: var(--color-secundario);">No hay turnos para mostrar.</p>`;
    return;
  }

  const turnosConPosicion = detectarSuperposiciones(turnosFiltrados);

  const alturaSlot = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--altura-slot').trim()
  ) || 150;

  turnosConPosicion.forEach((turno) => {
    // --- INICIO DE MODIFICACIÓN 2: Lógica de color ---
    const profesional = estado.profesionales.find(p => String(p.id) === String(turno.empleado_id))
                     || estado.profesionales.find(p => p.nombre === turno.nombre_empleado);
    const estilo = obtenerEstiloTurno(turno.hora, turno.hora_fin, alturaSlot);
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-turno";
    tarjeta.style.top = estilo.top;
    tarjeta.style.height = estilo.height;
    
    // Calcular ancho y posición horizontal según superposiciones
    const anchoColumna = 100 / turno.totalColumnas;
    const leftPosicion = anchoColumna * turno.columna;
    tarjeta.style.width = `calc(${anchoColumna}% - 8px)`;
    tarjeta.style.left = `${leftPosicion}%`;
    
    const duracion = calcularDuracionEnMinutos(turno.fecha, turno.hora, turno.hora_fin);
    
    // Usar el color según el estado del turno
    const coloresEstado = {
      reservado:  '#f59e0b',
      completado: '#111111',
      cancelado:  '#dc2626',
      anulado:    '#6b7280',
    };
    const colorEstado = coloresEstado[turno.estado] || '#525252';
    tarjeta.style.borderLeftColor = colorEstado;
    // --- FIN DE MODIFICACIÓN 2 ---

    // --- INICIO DE MODIFICACIÓN 3: Nuevo HTML ---
    tarjeta.innerHTML = `
      <div class="info-cliente-servicio">
        <div class="cliente-turno">${turno.nombre_cliente}</div>
        <div class="servicio-turno">${turno.nombre_servicio} (${duracion} min)</div>
        <div class="estado-turno-badge">
          <span class="leyenda-dot" style="background:${colorEstado};"></span>
          ${ETIQUETAS_ESTADO[turno.estado] || 'Reservado'}
        </div>
      </div>

      <div class="info-profesional-hora">
        ${turno.nombre_empleado ? `
          <div class="profesional-turno">
            ${(profesional?.avatar_url || turno.avatar_empleado)
              ? `<img src="${profesional?.avatar_url || turno.avatar_empleado}" alt="Avatar ${turno.nombre_empleado}" class="avatar-profesional-turno">`
              : '<span class="avatar-profesional-fallback" aria-hidden="true"><i class="fas fa-cut"></i></span>'
            }
            <span>${turno.totalColumnas > 3 ? turno.nombre_empleado.substring(0, 3) + '.' : turno.nombre_empleado.split(' ')[0]}</span>
          </div>
        ` : ""}
        <div class="hora-turno-apilada">
          <span class="hora-texto">${turno.hora.slice(0, 5)}h</span>
      
        </div>
      </div>
      
      <div class="pie-turno-boton">
        <button type="button" class="editar-turno btn-ojo-turno" title="Ver detalles" aria-label="Ver detalles del turno">
          <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        </button>
        ${esAdmin && esEstadoReservado(turno.estado) ? `
          <button type="button" class="editar-turno btn-tacho-turno" title="Eliminar turno" aria-label="Eliminar turno">
            <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8"/>
            </svg>
          </button>
        ` : ''}
      </div>
    `;
    // --- FIN DE MODIFICACIÓN 3 ---

    const btnOjo = tarjeta.querySelector('.btn-ojo-turno');
    if (btnOjo) {
      btnOjo.addEventListener('click', (event) => {
        event.stopPropagation();
        estado.turnoSeleccionado = turno;
        estado.modoEdicion = false;
        renderizarModal();
      });
    }

    const btnTacho = tarjeta.querySelector('.btn-tacho-turno');
    if (btnTacho) {
      btnTacho.addEventListener('click', async (event) => {
        event.stopPropagation();

        const confirmado = await confirmarAccion(
          `¿Eliminás el turno de ${turno.nombre_cliente}?`,
          'Eliminar turno',
          'Sí, eliminar',
          'Motivo sugerido: error de creación.'
        );
        if (!confirmado) return;

        const restaurar = setBtnLoading(btnTacho, '...');
        try {
          const payload = {
            ...turno,
            id: turno.id,
            cliente_id: turno.cliente_id,
            empleado_id: turno.empleado_id,
            servicio_id: turno.servicio_id,
            hora_inicio: turno.hora ? turno.hora.substring(0, 5) : turno.hora_inicio,
            hora_fin: turno.hora_fin ? turno.hora_fin.substring(0, 5) : turno.hora_fin,
            estado: 'anulado',
          };
          const resultado = await createOrUpdateTurno(payload);
          restaurar();

          if (resultado) {
            if (estado.turnoSeleccionado?.id === turno.id) {
              estado.turnoSeleccionado = null;
              estado.modoEdicion = false;
              estado.modoRegistrarPago = false;
              renderizarModal();
            }
            showNotification('Turno eliminado.', 'success');
            recargarTurnosYAgenda();
            _recargarDashboardStats();
          } else {
            showNotification('No se pudo eliminar el turno.', 'error');
          }
        } catch (error) {
          restaurar();
          showNotification('Error al eliminar el turno.', 'error');
        }
      });
    }

    tarjeta.addEventListener("click", () => {
      estado.turnoSeleccionado = turno;
      estado.modoEdicion = false;
      renderizarModal();
    });

    contenedor.appendChild(tarjeta);
  });
}

// Un usuario con rol empleado solo puede agendarse a si mismo, asi que en los
// formularios de turno solo debe ver los servicios que el mismo presta (no
// el catalogo completo del negocio).
function serviciosParaSesion(sesion) {
  if (sesion?.rol !== 'empleado' || !sesion.empleadoId) return estado.servicios;
  return estado.servicios.filter(s => (s.empleado_ids || []).map(String).includes(String(sesion.empleadoId)));
}

export function renderizarModal() {
  const modal = document.getElementById("modalSuperpuesto");
  const cuerpoModal = document.getElementById("cuerpoModal");
  const tituloModal = document.getElementById("tituloModal");

  if (!estado.turnoSeleccionado) {
    modal.classList.remove("activo");
    estado.modoEdicion = false;
    estado.modoCreacion = false;
    return;
  }

  modal.classList.add("activo");
  const turno = estado.turnoSeleccionado;
  const sesion = obtenerSesion();
  const emailClienteTurno = turno.email_cliente
    || estado.clientes.find(c => String(c.id) === String(turno.cliente_id))?.email
    || '';

  if (estado.modoRegistrarPago && !puedeMostrarCompletarTurno(turno, sesion?.rol)) {
    estado.modoRegistrarPago = false;
  }

  // --- MODO 1: CREAR NUEVO TURNO ---
  if (estado.modoCreacion) {
    tituloModal.textContent = "Programar Nuevo Turno";
    const fechaPorDefecto = formatearFechaParaAPI(estado.fechaActual);
    // Un empleado con ficha propia (barbero) solo puede agendarse a si mismo:
    // el campo queda oculto en vez de mostrado-y-bloqueado. El <select> sigue
    // en el DOM (oculto, no removido) porque cargarProfesionalesParaServicio
    // y el submit siguen leyendo/escribiendo su valor con normalidad.
    const ocultarProfesional = sesion?.rol === 'empleado' && !!sesion.empleadoId;

    cuerpoModal.innerHTML = `
      <form id="formCreacion" novalidate>
        <input type="hidden" id="horaInicioSeleccionada" required>
        
        <div class="grupo-formulario">
          <label class="form-label" for="nombreCliente">Nombre del Cliente <span style="color:red;">*</span></label>
          <input type="text" id="nombreCliente" class="form-input" placeholder="Nombre del cliente" required>
        </div>

        <div class="grupo-formulario">
            <label class="form-label" for="telefono">Teléfono <span style="color:#999; font-size:0.85em;">(Opcional)</span></label>
            <input type="tel" id="telefono" class="form-input" placeholder="+1234567890">
        </div>

        <div class="grupo-formulario">
            <label class="form-label" for="emailCliente">Email <span style="color:#999; font-size:0.85em;">(Opcional Recomendado)</span></label>
            <input type="email" id="emailCliente" class="form-input" placeholder="cliente@email.com">
        </div>

        <div class="grupo-formulario">
          <label class="form-label" for="servicioId">Servicio</label>
          <select id="servicioId" class="form-select" required>
            <option value="">Seleccionar servicio...</option>
            ${serviciosParaSesion(sesion).map(s => `
                <option value="${s.id}" data-precio="${s.precio || 0}" data-duracion="${s.duracion_min || 30}">
                  ${s.nombre}
                </option>
              `).join("")}
          </select>
        </div>

        <div class="grupo-formulario" ${ocultarProfesional ? 'hidden' : ''}>
          <label class="form-label" for="profesionalId">Profesional</label>
          <select id="profesionalId" class="form-select" required disabled>
            <option value="">Seleccionar profesional...</option>
          </select>
        </div>

        <div class="grupo-formulario">
            <div class="fila-label-fecha">
              <label class="form-label">Fecha</label>
              <div class="selector-fecha-agenda">
                <button type="button" class="boton-icono" id="btnElegirFechaTurno" title="Elegir fecha específica">
                  <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2" />
                    <line x1="16" y1="2" x2="16" y2="6" stroke-width="2" stroke-linecap="round" />
                    <line x1="8" y1="2" x2="8" y2="6" stroke-width="2" stroke-linecap="round" />
                    <line x1="3" y1="10" x2="21" y2="10" stroke-width="2" />
                  </svg>
                </button>
                <input type="date" id="inputFechaPicker" class="input-fecha-agenda-oculto" aria-label="Elegir fecha específica" tabindex="-1">
              </div>
            </div>
            <input type="hidden" id="fecha">
            <div id="fechaContenedor" class="lista-fechas"></div>
        </div>

        <div class="grupo-formulario">
            <label class="form-label">Horarios Disponibles</label>
            <div id="horariosContenedor" class="panel-horarios">
              <p class="sin-horarios">Selecciona servicio, profesional y fecha.</p>
            </div>
        </div>

        <div class="grupo-formulario">
          <label class="form-label" for="observaciones">Observaciones</label>
          <textarea id="observaciones" class="form-input" placeholder="Agregar notas..."></textarea>
        </div>

        <div class="pie-modal">
          <button type="button" class="boton-secundario" id="btnCancelarCreacion">Cancelar</button>
          <button type="submit" class="boton-primario">Programar Turno</button>
        </div>
      </form>
    `;
    setupModalCreacionListeners();
  }

  // --- MODO 2: EDITAR TURNO EXISTENTE ---
  else if (estado.modoEdicion) {

    // ── Turno COMPLETADO: solo se puede cambiar el cliente ──────────────────
    if (turno.estado === 'completado') {
      tituloModal.textContent = "Corregir Cliente";
      cuerpoModal.innerHTML = `
        <form id="formEdicionCliente" novalidate>
          <p style="color: var(--color-secundario); font-size: 0.85rem; margin-bottom: 1rem;">
            Este turno ya fue completado. Solo podés corregir los datos del cliente.
          </p>
          <div class="grupo-formulario">
            <label class="form-label" for="nombreCliente">Nombre del Cliente</label>
            <input type="text" id="nombreCliente" class="form-input" value="${turno.nombre_cliente || ''}" required>
          </div>
          <div class="grupo-formulario">
            <label class="form-label" for="telefono">Teléfono</label>
            <input type="tel" id="telefono" class="form-input" value="${turno.telefono_cliente || ''}" required>
          </div>
          <div class="grupo-formulario">
            <label class="form-label" for="emailCliente">Email</label>
            <input type="email" id="emailCliente" class="form-input" value="${emailClienteTurno}" placeholder="cliente@email.com" required>
          </div>
          <div class="pie-modal">
            <button type="button" class="boton-secundario" id="btnCancelarEdicion">Cancelar</button>
            <button type="submit" class="boton-primario">Guardar Cliente</button>
          </div>
        </form>
      `;
      setupModalEdicionClienteListener(turno);
      return;
    }
    // ───────────────────────────────────────────────────────────────────────

    tituloModal.textContent = "Modificar Turno";
    // Mismo criterio que en "Nuevo Turno": si es un barbero, el campo
    // Profesional queda oculto (el <select> sigue en el DOM, solo no visible).
    const ocultarProfesional = sesion?.rol === 'empleado' && !!sesion.empleadoId;

    // En turnos no completados, también se pueden ajustar datos del cliente.
    cuerpoModal.innerHTML = `
        <form id="formEdicion" novalidate>
          <input type="hidden" id="horaInicioSeleccionada" required>
          
          <div class="grupo-formulario">
            <label class="form-label" for="nombreCliente">Nombre del Cliente <span style="color:red;">*</span></label>
            <input type="text" id="nombreCliente" class="form-input" value="${turno.nombre_cliente || ''}" required>
          </div>

          <div class="grupo-formulario">
              <label class="form-label" for="telefono">Teléfono <span style="color:#999; font-size:0.85em;">(Opcional)</span></label>
              <input type="tel" id="telefono" class="form-input" value="${turno.telefono_cliente || ''}">
          </div>
          <div class="grupo-formulario">
              <label class="form-label" for="emailCliente">Email <span style="color:#999; font-size:0.85em;">(Opcional Recomendado)</span></label>
              <input type="email" id="emailCliente" class="form-input" value="${emailClienteTurno}" placeholder="cliente@email.com">
          </div>
          <div class="grupo-formulario">
            <label class="form-label" for="servicioId">Servicio</label>
            <select id="servicioId" class="form-select" required>
              <option value="">Seleccionar servicio...</option>
              ${serviciosParaSesion(sesion).map(s => `
                  <option value="${s.id}" data-precio="${s.precio || 0}" data-duracion="${s.duracion_min || 30}">
                    ${s.nombre}
                  </option>
                `).join("")}
            </select>
          </div>

          <div class="grupo-formulario" ${ocultarProfesional ? 'hidden' : ''}>
            <label class="form-label" for="profesionalId">Profesional</label>
            <select id="profesionalId" class="form-select" required disabled>
              <option value="">Seleccionar profesional...</option>
            </select>
          </div>

          <div class="grupo-formulario">
              <div class="fila-label-fecha">
                <label class="form-label">Fecha</label>
                <div class="selector-fecha-agenda">
                  <button type="button" class="boton-icono" id="btnElegirFechaTurno" title="Elegir fecha específica">
                    <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2" />
                      <line x1="16" y1="2" x2="16" y2="6" stroke-width="2" stroke-linecap="round" />
                      <line x1="8" y1="2" x2="8" y2="6" stroke-width="2" stroke-linecap="round" />
                      <line x1="3" y1="10" x2="21" y2="10" stroke-width="2" />
                    </svg>
                  </button>
                  <input type="date" id="inputFechaPicker" class="input-fecha-agenda-oculto" aria-label="Elegir fecha específica" tabindex="-1">
                </div>
              </div>
              <input type="hidden" id="fecha">
              <div id="fechaContenedor" class="lista-fechas"></div>
          </div>
          
          <div class="grupo-formulario">
              <label class="form-label">Horarios Disponibles</label>
              <div id="horariosContenedor" class="panel-horarios">
                <p class="sin-horarios">Cargando...</p>
              </div>
          </div>

          <div class="grupo-formulario">
            <label class="form-label" for="estado">Estado</label>
              <select id="estado" class="form-select" required>
              ${[turno.estado || 'reservado', ...(TRANSICIONES_VALIDAS[turno.estado || 'reservado'] || [])].map(e =>
                `<option value="${e}">${ETIQUETAS_ESTADO[e] || e}</option>`
              ).join('')}
            </select>
          </div>

          <div class="grupo-formulario">
            <label class="form-label" for="observaciones">Observaciones</label>
            <textarea id="observaciones" class="form-input" placeholder="Agregar notas..."></textarea>
          </div>

          <div class="pie-modal">
            <button type="button" class="boton-secundario" id="btnCancelarEdicion">Cancelar</button>
            <button type="submit" class="boton-primario">Guardar Cambios</button>
          </div>
        </form>
      `;
    // Llamamos a la nueva función de listeners para el modo EDICIÓN
    setupModalEdicionListeners(turno);
  }

  // --- MODO 4: REGISTRAR PAGO ---
  else if (estado.modoRegistrarPago) {
    tituloModal.textContent = "Completar turno";
    const servicioDatos = estado.servicios.find(s => s.nombre === turno.nombre_servicio);
    const precioDatos = Number(turno.precio) || Number(servicioDatos?.precio) || 0;
    const metodoActual = turno.metodoPago || '';

    cuerpoModal.innerHTML = `
      <div class="pago-resumen">
        <div class="pago-resumen-nombre">${turno.nombre_cliente}</div>
        <div class="pago-resumen-detalle">${turno.nombre_servicio} &middot; ${formatCurrency(precioDatos)}</div>
      </div>
      <div class="grupo-formulario">
        <label class="form-label" for="selectMetodoPago">Método de pago</label>
        <select id="selectMetodoPago" class="form-select">
          <option value="">Seleccionar...</option>
          <option value="efectivo"   ${metodoActual === 'efectivo'       ? 'selected' : ''}>Efectivo</option>
          <option value="transferencia" ${metodoActual === 'transferencia' ? 'selected' : ''}>Transferencia</option>
          <option value="tarjeta"    ${metodoActual === 'tarjeta'        ? 'selected' : ''}>Tarjeta</option>
        </select>
      </div>
      <div class="pie-modal">
        <button class="boton-secundario" id="btnCancelarPago">Cancelar</button>
        <button class="boton-primario" id="btnConfirmarCompletar">Completar</button>
      </div>
    `;
    setupModalPagoListeners(turno);
  }

  // --- MODO 3: VER DETALLES (Default) ---
  else {
    tituloModal.textContent = "Detalles del Turno";
    const esAdmin = sesion?.rol === 'admin';
    // Un empleado con ficha propia (barbero) ve el detalle de cualquier turno
    // (para saber qué hay en la agenda), pero solo puede accionar sobre los
    // turnos que son suyos. Un usuario rol empleado SIN ficha asociada (ej:
    // recepcionista) no tiene turnos "propios" que distinguir, así que
    // gestiona todo igual que un admin. El backend valida esto mismo aunque
    // se intente saltear el frontend.
    const puedeGestionarTurno = esAdmin
      || (sesion?.rol === 'empleado' && (!sesion.empleadoId || String(turno.empleado_id) === String(sesion.empleadoId)));
    const puedeCompletarTurno = puedeMostrarCompletarTurno(turno, sesion?.rol);
    const profesional = { nombre: turno.nombre_empleado };
    const servicio = { nombre: turno.nombre_servicio };
    const cliente = { nombre: turno.nombre_cliente, telefono: turno.telefono_cliente };

    // Precio: primero del turno (backend deployado), si no del catálogo local
    const servicioDatos = estado.servicios.find(s => s.nombre === turno.nombre_servicio);
    const precioDatos = Number(turno.precio) || Number(servicioDatos?.precio) || 0;

    cuerpoModal.innerHTML = `
      <div class="detalles-turno-container">
        <div class="detalles-turno-header">
          <div class="detalles-turno-nombre">${profesional.nombre || cliente.nombre}</div>
          <div class="insignia-estado estado-${turno.estado || 'reservado'}">${obtenerEtiquetaEstado(turno.estado || 'reservado')}</div>
        </div>
        <div class="detalles-turno-servicio">${servicio.nombre}</div>
        <div class="detalles-turno-info">
          <div class="detalles-turno-item">
            <svg class="icono" style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            <span>${cliente.nombre}</span>
          </div>
          <div class="detalles-turno-item">
            <svg class="icono" style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            <span>${cliente.telefono || 'No especificado'}</span>
            ${cliente.telefono ? `<button class="btn-copiar-tel" type="button" data-tel="${cliente.telefono}" aria-label="Copiar número de teléfono" title="Copiar número">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:13px;height:13px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            </button>` : ''}
          </div>
          <div class="detalles-turno-item">
            <svg class="icono" style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <span>${turno.fecha}</span>
          </div>
          <div class="detalles-turno-item">
            <svg class="icono" style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>${turno.hora ? turno.hora.substring(0, 5) : ''} - ${turno.hora_fin ? turno.hora_fin.substring(0, 5) : ''}</span>
          </div>
          <div class="detalles-turno-item">
            <svg class="icono" style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>${formatCurrency(precioDatos)}</span>
          </div>
          <div class="detalles-turno-item" id="filaPagoDetalle">
            <svg class="icono" style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>${turno.metodoPago ? etiquetaMetodoPago(turno.metodoPago) : 'Sin pago registrado'}</span>
            ${puedeGestionarTurno && esEstadoReservado(turno.estado) ? `
              <button type="button" class="btn-copiar-tel" id="btnEditarPagoInline" aria-label="Registrar o editar pago" title="Registrar/editar pago">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:13px;height:13px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
        ${turno.observaciones ? `
        <div class="detalles-turno-notas">
          <div class="detalles-turno-notas-titulo">Observaciones</div>
          <div class="detalles-turno-notas-texto">${turno.observaciones}</div>
        </div>
        ` : ''}
      </div>
      <div class="pie-modal pie-modal--detalles">
        ${!puedeGestionarTurno ? '' : esEstadoReservado(turno.estado) ? `
          ${puedeCompletarTurno ? `<button type="button" class="boton-primario pie-modal__btn-full" id="btnCompletarTurno">Completar turno</button>` : ''}
          <button type="button" class="boton-secundario pie-modal__btn-full" id="btnModificar">Modificar turno</button>
          <div class="pie-modal__zona-peligro" role="group" aria-label="Acciones de cancelación">
            <button type="button" class="btn-ghost-peligro btn-ghost-cancelar" id="btnCancelarEstado"
                    title="El cliente avisó que no puede asistir">
              Cancelar turno
            </button>
          </div>
        ` : turno.estado === 'cancelado' && esAdmin ? `
          <button type="button" class="boton-secundario eliminar pie-modal__btn-full" id="btnEliminarTurno">
            Eliminar definitivamente
          </button>
        ` : ''}
      </div>
    `;

    const btnCopiarTel = cuerpoModal.querySelector('.btn-copiar-tel[data-tel]');
    if (btnCopiarTel) {
      btnCopiarTel.addEventListener('click', () => {
        navigator.clipboard.writeText(btnCopiarTel.dataset.tel).then(() => {
          showNotification('Número copiado.', 'success');
        });
      });
    }

    // Registrar/editar el pago sin salir del detalle ni tener que completar
    // el turno de una: útil para dejar asentado un pago adelantado. Se
    // guarda apenas se elige una opción (sin botón de confirmar aparte,
    // que era fácil pasar por alto y cerrar la card sin haber guardado).
    document.getElementById('btnEditarPagoInline')?.addEventListener('click', () => {
      const fila = document.getElementById('filaPagoDetalle');
      const metodoActual = turno.metodoPago || '';
      fila.innerHTML = `
        <svg class="icono" style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <select id="selectPagoInline" class="historial-estado-combo">
          <option value="" ${!metodoActual ? 'selected' : ''} disabled>Seleccionar...</option>
          <option value="efectivo" ${metodoActual === 'efectivo' ? 'selected' : ''}>Efectivo</option>
          <option value="transferencia" ${metodoActual === 'transferencia' ? 'selected' : ''}>Transferencia</option>
          <option value="tarjeta" ${metodoActual === 'tarjeta' ? 'selected' : ''}>Tarjeta</option>
        </select>
        <button type="button" class="btn-copiar-tel" id="btnCancelarPagoInline" aria-label="Cancelar" title="Cancelar">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      `;

      document.getElementById('btnCancelarPagoInline').addEventListener('click', () => {
        renderizarModal();
      });

      document.getElementById('selectPagoInline').addEventListener('change', async (e) => {
        const metodo = e.target.value;
        if (!metodo) return;
        const select = e.target;
        select.disabled = true;
        try {
          const resultado = await registrarPagoTurno(turno.id, metodo, turno.precio);
          if (resultado) {
            estado.turnoSeleccionado = { ...turno, metodoPago: metodo };
            showNotification('Pago registrado correctamente.', 'success');
            renderizarModal();
          } else {
            select.disabled = false;
            showNotification('No se pudo registrar el pago.', 'error');
          }
        } catch (error) {
          select.disabled = false;
          showNotification('Error al registrar el pago.', 'error');
        }
      });
    });

    // Payload base reutilizable para todos los cambios de estado
    const payloadBase = {
      ...turno,
      id: turno.id,
      cliente_id: turno.cliente_id,
      empleado_id: turno.empleado_id,
      servicio_id: turno.servicio_id,
      hora_inicio: turno.hora ? turno.hora.substring(0, 5) : turno.hora_inicio,
      hora_fin: turno.hora_fin ? turno.hora_fin.substring(0, 5) : turno.hora_fin,
    };

    // Sin permiso de gestion, ninguno de estos botones se renderizo en el
    // HTML de arriba; sin este guard, getElementById devolveria null y
    // .addEventListener tiraria una excepcion que rompe el modal entero.
    if (puedeGestionarTurno && esEstadoReservado(turno.estado)) {
      document.getElementById("btnModificar").addEventListener("click", () => {
        estado.modoEdicion = true;
        renderizarModal();
      });

      const btnCompletarTurno = document.getElementById("btnCompletarTurno");
      if (btnCompletarTurno) btnCompletarTurno.addEventListener("click", () => {
        estado.modoRegistrarPago = true;
        renderizarModal();
      });

      document.getElementById("btnCancelarEstado").addEventListener("click", async () => {
        const confirmado = await confirmarAccion(
          `¿Cancelás el turno de ${turno.nombre_cliente}?`,
          'Cancelar turno',
          'Sí, cancelar',
          'el cliente canceló o no puede asistir.'
        );
        if (!confirmado) return;
        const btn = document.getElementById("btnCancelarEstado");
        const restaurar = setBtnLoading(btn, 'Cancelando...');
        try {
          const resultado = await createOrUpdateTurno({ ...payloadBase, estado: 'cancelado' });
          restaurar();
          if (resultado) {
            showNotification('Turno cancelado.', 'success');
            estado.turnoSeleccionado = null;
            estado.modoEdicion = false;
            estado.modoRegistrarPago = false;
            renderizarModal();
            recargarTurnosYAgenda();
            _recargarDashboardStats();
          } else {
            showNotification('No se pudo cancelar el turno.', 'error');
          }
        } catch (error) {
          restaurar();
          showNotification('Error al cancelar el turno.', 'error');
        }
      });

    }

    if (turno.estado === 'cancelado') {
      const btnEliminarTurno = document.getElementById("btnEliminarTurno");
      if (btnEliminarTurno) btnEliminarTurno.addEventListener("click", async () => {
        if (!turno.id) return;
        const confirmado = await confirmarAccion(
          `¿Eliminás definitivamente el turno de ${turno.nombre_cliente}? Esta acción no se puede deshacer.`,
          'Eliminar turno',
          'Eliminar',
          'Motivo sugerido: no se puede atender o hubo un error de creación.'
        );
        if (!confirmado) return;
        try {
          const resultado = await eliminarTurno(turno.id);
          if (resultado) {
            showNotification('Turno eliminado con éxito.', 'success');
            estado.turnoSeleccionado = null;
            recargarTurnosYAgenda();
            _recargarDashboardStats();
          } else {
            showNotification('No se pudo eliminar el turno.', 'error');
          }
        } catch (error) {
          showNotification('Error de red al eliminar el turno.', 'error');
        }
      });
    }
  }
}

// ===============================================
// HELPER: Etiqueta legible para método de pago
// ===============================================
function etiquetaMetodoPago(metodo) {
  const etiquetas = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta: 'Tarjeta',
    sin_pago: 'Sin pago registrado'
  };
  return etiquetas[metodo] || metodo;
}

// ===============================================
// NUEVA FUNCIÓN: Listeners para el Modal de Pago
// ===============================================
function setupModalPagoListeners(turno) {
  document.getElementById('btnCancelarPago').addEventListener('click', () => {
    estado.modoRegistrarPago = false;
    renderizarModal();
  });

  // Registrar el pago y marcar el turno como completado es, en la práctica,
  // siempre la misma acción para el barbero: se unifican en un solo paso
  // para no obligar a un ida y vuelta extra por el modal.
  document.getElementById('btnConfirmarCompletar').addEventListener('click', async () => {
    const select = document.getElementById('selectMetodoPago');
    if (!select.value) {
      showNotification('Seleccioná un método de pago.', 'error');
      return;
    }
    if (select.value === 'sin_pago') {
      showNotification('Seleccioná un método válido para registrar el cobro.', 'error');
      return;
    }
    const confirmado = await confirmarAccion(
      `¿Marcás el turno de ${turno.nombre_cliente} como completado?`,
      '¿Completar turno?',
      'Completar'
    );
    if (!confirmado) return;

    const btn = document.getElementById('btnConfirmarCompletar');
    const restaurar = setBtnLoading(btn, 'Completando...');
    try {
      const resultadoPago = await registrarPagoTurno(turno.id, select.value, turno.precio);
      if (!resultadoPago) {
        restaurar();
        showNotification(estado.error || 'No se pudo guardar el pago.', 'error');
        return;
      }

      const payloadBase = {
        ...turno,
        id: turno.id,
        cliente_id: turno.cliente_id,
        empleado_id: turno.empleado_id,
        servicio_id: turno.servicio_id,
        hora_inicio: turno.hora ? turno.hora.substring(0, 5) : turno.hora_inicio,
        hora_fin: turno.hora_fin ? turno.hora_fin.substring(0, 5) : turno.hora_fin,
      };
      const resultadoEstado = await createOrUpdateTurno({ ...payloadBase, estado: 'completado' });
      restaurar();
      if (resultadoEstado) {
        estado.turnoSeleccionado = { ...turno, metodoPago: select.value, estado: 'completado' };
        estado.modoRegistrarPago = false;
        showNotification('Turno completado correctamente.', 'success');
        renderizarModal();
        recargarTurnosYAgenda();
        _recargarDashboardStats();
      } else {
        showNotification(estado.error || 'Pago registrado, pero no se pudo completar el turno.', 'error');
      }
    } catch (error) {
      restaurar();
      showNotification(error?.message || estado.error || 'Error al completar el turno.', 'error');
    }
  });
}

// ===============================================
// HELPERS: Cards de fecha para modales
// ===============================================

/**
 * Genera un array de exactamente 7 fechas "YYYY-MM-DD" para mostrar como cards,
 * ancladas en fechaBase (por defecto, hoy). La fecha base siempre se incluye
 * (aunque el negocio esté cerrado ese día, o sea una fecha pasada), y el
 * resto se completa hacia adelante salteando los días que el negocio tiene
 * cerrados según su horario semanal real (estado.diasCerradosSemana). Para
 * ver una fecha fuera de esta ventana se usa el ícono de calendario, que
 * reancla la ventana a la fecha elegida.
 */
function generarFechasCards(fechaBase = null) {
  const inicio = fechaBase ? new Date(`${fechaBase}T00:00:00`) : new Date();
  const fechas = [formatearFechaParaAPI(inicio)];
  const diasCerrados = estado.diasCerradosSemana || new Set([0]);

  for (let i = 1; fechas.length < 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    if (diasCerrados.has(d.getDay())) continue;
    fechas.push(formatearFechaParaAPI(d));
  }

  return fechas;
}

/**
 * Renderiza cards de fecha en un contenedor.
 * @param {HTMLElement} contenedor
 * @param {string[]} fechas - Array de "YYYY-MM-DD"
 * @param {HTMLInputElement} inputHidden - Input hidden que guarda el valor
 * @param {Function} onSelect - Callback al seleccionar una fecha
 * @param {string|null} fechaSeleccionada - Fecha a preseleccionar
 */
function renderizarCardsFecha(contenedor, fechas, inputHidden, onSelect, fechaSeleccionada = null) {
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const hoyStr = formatearFechaParaAPI(new Date());

  contenedor.innerHTML = '';
  fechas.forEach(f => {
    const [y, m, d] = f.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const esPasado = f < hoyStr;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'boton-fecha' + (esPasado ? ' pasado' : '');
    btn.dataset.fecha = f;
    btn.innerHTML = `
      <span class="boton-fecha__dia">${DIAS[dateObj.getDay()]}</span>
      <span class="boton-fecha__num">${d}/${m}</span>
    `;

    if (f === fechaSeleccionada) {
      btn.classList.add('seleccionado');
      inputHidden.value = f;
    }

    btn.addEventListener('click', () => {
      contenedor.querySelectorAll('.boton-fecha').forEach(b => b.classList.remove('seleccionado'));
      btn.classList.add('seleccionado');
      inputHidden.value = f;
      onSelect();
    });

    contenedor.appendChild(btn);
  });
}

/**
 * Renderiza los botones de horario agrupados en Mañana / Tarde / Noche.
 * @param {HTMLElement} contenedor
 * @param {Array<{inicio: string}>} horarios
 * @param {HTMLInputElement} inputHoraSelec - Input hidden que guarda la hora elegida
 */
function renderizarHorariosAgrupados(contenedor, horarios, inputHoraSelec) {
  const grupos = [
    { titulo: 'Mañana', horarios: [] },
    { titulo: 'Tarde', horarios: [] },
    { titulo: 'Noche', horarios: [] },
  ];
  horarios.forEach(h => {
    const [hh] = h.inicio.split(':').map(Number);
    if (hh < 12) grupos[0].horarios.push(h);
    else if (hh < 19) grupos[1].horarios.push(h);
    else grupos[2].horarios.push(h);
  });

  contenedor.innerHTML = grupos.filter(g => g.horarios.length).map(grupo => `
    <div class="horarios-grupo">
      <h4 class="horarios-grupo__titulo">${grupo.titulo}</h4>
      <div class="lista-horarios">
        ${grupo.horarios.map(h => `<button type="button" class="boton-horario${h.pasado ? ' pasado' : ''}" data-hora="${h.inicio}">${h.inicio}</button>`).join('')}
      </div>
    </div>
  `).join('');

  contenedor.querySelectorAll('.boton-horario').forEach(btn => {
    btn.addEventListener('click', () => {
      contenedor.querySelectorAll('.boton-horario').forEach(b => b.classList.remove('seleccionado'));
      btn.classList.add('seleccionado');
      inputHoraSelec.value = btn.dataset.hora;
    });
  });
}

// Carga los profesionales que dictan un servicio y repuebla el <select>.
async function cargarProfesionalesParaServicio(servicioId, selectProfesional, contHorarios, inputHoraSelec) {
  // Resetea profesional y horarios
  selectProfesional.innerHTML = '<option value="">Cargando...</option>';
  contHorarios.innerHTML = '<p class="sin-horarios">Selecciona profesional y fecha.</p>';
  inputHoraSelec.value = "";

  if (!servicioId) {
    selectProfesional.innerHTML = '<option value="">Seleccionar profesional...</option>';
    selectProfesional.disabled = true;
    return;
  }

  // Un usuario con rol empleado solo puede agendarse a si mismo: no tiene
  // sentido mostrarle la lista de colegas, se lo fija directamente.
  const sesion = obtenerSesion();
  if (sesion?.rol === 'empleado' && sesion.empleadoId) {
    selectProfesional.innerHTML = `<option value="${sesion.empleadoId}">${sesion.nombre || 'Vos'}</option>`;
    selectProfesional.value = String(sesion.empleadoId);
    selectProfesional.disabled = true;
    // Dispara "change" a mano: el <select> no lo emite al setear .value por
    // codigo, y de ese evento depende la carga de horarios disponibles.
    selectProfesional.dispatchEvent(new Event('change'));
    return;
  }

  const profesionales = await fetchProfesionalesPorServicio(servicioId);

  if (profesionales.length > 0) {
    selectProfesional.innerHTML = '<option value="">Seleccionar profesional...</option>';
    profesionales.forEach(p => {
      selectProfesional.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
    });
    selectProfesional.disabled = false;
  } else {
    selectProfesional.innerHTML = '<option value="">No hay profesionales para este servicio</option>';
    selectProfesional.disabled = true;
  }
}

// ===============================================
// NUEVA FUNCIÓN: Listeners para el Modal de Creación
// ===============================================
function setupModalCreacionListeners() {
  const form = document.getElementById("formCreacion");
  const selectServicio = document.getElementById("servicioId");
  const selectProfesional = document.getElementById("profesionalId");
  const inputFecha = document.getElementById("fecha");
  const contFechas = document.getElementById("fechaContenedor");
  const contHorarios = document.getElementById("horariosContenedor");
  const inputHoraSelec = document.getElementById("horaInicioSeleccionada");

  // --- Lógica de carga encadenada ---

  // 1. Al cambiar Servicio
  selectServicio.addEventListener("change", () => {
    cargarProfesionalesParaServicio(selectServicio.value, selectProfesional, contHorarios, inputHoraSelec);
  });

  // 2. Al cambiar Profesional o Fecha (cargan horarios)
  const cargarHorariosDisponibles = async () => {
    const servicioId = selectServicio.value;
    const profesionalId = selectProfesional.value;
    const fecha = inputFecha.value; // "YYYY-MM-DD"

    inputHoraSelec.value = ""; // Resetea la hora seleccionada

    if (!servicioId || !profesionalId || !fecha) {
      contHorarios.innerHTML = '<p class="sin-horarios">Completa los campos anteriores.</p>';
      return;
    }

    contHorarios.innerHTML = '<p class="sin-horarios">Buscando horarios...</p>';

    // La API espera YYYY-MM-DD, que es el formato del input type="date"
    let horarios = await fetchHorariosDisponibles(profesionalId, servicioId, fecha, 'admin');

    if (horarios.length === 0) {
      contHorarios.innerHTML = '<p class="sin-horarios">No hay horarios disponibles.</p>';
      return;
    }

    // Renderiza los botones de horario agrupados en Mañana / Tarde / Noche
    renderizarHorariosAgrupados(contHorarios, horarios, inputHoraSelec);
  };

  selectProfesional.addEventListener("change", cargarHorariosDisponibles);

  // Inicializar cards de fecha (7 días hábiles anclados en la fecha actual de
  // la agenda). Para elegir una fecha fuera de esa ventana (ej: un turno
  // atrasado si el negocio habilitó PERMITIR_REGISTRO_TURNOS_ATRASADOS, o una
  // fecha más lejana) está el ícono de calendario, que reancla la ventana.
  const btnElegirFecha = document.getElementById("btnElegirFechaTurno");
  const inputFechaPicker = document.getElementById("inputFechaPicker");

  if (btnElegirFecha && inputFechaPicker) {
    if (estado.permitirTurnosAtrasados) {
      const haceUnaSemana = new Date();
      haceUnaSemana.setDate(haceUnaSemana.getDate() - 7);
      inputFechaPicker.min = formatearFechaParaAPI(haceUnaSemana);
    } else {
      inputFechaPicker.min = formatearFechaParaAPI(new Date());
    }
    btnElegirFecha.addEventListener("click", () => {
      if (typeof inputFechaPicker.showPicker === "function") {
        inputFechaPicker.showPicker();
      } else {
        inputFechaPicker.focus();
        inputFechaPicker.click();
      }
    });
    inputFechaPicker.addEventListener("change", () => {
      if (!inputFechaPicker.value) return;
      renderizarCardsFecha(contFechas, generarFechasCards(inputFechaPicker.value), inputFecha, cargarHorariosDisponibles, inputFechaPicker.value);
      cargarHorariosDisponibles();
    });
  }

  // La ventana de cards siempre arranca hoy y preseleccionada en hoy — no en
  // estado.fechaActual (el día que se esté mirando en la agenda), para que
  // "Programar Turno" nunca arranque parado en un día distinto por las
  // dudas. Para cargar un turno atrasado (hasta 7 días, si el negocio lo
  // permite) está el ícono de calendario de arriba, que reancla la ventana
  // a la fecha elegida.
  const fechaPorDefecto = formatearFechaParaAPI(new Date());
  renderizarCardsFecha(contFechas, generarFechasCards(fechaPorDefecto), inputFecha, cargarHorariosDisponibles, fechaPorDefecto);

  // --- Lógica de Envío (Submit) ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const horaInicio = inputHoraSelec.value; // "HH:MM"

    // --- Validaciones del Frontend ---
    if (!horaInicio) {
      showNotification("Debes seleccionar un horario disponible.", "error");
      return;
    }

    // Horario "pasado" (carga atrasada): confirmar antes de programar, para
    // evitar cargar un turno atrasado por error de selección.
    const horarioSeleccionadoEl = contHorarios.querySelector('.boton-horario.seleccionado');
    if (horarioSeleccionadoEl?.classList.contains('pasado')) {
      const confirmado = await confirmarAccion(
        '¿Estás seguro que querés programar un turno en un horario que ya pasó?',
        'Horario pasado',
        'Sí, programar'
      );
      if (!confirmado) return;
    }

    const btnSubmit = form.querySelector('[type="submit"]');
    const restaurar = setBtnLoading(btnSubmit, 'Guardando...');

    const nombreCliente = document.getElementById("nombreCliente").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const email = document.getElementById("emailCliente")?.value?.trim() || null;
    const servicioId = selectServicio.value;
    const fecha = inputFecha.value; // "YYYY-MM-DD"

    // El nombre es obligatorio; teléfono y email son opcionales
    if (!nombreCliente) {
      showNotification("El nombre del cliente es obligatorio.", "error");
      restaurar();
      return;
    }

    // --- PASO 1: OBTENER O CREAR EL CLIENTE (si tiene teléfono o email) ---
    let cliente_id = null;
    if (telefono || email) {
      try {
        cliente_id = await buscarOCrearCliente(nombreCliente, telefono || null, email || null);
      } catch (error) {
        console.error('Error al buscar/crear cliente:', error);
        // Continuar sin cliente_id
      }
    }
    // Si no hay teléfono ni email, cliente_id se queda en null

    // --- PASO 2: CONSTRUIR Y ENVIAR EL TURNO ---

    // 1. Calcular hora_fin (CORREGIDO A HH:MM)
    const optServicio = selectServicio.options[selectServicio.selectedIndex];
    const duracion = parseInt(optServicio.dataset.duracion, 10) || 30;
    const precio = parseFloat(optServicio.dataset.precio) || 0;

    const fechaHoraInicio = new Date(`${fecha}T${horaInicio}:00`);
    const fechaHoraFin = new Date(fechaHoraInicio.getTime() + duracion * 60000);

    // Formatear hora_fin a "HH:MM" para que coincida con la validación del backend
    const horaFinFormateada = `${fechaHoraFin.getHours().toString().padStart(2, '0')}:${fechaHoraFin.getMinutes().toString().padStart(2, '0')}`;

    // 2. Construir el objeto turnoData (AHORA CORRECTO)
    // Esto coincide con lo que espera tu `controlador.turno.mjs` en `agregarTurno`
    const turnoData = {
      cliente_id: cliente_id || null,
      nombre_cliente: nombreCliente,
      telefono_cliente: telefono || null,
      email_cliente: email || null,
      empleado_id: document.getElementById("profesionalId").value,
      servicio_id: servicioId,
      fecha: fecha,
      hora_inicio: horaInicio, // <-- Se envía "HH:MM"
      hora_fin: horaFinFormateada, // <-- Se envía "HH:MM"
      estado: "reservado",
      observaciones: document.getElementById("observaciones").value || null,
      precio: precio,
      origen: 'admin'
    };

    // 3. Llamar a la API de turnos
    const resultado = await createOrUpdateTurno(turnoData);
    restaurar();

    if (resultado) {
      showNotification("Turno creado correctamente", "success");
      estado.turnoSeleccionado = null; // Cierra el modal
      recargarTurnosYAgenda();
      _recargarDashboardStats();
      renderizarModal(); // Asegura el cierre
    } else {
      showNotification("Error al crear el turno. Revisa los datos.", "error");
    }
  });


  // --- Lógica de Cancelar ---
  document.getElementById("btnCancelarCreacion").addEventListener("click", () => {
    estado.turnoSeleccionado = null; // Cierra el modal
    renderizarModal();
  });
}

// ===============================================
// ===============================================
// FUNCIÓN: Listener para editar solo el cliente (turno completado)
// ===============================================
function setupModalEdicionClienteListener(turno) {
  document.getElementById('btnCancelarEdicion').addEventListener('click', () => {
    estado.modoEdicion = false;
    renderizarModal();
  });

  document.getElementById('formEdicionCliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('[type="submit"]');
    const restaurar = setBtnLoading(btnSubmit, 'Guardando...');

    const nombre = document.getElementById('nombreCliente').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const email = document.getElementById('emailCliente').value.trim();

    if (!nombre || !telefono || !email) {
      showNotification('Nombre, teléfono y email son obligatorios.', 'error');
      restaurar();
      return;
    }

    const cliente_id = await buscarOCrearCliente(nombre, telefono, email);
    if (!cliente_id) {
      showNotification('Error al buscar o crear el cliente.', 'error');
      restaurar();
      return;
    }

    const resultado = await createOrUpdateTurno({ id: turno.id, cliente_id });
    restaurar();

    if (resultado) {
      estado.turnoSeleccionado = { ...turno, nombre_cliente: nombre, telefono_cliente: telefono, email_cliente: email };
      estado.modoEdicion = false;
      showNotification('Cliente actualizado correctamente.', 'success');
      recargarTurnosYAgenda();
      _recargarDashboardStats();
    } else {
      showNotification('Error al actualizar el cliente.', 'error');
    }
  });
}

// ===============================================
// NUEVA FUNCIÓN: Listeners para el Modal de Edición
// ===============================================
function setupModalEdicionListeners(turno) {
  // Encontrar el servicio y profesional ID basado en los nombres
  const servicioSeleccionado = estado.servicios.find(s => s.nombre === turno.nombre_servicio);
  const profesionalSeleccionado = estado.profesionales.find(p => String(p.id) === String(turno.empleado_id))
    || estado.profesionales.find(p => p.nombre === turno.nombre_empleado);

  // Selectores
  const form = document.getElementById("formEdicion");
  const selectServicio = document.getElementById("servicioId");
  const selectProfesional = document.getElementById("profesionalId");
  const inputFecha = document.getElementById("fecha");
  const contHorarios = document.getElementById("horariosContenedor");
  const inputHoraSelec = document.getElementById("horaInicioSeleccionada");
  const selectEstado = document.getElementById("estado");
  const inputObservaciones = document.getElementById("observaciones");
  const inputNombreCliente = document.getElementById("nombreCliente");
  const inputTelefono = document.getElementById("telefono");
  const inputEmailCliente = document.getElementById("emailCliente");

  // --- Lógica de carga encadenada (IDÉNTICA A LA DE CREACIÓN) ---

  // Función para cargar profesionales (se usa en 2 lugares)
  const cargarProfesionales = async () => {
    const servicioId = selectServicio.value;
    selectProfesional.innerHTML = '<option value="">Cargando...</option>';
    selectProfesional.disabled = true;

    if (!servicioId) {
      selectProfesional.innerHTML = '<option value="">Seleccionar profesional...</option>';
      return;
    }

    // Un usuario con rol empleado solo puede tener turnos asignados a si
    // mismo: no tiene sentido mostrarle la lista de colegas.
    const sesion = obtenerSesion();
    if (sesion?.rol === 'empleado' && sesion.empleadoId) {
      selectProfesional.innerHTML = `<option value="${sesion.empleadoId}">${sesion.nombre || 'Vos'}</option>`;
      selectProfesional.value = String(sesion.empleadoId);
      selectProfesional.disabled = true;
      selectProfesional.dispatchEvent(new Event('change'));
      return;
    }

    const profesionales = await fetchProfesionalesPorServicio(servicioId);

    if (profesionales.length > 0) {
      selectProfesional.innerHTML = '<option value="">Seleccionar profesional...</option>';
      profesionales.forEach(p => {
        selectProfesional.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
      });
      selectProfesional.disabled = false;
    } else {
      selectProfesional.innerHTML = '<option value="">No hay profesionales para este servicio</option>';
    }
  };

  const cargarHorariosDisponibles = async () => {
    const servicioId = selectServicio.value;
    const profesionalId = selectProfesional.value;
    const fecha = inputFecha.value;

    inputHoraSelec.value = "";

    if (!servicioId || !profesionalId || !fecha) {
      contHorarios.innerHTML = '<p class="sin-horarios">Completa los campos anteriores.</p>';
      return;
    }

    contHorarios.innerHTML = '<p class="sin-horarios">Buscando horarios...</p>';

    // 1. OBTENEMOS LOS HORARIOS
    let horarios = await fetchHorariosDisponibles(profesionalId, servicioId, fecha, 'admin');

    const _ahora = new Date();
    const _hoyStr = `${_ahora.getFullYear()}-${String(_ahora.getMonth()+1).padStart(2,'0')}-${String(_ahora.getDate()).padStart(2,'0')}`;
    const _ahoraHHMM = `${String(_ahora.getHours()).padStart(2,'0')}:${String(_ahora.getMinutes()).padStart(2,'0')}`;

    if (fecha < _hoyStr) {
      // Fecha pasada: no hay slots nuevos disponibles, solo mostrar el original
      horarios = [];
    } else if (fecha === _hoyStr) {
      // Hoy: filtrar los slots que ya pasaron
      horarios = horarios.filter(h => h.inicio >= _ahoraHHMM);
    }

    // --- FIX DE RE-INSERCIÓN ---
    // Si la fecha del formulario coincide con la fecha original del turno,
    // garantizar que el slot original siempre aparezca (para poder confirmar el horario actual)
    const horaTurnoOriginal = turno.hora.substring(0, 5);

    if (fecha === turno.fecha) {
      // Para hoy: solo re-insertar si el slot original todavía no pasó
      const slotOriginalValido = fecha !== _hoyStr || horaTurnoOriginal >= _ahoraHHMM;
      if (slotOriginalValido) {
        const horaOriginalExiste = horarios.some(h => h.inicio === horaTurnoOriginal);
        if (!horaOriginalExiste) {
          horarios.push({ inicio: horaTurnoOriginal });
          horarios.sort((a, b) => a.inicio.localeCompare(b.inicio));
        }
      }
    }
    // --- FIN DEL FIX ---

    if (horarios.length === 0) {
      contHorarios.innerHTML = '<p class="sin-horarios">No hay horarios disponibles.</p>';
      return;
    }

    // 2. Renderiza (con la lista modificada), agrupado en Mañana / Tarde / Noche
    renderizarHorariosAgrupados(contHorarios, horarios, inputHoraSelec);
  };

  // 1. Al cambiar Servicio
  selectServicio.addEventListener("change", async () => {
    contHorarios.innerHTML = '<p class="sin-horarios">Selecciona profesional y fecha.</p>';
    inputHoraSelec.value = "";
    await cargarProfesionales();
  });

  // 2. Al cambiar Profesional
  selectProfesional.addEventListener("change", cargarHorariosDisponibles);

  // Ícono de calendario: reancla la ventana de 7 días a la fecha elegida.
  // No se puede mover un turno a una fecha pasada (regla del backend), salvo
  // que sea la fecha original del turno (ya incluida siempre en la ventana).
  const contFechas = document.getElementById("fechaContenedor");
  const btnElegirFecha = document.getElementById("btnElegirFechaTurno");
  const inputFechaPicker = document.getElementById("inputFechaPicker");

  if (btnElegirFecha && inputFechaPicker) {
    if (estado.permitirTurnosAtrasados) {
      const haceUnaSemana = new Date();
      haceUnaSemana.setDate(haceUnaSemana.getDate() - 7);
      inputFechaPicker.min = formatearFechaParaAPI(haceUnaSemana);
    } else {
      inputFechaPicker.min = formatearFechaParaAPI(new Date());
    }
    btnElegirFecha.addEventListener("click", () => {
      if (typeof inputFechaPicker.showPicker === "function") {
        inputFechaPicker.showPicker();
      } else {
        inputFechaPicker.focus();
        inputFechaPicker.click();
      }
    });
    inputFechaPicker.addEventListener("change", () => {
      if (!inputFechaPicker.value) return;
      renderizarCardsFecha(contFechas, generarFechasCards(inputFechaPicker.value), inputFecha, cargarHorariosDisponibles, inputFechaPicker.value);
      cargarHorariosDisponibles();
    });
  }

  // --- Lógica de INICIALIZACIÓN (Cargar datos del turno) ---
  const inicializarFormulario = async () => {
    // 1. Poner datos simples
    inputObservaciones.value = turno.observaciones || "";
    selectEstado.value = turno.estado || "reservado";

    // Inicializar cards de fecha con la fecha original del turno preseleccionada
    // (incluye la fecha del turno aunque sea de ayer)
    renderizarCardsFecha(contFechas, generarFechasCards(turno.fecha), inputFecha, cargarHorariosDisponibles, turno.fecha);

    // 2. Poner servicio y cargar profesionales
    if (servicioSeleccionado) {
      selectServicio.value = servicioSeleccionado.id;
      await cargarProfesionales(); // Carga los profesionales
    }

    // 3. Poner profesional (si existe) y cargar horarios
    if (profesionalSeleccionado) {
      selectProfesional.value = profesionalSeleccionado.id;
      await cargarHorariosDisponibles(); // Carga los horarios
    }

    // 4. Seleccionar la hora guardada
    const horaTurno = turno.hora.substring(0, 5); // "HH:MM"
    const botonHora = contHorarios.querySelector(`.boton-horario[data-hora="${horaTurno}"]`);
    if (botonHora) {
      botonHora.classList.add('seleccionado');
      inputHoraSelec.value = horaTurno;
    } else {
      // Si la hora guardada ya no está disponible, se lo indicamos
      showNotification("La hora original de este turno ya no está disponible.", "warning");
      inputHoraSelec.value = ""; // Forzamos a que elija una nueva
    }
  };

  // --- Lógica de Envío (Submit de Edición) ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const horaInicio = inputHoraSelec.value; // "HH:MM"
    const fecha = inputFecha.value;

    if (!horaInicio) {
      showNotification("Debes seleccionar un horario disponible.", "error");
      return;
    }

    // Horario "pasado" (carga atrasada): confirmar antes de mover el turno,
    // por si adelantarlo a ese horario fue sin querer.
    const horarioSeleccionadoEl = contHorarios.querySelector('.boton-horario.seleccionado');
    if (horarioSeleccionadoEl?.classList.contains('pasado')) {
      const confirmado = await confirmarAccion(
        '¿Estás seguro que querés mover el turno a un horario que ya pasó?',
        'Horario pasado',
        'Sí, mover'
      );
      if (!confirmado) return;
    }

    const btnSubmit = form.querySelector('[type="submit"]');
    const restaurar = setBtnLoading(btnSubmit, 'Guardando...');

    // --- Validar transición de estado (máquina de estados) ---
    const nuevoEstado = document.getElementById("estado").value;
    const estadoActual = turno.estado || 'reservado';
    if (!validarTransicion(estadoActual, nuevoEstado)) {
      const transicionesPermitidas = TRANSICIONES_VALIDAS[estadoActual];
      const esEstadoFinal = Array.isArray(transicionesPermitidas) && transicionesPermitidas.length === 0;
      if (esEstadoFinal || !transicionesPermitidas) {
        showNotification(`El turno ya no puede modificarse.`, 'error');
      } else {
        const permitidos = transicionesPermitidas.map(e => ETIQUETAS_ESTADO[e] || e).join(' / ');
        showNotification(`Cambio no permitido. Pasá a: ${permitidos}.`, 'error');
      }
      restaurar();
      return;
    }

    const nombreCliente = inputNombreCliente?.value?.trim();
    const telefonoCliente = inputTelefono?.value?.trim();
    const emailCliente = inputEmailCliente?.value?.trim();

    if (!nombreCliente) {
      restaurar();
      showNotification("El nombre del cliente es obligatorio.", "error");
      return;
    }

    // 1. Obtener o crear cliente con los datos editados (solo si tiene teléfono o email)
    let cliente_id = turno.cliente_id;
    if (telefonoCliente || emailCliente) {
      try {
        cliente_id = await buscarOCrearCliente(nombreCliente, telefonoCliente || null, emailCliente || null);
      } catch (error) {
        console.error('Error al buscar/crear cliente:', error);
        // Continuar con el cliente_id actual
      }
    }


    // Calcular hora_fin (Esto ya lo tenías bien)
    const optServicio = selectServicio.options[selectServicio.selectedIndex];
    const duracion = parseInt(optServicio.dataset.duracion, 10) || 30;
    const precio = parseFloat(optServicio.dataset.precio) || 0;

    const fechaHoraInicio = new Date(`${fecha}T${horaInicio}:00`);
    const fechaHoraFin = new Date(fechaHoraInicio.getTime() + duracion * 60000);
    const horaFinFormateada = `${fechaHoraFin.getHours().toString().padStart(2, '0')}:${fechaHoraFin.getMinutes().toString().padStart(2, '0')}`;

    // 2. Construye turnoData USANDO EL ID OBTENIDO
    const turnoData = {
      id: turno.id,
      cliente_id: cliente_id, // <-- AHORA SÍ TIENE EL ID
      empleado_id: document.getElementById("profesionalId").value,
      servicio_id: document.getElementById("servicioId").value,
      fecha: fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFinFormateada,
      estado: document.getElementById("estado").value,
      observaciones: document.getElementById("observaciones").value || null,
      precio: precio
    };



    const confirmado = await confirmarAccion(
      `¿Guardás los cambios del turno de ${turno.nombre_cliente}?`,
      '¿Guardar cambios?',
      'Guardar'
    );
    if (!confirmado) { restaurar(); return; }

    const resultado = await createOrUpdateTurno(turnoData);
    restaurar();

    if (resultado) {
      // Actualizar el turno seleccionado con los nuevos valores para que
      // el modal de detalles muestre el estado actualizado sin cerrar el modal
      estado.turnoSeleccionado = {
        ...turno,
        cliente_id: cliente_id,
        nombre_cliente: nombreCliente,
        telefono_cliente: telefonoCliente,
        email_cliente: emailCliente,
        estado: turnoData.estado,
        fecha: turnoData.fecha,
        hora: horaInicio + ':00',
        hora_fin: horaFinFormateada + ':00',
        nombre_servicio: selectServicio.options[selectServicio.selectedIndex]?.text || turno.nombre_servicio,
        nombre_empleado: selectProfesional.options[selectProfesional.selectedIndex]?.text || turno.nombre_empleado,
        observaciones: turnoData.observaciones,
        precio: turnoData.precio,
      };
      estado.modoEdicion = false;
      showNotification("Turno actualizado correctamente", "success");
      recargarTurnosYAgenda();
      _recargarDashboardStats();
    } else {
      showNotification("Error al actualizar el turno.", "error");
    }
  });

  // --- Lógica de Cancelar (Edición) ---
  document.getElementById("btnCancelarEdicion").addEventListener("click", () => {
    estado.modoEdicion = false;
    renderizarModal(); // Vuelve a la vista de "Detalles"
  });

  // --- Ejecutar la inicialización ---
  inicializarFormulario();
}

// --- Funciones Públicas de Agenda ---

/**
 * Renderiza todos los componentes de la pestaña Agenda.
 */
export function renderizar() {
  renderizarNavegacion();
  renderizarEncabezado();
  renderizarGrilla();
  renderizarModal(); // Renderiza el modal (oculto si no hay turno)
}

/**
 * Recarga los datos de los turnos y vuelve a renderizar la agenda.
 */
export async function recargarTurnosYAgenda() {
  estado.isLoading = true;
  try {
    // Pide turnos y conteo en paralelo
    const [turnos, turnosPendientesCount] = await Promise.all([
      fetchTurnos(),
      fetchTurnosPendientesCount(estado.fechaActual)
    ]);
    estado.turnos = turnos;
    estado.turnosPendientesCount = turnosPendientesCount;

  } catch (error) {
    console.error('No se pudieron recargar los turnos', error);
    estado.turnos = [];
    estado.turnosPendientesCount = 0;
  } finally {
    estado.isLoading = false;
    renderizar();
    _recargarDashboardStats();
  }
}

/**
 * Configura los event listeners específicos de la agenda.
 * @param {Function} recargarDashboardStats - Función importada desde ui.js para recargar stats.
 */
export function setupAgendaEventListeners(recargarDashboardStats) {

  // --- 2. AÑADE ESTA LÍNEA PARA ASIGNAR LA FUNCIÓN ---
  _recargarDashboardStats = recargarDashboardStats;

  document.getElementById("btnDiaAnterior").addEventListener("click", () => {
    if (puedeDiaAnterior(estado.fechaActual)) {
      estado.fechaActual.setDate(estado.fechaActual.getDate() - 1);
      recargarTurnosYAgenda();
      _recargarDashboardStats(); // <-- Usa la variable guardada
    }
  });

  document.getElementById("btnDiaSiguiente").addEventListener("click", () => {
    estado.fechaActual.setDate(estado.fechaActual.getDate() + 1);
    recargarTurnosYAgenda();
    _recargarDashboardStats(); // <-- Usa la variable guardada
  });

  document.getElementById("btnHoy").addEventListener("click", () => {
    estado.fechaActual = new Date();
    recargarTurnosYAgenda();
    _recargarDashboardStats(); // <-- Usa la variable guardada
  });

  // --- Elegir una fecha específica desde un calendario ---
  const inputFechaAgenda = document.getElementById("inputFechaAgenda");
  const btnElegirFechaAgenda = document.getElementById("btnElegirFechaAgenda");
  if (btnElegirFechaAgenda && inputFechaAgenda) {
    btnElegirFechaAgenda.addEventListener("click", () => {
      if (typeof inputFechaAgenda.showPicker === "function") {
        inputFechaAgenda.showPicker();
      } else {
        inputFechaAgenda.focus();
        inputFechaAgenda.click();
      }
    });

    inputFechaAgenda.addEventListener("change", () => {
      if (!inputFechaAgenda.value) return;
      estado.fechaActual = new Date(`${inputFechaAgenda.value}T00:00:00`);
      recargarTurnosYAgenda();
      _recargarDashboardStats();
    });
  }

  // --- Refrescar solo la agenda (sin recargar toda la página) ---
  const btnRefrescarAgenda = document.getElementById("btnRefrescarAgenda");
  if (btnRefrescarAgenda) {
    btnRefrescarAgenda.addEventListener("click", async () => {
      if (btnRefrescarAgenda.disabled) return;
      const icono = document.getElementById("iconoRefrescarAgenda");
      btnRefrescarAgenda.disabled = true;
      if (icono) icono.classList.add("girando");
      try {
        await recargarTurnosYAgenda();
      } finally {
        btnRefrescarAgenda.disabled = false;
        if (icono) icono.classList.remove("girando");
      }
    });
  }

  document.getElementById("btnCerrarModal").addEventListener("click", () => {
    estado.turnoSeleccionado = null;
    estado.modoEdicion = false;
    estado.modoRegistrarPago = false;
    renderizarModal();
  });
}