import modelo from './modelo.negocio.mjs';
import modeloTurno from '../turnos/modelo.turno.mjs';
import notificacionesTurno from '../turnos/notificaciones.turno.mjs';
import { permitirRegistroTurnosAtrasados } from '../../config/fechaHoraNegocio.mjs';
import { supabaseAdmin } from '../../db/supabaseClient.mjs';
import { randomUUID } from 'crypto';
import { convertirAWebp } from '../../config/imagen.mjs';

function esRolAdmin(req) {
    const rol = String(req.headers['x-user-role'] || '').toLowerCase();
    return rol === 'administrador' || rol === 'admin';
}

function validarTextoOpcional(valor, campo, max = 600) {
    if (valor === undefined) return null;
    if (typeof valor !== 'string') return `${campo} debe ser string.`;
    if (valor.length > max) return `${campo} supera el maximo de ${max} caracteres.`;
    return null;
}

// El SVG es vectorial (logos) y ya pesa poco: convertirlo a WebP lo
// rasterizaría y le haría perder la escalabilidad, así que ese formato se
// sube tal cual. El resto (jpg/png/gif/webp) se normaliza a WebP.
async function prepararImagenParaSubida(buffer, mimeType) {
    if (mimeType === 'image/svg+xml') {
        return { buffer, extension: 'svg', contentType: mimeType };
    }
    return { buffer: await convertirAWebp(buffer), extension: 'webp', contentType: 'image/webp' };
}

async function obtenerConfigNegocio(req, res) {
    try {
        const config = await modelo.obtenerConfigNegocio();
        // permitirTurnosAtrasados viene de una env var, no de la BD: el
        // dashboard la usa para ofrecer fechas pasadas al cargar un turno
        // desde el panel.
        res.status(200).json({
            ...config,
            permitirTurnosAtrasados: permitirRegistroTurnosAtrasados()
        });
    } catch (error) {
        console.error('Error en controlador.obtenerConfigNegocio:', error);
        res.status(500).json({
            mensaje: 'Error interno al obtener configuracion del negocio.',
            detalle: error.message
        });
    }
}

async function obtenerConfigPublicaNegocio(req, res) {
    try {
        const config = await modelo.obtenerConfigPublicaNegocio();
        res.status(200).json(config);
    } catch (error) {
        console.error('Error en controlador.obtenerConfigPublicaNegocio:', error);
        res.status(500).json({
            mensaje: 'Error interno al obtener configuracion publica del negocio.',
            detalle: error.message
        });
    }
}

async function actualizarConfigNegocio(req, res) {
    try {
        if (!esRolAdmin(req)) {
            return res.status(403).json({
                mensaje: 'No autorizado para actualizar configuracion del negocio.'
            });
        }

        const {
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
        } = req.body || {};

        if (horarios !== undefined && !Array.isArray(horarios)) {
            return res.status(400).json({ mensaje: 'horarios debe ser un array.' });
        }

        if (diasNoLaborables !== undefined && !Array.isArray(diasNoLaborables)) {
            return res.status(400).json({ mensaje: 'diasNoLaborables debe ser un array.' });
        }

        const validacionesTexto = [
            validarTextoOpcional(nombre, 'nombre', 180),
            validarTextoOpcional(logoUrl, 'logoUrl', 2000),
            validarTextoOpcional(reservaImagenUrl, 'reservaImagenUrl', 2000),
            validarTextoOpcional(telefono, 'telefono', 80),
            validarTextoOpcional(email, 'email', 180),
            validarTextoOpcional(whatsapp, 'whatsapp', 40),
            validarTextoOpcional(instagram, 'instagram', 400),
            validarTextoOpcional(facebook, 'facebook', 400),
            validarTextoOpcional(direccion, 'direccion', 400),
            validarTextoOpcional(mapsEmbed, 'mapsEmbed', 3000),
            validarTextoOpcional(mapsLink, 'mapsLink', 1500)
        ].filter(Boolean);

        if (validacionesTexto.length) {
            return res.status(400).json({ mensaje: validacionesTexto[0] });
        }

        const actualizado = await modelo.actualizarHorariosNegocio({
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
        });

        const { cancelarTurnosIds } = req.body || {};
        let turnosCancelados = [];
        if (Array.isArray(cancelarTurnosIds) && cancelarTurnosIds.length > 0) {
            const ids = cancelarTurnosIds.map(Number).filter(Number.isFinite);
            turnosCancelados = await modeloTurno.cancelarTurnosPorIds(ids);

            for (const turnoId of turnosCancelados) {
                try {
                    await notificacionesTurno.enviarCancelacion(turnoId);
                } catch (error) {
                    console.error(`[notificaciones] Error enviando email de cancelación (turno ${turnoId}):`, error?.message || error);
                }
            }
        }

        res.status(200).json({ ...actualizado, turnosCancelados });
    } catch (error) {
        console.error('Error en controlador.actualizarConfigNegocio:', error);
        res.status(500).json({
            mensaje: 'Error interno al actualizar configuracion del negocio.',
            detalle: error.message
        });
    }
}

async function verificarConflictosHorarios(req, res) {
    try {
        if (!esRolAdmin(req)) {
            return res.status(403).json({
                mensaje: 'No autorizado para verificar conflictos de horarios.'
            });
        }

        const { horarios, diasNoLaborables } = req.body || {};

        if (horarios !== undefined && !Array.isArray(horarios)) {
            return res.status(400).json({ mensaje: 'horarios debe ser un array.' });
        }
        if (diasNoLaborables !== undefined && !Array.isArray(diasNoLaborables)) {
            return res.status(400).json({ mensaje: 'diasNoLaborables debe ser un array.' });
        }

        const turnos = await modelo.obtenerTurnosEnConflicto({ horarios, diasNoLaborables });
        res.status(200).json({ turnos });
    } catch (error) {
        console.error('Error en controlador.verificarConflictosHorarios:', error);
        res.status(500).json({
            mensaje: 'Error interno al verificar conflictos de horarios.',
            detalle: error.message
        });
    }
}

async function subirImagenNegocio(req, res) {
    try {
        if (!esRolAdmin(req)) {
            return res.status(403).json({
                mensaje: 'No autorizado para subir imagenes del negocio.'
            });
        }

        if (!req.file) {
            return res.status(400).json({ mensaje: 'No se recibio archivo de imagen.' });
        }

        const mimeType = String(req.file.mimetype || '');
        if (!mimeType.startsWith('image/')) {
            return res.status(400).json({ mensaje: 'El archivo debe ser una imagen valida.' });
        }

        const tipoRaw = String(req.body?.tipo || req.query?.tipo || '').trim().toLowerCase();
        const tipo = tipoRaw === 'reserva' ? 'reserva' : 'logo';

        const bucket =
            process.env.SUPABASE_IMAGES_BUCKET ||
            process.env.SUPABASE_STORAGE_BUCKET ||
            'imagenes';
        const { buffer: bufferSubida, extension, contentType } = await prepararImagenParaSubida(req.file.buffer, mimeType);
        const filePath = `negocio/${tipo}/${Date.now()}-${randomUUID()}.${extension}`;

        const { error: uploadError } = await supabaseAdmin
            .storage
            .from(bucket)
            .upload(filePath, bufferSubida, {
                contentType,
                upsert: false,
                cacheControl: '3600'
            });

        if (uploadError) {
            return res.status(500).json({
                mensaje: 'No se pudo subir la imagen al bucket de Supabase.',
                detalle: uploadError.message
            });
        }

        const { data: publicData } = supabaseAdmin
            .storage
            .from(bucket)
            .getPublicUrl(filePath);

        return res.status(201).json({
            bucket,
            tipo,
            filePath,
            publicUrl: publicData?.publicUrl || null
        });
    } catch (error) {
        console.error('Error en controlador.subirImagenNegocio:', error);
        return res.status(500).json({
            mensaje: 'Error al subir imagen del negocio.',
            detalle: error.message
        });
    }
}

export default {
    obtenerConfigNegocio,
    obtenerConfigPublicaNegocio,
    actualizarConfigNegocio,
    verificarConflictosHorarios,
    subirImagenNegocio
};
