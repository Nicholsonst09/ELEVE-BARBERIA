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
// Busca primero por teléfono, luego por email. Si encuentra por cualquiera
// de los dos, actualiza el campo faltante. Si no encuentra, crea uno nuevo.
async function buscarOCrearCliente(nombre, telefono, email = null) {
    try {
        // 1. Buscar por teléfono
        let { data: clientePorTel, error: errTel } = await supabaseAdmin
            .from('clientes')
            .select('id, email')
            .eq('telefono', telefono)
            .single();

        if (errTel && errTel.code !== 'PGRST116') throw errTel;

        if (clientePorTel) {
            if (email && !clientePorTel.email) {
                await supabaseAdmin.from('clientes').update({ email }).eq('id', clientePorTel.id);
            }
            return clientePorTel.id;
        }

        // 2. Si no encontró por teléfono y tiene email, buscar por email
        if (email) {
            let { data: clientePorEmail, error: errEmail } = await supabaseAdmin
                .from('clientes')
                .select('id, telefono')
                .eq('email', email)
                .single();

            if (errEmail && errEmail.code !== 'PGRST116') throw errEmail;

            if (clientePorEmail) {
                // Actualizar el teléfono si el que tenemos es nuevo
                if (!clientePorEmail.telefono) {
                    await supabaseAdmin.from('clientes').update({ telefono }).eq('id', clientePorEmail.id);
                }
                return clientePorEmail.id;
            }
        }

        // 3. No existe: crear nuevo cliente
        const clienteNuevo = await crearCliente({
            nombre,
            telefono,
            ...(email ? { email } : {})
        });
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
        return data;
    } catch (error) {
        console.error("Error en modelo.crearCliente:", error);
        throw error;
    }
}

// Función para actualizar un cliente existente
async function actualizarCliente(id, datos) {
    try {
        const { data, error } = await supabaseAdmin
            .from('clientes')
            .update({
                nombre: datos.nombre,
                telefono: datos.telefono,
                preferencias: datos.preferencias,
                modificado: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error al actualizar cliente con ID ${id}:`, error.message);
        throw error;
    }
}

// Función para eliminar un cliente (y sus turnos asociados)
async function eliminarCliente(id) {
    try {
        // Primero eliminar los turnos que referencian a este cliente
        const { error: errorTurnos } = await supabaseAdmin
            .from('turnos')
            .delete()
            .eq('cliente_id', id);

        if (errorTurnos) throw errorTurnos;

        // Luego eliminar el cliente
        const { error } = await supabaseAdmin
            .from('clientes')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`Error al eliminar cliente con ID ${id}:`, error.message);
        throw error;
    }
}


export default {
    obtenerClientes,
    obtenerUnCliente,
    buscarOCrearCliente,
    crearCliente,
    actualizarCliente,
    eliminarCliente
};