import modelo from './modelo.auth.mjs';

function serializarSesion(session) {
	return {
		access_token: session.access_token,
		refresh_token: session.refresh_token,
		expires_in: session.expires_in,
		expires_at: session.expires_at,
		token_type: session.token_type,
	};
}

async function login(req, res) {
	try {
		const email = req.body?.email || req.body?.identifier;
		const password = req.body?.password;
		if (!email || !password) {
			return res.status(400).json({ mensaje: 'email y password son obligatorios.' });
		}

		const { usuario, session } = await modelo.iniciarSesionConPassword(email, password);
		return res.status(200).json({ usuario, session: serializarSesion(session) });
	} catch (error) {
		return res.status(401).json({ mensaje: 'No se pudo iniciar sesión.', detalle: error.message });
	}
}

async function me(req, res) {
	return res.status(200).json({ usuario: req.auth });
}

async function recover(req, res) {
	try {
		await modelo.enviarRecuperacion(req.body?.email);
		return res.status(200).json({ mensaje: 'Si el email existe, se enviaron instrucciones para recuperar la contraseña.' });
	} catch (error) {
		return res.status(400).json({ mensaje: 'No se pudo iniciar la recuperación.', detalle: error.message });
	}
}

async function resetPassword(req, res) {
	try {
		await modelo.restablecerPassword(req.body || {});
		return res.status(200).json({ mensaje: 'Contraseña actualizada correctamente.' });
	} catch (error) {
		return res.status(400).json({ mensaje: 'No se pudo restablecer la contraseña.', detalle: error.message });
	}
}

async function changePassword(req, res) {
	try {
		await modelo.cambiarPasswordConActual(req.auth, req.body || {});
		return res.status(200).json({ mensaje: 'Contraseña cambiada correctamente.' });
	} catch (error) {
		return res.status(400).json({ mensaje: 'No se pudo cambiar la contraseña.', detalle: error.message });
	}
}

async function listarUsuarios(req, res) {
	try {
		const usuarios = await modelo.listarUsuarios();
		return res.status(200).json({ usuarios });
	} catch (error) {
		return res.status(500).json({ mensaje: 'No se pudieron obtener los usuarios.', detalle: error.message });
	}
}

function esErrorDeConflicto(mensaje = '') {
	return /ya existe|ya tiene un usuario/i.test(mensaje);
}

async function crearUsuario(req, res) {
	try {
		const usuario = await modelo.crearUsuario(req.body || {});
		return res.status(201).json(usuario);
	} catch (error) {
		const status = esErrorDeConflicto(error.message) ? 409 : 400;
		return res.status(status).json({ mensaje: 'No se pudo crear el usuario.', detalle: error.message });
	}
}

async function bootstrapAdmin(req, res) {
	try {
		const usuario = await modelo.crearPrimerAdmin(req.body || {});
		return res.status(201).json(usuario);
	} catch (error) {
		const status = /Ya existe/.test(error.message) ? 409 : 400;
		return res.status(status).json({ mensaje: 'No se pudo crear el administrador inicial.', detalle: error.message });
	}
}

async function actualizarUsuario(req, res) {
	try {
		const usuario = await modelo.actualizarUsuario(req.params.id, req.body || {});
		return res.status(200).json(usuario);
	} catch (error) {
		const status = esErrorDeConflicto(error.message) ? 409 : 400;
		return res.status(status).json({ mensaje: 'No se pudo actualizar el usuario.', detalle: error.message });
	}
}

async function eliminarUsuario(req, res) {
	try {
		await modelo.desactivarUsuario(req.params.id);
		return res.status(204).send();
	} catch (error) {
		return res.status(400).json({ mensaje: 'No se pudo desactivar el usuario.', detalle: error.message });
	}
}

export default {
	bootstrapAdmin,
	login,
	me,
	recover,
	resetPassword,
	changePassword,
	listarUsuarios,
	crearUsuario,
	actualizarUsuario,
	eliminarUsuario,
};
