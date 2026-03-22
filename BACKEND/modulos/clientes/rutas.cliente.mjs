import { Router } from 'express';
import controlador from './controlador.cliente.mjs'; 

const rutasApiCliente = Router();

rutasApiCliente.get('/api/v1/clientes', controlador.obtenerClientes);
rutasApiCliente.get('/api/v1/clientes/:id', controlador.obtenerUnCliente);
rutasApiCliente.post('/api/v1/clientes/obtener-o-crear', controlador.obtenerOCrear);
rutasApiCliente.post('/api/v1/clientes', controlador.crearCliente);
rutasApiCliente.put('/api/v1/clientes/:id', controlador.actualizarCliente);
rutasApiCliente.delete('/api/v1/clientes/:id', controlador.eliminarCliente);

export default rutasApiCliente;