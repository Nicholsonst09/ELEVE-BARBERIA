import { supabaseAdmin } from "../../db/supabaseClient.mjs";

//Función para obtener todos los empleados
async function obtenerEmpleados() {
    try{
        const {data: empleados, error} = await supabaseAdmin
        .from('empleados')
            .select(`
                id,
                nombre,
                especialidades,
                horarios_disponibles,
                activo,
                creado,
                modificado
                `)
            .order('nombre', { ascending: true });

        if (error){
            throw error;
        }
        return empleados;
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
            .select(`
                id,
                nombre,
                especialidades,
                horarios_disponibles,
                activo,
                creado,
                modificado
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }
        return empleado;
    } catch (error) {
        console.error(`Error al obtener empleado con ID ${id}:`, error.message);
        throw error;
    }
}

//funcion para agregar empleado
async function agregarEmpleado(nuevoEmpleado){
    try{
        const{
            nombre, 
            especialidades, 
            horarios_disponibles,
            activo
        } = nuevoEmpleado;

        const {data, error} = await supabaseAdmin
        .from('empleados')
        .insert([
            {
                nombre: nombre,
                especialidades: especialidades || null,
                horarios_disponibles: horarios_disponibles,
                activo: activo !== undefined ? activo : false
            }
        ])
        .select()
        .single();

        if (error) {
            console.error("Error al agregar empleado en Supabase:", error);
            throw new Error(`Error al agregar empleado: ${error.message}`);
        }

        return data;
    }catch(error) {
        console.error("Error en modelo.agregarEmpleado:", error);
        throw error;
    }
}



export default{
    obtenerEmpleados,
    obtenerUnEmpleado,
    agregarEmpleado
}