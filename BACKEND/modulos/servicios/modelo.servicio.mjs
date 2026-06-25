import { supabaseAdmin } from "../../db/supabaseClient.mjs";

// Selector base que incluye el join con estado_servicio
const SELECT_SERVICIO_BASE = `
    id,
    nombre,
    precio,
    duracion_min,
    descripcion,
    estado_id,
    creado,
    modificado,
    estado_servicio!estado_id(codigo, nombre)
`;

const SELECT_SERVICIO_DETALLE = `
    ${SELECT_SERVICIO_BASE},
    empleados_servicios(
        empleado_id,
        empleados(
            id,
            nombre,
            estado_id,
            estado_empleado!estado_id(codigo)
        )
    )
`;

function mapearServicio(servicio = {}) {
    const { estado_servicio, empleados_servicios = [], ...resto } = servicio;
    const empleadosActivos = empleados_servicios
        .filter(rel => rel.empleados?.estado_empleado?.codigo === 'activo')
        .map(rel => ({
            id: rel.empleados.id,
            nombre: rel.empleados.nombre
        }));

    return {
        ...resto,
        estado: estado_servicio?.codigo || null,
        activo: estado_servicio?.codigo === 'activo',
        empleado_ids: empleadosActivos.map(empleado => empleado.id),
        empleados_asignados: empleadosActivos
    };
}

async function obtenerEstadoServicioId(codigo = 'activo') {
    const { data, error } = await supabaseAdmin
        .from('estado_servicio')
        .select('id')
        .eq('codigo', codigo)
        .single();

    if (error) throw error;
    return data.id;
}

async function obtenerEstadoBajaServicioId() {
    const codigosPreferidos = ['inactivo', 'anulado'];

    for (const codigo of codigosPreferidos) {
        const { data, error } = await supabaseAdmin
            .from('estado_servicio')
            .select('id')
            .eq('codigo', codigo)
            .maybeSingle();

        if (error) throw error;
        if (data?.id) return data.id;
    }

    throw new Error("No existe un estado de baja para servicios. Se esperaba 'inactivo' o 'anulado'.");
}

async function sincronizarEmpleadosServicio(servicioId, empleadoIds = []) {
    const idsNormalizados = [...new Set((empleadoIds || []).map(id => Number(id)).filter(Boolean))];

    const { error: errorDelete } = await supabaseAdmin
        .from('empleados_servicios')
        .delete()
        .eq('servicio_id', servicioId);

    if (errorDelete) throw errorDelete;

    if (!idsNormalizados.length) return;

    const payload = idsNormalizados.map(empleadoId => ({
        empleado_id: empleadoId,
        servicio_id: servicioId
    }));

    const { error: errorInsert } = await supabaseAdmin
        .from('empleados_servicios')
        .insert(payload);

    if (errorInsert) throw errorInsert;
}

// Función para obtener todos los servicios activos
async function obtenerServicios() {
    try {
        const { data: servicios, error } = await supabaseAdmin
            .from('servicios')
            .select(SELECT_SERVICIO_DETALLE)
            .order('nombre', { ascending: true });

        if (error) throw error;

        return (servicios || [])
            .filter(s => !['inactivo', 'anulado'].includes(s.estado_servicio?.codigo))
            .map(mapearServicio);
    } catch (error) {
        console.error("Error al obtener servicios:", error.message);
        throw error;
    }
}

//Funcion para buscar empleados por id del servicio
async function buscarEmpleadosPorServicio(servicio_id){
    try {
        const {data: empleados, error} = await supabaseAdmin
        .from('empleados_servicios')
        .select(`   
                empleado_id,
                empleados(
                    id,
                    nombre,
                    especialidades,
                    horarios_disponibles,
                    estado_id,
                    estado_empleado!estado_id(codigo)
                )
            `)
            .eq('servicio_id', servicio_id);

        if (error) throw error;

        // Solo empleados activos, sin exponer estado_empleado
        return empleados
            .filter(e => e.empleados?.estado_empleado?.codigo === 'activo')
            .map(e => ({
                id: e.empleados.id,
                nombre: e.empleados.nombre,
                especialidades: e.empleados.especialidades,
                horarios_disponibles: e.empleados.horarios_disponibles
            }));

    }catch (error) {
        console.error("Error al buscar empleados por servicio:", error.message);
        throw error;
    }
}

//FUNCION PARA TRAER SERVICIO POR ID
async function obtenerServicioPorId(servicio_id) {
    try {
        const { data, error } = await supabaseAdmin
            .from('servicios')
            .select(SELECT_SERVICIO_DETALLE)
            .eq('id', servicio_id)
            .single();

        if (error) {
            throw error;
        }

        return mapearServicio(data);
    }catch(error){
        console.error(`Error al buscar servicio con ID ${servicio_id}:`, error.message);
        throw error;
    }
}

async function crearServicio(nuevoServicio) {
    try {
        const estadoActivoId = await obtenerEstadoServicioId();
        const payload = {
            nombre: nuevoServicio.nombre,
            precio: nuevoServicio.precio,
            duracion_min: nuevoServicio.duracion_min,
            descripcion: nuevoServicio.descripcion || null,
            estado_id: nuevoServicio.estado_id || estadoActivoId,
            modificado: new Date().toISOString()
        };

        const { data, error } = await supabaseAdmin
            .from('servicios')
            .insert([payload])
            .select(SELECT_SERVICIO_DETALLE)
            .single();

        if (error) throw error;

        await sincronizarEmpleadosServicio(data.id, nuevoServicio.empleado_ids || []);
        return await obtenerServicioPorId(data.id);
    } catch (error) {
        console.error('Error al crear servicio:', error.message);
        throw error;
    }
}

async function actualizarServicio(id, datos) {
    try {
        const payload = {
            nombre: datos.nombre,
            precio: datos.precio,
            duracion_min: datos.duracion_min,
            descripcion: datos.descripcion || null,
            modificado: new Date().toISOString()
        };

        if (datos.estado_id) payload.estado_id = datos.estado_id;

        const { error } = await supabaseAdmin
            .from('servicios')
            .update(payload)
            .eq('id', id);

        if (error) throw error;

        await sincronizarEmpleadosServicio(id, datos.empleado_ids || []);
        return await obtenerServicioPorId(id);
    } catch (error) {
        console.error(`Error al actualizar servicio con ID ${id}:`, error.message);
        throw error;
    }
}

async function eliminarServicio(id) {
    try {
        const estadoBajaId = await obtenerEstadoBajaServicioId();

        const { error } = await supabaseAdmin
            .from('servicios')
            .update({
                estado_id: estadoBajaId,
                modificado: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`Error al dar de baja servicio con ID ${id}:`, error.message);
        throw error;
    }
}

export default {
    obtenerServicios,
    buscarEmpleadosPorServicio,
    obtenerServicioPorId,
    crearServicio,
    actualizarServicio,
    eliminarServicio
};