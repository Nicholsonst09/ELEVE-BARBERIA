import modelo from './modelo.servicio.mjs';


// Función para obtener todos los servicios
async function obtenerServicios(req, res) {
    try {
        const servicios = await modelo.obtenerServicios();
        res.status(200).json(servicios);
    } catch (error) {
        console.error("Error en controlador.obtenerServicios:", error);
        res.status(500).json({ mensaje: "Error interno del servidor al obtener servicios.", detalle: error.message });
    }
}

//Funcion para buscar empleados por servicio
async function buscarEmpleadosPorServicio(req, res) {
    // Instrumentacion temporal para el "Failed to fetch" intermitente: si esto
    // vuelve a pasar, buscar en los logs de Vercel el request con ese origin/
    // servicio_id y ver si duration_ms es anormal. Ojo: si el fallo viene de
    // un intermediario (cache/CORS) antes de llegar a Express, este log ni
    // siquiera va a aparecer para ese request — eso en si mismo es un dato.
    const inicio = Date.now();
    const origin = req.headers.origin || '(sin origin)';
    try{
        const {servicio_id} = req.params;

        if(!servicio_id) {
            return res.status(400).json({mensaje: "El id del servicio es requerido"});
        }

        const empleados = await modelo.buscarEmpleadosPorServicio(servicio_id);
        const duracionMs = Date.now() - inicio;
        console.log(`[buscarEmpleadosPorServicio] servicio_id=${servicio_id} origin=${origin} duracion_ms=${duracionMs} total=${empleados.length}`);

        //Vallidar que no vengan vacíos los empleados
        if (empleados.length === 0) {
            return res.status(200).json({
                mensaje: "No hay empleados que brinden este servicio",
                empleados: []
            })
        }

        res.status(200).json({
            servicio_id: servicio_id,
            empleados: empleados,
            total: empleados.length
        });
    }catch(error){
        const duracionMs = Date.now() - inicio;
        console.error(`[buscarEmpleadosPorServicio] ERROR servicio_id=${req.params?.servicio_id} origin=${origin} duracion_ms=${duracionMs}:`, error);
        res.status(500).json({
            mensaje: "Error interno del servidor al buscar profesionales.",
            detalle: error.message
        });
    }
}

async function obtenerServicioPorId(req, res) {
    try{
        const {servicio_id}= req.params;
        if(!servicio_id) {
            return res.status(404).json({ mensaje: "Falta ingresar el id del servicio." });
        }

        const servicio = await modelo.obtenerServicioPorId(servicio_id);
        if(!servicio){
            return res.status(404).json({ mensaje: "Servicio no encontrado." });
        }

        res.status(200).json(servicio);
    }catch(error) {
        console.error(`Error en controlador.obtenerServicioPorId (ID: ${req.params.servicio_id}):`, error);
        res.status(500).json({ mensaje: 'Error interno del servidor buscar servicio por su id.', detalle: error.message });
    }
}

async function crearServicio(req, res) {
    try {
        const { nombre, precio, duracion_min, descripcion, empleado_ids } = req.body;

        if (!nombre || precio === undefined || !Number.isFinite(Number(precio)) || !Number.isFinite(Number(duracion_min))) {
            return res.status(400).json({ mensaje: 'Nombre, precio y duración son requeridos.' });
        }

        const servicio = await modelo.crearServicio({
            nombre: String(nombre).trim(),
            precio: Number(precio),
            duracion_min: Number(duracion_min),
            descripcion: descripcion || null,
            empleado_ids: Array.isArray(empleado_ids) ? empleado_ids : []
        });

        res.status(201).json(servicio);
    } catch (error) {
        console.error('Error en controlador.crearServicio:', error);
        res.status(500).json({ mensaje: 'Error al crear servicio.', detalle: error.message });
    }
}

async function actualizarServicio(req, res) {
    try {
        const id = Number(req.params.id);
        const { nombre, precio, duracion_min, descripcion, empleado_ids } = req.body;

        if (!Number.isInteger(id)) {
            return res.status(400).json({ mensaje: 'ID inválido.' });
        }

        if (!nombre || precio === undefined || !Number.isFinite(Number(precio)) || !Number.isFinite(Number(duracion_min))) {
            return res.status(400).json({ mensaje: 'Nombre, precio y duración son requeridos.' });
        }

        const servicio = await modelo.actualizarServicio(id, {
            nombre: String(nombre).trim(),
            precio: Number(precio),
            duracion_min: Number(duracion_min),
            descripcion: descripcion || null,
            empleado_ids: Array.isArray(empleado_ids) ? empleado_ids : []
        });

        res.status(200).json(servicio);
    } catch (error) {
        console.error(`Error en controlador.actualizarServicio (ID: ${req.params.id}):`, error);
        res.status(500).json({ mensaje: 'Error al actualizar servicio.', detalle: error.message });
    }
}

async function eliminarServicio(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ mensaje: 'ID inválido.' });
        }

        await modelo.eliminarServicio(id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error en controlador.eliminarServicio (ID: ${req.params.id}):`, error);
        res.status(500).json({ mensaje: 'Error al anular servicio.', detalle: error.message });
    }
}

async function cambiarEstadoServicio(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ mensaje: 'ID inválido.' });
        }

        if (typeof req.body?.activo !== 'boolean') {
            return res.status(400).json({ mensaje: "El campo 'activo' es requerido y debe ser booleano." });
        }

        const servicio = await modelo.cambiarEstadoServicio(id, req.body.activo ? 'activo' : 'inactivo');
        res.status(200).json(servicio);
    } catch (error) {
        console.error(`Error en controlador.cambiarEstadoServicio (ID: ${req.params.id}):`, error);
        res.status(500).json({ mensaje: 'Error al cambiar el estado del servicio.', detalle: error.message });
    }
}

export default {
    obtenerServicios,
    buscarEmpleadosPorServicio,
    obtenerServicioPorId,
    crearServicio,
    actualizarServicio,
    eliminarServicio,
    cambiarEstadoServicio
};