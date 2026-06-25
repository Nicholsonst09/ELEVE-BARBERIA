import { supabaseAdmin } from "../../db/supabaseClient.mjs";

// Selector base que incluye el join con estado_empleado
const SELECT_EMPLEADO_BASE = `
    id,
    nombre,
    email,
    especialidades,
    horarios_disponibles,
    avatar_url,
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

async function obtenerEstadoBajaEmpleadoId() {
    const codigosPreferidos = ['inactivo', 'anulado'];

    for (const codigo of codigosPreferidos) {
        const { data, error } = await supabaseAdmin
            .from('estado_empleado')
            .select('id')
            .eq('codigo', codigo)
            .maybeSingle();

        if (error) throw error;
        if (data?.id) return data.id;
    }

    throw new Error("No existe un estado de baja para empleados. Se esperaba 'inactivo' o 'anulado'.");
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
            .filter(empleado => !['inactivo', 'anulado'].includes(empleado.estado_empleado?.codigo))
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

async function crearEmpleado(nuevoEmpleado) {
    try {
        const estadoActivoId = await obtenerEstadoEmpleadoId();
        const payload = {
            nombre: nuevoEmpleado.nombre,
            email: nuevoEmpleado.email || null,
            especialidades: nuevoEmpleado.especialidades || null,
            horarios_disponibles: nuevoEmpleado.horarios_disponibles || null,
            avatar_url: nuevoEmpleado.avatar_url || null,
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
        const payload = {
            nombre: datos.nombre,
            email: datos.email || null,
            especialidades: datos.especialidades || null,
            horarios_disponibles: datos.horarios_disponibles || null,
            avatar_url: datos.avatar_url || null,
            modificado: new Date().toISOString()
        };

        if (datos.estado_id) payload.estado_id = datos.estado_id;

        const { error } = await supabaseAdmin
            .from('empleados')
            .update(payload)
            .eq('id', id);

        if (error) throw error;

        await sincronizarServiciosEmpleado(id, datos.servicio_ids || []);
        return await obtenerUnEmpleado(id);
    } catch (error) {
        console.error(`Error al actualizar empleado con ID ${id}:`, error.message);
        throw error;
    }
}

async function eliminarEmpleado(id) {
    try {
        const estadoBajaId = await obtenerEstadoBajaEmpleadoId();

        const { error } = await supabaseAdmin
            .from('empleados')
            .update({
                estado_id: estadoBajaId,
                modificado: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`Error al dar de baja empleado con ID ${id}:`, error.message);
        throw error;
    }
}

export default{
    obtenerEmpleados,
    obtenerUnEmpleado,
    crearEmpleado,
    actualizarEmpleado,
    eliminarEmpleado
}