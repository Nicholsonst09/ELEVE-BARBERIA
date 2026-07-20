import { Router } from "express";
import multer from 'multer';
import controlador from './controlador.empleado.mjs';
import { autenticarSesion } from '../auth/middleware.auth.mjs';

const rutasApiEmpleados = Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }
});

rutasApiEmpleados.get('/api/v1/empleados', autenticarSesion, controlador.obtenerEmpleados);
rutasApiEmpleados.get('/api/v1/empleados/:id', autenticarSesion, controlador.obtenerUnEmpleado);
rutasApiEmpleados.get('/api/v1/empleados/:id/turnos-reservados', autenticarSesion, controlador.obtenerTurnosReservadosEmpleado);
rutasApiEmpleados.post('/api/v1/empleados/avatar/upload', autenticarSesion, upload.single('avatar'), controlador.subirAvatarEmpleado);
rutasApiEmpleados.post('/api/v1/empleados', autenticarSesion, controlador.crearEmpleado);
rutasApiEmpleados.put('/api/v1/empleados/:id', autenticarSesion, controlador.actualizarEmpleado);
rutasApiEmpleados.patch('/api/v1/empleados/:id/estado', autenticarSesion, controlador.cambiarEstadoEmpleado);
rutasApiEmpleados.delete('/api/v1/empleados/:id', autenticarSesion, controlador.eliminarEmpleado);

export default rutasApiEmpleados;