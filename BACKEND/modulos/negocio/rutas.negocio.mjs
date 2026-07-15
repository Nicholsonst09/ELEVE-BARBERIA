import { Router } from 'express';
import multer from 'multer';
import controlador from './controlador.negocio.mjs';
import { autenticarSesion } from '../auth/middleware.auth.mjs';

const rutasApiNegocio = Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }
});

rutasApiNegocio.get('/api/v1/negocio/publico', controlador.obtenerConfigPublicaNegocio);
rutasApiNegocio.get('/api/v1/negocio/config', autenticarSesion, controlador.obtenerConfigNegocio);
rutasApiNegocio.put('/api/v1/negocio/config', autenticarSesion, controlador.actualizarConfigNegocio);
rutasApiNegocio.post('/api/v1/negocio/horarios/conflictos', autenticarSesion, controlador.verificarConflictosHorarios);
rutasApiNegocio.post('/api/v1/negocio/imagen/upload', autenticarSesion, upload.single('imagen'), controlador.subirImagenNegocio);

export default rutasApiNegocio;
