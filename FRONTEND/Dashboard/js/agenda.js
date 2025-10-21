// js/agenda.js
import { estado, horariosDelDia } from './estado.js';
import { fetchTurnos, fetchTurnosPendientesCount, eliminarTurno } from './api.js';
import {
formatearFecha,
  esHoy,
  puedeDiaAnterior,
  showNotification, 
  formatearFechaParaAPI 
} from './utilidades.js';

// --- Funciones de Lógica de Agenda (Privadas) ---

function obtenerEstiloTurno(horaInicio, horaFin) {
  const [horaI, minI] = (horaInicio || "09:00").split(":").map(Number);
  const minutosInicio = (horaI - 9) * 60 + minI;
  const duracionMinutos = 60; // Duración fija asumida (API no envía horaFin)

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
    html += `
      <button class="pestana-navegacion ${String(estado.profesionalSeleccionado) === String(prof.id) ? "activo" : ""}" data-id="${prof.id}">
        <div class="punto-color" style="background-color: ${prof.color || '#ccc'};"></div>
        ${prof.nombre}
      </button>
    `;
  });

  navPestanas.innerHTML = html;

  // Asigna listeners a las pestañas de profesional
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

  turnosFiltrados.forEach((turno) => {
    const profesional = estado.profesionales.find(p => p.nombre === turno.nombre_empleado);
    const estilo = obtenerEstiloTurno(turno.hora, turno.hora_fin);
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-turno";
    tarjeta.style.top = estilo.top;
    tarjeta.style.height = estilo.height;
    const duracion = calcularDuracionEnMinutos(turno.fecha, turno.hora, turno.hora_fin);
    const color = profesional?.color || 'var(--color-primario)';
    tarjeta.style.backgroundColor = color;
    tarjeta.style.borderColor = color;

    tarjeta.innerHTML = `
      <div class="info-turno">
        <div class="cliente-turno">${turno.nombre_cliente}</div>
        <div class="servicio-turno">${turno.nombre_servicio} (${duracion} min)</div> 
        ${profesional ? `
          <div class="profesional-turno">
            <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="7" r="4" stroke-width="2"/>
            </svg>
            <span>${turno.nombre_empleado}</span>
          </div>
        ` : ""}
      </div>
      <div class="pie-turno">
        <div class="hora-turno">
          <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>${turno.hora} - ${turno.hora_fin}</span>
        </div>
        <div class="editar-turno">
          <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    `;

    tarjeta.addEventListener("click", () => {
      estado.turnoSeleccionado = turno;
      estado.modoEdicion = false;
      renderizarModal();
    });

    contenedor.appendChild(tarjeta);
  });
}


// js/agenda.js

// ... (asegúrate de que los imports y la variable _recargarDashboardStats estén arriba) ...

function renderizarModal() {
  const modal = document.getElementById("modalSuperpuesto");
  const cuerpoModal = document.getElementById("cuerpoModal");
  const tituloModal = document.getElementById("tituloModal");

  if (!estado.turnoSeleccionado) {
    modal.classList.remove("activo");
    return;
  }

  modal.classList.add("activo");
  const turno = estado.turnoSeleccionado;
  
  // Mapeo de datos planos de la API
  const profesional = { nombre: turno.nombre_empleado };
  const servicio = { nombre: turno.nombre_servicio };
  const cliente = { nombre: turno.nombre_cliente, telefono: turno.telefono_cliente };

  if (estado.modoEdicion) {
    tituloModal.textContent = "Modificar Turno";
    
    const servicioSeleccionado = estado.servicios.find(s => s.nombre === turno.nombre_servicio);
    const profesionalSeleccionado = estado.profesionales.find(p => p.nombre === turno.nombre_empleado);

     cuerpoModal.innerHTML = `
          <form id="formEdicion">
            <div class="grupo-formulario">
              <label class="form-label" for="nombreCliente">Nombre del Cliente</label>
              <input type="text" id="nombreCliente" class="form-input" value="${cliente.nombre || ''}" required>
            </div>
            
            <div class="grupo-formulario">
                <label class="form-label" for="telefono">Teléfono</label>
                <input type="tel" id="telefono" class="form-input" value="${cliente.telefono || ''}">
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="servicioId">Servicio</label>
              <select id="servicioId" class="form-select" required>
                ${estado.servicios.map(s => `
                    <option value="${s.id}" data-duracion="${s.duracion || s.duracion_min || 30}" ${servicioSeleccionado && s.id === servicioSeleccionado.id ? "selected" : ""}>
                      ${s.nombre}
                    </option>
                  `).join("")}
              </select>
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="profesionalId">Profesional</label>
              <select id="profesionalId" class="form-select" required>
                ${estado.profesionales.map(p => `
                    <option value="${p.id}" ${profesionalSeleccionado && p.id === profesionalSeleccionado.id ? "selected" : ""}>
                      ${p.nombre}
                    </option>
                  `).join("")}
              </select>
            </div>

            <div class="form-row-2col">
              <div class="grupo-formulario">
                <label class="form-label" for="fecha">Fecha</label>
                <input type="date" id="fecha" class="form-input" value="${turno.fecha || ''}" required>
              </div>
              <div class="grupo-formulario">
                <label class="form-label" for="horaInicio">Hora</label>
                <input type="time" id="horaInicio" class="form-input" value="${turno.hora ? turno.hora.substring(0, 5) : ''}" required>
              </div>
            </div>
            <div class="grupo-formulario">
              <label class="form-label" for="estado">Estado</label>
              <select id="estado" class="form-select" required>
                <option value="confirmado" ${turno.estado === 'confirmado' ? 'selected' : ''}>Confirmado</option>
                <option value="pendiente" ${!turno.estado || turno.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                <option value="completado" ${turno.estado === 'completado' ? 'selected' : ''}>Completado</option>
                <option value="cancelado" ${turno.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
              </select>
            </div>

            <div class="grupo-formulario">
              <label class="form-label" for="observaciones">Observaciones</label>
              <textarea id="observaciones" class="form-input" placeholder="Agregar notas...">${turno.observaciones || ''}</textarea>
            </div>

            <div class="pie-modal">
              <button type="button" class="boton-secundario" id="btnCancelarEdicion">Cancelar</button>
              <button type="submit" class="boton-primario">Guardar Cambios</button>
            </div>
          </form>
        `;
    
     // ===============================================
     // AQUI ESTÁ LA LÓGICA DE GUARDADO ACTUALIZADA
     // ===============================================
     document.getElementById("formEdicion").addEventListener("submit", async (e) => {
        e.preventDefault();

        // 1. Validar y calcular la hora de fin
        const selectServicio = document.getElementById("servicioId");
        const duracion = parseInt(selectServicio.options[selectServicio.selectedIndex].dataset.duracion, 10) || 30;
        const horaInicioInput = document.getElementById("horaInicio").value; // "HH:MM"
        const fechaBase = document.getElementById("fecha").value; // "YYYY-MM-DD"

        if (!fechaBase) {
            showNotification("La fecha no es válida.", "error");
            return;
        }
        
        const fechaHoraInicio = new Date(`${fechaBase}T${horaInicioInput}:00`);
        if (isNaN(fechaHoraInicio)) {
             showNotification("La hora de inicio no es válida.", "error");
             return;
        }

        const fechaHoraFin = new Date(fechaHoraInicio.getTime() + duracion * 60000);
        // Formatea como HH:MM:SS
        const horaFinCalculada = fechaHoraFin.toTimeString().substring(0, 8);
        const horaInicioFormateada = fechaHoraInicio.toTimeString().substring(0, 8);


        // 2. Construir el objeto turnoData
        // Usamos el ID del turno guardado en el estado
        const turnoData = {
          id: estado.turnoSeleccionado.id, // <-- ID del turno
          cliente_id: estado.turnoSeleccionado.cliente_id, // <-- ID del cliente
          empleado_id: document.getElementById("profesionalId").value,
          servicio_id: document.getElementById("servicioId").value,
          fecha: fechaBase,
          hora_inicio: horaInicioFormateada,
          hora_fin: horaFinCalculada,
          estado: document.getElementById("estado").value,
          observaciones: document.getElementById("observaciones").value,
          
          // (La API de /turnos puede que también actualice el cliente)
          nombreCliente: document.getElementById("nombreCliente").value, 
          telefono: document.getElementById("telefono").value,
        };

        // 3. Llamar a la API (importada al inicio del archivo)
        const resultado = await api.createOrUpdateTurno(turnoData);

        if (resultado) {
          showNotification("Turno actualizado correctamente", "success");
          estado.turnoSeleccionado = null;
          estado.modoEdicion = false;
          
          // Refresca la agenda y las estadísticas
          recargarTurnosYAgenda(); 
          _recargarDashboardStats(); 
          
          renderizarModal(); // Cierra el modal
        } else {
          showNotification("Error al actualizar el turno.", "error");
        }
     });
    
     document.getElementById("btnCancelarEdicion").addEventListener("click", () => {
      estado.modoEdicion = false;
      renderizarModal();
    });

  } else {
    // Vista de "Detalles del Turno" (sin cambios)
    tituloModal.textContent = "Detalles del Turno";
    cuerpoModal.innerHTML = `
          <div class="detalles-turno-container">
            <div class="detalles-turno-header">
              <div class="detalles-turno-nombre">${cliente.nombre}</div>
              <div class="insignia-estado estado-${turno.estado || 'pendiente'}">${obtenerEtiquetaEstado(
      turno.estado || 'pendiente',
    )}</div>
            </div>
            <div class="detalles-turno-servicio">${servicio.nombre}</div>
          </div>
          <div class="detalles-turno-info">
          
            <div class="detalles-turno-item">
              <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg>
              <span>${formatearFecha(new Date(turno.fecha + 'T00:00:00'))}</span>
            </div>
            <div class="detalles-turno-item">
              <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span>${turno.hora}</span>
            </div>
            ${ profesional.nombre ? `
              <div class="detalles-turno-item">
                <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>${profesional.nombre}</span>
              </div>` : "" }
            ${ cliente.telefono ? `
              <div class="detalles-turno-item">
                <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81 .7A2 2 0 0 1 22 16.92z"/></svg>
                <a href="tel:${cliente.telefono}">${cliente.telefono}</a>
              </div>` : "" }
            ${ turno.email ? `
              <div class="detalles-turno-item">
                <svg class="icono" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <a href="mailto:${turno.email}">${turno.email}</a>
              </div>` : "" }
          </div>
          ${turno.observaciones ? `
            <div class="detalles-turno-notas">
              <div class="detalles-turno-notas-titulo">Notas</div>
              <div class="detalles-turno-notas-texto">${turno.observaciones}</div>
            </div>` : ""}
          <div class="pie-modal">
            <button class="boton-secundario" id="btnModificar">Modificar</button>
            <button class="boton-secundario eliminar" id="btnCancelarTurno">Eliminar Turno</button>
          </div>
        `;

    document.getElementById("btnModificar").addEventListener("click", () => {
      estado.modoEdicion = true;
      renderizarModal();
    });

document.getElementById("btnCancelarTurno").addEventListener("click", async () => { // 1. Convertido a async
  if (!turno.id) {
    showNotification("Error: No se puede cancelar el turno porque falta el 'id' desde la API.", "error");
    return;
  }

  try {
    // 2. Esperar a que la API confirme la eliminación
    const resultado = await eliminarTurno(turno.id); 

    if (resultado) {
      showNotification("Turno eliminado con éxito", "success");
      
      // 3. Indicar que no hay turno seleccionado (ESTO CIERRA EL MODAL)
      estado.turnoSeleccionado = null;
      estado.modoEdicion = false;

      // 4. Recargar la lista de turnos desde la API.
      // Esta función ya llama a renderizar() al final.
      recargarTurnosYAgenda(); 
      
      // 5. (RECOMENDADO) Recargar stats del dashboard.
      // Al editar un turno llamas a _recargarDashboardStats().
      // Deberías hacer lo mismo aquí, pero esa función no parece
      // estar disponible en este scope. 
      // La forma correcta sería guardar la función 'recargarDashboardStats' 
      // (que recibe setupAgendaEventListeners) en una 
      // variable a nivel de módulo para poder llamarla desde aquí.

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
  document.getElementById("btnDiaAnterior").addEventListener("click", () => {
    if (puedeDiaAnterior(estado.fechaActual)) {
      estado.fechaActual.setDate(estado.fechaActual.getDate() - 1);
      recargarTurnosYAgenda();
      recargarDashboardStats(); // Llama a la función pasada como dependencia
    }
  });

  document.getElementById("btnDiaSiguiente").addEventListener("click", () => {
    estado.fechaActual.setDate(estado.fechaActual.getDate() + 1);
    recargarTurnosYAgenda();
    recargarDashboardStats();
  });

  document.getElementById("btnHoy").addEventListener("click", () => {
    estado.fechaActual = new Date();
    recargarTurnosYAgenda();
    recargarDashboardStats();
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