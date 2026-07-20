import { createSupabaseAuthClient, supabaseAdmin, supabaseAuthClient } from '../../db/supabaseClient.mjs';

const SELECT_USUARIO_BASE = `
	id,
	auth_user_id,
	email,
	password_hash,
	nombre,
	rol,
	empleado_id,
	activo,
	creado,
	modificado,
	empleados(id, nombre, email, avatar_url)
`;

function mapearRolDbAApp(rol) {
	return rol === 'administrador' ? 'admin' : 'empleado';
}

function mapearRolAppADb(rol) {
	return rol === 'admin' || rol === 'administrador' ? 'administrador' : 'empleado';
}

function mapearUsuario(usuario = {}) {
	const { empleados, rol, ...resto } = usuario;
	return {
		...resto,
		tipo: mapearRolDbAApp(rol),
		rol: mapearRolDbAApp(rol),
		empleado: empleados || null,
	};
}

async function obtenerUsuarioPorId(id) {
	const { data, error } = await supabaseAdmin
		.from('usuarios')
		.select(SELECT_USUARIO_BASE)
		.eq('id', Number(id))
		.maybeSingle();

	if (error) throw error;
	return data ? mapearUsuario(data) : null;
}

async function obtenerUsuarioPorAuthUserId(authUserId) {
	const { data, error } = await supabaseAdmin
		.from('usuarios')
		.select(SELECT_USUARIO_BASE)
		.eq('auth_user_id', authUserId)
		.maybeSingle();

	if (error) throw error;
	return data ? mapearUsuario(data) : null;
}

async function obtenerUsuarioPorEmail(email) {
	const valor = String(email || '').trim().toLowerCase();
	if (!valor) return null;

	const { data, error } = await supabaseAdmin
		.from('usuarios')
		.select(SELECT_USUARIO_BASE)
		.eq('email', valor)
		.maybeSingle();

	if (error) throw error;
	return data ? mapearUsuario(data) : null;
}

async function listarUsuarios() {
	const { data, error } = await supabaseAdmin
		.from('usuarios')
		.select(SELECT_USUARIO_BASE)
		.eq('activo', true)
		.order('nombre', { ascending: true });

	if (error) throw error;
	return (data || []).map(mapearUsuario);
}

async function contarUsuarios() {
	const { count, error } = await supabaseAdmin
		.from('usuarios')
		.select('id', { count: 'exact', head: true });

	if (error) throw error;
	return Number(count || 0);
}

async function iniciarSesionConPassword(email, password) {
	const perfil = await obtenerUsuarioPorEmail(email);
	if (!perfil?.email) {
		throw new Error('Usuario o contraseña incorrectos.');
	}

	const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
		email: perfil.email,
		password,
	});

	if (error || !data?.user || !data?.session) {
		throw new Error('Usuario o contraseña incorrectos.');
	}

	const usuario = await obtenerUsuarioPorAuthUserId(data.user.id);
	if (!usuario?.activo) {
		throw new Error('El usuario no tiene acceso activo al sistema.');
	}

	await supabaseAdmin
		.from('usuarios')
		.update({ ultimo_login: new Date().toISOString(), modificado: new Date().toISOString() })
		.eq('id', usuario.id);

	return { usuario, session: data.session };
}

async function obtenerUsuarioDesdeToken(accessToken) {
	const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
	if (error || !data?.user?.id) {
		throw new Error('Sesión inválida o expirada.');
	}

	const usuario = await obtenerUsuarioPorAuthUserId(data.user.id);
	if (!usuario?.activo) {
		throw new Error('El usuario no tiene acceso activo al sistema.');
	}

	return usuario;
}

// Un empleado no puede tener dos usuarios del sistema activos al mismo
// tiempo. Los usuarios desactivados no cuentan: si le diste de baja el
// acceso a alguien, el empleado tiene que quedar libre para asignárselo a
// otro usuario nuevo.
async function validarEmpleadoSinUsuarioActivo(empleadoId, excluirUsuarioId = null) {
	const { data, error } = await supabaseAdmin
		.from('usuarios')
		.select('id')
		.eq('empleado_id', empleadoId)
		.eq('activo', true);

	if (error) throw error;

	const conflicto = (data || []).find((u) => excluirUsuarioId === null || Number(u.id) !== Number(excluirUsuarioId));
	if (conflicto) {
		throw new Error('Ese empleado ya tiene un usuario del sistema asignado.');
	}
}

// Reactiva una fila de usuario que había quedado desactivada (email UNIQUE
// impide insertar una fila nueva con el mismo email). Como desactivarUsuario
// borra el usuario de Supabase Auth, hay que recrearlo ahí antes de volver
// a vincularlo a la fila existente.
async function revivirUsuario(existente, { email, nombre, password, rol, empleadoId }) {
	const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { nombre },
	});

	if (authError || !authData?.user?.id) {
		throw authError || new Error('No se pudo crear el usuario en Supabase Auth.');
	}

	const { data, error } = await supabaseAdmin
		.from('usuarios')
		.update({
			auth_user_id: authData.user.id,
			nombre,
			rol,
			empleado_id: empleadoId,
			activo: true,
			modificado: new Date().toISOString(),
		})
		.eq('id', existente.id)
		.select(SELECT_USUARIO_BASE)
		.single();

	if (error) {
		await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
		throw error;
	}

	return mapearUsuario(data);
}

async function crearUsuario(payload) {
	const email = String(payload?.email || '').trim().toLowerCase();
	const nombre = String(payload?.nombre || '').trim();
	const password = String(payload?.password || '');
	const rol = mapearRolAppADb(payload?.tipo || payload?.rol);
	const empleadoId = payload?.empleado_id ? Number(payload.empleado_id) : null;

	if (!nombre || !email || !password) {
		throw new Error('nombre, email y password son obligatorios.');
	}

	const existente = await obtenerUsuarioPorEmail(email);
	if (existente?.activo) {
		throw new Error('Ya existe un usuario activo con ese email.');
	}

	if (empleadoId) {
		await validarEmpleadoSinUsuarioActivo(empleadoId);
	}

	// El email ya existía pero estaba dado de baja: se reactiva esa fila en
	// vez de insertar una nueva, porque el email es UNIQUE en la tabla.
	if (existente) {
		return revivirUsuario(existente, { email, nombre, password, rol, empleadoId });
	}

	const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { nombre },
	});

	if (authError || !authData?.user?.id) {
		throw authError || new Error('No se pudo crear el usuario en Supabase Auth.');
	}

	const { data, error } = await supabaseAdmin
		.from('usuarios')
		.insert([{
			auth_user_id: authData.user.id,
			email,
			password_hash: 'supabase-auth',
			nombre,
			rol,
			empleado_id: empleadoId,
			activo: true,
			modificado: new Date().toISOString(),
		}])
		.select(SELECT_USUARIO_BASE)
		.single();

	if (error) {
		await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
		throw error;
	}

	return mapearUsuario(data);
}

async function crearPrimerAdmin(payload) {
	const cantidad = await contarUsuarios();
	if (cantidad > 0) {
		throw new Error('Ya existe al menos un usuario en el sistema.');
	}

	return crearUsuario({
		...payload,
		tipo: 'admin',
		rol: 'admin',
	});
}

async function actualizarUsuario(id, payload) {
	const existente = await obtenerUsuarioPorId(id);
	if (!existente) throw new Error('Usuario no encontrado.');

	const email = String(payload?.email || existente.email || '').trim().toLowerCase();
	const nombre = String(payload?.nombre || existente.nombre || '').trim();
	const password = payload?.password ? String(payload.password) : '';
	const rol = mapearRolAppADb(payload?.tipo || payload?.rol || existente.rol);
	const empleadoId = payload?.empleado_id !== undefined
		? (payload.empleado_id ? Number(payload.empleado_id) : null)
		: existente.empleado_id;

	if (email !== existente.email) {
		const otro = await obtenerUsuarioPorEmail(email);
		if (otro && Number(otro.id) !== Number(id)) {
			throw new Error('Ya existe un usuario con ese email.');
		}
	}

	if (empleadoId && empleadoId !== existente.empleado_id) {
		await validarEmpleadoSinUsuarioActivo(empleadoId, id);
	}

	const authPayload = {};
	if (email && email !== existente.email) authPayload.email = email;
	if (password) authPayload.password = password;
	if (nombre && nombre !== existente.nombre) authPayload.user_metadata = { nombre };

	if (existente.auth_user_id && Object.keys(authPayload).length > 0) {
		const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(existente.auth_user_id, authPayload);
		if (authError) throw authError;
	}

	const { data, error } = await supabaseAdmin
		.from('usuarios')
		.update({
			email,
			nombre,
			rol,
			empleado_id: empleadoId,
			modificado: new Date().toISOString(),
		})
		.eq('id', Number(id))
		.select(SELECT_USUARIO_BASE)
		.single();

	if (error) throw error;
	return mapearUsuario(data);
}

async function desactivarUsuario(id) {
	const existente = await obtenerUsuarioPorId(id);
	if (!existente) throw new Error('Usuario no encontrado.');

	const { error } = await supabaseAdmin
		.from('usuarios')
		.update({ activo: false, modificado: new Date().toISOString() })
		.eq('id', Number(id));

	if (error) throw error;

	if (existente.auth_user_id) {
		await supabaseAdmin.auth.admin.deleteUser(existente.auth_user_id);
	}

	return true;
}

async function enviarRecuperacion(email) {
	const valor = String(email || '').trim().toLowerCase();
	if (!valor) throw new Error('Email requerido.');

	const redirectTo = process.env.SUPABASE_AUTH_REDIRECT_TO || undefined;
	const { error } = await supabaseAuthClient.auth.resetPasswordForEmail(valor, { redirectTo });
	if (error) throw error;
	return true;
}

async function restablecerPassword(payload) {
	const accessToken = String(payload?.access_token || payload?.accessToken || '').trim();
	const refreshToken = String(payload?.refresh_token || payload?.refreshToken || '').trim();
	const password = String(payload?.password || '');

	if (!accessToken || !refreshToken) {
		throw new Error('Tokens de recuperación inválidos.');
	}

	if (password.length < 8) {
		throw new Error('La contraseña debe tener al menos 8 caracteres.');
	}

	const authClient = createSupabaseAuthClient();
	const { error: sessionError } = await authClient.auth.setSession({
		access_token: accessToken,
		refresh_token: refreshToken,
	});

	if (sessionError) {
		throw new Error('El enlace de recuperación es inválido o expiró.');
	}

	const { error: updateError } = await authClient.auth.updateUser({ password });
	if (updateError) throw updateError;

	await authClient.auth.signOut();
	return true;
}

async function cambiarPasswordConActual(usuarioAutenticado, payload) {
	const userId = usuarioAutenticado?.auth_user_id;
	const email = String(usuarioAutenticado?.email || '').trim().toLowerCase();
	const passwordActual = String(payload?.password_actual || payload?.current_password || '').trim();
	const passwordNueva = String(payload?.password_nueva || payload?.new_password || '').trim();

	if (!userId || !email) {
		throw new Error('No se pudo identificar al usuario autenticado.');
	}

	if (!passwordActual || !passwordNueva) {
		throw new Error('password_actual y password_nueva son obligatorios.');
	}

	if (passwordNueva.length < 8) {
		throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
	}

	if (passwordActual === passwordNueva) {
		throw new Error('La nueva contraseña debe ser diferente a la actual.');
	}

	const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
		email,
		password: passwordActual,
	});

	if (error || !data?.user?.id) {
		throw new Error('La contraseña actual es incorrecta.');
	}

	const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
		password: passwordNueva,
	});

	if (updateError) throw updateError;

	await supabaseAdmin
		.from('usuarios')
		.update({ modificado: new Date().toISOString() })
		.eq('id', usuarioAutenticado.id);

	return true;
}

export default {
	listarUsuarios,
	crearUsuario,
	crearPrimerAdmin,
	actualizarUsuario,
	desactivarUsuario,
	iniciarSesionConPassword,
	obtenerUsuarioDesdeToken,
	enviarRecuperacion,
	restablecerPassword,
	cambiarPasswordConActual,
};
