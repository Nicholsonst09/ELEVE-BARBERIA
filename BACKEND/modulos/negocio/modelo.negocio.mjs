import { supabaseAdmin } from '../../db/supabaseClient.mjs';
import { eliminarImagenStorage } from '../../config/imagen.mjs';

const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

const HORARIOS_DEFAULT_POR_DIA = {
    0: { activo: false, inicio: '09:00', fin: '21:00' },
    1: { activo: true, inicio: '13:00', fin: '21:00' },
    2: { activo: true, inicio: '09:00', fin: '21:00' },
    3: { activo: true, inicio: '09:00', fin: '21:00' },
    4: { activo: true, inicio: '09:00', fin: '21:00' },
    5: { activo: true, inicio: '09:00', fin: '21:00' },
    6: { activo: true, inicio: '09:00', fin: '21:00' }
};

const PUBLICO_DEFAULT = {
    nombre: 'ELEVÉ Barbería',
    logoUrl: '',
    reservaImagenUrl: '',
    telefono: '',
    email: '',
    whatsapp: '',
    instagram: '',
    facebook: '',
    direccion: '',
    mapsEmbed: '',
    mapsLink: ''
};

function normalizarTexto(valor, fallback = '') {
    if (typeof valor !== 'string') return fallback;
    const limpio = valor.trim();
    return limpio || fallback;
}

function construirPayloadHorarios(horariosPorDia) {
    return Object.entries(horariosPorDia || {}).map(([dia, item]) => ({
        dia: Number(dia),
        nombre: NOMBRES_DIA[Number(dia)] || `Dia ${dia}`,
        apertura: item?.inicio || '09:00',
        cierre: item?.fin || '21:00',
        activo: item?.activo !== false
    })).sort((a, b) => a.dia - b.dia);
}

function sanitizarHorariosEntrada(horarios) {
    const base = { ...HORARIOS_DEFAULT_POR_DIA };

    if (!Array.isArray(horarios)) {
        return base;
    }

    for (const item of horarios) {
        const dia = Number(item?.dia);
        if (!Number.isInteger(dia) || dia < 0 || dia > 6) continue;

        const inicio = String(item?.apertura || '').trim();
        const fin = String(item?.cierre || '').trim();
        const activo = item?.activo !== false;

        base[dia] = {
            activo,
            inicio: inicio || base[dia].inicio,
            fin: fin || base[dia].fin
        };
    }

    return base;
}

async function obtenerFilaConfig() {
    const { data, error } = await supabaseAdmin
        .from('negocio_config')
        .select('id, timezone, horarios_por_dia, dias_no_laborables, nombre, logo_url, reserva_imagen_url, telefono, email, whatsapp, instagram, facebook, direccion, maps_embed, maps_link, creado, modificado')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) throw error;

    if (data) return data;

    const payload = {
        timezone: 'America/Argentina/Buenos_Aires',
        horarios_por_dia: HORARIOS_DEFAULT_POR_DIA,
        dias_no_laborables: [],
        nombre: PUBLICO_DEFAULT.nombre,
        logo_url: PUBLICO_DEFAULT.logoUrl,
        reserva_imagen_url: PUBLICO_DEFAULT.reservaImagenUrl,
        telefono: PUBLICO_DEFAULT.telefono,
        email: PUBLICO_DEFAULT.email,
        whatsapp: PUBLICO_DEFAULT.whatsapp,
        instagram: PUBLICO_DEFAULT.instagram,
        facebook: PUBLICO_DEFAULT.facebook,
        direccion: PUBLICO_DEFAULT.direccion,
        maps_embed: PUBLICO_DEFAULT.mapsEmbed,
        maps_link: PUBLICO_DEFAULT.mapsLink
    };

    const { data: creada, error: errorCreacion } = await supabaseAdmin
        .from('negocio_config')
        .insert([payload])
        .select('id, timezone, horarios_por_dia, dias_no_laborables, nombre, logo_url, reserva_imagen_url, telefono, email, whatsapp, instagram, facebook, direccion, maps_embed, maps_link, creado, modificado')
        .single();

    if (errorCreacion) throw errorCreacion;

    return creada;
}

async function obtenerConfigNegocio() {
    const fila = await obtenerFilaConfig();

    return {
        id: fila.id,
        timezone: fila.timezone,
        horarios: construirPayloadHorarios(fila.horarios_por_dia || HORARIOS_DEFAULT_POR_DIA),
        diasNoLaborables: Array.isArray(fila.dias_no_laborables) ? fila.dias_no_laborables : [],
        nombre: normalizarTexto(fila.nombre, PUBLICO_DEFAULT.nombre),
        logoUrl: normalizarTexto(fila.logo_url),
        reservaImagenUrl: normalizarTexto(fila.reserva_imagen_url),
        telefono: normalizarTexto(fila.telefono),
        email: normalizarTexto(fila.email),
        whatsapp: normalizarTexto(fila.whatsapp),
        instagram: normalizarTexto(fila.instagram),
        facebook: normalizarTexto(fila.facebook),
        direccion: normalizarTexto(fila.direccion),
        mapsEmbed: normalizarTexto(fila.maps_embed),
        mapsLink: normalizarTexto(fila.maps_link),
        creado: fila.creado,
        modificado: fila.modificado
    };
}

async function actualizarHorariosNegocio({
    horarios,
    diasNoLaborables,
    timezone,
    nombre,
    logoUrl,
    reservaImagenUrl,
    telefono,
    email,
    whatsapp,
    instagram,
    facebook,
    direccion,
    mapsEmbed,
    mapsLink
}) {
    const fila = await obtenerFilaConfig();

    const updatePayload = {
        modificado: new Date().toISOString()
    };

    if (Array.isArray(horarios)) {
        updatePayload.horarios_por_dia = sanitizarHorariosEntrada(horarios);
    }

    if (Array.isArray(diasNoLaborables)) {
        updatePayload.dias_no_laborables = diasNoLaborables;
    }

    if (timezone && typeof timezone === 'string') {
        updatePayload.timezone = timezone.trim();
    }

    const camposTexto = [
        ['nombre', nombre],
        ['logo_url', logoUrl],
        ['reserva_imagen_url', reservaImagenUrl],
        ['telefono', telefono],
        ['email', email],
        ['whatsapp', whatsapp],
        ['instagram', instagram],
        ['facebook', facebook],
        ['direccion', direccion],
        ['maps_embed', mapsEmbed],
        ['maps_link', mapsLink]
    ];

    for (const [destino, valor] of camposTexto) {
        if (valor !== undefined) {
            updatePayload[destino] = normalizarTexto(valor);
        }
    }

    const { data, error } = await supabaseAdmin
        .from('negocio_config')
        .update(updatePayload)
        .eq('id', fila.id)
        .select('id, timezone, horarios_por_dia, dias_no_laborables, nombre, logo_url, reserva_imagen_url, telefono, email, whatsapp, instagram, facebook, direccion, maps_embed, maps_link, creado, modificado')
        .single();

    if (error) throw error;

    // Logo/foto de reserva viejos ya no tienen referencia en la BD una vez
    // pisados por los nuevos: se borran del storage para no acumular
    // archivos huérfanos.
    if (updatePayload.logo_url !== undefined && fila.logo_url && fila.logo_url !== updatePayload.logo_url) {
        await eliminarImagenStorage(fila.logo_url);
    }
    if (updatePayload.reserva_imagen_url !== undefined && fila.reserva_imagen_url && fila.reserva_imagen_url !== updatePayload.reserva_imagen_url) {
        await eliminarImagenStorage(fila.reserva_imagen_url);
    }

    return {
        id: data.id,
        timezone: data.timezone,
        horarios: construirPayloadHorarios(data.horarios_por_dia),
        diasNoLaborables: Array.isArray(data.dias_no_laborables) ? data.dias_no_laborables : [],
        nombre: normalizarTexto(data.nombre, PUBLICO_DEFAULT.nombre),
        logoUrl: normalizarTexto(data.logo_url),
        reservaImagenUrl: normalizarTexto(data.reserva_imagen_url),
        telefono: normalizarTexto(data.telefono),
        email: normalizarTexto(data.email),
        whatsapp: normalizarTexto(data.whatsapp),
        instagram: normalizarTexto(data.instagram),
        facebook: normalizarTexto(data.facebook),
        direccion: normalizarTexto(data.direccion),
        mapsEmbed: normalizarTexto(data.maps_embed),
        mapsLink: normalizarTexto(data.maps_link),
        creado: data.creado,
        modificado: data.modificado
    };
}

function calcularMotivoConflicto(turno, horariosPorDia, fechasCerradas) {
    if (fechasCerradas.has(turno.fecha)) return 'Día cerrado puntual';

    const [anio, mes, dia] = String(turno.fecha).split('-').map(Number);
    const diaSemana = new Date(anio, (mes || 1) - 1, dia || 1).getDay();
    const horarioDia = horariosPorDia[diaSemana];

    if (!horarioDia || horarioDia.activo === false) return 'Día no laborable';

    const horaInicio = String(turno.hora_inicio || '').slice(0, 5);
    const horaFin = String(turno.hora_fin || '').slice(0, 5);
    if (horaInicio < horarioDia.inicio || horaFin > horarioDia.fin) return 'Fuera del horario de atención';

    return null;
}

// Detecta turnos reservados que quedarian fuera de una configuracion de
// horarios/dias-no-laborables propuesta (aun no guardada), para poder
// avisarle al admin antes de aplicar el cambio.
async function obtenerTurnosEnConflicto({ horarios, diasNoLaborables } = {}) {
    const fila = await obtenerFilaConfig();

    const horariosPorDia = Array.isArray(horarios)
        ? sanitizarHorariosEntrada(horarios)
        : (fila.horarios_por_dia || HORARIOS_DEFAULT_POR_DIA);

    const diasCerrados = Array.isArray(diasNoLaborables)
        ? diasNoLaborables
        : (fila.dias_no_laborables || []);
    const fechasCerradas = new Set(diasCerrados.map((d) => d.fecha));

    const { data: estadoReservado, error: errorEstado } = await supabaseAdmin
        .from('estado_turno')
        .select('id')
        .eq('codigo', 'reservado')
        .single();
    if (errorEstado) throw errorEstado;

    const hoy = new Date().toISOString().slice(0, 10);

    const { data: turnos, error } = await supabaseAdmin
        .from('turnos')
        .select(`
            id, fecha, hora_inicio, hora_fin,
            clientes(nombre),
            empleados(nombre),
            servicios(nombre)
        `)
        .eq('estado_id', estadoReservado.id)
        .gte('fecha', hoy)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true });

    if (error) throw error;

    const conflictos = [];
    for (const turno of turnos || []) {
        const motivo = calcularMotivoConflicto(turno, horariosPorDia, fechasCerradas);
        if (!motivo) continue;

        conflictos.push({
            id: turno.id,
            fecha: turno.fecha,
            hora_inicio: String(turno.hora_inicio || '').slice(0, 5),
            hora_fin: String(turno.hora_fin || '').slice(0, 5),
            cliente: turno.clientes?.nombre || 'Cliente',
            empleado: turno.empleados?.nombre || 'Profesional',
            servicio: turno.servicios?.nombre || 'Servicio',
            motivo
        });
    }

    return conflictos;
}

async function obtenerConfigPublicaNegocio() {
    const config = await obtenerConfigNegocio();
    return {
        nombre: config.nombre,
        logoUrl: config.logoUrl,
        reservaImagenUrl: config.reservaImagenUrl,
        telefono: config.telefono,
        email: config.email,
        whatsapp: config.whatsapp,
        instagram: config.instagram,
        facebook: config.facebook,
        direccion: config.direccion,
        mapsEmbed: config.mapsEmbed,
        mapsLink: config.mapsLink,
        horarios: config.horarios
    };
}

export default {
    obtenerConfigNegocio,
    actualizarHorariosNegocio,
    obtenerConfigPublicaNegocio,
    obtenerTurnosEnConflicto
};
