import { Router } from 'express';
import controlador from './controlador.mjs';


const rutasApi = Router();

rutasApi.get('/api/v1/turnos', controlador.obtenerTurnos);
rutasApi.get('/api/v1/turnos/:id', controlador.obtenerUnTurno);
rutasApi.post('/api/v1/turnos', controlador.agregarUnTurno);
rutasApi.put('/api/v1/turnos/:id', controlador.modificarTurno);
rutasApi.delete('/api/v1/turnos/:id', controlador.eliminarTurno);


export default rutasApi;
