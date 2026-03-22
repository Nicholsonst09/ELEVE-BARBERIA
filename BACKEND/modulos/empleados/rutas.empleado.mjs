import { Router } from "express";
import controlador from './controlador.empleado.mjs';

const rutasApiEmpleados = Router();

rutasApiEmpleados.get('/api/v1/empleados', controlador.obtenerEmpleados);
rutasApiEmpleados.get('/api/v1/empleados/:id', controlador.obtenerUnEmpleado);

export default rutasApiEmpleados;