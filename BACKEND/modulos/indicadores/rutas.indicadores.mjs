import { Router } from 'express';
import controlador from './controlador.indicadores.mjs';
import { autenticarSesion, autorizarRoles } from '../auth/middleware.auth.mjs';

const rutasApiIndicadores = Router();

rutasApiIndicadores.get(
    '/api/v1/indicadores/financieros',
    autenticarSesion,
    autorizarRoles('admin', 'administrador'),
    controlador.obtenerFinancieros
);

export default rutasApiIndicadores;
