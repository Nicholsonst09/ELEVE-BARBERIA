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

//Funcion para buscar cliente existente o crearlo en su defecto
async function buscarOCrearCliente(nombre, telefono) {
    try {
        let { data: cliente, error: errorBusqueda } = await supabaseAdmin
            .from('clientes')
            .select('id')
            .eq('telefono', telefono)
            .single();

        if (errorBusqueda && errorBusqueda.code !== 'PGRST116') { // PGRST116 es "no rows found"
            throw errorBusqueda;
        }

        if (cliente) {
            return cliente.id;
        }

        
        const nuevoClienteData = {
            nombre: nombre,
            telefono: telefono,
        };

        const clienteNuevo = await crearCliente(nuevoClienteData); 

        return clienteNuevo.id; 

    } catch (error) {
        console.error("Error en modelo.buscarOCrearCliente:", error); 
        throw error;
    }
}

//funcion para crear cliente
async function crearCliente(nuevoCliente) {
    try {
        const { data, error } = await supabaseAdmin
            .from('clientes')
            .insert([nuevoCliente])
            .select()
            .single();

        if (error) {
            console.error("Error al crear cliente en Supabase:", error);
            throw new Error(`Error al crear cliente: ${error.message}`);
        }
        return data; // Devuelve el objeto del cliente recién creado
    } catch (error) {
        console.error("Error en modelo.crearCliente:", error);
        throw error;
    }
}


export default {
    obtenerClientes,
    obtenerUnCliente,
    buscarOCrearCliente,
    crearCliente    
};