import { Router } from 'express';
import controlador from './controlador.cliente.mjs'; 

const rutasApiCliente = Router();

rutasApiCliente.get('/api/v1/clientes', controlador.obtenerClientes);
rutasApiCliente.get('/api/v1/clientes/:id', controlador.obtenerUnCliente);
rutasApiCliente.post('/api/v1/clientes/obtener-o-crear', controlador.obtenerOCrear); 

export default rutasApiCliente;