import modelo from './modelo.empleado.mjs';
import modeloNegocio from '../negocio/modelo.negocio.mjs';
import { supabaseAdmin } from '../../db/supabaseClient.mjs';
import { randomUUID } from 'crypto';
import { obtenerLimiteEmpleados } from '../../middleware/limiteEmpleados.mjs';
import { convertirAWebp } from '../../config/imagen.mjs';

const DIAS = [
    { key: 'domingo', label: 'Domingo', dia: 0 },
    { key: 'lunes', label: 'Lunes', dia: 1 },
    { key: 'martes', label: 'Martes', dia: 2 },
    { key: 'miercoles', label: 'Miercoles', dia: 3 },
    { key: 'jueves', label: 'Jueves', dia: 4 },
    { key: 'viernes', label: 'Viernes', dia: 5 },
    { key: 'sabado', label: 'Sabado', dia: 6 },
];

function horaAMinutos(hora) {
    if (typeof hora !== 'string') return NaN;
    const [h, m] = hora.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
    return h * 60 + m;
}

function normalizarHorariosNegocio(horarios = []) {
    const porDia = {};
    for (const dia of DIAS) {
        porDia[dia.key] = { activo: false, desde: '00:00', hasta: '00:00' };
    }

    for (const h of (horarios || [])) {
        const diaKey = DIAS.find((d) => d.dia === Number(h?.dia))?.key;
        if (!diaKey) continue;
        porDia[diaKey] = {
            activo: h?.activo !== false,
            desde: h?.apertura || '09:00',
            hasta: h?.cierre || '21:00',
        };
    }

    return porDia;
}

function validarHorariosConNegocio(horariosEmpleado, horariosNegocio) {
    if (!horariosEmpleado || typeof horariosEmpleado !== 'object') return null;

    for (const dia of DIAS) {
        const cfg = horariosEmpleado?.[dia.key];
        if (!cfg?.activo) continue;

        const negocioDia = horariosNegocio[dia.key] || { activo: false, desde: '00:00', hasta: '00:00' };
        if (!negocioDia.activo) {
            return `${dia.label}: el negocio esta cerrado.`;
        }

        const empDesde = horaAMinutos(cfg.desde);
        const empHasta = horaAMinutos(cfg.hasta);
        const negDesde = horaAMinutos(negocioDia.desde);
        const negHasta = horaAMinutos(negocioDia.hasta);

        if ([empDesde, empHasta, negDesde, negHasta].some(Number.isNaN)) {
            return `${dia.label}: hay horarios invalidos.`;
        }

        if (empDesde >= empHasta) {
            return `${dia.label}: el horario de inicio debe ser menor al de fin.`;
        }

        if (empDesde < negDesde || empHasta > negHasta) {
            return `${dia.label}: el horario del barbero debe estar dentro del horario de atencion del negocio (${negocioDia.desde}-${negocioDia.hasta}).`;
        }

        if (cfg?.descanso?.activo) {
            const desDesde = horaAMinutos(cfg.descanso.desde);
            const desHasta = horaAMinutos(cfg.descanso.hasta);

            if ([desDesde, desHasta].some(Number.isNaN)) {
                return `${dia.label}: el horario de descanso es invalido.`;
            }

            if (desDesde >= desHasta) {
                return `${dia.label}: el descanso debe tener inicio menor al fin.`;
            }

            if (desDesde < empDesde || desHasta > empHasta) {
                return `${dia.label}: el descanso debe estar dentro del horario laboral del barbero (${cfg.desde}-${cfg.hasta}).`;
            }
        }
    }

    return null;
}

//función para manejar la solicitud de todos los empleados
async function obtenerEmpleados(req, res){
    try {
            const empleados = await modelo.obtenerEmpleados();
            res.status(200).json(empleados);
        } catch (error) {
            console.error("Error en controlador.obtenerEmpleados:", error);
            res.status(500).json({ mensaje: "Error interno del servidor al obtener empleados.", detalle: error.message });
        }
}

//función para manejar la solicitud de obtener un empleado por ID
async function obtenerUnEmpleado(req, res){
    const empleadoId = parseInt(req.params.id);

    if (isNaN(empleadoId)) {
        return res.status(400).json({ mensaje: 'ID del empleado inválido. Debe ser un número.' });
    }

    try{
        const empleado = await modelo.obtenerUnEmpleado(empleadoId);
                if (empleado) {
                    res.status(200).json(empleado);
                } else {
                    res.status(404).json({ mensaje: 'Empleado no encontrado.' });
                }
    }catch (error) {
        console.error(`Error en controlador.obtenerUnEmpleado (ID: ${empleadoId}):`, error);
        res.status(500).json({ mensaje: 'Error interno del servidor al obtener el empleado.', detalle: error.message });
    }

}

async function crearEmpleado(req, res) {
    try {
        const { nombre, email, especialidades, horarios_disponibles, avatar_url, comision_pct, servicio_ids } = req.body;
        const comisionValor = Number(comision_pct ?? 0);

        if (!nombre) {
            return res.status(400).json({ mensaje: 'Nombre es requerido.' });
        }

        if (Number.isNaN(comisionValor) || comisionValor < 0 || comisionValor > 100) {
            return res.status(400).json({ mensaje: 'La comisión debe estar entre 0 y 100.' });
        }

        const limiteEmpleados = obtenerLimiteEmpleados();
        if (limiteEmpleados !== null) {
            const totalActual = await modelo.contarEmpleados();
            if (totalActual >= limiteEmpleados) {
                return res.status(403).json({
                    mensaje: `Se alcanzó el límite de ${limiteEmpleados} empleados de tu plan. Contactá a soporte para ampliarlo.`
                });
            }
        }

        const duplicado = await modelo.buscarEmpleadoDuplicado({ nombre: String(nombre).trim(), email: email || null });
        if (duplicado) {
            return res.status(409).json({ mensaje: 'Ya existe un empleado con ese nombre y email.' });
        }

        const configNegocio = await modeloNegocio.obtenerConfigNegocio();
        const horariosNegocioPorDia = normalizarHorariosNegocio(configNegocio?.horarios || []);
        const errorHorario = validarHorariosConNegocio(horarios_disponibles, horariosNegocioPorDia);
        if (errorHorario) {
            return res.status(400).json({ mensaje: errorHorario });
        }

        const empleado = await modelo.crearEmpleado({
            nombre: String(nombre).trim(),
            email: email || null,
            especialidades: especialidades || null,
            horarios_disponibles: horarios_disponibles || null,
            avatar_url: avatar_url || null,
            comision_pct: comisionValor,
            servicio_ids: Array.isArray(servicio_ids) ? servicio_ids : []
        });

        res.status(201).json(empleado);
    } catch (error) {
        console.error('Error en controlador.crearEmpleado:', error);
        res.status(500).json({ mensaje: 'Error al crear empleado.', detalle: error.message });
    }
}

async function actualizarEmpleado(req, res) {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ mensaje: 'ID inválido.' });
    }

    try {
        const { nombre, email, especialidades, horarios_disponibles, avatar_url, comision_pct, servicio_ids } = req.body;
        const comisionValor = Number(comision_pct ?? 0);

        if (!nombre) {
            return res.status(400).json({ mensaje: 'Nombre es requerido.' });
        }

        if (Number.isNaN(comisionValor) || comisionValor < 0 || comisionValor > 100) {
            return res.status(400).json({ mensaje: 'La comisión debe estar entre 0 y 100.' });
        }

        const duplicado = await modelo.buscarEmpleadoDuplicado({ nombre: String(nombre).trim(), email: email || null, excluirId: id });
        if (duplicado) {
            return res.status(409).json({ mensaje: 'Ya existe un empleado con ese nombre y email.' });
        }

        const configNegocio = await modeloNegocio.obtenerConfigNegocio();
        const horariosNegocioPorDia = normalizarHorariosNegocio(configNegocio?.horarios || []);
        const errorHorario = validarHorariosConNegocio(horarios_disponibles, horariosNegocioPorDia);
        if (errorHorario) {
            return res.status(400).json({ mensaje: errorHorario });
        }

        const empleado = await modelo.actualizarEmpleado(id, {
            nombre: String(nombre).trim(),
            email: email || null,
            especialidades: especialidades || null,
            horarios_disponibles: horarios_disponibles || null,
            avatar_url: avatar_url || null,
            comision_pct: comisionValor,
            servicio_ids: Array.isArray(servicio_ids) ? servicio_ids : []
        });

        res.status(200).json(empleado);
    } catch (error) {
        console.error(`Error en controlador.actualizarEmpleado (ID: ${id}):`, error);
        res.status(500).json({ mensaje: 'Error al actualizar empleado.', detalle: error.message });
    }
}

async function eliminarEmpleado(req, res) {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ mensaje: 'ID inválido.' });
    }

    try {
        await modelo.eliminarEmpleado(id);
        res.status(204).send();
    } catch (error) {
        console.error(`Error en controlador.eliminarEmpleado (ID: ${id}):`, error);
        res.status(500).json({ mensaje: 'Error al anular el empleado.', detalle: error.message });
    }
}

async function cambiarEstadoEmpleado(req, res) {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ mensaje: 'ID inválido.' });
    }

    if (typeof req.body?.activo !== 'boolean') {
        return res.status(400).json({ mensaje: "El campo 'activo' es requerido y debe ser booleano." });
    }

    try {
        const empleado = await modelo.cambiarEstadoEmpleado(id, req.body.activo ? 'activo' : 'inactivo');
        res.status(200).json(empleado);
    } catch (error) {
        console.error(`Error en controlador.cambiarEstadoEmpleado (ID: ${id}):`, error);
        res.status(500).json({ mensaje: 'Error al cambiar el estado del empleado.', detalle: error.message });
    }
}

async function subirAvatarEmpleado(req, res) {
    try {
        const rol = String(req.headers['x-user-role'] || '').toLowerCase();
        if (!['admin', 'administrador'].includes(rol)) {
            return res.status(403).json({ mensaje: 'No autorizado para subir avatares.' });
        }

        if (!req.file) {
            return res.status(400).json({ mensaje: 'No se recibió archivo de imagen.' });
        }

        const mimeType = String(req.file.mimetype || '');
        if (!mimeType.startsWith('image/')) {
            return res.status(400).json({ mensaje: 'El archivo debe ser una imagen valida.' });
        }

        const bucket =
            process.env.SUPABASE_IMAGES_BUCKET ||
            process.env.SUPABASE_STORAGE_BUCKET ||
            process.env.SUPABASE_AVATARS_BUCKET ||
            'imagenes';
        const empleadoId = Number(req.body?.empleado_id);
        const carpeta = Number.isFinite(empleadoId) && empleadoId > 0 ? String(empleadoId) : 'tmp';
        const bufferWebp = await convertirAWebp(req.file.buffer);
        const filePath = `empleados/${carpeta}/${Date.now()}-${randomUUID()}.webp`;

        const { error: uploadError } = await supabaseAdmin
            .storage
            .from(bucket)
            .upload(filePath, bufferWebp, {
                contentType: 'image/webp',
                upsert: false,
                cacheControl: '3600'
            });

        if (uploadError) {
            return res.status(500).json({
                mensaje: 'No se pudo subir el avatar al bucket de Supabase.',
                detalle: uploadError.message
            });
        }

        const { data: publicData } = supabaseAdmin
            .storage
            .from(bucket)
            .getPublicUrl(filePath);

        return res.status(201).json({
            bucket,
            filePath,
            publicUrl: publicData?.publicUrl || null
        });
    } catch (error) {
        console.error('Error en controlador.subirAvatarEmpleado:', error);
        return res.status(500).json({
            mensaje: 'Error al subir avatar.',
            detalle: error.message
        });
    }
}

export default{
    obtenerEmpleados,
    obtenerUnEmpleado,
    crearEmpleado,
    actualizarEmpleado,
    eliminarEmpleado,
    cambiarEstadoEmpleado,
    subirAvatarEmpleado
}