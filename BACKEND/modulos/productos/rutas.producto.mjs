import { Router } from 'express';
import multer from 'multer';
import controlador from './controlador.producto.mjs';
import { autenticarSesion } from '../auth/middleware.auth.mjs';

const rutasApiProductos = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

rutasApiProductos.get('/api/v1/productos', autenticarSesion, controlador.obtenerProductos);
rutasApiProductos.post('/api/v1/productos/imagen/upload', autenticarSesion, upload.single('imagen'), controlador.subirImagenProducto);
rutasApiProductos.post('/api/v1/productos', autenticarSesion, controlador.crearProducto);
rutasApiProductos.put('/api/v1/productos/:id', autenticarSesion, controlador.actualizarProducto);
rutasApiProductos.delete('/api/v1/productos/:id', autenticarSesion, controlador.eliminarProducto);

export default rutasApiProductos;
