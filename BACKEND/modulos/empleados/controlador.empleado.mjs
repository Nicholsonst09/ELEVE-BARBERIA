import modelo from './modelo.empleado.mjs';

//función para manejar la solicitud de todos los empleados
async function obtenerEmpleados(req, res){
    try {
            const empleados = await modelo.obtenerEmpleados();
            res.status(200).json(empleados);
        } catch (error) {
            console.error("Error en controlador.obtenerEmpleados:", error);
            res.status(500).json({ mensaje: "Error interno del servidor al obtener empleados.", detalle: error.message });
        }
}

//función para manejar la solicitud de obtener un empleado por ID
async function obtenerUnEmpleado(req, res){
    const empleadoId = parseInt(req.params.id);

    if (isNaN(empleadoId)) {
        return res.status(400).json({ mensaje: 'ID del empleado inválido. Debe ser un número.' });
    }

    try{
        const empleado = await modelo.obtenerUnEmpleado(empleadoId);
                if (empleado) {
                    res.status(200).json(empleado);
                } else {
                    res.status(404).json({ mensaje: 'Empleado no encontrado.' });
                }
    }catch (error) {
        console.error(`Error en controlador.obtenerUnEmpleado (ID: ${empleadoId}):`, error);
        res.status(500).json({ mensaje: 'Error interno del servidor al obtener el empleado.', detalle: error.message });
    }

}

async function crearEmpleado(req, res) {
    try {
        const { nombre, email, especialidades, horarios_disponibles, avatar_url, servicio_ids } = req.body;

        if (!nombre) {
            return res.status(400).json({ mensaje: 'Nombre es requerido.' });
        }

        const empleado = await modelo.crearEmpleado({
            nombre: String(nombre).trim(),
            email: email || null,
            especialidades: especialidades || null,
            horarios_disponibles: horarios_disponibles || null,
            avatar_url: avatar_url || null,
            servicio_ids: Array.isArray(servicio_ids) ? servicio_ids : []
        });

        res.status(201).json(empleado);
    } catch (error) {
        console.error('Error en controlador.crearEmpleado:', error);
        res.status(500).json({ mensaje: 'Error al crear empleado.', detalle: error.message });
    }
}

async function actualizarEmpleado(req, res) {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ mensaje: 'ID inválido.' });
    }

    try {
        const { nombre, email, especialidades, horarios_disponibles, avatar_url, servicio_ids } = req.body;

        if (!nombre) {
            return res.status(400).json({ mensaje: 'Nombre es requerido.' });
        }

        const empleado = await modelo.actualizarEmpleado(id, {
            nombre: String(nombre).trim(),
            email: email || null,
            especialidades: especialidades || null,
            horarios_disponibles: horarios_disponibles || null,
            avatar_url: avatar_url || null,
            servicio_ids: Array.isArray(servicio_ids) ? servicio_ids : []
        });

        res.status(200).json(empleado);
    } catch (error) {
        console.error(`Error en controlador.actualizarEmpleado (ID: ${id}):`, error);
        res.status(500).json({ mensaje: 'Error al actualizar empleado.', detalle: error.message });
    }
}

async function eliminarEmpleado(req, res) {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ mensaje: 'ID inválido.' });
    }

    try {
        await modelo.eliminarEmpleado(id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error en controlador.eliminarEmpleado (ID: ${id}):`, error);
        res.status(500).json({ mensaje: 'Error al dar de baja el empleado.', detalle: error.message });
    }
}

export default{
    obtenerEmpleados,
    obtenerUnEmpleado,
    crearEmpleado,
    actualizarEmpleado,
    eliminarEmpleado
}