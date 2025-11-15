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
  formatearFechaParaAPI
} from './utilidades.js';


// Variable para guardar la función que refresca el dashboard
let _recargarDashboardStats = () => console.warn('recargarDashboardStats no inyectada');


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

function obtenerEstiloTurno(horaInicio, horaFin) {
  // Descomponemos ambas horas (ej: "09:30")
  const [horaI, minI] = (horaInicio || "09:00").split(":").map(Number);
  const [horaF, minF] = (horaFin || "10:00").split(":").map(Number);

  // Calculamos minutos totales desde el inicio de la jornada (asumiendo 9:00)
  const minutosInicio = (horaI - 9) * 60 + minI;

  // Duración real en minutos
  const duracionMinutos = (horaF * 60 + minF) - (horaI * 60 + minI);

  // Cada hora equivale a 150px → 1 min = 150/60 = 2.5px
  return {
    top: `${(minutosInicio / 60) * 150}px`,
    height: `${(duracionMinutos / 60) * 150 - 6}px`
  };
} 

function obtenerEtiquetaEstado(estado) {
  const etiquetas = {
    confirmado: "Confirmado",
    pendiente: "Pendiente",
    completado: "Completado",
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


// --- Funciones de Renderizado de Agenda (Privadas) ---

function renderizarNavegacion() {
  const navPestanas = document.getElementById("navPestanas");
  const turnosPendientes = estado.turnosPendientesCount;

  // --- INICIO DE LA MODIFICACIÓN ---
  // 1. Copia el mismo colorMap que usas en renderizarGrilla
  const colorMap = {
      "Bautista": "#3b82f6", // Azul
      "Ciro": "#16a34a",     // Verde
      "Felipe": "#f97316",   // Naranja
      "Ricardo": "#a855f7",  // Violeta
      "default": "#525252"  // Gris (por si acaso)
  };
  // --- FIN DE LA MODIFICACIÓN ---


  let html = `
    <button class="pestana-navegacion pendiente ${estado.profesionalSeleccionado === "pendiente" ? "activo" : ""}" data-id="pendiente">
      <svg class="icono" style="color: var(--color-primario);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke-width="2"/>
        <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>Turnos Pendientes</span>
      ${turnosPendientes > 0 ? `<span class="insignia">${turnosPendientes}</span>` : ""}
    </button>
  `;

  estado.profesionales.forEach((prof) => {
    // --- INICIO DE LA MODIFICACIÓN ---
    // 2. Usa el colorMap para buscar el color.
    const color = colorMap[prof.nombre] || prof.color || '#ccc';
    // --- FIN DE LA MODIFICACIÓN ---

    html += `
      <button class="pestana-navegacion ${String(estado.profesionalSeleccionado) === String(prof.id) ? "activo" : ""}" data-id="${prof.id}">
        
        <div class="punto-color" style="background-color: ${color};"></div>
        
        ${prof.nombre}
      </button>
    `;
  });

  navPestanas.innerHTML = html;

  // Asigna listeners (esto queda igual)
  navPestanas.querySelectorAll(".pestana-navegacion").forEach((pestana) => {
    pestana.addEventListener("click", () => {
      estado.profesionalSeleccionado = pestana.dataset.id;
      recargarTurnosYAgenda(); // Llama a la función pública de recarga
    });
  });
}

function renderizarEncabezado() {
  const turnosFiltrados = estado.turnos;
  const profesional = estado.profesionales.find(p => p.id == estado.profesionalSeleccionado);
  const titulo = estado.profesionalSeleccionado === "pendiente" ? "Turnos Pendientes" : (profesional?.nombre || "Turnos del Día");

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

  const turnosConPosicion = turnos.map((turno, index) => {
    const inicioMin = horaAMinutos(turno.hora);
    const finMin = horaAMinutos(turno.hora_fin);
    return {
      ...turno,
      indiceOriginal: index,
      inicioMin,
      finMin,
      columna: 0,
      totalColumnas: 1
    };
  });

  turnosConPosicion.sort((a, b) => a.inicioMin - b.inicioMin);

  for (let i = 0; i < turnosConPosicion.length; i++) {
    const turnoActual = turnosConPosicion[i];
    const turnosSuperpuestos = [turnoActual];

    for (let j = i + 1; j < turnosConPosicion.length; j++) {
      const turnoComparar = turnosConPosicion[j];

      if (turnoComparar.inicioMin < turnoActual.finMin) {
        turnosSuperpuestos.push(turnoComparar);
      }
    }

    if (turnosSuperpuestos.length > 1) {
      turnosSuperpuestos.forEach((turno, idx) => {
        // SOLO actualizamos si el nuevo grupo es MÁS GRANDE
        // que el grupo en el que ya está.
        if (turnosSuperpuestos.length > turno.totalColumnas) {
          turno.columna = idx;
          turno.totalColumnas = turnosSuperpuestos.length;
        }
      });
    }
  }

  return turnosConPosicion;
}

function renderizarGrilla() {
  const cuerpoGrilla = document.getElementById("cuerpoGrilla");
  const turnosFiltrados = estado.turnos;
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
  
  // (Esto es una simulación. Idealmente, los colores vendrían de la API)
  const colorMap = {
      "Bautista": "#3b82f6", // Azul
      "Ciro": "#16a34a",     // Verde
      "Felipe": "#f97316",   // Naranja
      "Ricardo": "#a855f7",  // Violeta
      "default": "#525252"  // Gris
  };
  // --- FIN DE MODIFICACIÓN 1 ---

  turnosConPosicion.forEach((turno) => {
    // --- INICIO DE MODIFICACIÓN 2: Lógica de color ---
    const profesional = estado.profesionales.find(p => p.nombre === turno.nombre_empleado);
    const estilo = obtenerEstiloTurno(turno.hora, turno.hora_fin);
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
    
    // Usar el color del map.
    const colorProfesional = colorMap[turno.nombre_empleado] || profesional?.color || colorMap["default"];
    tarjeta.style.borderLeftColor = colorProfesional;
    // --- FIN DE MODIFICACIÓN 2 ---

    // --- INICIO DE MODIFICACIÓN 3: Nuevo HTML ---
    tarjeta.innerHTML = `
      <div class="info-cliente-servicio">
        <div class="cliente-turno">${turno.nombre_cliente}</div>
        <div class="servicio-turno">${turno.nombre_servicio} (${duracion} min)</div> 
      </div>

      <div class="info-profesional-hora">
        ${profesional ? `
          <div class="profesional-turno">
            <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="7" r="4" stroke-width="2"/>
            </svg>
            <span>${turno.nombre_empleado}</span>
          </div>
        ` : "<div></div>"}
        <div class="hora-turno-apilada">
          <span class="hora-texto">${turno.hora}h</span>
      
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
            <label class="form-label" for="fecha">Fecha</label>
            <input type="date" id="fecha" class="form-input" value="${fechaPorDefecto}" required>
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

  // --- MODO 2: EDITAR TURNO EXISTENTE (MODIFICADO) ---
  else if (estado.modoEdicion) {
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
              <label class="form-label" for="fecha">Fecha</label>
              <input type="date" id="fecha" class="form-input" required>
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
              <option value="pendiente">Pendiente</option>
              <option value="confirmado">Confirmado</option>
              <option value="realizado">Completado</option>
              <option value="cancelado">Cancelado</option>
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

  // --- MODO 3: VER DETALLES (Default) ---
  else {
    // (Esta parte no cambia, sigue como la tenías)
    tituloModal.textContent = "Detalles del Turno";
    const profesional = { nombre: turno.nombre_empleado };
    const servicio = { nombre: turno.nombre_servicio };
    const cliente = { nombre: turno.nombre_cliente, telefono: turno.telefono_cliente };

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
          </div>
          <div class="detalles-turno-item">
            <svg class="icono" style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <span>${turno.fecha}</span>
          </div>
          <div class="detalles-turno-item">
            <svg class="icono" style="width:16px; height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>${turno.hora ? turno.hora.substring(0, 5) : ''} - ${turno.hora_fin ? turno.hora_fin.substring(0, 5) : ''}</span>
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
        <button class="boton-secundario" id="btnModificar">Modificar</button>
        <button class="boton-secundario eliminar" id="btnCancelarTurno">Eliminar Turno</button>
      </div>
    `;

    document.getElementById("btnModificar").addEventListener("click", () => {
      estado.modoEdicion = true;
      renderizarModal();
    });

    document.getElementById("btnCancelarTurno").addEventListener("click", async () => {
      // (Esta lógica de eliminar no cambia)
      if (!turno.id) {
        showNotification("Error: No se puede cancelar el turno porque falta el 'id' desde la API.", "error");
        return;
      }
      try {
        const resultado = await eliminarTurno(turno.id);
        if (resultado) {
          showNotification("Turno eliminado con éxito", "success");
          estado.turnoSeleccionado = null;
          recargarTurnosYAgenda();
          _recargarDashboardStats();
        } else {
          showNotification("No se pudo eliminar el turno.", "error");
        }
      } catch (error) {
        showNotification("Error de red al eliminar el turno.", "error");
        console.error("Error al eliminar turno:", error);
      }
    });
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
    const horarios = await fetchHorariosDisponibles(profesionalId, servicioId, fecha);

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
  inputFecha.addEventListener("change", cargarHorariosDisponibles);


  // --- Lógica de Envío (Submit) ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

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
      precio: precio
    };

    // 3. Llamar a la API de turnos
    const resultado = await createOrUpdateTurno(turnoData);

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
// NUEVA FUNCIÓN: Listeners para el Modal de Edición
// ===============================================
function setupModalEdicionListeners(turno) {
  // Encontrar el servicio y profesional ID basado en los nombres
  const servicioSeleccionado = estado.servicios.find(s => s.nombre === turno.nombre_servicio);
  const profesionalSeleccionado = estado.profesionales.find(p => p.nombre === turno.nombre_empleado);

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
    let horarios = await fetchHorariosDisponibles(profesionalId, servicioId, fecha);

    // --- FIX DE RE-INSERCIÓN ---
    // 'turno' SÍ existe en este alcance
    const horaTurnoOriginal = turno.hora.substring(0, 5);

    if (fecha === turno.fecha) {
      const horaOriginalExiste = horarios.some(h => h.inicio === horaTurnoOriginal);
      if (!horaOriginalExiste) {
        horarios.push({ inicio: horaTurnoOriginal });
        horarios.sort((a, b) => a.inicio.localeCompare(b.inicio));
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

  // 2. Al cambiar Profesional o Fecha
  selectProfesional.addEventListener("change", cargarHorariosDisponibles);
  inputFecha.addEventListener("change", cargarHorariosDisponibles);

  // --- Lógica de INICIALIZACIÓN (Cargar datos del turno) ---
  const inicializarFormulario = async () => {
    // 1. Poner datos simples
    inputFecha.value = turno.fecha;
    inputObservaciones.value = turno.observaciones || "";
    selectEstado.value = turno.estado || "pendiente";

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

    // 1. Llama a la función que ya tienes para obtener el ID
    const cliente_id = await buscarOCrearCliente(turno.nombre_cliente, turno.telefono_cliente);

    if (!cliente_id) {
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



    const resultado = await createOrUpdateTurno(turnoData);

    if (resultado) {
      showNotification("Turno actualizado correctamente", "success");
      estado.turnoSeleccionado = null;
      recargarTurnosYAgenda();
      _recargarDashboardStats();
      renderizarModal();
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
    renderizarModal();
  });

  document.getElementById("modalSuperpuesto").addEventListener("click", (e) => {
    if (e.target.id === "modalSuperpuesto") {
      estado.turnoSeleccionado = null;
      estado.modoEdicion = false;
      renderizarModal();
    }
  });
}