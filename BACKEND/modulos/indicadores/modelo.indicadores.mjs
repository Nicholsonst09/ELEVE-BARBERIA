import { supabaseAdmin } from '../../db/supabaseClient.mjs';
import modeloTurno from '../turnos/modelo.turno.mjs';
import modeloNegocio from '../negocio/modelo.negocio.mjs';

const SELECT_VENTA_INDICADORES = `
    id,
    empleado_id,
    fecha_hora,
    total,
    estado,
    empleados!caja_ventas_empleado_id_fkey(id, nombre, comision_pct),
    metodos_pago!caja_ventas_metodo_pago_id_fkey(id, nombre),
    caja_ventas_items(tipo_item, descripcion, cantidad, subtotal)
`;

const SELECT_TURNO_INDICADORES = `
    id,
    empleado_id,
    precio,
    fecha,
    hora_inicio,
    estado_turno!estado_id(codigo),
    empleados(id, nombre, comision_pct),
    servicios(nombre),
    pagos(metodos_pago(nombre))
`;

function redondear(valor, decimales = 2) {
    return Number(Number(valor || 0).toFixed(decimales));
}

function claveHora(fechaISO) {
    const fecha = new Date(fechaISO);
    if (Number.isNaN(fecha.getTime())) return '00:00';
    return fecha.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Argentina/Buenos_Aires'
    });
}

function fechasEnRango(desdeISO, hastaISO) {
    const fechas = [];
    if (!desdeISO || !hastaISO) return fechas;
    const fin = new Date(hastaISO.slice(0, 10) + 'T00:00:00');
    for (let d = new Date(desdeISO.slice(0, 10) + 'T00:00:00'); d <= fin; d.setDate(d.getDate() + 1)) {
        fechas.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return fechas;
}

// Capacidad real del negocio en un rango de fechas: cuantos slots de
// INTERVALO_GRILLA_MIN podia ocupar cada empleado activo, segun el horario del
// negocio y el horario/descanso propio de cada empleado. Recibe configNegocio y
// empleadosActivos ya resueltos (una sola consulta cada uno) para no pegarle a
// la DB una vez por dia del rango.
function calcularCapacidad(desdeISO, hastaISO, empleadosActivos, configNegocio) {
    const horarios = configNegocio.horarios || [];
    const diasNoLaborables = configNegocio.dias_no_laborables || [];
    const capacidadPorEmpleado = new Map();
    let totalSlotsPosibles = 0;

    for (const fecha of fechasEnRango(desdeISO, hastaISO)) {
        if (modeloTurno.esDiaNoLaborable(fecha, diasNoLaborables)) continue;

        const [anio, mes, dia] = fecha.split('-').map(Number);
        const diaSemana = new Date(anio, mes - 1, dia).getDay();
        const horarioBarberia = modeloTurno.obtenerHorarioDiaDesdeConfigBD(horarios, diaSemana);
        if (!horarioBarberia || !horarioBarberia.activo) continue;

        for (const empleado of empleadosActivos) {
            const horarioEmpleado = modeloTurno.obtenerHorarioEmpleadoParaFecha(empleado.horarios_disponibles, fecha);
            if (horarioEmpleado && horarioEmpleado.activo === false) continue;

            const aperturaEfectiva = modeloTurno.obtenerHoraMayor(
                horarioBarberia.apertura,
                horarioEmpleado?.desde || horarioBarberia.apertura
            );
            const cierreEfectivo = modeloTurno.obtenerHoraMenor(
                horarioBarberia.cierre,
                horarioEmpleado?.hasta || horarioBarberia.cierre
            );

            let minutosDisponibles = Math.max(0,
                modeloTurno.convertirHoraAMinutos(cierreEfectivo) - modeloTurno.convertirHoraAMinutos(aperturaEfectiva)
            );

            if (horarioEmpleado?.descanso?.activo && horarioEmpleado.descanso.desde && horarioEmpleado.descanso.hasta) {
                const minutosDescanso = Math.max(0,
                    modeloTurno.convertirHoraAMinutos(horarioEmpleado.descanso.hasta) -
                    modeloTurno.convertirHoraAMinutos(horarioEmpleado.descanso.desde)
                );
                minutosDisponibles = Math.max(0, minutosDisponibles - minutosDescanso);
            }

            const slots = Math.floor(minutosDisponibles / modeloTurno.INTERVALO_GRILLA_MIN);
            if (slots <= 0) continue;

            totalSlotsPosibles += slots;
            capacidadPorEmpleado.set(empleado.id, (capacidadPorEmpleado.get(empleado.id) || 0) + slots);
        }
    }

    return { totalSlotsPosibles, capacidadPorEmpleado };
}

async function obtenerIndicadoresFinancieros(filtros = {}) {
    try {
        let queryVentas = supabaseAdmin
            .from('caja_ventas')
            .select(SELECT_VENTA_INDICADORES)
            .order('fecha_hora', { ascending: true });

        if (filtros.desde) queryVentas = queryVentas.gte('fecha_hora', filtros.desde);
        if (filtros.hasta) queryVentas = queryVentas.lte('fecha_hora', filtros.hasta);
        if (filtros.empleado_id) queryVentas = queryVentas.eq('empleado_id', Number(filtros.empleado_id));

        let queryTurnos = supabaseAdmin
            .from('turnos')
            .select(SELECT_TURNO_INDICADORES)
            .order('fecha', { ascending: true });

        // turnos.fecha es date (sin hora): se filtra por la porcion de fecha del rango ISO
        if (filtros.desde) queryTurnos = queryTurnos.gte('fecha', filtros.desde.slice(0, 10));
        if (filtros.hasta) queryTurnos = queryTurnos.lte('fecha', filtros.hasta.slice(0, 10));
        if (filtros.empleado_id) queryTurnos = queryTurnos.eq('empleado_id', Number(filtros.empleado_id));

        let queryEmpleados = supabaseAdmin
            .from('empleados')
            .select('id, nombre, horarios_disponibles, estado_empleado!estado_id(codigo)');
        if (filtros.empleado_id) queryEmpleados = queryEmpleados.eq('id', Number(filtros.empleado_id));

        const [
            { data: ventasData, error: errorVentas },
            { data: turnosData, error: errorTurnos },
            { data: empleadosData, error: errorEmpleados },
            configNegocio
        ] = await Promise.all([
            queryVentas,
            queryTurnos,
            queryEmpleados,
            modeloNegocio.obtenerConfigNegocio()
        ]);
        if (errorVentas) throw errorVentas;
        if (errorTurnos) throw errorTurnos;
        if (errorEmpleados) throw errorEmpleados;

        const ventas = ventasData || [];
        const registradas = ventas.filter(v => String(v.estado || '').toLowerCase() !== 'anulada');
        const ventasAnuladasCaja = ventas.length - registradas.length;

        const turnosEnRango = turnosData || [];
        const turnos = turnosEnRango.filter(t =>
            ['completado', 'cancelado'].includes(t.estado_turno?.codigo)
        );
        const turnosCompletados = turnos.filter(t => t.estado_turno?.codigo === 'completado');
        const turnosCancelados = turnos.filter(t => t.estado_turno?.codigo === 'cancelado');
        const turnosReservados = turnosEnRango.filter(t => t.estado_turno?.codigo === 'reservado');

        // Turnos que ocupan un slot real (todo lo que no sea cancelado/anulado),
        // usados para la tasa de ocupacion real del negocio en el rango.
        const turnosActivos = turnosEnRango.filter(t =>
            !['cancelado', 'anulado'].includes(t.estado_turno?.codigo)
        );
        const empleadosActivos = (empleadosData || []).filter(e => e.estado_empleado?.codigo === 'activo');
        const { totalSlotsPosibles, capacidadPorEmpleado } = calcularCapacidad(
            filtros.desde, filtros.hasta, empleadosActivos,
            { horarios: configNegocio?.horarios, dias_no_laborables: configNegocio?.diasNoLaborables }
        );

        const ocupadosPorEmpleadoMap = new Map();
        for (const turno of turnosActivos) {
            const empleadoId = Number(turno.empleados?.id ?? turno.empleado_id ?? 0);
            ocupadosPorEmpleadoMap.set(empleadoId, (ocupadosPorEmpleadoMap.get(empleadoId) || 0) + 1);
        }

        const tasaOcupacion = totalSlotsPosibles > 0
            ? redondear((turnosActivos.length / totalSlotsPosibles) * 100, 1)
            : 0;

        const ocupacionPorEmpleado = empleadosActivos
            .map(empleado => {
                const slots = capacidadPorEmpleado.get(empleado.id) || 0;
                const ocupados = ocupadosPorEmpleadoMap.get(empleado.id) || 0;
                return {
                    empleado_id: empleado.id,
                    nombre: empleado.nombre,
                    porcentaje: slots > 0 ? redondear((ocupados / slots) * 100, 1) : 0
                };
            })
            .sort((a, b) => b.porcentaje - a.porcentaje);

        const ingresosTurnos = turnosCompletados.reduce((acc, t) => acc + Number(t.precio || 0), 0);
        const ingresosCaja = registradas.reduce((acc, v) => acc + Number(v.total || 0), 0);
        const ingresosTotales = ingresosTurnos + ingresosCaja;

        const ventasTotales = turnosCompletados.length + registradas.length;
        const ticketPromedio = ventasTotales > 0 ? ingresosTotales / ventasTotales : 0;

        const operacionesTotales = turnos.length + registradas.length;
        const tasaCancelacionTurnos = turnos.length > 0 ? (turnosCancelados.length / turnos.length) * 100 : 0;

        const porEmpleadoMap = new Map();
        const serviciosPorEmpleadoMap = new Map();
        const porHoraMap = new Map();
        const serviciosMap = new Map();
        const metodosPagoMap = new Map();
        const tipoVentaMap = new Map();

        function acumularEmpleado(empleadoId, nombreEmpleado, comisionPct, monto, comision) {
            const entrada = porEmpleadoMap.get(empleadoId) || {
                empleado_id: empleadoId,
                nombre: nombreEmpleado,
                comisionPct,
                ventas: 0,
                ingresos: 0,
                comision: 0
            };
            entrada.ventas += 1;
            entrada.ingresos += monto;
            entrada.comision += comision;
            porEmpleadoMap.set(empleadoId, entrada);
        }

        // Turnos completados: el nucleo del negocio
        for (const turno of turnosCompletados) {
            const empleado = turno.empleados || {};
            const empleadoId = Number(empleado.id ?? turno.empleado_id ?? 0);
            const nombreEmpleado = empleado.nombre || 'Sin asignar';
            const comisionPct = Number(empleado.comision_pct ?? 0);
            const total = Number(turno.precio || 0);
            const comisionTurno = total * (comisionPct / 100);

            acumularEmpleado(empleadoId, nombreEmpleado, comisionPct, total, comisionTurno);
            serviciosPorEmpleadoMap.set(empleadoId, {
                empleado_id: empleadoId,
                nombre: nombreEmpleado,
                cantidad: (serviciosPorEmpleadoMap.get(empleadoId)?.cantidad || 0) + 1
            });

            const hora = String(turno.hora_inicio || '00:00:00').slice(0, 5);
            porHoraMap.set(hora, (porHoraMap.get(hora) || 0) + 1);

            const metodoPago = turno.pagos?.[0]?.metodos_pago?.nombre || 'Sin definir';
            metodosPagoMap.set(metodoPago, (metodosPagoMap.get(metodoPago) || 0) + total);

            const nombreServicio = turno.servicios?.nombre || 'Servicio';
            serviciosMap.set(nombreServicio, (serviciosMap.get(nombreServicio) || 0) + 1);
            tipoVentaMap.set('Servicios', (tipoVentaMap.get('Servicios') || 0) + total);
        }

        // Ventas de Caja (productos y servicios vendidos por mostrador)
        for (const venta of registradas) {
            const empleado = venta.empleados || {};
            const empleadoId = Number(empleado.id ?? venta.empleado_id ?? 0);
            const nombreEmpleado = empleado.nombre || 'Sin asignar';
            const comisionPct = Number(empleado.comision_pct ?? 0);
            const total = Number(venta.total || 0);
            const items = venta.caja_ventas_items || [];

            const subtotalServicios = items
                .filter(item => String(item.tipo_item || '').toLowerCase() === 'servicio')
                .reduce((acc, item) => acc + Number(item.subtotal || 0), 0);
            const comisionVenta = subtotalServicios > 0
                ? subtotalServicios * (comisionPct / 100)
                : total * (comisionPct / 100);

            acumularEmpleado(empleadoId, nombreEmpleado, comisionPct, total, comisionVenta);

            const hora = claveHora(venta.fecha_hora);
            porHoraMap.set(hora, (porHoraMap.get(hora) || 0) + 1);

            const metodoPago = venta.metodos_pago?.nombre || 'Sin definir';
            metodosPagoMap.set(metodoPago, (metodosPagoMap.get(metodoPago) || 0) + total);

            for (const item of items) {
                const tipoItem = String(item.tipo_item || '').toLowerCase();
                const descripcion = item.descripcion || (tipoItem === 'servicio' ? 'Servicio' : 'Producto');
                const subtotal = Number(item.subtotal || 0);
                if (tipoItem === 'servicio') {
                    serviciosMap.set(descripcion, (serviciosMap.get(descripcion) || 0) + Number(item.cantidad || 1));
                    tipoVentaMap.set('Servicios', (tipoVentaMap.get('Servicios') || 0) + subtotal);
                } else if (tipoItem === 'producto') {
                    tipoVentaMap.set('Productos', (tipoVentaMap.get('Productos') || 0) + subtotal);
                }
            }
        }

        const porEmpleado = Array.from(porEmpleadoMap.values())
            .map(entrada => ({
                ...entrada,
                ingresos: redondear(entrada.ingresos),
                comision: redondear(entrada.comision)
            }))
            .sort((a, b) => b.ingresos - a.ingresos);

        const comisionesTotales = porEmpleado.reduce((acc, entrada) => acc + entrada.comision, 0);
        const utilidadNeta = ingresosTotales - comisionesTotales;

        const serviciosPorEmpleado = Array.from(serviciosPorEmpleadoMap.values())
            .sort((a, b) => b.cantidad - a.cantidad);

        const porHora = Array.from(porHoraMap.entries())
            .map(([hora, cantidad]) => ({ hora, cantidad }))
            .sort((a, b) => a.hora.localeCompare(b.hora));

        const horaPico = porHora.reduce(
            (pico, actual) => (actual.cantidad > pico.cantidad ? actual : pico),
            { hora: null, cantidad: 0 }
        );

        const serviciosPopulares = Array.from(serviciosMap.entries())
            .map(([nombre, cantidad]) => ({ nombre, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad);

        const metodosPago = Array.from(metodosPagoMap.entries())
            .map(([nombre, monto]) => ({ nombre, monto: redondear(monto) }))
            .sort((a, b) => b.monto - a.monto);

        const tipoVenta = Array.from(tipoVentaMap.entries())
            .map(([nombre, monto]) => ({ nombre, monto: redondear(monto) }))
            .sort((a, b) => b.monto - a.monto);

        return {
            rango: { desde: filtros.desde || null, hasta: filtros.hasta || null },
            resumen: {
                ingresosTotales: redondear(ingresosTotales),
                ventasTotales,
                ticketPromedio: redondear(ticketPromedio),
                comisionesTotales: redondear(comisionesTotales),
                utilidadNeta: redondear(utilidadNeta),
                turnosCompletados: turnosCompletados.length,
                turnosCancelados: turnosCancelados.length,
                tasaCancelacionTurnos: redondear(tasaCancelacionTurnos, 1),
                horaPico: horaPico.hora,
                turnosRegistrados: turnosEnRango.length,
                turnosReservados: turnosReservados.length,
                tasaOcupacion
            },
            porEmpleado,
            serviciosPorEmpleado,
            porHora,
            serviciosPopulares,
            metodosPago,
            tipoVenta,
            ocupacionPorEmpleado
        };
    } catch (error) {
        console.error('Error al calcular indicadores financieros:', error.message);
        throw error;
    }
}

export default {
    obtenerIndicadoresFinancieros
};
