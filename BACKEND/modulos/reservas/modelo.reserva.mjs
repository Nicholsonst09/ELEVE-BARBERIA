import { supabaseAdmin } from "../../db/supabaseClient.mjs";
import modeloTurno from "../turnos/modelo.turno.mjs";
import modeloCliente from "../clientes/modelo.cliente.mjs";

// ─── Servicios ────────────────────────────────────────────────────────────────

// Devuelve los servicios activos con los campos que necesita el formulario público
async function obtenerServiciosActivos() {
    try {
        const { data: servicios, error } = await supabaseAdmin
            .from('servicios')
            .select(`
                id,
                nombre,
                precio,
                duracion_min,
                descripcion,
                estado_servicio!estado_id(codigo)
            `)
            .order('nombre', { ascending: true });

        if (error) throw error;

        return servicios
            .filter(s => s.estado_servicio?.codigo === 'activo')
            .map(({ estado_servicio, ...s }) => s);
    } catch (error) {
        console.error("Error al obtener servicios para reservas:", error.message);
        throw error;
    }
}

// ─── Empleados por servicio ───────────────────────────────────────────────────

// Devuelve los empleados activos que ofrecen el servicio indicado
async function obtenerEmpleadosPorServicio(servicio_id) {
    try {
        const { data, error } = await supabaseAdmin
            .from('empleados_servicios')
            .select(`
                empleados(
                    id,
                    nombre,
                    avatar_url,
                    estado_id,
                    estado_empleado!estado_id(codigo)
                )
            `)
            .eq('servicio_id', servicio_id);

        if (error) throw error;

        return data
            .filter(e => e.empleados?.estado_empleado?.codigo === 'activo')
            .map(e => ({
                id:         e.empleados.id,
                nombre:     e.empleados.nombre,
                avatar_url: e.empleados.avatar_url || null
            }));
    } catch (error) {
        console.error("Error al obtener empleados por servicio (reservas):", error.message);
        throw error;
    }
}

// ─── Horarios disponibles ─────────────────────────────────────────────────────

// Delega en el modelo de turnos usando origen='web'
async function obtenerHorariosDisponibles(empleado_id, duracion_min, fecha) {
    return modeloTurno.obtenerHorariosDisponibles(empleado_id, fecha, duracion_min, 'web');
}

// ─── Crear reserva ────────────────────────────────────────────────────────────

// Crea o recupera el cliente, luego crea el turno en estado 'reservado'
async function crearReserva({ nombre, telefono, email, servicio_id, empleado_id, fecha, hora_inicio, observaciones }) {
    try {
        // 1. Obtener el servicio para saber precio y duración
        const { data: servicio, error: errorServicio } = await supabaseAdmin
            .from('servicios')
            .select('precio, duracion_min, nombre')
            .eq('id', servicio_id)
            .single();

        if (errorServicio || !servicio) {
            throw new Error('Servicio no encontrado.');
        }

        // 2. Buscar o crear el cliente por teléfono (guardando el email si vino)
        const cliente_id = await modeloCliente.buscarOCrearCliente(nombre, telefono, email || null);
        if (!cliente_id) throw new Error('No se pudo registrar el cliente.');

        // 3. Calcular hora_fin a partir de hora_inicio + duracion_min
        const [hh, mm] = hora_inicio.split(':').map(Number);
        const finMinutos = hh * 60 + mm + servicio.duracion_min;
        const hora_fin = `${String(Math.floor(finMinutos / 60)).padStart(2, '0')}:${String(finMinutos % 60).padStart(2, '0')}`;

        // 4. Verificar solapamiento real con el rango completo del turno
        const conflicto = await modeloTurno.verificarSolapamiento(
            empleado_id,
            fecha,
            hora_inicio,
            hora_fin
        );

        if (conflicto) {
            throw new Error(
                `El profesional ya tiene un turno de ${String(conflicto.hora_inicio || '').substring(0, 5)} a ${String(conflicto.hora_fin || '').substring(0, 5)} que se superpone con el horario solicitado.`
            );
        }

        // 5. Crear el turno
        const turno = await modeloTurno.agregarTurno({
            cliente_id,
            empleado_id,
            servicio_id,
            fecha,
            hora_inicio,
            hora_fin,
            estado: 'reservado',
            precio: servicio.precio,
            observaciones: observaciones || null
        });

        return turno;
    } catch (error) {
        console.error("Error en modelo.crearReserva:", error.message);
        throw error;
    }
}

export default {
    obtenerServiciosActivos,
    obtenerEmpleadosPorServicio,
    obtenerHorariosDisponibles,
    crearReserva
};
