// URL base de la API
export const API_BASE_URL = 'http://localhost:3000/api/v1';

// --- Estado Global de la Aplicación ---
export let estado = {
  profesionalSeleccionado: null,
  fechaActual: new Date(),
  turnoSeleccionado: null,
  modoEdicion: false,
  modoCreacion: false,
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