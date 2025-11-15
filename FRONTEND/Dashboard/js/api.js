// js/api.js
import { API_BASE_URL, estado } from './estado.js';
import { formatearFechaParaAPI } from './utilidades.js';

/**
 * Manejador de errores centralizado para fetch.
 * @param {string} mensaje - Mensaje para la consola y el estado.
 * @param {Error} error - El error capturado.
 */
function manejarErrorFetch(mensaje, error) {
  console.error(mensaje, error);
  estado.error = mensaje; // Muta el estado importado
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

  // Si no es "pendiente", agrega el filtro de empleadoId
  if (estado.profesionalSeleccionado && estado.profesionalSeleccionado !== 'pendiente') {
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
      fecha: formatearFechaParaAPI(fecha),
      estado: 'pendiente'
    });
    const response = await fetch(`${API_BASE_URL}/turnos/detalles?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.total_registros || 0;
  } catch (error) {
    manejarErrorFetch('No se pudo obtener el conteo de pendientes', error);
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

// (PROVISIONAL) Devuelve datos falsos para el dashboard
export async function fetchDashboardStats(fecha) {
  console.log("Usando datos FALSOS para fetchDashboardStats");
  await new Promise(resolve => setTimeout(resolve, 50));
  return {
    total: 8,
    confirmados: 5,
    pendientes: 3,
    ingresos: 45000
  };
}

// (PROVISIONAL) Devuelve datos falsos para finanzas
export async function fetchFinancialData(periodo) {
  console.log(`Usando datos FALSOS para fetchFinancialData (periodo: ${periodo})`);
  await new Promise(resolve => setTimeout(resolve, 50));
  return {
    totalRevenue: 6660,
    services: { total: 180, revenue: 4500 },
    products: { total: 72, revenue: 2160 },
    serviceBreakdown: [
      { nombre: "Corte Clásico", count: 25, revenue: 450, percentage: 40 },
      { nombre: "Corte + Barba", count: 15, revenue: 375, percentage: 33 },
      { nombre: "Corte Mujer", count: 8, revenue: 240, percentage: 18 },
    ],
    productSales: [
      { nombre: "Shampoo Premium", units: 8, revenue: 240, percentage: 44 },
      { nombre: "Cera para Cabello", units: 6, revenue: 180, percentage: 33 },
    ],
    performance: {
      avgService: 25,
      avgProduct: 30,
      servicesPerDay: 6,
      revenuePerDay: 238
    }
  };
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(turnoData)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    manejarErrorFetch(`No se pudo ${esEdicion ? 'actualizar' : 'crear'} el turno`, error);
    return null;
  }
}

export async function eliminarTurno(turnoId) {
  try {
    // La URL ahora apunta a la nueva ruta de la API
    const response = await fetch(`${API_BASE_URL}/turnos/${turnoId}`, {
      method: 'DELETE' // Cambiado de 'PUT' a 'DELETE'
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


export async function fetchHorariosDisponibles(empleadoId, servicioId, fecha) {
  if (!empleadoId || !servicioId || !fecha) return [];
  try {
    const url = `${API_BASE_URL}/turnos/horarios-disponibles/${empleadoId}/${servicioId}/${fecha}`;
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

export async function buscarOCrearCliente(nombre, telefono) {
  try {
    const response = await fetch(`${API_BASE_URL}/clientes/obtener-o-crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, telefono }) // Envía nombre y teléfono
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


export async function fetchClientes() {
  try {
    const response = await fetch(`${API_BASE_URL}/clientes`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.clientes || data
  } catch (error) {
    manejarErrorFetch("No se pudieron cargar los clientes", error)
    return []
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
    if (response.status === 204) {
      return { success: true, message: "Cliente eliminado correctamente" }
    }
    return await response.json()
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