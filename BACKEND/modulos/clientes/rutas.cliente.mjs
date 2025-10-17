import { Router } from "express";
import controlador from './controlador.cliente.mjs';

const rutasApiClientes = Router();

rutasApiClientes.get('/api/v1/clientes', controlador.obtenerClientes);
rutasApiClientes.get('/api/v1/clientes/:id', controlador.obtenerUnCliente);

export default rutasApiClientes;
