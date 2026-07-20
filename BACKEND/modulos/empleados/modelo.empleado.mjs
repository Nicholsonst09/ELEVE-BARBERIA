import { supabaseAdmin } from "../../db/supabaseClient.mjs";
import { eliminarImagenStorage } from "../../config/imagen.mjs";

// Selector base que incluye el join con estado_empleado
const SELECT_EMPLEADO_BASE = `
    id,
    nombre,
    email,
    especialidades,
    horarios_disponibles,
    avatar_url,
    comision_pct,
    estado_id,
    creado,
    modificado,
    estado_empleado!estado_id(codigo, nombre)
`;

const SELECT_EMPLEADO_DETALLE = `
    ${SELECT_EMPLEADO_BASE},
    empleados_servicios(
        servicio_id,
        servicios(
            id,
            nombre,
            estado_id,
            estado_servicio!estado_id(codigo)
        )
    )
`;

function mapearEmpleado(empleado = {}) {
    const { estado_empleado, empleados_servicios = [], ...resto } = empleado;
    const serviciosActivos = empleados_servicios
        .filter(rel => rel.servicios?.estado_servicio?.codigo === 'activo')
        .map(rel => ({
            id: rel.servicios.id,
            nombre: rel.servicios.nombre
        }));

    return {
        ...resto,
        activo: estado_empleado?.codigo === 'activo',
        estado: estado_empleado?.codigo || null,
        servicio_ids: serviciosActivos.map(servicio => servicio.id),
        servicios_asignados: serviciosActivos
    };
}

async function obtenerEstadoEmpleadoId(codigo = 'activo') {
    const { data, error } = await supabaseAdmin
        .from('estado_empleado')
        .select('id')
        .eq('codigo', codigo)
        .single();

    if (error) throw error;
    return data.id;
}

async function cambiarEstadoEmpleado(id, codigo) {
    try {
        const estadoId = await obtenerEstadoEmpleadoId(codigo);

        const { error } = await supabaseAdmin
            .from('empleados')
            .update({
                estado_id: estadoId,
                modificado: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        return await obtenerUnEmpleado(id);
    } catch (error) {
        console.error(`Error al cambiar estado del empleado con ID ${id}:`, error.message);
        throw error;
    }
}

// Un empleado se considera duplicado cuando otro (no anulado) tiene el
// mismo nombre, sin importar el email: dos personas no pueden compartir
// el mismo nombre visible en el sistema (hay que diferenciarlas con
// apellido u otra referencia). Los anulados quedan afuera a propósito:
// si diste de baja a alguien, tiene que poder volver a cargarse con los
// mismos datos sin chocar contra "ya existe".
async function buscarEmpleadoDuplicado({ nombre, excluirId = null }) {
    const nombreNorm = String(nombre || '').trim();
    if (!nombreNorm) return null;

    const { data, error } = await supabaseAdmin
        .from('empleados')
        .select('id, nombre, estado_empleado!estado_id(codigo)')
        .ilike('nombre', nombreNorm);

    if (error) throw error;

    return (data || []).find((fila) =>
        fila.estado_empleado?.codigo !== 'anulado' &&
        (excluirId === null || Number(fila.id) !== Number(excluirId))
    ) || null;
}

// Chequeo independiente del de nombre: dos empleados (no anulados) tampoco
// pueden compartir email. El email es opcional, así que si no se manda no
// hay nada que validar (varios empleados sin email no son "duplicados").
async function buscarEmpleadoPorEmailDuplicado({ email, excluirId = null }) {
    const emailNorm = String(email || '').trim();
    if (!emailNorm) return null;

    const { data, error } = await supabaseAdmin
        .from('empleados')
        .select('id, email, estado_empleado!estado_id(codigo)')
        .ilike('email', emailNorm);

    if (error) throw error;

    return (data || []).find((fila) =>
        fila.estado_empleado?.codigo !== 'anulado' &&
        (excluirId === null || Number(fila.id) !== Number(excluirId))
    ) || null;
}

async function sincronizarServiciosEmpleado(empleadoId, servicioIds = []) {
    const idsNormalizados = [...new Set((servicioIds || []).map(id => Number(id)).filter(Boolean))];

    const { error: errorDelete } = await supabaseAdmin
        .from('empleados_servicios')
        .delete()
        .eq('empleado_id', empleadoId);

    if (errorDelete) throw errorDelete;

    if (!idsNormalizados.length) return;

    const payload = idsNormalizados.map(servicioId => ({
        empleado_id: empleadoId,
        servicio_id: servicioId
    }));

    const { error: errorInsert } = await supabaseAdmin
        .from('empleados_servicios')
        .insert(payload);

    if (errorInsert) throw errorInsert;
}

//Función para obtener todos los empleados
async function obtenerEmpleados() {
    try{
        const {data: empleados, error} = await supabaseAdmin
        .from('empleados')
            .select(SELECT_EMPLEADO_DETALLE)
            .order('nombre', { ascending: true });

        if (error) throw error;

        return (empleados || [])
            .filter(empleado => empleado.estado_empleado?.codigo !== 'anulado')
            .map(mapearEmpleado);
    }catch(error) {
        console.error("Error al obtener empleados:", error.message);
        throw error;
    }
}


//Función para obtener empleados por id
async function obtenerUnEmpleado(id) {
    try {
        const { data: empleado, error } = await supabaseAdmin
            .from('empleados')
            .select(SELECT_EMPLEADO_DETALLE)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        return mapearEmpleado(empleado);
    } catch (error) {
        console.error(`Error al obtener empleado con ID ${id}:`, error.message);
        throw error;
    }
}

// Cuenta empleados que ocupan cupo del plan: activos + inactivos, sin
// contar los anulados (dados de baja, ya no cuentan para el negocio).
async function contarEmpleados() {
    try {
        const anuladoId = await obtenerEstadoEmpleadoId('anulado');
        const { count, error } = await supabaseAdmin
            .from('empleados')
            .select('id', { count: 'exact', head: true })
            .neq('estado_id', anuladoId);

        if (error) throw error;
        return Number(count || 0);
    } catch (error) {
        console.error('Error al contar empleados:', error.message);
        throw error;
    }
}

async function crearEmpleado(nuevoEmpleado) {
    try {
        const estadoActivoId = await obtenerEstadoEmpleadoId();
        const payload = {
            nombre: nuevoEmpleado.nombre,
            email: nuevoEmpleado.email || null,
            especialidades: nuevoEmpleado.especialidades || null,
            horarios_disponibles: nuevoEmpleado.horarios_disponibles || null,
            avatar_url: nuevoEmpleado.avatar_url || null,
            comision_pct: Number.isFinite(Number(nuevoEmpleado.comision_pct)) ? Number(nuevoEmpleado.comision_pct) : 0,
            estado_id: nuevoEmpleado.estado_id || estadoActivoId,
            modificado: new Date().toISOString()
        };

        const { data, error } = await supabaseAdmin
            .from('empleados')
            .insert([payload])
            .select(SELECT_EMPLEADO_DETALLE)
            .single();

        if (error) throw error;

        await sincronizarServiciosEmpleado(data.id, nuevoEmpleado.servicio_ids || []);
        return await obtenerUnEmpleado(data.id);
    } catch (error) {
        console.error('Error al crear empleado:', error.message);
        throw error;
    }
}

async function actualizarEmpleado(id, datos) {
    try {
        const actual = await obtenerUnEmpleado(id);

        const payload = {
            nombre: datos.nombre,
            email: datos.email || null,
            especialidades: datos.especialidades || null,
            horarios_disponibles: datos.horarios_disponibles || null,
            avatar_url: datos.avatar_url || null,
            comision_pct: Number.isFinite(Number(datos.comision_pct)) ? Number(datos.comision_pct) : 0,
            modificado: new Date().toISOString()
        };

        if (datos.estado_id) payload.estado_id = datos.estado_id;

        const { error } = await supabaseAdmin
            .from('empleados')
            .update(payload)
            .eq('id', id);

        if (error) throw error;

        // El avatar viejo ya no tiene referencia en la BD una vez pisado por
        // el nuevo: se borra del storage para no acumular fotos huérfanas.
        if (actual?.avatar_url && actual.avatar_url !== payload.avatar_url) {
            await eliminarImagenStorage(actual.avatar_url);
        }

        await sincronizarServiciosEmpleado(id, datos.servicio_ids || []);
        return await obtenerUnEmpleado(id);
    } catch (error) {
        console.error(`Error al actualizar empleado con ID ${id}:`, error.message);
        throw error;
    }
}

async function eliminarEmpleado(id) {
    try {
        const estadoAnuladoId = await obtenerEstadoEmpleadoId('anulado');

        const { error } = await supabaseAdmin
            .from('empleados')
            .update({
                estado_id: estadoAnuladoId,
                modificado: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`Error al anular empleado con ID ${id}:`, error.message);
        throw error;
    }
}

export default{
    obtenerEmpleados,
    obtenerUnEmpleado,
    contarEmpleados,
    crearEmpleado,
    actualizarEmpleado,
    eliminarEmpleado,
    cambiarEstadoEmpleado,
    buscarEmpleadoDuplicado,
    buscarEmpleadoPorEmailDuplicado
}