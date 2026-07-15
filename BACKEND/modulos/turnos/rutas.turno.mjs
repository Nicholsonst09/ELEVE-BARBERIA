import { Router } from 'express';
import controlador from './controlador.turno.mjs';
import { autenticarSesion } from '../auth/middleware.auth.mjs';

const rutasApiTurnos = Router();

rutasApiTurnos.get('/api/v1/turnos/horarios-disponibles/:empleado_id/:servicio_id/:fecha', controlador.obtenerHorariosDisponibles);
rutasApiTurnos.get('/api/v1/turnos', autenticarSesion, controlador.obtenerTurnos);
rutasApiTurnos.get('/api/v1/turnos/detalles', autenticarSesion, controlador.obtenerTurnosConDetalles);
rutasApiTurnos.get('/api/v1/turnos/notificaciones/recordatorios', autenticarSesion, controlador.procesarRecordatoriosTurnos);
rutasApiTurnos.get('/api/v1/turnos/:id', autenticarSesion, controlador.obtenerUnTurno);
rutasApiTurnos.post('/api/v1/turnos', autenticarSesion, controlador.agregarTurno);
rutasApiTurnos.put('/api/v1/turnos/:id', autenticarSesion, controlador.modificarTurno);
rutasApiTurnos.post('/api/v1/turnos/:id/pago', autenticarSesion, controlador.registrarPagoTurno);
rutasApiTurnos.delete('/api/v1/turnos/:id', autenticarSesion, controlador.eliminarTurno);

export default rutasApiTurnos;