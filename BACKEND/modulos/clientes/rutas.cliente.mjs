import { Router } from 'express';
import controlador from './controlador.cliente.mjs'; 
import { autenticarSesion } from '../auth/middleware.auth.mjs';

const rutasApiCliente = Router();

rutasApiCliente.post('/api/v1/clientes/obtener-o-crear', controlador.obtenerOCrear);
rutasApiCliente.get('/api/v1/clientes', autenticarSesion, controlador.obtenerClientes);
rutasApiCliente.get('/api/v1/clientes/:id', autenticarSesion, controlador.obtenerUnCliente);
rutasApiCliente.post('/api/v1/clientes', autenticarSesion, controlador.crearCliente);
rutasApiCliente.put('/api/v1/clientes/:id', autenticarSesion, controlador.actualizarCliente);
rutasApiCliente.delete('/api/v1/clientes/:id', autenticarSesion, controlador.eliminarCliente);

export default rutasApiCliente;