import modelo from "./modelo.turno.mjs";
import modeloServicio from '../servicios/modelo.servicio.mjs';
import notificacionesTurno from './notificaciones.turno.mjs';
import { VALIDAR_HORARIO_AL_COMPLETAR_TURNO } from '../../config/horariosNegocio.mjs';

// ─── MÁQUINA DE ESTADOS ───────────────────────────────────────────────────────
const TRANSICIONES_VALIDAS = {
    'reservado':  ['completado', 'cancelado', 'anulado'],
    'completado': [],   // estado final — sin cambios permitidos
    'cancelado':  [],   // estado final — sin cambios permitidos
    'anulado':    []    // estado final — turno creado por error (solo admin)
};

const ESTADOS_FINALES = ['completado', 'cancelado', 'anulado'];

function normalizarEstado(estado) {
    if (!estado) return estado;
    if (estado === 'pendiente' || estado === 'confirmado') return 'reservado';
    if (estado === 'realizado') return 'completado';
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
    const {
        cliente_id, empleado_id, servicio_id,
        hora_inicio, fecha, hora_fin,
        estado, precio, origen
    } = req.body;

    const estadosPermitidos = ["reservado", "completado", "cancelado", "anulado"];
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

    if (estado && !estadosPermitidos.includes(normalizarEstado(estado))) {
        return res.status(400).json({ mensaje: `El estado '${estado}' no es un estado de turno permitido.` });
    }

    // ── Validación: fecha no pasada y mínimo de anticipación ──────────────
        const ahora = new Date();
        const hoy = ahora.toISOString().split('T')[0];
        if (fecha < hoy) {
            return res.status(400).json({ mensaje: 'No se pueden crear turnos para fechas anteriores a hoy.' });
        }
        if (fecha === hoy) {
            const [hh, mm] = hora_inicio.split(':').map(Number);
            const minutosSlot = hh * 60 + mm;
            const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
            if (minutosSlot < minutosAhora) {
                return res.status(400).json({ mensaje: 'No se puede crear un turno para un horario que ya pasó.' });
            }
            // Web: además necesita 30 min de anticipación
            if (origen !== 'admin' && minutosSlot - minutosAhora < 30) {
                return res.status(400).json({ mensaje: 'El turno debe reservarse con al menos 30 minutos de anticipación.' });
            }
        }
        // ────────────────────────────────────────────────────────────────────────

    try {
        // ── Anti-solapamiento ────────────────────────────────────────────────
        const conflicto = await modelo.verificarSolapamiento(empleado_id, fecha, hora_inicio, hora_fin);
        if (conflicto) {
            return res.status(409).json({
                mensaje: `El profesional ya tiene un turno de ${conflicto.hora_inicio.substring(0,5)} a ${conflicto.hora_fin.substring(0,5)} que se superpone con el horario solicitado.`
            });
        }
        // ────────────────────────────────────────────────────────────────────

        const turnoCreado = await modelo.agregarTurno(req.body);
        if (turnoCreado.estado === 'reservado') {
            notificacionesTurno
                .enviarConfirmacionReserva(turnoCreado.id)
                .catch(error => console.error('[notificaciones] Error enviando confirmación de reserva:', error?.message || error));
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

        if (isNaN(turnoId)) {
            return res.status(400).json({ mensaje: 'El ID del turno no es válido. Debe ser un número.' });
        }

        const turnoExistente = await modelo.obtenerUnTurno(turnoId);
        if (!turnoExistente) {
            return res.status(404).json({ mensaje: "El turno que desea modificar no existe." });
        }

        const fechaActual = turnoExistente.fecha;
        const horaActual = (turnoExistente.hora_inicio || '').substring(0, 5);

        // ── Máquina de estados ───────────────────────────────────────────────
        // Anulado y Cancelado: completamente bloqueados.
        // 'realizado' se maneja como excepción en el bloque siguiente.
        if (ESTADOS_FINALES.includes(turnoExistente.estado) && turnoExistente.estado !== 'completado') {
            return res.status(400).json({ mensaje: `No se puede modificar un turno en estado '${turnoExistente.estado}'.` });
        }

        // Realizado: solo se permite actualizar el cliente
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

        // Si se intenta cambiar el estado, validar que la transición sea permitida
        if (estado && !validarTransicionEstado(turnoExistente.estado, estado)) {
            return res.status(400).json({
                mensaje: `Transición de estado inválida: no se puede pasar de "${turnoExistente.estado}" a "${estado}".`,
                transiciones_permitidas: TRANSICIONES_VALIDAS[turnoExistente.estado]
            });
        }

        const estadoNormalizado = normalizarEstado(estado);

        if (estadoNormalizado === 'anulado' && rolUsuario !== 'admin') {
            return res.status(403).json({ mensaje: 'Solo un administrador puede anular turnos.' });
        }

        // Validación opcional por config: al marcar como realizado, validar ventana horaria.
        if (estadoNormalizado === 'completado' && VALIDAR_HORARIO_AL_COMPLETAR_TURNO) {
            const ahora = new Date();
            const horaInicioStr = (turnoExistente.hora_inicio || '').substring(0, 5);
            const fechaTurno = new Date(`${turnoExistente.fecha}T${horaInicioStr}:00`);
            if (ahora < fechaTurno) {
                return res.status(400).json({ mensaje: 'No se puede marcar el turno como realizado antes de su hora de inicio.' });
            }
            const diffHoras = (ahora - fechaTurno) / (1000 * 60 * 60);
            if (diffHoras > 24) {
                return res.status(400).json({ mensaje: 'No se puede marcar como realizado un turno con más de 24 horas de antigüedad.' });
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

        // ── Validación: fecha no pasada (solo si cambió la fecha) ───────────
        const hoy = new Date().toISOString().split('T')[0];
        const fechaCambio = fecha !== turnoExistente.fecha;
        if (fechaCambio && fecha < hoy) {
            return res.status(400).json({ mensaje: 'No se puede mover un turno a una fecha anterior a hoy.' });
        }
        // ────────────────────────────────────────────────────────────────────

        // ── Anti-solapamiento (solo si cambió algo del horario/empleado) ────
        const horarioCambio = hora_inicio !== turnoExistente.hora_inicio ||
                              hora_fin    !== turnoExistente.hora_fin    ||
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

            if (estadoReservado && fechaReprogramada && horaReprogramada) {
                notificacionesTurno
                    .enviarReprogramacion(turnoId, {
                        fecha: fechaActual,
                        hora_inicio: horaActual,
                        hora_fin: (turnoExistente.hora_fin || '').substring(0, 5)
                    })
                    .catch(error => console.error('[notificaciones] Error enviando email de reprogramación:', error?.message || error));
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

    if (rolUsuario !== 'admin') {
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

    try {
        const resultado = await modelo.registrarPagoTurno(turnoId, {
            metodo: String(metodo).toLowerCase(),
            monto
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

async function procesarRecordatoriosTurnos(req, res) {
    const tokenConfigurado = (process.env.REMINDERS_CRON_TOKEN || '').trim();
    const tokenRecibido = (req.query.token || '').trim();
    const esCronVercel = Boolean(req.headers['x-vercel-cron']);
    const tokenValido = tokenConfigurado && tokenRecibido && tokenConfigurado === tokenRecibido;

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