import { supabaseAdmin } from '../../db/supabaseClient.mjs';
import modeloProducto from '../productos/modelo.producto.mjs';

const SELECT_VENTA_BASE = `
    id,
    usuario_id,
    empleado_id,
    cliente_id,
    fecha_hora,
    metodo_pago_id,
    subtotal,
    descuento,
    total,
    estado,
    observaciones,
    creado,
    modificado,
    usuarios!caja_ventas_usuario_id_fkey(id, nombre, email, rol),
    empleados!caja_ventas_empleado_id_fkey(id, nombre, email, avatar_url, comision_pct),
    clientes!caja_ventas_cliente_id_fkey(id, nombre, telefono, email),
    metodos_pago!caja_ventas_metodo_pago_id_fkey(id, nombre),
    caja_ventas_items(
        id,
        tipo_item,
        referencia_id,
        descripcion,
        cantidad,
        precio_unitario,
        subtotal,
        creado
    )
`;

function normalizarItem(item) {
    const cantidad = Number(item?.cantidad ?? 0);
    const precioUnitario = Number(item?.precio_unitario ?? item?.precioUnitario ?? 0);
    const subtotal = Number.isFinite(Number(item?.subtotal)) && Number(item.subtotal) >= 0
        ? Number(item.subtotal)
        : Number((cantidad * precioUnitario).toFixed(2));

    return {
        tipo_item: item?.tipo_item || item?.tipoItem,
        referencia_id: item?.referencia_id ?? item?.referenciaId ?? null,
        descripcion: String(item?.descripcion || '').trim(),
        cantidad,
        precio_unitario: precioUnitario,
        subtotal
    };
}

async function resolverMetodoPagoId(venta) {
    const metodoPagoId = Number(venta?.metodo_pago_id);
    if (Number.isInteger(metodoPagoId) && metodoPagoId > 0) {
        return metodoPagoId;
    }

    const nombreMetodo = String(venta?.metodo_pago || venta?.metodo || '').trim();
    if (!nombreMetodo) {
        throw new Error('metodo_pago_id o metodo_pago es obligatorio.');
    }

    let { data: metodoPago, error } = await supabaseAdmin
        .from('metodos_pago')
        .select('id, nombre')
        .eq('nombre', nombreMetodo)
        .maybeSingle();

    if (error) throw error;

    if (!metodoPago?.id) {
        const { data: creado, error: errorCreacion } = await supabaseAdmin
            .from('metodos_pago')
            .upsert([{ nombre: nombreMetodo, activo: true }], { onConflict: 'nombre' })
            .select('id, nombre')
            .single();

        if (errorCreacion) throw errorCreacion;
        metodoPago = creado;
    }

    return metodoPago.id;
}

async function validarVentaBase(venta) {
    const usuarioId = Number(venta?.usuario_id);
    const empleadoId = Number(venta?.empleado_id);
    const descuento = Number(venta?.descuento ?? 0);
    const observaciones = venta?.observaciones ? String(venta.observaciones).trim() : null;
    const items = Array.isArray(venta?.items) ? venta.items.map(normalizarItem) : [];

    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
        throw new Error('usuario_id es obligatorio y debe ser un numero valido.');
    }

    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
        throw new Error('empleado_id es obligatorio y debe ser un numero valido.');
    }

    if (!items.length) {
        throw new Error('La venta debe incluir al menos un item.');
    }

    if (descuento < 0) {
        throw new Error('descuento no puede ser negativo.');
    }

    for (const item of items) {
        if (!['servicio', 'producto'].includes(item.tipo_item)) {
            throw new Error('tipo_item debe ser servicio o producto.');
        }
        if (!item.descripcion) {
            throw new Error('Cada item debe tener descripcion.');
        }
        if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
            throw new Error('Cada item debe tener cantidad positiva.');
        }
        if (!Number.isFinite(item.precio_unitario) || item.precio_unitario < 0) {
            throw new Error('Cada item debe tener precio_unitario valido.');
        }
    }

    const subtotal = items.reduce((acc, item) => acc + (item.subtotal || (item.cantidad * item.precio_unitario)), 0);
    const total = Math.max(0, subtotal - descuento);
    const metodoPagoId = await resolverMetodoPagoId(venta);

    return {
        usuario_id: usuarioId,
        empleado_id: empleadoId,
        cliente_id: Number.isInteger(Number(venta?.cliente_id)) && Number(venta.cliente_id) > 0 ? Number(venta.cliente_id) : null,
        metodo_pago_id: metodoPagoId,
        subtotal: Number(subtotal.toFixed(2)),
        descuento: Number(descuento.toFixed(2)),
        total: Number(total.toFixed(2)),
        observaciones,
        items
    };
}

// Ajusta el stock de los items tipo "producto" de una venta. signo=-1 al
// vender (descuenta), signo=+1 al anular (devuelve). No aborta la operación
// si un producto puntual falla o ya no existe: la venta/anulación en sí ya
// quedó registrada y no debe perderse por un problema de sincronización de stock.
async function ajustarStockDeItems(items, signo) {
    const itemsProducto = (items || []).filter(item => item.tipo_item === 'producto' && item.referencia_id);

    for (const item of itemsProducto) {
        try {
            const producto = await modeloProducto.obtenerProductoPorId(item.referencia_id);
            if (!producto) continue;

            const nuevoStock = Math.max(0, producto.stock + signo * Number(item.cantidad || 0));
            await modeloProducto.actualizarProducto(item.referencia_id, { stock: nuevoStock });
        } catch (errorStock) {
            console.error(`No se pudo ajustar el stock del producto ${item.referencia_id}:`, errorStock.message);
        }
    }
}

function mapearVenta(venta = {}) {
    const { usuarios, empleados, clientes, metodos_pago, caja_ventas_items = [], ...resto } = venta;
    return {
        ...resto,
        usuario: usuarios || null,
        empleado: empleados || null,
        cliente: clientes || null,
        metodo_pago: metodos_pago || null,
        items: caja_ventas_items || []
    };
}

async function obtenerVentas(filtros = {}) {
    try {
        let query = supabaseAdmin
            .from('caja_ventas')
            .select(SELECT_VENTA_BASE)
            .order('fecha_hora', { ascending: false });

        if (filtros.desde) query = query.gte('fecha_hora', filtros.desde);
        if (filtros.hasta) query = query.lte('fecha_hora', filtros.hasta);
        if (filtros.usuario_id) query = query.eq('usuario_id', Number(filtros.usuario_id));
        if (filtros.empleado_id) query = query.eq('empleado_id', Number(filtros.empleado_id));
        if (filtros.estado) query = query.eq('estado', filtros.estado);

        const limite = Number(filtros.limite || 100);
        const offset = Number(filtros.offset || 0);
        if (Number.isFinite(limite) && limite > 0) {
            query = query.range(offset, offset + limite - 1);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapearVenta);
    } catch (error) {
        console.error('Error al obtener ventas:', error.message);
        throw error;
    }
}

async function obtenerVentaPorId(id) {
    try {
        const ventaId = Number(id);
        const { data, error } = await supabaseAdmin
            .from('caja_ventas')
            .select(SELECT_VENTA_BASE)
            .eq('id', ventaId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        return mapearVenta(data);
    } catch (error) {
        console.error(`Error al obtener venta ${id}:`, error.message);
        throw error;
    }
}

async function crearVenta(venta) {
    try {
        const valida = await validarVentaBase(venta);
        const payload = {
            usuario_id: valida.usuario_id,
            empleado_id: valida.empleado_id,
            cliente_id: valida.cliente_id,
            metodo_pago_id: valida.metodo_pago_id,
            subtotal: valida.subtotal,
            descuento: valida.descuento,
            total: valida.total,
            estado: 'registrada',
            observaciones: valida.observaciones,
            modificado: new Date().toISOString()
        };

        const { data: ventaCreada, error: errorVenta } = await supabaseAdmin
            .from('caja_ventas')
            .insert([payload])
            .select(SELECT_VENTA_BASE)
            .single();

        if (errorVenta) throw errorVenta;

        const itemsPayload = valida.items.map(item => ({
            venta_id: ventaCreada.id,
            tipo_item: item.tipo_item,
            referencia_id: item.referencia_id,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            subtotal: item.subtotal
        }));

        const { error: errorItems } = await supabaseAdmin
            .from('caja_ventas_items')
            .insert(itemsPayload);

        if (errorItems) {
            await supabaseAdmin.from('caja_ventas').delete().eq('id', ventaCreada.id);
            throw errorItems;
        }

        await ajustarStockDeItems(valida.items, -1);

        return await obtenerVentaPorId(ventaCreada.id);
    } catch (error) {
        console.error('Error al crear venta:', error.message);
        throw error;
    }
}

async function anularVenta(id) {
    try {
        const ventaId = Number(id);

        // Filtramos por estado 'registrada' para que sea idempotente: si la
        // venta ya estaba anulada, el update no afecta filas y no se vuelve
        // a restaurar el stock una segunda vez.
        const { data, error } = await supabaseAdmin
            .from('caja_ventas')
            .update({ estado: 'anulada', modificado: new Date().toISOString() })
            .eq('id', ventaId)
            .eq('estado', 'registrada')
            .select(SELECT_VENTA_BASE)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            // Ya estaba anulada (o no existe): devolvemos el estado actual sin reprocesar.
            return await obtenerVentaPorId(ventaId);
        }

        await ajustarStockDeItems(data.caja_ventas_items, 1);

        return mapearVenta(data);
    } catch (error) {
        console.error(`Error al anular venta ${id}:`, error.message);
        throw error;
    }
}

async function reactivarVenta(id) {
    try {
        const ventaId = Number(id);

        // Espejo de anularVenta: filtramos por estado 'anulada' para que sea
        // idempotente y para volver a descontar el stock una sola vez.
        const { data, error } = await supabaseAdmin
            .from('caja_ventas')
            .update({ estado: 'registrada', modificado: new Date().toISOString() })
            .eq('id', ventaId)
            .eq('estado', 'anulada')
            .select(SELECT_VENTA_BASE)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            // Ya estaba registrada (o no existe): devolvemos el estado actual sin reprocesar.
            return await obtenerVentaPorId(ventaId);
        }

        await ajustarStockDeItems(data.caja_ventas_items, -1);

        return mapearVenta(data);
    } catch (error) {
        console.error(`Error al reactivar venta ${id}:`, error.message);
        throw error;
    }
}

export default {
    obtenerVentas,
    obtenerVentaPorId,
    crearVenta,
    anularVenta,
    reactivarVenta
};
