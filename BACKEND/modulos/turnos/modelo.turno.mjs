import { supabaseAdmin } from "../../db/supabaseClient.mjs";

// ─── Cache de estados de turno ────────────────────────────────────────────────
// Evita consultar estado_turno en cada operación. Se invalida nunca (son datos
// de catálogo que no cambian en runtime).
let _estadosTurnoCache = null;

async function obtenerEstadosTurnoMap() {
    if (_estadosTurnoCache) return _estadosTurnoCache;
    const { data, error } = await supabaseAdmin
        .from('estado_turno')
        .select('id, codigo, nombre, permite_cambios');
    if (error) throw error;
    _estadosTurnoCache = {};
    data.forEach(e => { _estadosTurnoCache[e.codigo] = e; });
    return _estadosTurnoCache;
}

// Selector reutilizable para turnos (incluye el join con estado_turno)
const SELECT_TURNO_BASE = `
    id,
    cliente_id,
    empleado_id,
    servicio_id,
    fecha,
    hora_inicio,
    hora_fin,
    estado_id,
    observaciones,
    precio,
    creado,
    modificado,
    estado_turno!estado_id(id, codigo, nombre, permite_cambios)
`;

// Aplana el objeto embebido estado_turno al campo 'estado' (string) que
// usa el controlador, manteniendo compatibilidad con la máquina de estados.
function mapearEstado(turno) {
    const { estado_turno, ...resto } = turno;
    return {
        ...resto,
        estado:          estado_turno?.codigo        || null,
        estado_nombre:   estado_turno?.nombre         || null,
        permite_cambios: estado_turno?.permite_cambios ?? true
    };
}

// Función para obtener todos los turnos
async function obtenerTurnos() {
    try {
        const { data: turnos, error } = await supabaseAdmin
            .from('turnos')
            .select(SELECT_TURNO_BASE)
            .order('fecha', { ascending: true })
            .order('hora_inicio', { ascending: true });

        if (error) throw error;
        return turnos.map(mapearEstado);
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
            .select(SELECT_TURNO_BASE)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return mapearEstado(turno);
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

        // Resolver el código de estado a su ID en la tabla estado_turno
        const estados = await obtenerEstadosTurnoMap();
        const codigoEstado = estado || 'pendiente';
        const estadoObj = estados[codigoEstado];
        if (!estadoObj) throw new Error(`Estado '${codigoEstado}' no encontrado en estado_turno.`);

        const { data, error } = await supabaseAdmin
            .from('turnos')
            .insert([{
                cliente_id,
                empleado_id,
                servicio_id,
                fecha,
                hora_inicio,
                hora_fin,
                estado_id: estadoObj.id,
                observaciones: observaciones || null,
                precio
            }])
            .select(SELECT_TURNO_BASE)
            .single();

        if (error) {
            console.error("Error al agregar turno en Supabase:", error);
            throw new Error(`Error al agregar turno: ${error.message}`);
        }

        return mapearEstado(data);
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

        const actualizacion = {
            cliente_id,
            empleado_id,
            servicio_id,
            fecha,
            hora_inicio,
            hora_fin,
            observaciones,
            precio
        };

        // Resolver estado → estado_id solo si se envió un estado
        if (estado !== undefined) {
            const estados = await obtenerEstadosTurnoMap();
            const estadoObj = estados[estado];
            if (!estadoObj) throw new Error(`Estado '${estado}' no encontrado en estado_turno.`);
            actualizacion.estado_id = estadoObj.id;
        }

        const { data, error } = await supabaseAdmin
            .from('turnos')
            .update(actualizacion)
            .eq('id', id)
            .select(SELECT_TURNO_BASE)
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

async function obtenerHorariosDisponibles(empleado_id, fecha, duracionServicio, origen = 'web') {
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

        // Obtener turnos del empleado en esa fecha y filtrar activos en JS
        const {data: turnosBD, error: errorTurnos} = await supabaseAdmin
            .from('turnos')
            .select('hora_inicio, hora_fin, estado_turno!estado_id(codigo)')
            .eq('empleado_id', empleado_id)
            .eq('fecha', fecha)
            .order('hora_inicio', { ascending: true });

            if (errorTurnos) {
                throw errorTurnos;
            }

            // Excluir cancelados y anulados (no bloquean horarios)
            const turnosOcupados = turnosBD.filter(t =>
                !['cancelado', 'anulado'].includes(t.estado_turno?.codigo)
            );
            
            // Horarios posibles del día usando la configuración dinámica
            const horariosDelDia = generarHorariosDelDia(
                horarioBarberia.apertura, 
                horarioBarberia.cierre, 
                duracionServicio
            );
    
            // Filtrar horarios disponibles (sin solapamiento y con anticipación mínima)
            const ahora = new Date();
            const hoy = ahora.toISOString().split('T')[0];
            const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

            const horariosDisponibles = horariosDelDia.filter(horario => {
                if (estaOcupado(horario.inicio, horario.fin, turnosOcupados)) return false;
                if (fecha === hoy) {
                    const [hh, mm] = horario.inicio.split(':').map(Number);
                    const minutosSlot = hh * 60 + mm;
                    // Admin: excluir solo los que ya pasaron. Web: excluir los que tienen menos de 30 min
                    if (origen === 'admin') {
                        if (minutosSlot < minutosAhora) return false;
                    } else {
                        if (minutosSlot - minutosAhora < 30) return false;
                    }
                }
                return true;
            });
            
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
        cierre: "21:00",
        activo: true
    },
    3: { // Miércoles
        apertura: "09:00",
        cierre: "21:00",
        activo: true
    },
    4: { // Jueves
        apertura: "09:00",
        cierre: "21:00",
        activo: true
    },
    5: { // Viernes
        apertura: "09:00",
        cierre: "21:00",
        activo: true
    },
    6: { // Sábado
        apertura: "09:00",
        cierre: "21:00",
        activo: true
    },
    0: { // Domingo
        apertura: "09:00",
        cierre: "21:00",
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
                estado_id,
                precio,
                observaciones,
                cliente_id,
                empleado_id,
                servicio_id,
                estado_turno!estado_id(id, codigo, nombre, permite_cambios),
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
                hora: turno.hora_inicio,
                hora_fin : turno.hora_fin,
                estado: turno.estado_turno?.codigo  || null,
                estado_nombre: turno.estado_turno?.nombre || null,
                permite_cambios: turno.estado_turno?.permite_cambios ?? true,
                precio: turno.precio,
                cliente_id: turno.cliente_id,
                empleado_id: turno.empleado_id,
                servicio_id: turno.servicio_id,
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

// Función para verificar si un turno se solapa con otro del mismo empleado
async function verificarSolapamiento(empleado_id, fecha, hora_inicio, hora_fin, turno_id_excluir = null) {
    let query = supabaseAdmin
        .from('turnos')
        .select('id, hora_inicio, hora_fin, estado_turno!estado_id(codigo)')
        .eq('empleado_id', empleado_id)
        .eq('fecha', fecha);

    if (turno_id_excluir) {
        query = query.neq('id', turno_id_excluir);
    }

    const { data: turnosExistentes, error } = await query;
    if (error) throw error;

    // Excluir cancelados y anulados en JS (más confiable que filtrar sobre FK en PostgREST)
    const turnosActivos = turnosExistentes.filter(t =>
        !['cancelado', 'anulado'].includes(t.estado_turno?.codigo)
    );

    const conflicto = turnosActivos.find(t =>
        hora_inicio < t.hora_fin && hora_fin > t.hora_inicio
    );

    return conflicto || null;
}

// Función para actualizar solo el cliente de un turno (usado cuando estado = 'realizado')
async function modificarSoloCliente(id, cliente_id) {
    try {
        const { data, error } = await supabaseAdmin
            .from('turnos')
            .update({ cliente_id })
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(`Error al modificar cliente: ${error.message}`);
        return data !== null;
    } catch (error) {
        console.error(`Error en modelo.modificarSoloCliente (ID: ${id}):`, error);
        throw error;
    }
}

// Función para cancelar turnos pendientes de una fecha que superaron el umbral de confirmación (15 min antes)
async function cancelarPendientesVencidos(fecha) {
    try {
        const estados = await obtenerEstadosTurnoMap();
        const pendienteId = estados['pendiente']?.id;
        const canceladoId  = estados['cancelado']?.id;
        if (!pendienteId || !canceladoId) throw new Error('No se encontraron los estados requeridos en estado_turno.');

        const ahora = new Date();
        const umbral = new Date(ahora.getTime() + 15 * 60000);
        const horaUmbral = `${umbral.getHours().toString().padStart(2, '0')}:${umbral.getMinutes().toString().padStart(2, '0')}`;

        const { data: vencidos, error: errorBusqueda } = await supabaseAdmin
            .from('turnos')
            .select('id')
            .eq('fecha', fecha)
            .eq('estado_id', pendienteId)
            .lte('hora_inicio', horaUmbral);

        if (errorBusqueda) throw errorBusqueda;
        if (!vencidos || vencidos.length === 0) return 0;

        const ids = vencidos.map(t => t.id);

        const { error: errorActualizacion } = await supabaseAdmin
            .from('turnos')
            .update({ estado_id: canceladoId })
            .in('id', ids);

        if (errorActualizacion) throw errorActualizacion;

        console.log(`[limpieza] ${ids.length} turno(s) pendiente(s) vencido(s) cancelado(s) para fecha ${fecha}.`);
        return ids.length;
    } catch (error) {
        console.error('Error en modelo.cancelarPendientesVencidos:', error.message);
        throw error;
    }
}

export default {
    obtenerTurnos,
    obtenerUnTurno,
    agregarTurno,
    modificarTurno,
    modificarSoloCliente,
    eliminarTurno,
    obtenerHorariosDisponibles,
    obtenerTurnosConDetalles,
    verificarSolapamiento,
    cancelarPendientesVencidos
};