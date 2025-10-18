import { Router } from 'express';
import controlador from './controlador.turno.mjs';

const rutasApiTurnos = Router();

rutasApiTurnos.get('/api/v1/turnos', controlador.obtenerTurnos);
rutasApiTurnos.get('/api/v1/turnos/detalles', controlador.obtenerTurnosConDetalles);
rutasApiTurnos.get('/api/v1/turnos/:id', controlador.obtenerUnTurno);
rutasApiTurnos.post('/api/v1/turnos', controlador.agregarTurno);
rutasApiTurnos.put('/api/v1/turnos/:id', controlador.modificarTurno);
rutasApiTurnos.delete('/api/v1/turnos/:id', controlador.eliminarTurno);
rutasApiTurnos.get('/api/v1/turnos/horarios-disponibles/:empleado_id/:servicio_id/:fecha', controlador.obtenerHorariosDisponibles);

export default rutasApiTurnos;