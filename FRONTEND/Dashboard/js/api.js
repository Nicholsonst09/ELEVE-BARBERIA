// js/api.js
import { API_BASE_URL, estado } from './estado.js';
import { formatearFechaParaAPI } from './utilidades.js';
import { obtenerSesion } from './auth.js';

/**
 * Manejador de errores centralizado para fetch.
 * @param {string} mensaje - Mensaje para la consola y el estado.
 * @param {Error} error - El error capturado.
 */
function manejarErrorFetch(mensaje, error) {
  console.error(mensaje, error);
  estado.error = mensaje; // Muta el estado importado
}

function construirHeadersJSON() {
  const sesion = obtenerSesion?.();
  const headers = { 'Content-Type': 'application/json' };
  if (sesion?.rol) headers['x-user-role'] = sesion.rol;
  return headers;
}

function construirHeadersSimple() {
  const sesion = obtenerSesion?.();
  const headers = {};
  if (sesion?.rol) headers['x-user-role'] = sesion.rol;
  return headers;
}

export async function fetchProfesionales() {
  try {
    const response = await fetch(`${API_BASE_URL}/empleados`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.empleados || data;
  } catch (error) {
    manejarErrorFetch('No se pudieron cargar los profesionales', error);
    return [];
  }
}



export async function fetchTurnos() {
  const params = new URLSearchParams();
  params.append('fecha', formatearFechaParaAPI(estado.fechaActual));

  // Si no es "reservado", agrega el filtro de empleadoId
  if (estado.profesionalSeleccionado && estado.profesionalSeleccionado !== 'reservado') {
    params.append('empleadoId', estado.profesionalSeleccionado);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/turnos/detalles?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    console.log(data);

    return data.data || [];
  } catch (error) {
    manejarErrorFetch('No se pudieron cargar los turnos', error);
    return [];
  }
}

export async function fetchTurnosPendientesCount(fecha) {
  try {
    const params = new URLSearchParams({
      fecha: formatearFechaParaAPI(fecha)
    });
    const response = await fetch(`${API_BASE_URL}/turnos/detalles?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    const turnos = data.data || [];
    return turnos.filter(t => t.estado === 'reservado').length;
  } catch (error) {
    manejarErrorFetch('No se pudo obtener el conteo de reservados', error);
    return 0;
  }
}

export async function fetchServicios() {
  try {
    const response = await fetch(`${API_BASE_URL}/servicios`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.servicios || data;
  } catch (error) {
    manejarErrorFetch('No se pudieron cargar los servicios', error);
    return [];
  }
}

function normalizarEstadoTurno(estadoTurno) {
  const valor = String(estadoTurno || '').toLowerCase();
  if (valor === 'pendiente' || valor === 'confirmado') return 'reservado';
  if (valor === 'realizado') return 'completado';
  return valor;
}

function parseFecha(fechaISO) {
  if (!fechaISO) return null;
  const fecha = new Date(`${fechaISO}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function parseHoraHHMM(hora) {
  return String(hora || '').substring(0, 5);
}

function duracionTurnoEnMinutos(turno) {
  const inicio = parseHoraHHMM(turno.hora || turno.hora_inicio);
  const fin = parseHoraHHMM(turno.hora_fin);
  if (!inicio || !fin) return 0;

  const [hIni, mIni] = inicio.split(':').map(Number);
  const [hFin, mFin] = fin.split(':').map(Number);
  if ([hIni, mIni, hFin, mFin].some(Number.isNaN)) return 0;

  const minutos = (hFin * 60 + mFin) - (hIni * 60 + mIni);
  return Math.max(0, minutos);
}

function obtenerRangosPeriodo(periodo, fechaBase = new Date()) {
  const base = new Date(fechaBase);
  base.setHours(0, 0, 0, 0);

  const inicio = new Date(base);
  if (periodo === 'day') {
    // mismo dia
  } else if (periodo === 'month') {
    inicio.setDate(inicio.getDate() - 29);
  } else {
    inicio.setDate(inicio.getDate() - 6);
  }

  const fin = new Date(base);

  const diffDias = Math.round((fin.getTime() - inicio.getTime()) / 86400000) + 1;
  const finPrevio = new Date(inicio);
  finPrevio.setDate(finPrevio.getDate() - 1);
  const inicioPrevio = new Date(finPrevio);
  inicioPrevio.setDate(inicioPrevio.getDate() - (diffDias - 1));

  return { inicio, fin, inicioPrevio, finPrevio, diffDias };
}

function estaEnRango(fecha, inicio, fin) {
  if (!fecha) return false;
  return fecha >= inicio && fecha <= fin;
}

function construirRespuestaFinancieraVacia(periodo) {
  return {
    kpis: {
      [periodo]: {
        ingresosTotales: 0,
        cambioIngresos: 0,
        turnosTotales: 0,
        ingresoPromedioPorTurno: 0,
        tasaOcupacion: 0,
        horasTotales: 0,
        fidelidad: { nuevos: 0, recurrentes: 0 },
        estadoTurnos: { completados: 0, cancelados: 0, ausentes: 0 },
      },
    },
    serviciosPorEmpleado: { [periodo]: [] },
    ingresosPorEmpleado: { [periodo]: [] },
    ocupacionPorEmpleado: { [periodo]: [] },
    turnosPorHora: { [periodo]: [] },
    serviciosPopularesDona: [],
  };
}

export async function fetchDashboardStats(fecha) {
  try {
    const params = new URLSearchParams({
      fecha: formatearFechaParaAPI(fecha || estado.fechaActual),
    });
    const response = await fetch(`${API_BASE_URL}/turnos/detalles?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    const turnos = data.data || [];

    const total = turnos.filter(t => !['cancelado', 'anulado'].includes(normalizarEstadoTurno(t.estado))).length;
    const reservados = turnos.filter(t => normalizarEstadoTurno(t.estado) === 'reservado').length;
    const completados = turnos.filter(t => normalizarEstadoTurno(t.estado) === 'completado');
    const ingresos = completados.reduce((acc, turno) => acc + (Number(turno.precio) || 0), 0);

    return {
      total,
      confirmados: reservados,
      pendientes: reservados,
      ingresos,
    };
  } catch (error) {
    manejarErrorFetch('No se pudieron cargar las estadisticas del dashboard', error);
    return { total: 0, confirmados: 0, pendientes: 0, ingresos: 0 };
  }
}

export async function fetchFinancialData(periodo = 'week') {
  try {
    const response = await fetch(`${API_BASE_URL}/turnos/detalles`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const payload = await response.json();
    const turnos = payload.data || [];

    if (!Array.isArray(turnos) || turnos.length === 0) {
      return construirRespuestaFinancieraVacia(periodo);
    }

    const { inicio, fin, inicioPrevio, finPrevio, diffDias } = obtenerRangosPeriodo(periodo, estado.fechaActual || new Date());

    const turnosConFecha = turnos
      .map(t => ({ ...t, __fecha: parseFecha(t.fecha), __estado: normalizarEstadoTurno(t.estado) }))
      .filter(t => t.__fecha);

    const actuales = turnosConFecha.filter(t => estaEnRango(t.__fecha, inicio, fin));
    const previos = turnosConFecha.filter(t => estaEnRango(t.__fecha, inicioPrevio, finPrevio));

    const esCompletado = (t) => t.__estado === 'completado';
    const esCancelado = (t) => t.__estado === 'cancelado';
    const esAnulado = (t) => t.__estado === 'anulado';

    const completados = actuales.filter(esCompletado);
    const cancelados = actuales.filter(esCancelado);
    const anulados = actuales.filter(esAnulado);

    const ingresosTotales = completados.reduce((acc, t) => acc + (Number(t.precio) || 0), 0);
    const ingresosPrevios = previos
      .filter(esCompletado)
      .reduce((acc, t) => acc + (Number(t.precio) || 0), 0);

    const cambioIngresos = ingresosPrevios > 0
      ? ((ingresosTotales - ingresosPrevios) / ingresosPrevios) * 100
      : (ingresosTotales > 0 ? 100 : 0);

    const turnosTotales = actuales.filter(t => t.__estado !== 'anulado').length;
    const ingresoPromedioPorTurno = completados.length > 0 ? ingresosTotales / completados.length : 0;
    const tasaOcupacion = turnosTotales > 0 ? (completados.length / turnosTotales) * 100 : 0;
    const horasTotales = completados.reduce((acc, t) => acc + duracionTurnoEnMinutos(t), 0) / 60;

    const primerTurnoPorCliente = new Map();
    turnosConFecha.forEach((t) => {
      if (!t.cliente_id) return;
      const existente = primerTurnoPorCliente.get(t.cliente_id);
      if (!existente || t.__fecha < existente) {
        primerTurnoPorCliente.set(t.cliente_id, t.__fecha);
      }
    });

    const clientesPeriodo = Array.from(new Set(actuales.map(t => t.cliente_id).filter(Boolean)));
    const nuevos = clientesPeriodo.filter((clienteId) => {
      const primeraFecha = primerTurnoPorCliente.get(clienteId);
      return estaEnRango(primeraFecha, inicio, fin);
    }).length;
    const recurrentes = Math.max(0, clientesPeriodo.length - nuevos);

    const serviciosPorEmpleadoMap = new Map();
    const ingresosPorEmpleadoMap = new Map();
    const minutosPorEmpleadoMap = new Map();
    const minutosCompletadosPorEmpleadoMap = new Map();
    const turnosPorHoraMap = new Map();
    const serviciosPopularesMap = new Map();

    actuales.forEach((t) => {
      const empleado = t.nombre_empleado || 'Sin asignar';
      const servicio = t.nombre_servicio || 'Servicio';
      const hora = parseHoraHHMM(t.hora || t.hora_inicio) || '00:00';
      const minutos = duracionTurnoEnMinutos(t);

      if (!esAnulado(t) && !esCancelado(t)) {
        turnosPorHoraMap.set(hora, (turnosPorHoraMap.get(hora) || 0) + 1);
        minutosPorEmpleadoMap.set(empleado, (minutosPorEmpleadoMap.get(empleado) || 0) + minutos);
      }

      if (esCompletado(t)) {
        serviciosPorEmpleadoMap.set(empleado, (serviciosPorEmpleadoMap.get(empleado) || 0) + 1);
        ingresosPorEmpleadoMap.set(empleado, (ingresosPorEmpleadoMap.get(empleado) || 0) + (Number(t.precio) || 0));
        minutosCompletadosPorEmpleadoMap.set(empleado, (minutosCompletadosPorEmpleadoMap.get(empleado) || 0) + minutos);
        serviciosPopularesMap.set(servicio, (serviciosPopularesMap.get(servicio) || 0) + 1);
      }
    });

    const serviciosPorEmpleado = Array.from(serviciosPorEmpleadoMap.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    const ingresosPorEmpleado = Array.from(ingresosPorEmpleadoMap.entries())
      .map(([nombre, monto]) => ({ nombre, monto: Number(monto.toFixed(2)) }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5);

    const ocupacionPorEmpleado = Array.from(minutosPorEmpleadoMap.entries())
      .map(([nombre, minutosProgramados]) => {
        const completadosMin = minutosCompletadosPorEmpleadoMap.get(nombre) || 0;
        const porcentaje = minutosProgramados > 0 ? (completadosMin / minutosProgramados) * 100 : 0;
        return { nombre, porcentaje: Math.round(porcentaje) };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje)
      .slice(0, 5);

    const turnosPorHora = Array.from(turnosPorHoraMap.entries())
      .map(([hora, cantidad]) => ({ hora, cantidad }))
      .sort((a, b) => a.hora.localeCompare(b.hora));

    const colores = ['#1a1a1a', '#404040', '#737373', '#a3a3a3', '#d4d4d4'];
    const serviciosPopularesDona = Array.from(serviciosPopularesMap.entries())
      .map(([nombre, cantidad], i) => ({ nombre, cantidad, color: colores[i % colores.length] }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    const normalizarNumero = (valor) => Number(Number(valor).toFixed(1));

    return {
      kpis: {
        [periodo]: {
          ingresosTotales: Number(ingresosTotales.toFixed(2)),
          cambioIngresos: normalizarNumero(cambioIngresos),
          turnosTotales,
          ingresoPromedioPorTurno: Number(ingresoPromedioPorTurno.toFixed(2)),
          tasaOcupacion: Math.round(tasaOcupacion),
          horasTotales: normalizarNumero(horasTotales),
          fidelidad: { nuevos, recurrentes },
          estadoTurnos: {
            completados: completados.length,
            cancelados: cancelados.length,
            ausentes: anulados.length,
          },
        },
      },
      serviciosPorEmpleado: { [periodo]: serviciosPorEmpleado },
      ingresosPorEmpleado: { [periodo]: ingresosPorEmpleado },
      ocupacionPorEmpleado: { [periodo]: ocupacionPorEmpleado },
      turnosPorHora: { [periodo]: turnosPorHora },
      serviciosPopularesDona,
      meta: {
        inicio: inicio.toISOString().slice(0, 10),
        fin: fin.toISOString().slice(0, 10),
        dias: diffDias,
      },
    };
  } catch (error) {
    manejarErrorFetch('No se pudieron cargar los datos financieros', error);
    return construirRespuestaFinancieraVacia(periodo);
  }
}

export async function createOrUpdateTurno(turnoData) {
  const esEdicion = !!turnoData.id;
  const url = esEdicion
    ? `${API_BASE_URL}/turnos/${turnoData.id}`
    : `${API_BASE_URL}/turnos`;
  const method = esEdicion ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method: method,
      headers: construirHeadersJSON(),
      body: JSON.stringify(turnoData)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    manejarErrorFetch(`No se pudo ${esEdicion ? 'actualizar' : 'crear'} el turno`, error);
    return null;
  }
}

export async function registrarPagoTurno(turnoId, metodoPago, monto = null) {
  try {
    const body = { metodo: metodoPago }
    if (monto !== null && monto !== undefined) body.monto = monto

    const response = await fetch(`${API_BASE_URL}/turnos/${turnoId}/pago`, {
      method: 'POST',
      headers: construirHeadersJSON(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      let detalle = ''
      try {
        const dataError = await response.json()
        detalle = dataError?.detalle || dataError?.mensaje || ''
      } catch (_) {
        detalle = ''
      }
      throw new Error(detalle || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    manejarErrorFetch('No se pudo registrar el pago', error)
    return null
  }
}

export async function eliminarTurno(turnoId) {
  try {
    // La URL ahora apunta a la nueva ruta de la API
    const response = await fetch(`${API_BASE_URL}/turnos/${turnoId}`, {
      method: 'DELETE', // Cambiado de 'PUT' a 'DELETE'
      headers: construirHeadersSimple()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Muchas API DELETE devuelven un status 204 (No Content) sin cuerpo JSON.
    // Si ese es tu caso, .json() fallará.
    if (response.status === 204) {
      return { success: true, message: 'Turno eliminado correctamente' };
    }

    // Si tu API SÍ devuelve un JSON (ej. el objeto eliminado o un mensaje)
    return await response.json();

  } catch (error) {
    manejarErrorFetch('No se pudo eliminar el turno', error);
    return null;
  }
}

/**
 * Obtiene los empleados (profesionales) disponibles para un servicio específico.
 * @param {string|number} servicioId
 * @returns {Promise<Array>} - Lista de profesionales
 */

export async function fetchProfesionalesPorServicio(servicioId) {
  if (!servicioId) return [];
  try {
    const response = await fetch(`${API_BASE_URL}/servicios/${servicioId}/empleados`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    // Ajusta 'data.empleados' según la respuesta real de tu API
    return data.empleados || data || [];
  } catch (error) {
    manejarErrorFetch('No se pudieron cargar los profesionales para el servicio', error);
    return [];
  }
}

/**
 * Obtiene los horarios disponibles para una combinación de empleado, servicio y fecha.
 * @param {string|number} empleadoId
 * @param {string|number} servicioId
 * @param {string} fecha - Formato "YYYY-MM-DD"
 * @returns {Promise<Array>} - Lista de horarios (ej: [{ hora_inicio_formato_HHMM: "09:00" }])
 */


export async function fetchHorariosDisponibles(empleadoId, servicioId, fecha, origen = 'web') {
  if (!empleadoId || !servicioId || !fecha) return [];
  try {
    const url = `${API_BASE_URL}/turnos/horarios-disponibles/${empleadoId}/${servicioId}/${fecha}?origen=${origen}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    // Ajusta 'data.horarios' según la respuesta real de tu API
    return data.horarios_disponibles || [];
  } catch (error) {
    manejarErrorFetch('No se pudieron cargar los horarios disponibles', error);
    return [];
  }
}

/**
 * Busca un cliente por nombre/teléfono o crea uno nuevo.
 * Llama al endpoint: POST /api/v1/clientes/obtener-o-crear
 * @param {string} nombre
 * @param {string} telefono
 * @returns {Promise<number|null>} El ID del cliente
 */

export async function buscarOCrearCliente(nombre, telefono, email = null) {
  try {
    const response = await fetch(`${API_BASE_URL}/clientes/obtener-o-crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, telefono, email })
    });
    
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.mensaje || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Tu API devuelve { cliente_id: ... }
    return data.cliente_id; 

  } catch (error) {
    manejarErrorFetch('No se pudo obtener o crear el cliente', error);
    return null;
  }
}


export async function fetchHistorial() {
  try {
    const response = await fetch(`${API_BASE_URL}/turnos/detalles`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.data ?? (Array.isArray(data) ? data : []);
  } catch (error) {
    manejarErrorFetch('No se pudo cargar el historial', error);
    return [];
  }
}

export async function fetchClientes() {
  try {
    const response = await fetch(`${API_BASE_URL}/clientes`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    if (Array.isArray(data)) {
      return { clientes: data, estadisticas: null }
    }
    return {
      clientes: data.clientes || [],
      estadisticas: data.estadisticas || null,
    }
  } catch (error) {
    manejarErrorFetch("No se pudieron cargar los clientes", error)
    return { clientes: [], estadisticas: null }
  }
}

export async function updateCliente(clienteData) {
  const esEdicion = !!clienteData.id
  const url = esEdicion ? `${API_BASE_URL}/clientes/${clienteData.id}` : `${API_BASE_URL}/clientes`
  const method = esEdicion ? "PUT" : "POST"

  try {
    const response = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clienteData),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  } catch (error) {
    manejarErrorFetch(`No se pudo ${esEdicion ? "actualizar" : "crear"} el cliente`, error)
    return null
  }
}

export async function deleteCliente(clienteId) {
  try {
    const response = await fetch(`${API_BASE_URL}/clientes/${clienteId}`, {
      method: "DELETE",
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return { success: true }
  } catch (error) {
    manejarErrorFetch("No se pudo eliminar el cliente", error)
    return null
  }
}

export async function createOrUpdateServicio(servicioData) {
  const esEdicion = !!servicioData.id
  const url = esEdicion ? `${API_BASE_URL}/servicios/${servicioData.id}` : `${API_BASE_URL}/servicios`
  const method = esEdicion ? "PUT" : "POST"

  try {
    const response = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(servicioData),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  } catch (error) {
    manejarErrorFetch(`No se pudo ${esEdicion ? "actualizar" : "crear"} el servicio`, error)
    return null
  }
}

export async function deleteServicio(servicioId) {
  try {
    const response = await fetch(`${API_BASE_URL}/servicios/${servicioId}`, {
      method: "DELETE",
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    if (response.status === 204) {
      return { success: true, message: "Servicio eliminado correctamente" }
    }
    return await response.json()
  } catch (error) {
    manejarErrorFetch("No se pudo eliminar el servicio", error)
    return null
  }
}

export async function createOrUpdateEmpleado(empleadoData) {
  const esEdicion = !!empleadoData.id
  const url = esEdicion ? `${API_BASE_URL}/empleados/${empleadoData.id}` : `${API_BASE_URL}/empleados`
  const method = esEdicion ? "PUT" : "POST"

  try {
    const response = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(empleadoData),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  } catch (error) {
    manejarErrorFetch(`No se pudo ${esEdicion ? "actualizar" : "crear"} el empleado`, error)
    return null
  }
}

export async function deleteEmpleado(empleadoId) {
  try {
    const response = await fetch(`${API_BASE_URL}/empleados/${empleadoId}`, {
      method: "DELETE",
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    if (response.status === 204) {
      return { success: true, message: "Empleado eliminado correctamente" }
    }
    return await response.json()
  } catch (error) {
    manejarErrorFetch("No se pudo eliminar el empleado", error)
    return null
  }
}