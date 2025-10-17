import { supabaseAdmin } from "../../db/supabaseClient.mjs";

//Función para obtener todos los clientes
async function obtenerClientes() {
    try{
        const {data: clientes, error} = await supabaseAdmin
        .from('clientes')
            .select(`
                id,
                nombre,
                telefono,
                preferencias,
                creado,
                modificado
                `)
            .order('nombre', { ascending: true });

        if (error){
            throw error;
        }
        return clientes;
    }catch(error) {
        console.error("Error al obtener clientes:", error.message);
        throw error;
    }
}


//Función para obtener empleados por id
async function obtenerUnCliente(id) {
    try {
        const { data: cliente, error } = await supabaseAdmin
            .from('clientes')
            .select(`
                id,
                nombre,
                telefono,
                preferencias,
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
        return cliente;
    } catch (error) {
        console.error(`Error al obtener cliente con ID ${id}:`, error.message);
        throw error;
    }
}

export default{
    obtenerClientes,
    obtenerUnCliente
}