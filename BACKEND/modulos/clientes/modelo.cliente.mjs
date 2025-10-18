
import { supabaseAdmin } from "../../db/supabaseClient.mjs";



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
        // Renombrado de error para coincidir con tu función original
        console.error("Error en modelo.buscarOCrearCliente:", error); 
        throw error;
    }
}


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
    buscarOCrearCliente,
    crearCliente,
    // Puedes añadir aquí otras funciones CRUD (obtener, modificar, eliminar)
};