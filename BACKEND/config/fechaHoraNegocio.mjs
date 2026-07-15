// En Vercel las funciones serverless corren en UTC, no en horario de Argentina.
// Estas funciones fuerzan siempre la zona horaria del negocio (America/Argentina/Buenos_Aires)
// para que "ahora" y "hoy" den lo mismo en local que en producción.
const ZONA_HORARIA_NEGOCIO = 'America/Argentina/Buenos_Aires';

function obtenerPartesFechaHora(fecha = new Date()) {
    const formateador = new Intl.DateTimeFormat('en-CA', {
        timeZone: ZONA_HORARIA_NEGOCIO,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const partes = {};
    for (const { type, value } of formateador.formatToParts(fecha)) {
        partes[type] = value;
    }
    return partes;
}

export function obtenerFechaDeHoy(fecha = new Date()) {
    const { year, month, day } = obtenerPartesFechaHora(fecha);
    return `${year}-${month}-${day}`;
}

export function obtenerMinutosDesdeMedianoche(fecha = new Date()) {
    const { hour, minute } = obtenerPartesFechaHora(fecha);
    return Number(hour) * 60 + Number(minute);
}

// Convierte una fecha/hora "de pared" del negocio (ej: fecha="2026-07-14",
// hora="19:30", tal como se guardan los turnos) al instante UTC real que
// representan, sin asumir un offset fijo: se aproxima tratando los numeros
// como UTC y se corrige con el offset real de ZONA_HORARIA_NEGOCIO en ese
// instante (misma logica que usan las librerias de zonas horarias).
export function obtenerInstanteDesdeFechaHora(fecha, hora) {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const [hh, mm] = hora.split(':').map(Number);
    const aproximacion = Date.UTC(anio, mes - 1, dia, hh, mm);
    const { year, month, day, hour, minute } = obtenerPartesFechaHora(new Date(aproximacion));
    const aproximacionLeidaComoUTC = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    const offsetMs = aproximacionLeidaComoUTC - aproximacion;
    return aproximacion - offsetMs;
}

// El panel de gestión puede cargar un turno hasta este atraso después de la hora
// de inicio (ej: a las 19:35 todavía se puede cargar el turno de las 19:30).
// La web pública de reservas no tiene esta tolerancia.
export const TOLERANCIA_ATRASO_ADMIN_MIN = 15;

// Ventana de gracia para cargar turnos con fecha/hora ya pasada desde el panel
// de gestión (ej: se olvidaron de registrar el turno y se dieron cuenta días
// después). Se activa con la env var PERMITIR_REGISTRO_TURNOS_ATRASADOS=true
// (default: false, mismo patron que MODULO_VENTAS_ENABLED). Nunca aplica a la
// web pública de reservas, que usa su propio controlador sin esta lógica.
const VENTANA_REGISTRO_ATRASADO_HORAS = 24 * 7;

export function permitirRegistroTurnosAtrasados() {
    return String(process.env.PERMITIR_REGISTRO_TURNOS_ATRASADOS ?? 'false').toLowerCase() === 'true';
}

export function excedeVentanaRegistroAtrasado(fecha, hora) {
    const instanteTurno = obtenerInstanteDesdeFechaHora(fecha, hora);
    return (Date.now() - instanteTurno) > VENTANA_REGISTRO_ATRASADO_HORAS * 60 * 60 * 1000;
}
