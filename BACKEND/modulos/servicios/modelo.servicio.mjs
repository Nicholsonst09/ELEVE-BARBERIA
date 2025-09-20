import { supabaseAdmin } from "../../db/supabaseClient.mjs";

// Función para obtener todos los servicios
async function obtenerServicios() {
    try {
        const { data: servicios, error } = await supabaseAdmin
            .from('servicios')
            .select(`
                id,
                nombre,
                precio,
                duracion_min,
                descripcion,
                activo,
                creado,
                modificado
                `)
            .order('nombre', { ascending: true });

        if (error) {
            throw error;
        }
        return servicios;
    } catch (error) {
        console.error("Error al obtener servicios:", error.message);
        throw error;
    }
}

//Funcion para buscar empleados por id del servicio
//(Ver si es necesario traer especialidades y horarios)
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
                    activo
                )
            `)
            .eq('servicio_id', servicio_id)
            .eq('empleados.activo', true);  //Para traer solo los barberos activos

        if (error) {
            throw error;
        }

        const arrayEmpleados = empleados.map(empleado =>({
            id: empleado.empleados.id,
            nombre: empleado.empleados.nombre,
            especialidades: empleado.empleados.especialidades,
            horarios_disponibles: empleado.empleados.horarios_disponibles
        }));

        return arrayEmpleados;

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