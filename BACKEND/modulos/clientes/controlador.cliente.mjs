// clientes/controlador.cliente.mjs

import modeloCliente from "./modelo.cliente.mjs";

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
    obtenerOCrear
};