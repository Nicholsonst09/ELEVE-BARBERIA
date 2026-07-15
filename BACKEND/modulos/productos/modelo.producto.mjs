import { supabaseAdmin } from '../../db/supabaseClient.mjs';
import { eliminarImagenStorage } from '../../config/imagen.mjs';

const SELECT_PRODUCTO_BASE = `
  id,
  nombre,
  descripcion,
  precio,
  stock,
  activo,
  categoria_id,
  imagen,
  creado,
  modificado,
  categorias_productos:categoria_id(id, nombre)
`;

function mapearProducto(fila = {}) {
  const categoria = fila.categorias_productos || null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion || '',
    precio: Number(fila.precio || 0),
    stock: Number(fila.stock || 0),
    activo: fila.activo !== false,
    categoria_id: fila.categoria_id || null,
    categoria: categoria?.nombre || null,
    imagen: fila.imagen || null,
    creado: fila.creado,
    modificado: fila.modificado,
  };
}

function mapearCategoria(fila = {}) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion || '',
    activo: fila.activo !== false,
  };
}

async function obtenerProductos() {
  const { data, error } = await supabaseAdmin
    .from('productos')
    .select(SELECT_PRODUCTO_BASE)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapearProducto);
}

async function obtenerCategoriasActivas() {
  const { data, error } = await supabaseAdmin
    .from('categorias_productos')
    .select('id, nombre, descripcion, activo')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapearCategoria);
}

async function obtenerOCrearCategoria(nombre) {
  const limpio = String(nombre || '').trim();
  if (!limpio) return null;

  const { data: existente, error: errFind } = await supabaseAdmin
    .from('categorias_productos')
    .select('id, nombre, descripcion, activo')
    .ilike('nombre', limpio)
    .maybeSingle();

  if (errFind) throw errFind;
  if (existente?.id) {
    if (existente.activo === false) {
      const { data: reactivada, error: errReact } = await supabaseAdmin
        .from('categorias_productos')
        .update({ activo: true, modificado: new Date().toISOString() })
        .eq('id', existente.id)
        .select('id, nombre, descripcion, activo')
        .single();
      if (errReact) throw errReact;
      return mapearCategoria(reactivada);
    }
    return mapearCategoria(existente);
  }

  const { data: creada, error: errCreate } = await supabaseAdmin
    .from('categorias_productos')
    .insert([{ nombre: limpio, activo: true }])
    .select('id, nombre, descripcion, activo')
    .single();

  if (errCreate) throw errCreate;
  return mapearCategoria(creada);
}

async function obtenerProductoPorId(id) {
  const { data, error } = await supabaseAdmin
    .from('productos')
    .select(SELECT_PRODUCTO_BASE)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapearProducto(data) : null;
}

async function crearProducto(payload = {}) {
  let categoriaId = payload.categoria_id || null;
  if (!categoriaId && payload.categoria) {
    const categoria = await obtenerOCrearCategoria(payload.categoria);
    categoriaId = categoria?.id || null;
  }

  const stock = Number(payload.stock || 0);
  const activoManual = payload.activo !== false;

  const insertPayload = {
    nombre: String(payload.nombre || '').trim(),
    descripcion: String(payload.descripcion || '').trim() || null,
    precio: Number(payload.precio || 0),
    stock,
    categoria_id: categoriaId,
    imagen: payload.imagen || null,
    // Regla: si no hay stock, el producto queda inactivo aunque el switch esté activo.
    activo: activoManual && stock > 0,
    modificado: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('productos')
    .insert([insertPayload])
    .select(SELECT_PRODUCTO_BASE)
    .single();

  if (error) throw error;
  return mapearProducto(data);
}

async function actualizarProducto(id, payload = {}) {
  const actual = await obtenerProductoPorId(id);
  if (!actual) return null;

  let categoriaId = payload.categoria_id ?? actual.categoria_id;
  if (payload.categoria !== undefined) {
    const categoria = await obtenerOCrearCategoria(payload.categoria);
    categoriaId = categoria?.id || null;
  }

  const stockFinal = payload.stock !== undefined ? Number(payload.stock || 0) : actual.stock;
  const activoManual = payload.activo !== undefined ? payload.activo !== false : actual.activo;

  const updatePayload = {
    nombre: payload.nombre !== undefined ? String(payload.nombre || '').trim() : actual.nombre,
    descripcion: payload.descripcion !== undefined ? (String(payload.descripcion || '').trim() || null) : (actual.descripcion || null),
    precio: payload.precio !== undefined ? Number(payload.precio || 0) : actual.precio,
    stock: stockFinal,
    categoria_id: categoriaId,
    imagen: payload.imagen !== undefined ? (payload.imagen || null) : actual.imagen,
    activo: activoManual && stockFinal > 0,
    modificado: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('productos')
    .update(updatePayload)
    .eq('id', id)
    .select(SELECT_PRODUCTO_BASE)
    .single();

  if (error) throw error;

  // La imagen vieja ya no tiene referencia en la BD una vez pisada por la
  // nueva: se borra del storage para no acumular fotos huérfanas.
  if (actual.imagen && actual.imagen !== updatePayload.imagen) {
    await eliminarImagenStorage(actual.imagen);
  }

  return mapearProducto(data);
}

async function eliminarProducto(id) {
  const actual = await obtenerProductoPorId(id);
  if (!actual) return null;

  const { error: errDelete } = await supabaseAdmin
    .from('productos')
    .delete()
    .eq('id', id);

  if (errDelete) throw errDelete;

  // A diferencia de "eliminar" empleado (baja lógica, el registro sigue
  // existiendo como anulado y su avatar puede seguir mostrándose en
  // historiales), esto es un borrado real: la imagen queda sin ninguna
  // referencia, así que se limpia del storage.
  if (actual.imagen) {
    await eliminarImagenStorage(actual.imagen);
  }

  return {
    producto: actual,
    modo: 'eliminado',
  };
}

export default {
  obtenerProductos,
  obtenerCategoriasActivas,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
};
