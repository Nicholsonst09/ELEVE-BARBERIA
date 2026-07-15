import { supabaseAdmin } from "../../db/supabaseClient.mjs";
import modeloNegocio from '../negocio/modelo.negocio.mjs';
import {
    obtenerFechaDeHoy, obtenerMinutosDesdeMedianoche, TOLERANCIA_ATRASO_ADMIN_MIN,
    permitirRegistroTurnosAtrasados, excedeVentanaRegistroAtrasado
} from '../../config/fechaHoraNegocio.mjs';

const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

// La grilla de horarios ofrece inicios cada 30 min fijos (10:00, 10:30, 11:00...)
// sin importar la duración del servicio; antes avanzaba de a la duración y un
// servicio de 45 min generaba inicios desfasados (10:45, 11:30, 12:15...).
const INTERVALO_GRILLA_MIN = 30;

async function obtenerConfigNegocioDesdeBD() {
    const config = await modeloNegocio.obtenerConfigNegocio();
    return {
        horarios: Array.isArray(config?.horarios) ? config.horarios : [],
        dias_no_laborables: Array.isArray(config?.diasNoLaborables) ? config.diasNoLaborables : []
    };
}

function normalizarDiaNoLaborable(item) {
    if (!item) return null;
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && typeof item.fecha === 'string') return item.fecha;
    return null;
}

function esDiaNoLaborable(fecha, diasNoLaborables = []) {
    return (diasNoLaborables || [])
        .map(normalizarDiaNoLaborable)
        .filter(Boolean)
        .includes(fecha);
}

function obtenerHorarioDiaDesdeConfigBD(horarios = [], diaSemana) {
    const raw = (horarios || []).find(h => Number(h?.dia) === Number(diaSemana));
    if (!raw || typeof raw !== 'object') return null;
    return {
        apertura: raw.apertura || raw.inicio || '09:00',
        cierre: raw.cierre || raw.fin || '21:00',
        activo: raw.activo !== false
    };
}

// Politica por variable de entorno (mismo patron que EMAIL_NOTIFICATIONS_ENABLED):
// con VALIDAR_HORARIO_AL_COMPLETAR_TURNO=true, un turno solo puede marcarse como
// completado dentro de su ventana horaria; apagada o ausente, no se valida.
async function obtenerPoliticasNegocio() {
    return {
        validarHorarioAlCompletarTurno:
            String(process.env.VALIDAR_HORARIO_AL_COMPLETAR_TURNO || 'false').toLowerCase() === 'true'
    };
}

// ─── Cache de estados de turno ────────────────────────────────────────────────
// Evita consultar estado_turno en cada operación. Se invalida nunca (son datos
// de catálogo que no cambian en runtime).
let _estadosTurnoCache = null;

function normalizarCodigoEstado(codigo) {
    if (!codigo) return null;
    return codigo;
}

function resolverCodigoEstadoPersistencia(codigo) {
    if (!codigo) return null;
    return codigo;
}

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
    const estadoCodigoNormalizado = normalizarCodigoEstado(estado_turno?.codigo || null);
    return {
        ...resto,
        estado:          estadoCodigoNormalizado,
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
        const codigoEstado = resolverCodigoEstadoPersistencia(estado || 'reservado');
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
            const codigoEstado = resolverCodigoEstadoPersistencia(estado);
            const estadoObj = estados[codigoEstado];
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
        const horarioBarberia = await obtenerHorariosDelDia(fecha);
        
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

        const { data: empleado, error: errorEmpleado } = await supabaseAdmin
            .from('empleados')
            .select('horarios_disponibles')
            .eq('id', empleado_id)
            .single();

        if (errorEmpleado) throw errorEmpleado;

        const horarioEmpleado = obtenerHorarioEmpleadoParaFecha(empleado?.horarios_disponibles, fecha);

        if (horarioEmpleado && horarioEmpleado.activo === false) {
            const [año, mes, dia] = fecha.split('-').map(Number);
            const fechaElegida = new Date(año, mes - 1, dia);
            const diaSemana = fechaElegida.getDay();

            return {
                fecha,
                empleado_id,
                error: 'El empleado no trabaja este día',
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

        const aperturaEfectiva = obtenerHoraMayor(
            horarioBarberia.apertura,
            horarioEmpleado?.desde || horarioBarberia.apertura
        );
        const cierreEfectivo = obtenerHoraMenor(
            horarioBarberia.cierre,
            horarioEmpleado?.hasta || horarioBarberia.cierre
        );

        if (convertirHoraAMinutos(aperturaEfectiva) >= convertirHoraAMinutos(cierreEfectivo)) {
            return {
                fecha,
                empleado_id,
                error: 'No hay horario disponible del empleado dentro del horario del negocio',
                horarios_disponibles: [],
                horarios_ocupados: [],
                total_disponibles: 0,
                total_ocupados: 0,
                resumen: {
                    total_slots_posibles: 0,
                    porcentaje_ocupacion: 0,
                    dia: horarioBarberia.nombreDia,
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

            const bloquesDescanso = [];
            if (
                horarioEmpleado?.descanso?.activo &&
                horarioEmpleado.descanso.desde &&
                horarioEmpleado.descanso.hasta
            ) {
                bloquesDescanso.push({
                    hora_inicio: horarioEmpleado.descanso.desde,
                    hora_fin: horarioEmpleado.descanso.hasta
                });
            }
            
            // Horarios posibles del día usando la configuración dinámica
            const horariosDelDiaBase = generarHorariosDelDia(
                aperturaEfectiva,
                cierreEfectivo,
                duracionServicio
            );

            // Suma los horarios que arrancan justo al terminar un turno o descanso,
            // aunque no caigan en la grilla fija (ver agregarHorariosPostBloqueo).
            const horariosDelDia = agregarHorariosPostBloqueo(
                horariosDelDiaBase,
                [...turnosOcupados, ...bloquesDescanso],
                aperturaEfectiva,
                cierreEfectivo,
                duracionServicio
            );

            // Filtrar horarios disponibles (sin solapamiento). Los horarios ya pasados
            // se excluyen, salvo que el panel admita carga atrasada
            // (PERMITIR_REGISTRO_TURNOS_ATRASADOS): ahí se mantienen marcados con
            // "pasado: true" (la UI los muestra en gris pero igual seleccionables,
            // para cargar un turno que se realizó y no se llegó a registrar) hasta el
            // límite de la ventana de registro atrasado; más viejos que eso, se excluyen.
            const hoy = obtenerFechaDeHoy();
            const minutosAhora = obtenerMinutosDesdeMedianoche();
            const tolerancia = origen === 'admin' ? TOLERANCIA_ATRASO_ADMIN_MIN : 0;
            const admiteCargaAtrasada = origen === 'admin' && permitirRegistroTurnosAtrasados();

            const horariosDisponibles = horariosDelDia
                .filter(horario => {
                    if (estaOcupado(horario.inicio, horario.fin, turnosOcupados)) return false;
                    if (estaOcupado(horario.inicio, horario.fin, bloquesDescanso)) return false;
                    return true;
                })
                .map(horario => {
                    let esHorarioPasado = fecha < hoy;
                    if (fecha === hoy) {
                        const [hh, mm] = horario.inicio.split(':').map(Number);
                        esHorarioPasado = (hh * 60 + mm) < minutosAhora - tolerancia;
                    }
                    return { ...horario, pasado: esHorarioPasado };
                })
                .filter(horario => {
                    if (!horario.pasado) return true;
                    if (!admiteCargaAtrasada) return false;
                    return !excedeVentanaRegistroAtrasado(fecha, horario.inicio);
                });
            
            return {
                fecha, 
                empleado_id,
                horarios_disponibles: horariosDisponibles,
                horarios_ocupados: turnosOcupados,
                total_disponibles: horariosDisponibles.length,
                total_ocupados: turnosOcupados.length,
                horarios_negocio: {
                    apertura: aperturaEfectiva,
                    cierre: cierreEfectivo,
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

function obtenerHorarioEmpleadoParaFecha(horariosDisponibles, fecha) {
    if (!horariosDisponibles || typeof horariosDisponibles !== 'object') {
        return null;
    }

    const [año, mes, dia] = fecha.split('-').map(Number);
    const fechaElegida = new Date(año, mes - 1, dia);
    const diaSemana = fechaElegida.getDay();
    const clavesPorDia = {
        0: 'domingo',
        1: 'lunes',
        2: 'martes',
        3: 'miercoles',
        4: 'jueves',
        5: 'viernes',
        6: 'sabado'
    };

    const clave = clavesPorDia[diaSemana];
    const horario = horariosDisponibles?.[clave];
    if (!horario) return null;

    return {
        activo: horario.activo !== false,
        desde: horario.desde || '09:00',
        hasta: horario.hasta || '18:00',
        descanso: {
            activo: horario?.descanso?.activo === true,
            desde: horario?.descanso?.desde || null,
            hasta: horario?.descanso?.hasta || null
        }
    };
}

function obtenerHoraMayor(horaA, horaB) {
    return convertirHoraAMinutos(horaA) >= convertirHoraAMinutos(horaB) ? horaA : horaB;
}

function obtenerHoraMenor(horaA, horaB) {
    return convertirHoraAMinutos(horaA) <= convertirHoraAMinutos(horaB) ? horaA : horaB;
}

//Obtener horarios según el día de la semana
async function obtenerHorariosDelDia(fecha) {
    try{
        const [año, mes, dia] = fecha.split('-').map(Number);
        const fechaElegida = new Date(año, mes - 1, dia); // mes - 1 porque Date usa 0-11 para meses
        const diaSemana = fechaElegida.getDay(); // 0 Sería Domingo, 1 Lunes y así

        const configNegocio = await obtenerConfigNegocioDesdeBD();
        if (esDiaNoLaborable(fecha, configNegocio.dias_no_laborables)) {
            return null;
        }

        const detalleDelDia = obtenerHorarioDiaDesdeConfigBD(configNegocio.horarios, diaSemana);

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

// Función auxiliar para obtener el nombre del día
function obtenerNombreDia(dia) {
    return NOMBRES_DIA[dia] || 'Dia desconocido';
}

// Función para verificar si el negocio está abierto en una fecha específica
async function estaAbierto(fecha) {
    const horarios = await obtenerHorariosDelDia(fecha);
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

        horaActual += INTERVALO_GRILLA_MIN;
    }

    return horarios;
}

// Agrega, además de la grilla fija, un candidato arrancando justo al terminar
// cada turno/descanso ocupado. Sin esto, un turno que termina "fuera de grilla"
// (ej: 45min desde las 15:00 -> termina 15:45) hace que el próximo horario
// ofrecido salte directo a la siguiente marca de la grilla (16:00) en vez de
// ofrecer 15:45, dejando un hueco muerto en la agenda.
function agregarHorariosPostBloqueo(horariosDelDia, bloqueos, aperturaEfectiva, cierreEfectivo, duracionMinutos) {
    const inicioJornada = convertirHoraAMinutos(aperturaEfectiva);
    const finJornada = convertirHoraAMinutos(cierreEfectivo);
    const inicios = new Set(horariosDelDia.map(h => h.inicio));
    const extras = [];

    bloqueos.forEach(bloqueo => {
        const finBloqueoMin = convertirHoraAMinutos(bloqueo.hora_fin);
        // Normalizamos a "HH:MM" (la BD puede traer "HH:MM:SS") para que coincida
        // con el formato del resto de la grilla.
        const inicioCandidato = convertirMinutosAHora(finBloqueoMin);

        if (finBloqueoMin < inicioJornada || finBloqueoMin > finJornada - duracionMinutos) return;
        if (inicios.has(inicioCandidato)) return;

        inicios.add(inicioCandidato);
        extras.push({
            inicio: inicioCandidato,
            fin: convertirMinutosAHora(finBloqueoMin + duracionMinutos),
            disponible: true
        });
    });

    return [...horariosDelDia, ...extras].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

// Funcion para verificar si un horario está ocupado
function estaOcupado(horaInicio, horaFin, turnosOcupados){
    const inicioMinutos = convertirHoraAMinutos(horaInicio);
    const finMinutos = convertirHoraAMinutos(horaFin);

    return turnosOcupados.some(turno => {
        const turnoInicioMinutos = convertirHoraAMinutos(turno.hora_inicio);
        const turnoFinMinutos = convertirHoraAMinutos(turno.hora_fin);

        // Verificar si hay solapamiento: el slot se superpone si no está completamente antes/después del turno
        // Dos rangos NO se solapan si: finSlot <= inicioTurno OR inicioSlot >= finTurno
        // Entonces SÍ se solapan si: finSlot > inicioTurno AND inicioSlot < finTurno
        return (finMinutos > turnoInicioMinutos && inicioMinutos < turnoFinMinutos);
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
                empleados!inner(nombre, avatar_url),
                clientes!inner(nombre, telefono),
                servicios!inner(nombre),
                pagos(metodo_pago_id, metodos_pago(nombre), creado)
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
                pago_reciente: (turno.pagos || [])
                    .sort((a, b) => new Date(b.creado || 0) - new Date(a.creado || 0))[0] || null,
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
                metodoPago: ((turno.pagos || [])
                    .sort((a, b) => new Date(b.creado || 0) - new Date(a.creado || 0))[0]
                    ?.metodos_pago?.nombre) || null,

                nombre_empleado: turno.empleados?.nombre || 'N/A',
                avatar_empleado: turno.empleados?.avatar_url || null,
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

async function registrarPagoTurno(turnoId, { metodo, monto = null, registrado_por = null }) {
    try {
        const turnoIdNum = Number(turnoId);
        if (!Number.isFinite(turnoIdNum)) {
            throw new Error('ID de turno invalido.');
        }

        const { data: turno, error: errorTurno } = await supabaseAdmin
            .from('turnos')
            .select('id, precio')
            .eq('id', turnoIdNum)
            .single();

        if (errorTurno) {
            if (errorTurno.code === 'PGRST116') {
                throw new Error('Turno no encontrado.');
            }
            throw errorTurno;
        }

        let { data: metodoPago, error: errorMetodo } = await supabaseAdmin
            .from('metodos_pago')
            .select('id, nombre')
            .eq('nombre', metodo)
            .eq('activo', true)
            .maybeSingle();

        if (errorMetodo) throw errorMetodo;

        if (!metodoPago?.id) {
            const { data: metodoCreado, error: errorCreacionMetodo } = await supabaseAdmin
                .from('metodos_pago')
                .upsert([{ nombre: metodo, activo: true }], { onConflict: 'nombre' })
                .select('id, nombre')
                .single();

            if (errorCreacionMetodo) throw errorCreacionMetodo;
            metodoPago = metodoCreado;
        }

        if (!metodoPago?.id) {
            throw new Error(`No se pudo resolver el metodo de pago '${metodo}'.`);
        }

        const montoFinal = Number.isFinite(Number(monto)) && Number(monto) > 0
            ? Number(monto)
            : Number(turno.precio);

        if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
            throw new Error('No se pudo determinar un monto de pago valido.');
        }

        const { data: pagoExistente, error: errorPagoExistente } = await supabaseAdmin
            .from('pagos')
            .select('id')
            .eq('turno_id', turnoIdNum)
            .order('creado', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (errorPagoExistente) throw errorPagoExistente;

        if (pagoExistente?.id) {
            const payloadUpdate = {
                monto: montoFinal,
                metodo_pago_id: metodoPago.id
            };
            if (registrado_por) payloadUpdate.registrado_por = registrado_por;

            const { error: errorUpdate } = await supabaseAdmin
                .from('pagos')
                .update(payloadUpdate)
                .eq('id', pagoExistente.id);

            if (errorUpdate) throw errorUpdate;
        } else {
            const payloadInsert = {
                turno_id: turnoIdNum,
                monto: montoFinal,
                metodo_pago_id: metodoPago.id,
                registrado_por: registrado_por || null
            };

            const { error: errorInsert } = await supabaseAdmin
                .from('pagos')
                .insert([payloadInsert]);

            if (errorInsert) throw errorInsert;
        }

        return {
            turno_id: turnoIdNum,
            metodo: metodoPago.nombre,
            monto: montoFinal
        };
    } catch (error) {
        console.error(`Error al registrar pago del turno ${turnoId}:`, error.message);
        throw error;
    }
}

// Borra el/los pago(s) registrados de un turno. Se usa cuando un admin
// revierte un turno completado por error: el pago que se había cargado deja
// de tener sentido en el nuevo estado (reservado/cancelado/anulado).
async function eliminarPagoDeTurno(turnoId) {
    try {
        const { error } = await supabaseAdmin
            .from('pagos')
            .delete()
            .eq('turno_id', turnoId);

        if (error) throw error;
    } catch (error) {
        console.error(`Error al eliminar el pago del turno ${turnoId}:`, error.message);
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

    // Comparar en minutos, no como string: la hora recién calculada llega como "HH:MM"
    // mientras que Postgres devuelve las columnas `time` existentes como "HH:MM:SS",
    // y la comparación de strings con distinta precisión daba falsos positivos
    // (p.ej. "16:00" < "16:00:00" es true, aunque sean el mismo horario).
    const nuevoInicioMin = convertirHoraAMinutos(hora_inicio);
    const nuevoFinMin = convertirHoraAMinutos(hora_fin);

    const conflicto = turnosActivos.find(t => {
        const existenteInicioMin = convertirHoraAMinutos(t.hora_inicio);
        const existenteFinMin = convertirHoraAMinutos(t.hora_fin);
        return nuevoInicioMin < existenteFinMin && nuevoFinMin > existenteInicioMin;
    });

    return conflicto || null;
}

// Funcion para actualizar solo el cliente de un turno completado
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

// Funcion para cancelar turnos reservados de una fecha que superaron el umbral de inicio (15 min)
async function cancelarReservadosVencidos(fecha) {
    try {
        const estados = await obtenerEstadosTurnoMap();
        const reservadoId = estados['reservado']?.id;
        const canceladoId  = estados['cancelado']?.id;
        if (!reservadoId || !canceladoId) throw new Error('No se encontraron los estados requeridos en estado_turno.');

        const ahora = new Date();
        const umbral = new Date(ahora.getTime() + 15 * 60000);
        const horaUmbral = `${umbral.getHours().toString().padStart(2, '0')}:${umbral.getMinutes().toString().padStart(2, '0')}`;

        const { data: vencidos, error: errorBusqueda } = await supabaseAdmin
            .from('turnos')
            .select('id')
            .eq('fecha', fecha)
            .eq('estado_id', reservadoId)
            .lte('hora_inicio', horaUmbral);

        if (errorBusqueda) throw errorBusqueda;
        if (!vencidos || vencidos.length === 0) return 0;

        const ids = vencidos.map(t => t.id);

        const { error: errorActualizacion } = await supabaseAdmin
            .from('turnos')
            .update({ estado_id: canceladoId })
            .in('id', ids);

        if (errorActualizacion) throw errorActualizacion;

        console.log(`[limpieza] ${ids.length} turno(s) reservado(s) vencido(s) cancelado(s) para fecha ${fecha}.`);
        return ids.length;
    } catch (error) {
        console.error('Error en modelo.cancelarReservadosVencidos:', error.message);
        throw error;
    }
}

function mapearTurnoNotificacion(turno) {
    return {
        id: turno.id,
        fecha: turno.fecha,
        hora_inicio: turno.hora_inicio,
        hora_fin: turno.hora_fin,
        creado: turno.creado,
        estado: turno.estado_turno?.codigo || null,
        nombre_cliente: turno.clientes?.nombre || 'Cliente',
        email_cliente: turno.clientes?.email || null,
        nombre_empleado: turno.empleados?.nombre || 'Profesional',
        email_empleado: turno.empleados?.email || null,
        nombre_servicio: turno.servicios?.nombre || 'Servicio',
        precio: turno.precio || 0
    };
}

async function obtenerTurnoParaNotificacion(id) {
    try {
        const { data: turno, error } = await supabaseAdmin
            .from('turnos')
            .select(`
                id,
                fecha,
                hora_inicio,
                hora_fin,
                creado,
                precio,
                estado_turno!estado_id(codigo),
                clientes!inner(nombre, email),
                empleados!inner(nombre, email, avatar_url),
                servicios!inner(nombre)
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        return mapearTurnoNotificacion(turno);
    } catch (error) {
        console.error(`Error en modelo.obtenerTurnoParaNotificacion (ID: ${id}):`, error.message);
        throw error;
    }
}

async function obtenerTurnosReservadosEnVentanaRecordatorio(desdeISO, hastaISO) {
    try {
        const desde = new Date(desdeISO);
        const hasta = new Date(hastaISO);
        const fechaDesde = desde.toISOString().split('T')[0];
        const fechaHasta = hasta.toISOString().split('T')[0];

        const { data: turnos, error } = await supabaseAdmin
            .from('turnos')
            .select(`
                id,
                fecha,
                hora_inicio,
                hora_fin,
                creado,
                precio,
                estado_turno!estado_id(codigo),
                clientes!inner(nombre, email),
                empleados!inner(nombre, email, avatar_url),
                servicios!inner(nombre)
            `)
            .gte('fecha', fechaDesde)
            .lte('fecha', fechaHasta)
            .order('fecha', { ascending: true })
            .order('hora_inicio', { ascending: true });

        if (error) throw error;

        return (turnos || [])
            .map(mapearTurnoNotificacion)
            .filter(t => t.estado === 'reservado')
            .filter(t => {
                if (!t.email_cliente) return false;
                const hora = (t.hora_inicio || '').substring(0, 5);
                const inicioTurno = new Date(`${t.fecha}T${hora}:00`);
                const creadoTurno = new Date(t.creado);

                const estaEnVentana = inicioTurno > desde && inicioTurno <= hasta;
                if (!estaEnVentana) return false;

                const minutosAnticipacionAlCrear = (inicioTurno - creadoTurno) / 60000;
                return minutosAnticipacionAlCrear >= 60;
            });
    } catch (error) {
        console.error('Error en modelo.obtenerTurnosReservadosEnVentanaRecordatorio:', error.message);
        throw error;
    }
}

// Cancela por lote turnos reservados puntuales (ej. al cerrar un dia/horario
// desde Negocio). Ignora ids que no existan o que ya no esten en 'reservado'.
async function cancelarTurnosPorIds(ids) {
    try {
        if (!Array.isArray(ids) || ids.length === 0) return [];

        const estados = await obtenerEstadosTurnoMap();
        const reservadoId = estados['reservado']?.id;
        const canceladoId = estados['cancelado']?.id;
        if (!reservadoId || !canceladoId) throw new Error("No se encontraron los estados requeridos en estado_turno.");

        const { data: cancelables, error: errorBusqueda } = await supabaseAdmin
            .from('turnos')
            .select('id')
            .in('id', ids)
            .eq('estado_id', reservadoId);

        if (errorBusqueda) throw errorBusqueda;
        if (!cancelables || cancelables.length === 0) return [];

        const idsValidos = cancelables.map(t => t.id);

        const { error: errorActualizacion } = await supabaseAdmin
            .from('turnos')
            .update({ estado_id: canceladoId })
            .in('id', idsValidos);

        if (errorActualizacion) throw errorActualizacion;

        return idsValidos;
    } catch (error) {
        console.error('Error en modelo.cancelarTurnosPorIds:', error.message);
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
    registrarPagoTurno,
    eliminarPagoDeTurno,
    obtenerPoliticasNegocio,
    verificarSolapamiento,
    cancelarReservadosVencidos,
    cancelarTurnosPorIds,
    obtenerTurnoParaNotificacion,
    // Helpers puros de horarios, reutilizados por el modulo de indicadores para
    // calcular la tasa de ocupacion agregada de un rango de fechas.
    obtenerHorarioDiaDesdeConfigBD,
    esDiaNoLaborable,
    obtenerHorarioEmpleadoParaFecha,
    obtenerHoraMayor,
    obtenerHoraMenor,
    convertirHoraAMinutos,
    INTERVALO_GRILLA_MIN,
    obtenerTurnosReservadosEnVentanaRecordatorio
};