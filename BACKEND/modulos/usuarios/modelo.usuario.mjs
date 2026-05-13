import { supabaseAdmin } from '../../db/supabaseClient.mjs';
import bcrypt from 'bcryptjs';

async function buscarPorEmail(email) {
    try {
        const { data: usuario, error } = await supabaseAdmin
            .from('usuarios')
            .select('id, email, password_hash, nombre, rol, activo')
            .eq('email', email)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // sin resultados
            throw error;
        }
        return usuario;
    } catch (error) {
        console.error('Error en modelo.buscarPorEmail:', error.message);
        throw error;
    }
}

async function verificarPassword(passwordPlano, hash) {
    return bcrypt.compare(passwordPlano, hash);
}

async function actualizarUltimoLogin(id) {
    try {
        const { error } = await supabaseAdmin
            .from('usuarios')
            .update({ ultimo_login: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        // No bloquear el login si falla este update
        console.error('Error al actualizar ultimo_login:', error.message);
    }
}

async function obtenerUsuarios() {
    try {
        const { data: usuarios, error } = await supabaseAdmin
            .from('usuarios')
            .select('id, email, nombre, rol, activo, empleado_id, creado, ultimo_login')
            .order('creado', { ascending: false });

        if (error) throw error;
        return usuarios;
    } catch (error) {
        console.error('Error en modelo.obtenerUsuarios:', error.message);
        throw error;
    }
}

async function obtenerUnUsuario(id) {
    try {
        const { data: usuario, error } = await supabaseAdmin
            .from('usuarios')
            .select('id, email, nombre, rol, activo, empleado_id, creado, ultimo_login')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return usuario;
    } catch (error) {
        console.error(`Error en modelo.obtenerUnUsuario (ID: ${id}):`, error.message);
        throw error;
    }
}

async function crearUsuario({ email, password, nombre, rol, empleado_id }) {
    try {
        const password_hash = await bcrypt.hash(password, 12);
        const { data, error } = await supabaseAdmin
            .from('usuarios')
            .insert([{ email, password_hash, nombre, rol, empleado_id: empleado_id || null }])
            .select('id, email, nombre, rol, activo')
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error en modelo.crearUsuario:', error.message);
        throw error;
    }
}

async function modificarUsuario(id, datos) {
    try {
        const campos = { ...datos };

        if (campos.password) {
            campos.password_hash = await bcrypt.hash(campos.password, 12);
            delete campos.password;
        }

        // Nunca permitir modificar estos campos por esta vía
        delete campos.id;
        delete campos.creado;

        const { data, error } = await supabaseAdmin
            .from('usuarios')
            .update(campos)
            .eq('id', id)
            .select('id, email, nombre, rol, activo')
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error en modelo.modificarUsuario (ID: ${id}):`, error.message);
        throw error;
    }
}

async function eliminarUsuario(id) {
    try {
        // Soft delete: inactivo en vez de borrar físicamente
        const { error } = await supabaseAdmin
            .from('usuarios')
            .update({ activo: false })
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`Error en modelo.eliminarUsuario (ID: ${id}):`, error.message);
        throw error;
    }
}

export default {
    buscarPorEmail,
    verificarPassword,
    actualizarUltimoLogin,
    obtenerUsuarios,
    obtenerUnUsuario,
    crearUsuario,
    modificarUsuario,
    eliminarUsuario,
};
