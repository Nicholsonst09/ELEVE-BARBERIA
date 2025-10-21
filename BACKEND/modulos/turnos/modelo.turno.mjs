import { supabaseAdmin } from "../../db/supabaseClient.mjs";

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
                    cliente_id: cliente_id,
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

            cliente_id,
            empleado_id,
            servicio_id,
            fecha,
            hora_inicio,
            hora_fin,
            estado,
            observaciones,
            precio
        } = turnoModificar;

        const { data, error } = await supabaseAdmin
            .from('turnos')
            .update({
                cliente_id: cliente_id,
                empleado_id: empleado_id,
                servicio_id: servicio_id,
                fecha: fecha,
                hora_inicio: hora_inicio,
                hora_fin: hora_fin,
                estado: estado,
                observaciones: observaciones,
                precio: precio
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

async function obtenerHorariosDisponibles(empleado_id, fecha, duracionServicio) {
    try {
        // Verificar si el negocio está abierto en esa fecha
        const horarioBarberia = obtenerHorariosDelDia(fecha);
        
        if (!horarioBarberia) {
            const [año, mes, dia] = fecha.split('-').map(Number);
            const fechaElegida = new Date(año, mes - 1, dia);
            const diaSemana = fechaElegida.getDay();
            
            return {
                fecha,
                empleado_id,
                error: "El negocio está cerrado este día",
                horarios_disponibles: [],
                horarios_ocupados: [],
                total_disponibles: 0,
                total_ocupados: 0,
                resumen: {
                    total_slots_posibles: 0,
                    porcentaje_ocupacion: 0,
                    dia: obtenerNombreDia(diaSemana),
                    cerrado: true
                }
            };
        }

        //Obtener turnos ocupados del empleado en esa fecha
        const {data: turnosOcupados, error: errorTurnos} = await supabaseAdmin
            .from('turnos')
            .select('hora_inicio, hora_fin, estado, cliente_id')
            .eq('empleado_id', empleado_id)
            .eq('fecha', fecha)
            .neq('estado', 'cancelado') // Para excluir los cancelados
            .order('hora_inicio', { ascending: true });
    
            if (errorTurnos) {
                throw errorTurnos;
            }
            
            // Horarios posibles del día usando la configuración dinámica
            const horariosDelDia = generarHorariosDelDia(
                horarioBarberia.apertura, 
                horarioBarberia.cierre, 
                duracionServicio
            );
    
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
                total_ocupados: turnosOcupados.length,
                horarios_negocio: {
                    apertura: horarioBarberia.apertura,
                    cierre: horarioBarberia.cierre,
                    dia: horarioBarberia.nombreDia
                },
                resumen: {
                    total_slots_posibles: horariosDelDia.length,
                    porcentaje_ocupacion: horariosDelDia.length > 0 ? 
                        Math.round((turnosOcupados.length/horariosDelDia.length) * 100) : 0,
                    cerrado: false
                }
            };
    }catch (error) {
        console.error("Error al obtener horarios disponibles:", error.message);
        throw error;
    }
        
}

//Obtener horarios según el día de la semana
function obtenerHorariosDelDia(fecha) {
    try{
        const [año, mes, dia] = fecha.split('-').map(Number);
        const fechaElegida = new Date(año, mes - 1, dia); // mes - 1 porque Date usa 0-11 para meses
        const diaSemana = fechaElegida.getDay(); // 0 Sería Domingo, 1 Lunes y así
    
        const detalleDelDia = HORARIOS_POR_DIA[diaSemana];

        if (!detalleDelDia || !detalleDelDia.activo) {
            return null; // Barberia cerrada
        }
        
        return {
            apertura: detalleDelDia.apertura,
            cierre: detalleDelDia.cierre,
            dia: diaSemana,
            nombreDia: obtenerNombreDia(diaSemana)
        };
    
    }catch (error) {
        console.error("Error al obtener turnos:", error.message);
        throw error;
    }
}

// Configuración de horarios por día de la semana
const HORARIOS_POR_DIA = {
    1: { // Lunes
        apertura: "13:00",
        cierre: "21:00",
        activo: true
    },
    2: { // Martes
        apertura: "09:00",
        cierre: "18:00",
        activo: true
    },
    3: { // Miércoles
        apertura: "09:00",
        cierre: "18:00",
        activo: true
    },
    4: { // Jueves
        apertura: "09:00",
        cierre: "18:00",
        activo: true
    },
    5: { // Viernes
        apertura: "09:00",
        cierre: "18:00",
        activo: true
    },
    6: { // Sábado
        apertura: "09:00",
        cierre: "18:00",
        activo: true
    },
    0: { // Domingo
        apertura: "09:00",
        cierre: "18:00",
        activo: false // Cerrado 
    }
};

// Función auxiliar para obtener el nombre del día
function obtenerNombreDia(dia) {
    const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return nombresDias[dia];
}

// Función para verificar si el negocio está abierto en una fecha específica
function estaAbierto(fecha) {
    const horarios = obtenerHorariosDelDia(fecha);
    return horarios !== null && horarios.activo !== false;
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

/*
// Obtener todos los horarios de la semana
function obtenerHorariosSemana() {
    return HORARIOS_POR_DIA;
}

// Actualizar horarios de un día específico
function actualizarHorariosDia(dia, nuevosHorarios) {
    if (HORARIOS_POR_DIA[dia]) {
        HORARIOS_POR_DIA[dia] = {
            ...HORARIOS_POR_DIA[dia],
            ...nuevosHorarios
        };
        return true;
    }
    return false;
}

// Validar si una hora está dentro del horario de atención
function validarHoraEnHorario(fecha, hora) {
    const horarioBarberia = obtenerHorariosDelDia(fecha);
    
    if (!horarioBarberia) {
        return { valido: false, motivo: "El negocio está cerrado este día" };
    }
    
    const horaMinutos = convertirHoraAMinutos(hora);
    const aperturaMinutos = convertirHoraAMinutos(horarioBarberia.apertura);
    const cierreMinutos = convertirHoraAMinutos(horarioBarberia.cierre);
    
    if (horaMinutos < aperturaMinutos) {
        return { 
            valido: false, 
            motivo: `La hora debe ser después de ${horarioBarberia.apertura}` 
        };
    }
    
    if (horaMinutos >= cierreMinutos) {
        return { 
            valido: false, 
            motivo: `La hora debe ser antes de ${horarioBarberia.cierre}` 
        };
    }
    
    return { valido: true };
} 
*/

// Función para obtener turnos con todos los detalles necesarios, filtrando opcionalmente por empleado y fecha
async function obtenerTurnosConDetalles({empleadoId, fecha}){
    try{
        let consulta = supabaseAdmin
            .from('turnos')
            .select(`
                id,
                fecha,
                hora_inicio,
                hora_fin,
                observaciones,
                empleados!inner(nombre),           
                clientes!inner(nombre, telefono),
                servicios!inner(nombre)
            `, {count: 'exact'});

            //Filtrar por empleado (si tengo el id)
            if (empleadoId){
                consulta = consulta.eq('empleado_id', empleadoId);
            }

            //Filtrar por fecha (si se da la fecha)
            if (fecha) {            
                consulta = consulta.eq('fecha', fecha); // 'fecha' en formato 'YYYY-MM-DD'
            }

            //Ordenar por fecha y hora
            const { data: turnos, error, count: total_registros } = await consulta
            .order('fecha', { ascending: true })
            .order('hora_inicio', { ascending: true });

            if (error) {
                throw error;
            }
            //Armar la respuesta
            const turnosPresentables = turnos.map(turno => ({
                id: turno.id,
                fecha: turno.fecha,
                hora: turno.hora_inicio, // Combino fecha y hora en el front para mostrar el turno
                hora_fin : turno.hora_fin,
                observaciones: turno.observaciones,

                nombre_empleado: turno.empleados?.nombre || 'N/A',
                nombre_cliente: turno.clientes?.nombre || 'N/A',
                telefono_cliente: turno.clientes?.telefono || 'N/A',
                nombre_servicio: turno.servicios?.nombre || 'N/A'
            }));

            return {
                data: turnosPresentables, 
                total_registros: total_registros,
            };
    } catch (error) {
        console.error("Error al obtener turnos con detalles:", error.message);
        throw error;
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