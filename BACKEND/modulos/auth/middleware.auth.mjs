import modelo from './modelo.auth.mjs';

function extraerBearerToken(req) {
	const header = String(req.headers.authorization || '');
	return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

export async function autenticarSesion(req, res, next) {
	try {
		const token = extraerBearerToken(req);
		if (!token) {
			return res.status(401).json({ mensaje: 'Falta el token de autenticación.' });
		}

		const usuario = await modelo.obtenerUsuarioDesdeToken(token);
		req.auth = usuario;
		req.headers['x-user-role'] = usuario.rol;
		req.headers['x-user-id'] = String(usuario.id);
		next();
	} catch (error) {
		return res.status(401).json({ mensaje: 'Sesión inválida.', detalle: error.message });
	}
}

export function autorizarRoles(...rolesPermitidos) {
	return (req, res, next) => {
		const rol = req.auth?.rol;
		if (!rol || !rolesPermitidos.includes(rol)) {
			return res.status(403).json({ mensaje: 'No tenés permisos para realizar esta acción.' });
		}
		next();
	};
}
