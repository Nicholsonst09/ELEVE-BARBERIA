import modelo from './modelo.servicio.mjs';


// Función para obtener todos los servicios
async function obtenerServicios(req, res) {
    try {
        const servicios = await modelo.obtenerServicios();
        if (servicios.length === 0) {
            return res.status(200).json({ mensaje: "No hay servicios en la base de datos." });
        }
        const serviciosActivos = servicios.filter(servicio => servicio.activo === true);

        res.status(200).json(serviciosActivos);
    } catch (error) {
        console.error("Error en controlador.obtenerServicios:", error);
        res.status(500).json({ mensaje: "Error interno del servidor al obtener servicios.", detalle: error.message });
    }
}

//Funcion para buscar empleados por servicio
async function buscarEmpleadosPorServicio(req, res) {
    try{
        const {servicio_id} = req.params;

        if(!servicio_id) {
            return res.status(400).json({mensaje: "El id del servicio es requerido"});
        }

        const empleados = await modelo.buscarEmpleadosPorServicio(servicio_id);

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
        console.error("Error en controlador.buscarProfesionalesPorServicio:", error);
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
        console.error(`Error en controlador.obtenerServicioPorId (ID: ${turnoId}):`, error);
        res.status(500).json({ mensaje: 'Error interno del servidor buscar servicio por su id.', detalle: error.message });
    }
}

export default {
    obtenerServicios,
    buscarEmpleadosPorServicio,
    obtenerServicioPorId
};