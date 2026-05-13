import modeloUsuario from './modelo.usuario.mjs';
import { generarToken } from '../auth/middleware.auth.mjs';

// POST /api/v1/auth/login (público)
async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ mensaje: 'Email y contraseña son requeridos' });
    }

    try {
        const usuario = await modeloUsuario.buscarPorEmail(email);

        if (!usuario || !usuario.activo) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas' });
        }

        const passwordOk = await modeloUsuario.verificarPassword(password, usuario.password_hash);
        if (!passwordOk) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas' });
        }

        await modeloUsuario.actualizarUltimoLogin(usuario.id);

        const token = generarToken(usuario);
        return res.status(200).json({
            token,
            usuario: {
                id:     usuario.id,
                nombre: usuario.nombre,
                email:  usuario.email,
                rol:    usuario.rol,
            },
        });
    } catch (error) {
        console.error('Error en controlador.login:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor al iniciar sesión' });
    }
}

// GET /api/v1/usuarios (solo administrador)
async function listarUsuarios(req, res) {
    try {
        const usuarios = await modeloUsuario.obtenerUsuarios();
        res.status(200).json(usuarios);
    } catch (error) {
        console.error('Error en controlador.listarUsuarios:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor al obtener usuarios', detalle: error.message });
    }
}

// GET /api/v1/usuarios/:id (solo administrador)
async function obtenerUnUsuario(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ mensaje: 'ID de usuario inválido. Debe ser un número.' });
    }

    try {
        const usuario = await modeloUsuario.obtenerUnUsuario(id);
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }
        res.status(200).json(usuario);
    } catch (error) {
        console.error(`Error en controlador.obtenerUnUsuario (ID: ${id}):`, error);
        res.status(500).json({ mensaje: 'Error interno del servidor al obtener el usuario.', detalle: error.message });
    }
}

// POST /api/v1/usuarios (solo administrador)
async function agregarUsuario(req, res) {
    const { email, password, nombre, rol, empleado_id } = req.body;

    if (!email || !password || !nombre || !rol) {
        return res.status(400).json({ mensaje: 'Los campos email, password, nombre y rol son obligatorios.' });
    }
    if (!['administrador', 'empleado'].includes(rol)) {
        return res.status(400).json({ mensaje: 'El rol debe ser "administrador" o "empleado".' });
    }

    try {
        const nuevo = await modeloUsuario.crearUsuario({ email, password, nombre, rol, empleado_id });
        res.status(201).json(nuevo);
    } catch (error) {
        console.error('Error en controlador.agregarUsuario:', error);
        // Código 23505 = violación de UNIQUE en PostgreSQL (email duplicado)
        if (error.code === '23505') {
            return res.status(409).json({ mensaje: 'El email ingresado ya está registrado.' });
        }
        res.status(500).json({ mensaje: 'Error al crear usuario.', detalle: error.message });
    }
}

// PUT /api/v1/usuarios/:id (solo administrador)
async function editarUsuario(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ mensaje: 'ID de usuario inválido. Debe ser un número.' });
    }

    try {
        const actualizado = await modeloUsuario.modificarUsuario(id, req.body);
        res.status(200).json(actualizado);
    } catch (error) {
        console.error(`Error en controlador.editarUsuario (ID: ${id}):`, error);
        if (error.code === '23505') {
            return res.status(409).json({ mensaje: 'El email ingresado ya está registrado.' });
        }
        res.status(500).json({ mensaje: 'Error al modificar usuario.', detalle: error.message });
    }
}

// DELETE /api/v1/usuarios/:id (solo administrador)
async function borrarUsuario(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ mensaje: 'ID de usuario inválido. Debe ser un número.' });
    }

    // Un admin no puede desactivarse a sí mismo
    if (id === req.usuario.id) {
        return res.status(400).json({ mensaje: 'No podés desactivar tu propia cuenta.' });
    }

    try {
        await modeloUsuario.eliminarUsuario(id);
        res.status(200).json({ mensaje: 'Usuario desactivado correctamente.' });
    } catch (error) {
        console.error(`Error en controlador.borrarUsuario (ID: ${id}):`, error);
        res.status(500).json({ mensaje: 'Error al desactivar usuario.', detalle: error.message });
    }
}

export default {
    login,
    listarUsuarios,
    obtenerUnUsuario,
    agregarUsuario,
    editarUsuario,
    borrarUsuario,
};
