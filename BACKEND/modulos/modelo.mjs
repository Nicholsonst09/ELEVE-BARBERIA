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
        const { error } = await supabaseAdmin
            .from('turnos')
            .delete()
            .eq('id', id);

        if (error) {
            console.error(`Error al eliminar turno con ID ${id} en Supabase:`, error);
            throw new Error(`Error al eliminar turno: ${error.message}`);
        }
        
        return true;
    } catch (error) {
        console.error(`Error en modelo.eliminarTurno (ID: ${id}):`, error);
        throw error;
    }
}


//Funcion para buscar empleados por id del servicio
//(Ver si es necesario traer especialidades y horarios)
async function buscarEmpleadosPorServicio(servicio_id){
    try {
        const {data: empleados, error} = await supabaseAdmin
        .from('empleados_servicios')
        .select(`   
                empleado_id,
                empleados(
                    id,
                    nombre,
                    especialidades,
                    horarios_disponibles,
                    activo
                )
            `)
            .eq('servicio_id', servicio_id)
            .eq('empleados.activo', true);  //Para traer solo los barberos activos

        if (error) {
            throw error;
        }

        const arrayEmpleados = empleados.map(empleado =>({
            id: empleado.empleados.id,
            nombre: empleado.empleados.nombre,
            especialidades: empleado.empleados.especialidades,
            horarios_disponibles: empleado.empleados.horarios_disponibles
        }));

        return arrayEmpleados;

    }catch (error) {
        console.error("Error al buscar empleados por servicio:", error.message);
        throw error;
    }
}

//FUNCION PARA TRAER EL SERVICIO POR NOMBRE
async function obtenerServicioPorNombre(nombreServicio) {
    try {
        const { data: servicio, error } = await supabaseAdmin
            .from('servicios')
            .select('id, nombre, precio, duracion_min')
            .eq('nombre', nombreServicio)
            .eq('activo', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }
        return servicio;
    } catch (error) {
        console.error(`Error al buscar servicio ${nombreServicio}:`, error.message);
        throw error;
    }
}


//FUNCION PARA TRAER SERVICIO POR ID
async function obtenerServicioPorId(servicio_id) {
    try {
        const { data, error } = await supabaseAdmin
            .from('servicios')
            .select('nombre, duracion_min, precio')
            .eq('id', servicio_id)
            .single();

        if (error) {
            throw error;
        }

        return data;
    }catch(error){
        console.error(`Error al buscar servicio con ID ${servicio_id}:`, error.message);
        throw error;
    }
}

const hora_apertura = "09:00";
const hora_cierre = "18:00";

// Funcion para obtener horarios disponibles
async function obtenerHorariosDisponibles(empleado_id, fecha, duracionServicio) {
    try {
        //Obtener turnos ocupados del empleado en esa fecha
        const {data: turnosOcupados, error: errorTurnos} = await supabaseAdmin
            .from('turnos')
            .select('hora_inicio, hora_fin, estado, cliente_id')
            .eq('empleado_id', empleado_id)
            .eq('fecha', fecha)
            .neq('estado', 'cancelado') // Para excluir los cancelados
            .order('hora_inicio', { ascending: true }); //no sé si es necesario
    
            if (errorTurnos) {
                throw errorTurnos;
            }
            
            // Horarios posibles del día
            const horariosDelDia = generarHorariosDelDia(hora_apertura, hora_cierre, duracionServicio);
    
            // Filtrar horarios disponibles
            const horariosDisponibles = horariosDelDia.filter(horario => {
                return !estaOcupado(horario.inicio, horario.fin, turnosOcupados);
            })
    
            //Ver bien lo de generarHorariosDelDia ya que recibiría como parámetro la duracion del servicio
            
            return {
                fecha, 
                empleado_id,
                //servicio_id, 
                //duracion_servicio: duracionServicio,
                horarios_disponibles: horariosDisponibles,
                horarios_ocupados: turnosOcupados,
                total_disponibles: horariosDisponibles.length,
                total_ocupados: turnosOcupados.length,
                resumen: {
                    total_slots_posibles: horariosDelDia.length,
                    porcentaje_ocupacion: Math.round((turnosOcupados.length/horariosDelDia.length) * 100)
                }
            };
    }catch (error) {
        console.error("Error al obtener horarios disponibles:", error.message);
        throw error;
    }
        
}

// Generar horarios del día
function generarHorariosDelDia(horaInicio, horaFin, duracionMinutos) {
    const horarios = [];
    let horaActual = convertirHoraAMinutos(horaInicio);
    const horaLimite = convertirHoraAMinutos(horaFin);

    while (horaActual <= horaLimite - duracionMinutos) {
        const horaInicioFormato = convertirMinutosAHora(horaActual);
        const horaFinFormato = convertirMinutosAHora(horaActual + duracionMinutos);
        
        // Solo agregar si el horario completo está dentro del horario laboral
        horarios.push({
            inicio: horaInicioFormato,
            fin: horaFinFormato,
            disponible: true
        });
        
        horaActual += duracionMinutos; // Incrementar 30 minutos
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
    obtenerServicioPorId,
    obtenerServicioPorNombre,
    eliminarTurno,
    buscarEmpleadosPorServicio,
    obtenerHorariosDisponibles
};
