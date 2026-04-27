// URL base de la API — definida en FRONTEND/shared/config.js
export { API_BASE_URL } from '../../Configuracion/config.js';

// --- Estado Global de la Aplicación ---
export let estado = {
  profesionalSeleccionado: null,
  fechaActual: new Date(),
  turnoSeleccionado: null,
  modoEdicion: false,
  modoCreacion: false,
  modoRegistrarPago: false,
  profesionales: [],
  turnos: [],
  servicios: [],
  turnosPendientesCount: 0,
  dashboardStats: {
    total: 0,
    confirmados: 0,
    pendientes: 0,
    ingresos: 0
  },
  financialData: {
    totalRevenue: 0,
    services: { total: 0, revenue: 0 },
    products: { total: 0, revenue: 0 },
    serviceBreakdown: [],
    productSales: [],
    performance: {}
  },
  clientes: [],
  empleados: [],
  isLoading: true,
  error: null,
};

// Horarios fijos para la grilla
export const horariosDelDia = Array.from({ length: 13 }, (_, i) => {
  const hora = i + 9;
  return `${hora.toString().padStart(2, "0")}:00`;
});