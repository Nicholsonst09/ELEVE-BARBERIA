import modelo from "./modelo.turno.mjs";
import modeloServicio from '../servicios/modelo.servicio.mjs';
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
async function agregarTurno(req, res) {
    const {
        cliente_id, empleado_id, servicio_id,
        hora_inicio, fecha, hora_fin,
        estado, precio
    } = req.body;

    const estadosPermitidos = ["pendiente", "confirmado", "cancelado", "realizado"];
    const expresionHora = /^\d{2}:\d{2}$/;

    const fechaNumero = new Date(fecha);
    const fechaValida = !isNaN(fechaNumero.getTime());

    //VALIDACIONES MÁS IMPORTANTES
    if (
        !Number(cliente_id) ||
        !Number(empleado_id) ||
        !Number(servicio_id)
    ) {
        return res.status(400).json({ mensaje: "Los IDs de cliente, empleado o servicio son inválidos o faltantes." });
    }

    if (!fecha || !fechaValida) {
        return res.status(400).json({ mensaje: "El formato de la fecha es inválido." });
    }

    if (!expresionHora.test(hora_inicio) || !expresionHora.test(hora_fin)
    ) {
        return res.status(400).json({ mensaje: "El formato de la hora debe ser HH:MM." });
    }

    if (hora_inicio >= hora_fin) {
        return res.status(400).json({ mensaje: "La hora de inicio debe ser anterior a la hora de fin." });
    }

    if (estado && !estadosPermitidos.includes(estado)) {
        return res.status(400).json({ mensaje: `El estado '${estado}' no es un estado de turno permitido.` });
    }

    try {
        const turnoCreado = await modelo.agregarTurno(req.body);
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
        const { cliente_id, empleado_id, servicio_id, fecha, hora_inicio, hora_fin, estado, precio } = req.body;

        if (isNaN(turnoId)) {
            return res.status(400).json({ mensaje: 'El ID del turno no es válido. Debe ser un número.' });
        }

        const turnoExistente = await modelo.obtenerUnTurno(turnoId);
        if (!turnoExistente) {
            return res.status(404).json({ mensaje: "El turno que desea modificar no existe." });
        }
        const estadosPermitidos = ["pendiente", "confirmado", "cancelado", "realizado"];
        const expresionHora = /^\d{2}:\d{2}$/;

        const fechaNumero = new Date(fecha);
        const fechaValida = !isNaN(fechaNumero.getTime());

        if (
            !Number(cliente_id) ||
            !Number(empleado_id) ||
            !Number(servicio_id) ||
            !fechaValida ||
            !expresionHora.test(hora_inicio) ||
            !expresionHora.test(hora_fin) ||
            hora_inicio >= hora_fin ||
            (estado && !estadosPermitidos.includes(estado)) ||
            precio === undefined || isNaN(precio) || precio < 0
        ) {
            return res.status(400).json({ mensaje: "Los datos del turno no son válidos." });
        }

        // Si pasa validaciones, modifica turno en BD
        const modificado = await modelo.modificarTurno(turnoId, req.body);

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

        if (!turnoAEliminar) {
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

//Funcion para traer los horarios disponibles de un empleado en determinada fecha
async function obtenerHorariosDisponibles(req, res) {
    try {
        const { empleado_id, servicio_id, fecha } = req.params;

        const servicio = await modeloServicio.obtenerServicioPorId(servicio_id);
        if (!servicio) {
            return res.status(404).json({ mensaje: "Servicio no encontrado." });
        }
        const duracionServicio = servicio.duracion_min;

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
        /*         const fechaActual = new Date();
                const fechaSolicitada = new Date(fecha);
                fechaActual.setHours(0, 0, 0,0); //Hora a 0 para comparar solo la fecha
                if (fechaSolicitada < fechaActual){
                    return res.status(400).json({ mensaje: "No se pueden buscar horarios para una fecha anterior a la actual." });
                } */

        //Validar formato de hora

        const horarios = await modelo.obtenerHorariosDisponibles(parseInt(empleado_id), fecha, duracionServicio);

        res.status(200).json(horarios);
    } catch (error) {
        console.error("Error en controlador.obtenerHorariosDisponibles:", error);
        res.status(500).json({
            mensaje: "Error interno del servidor al obtener horarios disponibles.",
            detalle: error.message
        });
    }
}

async function obtenerTurnosConDetalles(req, res) {
    const { empleadoId, fecha } = req.query;

    let idEmpleadoValidado = null;

    if (empleadoId) {
        // Asegúrate de que, si el ID viene, sea un número válido
        const idConvertido = parseInt(empleadoId);
        if (isNaN(idConvertido)) {
            return res.status(400).json({ mensaje: 'ID de empleado inválido. Debe ser un número entero.' });
        }
        idEmpleadoValidado = idConvertido;
    }

    try {
        const turnos = await modelo.obtenerTurnosConDetalles({
            empleadoId: idEmpleadoValidado,
            fecha: fecha || null
        });

        if (!turnos || turnos.length === 0) {
            return res.status(200).json({
                mensaje: "No se encontraron turnos con los filtros proporcionados.",
                data: []
            });
        }

        res.status(200).json(turnos);
    } catch (error) {
        console.error("Error en controlador.obtenerTurnosConDetalles:", error);
        res.status(500).json({
            mensaje: "Error interno del servidor al obtener turnos con detalles.",
            detalle: error.message
        });
    }
}

export default {
    obtenerTurnos,
    obtenerUnTurno,
    agregarTurno,
    modificarTurno,
    eliminarTurno,
    obtenerHorariosDisponibles,
    obtenerTurnosConDetalles
};