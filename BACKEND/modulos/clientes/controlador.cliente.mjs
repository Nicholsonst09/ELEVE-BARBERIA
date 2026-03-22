import modeloCliente from "./modelo.cliente.mjs";

//función para manejar la solicitud de todos los clientes
async function obtenerClientes(req, res){
    try {
            const clientes = await modeloCliente.obtenerClientes();
            res.status(200).json(clientes);
        } catch (error) {
            console.error("Error en controlador.obtenerClientes:", error);
            res.status(500).json({ mensaje: "Error interno del servidor al obtener clientes.", detalle: error.message });
        }
}

//función para manejar la solicitud de obtener un cliente por ID
async function obtenerUnCliente(req, res){
    const clienteId = parseInt(req.params.id);

    if (isNaN(clienteId)) {
        return res.status(400).json({ mensaje: 'ID del cliente inválido. Debe ser un número.' });
    }

    try{
        const cliente = await modeloCliente.obtenerUnCliente(clienteId);
                if (cliente) {
                    res.status(200).json(cliente);
                } else {
                    res.status(404).json({ mensaje: 'Cliente no encontrado.' });
                }
    }catch (error) {
        console.error(`Error en controlador.obtenerUnCliente (ID: ${clienteId}):`, error);
        res.status(500).json({ mensaje: 'Error interno del servidor al obtener el cliente.', detalle: error.message });
    }
}

//funcion para manejar lo buscar cliente existente o crearlo
async function obtenerOCrear(req, res) {
    try {
        const { nombre, telefono } = req.body;

        if (!nombre || !telefono) {
            return res.status(400).json({ mensaje: "Nombre y teléfono son requeridos." });
        }

        const cliente_id = await modeloCliente.buscarOCrearCliente(nombre, telefono);

        res.status(200).json({ 
            mensaje: "Cliente gestionado con éxito.",
            cliente_id: cliente_id 
        });

    } catch (error) {
        console.error("Error en controlador.obtenerOCrear:", error);
        res.status(500).json({ 
            mensaje: "Error interno del servidor al gestionar el cliente.", 
            detalle: error.message 
        });
    }
}




// Crear un cliente directamente (ABM)
async function crearCliente(req, res) {
    const { nombre, telefono, preferencias } = req.body;
    if (!nombre || !telefono) {
        return res.status(400).json({ mensaje: 'Nombre y teléfono son requeridos.' });
    }
    try {
        const cliente = await modeloCliente.crearCliente({ nombre, telefono, preferencias });
        res.status(201).json(cliente);
    } catch (error) {
        console.error('Error en controlador.crearCliente:', error);
        res.status(500).json({ mensaje: 'Error al crear cliente.', detalle: error.message });
    }
}

// Actualizar un cliente existente
async function actualizarCliente(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ mensaje: 'ID inválido.' });
    try {
        const cliente = await modeloCliente.actualizarCliente(id, req.body);
        res.status(200).json(cliente);
    } catch (error) {
        console.error(`Error en controlador.actualizarCliente (ID: ${id}):`, error);
        res.status(500).json({ mensaje: 'Error al actualizar cliente.', detalle: error.message });
    }
}

// Eliminar un cliente
async function eliminarCliente(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ mensaje: 'ID inválido.' });
    try {
        await modeloCliente.eliminarCliente(id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error en controlador.eliminarCliente (ID: ${id}):`, error);
        res.status(500).json({ mensaje: 'Error al eliminar cliente.', detalle: error.message });
    }
}


export default {
    obtenerClientes,
    obtenerUnCliente,
    obtenerOCrear,
    crearCliente,
    actualizarCliente,
    eliminarCliente
};