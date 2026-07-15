import modelo from './modelo.producto.mjs';
import { supabaseAdmin } from '../../db/supabaseClient.mjs';
import { randomUUID } from 'crypto';
import { convertirAWebp } from '../../config/imagen.mjs';

function esRolAdmin(req) {
  const rol = String(req.headers['x-user-role'] || '').toLowerCase();
  return rol === 'administrador' || rol === 'admin';
}

function validarPayloadProducto(payload = {}) {
  const nombre = String(payload.nombre || '').trim();
  if (!nombre) return 'nombre es requerido.';

  const precio = Number(payload.precio);
  if (!Number.isFinite(precio) || precio < 0) return 'precio debe ser un numero >= 0.';

  const stock = Number(payload.stock ?? 0);
  if (!Number.isFinite(stock) || stock < 0) return 'stock debe ser un numero >= 0.';

  if (payload.activo !== undefined && typeof payload.activo !== 'boolean') {
    return 'activo debe ser boolean.';
  }

  return null;
}

async function obtenerProductos(req, res) {
  try {
    const [productos, categorias] = await Promise.all([
      modelo.obtenerProductos(),
      modelo.obtenerCategoriasActivas(),
    ]);

    res.status(200).json({ productos, categorias });
  } catch (error) {
    console.error('Error en controlador.obtenerProductos:', error);
    res.status(500).json({ mensaje: 'Error al obtener productos.', detalle: error.message });
  }
}

async function crearProducto(req, res) {
  if (!esRolAdmin(req)) {
    return res.status(403).json({ mensaje: 'No autorizado para crear productos.' });
  }

  const errorValidacion = validarPayloadProducto(req.body || {});
  if (errorValidacion) {
    return res.status(400).json({ mensaje: errorValidacion });
  }

  try {
    const creado = await modelo.crearProducto(req.body || {});
    res.status(201).json(creado);
  } catch (error) {
    console.error('Error en controlador.crearProducto:', error);
    res.status(500).json({ mensaje: 'Error al crear producto.', detalle: error.message });
  }
}

async function actualizarProducto(req, res) {
  if (!esRolAdmin(req)) {
    return res.status(403).json({ mensaje: 'No autorizado para actualizar productos.' });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ mensaje: 'ID de producto invalido.' });
  }

  const body = req.body || {};
  const payloadParaValidar = {
    nombre: body.nombre ?? 'x',
    precio: body.precio ?? 0,
    stock: body.stock ?? 0,
    activo: body.activo,
  };

  const errorValidacion = validarPayloadProducto(payloadParaValidar);
  if (errorValidacion && (body.nombre !== undefined || body.precio !== undefined || body.stock !== undefined || body.activo !== undefined)) {
    return res.status(400).json({ mensaje: errorValidacion });
  }

  try {
    const actualizado = await modelo.actualizarProducto(id, body);
    if (!actualizado) {
      return res.status(404).json({ mensaje: 'Producto no encontrado.' });
    }
    res.status(200).json(actualizado);
  } catch (error) {
    console.error('Error en controlador.actualizarProducto:', error);
    res.status(500).json({ mensaje: 'Error al actualizar producto.', detalle: error.message });
  }
}

async function eliminarProducto(req, res) {
  if (!esRolAdmin(req)) {
    return res.status(403).json({ mensaje: 'No autorizado para eliminar productos.' });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ mensaje: 'ID de producto invalido.' });
  }

  try {
    const eliminado = await modelo.eliminarProducto(id);
    if (!eliminado) {
      return res.status(404).json({ mensaje: 'Producto no encontrado.' });
    }
    res.status(200).json(eliminado);
  } catch (error) {
    console.error('Error en controlador.eliminarProducto:', error);
    res.status(500).json({ mensaje: 'Error al eliminar producto.', detalle: error.message });
  }
}

async function subirImagenProducto(req, res) {
  if (!esRolAdmin(req)) {
    return res.status(403).json({ mensaje: 'No autorizado para subir imagenes de productos.' });
  }

  try {
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
      'imagenes';
    const productoId = Number(req.body?.producto_id);
    const carpeta = Number.isFinite(productoId) && productoId > 0 ? String(productoId) : 'tmp';
    const bufferWebp = await convertirAWebp(req.file.buffer);
    const filePath = `productos/${carpeta}/${Date.now()}-${randomUUID()}.webp`;

    const { error: uploadError } = await supabaseAdmin
      .storage
      .from(bucket)
      .upload(filePath, bufferWebp, {
        contentType: 'image/webp',
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      return res.status(500).json({
        mensaje: 'No se pudo subir la imagen al bucket de Supabase.',
        detalle: uploadError.message,
      });
    }

    const { data: publicData } = supabaseAdmin
      .storage
      .from(bucket)
      .getPublicUrl(filePath);

    return res.status(201).json({
      bucket,
      filePath,
      publicUrl: publicData?.publicUrl || null,
    });
  } catch (error) {
    console.error('Error en controlador.subirImagenProducto:', error);
    return res.status(500).json({
      mensaje: 'Error al subir la imagen del producto.',
      detalle: error.message,
    });
  }
}

export default {
  obtenerProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  subirImagenProducto,
};
