import modelo from "./modelo.turno.mjs";
import modeloServicio from '../servicios/modelo.servicio.mjs';
import modeloCliente from '../clientes/modelo.cliente.mjs';
import notificacionesTurno from './notificaciones.turno.mjs';
import {
    obtenerFechaDeHoy, obtenerMinutosDesdeMedianoche, TOLERANCIA_ATRASO_ADMIN_MIN,
    permitirRegistroTurnosAtrasados, excedeVentanaRegistroAtrasado
} from '../../config/fechaHoraNegocio.mjs';

// ─── MÁQUINA DE ESTADOS ───────────────────────────────────────────────────────
const TRANSICIONES_VALIDAS = {
    'reservado':  ['completado', 'cancelado', 'anulado'],
    // Revertir un estado final (completado/cancelado/anulado) solo lo puede
    // hacer un admin — se corta antes, en el bloque "estado final" de
    // modificarTurno, para cualquier otro rol. Es la corrección manual desde
    // el historial ante un error de carga (se completó/canceló/anuló mal).
    'completado': ['reservado', 'cancelado', 'anulado'],
    // Un cancelado solo se corrige a anulado (turno cargado por error); no
    // vuelve a quedar reservado ni se completa desde ahí.
    'cancelado':  ['anulado'],
    // Anulado equivale a "eliminado": estado final absoluto, ni siquiera un
    // admin lo puede revertir.
    'anulado':    [],
};

// Estados finales que un admin puede corregir desde el historial. Anulado
// queda afuera a propósito (ver comentario en TRANSICIONES_VALIDAS).
const ESTADOS_REVERTIBLES_POR_ADMIN = ['completado', 'cancelado'];

const ESTADOS_FINALES = ['completado', 'cancelado', 'anulado'];

function normalizarEstado(estado) {
    if (!estado) return estado;
    return estado;
}

function validarTransicionEstado(estadoActual, estadoNuevo) {
    const estadoActualNorm = normalizarEstado(estadoActual);
    const estadoNuevoNorm = normalizarEstado(estadoNuevo);
    if (estadoActualNorm === estadoNuevoNorm) return true;
    const permitidos = TRANSICIONES_VALIDAS[estadoActualNorm];
    if (!permitidos) return false;
    return permitidos.includes(estadoNuevoNorm);
}
// ─────────────────────────────────────────────────────────────────────────────

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
    let {
        cliente_id, nombre_cliente, telefono_cliente, email_cliente,
        empleado_id, servicio_id,
        hora_inicio, fecha, hora_fin,
        estado, precio, origen
    } = req.body;

    const estadosPermitidos = ["reservado", "completado", "cancelado", "anulado"];
    const expresionHora = /^\d{2}:\d{2}$/;

    const fechaNumero = new Date(fecha);
    const fechaValida = !isNaN(fechaNumero.getTime());

    // VALIDACIONES - Campos requeridos
    if (!empleado_id) {
        return res.status(400).json({ mensaje: "El empleado es requerido." });
    }
    if (!Number(empleado_id)) {
        return res.status(400).json({ mensaje: "El ID de empleado debe ser un número válido." });
    }

    // Un usuario con rol empleado y ficha propia (barbero) solo puede crear
    // turnos para si mismo. Esto se valida en el backend (no solo ocultando
    // el select en el frontend) porque el frontend se puede saltear con un
    // request directo a la API. Un usuario rol empleado SIN ficha asociada
    // (ej: recepcionista) no tiene esta restricción: gestiona turnos de
    // cualquier profesional, igual que un admin.
    if (req.auth?.rol === 'empleado' && req.auth?.empleado_id) {
        if (Number(empleado_id) !== Number(req.auth.empleado_id)) {
            return res.status(403).json({ mensaje: 'Solo podés crear turnos asignados a vos mismo.' });
        }
    }

    if (!servicio_id) {
        return res.status(400).json({ mensaje: "El servicio es requerido." });
    }
    if (!Number(servicio_id)) {
        return res.status(400).json({ mensaje: "El ID de servicio debe ser un número válido." });
    }

    if (!fecha) {
        return res.status(400).json({ mensaje: "La fecha es requerida." });
    }
    if (!fechaValida) {
        return res.status(400).json({ mensaje: "El formato de la fecha es inválido. Use YYYY-MM-DD." });
    }

    if (!hora_inicio) {
        return res.status(400).json({ mensaje: "La hora de inicio es requerida." });
    }
    if (!hora_fin) {
        return res.status(400).json({ mensaje: "La hora de fin es requerida." });
    }
    if (!expresionHora.test(hora_inicio) || !expresionHora.test(hora_fin)) {
        return res.status(400).json({ mensaje: "El formato de la hora debe ser HH:MM (ej: 14:30)." });
    }

    if (hora_inicio >= hora_fin) {
        return res.status(400).json({ mensaje: "La hora de inicio debe ser anterior a la hora de fin." });
    }

    if (estado && !estadosPermitidos.includes(normalizarEstado(estado))) {
        return res.status(400).json({ mensaje: `El estado '${estado}' no es un estado de turno permitido.` });
    }

    // Validar que haya cliente_id O datos del cliente
    if (!cliente_id && !nombre_cliente) {
        return res.status(400).json({ mensaje: "Se requiere cliente_id o al menos el nombre del cliente." });
    }

    // ── Validación: fecha no pasada y mínimo de anticipación ──────────────
        const hoy = obtenerFechaDeHoy();
        const esFechaPasada = fecha < hoy;
        let esHorarioYaPasado = false;
        if (fecha === hoy) {
            const [hh, mm] = hora_inicio.split(':').map(Number);
            const minutosSlot = hh * 60 + mm;
            const minutosAhora = obtenerMinutosDesdeMedianoche();
            // Esta ruta es del panel de gestión: se admite cargar con atraso el turno en curso.
            esHorarioYaPasado = minutosSlot < minutosAhora - TOLERANCIA_ATRASO_ADMIN_MIN;
        }

        if (esFechaPasada || esHorarioYaPasado) {
            // Con PERMITIR_REGISTRO_TURNOS_ATRASADOS activo, el panel puede cargar
            // turnos con hasta 24hs de atraso (para no perder uno que no se llegó
            // a registrar a tiempo). Fuera de esa ventana, rige la regla de siempre.
            const admitidoPorVentanaAtrasada = permitirRegistroTurnosAtrasados()
                && !excedeVentanaRegistroAtrasado(fecha, hora_inicio);
            if (!admitidoPorVentanaAtrasada) {
                const mensaje = esFechaPasada
                    ? 'No se pueden crear turnos para fechas anteriores a hoy.'
                    : 'No se puede crear un turno para un horario que ya pasó.';
                return res.status(400).json({ mensaje });
            }
        }
        // ────────────────────────────────────────────────────────────────────────

    try {
        // Si no hay cliente_id, intentar buscar/crear basado en nombre, teléfono y email
        if (!cliente_id && nombre_cliente) {
            try {
                cliente_id = await modeloCliente.buscarOCrearCliente(
                    nombre_cliente,
                    telefono_cliente || null,
                    email_cliente || null
                );
                // Si buscarOCrearCliente retorna null (sin teléfono ni email), crear
                // el cliente igual con solo el nombre: en el panel de gestión ambos
                // datos son opcionales, pero todo turno necesita un cliente asociado.
                if (!cliente_id) {
                    const clienteNuevo = await modeloCliente.crearCliente({ nombre: nombre_cliente });
                    cliente_id = clienteNuevo.id;
                }
            } catch (error) {
                console.error('[turnos] Error buscando/creando cliente:', error?.message || error);
                // Continuar con cliente_id = null
            }
        }

        // ── Anti-solapamiento ────────────────────────────────────────────────
        const conflicto = await modelo.verificarSolapamiento(empleado_id, fecha, hora_inicio, hora_fin);
        if (conflicto) {
            return res.status(409).json({
                mensaje: `El profesional ya tiene un turno de ${conflicto.hora_inicio.substring(0,5)} a ${conflicto.hora_fin.substring(0,5)} que se superpone con el horario solicitado.`
            });
        }
        // ────────────────────────────────────────────────────────────────────

        const datosParaTurno = {
            ...req.body,
            cliente_id: cliente_id || null
        };

        const turnoCreado = await modelo.agregarTurno(datosParaTurno);
        if (turnoCreado.estado === 'reservado') {
            try {
                await notificacionesTurno.enviarConfirmacionReserva(turnoCreado.id);
            } catch (error) {
                console.error('[notificaciones] Error enviando confirmación de reserva:', error?.message || error);
            }
        }
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
        const rolUsuario = String(req.headers['x-user-role'] || '').toLowerCase();
        const politicasNegocio = await modelo.obtenerPoliticasNegocio();

        if (isNaN(turnoId)) {
            return res.status(400).json({ mensaje: 'El ID del turno no es válido. Debe ser un número.' });
        }

        const turnoExistente = await modelo.obtenerUnTurno(turnoId);
        if (!turnoExistente) {
            return res.status(404).json({ mensaje: "El turno que desea modificar no existe." });
        }

        // Un usuario con rol empleado y ficha propia solo puede tocar sus
        // propios turnos, y no puede reasignarlos a otro profesional (mismo
        // criterio que al crear). Sin ficha asociada (recepcionista), no hay
        // restricción: gestiona cualquier turno igual que un admin.
        if (rolUsuario === 'empleado' && req.auth?.empleado_id) {
            const miEmpleadoId = req.auth.empleado_id;
            if (String(turnoExistente.empleado_id) !== String(miEmpleadoId)) {
                return res.status(403).json({ mensaje: 'Solo podés modificar tus propios turnos.' });
            }
            if (empleado_id !== undefined && Number(empleado_id) !== Number(miEmpleadoId)) {
                return res.status(403).json({ mensaje: 'No podés reasignar el turno a otro profesional.' });
            }
        }

        const fechaActual = turnoExistente.fecha;
        const horaActual = (turnoExistente.hora_inicio || '').substring(0, 5);

        // ── Máquina de estados ───────────────────────────────────────────────
        const esAdmin = ['admin', 'administrador'].includes(rolUsuario);
        // Un admin puede revertir un completado o un cancelado (ver
        // ESTADOS_REVERTIBLES_POR_ADMIN) para corregir un error de carga,
        // desde el detalle del turno en el historial; el flujo sigue de
        // largo hacia la máquina de estados de abajo. Anulado equivale a
        // "eliminado" y nunca se revierte, ni siquiera un admin. Para
        // cualquier otro caso se mantiene el comportamiento previo:
        // cancelado/anulado bloqueados por completo, completado solo
        // permite actualizar el cliente.
        const quiereRevertirEstadoFinal = ESTADOS_REVERTIBLES_POR_ADMIN.includes(turnoExistente.estado)
            && estado && estado !== turnoExistente.estado && esAdmin;

        if (!quiereRevertirEstadoFinal) {
            // Anulado y cancelado: completamente bloqueados.
            if (ESTADOS_FINALES.includes(turnoExistente.estado) && turnoExistente.estado !== 'completado') {
                return res.status(400).json({ mensaje: `No se puede modificar un turno en estado '${turnoExistente.estado}'.` });
            }

            // Completado: solo se permite actualizar el cliente.
            if (turnoExistente.estado === 'completado') {
                const { cliente_id } = req.body;
                if (!Number(cliente_id)) {
                    return res.status(400).json({ mensaje: 'El ID de cliente es inválido.' });
                }
                const modificado = await modelo.modificarSoloCliente(turnoId, cliente_id);
                if (modificado) {
                    return res.status(200).json({ mensaje: `Cliente del turno ${turnoId} actualizado con éxito.` });
                } else {
                    return res.status(500).json({ mensaje: 'No se pudo actualizar el cliente del turno.' });
                }
            }
        }

        // Si se intenta cambiar el estado, validar que la transición sea permitida
        if (estado && !validarTransicionEstado(turnoExistente.estado, estado)) {
            return res.status(400).json({
                mensaje: `Transición de estado inválida: no se puede pasar de "${turnoExistente.estado}" a "${estado}".`,
                transiciones_permitidas: TRANSICIONES_VALIDAS[turnoExistente.estado]
            });
        }

        const estadoNormalizado = normalizarEstado(estado);

        if (estadoNormalizado === 'anulado' && !esAdmin) {
            return res.status(403).json({ mensaje: 'Solo un administrador puede anular turnos.' });
        }

        // Validacion opcional por config: al marcar como completado, validar ventana horaria.
        // El admin puede completar turnos sin límite de antigüedad; la ventana solo rige para empleado.
        if (estadoNormalizado === 'completado' && politicasNegocio.validarHorarioAlCompletarTurno
            && !['admin', 'administrador'].includes(rolUsuario)) {
            const ahora = new Date();
            const horaInicioStr = (turnoExistente.hora_inicio || '').substring(0, 5);
            const fechaTurno = new Date(`${turnoExistente.fecha}T${horaInicioStr}:00`);
            if (ahora < fechaTurno) {
                return res.status(400).json({ mensaje: 'No se puede marcar el turno como completado antes de su hora de inicio.' });
            }
            const diffHoras = (ahora - fechaTurno) / (1000 * 60 * 60);
            if (diffHoras > 24) {
                return res.status(400).json({ mensaje: 'No se puede marcar como completado un turno con mas de 24 horas de antiguedad.' });
            }
        }
        // ────────────────────────────────────────────────────────────────────

        const estadosPermitidos = ["reservado", "completado", "cancelado", "anulado"];
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
            (estado && !estadosPermitidos.includes(estadoNormalizado)) ||
            precio === undefined || isNaN(precio) || precio < 0
        ) {
            return res.status(400).json({ mensaje: "Los datos del turno no son válidos." });
        }

        // ── Validación: fecha/horario no pasado (solo si el turno se movió) ──
        // Mismo criterio que al crear un turno (agregarTurno): si se adelanta
        // un turno a una fecha u horario ya pasado, se admite dentro de la
        // ventana de carga atrasada (PERMITIR_REGISTRO_TURNOS_ATRASADOS). Solo
        // aplica cuando la fecha/hora realmente cambia — un turno que se
        // corrige de estado sin mover el horario (revertir desde historial,
        // completar, cancelar, anular) manda la misma fecha/hora de siempre y
        // no debe volver a validarse contra "ahora".
        const hoy = obtenerFechaDeHoy();
        const fechaCambio = fecha !== turnoExistente.fecha;
        const horaInicioCambio = (hora_inicio || '').substring(0, 5) !== horaActual;
        const esFechaPasada = fechaCambio && fecha < hoy;
        let esHorarioYaPasado = false;
        if (!fechaCambio && fecha === hoy && horaInicioCambio) {
            const [hh, mm] = (hora_inicio || '').split(':').map(Number);
            const minutosSlot = hh * 60 + mm;
            const minutosAhora = obtenerMinutosDesdeMedianoche();
            esHorarioYaPasado = minutosSlot < minutosAhora - TOLERANCIA_ATRASO_ADMIN_MIN;
        }

        if (esFechaPasada || esHorarioYaPasado) {
            const admitidoPorVentanaAtrasada = permitirRegistroTurnosAtrasados()
                && !excedeVentanaRegistroAtrasado(fecha, hora_inicio);
            if (!admitidoPorVentanaAtrasada) {
                const mensaje = esFechaPasada
                    ? 'No se puede mover un turno a una fecha anterior a hoy.'
                    : 'No se puede mover el turno a un horario que ya pasó.';
                return res.status(400).json({ mensaje });
            }
        }
        // ────────────────────────────────────────────────────────────────────

        // ── Anti-solapamiento (solo si cambió algo del horario/empleado) ────
        // Comparar recortado a "HH:MM": turnoExistente.hora_inicio/hora_fin
        // vienen de Postgres como "HH:MM:SS", y compararlos crudos contra el
        // "HH:MM" que manda el front daba un "cambió" falso en cada request
        // (incluso los que solo tocan el estado), disparando una revisión de
        // solapamiento innecesaria que podía chocar con un turno nuevo que
        // desde entonces ocupa ese mismo horario.
        const horaFinActual = (turnoExistente.hora_fin || '').substring(0, 5);
        const horarioCambio = (hora_inicio || '').substring(0, 5) !== horaActual ||
                              (hora_fin || '').substring(0, 5)    !== horaFinActual ||
                              fechaCambio ||
                              String(empleado_id) !== String(turnoExistente.empleado_id);

        if (horarioCambio) {
            const conflicto = await modelo.verificarSolapamiento(empleado_id, fecha, hora_inicio, hora_fin, turnoId);
            if (conflicto) {
                return res.status(409).json({
                    mensaje: `El profesional ya tiene un turno de ${conflicto.hora_inicio.substring(0,5)} a ${conflicto.hora_fin.substring(0,5)} que se superpone con el horario solicitado.`
                });
            }
        }
        // ────────────────────────────────────────────────────────────────────

        // Si pasa validaciones, modifica turno en BD
        const modificado = await modelo.modificarTurno(turnoId, req.body);

        if (modificado) {
            const estadoReservado = turnoExistente.estado === 'reservado';
            const fechaReprogramada = fecha !== fechaActual;
            const horaReprogramada = (hora_inicio || '').substring(0, 5) !== horaActual;
            const turnoCancelado = estadoNormalizado === 'cancelado' && turnoExistente.estado !== 'cancelado';

            // Si el admin revierte un estado final hacia algo distinto de
            // "completado", cualquier pago que hubiera queda obsoleto.
            if (quiereRevertirEstadoFinal && estadoNormalizado !== 'completado') {
                try {
                    await modelo.eliminarPagoDeTurno(turnoId);
                } catch (error) {
                    console.error('[turnos] Error eliminando el pago al revertir el estado del turno:', error?.message || error);
                }
            }

            if (estadoReservado && (fechaReprogramada || horaReprogramada)) {
                try {
                    await notificacionesTurno.enviarReprogramacion(turnoId, {
                        fecha: fechaActual,
                        hora_inicio: horaActual,
                        hora_fin: (turnoExistente.hora_fin || '').substring(0, 5)
                    });
                } catch (error) {
                    console.error('[notificaciones] Error enviando email de reprogramación:', error?.message || error);
                }
            }

            if (turnoCancelado) {
                try {
                    await notificacionesTurno.enviarCancelacion(turnoId);
                } catch (error) {
                    console.error('[notificaciones] Error enviando email de cancelación:', error?.message || error);
                }
            }
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
    const rolUsuario = String(req.headers['x-user-role'] || '').toLowerCase();

    if (isNaN(turnoId)) {
        return res.status(400).json({ mensaje: 'ID de turno inválido. Debe ser un número.' });
    }

    if (!['admin', 'administrador'].includes(rolUsuario)) {
        return res.status(403).json({ mensaje: 'Solo un administrador puede eliminar turnos.' });
    }

    try {
        // Antes de eliminar el turno de la BD, obtener su URL de imagen para eliminarla del storage
        const turnoAEliminar = await modelo.obtenerUnTurno(turnoId);

        if (!turnoAEliminar) {
            return res.status(404).json({ mensaje: 'Turno no encontrado para eliminar.' });
        }

        // ── Máquina de estados ───────────────────────────────────────────────
        // No permitir eliminar turnos en estado final
        if (ESTADOS_FINALES.includes(turnoAEliminar.estado)) {
            return res.status(400).json({
                mensaje: `No se puede eliminar un turno en estado '${turnoAEliminar.estado}'. Usar estado 'anulado' para registrar errores del sistema.`
            });
        }
        // ────────────────────────────────────────────────────────────────────

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
        const { origen } = req.query;

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

        const horarios = await modelo.obtenerHorariosDisponibles(parseInt(empleado_id), fecha, duracionServicio, origen);

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

async function registrarPagoTurno(req, res) {
    const turnoId = parseInt(req.params.id);
    const { metodo, monto } = req.body || {};

    if (isNaN(turnoId)) {
        return res.status(400).json({ mensaje: 'ID de turno invalido. Debe ser un numero.' });
    }

    const metodosPermitidos = ['efectivo', 'transferencia', 'tarjeta'];
    if (!metodosPermitidos.includes(String(metodo || '').toLowerCase())) {
        return res.status(400).json({
            mensaje: `Metodo de pago invalido. Valores permitidos: ${metodosPermitidos.join(', ')}`
        });
    }

    if (monto !== undefined && (!Number.isFinite(Number(monto)) || Number(monto) <= 0)) {
        return res.status(400).json({ mensaje: 'El monto debe ser un numero positivo.' });
    }

    // Sin ficha de empleado asociada (recepcionista), no hay restricción.
    if (req.auth?.rol === 'empleado' && req.auth?.empleado_id) {
        const turnoExistente = await modelo.obtenerUnTurno(turnoId);
        if (!turnoExistente) {
            return res.status(404).json({ mensaje: 'Turno no encontrado.' });
        }
        if (String(turnoExistente.empleado_id) !== String(req.auth.empleado_id)) {
            return res.status(403).json({ mensaje: 'Solo podés registrar pagos de tus propios turnos.' });
        }
    }

    try {
        const resultado = await modelo.registrarPagoTurno(turnoId, {
            metodo: String(metodo).toLowerCase(),
            monto,
            registrado_por: req.auth?.id ?? null
        });

        return res.status(200).json({
            mensaje: 'Pago registrado correctamente.',
            pago: resultado
        });
    } catch (error) {
        const mensaje = String(error?.message || '');
        const status = mensaje.includes('no encontrado') ? 404 : 500;
        return res.status(status).json({
            mensaje: status === 404
                ? 'No se pudo registrar el pago porque el turno no existe.'
                : 'Error interno del servidor al registrar el pago.',
            detalle: error.message
        });
    }
}

// Endpoint pensado para un cron EXTERNO (cron-job.org, Vercel Cron, etc.),
// no para el panel: no lleva autenticarSesion en la ruta porque el cron no
// tiene una sesion de usuario logueado. La autorizacion es el token por
// query param (comparado contra REMINDERS_CRON_TOKEN), o el header propio de
// Vercel Cron si en algun momento se migra a eso.
async function procesarRecordatoriosTurnos(req, res) {
    const tokenConfigurado = (process.env.REMINDERS_CRON_TOKEN || '').trim();
    const tokenRecibido = String(req.query.token || '').trim();
    const esCronVercel = Boolean(req.headers['x-vercel-cron']);
    const tokenValido = Boolean(tokenConfigurado) && Boolean(tokenRecibido) && tokenConfigurado === tokenRecibido;

    if (!esCronVercel && !tokenValido) {
        return res.status(401).json({ mensaje: 'No autorizado para ejecutar recordatorios.' });
    }

    try {
        const resultado = await notificacionesTurno.procesarRecordatorios();
        return res.status(200).json({
            mensaje: 'Proceso de recordatorios ejecutado.',
            ...resultado
        });
    } catch (error) {
        console.error('Error en controlador.procesarRecordatoriosTurnos:', error);
        return res.status(500).json({
            mensaje: 'Error interno al procesar recordatorios.',
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
    obtenerTurnosConDetalles,
    registrarPagoTurno,
    procesarRecordatoriosTurnos
};