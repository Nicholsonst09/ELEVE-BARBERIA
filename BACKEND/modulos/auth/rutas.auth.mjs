import { Router } from 'express';
import controlador from './controlador.auth.mjs';
import { autenticarSesion, autorizarRoles } from './middleware.auth.mjs';
import { limitadorRecuperarPassword } from '../../middleware/rateLimiter.mjs';

const rutasAuth = Router();

rutasAuth.post('/api/v1/auth/bootstrap-admin', controlador.bootstrapAdmin);
rutasAuth.post('/api/v1/auth/login', controlador.login);
rutasAuth.post('/api/v1/auth/recover', limitadorRecuperarPassword, controlador.recover);
rutasAuth.post('/api/v1/auth/reset-password', controlador.resetPassword);
rutasAuth.post('/api/v1/auth/change-password', autenticarSesion, controlador.changePassword);
rutasAuth.get('/api/v1/auth/me', autenticarSesion, controlador.me);

rutasAuth.get('/api/v1/usuarios', autenticarSesion, autorizarRoles('admin', 'administrador'), controlador.listarUsuarios);
rutasAuth.post('/api/v1/usuarios', autenticarSesion, autorizarRoles('admin', 'administrador'), controlador.crearUsuario);
rutasAuth.put('/api/v1/usuarios/:id', autenticarSesion, autorizarRoles('admin', 'administrador'), controlador.actualizarUsuario);
rutasAuth.delete('/api/v1/usuarios/:id', autenticarSesion, autorizarRoles('admin', 'administrador'), controlador.eliminarUsuario);

export default rutasAuth;
