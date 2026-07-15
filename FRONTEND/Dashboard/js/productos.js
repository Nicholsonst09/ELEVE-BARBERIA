import { formatCurrency, showNotification, confirmarAccion, capturarValoresFormulario, restaurarValoresFormulario, setBtnLoading } from './utilidades.js'
import {
  fetchProductos,
  createOrUpdateProducto,
  deleteProducto,
  uploadProductoImagen,
} from './api.js'

let productos = []
let productosFiltrados = []
let categoriasDisponibles = []
let imagenPreviewObjectUrl = null

// Borrador por producto (clave = id, o 'nuevo') para no perder lo tipeado si el
// modal se cierra sin guardar.
const CAMPOS_PRODUCTO = [
  'producto-nombre', 'producto-descripcion', 'producto-precio', 'producto-stock',
  'producto-activo', 'producto-categoria', 'producto-categoria-nueva', 'producto-imagen-url',
]
const _borradoresProducto = {}

function limpiarObjectUrlPreviewProducto() {
  if (imagenPreviewObjectUrl) {
    URL.revokeObjectURL(imagenPreviewObjectUrl)
    imagenPreviewObjectUrl = null
  }
}

function mostrarPreviewImagenProducto(src, esTemporal = false) {
  const preview = document.getElementById('producto-imagen-preview')
  const placeholder = document.getElementById('producto-imagen-preview-placeholder')
  const labelText = document.getElementById('producto-imagen-uploader-label-text')
  if (!preview) return

  if (!src) {
    limpiarObjectUrlPreviewProducto()
    preview.removeAttribute('src')
    preview.hidden = true
    if (placeholder) placeholder.hidden = false
    if (labelText) labelText.textContent = 'Seleccionar imagen'
    return
  }

  if (!esTemporal) limpiarObjectUrlPreviewProducto()
  preview.src = src
  preview.hidden = false
  if (placeholder) placeholder.hidden = true
  if (labelText) labelText.textContent = 'Cambiar imagen'
}

export async function inicializarProductos() {
  await cargarProductosDesdeBackend()
  productosFiltrados = [...productos]
  setupProductosListeners()
  renderizarProductos()
  actualizarMetricasProductos()
}

async function cargarProductosDesdeBackend() {
  const data = await fetchProductos()
  productos = Array.isArray(data?.productos) ? data.productos : []
  const categoriasApi = Array.isArray(data?.categorias)
    ? data.categorias.map((c) => (typeof c === 'string' ? c : c?.nombre)).filter(Boolean)
    : []
  const categoriasProductos = [...new Set(productos.map((p) => p.categoria).filter(Boolean))]
  categoriasDisponibles = [...new Set([...categoriasApi, ...categoriasProductos])].sort((a, b) => a.localeCompare(b))
}

function setupProductosListeners() {
  document.getElementById('buscador-productos')?.addEventListener('input', (e) => {
    filtrarProductos(e.target.value, document.getElementById('filtro-categoria-productos')?.value)
  })

  document.getElementById('filtro-categoria-productos')?.addEventListener('change', (e) => {
    filtrarProductos(document.getElementById('buscador-productos')?.value || '', e.target.value)
  })

  document.getElementById('btn-nuevo-producto')?.addEventListener('click', () => abrirModalProducto())
  document.querySelector('#modal-producto .cerrar-modal')?.addEventListener('click', cerrarModalProducto)
  document.querySelector('#modal-producto .btn-cancelar-producto')?.addEventListener('click', cancelarModalProducto)
  document.getElementById('form-producto')?.addEventListener('submit', guardarProducto)

  document.getElementById('producto-categoria')?.addEventListener('change', (e) => {
    const wrap = document.getElementById('wrap-categoria-nueva')
    if (wrap) wrap.style.display = e.target.value === '__nueva__' ? '' : 'none'
  })

  const inputImagenFile = document.getElementById('producto-imagen-file')
  const imagenPreview = document.getElementById('producto-imagen-preview')
  if (inputImagenFile) {
    inputImagenFile.addEventListener('change', () => {
      const archivo = inputImagenFile.files?.[0]
      if (!archivo) {
        mostrarPreviewImagenProducto('')
        return
      }
      limpiarObjectUrlPreviewProducto()
      const urlLocal = URL.createObjectURL(archivo)
      imagenPreviewObjectUrl = urlLocal
      mostrarPreviewImagenProducto(urlLocal, true)
    })
  }
  if (imagenPreview) {
    imagenPreview.addEventListener('error', () => mostrarPreviewImagenProducto(''))
  }

  document.getElementById('lista-productos')?.addEventListener('click', (e) => {
    const btnEditar = e.target.closest('[data-editar-producto]')
    const btnEliminar = e.target.closest('[data-eliminar-producto]')
    if (btnEditar) abrirModalProducto(Number(btnEditar.dataset.editarProducto))
    if (btnEliminar) eliminarProducto(Number(btnEliminar.dataset.eliminarProducto))
  })
}

function filtrarProductos(texto, categoria) {
  const termino = (texto || '').toLowerCase()
  productosFiltrados = productos.filter((p) => {
    const coincideTexto = !termino
      || p.nombre.toLowerCase().includes(termino)
      || (p.descripcion && p.descripcion.toLowerCase().includes(termino))
    const coincideCat = !categoria || categoria === 'todas' || p.categoria === categoria
    return coincideTexto && coincideCat
  })
  renderizarProductos()
}

function actualizarFiltroCategorias() {
  const select = document.getElementById('filtro-categoria-productos')
  if (!select) return
  const cats = categoriasDisponibles
  select.innerHTML = '<option value="todas">Todas las categorías</option>'
    + cats.map((c) => `<option value="${c}">${c}</option>`).join('')
}

function actualizarSelectorCategorias(categoriaSeleccionada = '') {
  const selectCat = document.getElementById('producto-categoria')
  const wrapCategoriaNueva = document.getElementById('wrap-categoria-nueva')
  if (!selectCat) return

  const cats = categoriasDisponibles
  const opcionesCategorias = cats.length > 0
    ? cats.map((c) => `<option value="${c}">${c}</option>`).join('')
    : '<option value="" disabled selected>Sin categorías creadas</option>'

  selectCat.innerHTML = opcionesCategorias + '<option value="__nueva__">+ Nueva categoría</option>'

  if (categoriaSeleccionada && cats.includes(categoriaSeleccionada)) {
    selectCat.value = categoriaSeleccionada
    if (wrapCategoriaNueva) wrapCategoriaNueva.style.display = 'none'
  } else if (!cats.length) {
    selectCat.value = '__nueva__'
    if (wrapCategoriaNueva) wrapCategoriaNueva.style.display = ''
  } else {
    if (wrapCategoriaNueva) wrapCategoriaNueva.style.display = 'none'
  }
}

function actualizarMetricasProductos() {
  const activos = productos.filter((p) => p.activo)
  const stockBajo = productos.filter((p) => p.stock <= 5)
  const precioProm = activos.length
    ? activos.reduce((s, p) => s + Number(p.precio), 0) / activos.length
    : 0

  const elTotal = document.getElementById('total-productos')
  const elStock = document.getElementById('productos-stock-bajo')
  const elPrecio = document.getElementById('precio-promedio-productos')
  if (elTotal) elTotal.textContent = activos.length
  if (elStock) elStock.textContent = stockBajo.length
  if (elPrecio) elPrecio.textContent = formatCurrency(precioProm)
}

function renderizarProductos() {
  const lista = document.getElementById('lista-productos')
  if (!lista) return

  actualizarFiltroCategorias()

  if (productosFiltrados.length === 0) {
    lista.innerHTML = '<p class="sin-resultados">No hay productos para mostrar</p>'
    return
  }

  lista.innerHTML = productosFiltrados.map((p) => `
    <div class="elemento-lista elemento-producto" data-id="${p.id}">
      <div class="producto-avatar-mini" aria-hidden="true">
        ${p.imagen
          ? `<img src="${p.imagen}" alt="" class="producto-avatar-mini-img">`
          : '<i class="fas fa-box"></i>'}
      </div>
      <div class="info-elemento">
        <div class="producto-lista-header">
          <h4>${p.nombre}</h4>
          ${p.activo ? '' : '<span class="insignia-inactivo">Inactivo</span>'}
        </div>
        <p class="meta-producto-card">
          ${formatCurrency(p.precio)}
        </p>
      </div>
      <div class="acciones-elemento">
        <button class="boton-icono editar" data-editar-producto="${p.id}" title="Editar">
          <i class="fas fa-edit"></i>
        </button>
        <button class="boton-icono eliminar" data-eliminar-producto="${p.id}" title="Eliminar">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('')
}

function abrirModalProducto(id = null) {
  const modal = document.getElementById('modal-producto')
  const titulo = document.getElementById('titulo-modal-producto')
  const form = document.getElementById('form-producto')
  if (!modal || !form) return

  const imagenFileInput = document.getElementById('producto-imagen-file')
  const imagenUrlInput = document.getElementById('producto-imagen-url')

  form.reset()
  document.getElementById('producto-id').value = ''
  actualizarSelectorCategorias()

  if (id) {
    const prod = productos.find((p) => p.id === id)
    if (!prod) return
    titulo.textContent = 'Editar Producto'
    document.getElementById('producto-id').value = prod.id
    document.getElementById('producto-nombre').value = prod.nombre
    document.getElementById('producto-descripcion').value = prod.descripcion || ''
    document.getElementById('producto-precio').value = prod.precio
    document.getElementById('producto-stock').value = prod.stock ?? 0
    document.getElementById('producto-activo').checked = prod.activo !== false
    actualizarSelectorCategorias(prod.categoria || '')
    if (imagenUrlInput) imagenUrlInput.value = prod.imagen || ''
    mostrarPreviewImagenProducto(prod.imagen || '')
  } else {
    titulo.textContent = 'Nuevo Producto'
    document.getElementById('producto-activo').checked = true
    if (imagenUrlInput) imagenUrlInput.value = ''
    mostrarPreviewImagenProducto('')
  }
  if (imagenFileInput) imagenFileInput.value = ''

  const borrador = _borradoresProducto[String(id || 'nuevo')]
  restaurarValoresFormulario(borrador)
  if (borrador) {
    const wrap = document.getElementById('wrap-categoria-nueva')
    if (wrap) wrap.style.display = borrador['producto-categoria'] === '__nueva__' ? '' : 'none'
    if (imagenUrlInput?.value) mostrarPreviewImagenProducto(imagenUrlInput.value)
  }

  modal.classList.add('activo')
  document.body.style.overflow = 'hidden'
}

function cerrarModalProducto() {
  const idActual = document.getElementById('producto-id')?.value || 'nuevo'
  _borradoresProducto[idActual] = capturarValoresFormulario(CAMPOS_PRODUCTO)
  _ocultarModalProducto()
}

// Oculta el modal sin capturar borrador (se usa tras guardar con éxito).
function _ocultarModalProducto() {
  const modal = document.getElementById('modal-producto')
  modal?.classList.remove('activo')
  document.body.style.overflow = ''

  const imagenFileInput = document.getElementById('producto-imagen-file')
  const imagenUrlInput = document.getElementById('producto-imagen-url')
  if (imagenFileInput) imagenFileInput.value = ''
  if (imagenUrlInput) imagenUrlInput.value = ''
  mostrarPreviewImagenProducto('')
}

// "Cancelar" es una acción explícita de descarte: a diferencia de la X, borra
// cualquier borrador pendiente para este formulario.
function cancelarModalProducto() {
  const idActual = document.getElementById('producto-id')?.value || 'nuevo'
  delete _borradoresProducto[idActual]
  _ocultarModalProducto()
}

async function guardarProducto(e) {
  e.preventDefault()

  const id = document.getElementById('producto-id').value
  let categoria = document.getElementById('producto-categoria').value
  const categoriaNuevaInput = document.getElementById('producto-categoria-nueva')
  if (categoria === '__nueva__') {
    categoria = categoriaNuevaInput.value.trim()
    if (!categoria) {
      showNotification('Ingresá el nombre de la categoría', 'warning')
      return
    }
  }

  if (!categoria) {
    showNotification('Seleccioná o creá una categoría', 'warning')
    return
  }

  const btn = e.target.closest('form')?.querySelector('[type="submit"]') ||
               document.querySelector('#modal-producto [type="submit"]')
  const restaurar = setBtnLoading(btn)

  const imagenFileInput = document.getElementById('producto-imagen-file')
  const imagenUrlInput = document.getElementById('producto-imagen-url')
  const imagenFile = imagenFileInput?.files?.[0] || null
  let imagenUrl = imagenUrlInput?.value?.trim() || ''

  if (imagenFile) {
    const subida = await uploadProductoImagen(imagenFile, id || null)
    if (!subida?.publicUrl) {
      restaurar()
      const detalle = subida?.error ? ` ${subida.error}` : ''
      showNotification(`No se pudo subir la imagen del producto.${detalle}`, 'error')
      return
    }
    imagenUrl = subida.publicUrl
    if (imagenUrlInput) imagenUrlInput.value = imagenUrl
  }

  const datos = {
    id: id ? Number(id) : undefined,
    nombre: document.getElementById('producto-nombre').value.trim(),
    descripcion: document.getElementById('producto-descripcion').value.trim(),
    precio: Number(document.getElementById('producto-precio').value),
    stock: Number(document.getElementById('producto-stock').value) || 0,
    categoria,
    imagen: imagenUrl || null,
    activo: document.getElementById('producto-activo').checked,
  }

  const resultado = await createOrUpdateProducto(datos)
  restaurar()
  if (!resultado) {
    showNotification('No se pudo guardar el producto', 'error')
    return
  }

  delete _borradoresProducto[id || 'nuevo']
  await cargarProductosDesdeBackend()
  productosFiltrados = [...productos]
  if (categoriaNuevaInput) categoriaNuevaInput.value = ''
  _ocultarModalProducto()
  renderizarProductos()
  actualizarMetricasProductos()
  showNotification(`Producto ${id ? 'actualizado' : 'creado'} correctamente`, 'success')
}

async function eliminarProducto(id) {
  const prod = productos.find((p) => p.id === id)
  if (!prod) return
  const ok = await confirmarAccion(
  'Eliminar producto',
  `¿Eliminar "${prod.nombre}"?`
  )
  if (!ok) return
  const resultado = await deleteProducto(id)
  if (!resultado) {
    showNotification('No se pudo eliminar el producto', 'error')
    return
  }
  await cargarProductosDesdeBackend()
  productosFiltrados = [...productos]
  renderizarProductos()
  actualizarMetricasProductos()
  showNotification('Producto eliminado correctamente', 'success')
}

export async function recargarProductosDesdeMock() {
  await cargarProductosDesdeBackend()
  productosFiltrados = [...productos]
  renderizarProductos()
  actualizarMetricasProductos()
  return productos
}
