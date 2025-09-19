import { Router } from 'express';
import controlador from './controlador.servicio.mjs';

const rutasApiServicios = Router();

rutasApiServicios.get('/api/v1/servicios', controlador.obtenerServicios); 
rutasApiServicios.get('/api/v1/servicios/:servicio_id/empleados', controlador.buscarEmpleadosPorServicio);
rutasApiServicios.get('/api/v1/servicios/:servicio_id', controlador.obtenerServicioPorId); //Serviría para más adelante

export default rutasApiServicios;