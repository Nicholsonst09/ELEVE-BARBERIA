// URL base de la API — definida localmente para evitar problemas de rutas según la raíz del servidor
export { API_BASE_URL } from './config.js?v=2';

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
  moduloVentasActivo: true,
  permitirTurnosAtrasados: false,
  // Días de la semana (0=domingo...6=sábado) en que el negocio está cerrado,
  // según su horario semanal configurado. Se usa para no ofrecer esos días
  // como cards de fecha al crear/editar un turno. Domingo cerrado por defecto
  // hasta que se cargue la config real del negocio.
  diasCerradosSemana: new Set([0]),
};

// Horarios fijos para la grilla
export const horariosDelDia = Array.from({ length: 13 }, (_, i) => {
  const hora = i + 9;
  return `${hora.toString().padStart(2, "0")}:00`;
});