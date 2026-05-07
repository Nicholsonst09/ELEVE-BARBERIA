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
  confirmarAccion
} from './utilidades.js';


// Variable para guardar la función que refresca el dashboard
let _recargarDashboardStats = () => console.warn('recargarDashboardStats no inyectada');

// --- Máquina de estados de turnos ---
const TRANSICIONES_VALIDAS = {
  pendiente:  ['confirmado', 'cancelado'],
  confirmado: ['realizado', 'cancelado'],
  realizado:  [],
  cancelado:  [],
};

const ETIQUETAS_ESTADO = {
  pendiente:  'Pendiente',
  confirmado: 'Confirmado',
  realizado:  'Realizado',
  cancelado:  'Cancelado',
};

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
    confirmado: "Confirmado",
    pendiente: "Pendiente",
    realizado: "Realizado",
    cancelado: "Cancelado",
  };
  return etiquetas[estado] || "Pendiente";
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


/**
 * Verifica si un turno pendiente aún puede ser confirmado.
 * La ventana de confirmación cierra 30 minutos antes de la hora del turno.
 * Para turnos de otro día (no hoy), siempre devuelve true.
 * @param {Object} turno
 * @returns {boolean}
 */
function estaEnVentanaDeConfirmacion(turno) {
  const hoy = formatearFechaParaAPI(new Date());
  if (turno.fecha !== hoy) return true;

  const ahora = new Date();
  const [h, m] = turno.hora.split(':').map(Number);
  const horaTurno = new Date();
  horaTurno.setHours(h, m, 0, 0);

  const minutosRestantes = (horaTurno - ahora) / 60000;
  return minutosRestantes > 15;
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
    <button class="pestana-navegacion pendiente ${estado.profesionalSeleccionado === "pendiente" ? "activo" : ""}" data-id="pendiente">
      <svg class="icono" style="color: var(--color-primario);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke-width="2"/>
        <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>Turnos del Día</span>
      ${turnosDia > 0 ? `<span class="insignia">${turnosDia}</span>` : ""}
    </button>
  `;

  estado.profesionales.forEach((prof) => {
    const color = prof.color || '#525252';
    const primerNombre = prof.nombre.split(' ')[0];

    html += `
      <button class="pestana-navegacion ${String(estado.profesionalSeleccionado) === String(prof.id) ? "activo" : ""}" data-id="${prof.id}">
        <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:14px;height:14px;flex-shrink:0;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 1 0-4.243 4.243 3 3 0 0 0 4.243-4.243zm0-5.758a3 3 0 1 0-4.243-4.243 3 3 0 0 0 4.243 4.243z"/>
        </svg>
        <span class="nombre-prof-tab">${primerNombre}</span>
      </button>
    `;
  });

  navPestanas.innerHTML = html;

  // Leyenda de estados
  const leyenda = document.getElementById("leyendaEstados");
  if (leyenda) {
    leyenda.innerHTML = `
      <span class="leyenda-item"><span class="leyenda-dot" style="background:#f59e0b;"></span>Pendiente</span>
      <span class="leyenda-item"><span class="leyenda-dot" style="background:#0369a1;"></span>Confirmado</span>
      <span class="leyenda-item"><span class="leyenda-dot" style="background:#111111;"></span>Realizado</span>
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
  const turnosFiltrados = estado.turnos.filter(t => t.estado !== 'cancelado');
  const profesional = estado.profesionales.find(p => p.id == estado.profesionalSeleccionado);
  const titulo = estado.profesionalSeleccionado === "pendiente" ? "Turnos del Día" : (profesional?.nombre || "Turnos del Día");

  document.getElementById("tituloEncabezado").textContent = `${formatearFecha(estado.fechaActual)} - ${titulo}`;
  document.getElementById("subtituloEncabezado").textContent = `${turnosFiltrados.length} turnos programados`;

  const btnDiaAnterior = document.getElementById("btnDiaAnterior");
  const btnHoy = document.getElementById("btnHoy");
  btnDiaAnterior.disabled = !puedeDiaAnterior(estado.fechaActual);
  btnHoy.disabled = esHoy(estado.fechaActual);
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
  const turnosFiltrados = estado.turnos.filter(t => t.estado !== 'cancelado');
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
      pendiente:  '#f59e0b',
      confirmado: '#0369a1',
      realizado:  '#111111',
      cancelado:  '#dc2626',
    };
    const colorEstado = coloresEstado[turno.estado] || '#525252';
    tarjeta.style.borderLeftColor = colorEstado;
    // --- FIN DE MODIFICACIÓN 2 ---

    // --- INICIO DE MODIFICACIÓN 3: Nuevo HTML ---
    tarjeta.innerHTML = `
      <div class="info-cliente-servicio">
        <div class="cliente-turno">${turno.nombre_cliente}</div>
        <div class="servicio-turno">${turno.nombre_servicio} (${duracion} min)</div> 
      </div>

      <div class="info-profesional-hora">
        ${turno.nombre_empleado ? `
          <div class="profesional-turno">
            <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 1 0-4.243 4.243 3 3 0 0 0 4.243-4.243zm0-5.758a3 3 0 1 0-4.243-4.243 3 3 0 0 0 4.243 4.243z"/>
            </svg>
            <span>${turno.totalColumnas > 3 ? turno.nombre_empleado.substring(0, 3) + '.' : turno.nombre_empleado.split(' ')[0]}</span>
          </div>
        ` : ""}
        <div class="hora-turno-apilada">
          <span class="hora-texto">${turno.hora.slice(0, 5)}h</span>
      
        </div>
      </div>
      
      <div class="pie-turno-boton">
        <div class="editar-turno">
          <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `;
    // --- FIN DE MODIFICACIÓN 3 ---

    tarjeta.addEventListener("click", () => {
      estado.turnoSeleccionado = turno;
      estado.modoEdicion = false;
      renderizarModal();
    });

    contenedor.appendChild(tarjeta);
  });
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

  // --- MODO 1: CREAR NUEVO TURNO ---
  if (estado.modoCreacion) {
    tituloModal.textContent = "Programar Nuevo Turno";
    const fechaPorDefecto = formatearFechaParaAPI(estado.fechaActual);

    cuerpoModal.innerHTML = `
      <form id="formCreacion">
        <input type="hidden" id="horaInicioSeleccionada" required>
        
        <div class="grupo-formulario">
          <label class="form-label" for="nombreCliente">Nombre del Cliente</label>
          <input type="text" id="nombreCliente" class="form-input" placeholder="Nombre del cliente" required>
        </div>
        
        <div class="grupo-formulario">
            <label class="form-label" for="telefono">Teléfono</label>
            <input type="tel" id="telefono" class="form-input" placeholder="+1234567890" required>
        </div>

        <div class="grupo-formulario">
          <label class="form-label" for="servicioId">Servicio</label>
          <select id="servicioId" class="form-select" required>
            <option value="">Seleccionar servicio...</option>
            ${estado.servicios.map(s => `
                <option value="${s.id}" data-precio="${s.precio || 0}" data-duracion="${s.duracion_min || 30}">
                  ${s.nombre}
                </option>
              `).join("")}
          </select>
        </div>

        <div class="grupo-formulario">
          <label class="form-label" for="profesionalId">Profesional</label>
          <select id="profesionalId" class="form-select" required disabled>
            <option value="">Seleccionar profesional...</option>
          </select>
        </div>

        <div class="grupo-formulario">
            <label class="form-label">Fecha</label>
            <input type="hidden" id="fecha">
            <div id="fechaContenedor" class="lista-fechas"></div>
        </div>
        
        <div class="grupo-formulario">
            <label class="form-label">Horarios Disponibles</label>
            <div id="horariosContenedor" class="lista-horarios">
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

    // ── Turno REALIZADO: solo se puede cambiar el cliente ──────────────────
    if (turno.estado === 'realizado') {
      tituloModal.textContent = "Corregir Cliente";
      cuerpoModal.innerHTML = `
        <form id="formEdicionCliente">
          <p style="color: var(--color-secundario); font-size: 0.85rem; margin-bottom: 1rem;">
            Este turno ya fue realizado. Solo podés corregir los datos del cliente.
          </p>
          <div class="grupo-formulario">
            <label class="form-label" for="nombreCliente">Nombre del Cliente</label>
            <input type="text" id="nombreCliente" class="form-input" value="${turno.nombre_cliente || ''}" required>
          </div>
          <div class="grupo-formulario">
            <label class="form-label" for="telefono">Teléfono</label>
            <input type="tel" id="telefono" class="form-input" value="${turno.telefono_cliente || ''}" required>
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

    // HTML casi idéntico al de "Crear Turno", pero con el campo "Estado"
    // y sin los campos de cliente (ya que el cliente_id no se cambia)
    cuerpoModal.innerHTML = `
        <form id="formEdicion">
          <input type="hidden" id="horaInicioSeleccionada" required>
          
          <div class="grupo-formulario">
            <label class="form-label" for="nombreClienteLectura">Nombre del Cliente</label>
            <input type="text" id="nombreClienteLectura" class="form-input" value="${turno.nombre_cliente || ''}" readonly disabled style="background-color: #f0f0f0; cursor: not-allowed;">
          </div>
          
          <div class="grupo-formulario">
              <label class="form-label" for="telefonoLectura">Teléfono</label>
              <input type="tel" id="telefonoLectura" class="form-input" value="${turno.telefono_cliente || ''}" readonly disabled style="background-color: #f0f0f0; cursor: not-allowed;">
          </div>
          <div class="grupo-formulario">
            <label class="form-label" for="servicioId">Servicio</label>
            <select id="servicioId" class="form-select" required>
              <option value="">Seleccionar servicio...</option>
              ${estado.servicios.map(s => `
                  <option value="${s.id}" data-precio="${s.precio || 0}" data-duracion="${s.duracion_min || 30}">
                    ${s.nombre}
                  </option>
                `).join("")}
            </select>
          </div>

          <div class="grupo-formulario">
            <label class="form-label" for="profesionalId">Profesional</label>
            <select id="profesionalId" class="form-select" required disabled>
              <option value="">Seleccionar profesional...</option>
            </select>
          </div>

          <div class="grupo-formulario">
              <label class="form-label">Fecha</label>
              <input type="hidden" id="fecha">
              <div id="fechaContenedor" class="lista-fechas"></div>
          </div>
          
          <div class="grupo-formulario">
              <label class="form-label">Horarios Disponibles</label>
              <div id="horariosContenedor" class="lista-horarios">
                <p class="sin-horarios">Cargando...</p>
              </div>
          </div>

          <div class="grupo-formulario">
            <label class="form-label" for="estado">Estado</label>
              <select id="estado" class="form-select" required>
              ${[turno.estado || 'pendiente', ...(TRANSICIONES_VALIDAS[turno.estado || 'pendiente'] || [])].map(e =>
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
    tituloModal.textContent = "Registrar Pago";
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
          <option value="sin_pago"   ${metodoActual === 'sin_pago'       ? 'selected' : ''}>Sin pago</option>
        </select>
      </div>
      <div class="pie-modal">
        <button class="boton-secundario" id="btnCancelarPago">Cancelar</button>
        <button class="boton-primario" id="btnConfirmarPago">Confirmar</button>
      </div>
    `;
    setupModalPagoListeners(turno);
  }

  // --- MODO 3: VER DETALLES (Default) ---
  else {
    tituloModal.textContent = "Detalles del Turno";
    const profesional = { nombre: turno.nombre_empleado };
    const servicio = { nombre: turno.nombre_servicio };
    const cliente = { nombre: turno.nombre_cliente, telefono: turno.telefono_cliente };

    // Precio: primero del turno (backend deployado), si no del catálogo local
    const servicioDatos = estado.servicios.find(s => s.nombre === turno.nombre_servicio);
    const precioDatos = Number(turno.precio) || Number(servicioDatos?.precio) || 0;

    cuerpoModal.innerHTML = `
      <div class="detalles-turno-container">
        <div class="detalles-turno-header">
          <div class="detalles-turno-nombre">${cliente.nombre}</div>
          <div class="insignia-estado estado-${turno.estado || 'pendiente'}">${obtenerEtiquetaEstado(turno.estado || 'pendiente')}</div>
        </div>
        <div class="detalles-turno-servicio">${servicio.nombre}</div>
        <div class="detalles-turno-info">
          <div class="detalles-turno-item">
            <svg class="icono" style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            <span>${profesional.nombre}</span>
          </div>
          <div class="detalles-turno-item">
            <svg class="icono" style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            <span>${cliente.telefono || 'No especificado'}</span>
            ${cliente.telefono ? `<button class="btn-copiar-tel" data-tel="${cliente.telefono}" title="Copiar número">
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
          <div class="detalles-turno-item">
            <svg class="icono" style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>${turno.metodoPago ? etiquetaMetodoPago(turno.metodoPago) : 'Sin pago registrado'}</span>
          </div>
        </div>
        ${turno.observaciones ? `
        <div class="detalles-turno-notas">
          <div class="detalles-turno-notas-titulo">Observaciones</div>
          <div class="detalles-turno-notas-texto">${turno.observaciones}</div>
        </div>
        ` : ''}
      </div>
      <div class="pie-modal">
        ${turno.estado !== 'realizado' ? `<button class="boton-primario" id="btnRegistrarPago">Registrar Pago</button>` : ''}
        ${turno.estado === 'pendiente'
          ? (estaEnVentanaDeConfirmacion(turno)
            ? '<button class="boton-secundario" id="btnConfirmarTurno"><span class="txt-largo">Confirmar Turno</span><span class="txt-corto">Confirmar</span></button>'
            : '<button class="boton-secundario" id="btnConfirmarTurno" disabled title="Venció la ventana de confirmación (30 min antes del turno)"><span class="txt-largo">Plazo vencido</span><span class="txt-corto">Vencido</span></button>')
          : ''}
        ${turno.estado === 'confirmado' ? '<button class="boton-secundario" id="btnRealizarTurno"><span class="txt-largo">Marcar Realizado</span><span class="txt-corto">Realizado</span></button>' : ''}
        ${turno.estado !== 'realizado' ? `<button class="boton-secundario" id="btnModificar">Modificar</button>` : ''}
        ${ turno.estado === 'cancelado'
          ? '<button class="boton-secundario eliminar" id="btnEliminarTurno"><span class="txt-largo">Eliminar Turno</span><span class="txt-corto">Eliminar</span></button>'
          : turno.estado !== 'realizado'
            ? '<button class="boton-secundario eliminar" id="btnCancelarEstado"><span class="txt-largo">Cancelar Turno</span><span class="txt-corto">Cancelar</span></button>'
            : ''
        }
      </div>
    `;

    const btnCopiarTel = cuerpoModal.querySelector('.btn-copiar-tel');
    if (btnCopiarTel) {
      btnCopiarTel.addEventListener('click', () => {
        navigator.clipboard.writeText(btnCopiarTel.dataset.tel).then(() => {
          showNotification('Número copiado.', 'success');
        });
      });
    }

    if (turno.estado !== 'realizado') {
      document.getElementById("btnModificar").addEventListener("click", () => {
        estado.modoEdicion = true;
        renderizarModal();
      });
    }

    if (turno.estado === 'confirmado') {
      document.getElementById("btnRealizarTurno").addEventListener("click", async () => {
        const btn = document.getElementById("btnRealizarTurno");

        if (!yaComenzóElTurno(turno)) {
          showNotification('No se puede marcar como realizado antes de la hora de inicio del turno.', 'error');
          return;
        }

        if (!turno.metodoPago || turno.metodoPago === 'sin_pago') {
          showNotification('Registrá el pago antes de marcar el turno como realizado.', 'error');
          return;
        }

        const confirmado = await confirmarAccion(
          `¿Marcás el turno de ${turno.nombre_cliente} como realizado?`,
          '¿Marcar como realizado?',
          'Realizado'
        );
        if (!confirmado) return;
        const restaurar = setBtnLoading(btn, 'Guardando...');
        try {
          const resultado = await createOrUpdateTurno({
            ...turno,
            id: turno.id,
            cliente_id: turno.cliente_id,
            empleado_id: turno.empleado_id,
            servicio_id: turno.servicio_id,
            hora_inicio: turno.hora ? turno.hora.substring(0, 5) : turno.hora_inicio,
            hora_fin: turno.hora_fin ? turno.hora_fin.substring(0, 5) : turno.hora_fin,
            estado: 'realizado',
          });
          restaurar();
          if (resultado) {
            estado.turnoSeleccionado = { ...turno, estado: 'realizado' };
            showNotification('Turno marcado como realizado.', 'success');
            recargarTurnosYAgenda();
            _recargarDashboardStats();
          } else {
            showNotification('No se pudo actualizar el turno.', 'error');
          }
        } catch (error) {
          restaurar();
          showNotification('Error al actualizar el turno.', 'error');
        }
      });
    }

    if (turno.estado === 'pendiente') {
      document.getElementById("btnConfirmarTurno").addEventListener("click", async () => {
        if (!estaEnVentanaDeConfirmacion(turno)) {
          showNotification('No se puede confirmar: el plazo venció 15 minutos antes del turno.', 'error');
          return;
        }
        const btn = document.getElementById("btnConfirmarTurno");
        const confirmado = await confirmarAccion(
          `¿Confirmás el turno de ${turno.nombre_cliente}?`,
          '¿Confirmar turno?',
          'Confirmar'
        );
        if (!confirmado) return;
        const restaurar = setBtnLoading(btn, 'Confirmando...');
        try {
          const resultado = await createOrUpdateTurno({
            ...turno,
            id: turno.id,
            cliente_id: turno.cliente_id,
            empleado_id: turno.empleado_id,
            servicio_id: turno.servicio_id,
            hora_inicio: turno.hora ? turno.hora.substring(0, 5) : turno.hora_inicio,
            hora_fin: turno.hora_fin ? turno.hora_fin.substring(0, 5) : turno.hora_fin,
            estado: 'confirmado',
          });
          restaurar();
          if (resultado) {
            estado.turnoSeleccionado = { ...turno, estado: 'confirmado' };
            showNotification('Turno confirmado correctamente.', 'success');
            recargarTurnosYAgenda();
            _recargarDashboardStats();
          } else {
            showNotification('No se pudo confirmar el turno.', 'error');
          }
        } catch (error) {
          restaurar();
          showNotification('Error al confirmar el turno.', 'error');
        }
      });
    }

    if (turno.estado !== 'realizado') {
      document.getElementById("btnRegistrarPago").addEventListener("click", () => {
        estado.modoRegistrarPago = true;
        renderizarModal();
      });
    }

    if (turno.estado === 'cancelado') {
      document.getElementById("btnEliminarTurno").addEventListener("click", async () => {
        if (!turno.id) return;
        const confirmado = await confirmarAccion(
          `¿Eliminás definitivamente el turno de ${turno.nombre_cliente}? Esta acción no se puede deshacer.`,
          'Eliminar turno',
          'Eliminar'
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
    } else if (turno.estado !== 'realizado') {
      document.getElementById("btnCancelarEstado").addEventListener("click", async () => {
        if (!turno.id) return;
        const confirmado = await confirmarAccion(
          `¿Cancelás el turno de ${turno.nombre_cliente}?`,
          'Cancelar turno',
          'Sí, cancelar',
          'El turno será eliminado de la grilla.'
        );
        if (!confirmado) return;
        const btn = document.getElementById("btnCancelarEstado");
        const restaurar = setBtnLoading(btn, 'Cancelando...');
        try {
          const resultado = await createOrUpdateTurno({
            ...turno,
            id: turno.id,
            cliente_id: turno.cliente_id,
            empleado_id: turno.empleado_id,
            servicio_id: turno.servicio_id,
            hora_inicio: turno.hora ? turno.hora.substring(0, 5) : turno.hora_inicio,
            hora_fin: turno.hora_fin ? turno.hora_fin.substring(0, 5) : turno.hora_fin,
            estado: 'cancelado',
          });
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

  document.getElementById('btnConfirmarPago').addEventListener('click', async () => {
    const select = document.getElementById('selectMetodoPago');
    if (!select.value) {
      showNotification('Seleccioná un método de pago.', 'error');
      return;
    }
    const btn = document.getElementById('btnConfirmarPago');
    const restaurar = setBtnLoading(btn, 'Guardando...');
    try {
      const resultado = await createOrUpdateTurno({
        ...turno,
        id: turno.id,
        cliente_id: turno.cliente_id,
        empleado_id: turno.empleado_id,
        servicio_id: turno.servicio_id,
        hora_inicio: turno.hora ? turno.hora.substring(0, 5) : turno.hora_inicio,
        hora_fin: turno.hora_fin ? turno.hora_fin.substring(0, 5) : turno.hora_fin,
        metodoPago: select.value,
      });
      restaurar();
      if (resultado) {
        estado.turnoSeleccionado = { ...turno, metodoPago: select.value };
        estado.modoRegistrarPago = false;
        showNotification('Pago registrado correctamente.', 'success');
        recargarTurnosYAgenda();
        _recargarDashboardStats();
      } else {
        showNotification('No se pudo guardar el pago.', 'error');
      }
    } catch (error) {
      restaurar();
      showNotification('Error al guardar el pago.', 'error');
    }
  });
}

// ===============================================
// HELPERS: Cards de fecha para modales
// ===============================================

/**
 * Genera un array de fechas "YYYY-MM-DD" para mostrar como cards.
 * Incluye hoy + los próximos 6 días hábiles (sin domingos).
 * Si se pasa fechaExtra (ej: turno de ayer) y es anterior a hoy, se agrega al inicio.
 */
function generarFechasCards(fechaExtra = null) {
  const fechas = [];
  const hoy = new Date();
  const hoyStr = formatearFechaParaAPI(hoy);

  if (fechaExtra && fechaExtra < hoyStr) {
    fechas.push(fechaExtra);
  }

  let count = 0;
  for (let i = 0; count < 7; i++) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    if (d.getDay() === 0) continue; // sin domingos
    fechas.push(formatearFechaParaAPI(d));
    count++;
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
  selectServicio.addEventListener("change", async () => {
    const servicioId = selectServicio.value;
    // Resetea profesional y horarios
    selectProfesional.innerHTML = '<option value="">Cargando...</option>';
    contHorarios.innerHTML = '<p class="sin-horarios">Selecciona profesional y fecha.</p>';
    inputHoraSelec.value = "";

    if (!servicioId) {
      selectProfesional.innerHTML = '<option value="">Seleccionar profesional...</option>';
      selectProfesional.disabled = true;
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

    // Filtrar slots pasados si la fecha seleccionada es hoy
    const _ahora = new Date();
    const _hoyStr = `${_ahora.getFullYear()}-${String(_ahora.getMonth()+1).padStart(2,'0')}-${String(_ahora.getDate()).padStart(2,'0')}`;
    if (fecha === _hoyStr) {
      const _ahoraHHMM = `${String(_ahora.getHours()).padStart(2,'0')}:${String(_ahora.getMinutes()).padStart(2,'0')}`;
      horarios = horarios.filter(h => h.inicio >= _ahoraHHMM);
    }

    if (horarios.length === 0) {
      contHorarios.innerHTML = '<p class="sin-horarios">No hay horarios disponibles.</p>';
      return;
    }

    // Renderiza los botones de horario
    contHorarios.innerHTML = horarios.map(h =>
      `<button type="button" class="boton-horario" data-hora="${h.inicio}">
        ${h.inicio}
     </button>`
    ).join('');

    // Asigna listeners a los nuevos botones de horario
    contHorarios.querySelectorAll('.boton-horario').forEach(btn => {
      btn.addEventListener('click', () => {
        // Quita 'seleccionado' de todos
        contHorarios.querySelectorAll('.boton-horario').forEach(b => b.classList.remove('seleccionado'));
        // Agrega 'seleccionado' al clickeado
        btn.classList.add('seleccionado');
        // Guarda el valor en el input hidden
        inputHoraSelec.value = btn.dataset.hora;
      });
    });
  };

  selectProfesional.addEventListener("change", cargarHorariosDisponibles);

  // Inicializar cards de fecha (hoy + próximos 6 días hábiles)
  const fechaPorDefecto = formatearFechaParaAPI(estado.fechaActual);
  renderizarCardsFecha(contFechas, generarFechasCards(), inputFecha, cargarHorariosDisponibles, fechaPorDefecto);


  // --- Lógica de Envío (Submit) ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btnSubmit = form.querySelector('[type="submit"]');
    const restaurar = setBtnLoading(btnSubmit, 'Guardando...');

    const nombreCliente = document.getElementById("nombreCliente").value;
    const telefono = document.getElementById("telefono").value;
    const servicioId = selectServicio.value;
    const horaInicio = inputHoraSelec.value; // "HH:MM"
    const fecha = inputFecha.value; // "YYYY-MM-DD"

    // --- Validaciones del Frontend ---
    if (!horaInicio) {
      showNotification("Debes seleccionar un horario disponible.", "error");
      return;
    }
    // Validamos como tu backend
    if (!nombreCliente || !telefono) {
      showNotification("El nombre y el teléfono son obligatorios.", "error");
      return;
    }

    // --- PASO 1: OBTENER O CREAR EL CLIENTE ---
    const cliente_id = await buscarOCrearCliente(nombreCliente, telefono);

    if (!cliente_id) {
      restaurar();
      showNotification("Error al procesar el cliente. Intenta de nuevo.", "error");
      return;
    }
    // ¡Éxito! Ahora tenemos el cliente_id

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
      cliente_id: cliente_id,
      empleado_id: document.getElementById("profesionalId").value,
      servicio_id: servicioId,
      fecha: fecha,
      hora_inicio: horaInicio, // <-- Se envía "HH:MM"
      hora_fin: horaFinFormateada, // <-- Se envía "HH:MM"
      estado: "pendiente",
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
// FUNCIÓN: Listener para editar solo el cliente (turno realizado)
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

    if (!nombre || !telefono) {
      showNotification('Nombre y teléfono son obligatorios.', 'error');
      restaurar();
      return;
    }

    const cliente_id = await buscarOCrearCliente(nombre, telefono);
    if (!cliente_id) {
      showNotification('Error al buscar o crear el cliente.', 'error');
      restaurar();
      return;
    }

    const resultado = await createOrUpdateTurno({ id: turno.id, cliente_id });
    restaurar();

    if (resultado) {
      estado.turnoSeleccionado = { ...turno, nombre_cliente: nombre, telefono_cliente: telefono };
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

    // 2. Renderiza (con la lista modificada)
    contHorarios.innerHTML = horarios.map(h =>
      `<button type="button" class="boton-horario" data-hora="${h.inicio}">
      ${h.inicio}
     </button>`
    ).join('');

    // 3. Asigna listeners
    contHorarios.querySelectorAll('.boton-horario').forEach(btn => {
      btn.addEventListener('click', () => {
        contHorarios.querySelectorAll('.boton-horario').forEach(b => b.classList.remove('seleccionado'));
        btn.classList.add('seleccionado');
        inputHoraSelec.value = btn.dataset.hora;
      });
    });
  };

  // 1. Al cambiar Servicio
  selectServicio.addEventListener("change", async () => {
    contHorarios.innerHTML = '<p class="sin-horarios">Selecciona profesional y fecha.</p>';
    inputHoraSelec.value = "";
    await cargarProfesionales();
  });

  // 2. Al cambiar Profesional
  selectProfesional.addEventListener("change", cargarHorariosDisponibles);

  // --- Lógica de INICIALIZACIÓN (Cargar datos del turno) ---
  const inicializarFormulario = async () => {
    // 1. Poner datos simples
    inputObservaciones.value = turno.observaciones || "";
    selectEstado.value = turno.estado || "pendiente";

    // Inicializar cards de fecha con la fecha original del turno preseleccionada
    // (incluye la fecha del turno aunque sea de ayer)
    const contFechas = document.getElementById("fechaContenedor");
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

    const btnSubmit = form.querySelector('[type="submit"]');
    const restaurar = setBtnLoading(btnSubmit, 'Guardando...');

    const horaInicio = inputHoraSelec.value; // "HH:MM"
    const fecha = inputFecha.value;

    if (!horaInicio) {
      showNotification("Debes seleccionar un horario disponible.", "error");
      restaurar();
      return;
    }

    // --- Validar transición de estado (máquina de estados) ---
    const nuevoEstado = document.getElementById("estado").value;
    const estadoActual = turno.estado || 'pendiente';
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

    // 1. Llama a la función que ya tienes para obtener el ID
    const cliente_id = await buscarOCrearCliente(turno.nombre_cliente, turno.telefono_cliente);

    if (!cliente_id) {
      restaurar();
      showNotification("Error al re-validar la información del cliente.", "error");
      return;
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

    // Auto-eliminar turnos pendientes de hoy que superaron la ventana de confirmación
    const hoy = formatearFechaParaAPI(new Date());
    const pendientesVencidos = turnos.filter(t =>
      t.estado === 'pendiente' &&
      t.fecha === hoy &&
      !estaEnVentanaDeConfirmacion(t)
    );

    if (pendientesVencidos.length > 0) {
      await Promise.all(pendientesVencidos.map(t => createOrUpdateTurno({
        id: t.id,
        cliente_id: t.cliente_id,
        empleado_id: t.empleado_id,
        servicio_id: t.servicio_id,
        hora_inicio: t.hora ? t.hora.substring(0, 5) : t.hora_inicio,
        hora_fin: t.hora_fin ? t.hora_fin.substring(0, 5) : t.hora_fin,
        estado: 'cancelado',
      })));
      const idsCancelados = new Set(pendientesVencidos.map(t => t.id));
      // Actualizar estado local: marcar como cancelado (desaparecerán de la grilla)
      estado.turnos = estado.turnos.map(t =>
        idsCancelados.has(t.id) ? { ...t, estado: 'cancelado' } : t
      );
      estado.turnosPendientesCount = estado.turnos.filter(t =>
        t.estado === 'pendiente' && t.fecha === hoy
      ).length;
      const n = pendientesVencidos.length;
      showNotification(
        `${n === 1 ? '1 turno pendiente fue cancelado' : `${n} turnos pendientes fueron cancelados`} por no confirmarse a tiempo.`,
        'warning'
      );
    }
  } catch (error) {
    console.error('No se pudieron recargar los turnos', error);
    estado.turnos = [];
    estado.turnosPendientesCount = 0;
  } finally {
    estado.isLoading = false;
    renderizar(); // Vuelve a dibujar todo
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

  document.getElementById("btnCerrarModal").addEventListener("click", () => {
    estado.turnoSeleccionado = null;
    estado.modoEdicion = false;
    estado.modoRegistrarPago = false;
    renderizarModal();
  });

  document.getElementById("modalSuperpuesto").addEventListener("click", (e) => {
    if (e.target.id === "modalSuperpuesto") {
      estado.turnoSeleccionado = null;
      estado.modoEdicion = false;
      estado.modoRegistrarPago = false;
      renderizarModal();
    }
  });
}