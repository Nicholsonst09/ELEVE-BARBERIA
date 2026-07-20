import { Router } from 'express';
import controlador from './controlador.servicio.mjs';
import { autenticarSesion } from '../auth/middleware.auth.mjs';

const rutasApiServicios = Router();

rutasApiServicios.get('/api/v1/servicios', controlador.obtenerServicios); 
rutasApiServicios.get('/api/v1/servicios/:servicio_id/empleados', controlador.buscarEmpleadosPorServicio);
rutasApiServicios.get('/api/v1/servicios/:servicio_id', controlador.obtenerServicioPorId); //Serviría para más adelante
rutasApiServicios.post('/api/v1/servicios', autenticarSesion, controlador.crearServicio);
rutasApiServicios.put('/api/v1/servicios/:id', autenticarSesion, controlador.actualizarServicio);
rutasApiServicios.patch('/api/v1/servicios/:id/estado', autenticarSesion, controlador.cambiarEstadoServicio);
rutasApiServicios.delete('/api/v1/servicios/:id', autenticarSesion, controlador.eliminarServicio);

export default rutasApiServicios;