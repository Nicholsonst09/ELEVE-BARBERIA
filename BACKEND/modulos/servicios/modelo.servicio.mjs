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

// Función para obtener todos los servicios activos
async function obtenerServicios() {
    try {
        const { data: servicios, error } = await supabaseAdmin
            .from('servicios')
            .select(SELECT_SERVICIO_BASE)
            .order('nombre', { ascending: true });

        if (error) throw error;

        // Filtrar activos y mapear el estado para compatibilidad
        return servicios
            .filter(s => s.estado_servicio?.codigo === 'activo')
            .map(({ estado_servicio, ...s }) => ({
                ...s,
                estado: estado_servicio?.codigo || null
            }));
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
            .select('nombre, duracion_min, precio')
            .eq('id', servicio_id)
            .single();

        if (error) {
            throw error;
        }

        return data;
    }catch(error){
        console.error(`Error al buscar servicio con ID ${servicio_id}:`, error.message);
        throw error;
    }
}

/* //FUNCION PARA TRAER EL SERVICIO POR NOMBRE
async function obtenerServicioPorNombre(nombreServicio) {
    try {
        const { data: servicio, error } = await supabaseAdmin
            .from('servicios')
            .select('id, nombre, precio, duracion_min')
            .eq('nombre', nombreServicio)
            .eq('activo', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }
        return servicio;
    } catch (error) {
        console.error(`Error al buscar servicio ${nombreServicio}:`, error.message);
        throw error;
    }
} */

//Faltaria agregar, modificar y eliminar

export default {
    obtenerServicios,
    buscarEmpleadosPorServicio,
    obtenerServicioPorId
};