import { Router } from "express";
import controlador from './controlador.empleado.mjs';

const rutasApiEmpleados = Router();

rutasApiEmpleados.get('/api/v1/empleados', controlador.obtenerEmpleados);
rutasApiEmpleados.get('/api/v1/empleados/:id', controlador.obtenerUnEmpleado);
rutasApiEmpleados.post('/api/v1/empleados', controlador.crearEmpleado);
rutasApiEmpleados.put('/api/v1/empleados/:id', controlador.actualizarEmpleado);
rutasApiEmpleados.delete('/api/v1/empleados/:id', controlador.eliminarEmpleado);

export default rutasApiEmpleados;