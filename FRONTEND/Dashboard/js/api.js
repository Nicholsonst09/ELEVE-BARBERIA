// js/api.js
import { API_BASE_URL, estado } from './estado.js';
import { formatearFechaParaAPI, showNotification } from './utilidades.js';
import { obtenerSesion, cerrarSesion } from './auth.js';

/**
 * Manejador de errores centralizado para fetch.
 * @param {string} mensaje - Mensaje para la consola y el estado.
 * @param {Error} error - El error capturado.
 */
function manejarErrorFetch(mensaje, error) {
  console.error(mensaje, error);
  estado.error = mensaje; // Muta el estado importado
}

// Intercepta cualquier 401 que devuelva el backend (token de sesión vencido)
// para avisarle al usuario y mandarlo a login, en vez de dejar que cada una
// de las funciones de este archivo falle en silencio. Se parchea el fetch
// global (en vez de tocar cada llamada) porque este módulo solo se carga en
// el panel de gestión, nunca en login.html.
let sesionExpiradaEnCurso = false;

// Muestra la pantalla de "Sesión Expirada" (overlay-sesion-expirada en el
// HTML) y deja que sea el usuario quien decida ir al login, en vez de
// redirigirlo de golpe y hacerle perder de vista lo que estaba mirando.
function mostrarOverlaySesionExpirada() {
  const overlay = document.getElementById('overlay-sesion-expirada');
  if (!overlay) {
    // Fallback por si esta página no tiene el markup del overlay.
    showNotification('Tu sesión expiró. Iniciá sesión de nuevo.', 'warning');
    setTimeout(() => cerrarSesion(), 1500);
    return;
  }

  overlay.classList.add('activo');
  document.body.style.overflow = 'hidden';

  const btnIrLogin = document.getElementById('btn-ir-login-sesion-expirada');
  btnIrLogin?.addEventListener('click', () => cerrarSesion(), { once: true });
}

function manejarSesionExpirada() {
  if (sesionExpiradaEnCurso) return;
  sesionExpiradaEnCurso = true;
  mostrarOverlaySesionExpirada();
}

const fetchOriginal = window.fetch.bind(window);
window.fetch = async (...args) => {
  const respuesta = await fetchOriginal(...args);
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  // /auth/me ya maneja su propio 401 en inicializarAuth(); no duplicar el aviso ahí.
  if (respuesta.status === 401 && url.startsWith(API_BASE_URL) && !url.includes('/auth/me')) {
    manejarSesionExpirada();
  }
  return respuesta;
};

function construirHeadersJSON() {
  const sesion = obtenerSesion?.();
  const headers = { 'Content-Type': 'application/json' };
  if (sesion?.accessToken) headers.Authorization = `Bearer ${sesion.accessToken}`;
  if (sesion?.rol) headers['x-user-role'] = sesion.rol;
  if (sesion?.usuarioId && Number.isFinite(Number(sesion.usuarioId))) headers['x-user-id'] = String(Number(sesion.usuarioId));
  return headers;
}

function construirHeadersSimple() {
  const sesion = obtenerSesion?.();
  const headers = {};
  if (sesion?.accessToken) headers.Authorization = `Bearer ${sesion.accessToken}`;
  if (sesion?.rol) headers['x-user-role'] = sesion.rol;
  if (sesion?.usuarioId && Number.isFinite(Number(sesion.usuarioId))) headers['x-user-id'] = String(Number(sesion.usuarioId));
  return headers;
}

function obtenerUsuarioIdSesion() {
  const sesion = obtenerSesion?.();
  const usuarioId = Number(sesion?.usuarioId);
  return Number.isFinite(usuarioId) && usuarioId > 0 ? usuarioId : null;
}

// Reintenta la request ante fallos de red transitorios (p.ej. cold start del
// backend en Vercel) y ante respuestas 5xx/429, que suelen ser hiccups
// pasajeros del backend o de Supabase — a diferencia de un 4xx (esos no se
// reintentan, porque repetir el mismo pedido no los va a arreglar).
// Backoff 1s/2s/4s: un cold start de Vercel puede tardar varios segundos en
// levantar la función, así que las esperas entre intentos son exponenciales
// en vez de lineales. fetchFn debe aceptar un AbortSignal para que cada
// intento corte a los 10s en vez de quedar colgado esperando una conexión
// que nunca va a responder.
async function fetchConReintento(fetchFn, intentos = 4, esperaBaseMs = 1000) {
  let ultimoError;
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const respuesta = await fetchFn(AbortSignal.timeout(10000));
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

export async function fetchNegocioConfig() {
  try {
    const response = await fetch(`${API_BASE_URL}/negocio/config`, {
      headers: construirHeadersSimple(),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    manejarErrorFetch('No se pudo cargar la configuracion del negocio', error);
    return null;
  }
}

export async function updateNegocioConfig(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/negocio/config`, {
      method: 'PUT',
      headers: construirHeadersJSON(),
      body: JSON.stringify(payload || {}),
    });

    if (!response.ok) {
      let detalle = '';
      try {
        const dataError = await response.json();
        detalle = dataError?.detalle || dataError?.mensaje || '';
      } catch (_) {
        detalle = '';
      }
      throw new Error(detalle || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    manejarErrorFetch('No se pudo actualizar la configuracion del negocio', error);
    return null;
  }
}

export async function verificarConflictosHorarios(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/negocio/horarios/conflictos`, {
      method: 'POST',
      headers: construirHeadersJSON(),
      body: JSON.stringify(payload || {}),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.turnos || [];
  } catch (error) {
    manejarErrorFetch('No se pudieron verificar conflictos de horarios', error);
    return null;
  }
}

export async function fetchProfesionales() {
  try {
    const response = await fetchConReintento((signal) => fetch(`${API_BASE_URL}/empleados`, {
      headers: construirHeadersSimple(),
      signal,
    }));
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
    const response = await fetch(`${API_BASE_URL}/turnos/detalles?${params.toString()}`, {
      headers: construirHeadersSimple(),
    });
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
    const response = await fetch(`${API_BASE_URL}/turnos/detalles?${params.toString()}`, {
      headers: construirHeadersSimple(),
    });
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
    const response = await fetchConReintento((signal) => fetch(`${API_BASE_URL}/servicios`, {
      headers: construirHeadersSimple(),
      signal,
    }));
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

function inicioDelDia(fecha = new Date()) {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function redondearNumero(valor, decimales = 2) {
  return Number(Number(valor || 0).toFixed(decimales));
}

function construirRespuestaFinancieraVacia(periodo) {
  return {
    kpis: {
      [periodo]: {
        ingresosTotales: 0,
        cambioIngresos: 0,
        ventasTotales: 0,
        ticketPromedio: 0,
        comisionesTotales: 0,
        utilidadNeta: 0,
        tasaAnulacion: 0,
        ventasAnuladas: 0,
        turnosTotales: 0,
        ingresoPromedioPorTurno: 0,
        tasaOcupacion: 0,
        horasTotales: 0,
        fidelidad: { nuevos: 0, recurrentes: 0 },
        estadoTurnos: { completados: 0, cancelados: 0, ausentes: 0 },
        turnosCompletados: 0,
        turnosCancelados: 0,
        tasaCancelacionTurnos: 0,
        turnosRegistrados: 0,
        turnosReservados: 0,
        servicioMasSolicitado: null,
        horaPico: null,
      },
    },
    serviciosPorEmpleado: { [periodo]: [] },
    cantidadServiciosPorEmpleado: { [periodo]: [] },
    ingresosPorEmpleado: { [periodo]: [] },
    ocupacionPorEmpleado: { [periodo]: [] },
    turnosPorHora: { [periodo]: [] },
    serviciosPopularesDona: [],
    metodosPagoDona: [],
    ingresosPorEmpleadoDona: [],
  };
}

export async function fetchDashboardStats(fecha) {
  try {
    const params = new URLSearchParams({
      fecha: formatearFechaParaAPI(fecha || estado.fechaActual),
    });
    const response = await fetch(`${API_BASE_URL}/turnos/detalles?${params.toString()}`, {
      headers: construirHeadersSimple(),
    });
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

export async function fetchIndicadoresFinancieros(filtros = {}) {
  try {
    const params = new URLSearchParams();
    if (filtros.desde) params.set('desde', filtros.desde);
    if (filtros.hasta) params.set('hasta', filtros.hasta);
    if (filtros.empleado_id) params.set('empleado_id', filtros.empleado_id);

    const response = await fetch(`${API_BASE_URL}/indicadores/financieros?${params.toString()}`, {
      headers: construirHeadersSimple(),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    manejarErrorFetch('No se pudieron cargar los indicadores financieros', error);
    return null;
  }
}

export async function fetchFinancialData(periodo = 'week') {
  try {
    const { inicio, fin, inicioPrevio, finPrevio, diffDias } = obtenerRangosPeriodo(periodo, estado.fechaActual || new Date());
    const desdeActual = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), 0, 0, 0, 0).toISOString();
    const hastaActual = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate(), 23, 59, 59, 999).toISOString();
    const desdePrevio = new Date(inicioPrevio.getFullYear(), inicioPrevio.getMonth(), inicioPrevio.getDate(), 0, 0, 0, 0).toISOString();
    const hastaPrevio = new Date(finPrevio.getFullYear(), finPrevio.getMonth(), finPrevio.getDate(), 23, 59, 59, 999).toISOString();

    const [actual, previo] = await Promise.all([
      fetchIndicadoresFinancieros({ desde: desdeActual, hasta: hastaActual }),
      fetchIndicadoresFinancieros({ desde: desdePrevio, hasta: hastaPrevio }),
    ]);

    if (!actual) {
      return construirRespuestaFinancieraVacia(periodo);
    }

    const {
      ingresosTotales, ventasTotales, ventasAnuladas, ticketPromedio,
      tasaAnulacion, comisionesTotales, utilidadNeta,
      turnosCompletados, turnosCancelados, tasaCancelacionTurnos, horaPico,
      turnosRegistrados, turnosReservados, tasaOcupacion,
    } = actual.resumen;

    const ingresosPrevios = previo?.resumen?.ingresosTotales || 0;
    const cambioIngresos = ingresosPrevios > 0
      ? ((ingresosTotales - ingresosPrevios) / ingresosPrevios) * 100
      : (ingresosTotales > 0 ? 100 : 0);

    const ventasPorEmpleado = actual.porEmpleado
      .map((empleado) => ({ nombre: empleado.nombre, avatar_url: empleado.avatar_url || null, monto: redondearNumero(empleado.ingresos) }))
      .slice(0, 5);

    const comisionesPorEmpleado = [...actual.porEmpleado]
      .sort((a, b) => b.comision - a.comision)
      .map((empleado) => ({ nombre: empleado.nombre, avatar_url: empleado.avatar_url || null, monto: redondearNumero(empleado.comision) }))
      .slice(0, 5);

    const cantidadServiciosPorEmpleado = (actual.serviciosPorEmpleado || [])
      .map((empleado) => ({ nombre: empleado.nombre, avatar_url: empleado.avatar_url || null, cantidad: empleado.cantidad }))
      .slice(0, 5);

    const colores = ['#1a1a1a', '#404040', '#737373', '#a3a3a3', '#d4d4d4'];
    const serviciosPopularesDona = (actual.serviciosPopulares || [])
      .slice(0, 5)
      .map((servicio, index) => ({ nombre: servicio.nombre, cantidad: servicio.cantidad, color: colores[index % colores.length] }));

    const metodosPagoDona = (actual.metodosPago || [])
      .slice(0, 5)
      .map((metodo, index) => ({ nombre: metodo.nombre, cantidad: redondearNumero(metodo.monto), color: colores[index % colores.length] }));

    const ingresosPorEmpleadoDona = (actual.porEmpleado || [])
      .slice(0, 5)
      .map((empleado, index) => ({ nombre: empleado.nombre, cantidad: redondearNumero(empleado.ingresos), color: colores[index % colores.length] }));

    const ocupacionPorEmpleado = (actual.ocupacionPorEmpleado || [])
      .map((empleado) => ({ nombre: empleado.nombre, avatar_url: empleado.avatar_url || null, cantidad: redondearNumero(empleado.porcentaje, 1) }));

    const servicioMasSolicitado = actual.serviciosPopulares?.[0]?.nombre || null;

    return {
      kpis: {
        [periodo]: {
          ingresosTotales: redondearNumero(ingresosTotales),
          cambioIngresos: redondearNumero(cambioIngresos, 1),
          ventasTotales,
          ticketPromedio: redondearNumero(ticketPromedio),
          comisionesTotales: redondearNumero(comisionesTotales),
          utilidadNeta: redondearNumero(utilidadNeta),
          tasaAnulacion: redondearNumero(tasaAnulacion, 1),
          ventasAnuladas,
          turnosTotales: ventasTotales,
          ingresoPromedioPorTurno: redondearNumero(ticketPromedio),
          tasaOcupacion: redondearNumero(tasaOcupacion, 1),
          horasTotales: redondearNumero(comisionesTotales),
          fidelidad: { nuevos: ventasTotales, recurrentes: 0 },
          estadoTurnos: { completados: ventasTotales, cancelados: ventasAnuladas, ausentes: 0 },
          turnosCompletados: turnosCompletados || 0,
          turnosCancelados: turnosCancelados || 0,
          tasaCancelacionTurnos: redondearNumero(tasaCancelacionTurnos, 1),
          turnosRegistrados: turnosRegistrados || 0,
          turnosReservados: turnosReservados || 0,
          servicioMasSolicitado,
          horaPico: horaPico || null,
        },
      },
      serviciosPorEmpleado: { [periodo]: ventasPorEmpleado },
      cantidadServiciosPorEmpleado: { [periodo]: cantidadServiciosPorEmpleado },
      ingresosPorEmpleado: { [periodo]: ventasPorEmpleado },
      ocupacionPorEmpleado: { [periodo]: ocupacionPorEmpleado },
      comisionesPorEmpleado: { [periodo]: comisionesPorEmpleado },
      turnosPorHora: { [periodo]: actual.porHora || [] },
      serviciosPopularesDona,
      metodosPagoDona,
      ingresosPorEmpleadoDona,
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

export async function fetchUsuarios() {
  try {
    const response = await fetch(`${API_BASE_URL}/usuarios`, {
      headers: construirHeadersSimple(),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.usuarios || [];
  } catch (error) {
    manejarErrorFetch('No se pudieron cargar los usuarios', error);
    return [];
  }
}

export async function createUsuario(usuarioData) {
  try {
    const response = await fetch(`${API_BASE_URL}/usuarios`, {
      method: 'POST',
      headers: construirHeadersJSON(),
      body: JSON.stringify(usuarioData),
    });
    if (!response.ok) {
      let detalle = '';
      try {
        const dataError = await response.json();
        detalle = dataError?.detalle || dataError?.mensaje || '';
      } catch (_) {}
      throw new Error(detalle || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    manejarErrorFetch(error.message || 'No se pudo crear el usuario', error);
    return null;
  }
}

export async function updateUsuario(usuarioId, usuarioData) {
  try {
    const response = await fetch(`${API_BASE_URL}/usuarios/${usuarioId}`, {
      method: 'PUT',
      headers: construirHeadersJSON(),
      body: JSON.stringify(usuarioData),
    });
    if (!response.ok) {
      let detalle = '';
      try {
        const dataError = await response.json();
        detalle = dataError?.detalle || dataError?.mensaje || '';
      } catch (_) {}
      throw new Error(detalle || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    manejarErrorFetch(error.message || 'No se pudo actualizar el usuario', error);
    return null;
  }
}

export async function deleteUsuario(usuarioId) {
  try {
    const response = await fetch(`${API_BASE_URL}/usuarios/${usuarioId}`, {
      method: 'DELETE',
      headers: construirHeadersSimple(),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    if (response.status === 204) return { success: true };
    return await response.json();
  } catch (error) {
    manejarErrorFetch('No se pudo desactivar el usuario', error);
    return null;
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
    if (!response.ok) {
      let detalle = '';
      try {
        const dataError = await response.json();
        detalle = dataError?.mensaje || dataError?.detalle || '';
      } catch (_) {}
      throw new Error(detalle || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    manejarErrorFetch(error.message || `No se pudo ${esEdicion ? 'actualizar' : 'crear'} el turno`, error);
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
    const response = await fetchConReintento((signal) => fetch(`${API_BASE_URL}/servicios/${servicioId}/empleados`, {
      headers: construirHeadersSimple(),
      signal,
    }));
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
    const response = await fetchConReintento((signal) => fetch(url, {
      headers: construirHeadersSimple(),
      signal,
    }));
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
      headers: construirHeadersJSON(),
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
    const response = await fetch(`${API_BASE_URL}/turnos/detalles`, {
      headers: construirHeadersSimple(),
    });
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
    const response = await fetch(`${API_BASE_URL}/clientes`, {
      headers: construirHeadersSimple(),
    })
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
      headers: construirHeadersJSON(),
      body: JSON.stringify(clienteData),
    })
    if (!response.ok) {
      let detalle = ''
      try {
        const dataError = await response.json()
        detalle = dataError?.mensaje || dataError?.detalle || ''
      } catch (_) {}
      throw new Error(detalle || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    manejarErrorFetch(error.message || `No se pudo ${esEdicion ? "actualizar" : "crear"} el cliente`, error)
    return null
  }
}

export async function deleteCliente(clienteId) {
  try {
    const response = await fetch(`${API_BASE_URL}/clientes/${clienteId}`, {
      method: "DELETE",
      headers: construirHeadersSimple(),
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
      headers: construirHeadersJSON(),
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
      headers: construirHeadersSimple(),
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

export async function cambiarEstadoServicio(servicioId, activo) {
  try {
    const response = await fetch(`${API_BASE_URL}/servicios/${servicioId}/estado`, {
      method: "PATCH",
      headers: construirHeadersJSON(),
      body: JSON.stringify({ activo }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  } catch (error) {
    manejarErrorFetch(`No se pudo ${activo ? "activar" : "desactivar"} el servicio`, error)
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
      headers: construirHeadersJSON(),
      body: JSON.stringify(empleadoData),
    })
    if (!response.ok) {
      const cuerpo = await response.json().catch(() => null)
      throw new Error(cuerpo?.mensaje || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    manejarErrorFetch(error.message || `No se pudo ${esEdicion ? "actualizar" : "crear"} el empleado`, error)
    return null
  }
}

export async function uploadEmpleadoAvatar(file, empleadoId = null) {
  try {
    const formData = new FormData()
    formData.append('avatar', file)
    if (empleadoId) formData.append('empleado_id', String(empleadoId))

    const response = await fetch(`${API_BASE_URL}/empleados/avatar/upload`, {
      method: 'POST',
      headers: construirHeadersSimple(),
      body: formData,
    })

    if (!response.ok) {
      let detalle = `HTTP error! status: ${response.status}`
      try {
        const body = await response.json()
        detalle = body?.detalle || body?.mensaje || detalle
      } catch (_) {
        // noop
      }
      throw new Error(detalle)
    }

    return await response.json()
  } catch (error) {
    manejarErrorFetch('No se pudo subir el avatar del empleado', error)
    return {
      error: error?.message || 'Error desconocido al subir avatar'
    }
  }
}

export async function uploadNegocioImagen(file, tipo = 'logo') {
  try {
    const formData = new FormData()
    formData.append('imagen', file)
    formData.append('tipo', tipo === 'reserva' ? 'reserva' : 'logo')

    const response = await fetch(`${API_BASE_URL}/negocio/imagen/upload`, {
      method: 'POST',
      headers: construirHeadersSimple(),
      body: formData,
    })

    if (!response.ok) {
      let detalle = `HTTP error! status: ${response.status}`
      try {
        const body = await response.json()
        detalle = body?.detalle || body?.mensaje || detalle
      } catch (_) {
        // noop
      }
      throw new Error(detalle)
    }

    return await response.json()
  } catch (error) {
    manejarErrorFetch('No se pudo subir la imagen del negocio', error)
    return {
      error: error?.message || 'Error desconocido al subir imagen del negocio'
    }
  }
}

export async function fetchTurnosReservadosEmpleado(empleadoId) {
  try {
    const response = await fetch(`${API_BASE_URL}/empleados/${empleadoId}/turnos-reservados`, {
      headers: construirHeadersSimple(),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.turnos || []
  } catch (error) {
    manejarErrorFetch("No se pudieron verificar los turnos reservados del empleado", error)
    return null
  }
}

export async function deleteEmpleado(empleadoId, cancelarTurnosIds = []) {
  try {
    const response = await fetch(`${API_BASE_URL}/empleados/${empleadoId}`, {
      method: "DELETE",
      headers: construirHeadersJSON(),
      body: JSON.stringify({ cancelarTurnosIds }),
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

export async function cambiarEstadoEmpleado(empleadoId, activo, cancelarTurnosIds = []) {
  try {
    const response = await fetch(`${API_BASE_URL}/empleados/${empleadoId}/estado`, {
      method: "PATCH",
      headers: construirHeadersJSON(),
      body: JSON.stringify({ activo, cancelarTurnosIds }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  } catch (error) {
    manejarErrorFetch(`No se pudo ${activo ? "activar" : "desactivar"} el empleado`, error)
    return null
  }
}