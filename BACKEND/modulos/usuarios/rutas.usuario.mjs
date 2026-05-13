import { Router } from 'express';
import controlador from './controlador.usuario.mjs';
import { verificarToken, soloAdmin } from '../auth/middleware.auth.mjs';

const rutasApiUsuario = Router();

// Ruta pública — no requiere token
rutasApiUsuario.post('/api/v1/auth/login', controlador.login);

// Rutas protegidas — requieren token válido + rol administrador
rutasApiUsuario.get   ('/api/v1/usuarios',     verificarToken, soloAdmin, controlador.listarUsuarios);
rutasApiUsuario.get   ('/api/v1/usuarios/:id', verificarToken, soloAdmin, controlador.obtenerUnUsuario);
rutasApiUsuario.post  ('/api/v1/usuarios',     verificarToken, soloAdmin, controlador.agregarUsuario);
rutasApiUsuario.put   ('/api/v1/usuarios/:id', verificarToken, soloAdmin, controlador.editarUsuario);
rutasApiUsuario.delete('/api/v1/usuarios/:id', verificarToken, soloAdmin, controlador.borrarUsuario);

export default rutasApiUsuario;
