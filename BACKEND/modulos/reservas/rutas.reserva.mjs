import { Router } from 'express';
import controlador from './controlador.reserva.mjs';
// DIAGNOSTICO TEMPORAL: rate limit desactivado para descartar que cause los
// "Failed to fetch". Restaurar los limitadores al terminar.
// import { limitadorLecturaReservas, limitadorCrearReserva } from '../../middleware/rateLimiter.mjs';

const rutasReservas = Router();

// Rutas públicas — sin autenticación, usadas por la página de reservas del cliente
rutasReservas.get('/api/v1/reservas/servicios',                                             controlador.obtenerServicios);
rutasReservas.get('/api/v1/reservas/servicios/:servicio_id/empleados',                      controlador.obtenerEmpleadosPorServicio);
rutasReservas.get('/api/v1/reservas/horarios-disponibles/:empleado_id/:servicio_id/:fecha', controlador.obtenerHorariosDisponibles);
rutasReservas.post('/api/v1/reservas',                                                      controlador.crearReserva);

export default rutasReservas;
