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

// Funcion para obtener horarios disponibles
async function obtenerHorariosDisponibles(empleado_id, fecha, hora_apertura = "09:00", hora_cierre = "18:00") {
    try {
        //Obtener turnos ocupados del empleado en esa fecha
        const {data: turnosOcupados, error} = await supabaseAdmin
            .from('turnos')
            .select('hora_inicio, hora_fin, estado')
            .eq('empleado_id', empleado_id)
            .eq('fecha', fecha)
            .neq('estado', 'cancelado'); // Así se excluyen los cancelados
    
            if (error) {
                throw error;
            }
    
            // Horarios posibles del día
            const horariosDelDia = generarHorariosDelDia(hora_apertura, hora_cierre);
    
            // Filtrar horarios disponibles
            const horariosDisponibles = horariosDelDia.filter(horario => {
                return !estaOcupado(horario.inicio, horario.fin, turnosOcupados);
            })
    
            return {
                fecha, 
                empleado_id,
                horarios_disponibles: horariosDisponibles,
                horarios_ocupados: turnosOcupados,
                total_disponibles: horariosDisponibles.length,
                horario_trabajo: {
                    apertura: hora_apertura,
                    cierre: hora_cierre
                }
            };
    }catch (error) {
        console.error("Error al obtener horarios disponibles:", error.message);
        throw error;
    }
        
}

// Generar horarios del día
function generarHorariosDelDia(horaInicio, horaFin) {
    const horarios = [];
    let horaActual = convertirHoraAMinutos(horaInicio);
    const horaLimite = convertirHoraAMinutos(horaFin);

    while (horaActual < horaLimite) {
        const horaInicioFormato = convertirMinutosAHora(horaActual);
        const horaFinFormato = convertirMinutosAHora(horaActual + 30); // 30 minutos por turno
        
        // Solo agregar si el horario completo está dentro del horario laboral
        if (horaActual + 30 <= horaLimite) {
            horarios.push({
                inicio: horaInicioFormato,
                fin: horaFinFormato,
                disponible: true
            });
        }
        
        horaActual += 30; // Incrementar 30 minutos
    }
    
    return horarios;
}

// Funcion para verificar si un horario está ocupado
function estaOcupado(horaInicio, horaFin, turnosOcupados){
    const inicioMinutos = convertirHoraAMinutos(horaInicio);
    const finMinutos = convertirHoraAMinutos(horaFin);
    
    return turnosOcupados.some(turno => {
        const turnoInicioMinutos = convertirHoraAMinutos(turno.hora_inicio);
        const turnoFinMinutos = convertirHoraAMinutos(turno.hora_fin);
        
        // Verificar si hay solapamiento
        return (inicioMinutos < turnoFinMinutos && finMinutos > turnoInicioMinutos);
    });
}

//Funcion para convertir hora a minutos
function convertirHoraAMinutos(hora) {
    const [horas, minutos] = hora.split(':').map(Number);
    return horas * 60 + minutos;
}

//Funcion para convertir minutos a hora
function convertirMinutosAHora(minutos) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}


export default {
    obtenerTurnos,
    obtenerUnTurno,
    agregarTurno,
    modificarTurno,
    eliminarTurno,
    obtenerHorariosDisponibles
};
