// clientes/rutas.cliente.mjs

import { Router } from 'express';
import controlador from './controlador.cliente.mjs'; 

const rutasApiCliente = Router();

rutasApiCliente.post('/api/v1/clientes/obtener-o-crear', controlador.obtenerOCrear); 

export default rutasApiCliente;