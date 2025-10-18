import modeloCliente from "./modelo.cliente.mjs";

//función para manejar la solicitud de todos los clientes
async function obtenerClientes(req, res){
    try {
            const clientes = await modeloCliente.obtenerClientes();
            if (clientes.length === 0) {
                return res.status(200).json({ mensaje: "No hay clientes en la base de datos." });
            }
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
        console.error(`Error en controlador.obtenerUnCliente (ID: ${empleadoId}):`, error);
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




export default {
    obtenerClientes,
    obtenerUnCliente,
    obtenerOCrear
};