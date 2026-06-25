import { supabaseAdmin } from "../../db/supabaseClient.mjs";

// Selector base que incluye el join con estado_empleado
const SELECT_EMPLEADO_BASE = `
    id,
    nombre,
    especialidades,
    horarios_disponibles,
    avatar_url,
    estado_id,
    creado,
    modificado,
    estado_empleado!estado_id(codigo, nombre)
`;

//Función para obtener todos los empleados
async function obtenerEmpleados() {
    try{
        const {data: empleados, error} = await supabaseAdmin
        .from('empleados')
            .select(SELECT_EMPLEADO_BASE)
            .order('nombre', { ascending: true });

        if (error) throw error;

        return empleados.map(({ estado_empleado, ...e }) => ({
            ...e,
            activo: estado_empleado?.codigo === 'activo',
            estado: estado_empleado?.codigo || null
        }));
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
            .select(SELECT_EMPLEADO_BASE)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        const { estado_empleado, ...resto } = empleado;
        return {
            ...resto,
            activo: estado_empleado?.codigo === 'activo',
            estado: estado_empleado?.codigo || null
        };
    } catch (error) {
        console.error(`Error al obtener empleado con ID ${id}:`, error.message);
        throw error;
    }
}

export default{
    obtenerEmpleados,
    obtenerUnEmpleado
}