// modulos/controlador.mjs

import modelo from './modelo.mjs'; // Importa el modelo de turnos

// Función para manejar la solicitud de obtener todos los turnos
async function obtenerTurnos(req, res) {
    try {
        const turnos = await modelo.obtenerTurnos();
        if (turnos.length === 0) {
            return res.status(200).json({ mensaje: "No hay turnos en la base de datos." });
        }
        res.status(200).json(turnos);
    } catch (error) {
        console.error("Error en controlador.obtenerTurnos:", error);
        res.status(500).json({ mensaje: "Error interno del servidor al obtener turnos.", detalle: error.message });
    }
}

// Función que retorna un turno por ID
async function obtenerUnTurno(req, res) {
    const turnoId = parseInt(req.params.id);

    if (isNaN(turnoId)) {
        return res.status(400).json({ mensaje: 'ID de turno inválido. Debe ser un número.' });
    }

    try {
        const turno = await modelo.obtenerUnTurno(turnoId);
        if (turno) {
            res.status(200).json(turno);
        } else {
            res.status(404).json({ mensaje: 'Turno no encontrado.' });
        }
    } catch (error) {
        console.error(`Error en controlador.obtenerUnTurno (ID: ${turnoId}):`, error);
        res.status(500).json({ mensaje: 'Error interno del servidor al obtener el turno.', detalle: error.message });
    }
}

// Función para agregar un turno
async function agregarUnTurno(req, res) {
    try {
        const nuevoTurno = req.body;
    
        const turnoCreado = await modelo.agregarTurno(nuevoTurno);
        res.status(201).json({ mensaje: "Turno agregado con éxito", turno: turnoCreado });
    } catch (error) {
        console.error("Error en controlador.agregarUnTurno:", error);
        res.status(500).json({ mensaje: 'Error interno del servidor al agregar el turno.', detalle: error.message });
    }
}

// Función para modificar un turno
async function modificarTurno(req, res) {
    try {
        const turnoId = parseInt(req.params.id);
        const turnoModificado = req.body;

        if (isNaN(turnoId)) {
            return res.status(400).json({ mensaje: 'ID de turno inválido. Debe ser un número.' });
        }



        const turnoExistente = await modelo.obtenerUnTurno(turnoId);
        if (!turnoExistente) {
            return res.status(404).json({ mensaje: "Turno a modificar no encontrado." });
        }

        const modificado = await modelo.modificarTurno(turnoId, turnoModificado);
        if (modificado) {
            res.status(200).json({ mensaje: `Turno con ID ${turnoId} modificado con éxito.` });
        } else {
            res.status(500).json({ mensaje: 'No se pudo modificar el turno por una razón desconocida.' });
        }

    } catch (error) {
        console.error(`Error en controlador.modificarTurno (ID: ${req.params.id}):`, error);
        res.status(500).json({ mensaje: 'Error interno del servidor al modificar el turno.', detalle: error.message });
    }
}

// Función para eliminar 1 turno
async function eliminarTurno(req, res) {
    const turnoId = parseInt(req.params.id);

    if (isNaN(turnoId)) {
        return res.status(400).json({ mensaje: 'ID de turno inválido. Debe ser un número.' });
    }

    try {
        // Antes de eliminar el turno de la BD, obtener su URL de imagen para eliminarla del storage
        const turnoAEliminar = await modelo.obtenerUnTurno(turnoId);
        
        if(!turnoAEliminar) {
            return res.status(404).json({ mensaje: 'Turno no encontrado para eliminar.' });
        }

        const eliminado = await modelo.eliminarTurno(turnoId);

        if (eliminado) {
            res.status(200).json({ mensaje: `Turno con ID ${turnoId} eliminado con éxito.` });
        } else {
            res.status(404).json({ mensaje: 'Turno no encontrado para eliminar.' }); //Es redundante porque siempre será true pero queda por si aparece algo inusual
        }
    } catch (error) {
        console.error(`Error en controlador.eliminarTurno (ID: ${turnoId}):`, error);
        res.status(500).json({ mensaje: 'Error interno del servidor al eliminar el turno.', detalle: error.message });
    }
}

async function obtenerHorariosDisponibles(req, res) {
    try{
        const {empleado_id, fecha} = req.params;
        const {hora_apertura, hora_cierre} = req.query;

        //Validar parámetros requeridos
        if (!empleado_id || !fecha) {
            return res.status(400).json({ 
                mensaje: "Faltan parámetros requeridos: empleado_id, fecha" 
            });
        }

        //Validar que el empleado existe (una vez que esté creada tabla Empleados)

        //Validar que empleado id sea un número (luego lo filtramos enviando solo ese dato)
        const idEmpleado = parseInt(empleado_id);
        if (isNaN(idEmpleado)) {
            return res.status(400).json({ mensaje: 'ID de empleado inválido. Debe ser un número.' });
        }

        //Validar formato de fecha
        const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
        if (!regexFecha.test(fecha)) {
            return res.status(400).json({ mensaje: "Formato de fecha inválido. Use YYYY-MM-DD." });
        }

        //Validar que no sea una fecha anterior (VER ESTO DIRECTAMENTE EN EL FRONT DE NO MOSTRAR)
        const fechaActual = new Date();
        const fechaSolicitada = new Date(fecha);
        fechaActual.setHours(0, 0, 0,0); //Hora a 0 para comparar solo la fecha
        if (fechaSolicitada < fechaActual){
            return res.status(400).json({ mensaje: "No se pueden buscar horarios para una fecha anterior a la actual." });
        }

        //Validar formato de hora

        const horarios = await modelo.obtenerHorariosDisponibles(
            parseInt(empleado_id),
            fecha, 
            hora_apertura,
            hora_cierre
        );

        res.status(200).json(horarios);
    } catch (error) {
        console.error("Error en controlador.obtenerHorariosDisponibles:", error);
        res.status(500).json({ 
            mensaje: "Error interno del servidor al obtener horarios disponibles.", 
            detalle: error.message 
        });
    }
}

// Exportamos las funciones del controlador
export default {
    obtenerTurnos,
    obtenerUnTurno,
    agregarUnTurno,
    modificarTurno,
    eliminarTurno,
    obtenerHorariosDisponibles
};
