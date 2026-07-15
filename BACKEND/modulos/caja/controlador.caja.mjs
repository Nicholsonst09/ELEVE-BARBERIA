import modelo from './modelo.caja.mjs';

function obtenerUsuarioActivo(req) {
    const usuarioId = Number(req.body?.usuario_id || req.headers['x-user-id'] || 0);
    return Number.isInteger(usuarioId) && usuarioId > 0 ? usuarioId : null;
}

function obtenerRol(req) {
    return String(req.headers['x-user-role'] || '').toLowerCase();
}

async function obtenerVentas(req, res) {
    try {
        const rol = obtenerRol(req);
        const usuarioId = Number(req.query.usuario_id || req.headers['x-user-id'] || 0);
        const filtros = {
            desde: req.query.desde || null,
            hasta: req.query.hasta || null,
            usuario_id: req.query.usuario_id || null,
            empleado_id: req.query.empleado_id || null,
            estado: req.query.estado || null,
            limite: req.query.limite || 100,
            offset: req.query.offset || 0
        };

        if (rol === 'empleado') {
            if (!usuarioId) {
                return res.status(400).json({ mensaje: 'El usuario autenticado debe enviarse en x-user-id o usuario_id.' });
            }
            filtros.usuario_id = usuarioId;
        }

        const ventas = await modelo.obtenerVentas(filtros);
        return res.status(200).json({ ventas, total: ventas.length });
    } catch (error) {
        console.error('Error en controlador.caja.obtenerVentas:', error);
        return res.status(500).json({ mensaje: 'Error interno al obtener ventas.', detalle: error.message });
    }
}

async function obtenerVentaPorId(req, res) {
    try {
        const venta = await modelo.obtenerVentaPorId(req.params.id);
        if (!venta) {
            return res.status(404).json({ mensaje: 'Venta no encontrada.' });
        }
        return res.status(200).json(venta);
    } catch (error) {
        console.error('Error en controlador.caja.obtenerVentaPorId:', error);
        return res.status(500).json({ mensaje: 'Error interno al obtener la venta.', detalle: error.message });
    }
}

async function crearVenta(req, res) {
    try {
        const usuarioIdActivo = obtenerUsuarioActivo(req);
        const usuarioId = Number(req.body?.usuario_id || usuarioIdActivo || 0);
        if (!usuarioId) {
            return res.status(400).json({ mensaje: 'usuario_id es obligatorio para registrar la venta.' });
        }

        const venta = await modelo.crearVenta({
            ...req.body,
            usuario_id: usuarioId
        });

        return res.status(201).json({ mensaje: 'Venta registrada con exito.', venta });
    } catch (error) {
        console.error('Error en controlador.caja.crearVenta:', error);
        return res.status(400).json({ mensaje: 'No se pudo registrar la venta.', detalle: error.message });
    }
}

async function anularVenta(req, res) {
    const rolUsuario = obtenerRol(req);
    if (!['admin', 'administrador'].includes(rolUsuario)) {
        return res.status(403).json({ mensaje: 'Solo un administrador puede anular ventas.' });
    }

    try {
        const venta = await modelo.anularVenta(req.params.id);
        return res.status(200).json({ mensaje: 'Venta anulada con exito.', venta });
    } catch (error) {
        console.error('Error en controlador.caja.anularVenta:', error);
        return res.status(500).json({ mensaje: 'No se pudo anular la venta.', detalle: error.message });
    }
}

async function reactivarVenta(req, res) {
    const rolUsuario = obtenerRol(req);
    if (!['admin', 'administrador'].includes(rolUsuario)) {
        return res.status(403).json({ mensaje: 'Solo un administrador puede registrar de nuevo una venta anulada.' });
    }

    try {
        const venta = await modelo.reactivarVenta(req.params.id);
        return res.status(200).json({ mensaje: 'Venta registrada nuevamente con exito.', venta });
    } catch (error) {
        console.error('Error en controlador.caja.reactivarVenta:', error);
        return res.status(500).json({ mensaje: 'No se pudo registrar la venta.', detalle: error.message });
    }
}

export default {
    obtenerVentas,
    obtenerVentaPorId,
    crearVenta,
    anularVenta,
    reactivarVenta
};
