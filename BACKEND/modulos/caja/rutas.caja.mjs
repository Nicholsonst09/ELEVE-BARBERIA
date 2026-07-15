import { Router } from 'express';
import controlador from './controlador.caja.mjs';
import { autenticarSesion } from '../auth/middleware.auth.mjs';

const rutasApiCaja = Router();

rutasApiCaja.get('/api/v1/caja/ventas', autenticarSesion, controlador.obtenerVentas);
rutasApiCaja.get('/api/v1/caja/ventas/:id', autenticarSesion, controlador.obtenerVentaPorId);
rutasApiCaja.post('/api/v1/caja/ventas', autenticarSesion, controlador.crearVenta);
rutasApiCaja.patch('/api/v1/caja/ventas/:id/anular', autenticarSesion, controlador.anularVenta);
rutasApiCaja.patch('/api/v1/caja/ventas/:id/reactivar', autenticarSesion, controlador.reactivarVenta);

export default rutasApiCaja;
