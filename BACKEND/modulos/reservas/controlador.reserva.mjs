import modelo from './modelo.reserva.mjs';
import notificacionesTurno from '../turnos/notificaciones.turno.mjs';
import { obtenerFechaDeHoy, obtenerMinutosDesdeMedianoche } from '../../config/fechaHoraNegocio.mjs';

// GET /api/v1/reservas/servicios
async function obtenerServicios(req, res) {
    try {
        const servicios = await modelo.obtenerServiciosActivos();
        res.status(200).json(servicios);
    } catch (error) {
        console.error("Error en controlador.reserva.obtenerServicios:", error);
        res.status(500).json({ mensaje: "Error al obtener los servicios.", detalle: error.message });
    }
}

// GET /api/v1/reservas/servicios/:servicio_id/empleados
async function obtenerEmpleadosPorServicio(req, res) {
    try {
        const { servicio_id } = req.params;
        if (!Number(servicio_id)) {
            return res.status(400).json({ mensaje: "El ID del servicio es inválido." });
        }

        const empleados = await modelo.obtenerEmpleadosPorServicio(servicio_id);
        res.status(200).json({ servicio_id, empleados, total: empleados.length });
    } catch (error) {
        console.error("Error en controlador.reserva.obtenerEmpleadosPorServicio:", error);
        res.status(500).json({ mensaje: "Error al obtener los profesionales.", detalle: error.message });
    }
}

// GET /api/v1/reservas/horarios-disponibles/:empleado_id/:servicio_id/:fecha
async function obtenerHorariosDisponibles(req, res) {
    try {
        const { empleado_id, servicio_id, fecha } = req.params;

        if (!Number(empleado_id) || !Number(servicio_id)) {
            return res.status(400).json({ mensaje: "Los IDs de empleado o servicio son inválidos." });
        }

        const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
        if (!regexFecha.test(fecha)) {
            return res.status(400).json({ mensaje: "Formato de fecha inválido. Usar YYYY-MM-DD." });
        }

        // Obtener la duración del servicio
        const { supabaseAdmin } = await import('../../db/supabaseClient.mjs');
        const { data: servicio, error } = await supabaseAdmin
            .from('servicios')
            .select('duracion_min')
            .eq('id', servicio_id)
            .single();

        if (error || !servicio) {
            return res.status(404).json({ mensaje: "Servicio no encontrado." });
        }

        const resultado = await modelo.obtenerHorariosDisponibles(empleado_id, servicio.duracion_min, fecha);
        res.status(200).json(resultado);
    } catch (error) {
        console.error("Error en controlador.reserva.obtenerHorariosDisponibles:", error);
        res.status(500).json({ mensaje: "Error al obtener los horarios.", detalle: error.message });
    }
}

// POST /api/v1/reservas
async function crearReserva(req, res) {
    try {
        const { nombre, telefono, email, servicio_id, empleado_id, fecha, hora_inicio, observaciones } = req.body;

        // Validaciones de campos requeridos
        if (!nombre?.trim()) {
            return res.status(400).json({ mensaje: "El nombre del cliente es requerido." });
        }
        if (!telefono?.trim()) {
            return res.status(400).json({ mensaje: "El teléfono del cliente es requerido." });
        }
        if (!email?.trim()) {
            return res.status(400).json({ mensaje: "El email del cliente es requerido." });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ mensaje: "El formato del email es inválido." });
        }
        if (!Number(servicio_id) || !Number(empleado_id)) {
            return res.status(400).json({ mensaje: "Los IDs de servicio y empleado son requeridos." });
        }

        const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
        const regexHora  = /^\d{2}:\d{2}$/;
        if (!regexFecha.test(fecha)) {
            return res.status(400).json({ mensaje: "Formato de fecha inválido. Usar YYYY-MM-DD." });
        }
        if (!regexHora.test(hora_inicio)) {
            return res.status(400).json({ mensaje: "Formato de hora inválido. Usar HH:MM." });
        }

        // Validar que la fecha no sea pasada
        const hoy = obtenerFechaDeHoy();
        if (fecha < hoy) {
            return res.status(400).json({ mensaje: "No se pueden crear reservas para fechas anteriores a hoy." });
        }

        // Validar que no sea un horario que ya pasó
        if (fecha === hoy) {
            const [hh, mm] = hora_inicio.split(':').map(Number);
            const minutosSlot  = hh * 60 + mm;
            const minutosAhora = obtenerMinutosDesdeMedianoche();
            if (minutosSlot < minutosAhora) {
                return res.status(400).json({ mensaje: "No se puede crear una reserva para un horario que ya pasó." });
            }
        }

        const turno = await modelo.crearReserva({
            nombre: nombre.trim(),
            telefono: telefono.trim(),
            email: email.trim(),
            servicio_id,
            empleado_id,
            fecha,
            hora_inicio,
            observaciones
        });

        if (turno?.id) {
            try {
                await notificacionesTurno.enviarConfirmacionReserva(turno.id);
            } catch (error) {
                console.error('[notificaciones] Error enviando confirmación de reserva web:', error?.message || error);
            }
        }

        res.status(201).json({
            mensaje: "Reserva creada con éxito.",
            turno
        });
    } catch (error) {
        console.error("Error en controlador.reserva.crearReserva:", error);
        const mensaje = String(error?.message || '');
        if (mensaje.includes('se superpone')) {
            return res.status(409).json({ mensaje: mensaje });
        }
        if (
            mensaje.includes('Servicio no encontrado') ||
            mensaje.includes('No se pudo registrar el cliente') ||
            mensaje.includes("estado_turno")
        ) {
            return res.status(400).json({ mensaje: mensaje });
        }
        res.status(500).json({ mensaje: "Error al crear la reserva.", detalle: error.message });
    }
}

export default {
    obtenerServicios,
    obtenerEmpleadosPorServicio,
    obtenerHorariosDisponibles,
    crearReserva
};
