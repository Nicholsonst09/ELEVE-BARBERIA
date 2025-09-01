// modulos/modelo.mjs
import { supabaseAdmin } from './supabaseClient.mjs'; // Importa el cliente Supabase con service_role

// Función para obtener todos los turnos
async function obtenerTurnos() {
    try {
        const { data: turnos, error } = await supabaseAdmin
            .from('turnos')
            .select(`
                id,
                cliente_id,
                empleado_id,
                servicio_id,
                fecha,
                hora_inicio,
                hora_fin,
                estado,
                observaciones,
                precio,
                creado,
                modificado
                `)
            .order('fecha', { ascending: true })
            .order('hora_inicio', { ascending: true });

        if (error) {
            throw error;
        }
        return turnos;
    } catch (error) {
        console.error("Error al obtener turnos:", error.message);
        throw error;
    }
}

// Función para obtener un turno por ID
async function obtenerUnTurno(id) {
    try {
        const { data: turno, error } = await supabaseAdmin
            .from('turnos')
            .select(`
                id,
                cliente_id,
                empleado_id,
                servicio_id,
                fecha,
                hora_inicio,
                hora_fin,
                estado,
                observaciones,
                precio,
                creado,
                modificado
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }
        return turno;
    } catch (error) {
        console.error(`Error al obtener turno con ID ${id}:`, error.message);
        throw error;
    }
}

//Función para consultar disponbilidad por fecha, hora y empleado
async function consultarDisponibilidad(fecha, hora_inicio, empleado_id) {
    try {

    } catch (error) {
        console.error(`Error al consultar disponibilidad: `, error.message);
        throw error;
    }
}

// Función para agregar un turno

async function agregarTurno(nuevoTurno) {
    try {
        const { 
            cliente_id,
            empleado_id,
            servicio_id,
            fecha,
            hora_inicio,
            hora_fin,
            estado,
            observaciones,
            precio
        } = nuevoTurno;

        const { data, error } = await supabaseAdmin
            .from('turnos')
            .insert([
                {
                    id: id,
                    cliente_id: cliente_id,
                    empleado_id: empleado_id,
                    servicio_id: servicio_id,
                    fecha: fecha,
                    hora_inicio: hora_inicio,
                    hora_fin: hora_fin,
                    estado: estado,
                    observaciones: observaciones,
                    precio: precio,
                    creado: creado,
                    modificado: modificado
                    cliente_id,
                    empleado_id,
                    servicio_id,
                    fecha,
                    hora_inicio,
                    hora_fin,
                    estado: estado || 'pendiente', //Sería como el valor por defecto si no se especifica
                    observaciones: observaciones || null,
                    precio
                }
            ])
            .select()
            .single();

        if (error) {
            console.error("Error al agregar turno en Supabase:", error);
            throw new Error(`Error al agregar turno: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error("Error en modelo.agregarTurno:", error);
        throw error;
    }
}

// Función para modificar un turno
async function modificarTurno(id, turnoModificar) {
    try {

        const {
            id,
            cliente_id,
            empleado_id,
            servicio_id,
            fecha,
            hora_inicio,
            hora_fin,
            estado,
            observaciones,
            precio,
            creado,
            modificado
        } = turnoModificar;

        const { data, error } = await supabaseAdmin
            .from('turnos')
            .update({
                id: id,
                cliente_id: cliente_id,
                empleado_id: empleado_id,
                servicio_id: servicio_id,
                fecha: fecha,
                hora_inicio: hora_inicio,
                hora_fin: hora_fin,
                estado: estado,
                observaciones: observaciones,
                precio: precio,
                creado: creado,
                modificado: modificado
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error(`Error al modificar turno con ID ${id} en Supabase:`, error);
            throw new Error(`Error al modificar turno: ${error.message}`);
        }

        return data !== null;
    } catch (error) {
        console.error(`Error en modelo.modificarTurno (ID: ${id}):`, error);
        throw error;
    }
}

// Función para eliminar un turno
async function eliminarTurno(id) {
    try {
        const { error, count } = await supabaseAdmin
            .from('turnos')
            .delete()
            .eq('id', id);

        if (error) {
            console.error(`Error al eliminar turno con ID ${id} en Supabase:`, error);
            throw new Error(`Error al eliminar turno: ${error.message}`);
        }

        return count > 0;
    } catch (error) {
        console.error(`Error en modelo.eliminarTurno (ID: ${id}):`, error);
        throw error;
    }
}

1



export default {
    obtenerTurnos,
    obtenerUnTurno,
    agregarTurno,
    modificarTurno,
    eliminarTurno,
};
